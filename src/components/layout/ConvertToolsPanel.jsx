import React, { useEffect, useMemo, useRef, useState } from 'react';
import FeatureIconBackdrop from './FeatureIconBackdrop';
import PdfInlinePreview from './PdfInlinePreview';

function getAcceptByPreset(direction, target) {
  if (direction === 'from-pdf') {
    return 'application/pdf,.pdf';
  }

  if (target === 'jpg') {
    return 'image/jpeg,image/jpg,image/png,.jpeg,.jpg,.png';
  }

  if (target === 'word') {
    return '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  if (target === 'ppt') {
    return '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }

  return '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

function getPresetLabel(direction, target) {
  if (direction === 'from-pdf') {
    if (target === 'jpg') return 'PDF ke JPG';
    if (target === 'word') return 'PDF ke WORD';
    if (target === 'ppt') return 'PDF ke PPT';
    return 'PDF ke EXCEL';
  }

  if (target === 'jpg') return 'JPG ke PDF';
  if (target === 'word') return 'WORD ke PDF';
  if (target === 'ppt') return 'PPT ke PDF';
  return 'EXCEL ke PDF';
}

function useObjectUrl(file) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setUrl('');
      return undefined;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  return url;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function decodeXmlEntities(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function extractXmlText(xml = '', regex) {
  const lines = [];
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const text = decodeXmlEntities(match[1] || '');
    if (text) lines.push(text);
    if (lines.length >= 20) break;
  }

  return lines;
}

export default function ConvertToolsPanel({
  convertPreset,
  convertFile,
  backendStatus,
  lastConversion,
  onConvertFileSelected,
  onRunConvert,
  onClearConvert,
  onBackToEditor,
  isConverting,
}) {
  const inputRef = useRef(null);
  const activePresetKey = `${convertPreset.direction}:${convertPreset.target}`;
  const [officePreview, setOfficePreview] = useState({ status: 'idle', title: '', lines: [] });

  const activePresetLabel = useMemo(
    () => getPresetLabel(convertPreset.direction, convertPreset.target),
    [convertPreset.direction, convertPreset.target],
  );

  const acceptValue = useMemo(
    () => getAcceptByPreset(convertPreset.direction, convertPreset.target),
    [convertPreset.direction, convertPreset.target],
  );

  const needsLibreOffice = convertPreset.target !== 'jpg';
  const isLibreOfficeUnavailable = backendStatus?.checked && needsLibreOffice && !backendStatus?.libreOfficeAvailable;
  const isPdfInput = Boolean(convertFile) && (convertFile.type === 'application/pdf' || /\.pdf$/i.test(convertFile.name));
  const isImageInput = Boolean(convertFile) && (convertFile.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(convertFile.name));
  const pdfPreviewUrl = useObjectUrl(isPdfInput ? convertFile : null);
  const imagePreviewUrl = useObjectUrl(isImageInput ? convertFile : null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!convertFile || isPdfInput || isImageInput) {
        setOfficePreview({ status: 'idle', title: '', lines: [] });
        return;
      }

      const lowerName = convertFile.name.toLowerCase();
      const isDocx = lowerName.endsWith('.docx');
      const isPptx = lowerName.endsWith('.pptx');
      const isXlsx = lowerName.endsWith('.xlsx');

      if (!isDocx && !isPptx && !isXlsx) {
        setOfficePreview({
          status: 'unsupported',
          title: 'Preview konten tidak tersedia untuk format legacy (doc/ppt/xls).',
          lines: [],
        });
        return;
      }

      setOfficePreview({ status: 'loading', title: 'Membaca isi dokumen...', lines: [] });

      try {
        const JSZipModule = await import('jszip');
        const JSZip = JSZipModule.default;
        const bytes = await convertFile.arrayBuffer();
        const zip = await JSZip.loadAsync(bytes);

        if (isDocx) {
          const entry = zip.file('word/document.xml');
          if (!entry) throw new Error('Struktur DOCX tidak valid.');
          const xml = await entry.async('string');
          const lines = extractXmlText(xml, /<w:t[^>]*>(.*?)<\/w:t>/g).slice(0, 8);

          if (!cancelled) {
            setOfficePreview({
              status: 'ready',
              title: lines.length ? 'Cuplikan isi DOCX:' : 'DOCX valid, tetapi teks tidak terdeteksi.',
              lines,
            });
          }
          return;
        }

        if (isPptx) {
          const slideKeys = Object.keys(zip.files)
            .filter((key) => /^ppt\/slides\/slide\d+\.xml$/i.test(key))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

          const lines = [];
          for (const key of slideKeys.slice(0, 3)) {
            const xml = await zip.file(key).async('string');
            const texts = extractXmlText(xml, /<a:t>(.*?)<\/a:t>/g).slice(0, 2);
            if (texts.length) {
              lines.push(`${key.split('/').pop()}: ${texts.join(' | ')}`);
            }
          }

          if (!cancelled) {
            setOfficePreview({
              status: 'ready',
              title: lines.length ? 'Cuplikan isi PPTX:' : 'PPTX valid, tetapi teks slide tidak terdeteksi.',
              lines,
            });
          }
          return;
        }

        const worksheetKeys = Object.keys(zip.files)
          .filter((key) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(key))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        const lines = [];
        for (const key of worksheetKeys.slice(0, 2)) {
          const xml = await zip.file(key).async('string');
          const texts = extractXmlText(xml, /<t>(.*?)<\/t>/g).slice(0, 4);
          const numbers = extractXmlText(xml, /<v>(.*?)<\/v>/g).slice(0, 4);
          const summary = [...texts, ...numbers].slice(0, 4);
          if (summary.length) {
            lines.push(`${key.split('/').pop()}: ${summary.join(' | ')}`);
          }
        }

        if (!cancelled) {
          setOfficePreview({
            status: 'ready',
            title: lines.length ? 'Cuplikan isi XLSX:' : 'XLSX valid, tetapi isi sheet tidak terdeteksi.',
            lines,
          });
        }
      } catch {
        if (!cancelled) {
          setOfficePreview({
            status: 'error',
            title: 'Gagal membaca preview konten file ini.',
            lines: [],
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [convertFile, isPdfInput, isImageInput]);

  return (
    <section className="batch-panel-wrap" aria-live="polite">
      <FeatureIconBackdrop mode="convert" />
      <div className="batch-panel">
        <div className="batch-panel-header">
          <div>
            <h2>{activePresetLabel}</h2>
            <p>Upload file untuk subfitur ini, lalu unduh hasilnya. Mode Office membutuhkan LibreOffice aktif di backend.</p>
          </div>
          <button className="batch-link-btn" onClick={onBackToEditor}>
            Kembali ke editor
          </button>
        </div>

        <div className="batch-panel-body">
          <input
            ref={inputRef}
            type="file"
            accept={acceptValue}
            className="batch-hidden-input"
            onChange={onConvertFileSelected}
          />

          <div className="batch-actions-row">
            <button className="batch-action-btn" onClick={() => inputRef.current?.click()}>
              Pilih File Input
            </button>
            <button className="batch-action-btn subtle" onClick={onClearConvert} disabled={!convertFile || isConverting}>
              Reset File
            </button>
            <button
              className="batch-action-btn primary"
              onClick={onRunConvert}
              disabled={isConverting || !convertFile || isLibreOfficeUnavailable}
            >
              {isConverting ? 'Mengonversi...' : `Konversi ${activePresetLabel}`}
            </button>
          </div>

          <div className="batch-form-grid">
            <div className="batch-field">
              <span>Konversi Aktif</span>
              <input value={activePresetLabel} readOnly disabled />
            </div>
            <div className="batch-field">
              <span>Status LibreOffice</span>
              <input
                value={backendStatus?.libreOfficeAvailable ? 'LibreOffice aktif' : 'LibreOffice belum tersedia'}
                readOnly
                disabled
              />
            </div>
          </div>

          <p className="batch-help-note">
            {convertFile
              ? `File dipilih: ${convertFile.name}`
              : 'Belum ada file yang dipilih.'}
          </p>

          {isPdfInput && pdfPreviewUrl && (
            <div className="batch-preview-box">
              <div className="batch-preview-header">
                <strong>Preview PDF</strong>
                <span>{convertFile.name}</span>
              </div>
              <PdfInlinePreview file={convertFile} url={pdfPreviewUrl} title={`Preview ${convertFile.name}`} />
            </div>
          )}

          {isImageInput && imagePreviewUrl && (
            <div className="batch-preview-box">
              <div className="batch-preview-header">
                <strong>Preview Gambar</strong>
                <span>{convertFile.name}</span>
              </div>
              <img className="batch-image-preview" src={imagePreviewUrl} alt={convertFile.name} />
            </div>
          )}

          {convertFile && !isPdfInput && !isImageInput && (
            <div className="batch-preview-box">
              <div className="batch-preview-header">
                <strong>Preview Dokumen</strong>
                <span>{convertFile.name}</span>
              </div>
              <div className="batch-doc-preview">
                <p className="batch-doc-preview-title">{officePreview.title || 'Membaca preview...'}</p>
                <p className="batch-doc-preview-meta">{`Ukuran: ${formatBytes(convertFile.size)} | Tipe: ${convertFile.type || 'unknown'}`}</p>
                {officePreview.lines.length > 0 && (
                  <ul className="batch-doc-preview-list">
                    {officePreview.lines.map((line, index) => (
                      <li key={`${index}-${line}`}>{line}</li>
                    ))}
                  </ul>
                )}
                {officePreview.status === 'loading' && <p className="batch-preview-hint">Sedang menyiapkan preview konten...</p>}
                {officePreview.status === 'unsupported' && <p className="batch-preview-hint">Format ini tetap bisa diproses, tetapi preview isi terbatas.</p>}
              </div>
            </div>
          )}

          {isLibreOfficeUnavailable && (
            <p className="convert-warning-note">
              Konversi Office belum bisa diproses karena LibreOffice tidak terdeteksi di backend.
            </p>
          )}

          {lastConversion && (
            <div className="batch-result-box" role="status">
              <p>{`Input: ${lastConversion.inputName}`}</p>
              <p>{`Output: ${lastConversion.outputName}`}</p>
              <p>{`Alur: ${lastConversion.sourceType} -> ${lastConversion.targetType}`}</p>
              <p>{`Mesin: ${lastConversion.method}`}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
