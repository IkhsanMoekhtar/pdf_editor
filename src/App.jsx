import React, { useEffect, useState } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts} from 'pdf-lib';
import Sidebar from './components/layout/Sidebar';
import EmptyState from './components/layout/EmptyState';
import PdfViewer from './components/pdf/PdfViewer';
import './App.css';

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const normalizedApiBaseUrl = rawApiBaseUrl.replace(/\/$/, '');
const hfToken = (import.meta.env.VITE_HF_TOKEN || '').trim();
const supportedCompressionLevels = new Set(['fast', 'lossless', 'balanced', 'aggressive']);

const normalizeCompressionLevel = (level) => {
  if (typeof level !== 'string') {
    return 'balanced';
  }

  const normalizedLevel = level.trim().toLowerCase();
  return supportedCompressionLevels.has(normalizedLevel) ? normalizedLevel : 'balanced';
};

const apiUrl = (path) => (normalizedApiBaseUrl ? `${normalizedApiBaseUrl}${path}` : path);
const shouldAttachHfToken = normalizedApiBaseUrl.includes('.hf.space') && hfToken;

const apiFetch = (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (shouldAttachHfToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${hfToken}`);
  }

  return fetch(apiUrl(path), {
    ...options,
    headers,
  });
};

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [texts, setTexts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressLevel, setCompressLevel] = useState('balanced');
  const [compressOnSave, setCompressOnSave] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ ghostscriptAvailable: false, checked: false });
  const [lastCompression, setLastCompression] = useState(null);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await apiFetch('/api/health');
        if (!response.ok) throw new Error('health check gagal');
        const data = await response.json();
        setBackendStatus({
          checked: true,
          ghostscriptAvailable: Boolean(data.ghostscriptAvailable),
          ghostscriptCommand: data.ghostscriptCommand || null,
        });
      } catch {
        setBackendStatus({ checked: true, ghostscriptAvailable: false, ghostscriptCommand: null });
      }
    };

    checkBackend();
  }, []);

  // Fungsi mengubah warna HEX HTML ke RGB untuk pdf-lib
  const hexToPdfRgb = (hex) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return { r, g, b };
  };

  const handleUpload = (file) => {
    setPdfFile(file);
    resetViewerState();
  };

  const resetViewerState = () => {
    setActiveTool(null);
    setDrawings([]); // Reset coretan saat upload file baru
    setTexts([]);
    setRotation(0);
  };

  const downloadPdfBlob = (blob, fileName) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const buildEditedPdfBlob = async () => {
    if (!pdfFile) throw new Error('Silakan upload PDF terlebih dahulu.');

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    drawings.forEach((drawing) => {
      const pageIndex = drawing.page - 1; 
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const { height } = page.getSize();
        const points = drawing.path;

        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const pdfColor = hexToPdfRgb(drawing.color || '#ff0000'); 

          page.drawLine({
            start: { x: p1.x, y: height - p1.y }, 
            end: { x: p2.x, y: height - p2.y },
            thickness: drawing.thickness || 3,
            color: rgb(pdfColor.r, pdfColor.g, pdfColor.b), 
          });
        }
      }
    });

    texts.forEach((t) => {
      const pageIndex = t.page - 1; 
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const { height } = page.getSize();
        const pdfColor = hexToPdfRgb(t.color || '#000000'); 

        page.drawText(t.text, {
          x: t.x,
          y: height - t.y,
          size: t.size,
          font: helveticaFont,
          color: rgb(pdfColor.r, pdfColor.g, pdfColor.b),
        });
      }
    });

    if (rotation !== 0) {
      pages.forEach((page) => {
        const currentRotation = page.getRotation().angle || 0;
        page.setRotation(degrees(currentRotation + rotation));
      });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const originalName = pdfFile.name;
    const newFileName = originalName.replace(/\.[^/.]+$/, '') + '_edited.pdf';

    return { blob, fileName: newFileName };
  };

  const handleCompressPdf = async (level = 'balanced', fileToCompress = pdfFile, customMessage) => {
    if (!fileToCompress) {
      alert('Silakan upload PDF terlebih dahulu.');
      return;
    }

    if (isCompressing) return;
    setIsCompressing(true);

    try {
      const safeLevel = normalizeCompressionLevel(level);
      const formData = new FormData();
      formData.append('pdf', fileToCompress);
      formData.append('level', safeLevel);

      const response = await apiFetch('/api/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let message = 'Gagal mengompres PDF.';
        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {
          // Abaikan parse error dan pakai pesan default.
        }
        throw new Error(message);
      }

      const compressedBlob = await response.blob();
      const originalName = fileToCompress.name.replace(/\.[^/.]+$/, '');
      const compressedName = `${originalName}_compressed.pdf`;

      const originalSize = Number(response.headers.get('x-original-size') || fileToCompress.size || 0);
      const compressedSize = Number(response.headers.get('x-compressed-size') || compressedBlob.size || 0);
      const rawSavedPercentHeader = response.headers.get('x-saved-percent');
      const headerSavedPercent = rawSavedPercentHeader !== null ? Number(rawSavedPercentHeader) : Number.NaN;
      const computedSavedPercent = originalSize > 0 ? ((originalSize - compressedSize) / originalSize) * 100 : 0;
      const savedPercent = Number.isFinite(headerSavedPercent) ? headerSavedPercent : computedSavedPercent;
      const method = response.headers.get('x-compression-method') || 'unknown';
      const appliedLevel = normalizeCompressionLevel(response.headers.get('x-compression-level') || safeLevel);
      const strategy = response.headers.get('x-compression-strategy') || 'single-pass';
      const sizeStatusLabel = savedPercent >= 0 ? 'Hemat' : 'Ukuran bertambah';
      const sizeStatusPercent = Math.abs(savedPercent).toFixed(2);

      setLastCompression({
        originalSize,
        compressedSize,
        savedPercent,
        method,
        appliedLevel,
        strategy,
      });

      downloadPdfBlob(compressedBlob, compressedName);
      // Keep workspace view consistent with initial upload state after compression.
      resetViewerState();
      const defaultMessage = [
        'PDF berhasil dikompres.',
        `Ukuran: ${formatBytes(originalSize)} -> ${formatBytes(compressedSize)} (${sizeStatusLabel}: ${sizeStatusPercent}%)`,
        `Metode: ${method}`,
      ].join('\n');
      alert(customMessage || defaultMessage);
    } catch (error) {
      console.error('Gagal kompres PDF:', error);
      alert(error.message || 'Terjadi kesalahan saat mengompres PDF.');
    } finally {
      setIsCompressing(false);
    }
  };

  const savePdfWithDrawings = async () => {
    if (!pdfFile) return;

    try {
      const { blob, fileName } = await buildEditedPdfBlob();

      if (compressOnSave) {
        const editedFile = new File([blob], fileName, { type: 'application/pdf' });
        await handleCompressPdf(compressLevel, editedFile);
      } else {
        downloadPdfBlob(blob, fileName);
      }

    } catch (error) {
      console.error("Gagal menyimpan PDF:", error);
      alert("Terjadi kesalahan saat menyimpan PDF.");
    }
  };

  return (
    <div className="app-container">
      <button
        className={`mobile-menu-btn ${isSidebarOpen ? 'hidden' : ''}`}
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Buka menu sidebar"
      >
        Menu
      </button>

      <Sidebar 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
        onSave={savePdfWithDrawings} 
        onCompress={handleCompressPdf}
        compressLevel={compressLevel}
        setCompressLevel={setCompressLevel}
        compressOnSave={compressOnSave}
        setCompressOnSave={setCompressOnSave}
        backendStatus={backendStatus}
        lastCompression={lastCompression}
        isCompressing={isCompressing}
        isMobileOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Tutup menu sidebar"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className="workspace">
        {pdfFile ? (
          <PdfViewer 
            file={pdfFile} 
            activeTool={activeTool} 
            setActiveTool={setActiveTool}
            drawings={drawings}
            setDrawings={setDrawings}
            rotation={rotation}
            setRotation={setRotation}
            texts={texts}
            setTexts={setTexts}
          />
        ) : (
          <EmptyState onUpload={handleUpload} />
        )}
      </main>
    </div>
  );
}

export default App;