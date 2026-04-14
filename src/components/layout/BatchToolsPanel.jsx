import React, { useRef } from 'react';

export default function BatchToolsPanel({
  mode,
  mergeFiles,
  splitFile,
  compressFile,
  compressLevel,
  lastCompression,
  backendStatus,
  isCompressAutoFilled,
  splitMode,
  splitRanges,
  onMergeFilesSelected,
  onSplitFileSelected,
  onCompressFileSelected,
  onRunMerge,
  onRunSplit,
  onRunCompress,
  onRemoveMergeFile,
  onMoveMergeFile,
  onClearMerge,
  onClearSplit,
  onClearCompress,
  onCompressLevelChange,
  onSplitModeChange,
  onSplitRangesChange,
  onBackToEditor,
  isMerging,
  isSplitting,
  isCompressing,
}) {
  const mergeInputRef = useRef(null);
  const splitInputRef = useRef(null);
  const compressInputRef = useRef(null);

  const pickMergeFiles = () => {
    mergeInputRef.current?.click();
  };

  const pickSplitFile = () => {
    splitInputRef.current?.click();
  };

  const pickCompressFile = () => {
    compressInputRef.current?.click();
  };

  const isMergeMode = mode === 'merge';
  const isSplitMode = mode === 'split';
  const isCompressMode = mode === 'compress';
  const isGhostscriptUnavailable = backendStatus?.checked && !backendStatus?.ghostscriptAvailable;

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <section className="batch-panel-wrap" aria-live="polite">
      <div className="batch-panel">
        <div className="batch-panel-header">
          <div>
            <h2>{isMergeMode ? 'Gabung PDF' : isSplitMode ? 'Pisah PDF' : 'Kompres PDF'}</h2>
            <p>
              {isMergeMode
                ? 'Pilih beberapa file PDF, atur urutannya, lalu gabungkan menjadi satu dokumen.'
                : isSplitMode
                  ? 'Pilih satu file PDF lalu pisah per halaman atau berdasarkan rentang halaman tertentu.'
                  : 'Pilih file PDF, tentukan level kompresi, lalu unduh hasil kompresinya.'}
            </p>
          </div>
          <button className="batch-link-btn" onClick={onBackToEditor}>
            Kembali ke editor
          </button>
        </div>

        {isMergeMode ? (
          <div className="batch-panel-body">
            <input
              ref={mergeInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="batch-hidden-input"
              onChange={onMergeFilesSelected}
            />

            <div className="batch-actions-row">
              <button className="batch-action-btn" onClick={pickMergeFiles}>
                Tambah File PDF
              </button>
              <button className="batch-action-btn subtle" onClick={onClearMerge} disabled={!mergeFiles.length}>
                Bersihkan Daftar
              </button>
              <button
                className="batch-action-btn primary"
                onClick={onRunMerge}
                disabled={isMerging || mergeFiles.length < 2}
              >
                {isMerging ? 'Menggabungkan...' : 'Gabungkan & Unduh'}
              </button>
            </div>

            <div className="batch-file-list" role="list">
              {mergeFiles.length === 0 ? (
                <p className="batch-empty-note">Belum ada file. Tambahkan minimal 2 PDF untuk memulai.</p>
              ) : (
                mergeFiles.map((file, index) => (
                  <div className="batch-file-item" role="listitem" key={`${file.name}-${index}-${file.size}`}>
                    <span className="batch-file-name">{index + 1}. {file.name}</span>
                    <div className="batch-file-actions">
                      <button
                        className="batch-mini-btn"
                        onClick={() => onMoveMergeFile(index, -1)}
                        disabled={index === 0}
                        title="Geser ke atas"
                      >
                        ↑
                      </button>
                      <button
                        className="batch-mini-btn"
                        onClick={() => onMoveMergeFile(index, 1)}
                        disabled={index === mergeFiles.length - 1}
                        title="Geser ke bawah"
                      >
                        ↓
                      </button>
                      <button className="batch-mini-btn danger" onClick={() => onRemoveMergeFile(index)} title="Hapus file">
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : isSplitMode ? (
          <div className="batch-panel-body">
            <input
              ref={splitInputRef}
              type="file"
              accept="application/pdf"
              className="batch-hidden-input"
              onChange={onSplitFileSelected}
            />

            <div className="batch-actions-row">
              <button className="batch-action-btn" onClick={pickSplitFile}>
                Pilih File PDF
              </button>
              <button className="batch-action-btn subtle" onClick={onClearSplit} disabled={!splitFile}>
                Reset File
              </button>
              <button className="batch-action-btn primary" onClick={onRunSplit} disabled={isSplitting || !splitFile}>
                {isSplitting ? 'Memisahkan...' : 'Pisahkan & Unduh ZIP'}
              </button>
            </div>

            <div className="batch-form-grid">
              <label className="batch-field">
                <span>Mode Pisah</span>
                <select value={splitMode} onChange={(e) => onSplitModeChange(e.target.value)}>
                  <option value="each">Per halaman (semua halaman)</option>
                  <option value="ranges">Berdasarkan range</option>
                </select>
              </label>

              <label className="batch-field">
                <span>Range Halaman</span>
                <input
                  type="text"
                  value={splitRanges}
                  onChange={(e) => onSplitRangesChange(e.target.value)}
                  placeholder="Contoh: 1-3,5,8-10"
                  disabled={splitMode !== 'ranges'}
                />
              </label>
            </div>

            <p className="batch-help-note">
              {splitFile
                ? `File dipilih: ${splitFile.name}`
                : 'Belum ada file PDF yang dipilih.'}
            </p>
          </div>
        ) : (
          <div className="batch-panel-body">
            <input
              ref={compressInputRef}
              type="file"
              accept="application/pdf"
              className="batch-hidden-input"
              onChange={onCompressFileSelected}
            />

            <div className="batch-actions-row">
              <button className="batch-action-btn" onClick={pickCompressFile}>
                Pilih File PDF
              </button>
              <button className="batch-action-btn subtle" onClick={onClearCompress} disabled={!compressFile}>
                Reset File
              </button>
              <button className="batch-action-btn primary" onClick={onRunCompress} disabled={isCompressing || !compressFile}>
                {isCompressing ? 'Mengompres...' : 'Kompres & Unduh'}
              </button>
            </div>

            <div className="batch-form-grid">
              <label className="batch-field">
                <span>Level Kompresi</span>
                <select
                  value={compressLevel}
                  onChange={(e) => onCompressLevelChange(e.target.value)}
                  disabled={isCompressing || isGhostscriptUnavailable}
                  title={isGhostscriptUnavailable ? 'Level dinonaktifkan karena backend sedang fallback ke pdf-lib.' : ''}
                >
                  <option value="fast">Fast (Cepat, kompresi ringan)</option>
                  <option value="lossless">Lossless (Kualitas Sempurna)</option>
                  <option value="balanced">Balanced (Seimbang)</option>
                  <option value="aggressive">Aggressive (Ukuran Minimal)</option>
                </select>
              </label>

              <div className="batch-field">
                <span>Status Mesin</span>
                <input
                  value={backendStatus?.ghostscriptAvailable ? 'Ghostscript aktif' : 'Fallback pdf-lib aktif'}
                  disabled
                  readOnly
                />
              </div>
            </div>

            <p className="batch-help-note">
              {compressFile
                ? `File dipilih: ${compressFile.name}`
                : 'Belum ada file PDF yang dipilih.'}
            </p>

            {compressFile && isCompressAutoFilled && (
              <p className="batch-autofill-note">File ini otomatis diambil dari PDF yang sedang terbuka di editor.</p>
            )}

            {lastCompression && (
              <div className="batch-result-box" role="status">
                <p>{`Ukuran: ${formatBytes(lastCompression.originalSize)} -> ${formatBytes(lastCompression.compressedSize)}`}</p>
                <p>{`${lastCompression.savedPercent >= 0 ? 'Hemat' : 'Ukuran bertambah'}: ${Math.abs(lastCompression.savedPercent).toFixed(2)}%`}</p>
                <p>{`Level: ${lastCompression.appliedLevel}`}</p>
                <p>{`Strategi: ${lastCompression.strategy}`}</p>
                <p>{`Metode: ${lastCompression.method}`}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
