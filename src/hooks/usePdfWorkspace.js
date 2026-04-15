import { useEffect, useState } from 'react';

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

export default function usePdfWorkspace() {
  const [pdfFile, setPdfFile] = useState(null);
  const [workspaceMode, setWorkspaceMode] = useState('edit');
  const [activeTool, setActiveTool] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [texts, setTexts] = useState([]);
  const [mergeFiles, setMergeFiles] = useState([]);
  const [splitFile, setSplitFile] = useState(null);
  const [compressFile, setCompressFile] = useState(null);
  const [convertFile, setConvertFile] = useState(null);
  const [convertPreset, setConvertPreset] = useState({ direction: 'to-pdf', target: 'jpg' });
  const [isCompressAutoFilled, setIsCompressAutoFilled] = useState(false);
  const [splitMode, setSplitMode] = useState('each');
  const [splitRanges, setSplitRanges] = useState('1-2,3-4');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);
  const [compressLevel, setCompressLevel] = useState('balanced');
  const [compressOnSave, setCompressOnSave] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ ghostscriptAvailable: false, checked: false });
  const [lastCompression, setLastCompression] = useState(null);
  const [lastConversion, setLastConversion] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const checkBackend = async () => {
      setIsCheckingBackend(true);
      try {
        const response = await apiFetch('/api/health');
        if (!response.ok) throw new Error('health check gagal');
        const data = await response.json();
        setBackendStatus({
          checked: true,
          ghostscriptAvailable: Boolean(data.ghostscriptAvailable),
          ghostscriptCommand: data.ghostscriptCommand || null,
          libreOfficeAvailable: Boolean(data.libreOfficeAvailable),
          libreOfficeCommand: data.libreOfficeCommand || null,
        });
      } catch {
        setBackendStatus({
          checked: true,
          ghostscriptAvailable: false,
          ghostscriptCommand: null,
          libreOfficeAvailable: false,
          libreOfficeCommand: null,
        });
      } finally {
        setIsCheckingBackend(false);
      }
    };

    checkBackend();
  }, []);

  const hexToPdfRgb = (hex) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return { r, g, b };
  };

  const resetViewerState = () => {
    setActiveTool(null);
    setDrawings([]);
    setTexts([]);
    setRotation(0);
  };

  const handleUpload = (file) => {
    setPdfFile(file);
    setWorkspaceMode('edit');
    setCompressFile(file);
    setIsCompressAutoFilled(false);
    setLastCompression(null);
    resetViewerState();
  };

  const openMergeWorkspace = () => {
    setWorkspaceMode('merge');
    setActiveTool(null);
  };

  const openSplitWorkspace = () => {
    setWorkspaceMode('split');
    setActiveTool(null);
  };

  const openCompressWorkspace = () => {
    setWorkspaceMode('compress');
    if (pdfFile) {
      setCompressFile(pdfFile);
      setIsCompressAutoFilled(true);
    } else {
      setIsCompressAutoFilled(false);
    }
    setActiveTool(null);
  };

  const openConvertWorkspace = (preset) => {
    const safeDirection = preset?.direction === 'from-pdf' ? 'from-pdf' : 'to-pdf';
    const safeTarget = typeof preset?.target === 'string' ? preset.target : 'jpg';
    setConvertPreset({ direction: safeDirection, target: safeTarget });
    setWorkspaceMode('convert');
    setActiveTool(null);
    setLastConversion(null);
  };

  const getFilenameFromDisposition = (dispositionHeader, fallbackName) => {
    if (typeof dispositionHeader !== 'string' || !dispositionHeader.trim()) {
      return fallbackName;
    }

    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(dispositionHeader);
    if (utfMatch?.[1]) {
      try {
        return decodeURIComponent(utfMatch[1]);
      } catch {
        return utfMatch[1];
      }
    }

    const plainMatch = /filename="?([^";]+)"?/i.exec(dispositionHeader);
    return plainMatch?.[1] || fallbackName;
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

    const { PDFDocument, rgb, degrees, StandardFonts } = await import('pdf-lib');

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
      showToast('Silakan upload PDF terlebih dahulu.', 'error');
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
      resetViewerState();
      const defaultMessage = [
        'PDF berhasil dikompres.',
        `Ukuran: ${formatBytes(originalSize)} -> ${formatBytes(compressedSize)} (${sizeStatusLabel}: ${sizeStatusPercent}%)`,
        `Metode: ${method}`,
      ].join('\n');
      showToast(customMessage || defaultMessage, 'success');
    } catch (error) {
      console.error('Gagal kompres PDF:', error);
      showToast(error.message || 'Terjadi kesalahan saat mengompres PDF.', 'error');
    } finally {
      setIsCompressing(false);
    }
  };

  const savePdfWithDrawings = async () => {
    if (!pdfFile) return;
    setIsSaving(true);

    try {
      const { blob, fileName } = await buildEditedPdfBlob();

      if (compressOnSave) {
        const editedFile = new File([blob], fileName, { type: 'application/pdf' });
        await handleCompressPdf(compressLevel, editedFile);
      } else {
        downloadPdfBlob(blob, fileName);
      }
    } catch (error) {
      console.error('Gagal menyimpan PDF:', error);
      showToast('Terjadi kesalahan saat menyimpan PDF.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMergeFilesSelected = (event) => {
    const selectedFiles = Array.from(event.target.files || []).filter((file) => file.type === 'application/pdf');
    if (!selectedFiles.length) return;

    setMergeFiles((prev) => [...prev, ...selectedFiles]);
    event.target.value = '';
  };

  const handleSplitFileSelected = (event) => {
    const pickedFile = event.target.files?.[0];
    if (!pickedFile) return;

    if (pickedFile.type !== 'application/pdf') {
      showToast('File harus berformat PDF.', 'error');
      event.target.value = '';
      return;
    }

    setSplitFile(pickedFile);
    event.target.value = '';
  };

  const handleCompressFileSelected = (event) => {
    const pickedFile = event.target.files?.[0];
    if (!pickedFile) return;

    if (pickedFile.type !== 'application/pdf') {
      showToast('File harus berformat PDF.', 'error');
      event.target.value = '';
      return;
    }

    setCompressFile(pickedFile);
    setIsCompressAutoFilled(false);
    event.target.value = '';
  };

  const handleConvertFileSelected = (event) => {
    const pickedFile = event.target.files?.[0];
    if (!pickedFile) return;

    setConvertFile(pickedFile);
    event.target.value = '';
  };

  const handleMoveMergeFile = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= mergeFiles.length) return;

    setMergeFiles((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;
      return next;
    });
  };

  const handleMergePdf = async () => {
    if (mergeFiles.length < 2) {
      showToast('Tambahkan minimal 2 file PDF untuk digabung.', 'error');
      return;
    }

    if (isMerging) return;
    setIsMerging(true);

    try {
      const formData = new FormData();
      mergeFiles.forEach((file) => {
        formData.append('pdfs', file, file.name);
      });

      const response = await apiFetch('/api/merge', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Gagal menggabungkan PDF.';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // fallback default message
        }
        throw new Error(errorMessage);
      }

      const outputBlob = await response.blob();
      const outputName = getFilenameFromDisposition(
        response.headers.get('content-disposition'),
        'merged.pdf',
      );

      downloadPdfBlob(outputBlob, outputName);
      showToast('PDF berhasil digabung.', 'success');
    } catch (error) {
      console.error('Merge error:', error);
      showToast(error.message || 'Terjadi kesalahan saat menggabungkan PDF.', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  const handleSplitPdf = async () => {
    if (!splitFile) {
      showToast('Pilih file PDF terlebih dahulu.', 'error');
      return;
    }

    if (splitMode === 'ranges' && !splitRanges.trim()) {
      showToast('Isi range halaman terlebih dahulu. Contoh: 1-3,5,8-10', 'error');
      return;
    }

    if (isSplitting) return;
    setIsSplitting(true);

    try {
      const formData = new FormData();
      formData.append('pdf', splitFile, splitFile.name);
      formData.append('mode', splitMode);
      if (splitMode === 'ranges') {
        formData.append('ranges', splitRanges);
      }

      const response = await apiFetch('/api/split', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Gagal memisahkan PDF.';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // fallback default message
        }
        throw new Error(errorMessage);
      }

      const zipBlob = await response.blob();
      const zipName = getFilenameFromDisposition(
        response.headers.get('content-disposition'),
        'split_result.zip',
      );

      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipName;
      link.click();
      URL.revokeObjectURL(link.href);

      showToast('PDF berhasil dipisah. Hasil diunduh dalam format ZIP.', 'success');
    } catch (error) {
      console.error('Split error:', error);
      showToast(error.message || 'Terjadi kesalahan saat memisahkan PDF.', 'error');
    } finally {
      setIsSplitting(false);
    }
  };

  const handleRunConversion = async () => {
    if (!convertFile) {
      showToast('Pilih file terlebih dahulu untuk dikonversi.', 'error');
      return;
    }

    if (isConverting) return;
    setIsConverting(true);

    try {
      const formData = new FormData();
      formData.append('file', convertFile, convertFile.name);
      formData.append('direction', convertPreset.direction);
      formData.append('target', convertPreset.target);

      const response = await apiFetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Gagal mengonversi file.';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // fallback default message
        }
        throw new Error(errorMessage);
      }

      const outputBlob = await response.blob();
      const outputName = getFilenameFromDisposition(
        response.headers.get('content-disposition'),
        'converted_file',
      );

      const method = response.headers.get('x-conversion-method') || '-';
      const sourceType = response.headers.get('x-conversion-source') || '-';
      const targetType = response.headers.get('x-conversion-target') || '-';

      const link = document.createElement('a');
      link.href = URL.createObjectURL(outputBlob);
      link.download = outputName;
      link.click();
      URL.revokeObjectURL(link.href);

      setLastConversion({
        inputName: convertFile.name,
        outputName,
        sourceType,
        targetType,
        method,
      });

      showToast(`Konversi berhasil. File hasil: ${outputName}`, 'success');
    } catch (error) {
      console.error('Conversion error:', error);
      showToast(error.message || 'Terjadi kesalahan saat mengonversi file.', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  const busyMessage = isCompressing
    ? 'Menekan ukuran file dengan hati-hati...'
    : isConverting
      ? 'Menerjemahkan file ke format lain...'
      : isMerging
        ? 'Menyatukan beberapa lembar menjadi satu...'
        : isSplitting
          ? 'Memecah dokumen ke bagian yang lebih kecil...'
          : isSaving
            ? 'Menyusun file sebelum disimpan...'
            : isCheckingBackend
              ? 'Memeriksa layanan pendukung...'
              : '';
  const isGlobalBusy = isCompressing || isConverting || isMerging || isSplitting || isSaving || isCheckingBackend;
  const activeConvertKey = `${convertPreset.direction}:${convertPreset.target}`;

  return {
    pdfFile,
    workspaceMode,
    activeTool,
    setActiveTool,
    drawings,
    setDrawings,
    rotation,
    setRotation,
    texts,
    setTexts,
    mergeFiles,
    splitFile,
    compressFile,
    compressLevel,
    lastCompression,
    backendStatus,
    isCompressAutoFilled,
    splitMode,
    splitRanges,
    isSidebarOpen,
    setIsSidebarOpen,
    compressOnSave,
    setCompressOnSave,
    isCompressing,
    isConverting,
    isMerging,
    isSplitting,
    isSaving,
    isCheckingBackend,
    convertPreset,
    convertFile,
    lastConversion,
    toast,
    showToast,
    busyMessage,
    isGlobalBusy,
    activeConvertKey,
    handleUpload,
    openMergeWorkspace,
    openSplitWorkspace,
    openCompressWorkspace,
    openConvertWorkspace,
    savePdfWithDrawings,
    handleConvertFileSelected,
    handleMergeFilesSelected,
    handleSplitFileSelected,
    handleCompressFileSelected,
    handleMoveMergeFile,
    handleMergePdf,
    handleSplitPdf,
    handleRunConversion,
    setMergeFiles,
    setSplitFile,
    setCompressFile,
    setLastConversion,
    setCompressLevel,
    setSplitMode,
    setSplitRanges,
    setWorkspaceMode,
    setToast,
  };
}
