import React, { useState } from 'react';

const compressionLevelOptions = [
  { value: 'fast', label: '🟡 Fast (Cepat, kompresi ringan)' },
  { value: 'lossless', label: '🔵 Lossless (Kualitas Sempurna)' },
  { value: 'balanced', label: '🟢 Balanced (Kualitas-Ukuran Seimbang)' },
  { value: 'aggressive', label: '🔴 Aggressive (Ukuran Minimal)' },
];

export default function Sidebar({ activeTool, setActiveTool, onSave, onCompress, compressLevel, setCompressLevel, compressOnSave, setCompressOnSave, backendStatus, lastCompression, isCompressing, isMobileOpen, onCloseMobile }) {
  const [expandedMenu, setExpandedMenu] = useState(null);
  const isGhostscriptUnavailable = backendStatus?.checked && !backendStatus?.ghostscriptAvailable;

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const closeIfMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      onCloseMobile?.();
    }
  };

  const toggleMenu = (menuName) => {
    setExpandedMenu(prev => prev === menuName ? null : menuName);
  };

  const handleToolClick = (toolName) => {
    setActiveTool(prev => prev === toolName ? null : toolName);
  };

  return (
    <aside className={`main-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand">
        <strong>PDF Editor</strong>
        <button
          className="mobile-close-btn"
          onClick={onCloseMobile}
          aria-label="Tutup sidebar"
        >
          ×
        </button>
      </div>
      
      <nav className="sidebar-nav">
        <button className="nav-item" onClick={closeIfMobile}>GABUNG PDF</button>
        <button className="nav-item" onClick={closeIfMobile}>PISAH PDF</button>
        <button
          className="nav-item"
          onClick={() => {
            onCompress?.(compressLevel);
            closeIfMobile();
          }}
          disabled={isCompressing}
        >
          {isCompressing ? 'MENGOMPRES...' : 'KOMPRES PDF'}
        </button>
        <div className="compress-level-wrap">
          <label htmlFor="compress-level" className="compress-level-label">Level Kompresi</label>
          <select
            id="compress-level"
            className="compress-level-select"
            value={compressLevel}
            onChange={(e) => setCompressLevel?.(e.target.value)}
            disabled={isCompressing || isGhostscriptUnavailable}
            title={isGhostscriptUnavailable ? 'Level dinonaktifkan karena backend sedang fallback ke pdf-lib.' : ''}
          >
            {compressionLevelOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {backendStatus?.checked && (
            <p className={`compress-backend-status ${isGhostscriptUnavailable ? 'warning' : 'ok'}`}>
              {backendStatus.ghostscriptAvailable
                ? 'Mesin kompresi: Ghostscript aktif'
                : 'Mesin kompresi: fallback pdf-lib (hasil antar level bisa mirip)'}
            </p>
          )}
          {isGhostscriptUnavailable && (
            <div className="compress-warning-badge" role="status">
              Profil level dinonaktifkan sampai Ghostscript aktif kembali.
            </div>
          )}
          {lastCompression && (
            <div className="compress-result-box">
              <p>{`Terakhir: ${formatBytes(lastCompression.originalSize)} -> ${formatBytes(lastCompression.compressedSize)}`}</p>
              <p>{`Hemat: ${lastCompression.savedPercent.toFixed(2)}%`}</p>
              <p>{`Level: ${lastCompression.appliedLevel}`}</p>
              <p>{`Strategi: ${lastCompression.strategy}`}</p>
              <p>{`Metode: ${lastCompression.method}`}</p>
            </div>
          )}
        </div>

        <div className={`nav-group ${expandedMenu === 'convert' ? 'expanded' : ''}`}>
          <button className="nav-item has-arrow" onClick={() => toggleMenu('convert')}>
            KONVERSI PDF <span className="arrow">▼</span>
          </button>
          <div className="submenu">
            <div className="submenu-title">KE PDF</div>
            <button className="submenu-btn" onClick={closeIfMobile}><span className="doc-icon icon-jpg">J</span> JPG ke PDF</button>
            <button className="submenu-btn" onClick={closeIfMobile}><span className="doc-icon icon-word">W</span> WORD ke PDF</button>
            <button className="submenu-btn" onClick={closeIfMobile}><span className="doc-icon icon-ppt">P</span> PPT ke PDF</button>
            <button className="submenu-btn" onClick={closeIfMobile}><span className="doc-icon icon-excel">X</span> EXCEL ke PDF</button>
            
            <div className="submenu-title" style={{ marginTop: '10px' }}>DARI PDF</div>
            <button className="submenu-btn" onClick={closeIfMobile}><span className="doc-icon icon-jpg">J</span> PDF ke JPG</button>
            <button className="submenu-btn" onClick={closeIfMobile}><span className="doc-icon icon-word">W</span> PDF ke WORD</button>
            <button className="submenu-btn" onClick={closeIfMobile}><span className="doc-icon icon-ppt">P</span> PDF ke PPT</button>
            <button className="submenu-btn" onClick={closeIfMobile}><span className="doc-icon icon-excel">X</span> PDF ke EXCEL</button>
          </div>
        </div>

        <div className={`nav-group ${expandedMenu === 'tools' ? 'expanded' : ''}`}>
          <button className="nav-item has-arrow" onClick={() => toggleMenu('tools')}>
            ALAT EDITING <span className="arrow">▼</span>
          </button>
          <div className="submenu">
            <button className={`submenu-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => { handleToolClick('text'); closeIfMobile(); }}>
              <span className="doc-icon icon-pdf">T</span> Tambah Teks
            </button>
            <button className={`submenu-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => { handleToolClick('draw'); closeIfMobile(); }}>
              <span className="doc-icon icon-pdf">C</span> Coretan Bebas
            </button>
            <button className={`submenu-btn ${activeTool === 'highlight' ? 'active' : ''}`} onClick={() => { handleToolClick('highlight'); closeIfMobile(); }}>
              <span className="doc-icon icon-pdf">H</span> Highlight Area
            </button>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <label className="compress-on-save-toggle">
          <input
            type="checkbox"
            checked={compressOnSave}
            onChange={(e) => setCompressOnSave?.(e.target.checked)}
          />
          <span>Kompres saat simpan</span>
        </label>

        <button className="save-btn" disabled={isCompressing} onClick={() => { onSave(); closeIfMobile(); }}>
          {isCompressing ? '⏳ Memproses...' : compressOnSave ? '💾 Simpan + Kompres' : '💾 Simpan File'}
        </button>
      </div>
    </aside>
  );
}