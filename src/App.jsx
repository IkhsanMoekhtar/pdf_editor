import React, { useState } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts} from 'pdf-lib';
import Sidebar from './components/layout/Sidebar';
import EmptyState from './components/layout/EmptyState';
import PdfViewer from './components/pdf/PdfViewer';
import './App.css';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [texts, setTexts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressLevel, setCompressLevel] = useState('medium');

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
    setActiveTool(null);
    setDrawings([]); // Reset coretan saat upload file baru
    setTexts([]);
    setRotation(0);
  };

  const savePdfWithDrawings = async () => {
    if (!pdfFile) return;

    try {
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
            y: height - t.y, // SANGAT SIMPEL! Tidak perlu dikurangi (t.size * 0.25) lagi
            size: t.size,
            font: helveticaFont,
            color: rgb(pdfColor.r, pdfColor.g, pdfColor.b),
          });
        }
      });

      // 2. TERAPKAN ROTASI KE SEMUA HALAMAN (FITUR BARU)
      if (rotation !== 0) {
        pages.forEach((page) => {
          // Ambil rotasi bawaan dokumen (jika ada), lalu tambahkan rotasi dari user
          const currentRotation = page.getRotation().angle || 0;
          page.setRotation(degrees(currentRotation + rotation));
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const originalName = pdfFile.name;
      const newFileName = originalName.replace(/\.[^/.]+$/, "") + "_edited.pdf";
      link.download = newFileName;
      link.click();

    } catch (error) {
      console.error("Gagal menyimpan PDF:", error);
      alert("Terjadi kesalahan saat menyimpan PDF.");
    }
  };

  const handleCompressPdf = async (level = 'medium') => {
    if (!pdfFile) {
      alert('Silakan upload PDF terlebih dahulu.');
      return;
    }

    if (isCompressing) return;
    setIsCompressing(true);

    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('level', level);

      const response = await fetch('/api/compress', {
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
      const originalName = pdfFile.name.replace(/\.[^/.]+$/, '');
      const compressedName = `${originalName}_compressed.pdf`;

      const downloadUrl = URL.createObjectURL(compressedBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = compressedName;
      link.click();
      URL.revokeObjectURL(downloadUrl);

      setPdfFile(new File([compressedBlob], compressedName, { type: 'application/pdf' }));
      alert('PDF berhasil dikompres. File baru juga sudah dimuat ke editor.');
    } catch (error) {
      console.error('Gagal kompres PDF:', error);
      alert(error.message || 'Terjadi kesalahan saat mengompres PDF.');
    } finally {
      setIsCompressing(false);
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