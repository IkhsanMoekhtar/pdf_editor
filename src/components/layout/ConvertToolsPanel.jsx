import React, { useMemo, useRef } from 'react';

const PRESETS = [
  { key: 'to-pdf:jpg', label: 'JPG ke PDF', direction: 'to-pdf', target: 'jpg' },
  { key: 'to-pdf:word', label: 'WORD ke PDF', direction: 'to-pdf', target: 'word' },
  { key: 'to-pdf:ppt', label: 'PPT ke PDF', direction: 'to-pdf', target: 'ppt' },
  { key: 'to-pdf:excel', label: 'EXCEL ke PDF', direction: 'to-pdf', target: 'excel' },
  { key: 'from-pdf:jpg', label: 'PDF ke JPG', direction: 'from-pdf', target: 'jpg' },
  { key: 'from-pdf:word', label: 'PDF ke WORD', direction: 'from-pdf', target: 'word' },
  { key: 'from-pdf:ppt', label: 'PDF ke PPT', direction: 'from-pdf', target: 'ppt' },
  { key: 'from-pdf:excel', label: 'PDF ke EXCEL', direction: 'from-pdf', target: 'excel' },
];

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

export default function ConvertToolsPanel({
  convertPreset,
  convertFile,
  backendStatus,
  lastConversion,
  onSelectPreset,
  onConvertFileSelected,
  onRunConvert,
  onClearConvert,
  onBackToEditor,
  isConverting,
}) {
  const inputRef = useRef(null);
  const activePresetKey = `${convertPreset.direction}:${convertPreset.target}`;

  const activePreset = useMemo(
    () => PRESETS.find((item) => item.key === activePresetKey) || PRESETS[0],
    [activePresetKey],
  );

  const acceptValue = useMemo(
    () => getAcceptByPreset(convertPreset.direction, convertPreset.target),
    [convertPreset.direction, convertPreset.target],
  );

  const needsLibreOffice = activePreset.target !== 'jpg';
  const isLibreOfficeUnavailable = backendStatus?.checked && needsLibreOffice && !backendStatus?.libreOfficeAvailable;

  return (
    <section className="batch-panel-wrap" aria-live="polite">
      <div className="batch-panel">
        <div className="batch-panel-header">
          <div>
            <h2>Konversi File</h2>
            <p>Pilih jenis konversi, upload file, lalu unduh hasilnya. Mode Office membutuhkan LibreOffice aktif di backend.</p>
          </div>
          <button className="batch-link-btn" onClick={onBackToEditor}>
            Kembali ke editor
          </button>
        </div>

        <div className="convert-preset-grid" role="list" aria-label="Daftar jenis konversi">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              role="listitem"
              className={`convert-preset-btn ${activePresetKey === preset.key ? 'active' : ''}`}
              onClick={() => onSelectPreset({ direction: preset.direction, target: preset.target })}
              disabled={isConverting}
            >
              {preset.label}
            </button>
          ))}
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
              {isConverting ? 'Mengonversi...' : `Konversi ${activePreset.label}`}
            </button>
          </div>

          <div className="batch-form-grid">
            <div className="batch-field">
              <span>Konversi Aktif</span>
              <input value={activePreset.label} readOnly disabled />
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
