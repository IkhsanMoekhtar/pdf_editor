import React, { useState } from 'react';
import {
  ChevronDown,
  FileImage,
  FileSpreadsheet,
  FileText,
  Highlighter,
  LoaderCircle,
  PenTool,
  Presentation,
  Save,
  Type,
  X,
} from 'lucide-react';

export default function Sidebar({ activeTool, setActiveTool, onSave, onOpenMerge, onOpenSplit, onOpenCompress, onOpenConvert, activeConvertKey, workspaceMode, compressOnSave, setCompressOnSave, isCompressing, isConverting, isSaving, isMerging, isSplitting, isMobileOpen, onCloseMobile }) {
  const [expandedMenu, setExpandedMenu] = useState(null);

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

  const openConvertPreset = (direction, target) => {
    onOpenConvert?.({ direction, target });
    closeIfMobile();
  };

  return (
    <aside className={`main-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand">
        <button
          type="button"
          className="brand-button"
          onClick={() => window.location.reload()}
          aria-label="Muat ulang aplikasi"
          title="Muat ulang aplikasi"
        >
          <strong>Folio PDF</strong>
        </button>
        <button
          className="mobile-close-btn"
          onClick={onCloseMobile}
          aria-label="Tutup sidebar"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${workspaceMode === 'merge' ? 'active' : ''}`}
          onClick={() => {
            onOpenMerge?.();
            closeIfMobile();
          }}
          disabled={isMerging || isSplitting || isSaving || isCompressing || isConverting}
        >
          Gabung PDF
        </button>
        <button
          className={`nav-item ${workspaceMode === 'split' ? 'active' : ''}`}
          onClick={() => {
            onOpenSplit?.();
            closeIfMobile();
          }}
          disabled={isMerging || isSplitting || isSaving || isCompressing || isConverting}
        >
          Pisah PDF
        </button>
        <button
          className={`nav-item compress-btn ${workspaceMode === 'compress' ? 'active' : ''}`}
          onClick={() => {
            onOpenCompress?.();
            closeIfMobile();
          }}
          disabled={isMerging || isSplitting || isSaving || isCompressing || isConverting}
        >
          Kompres PDF
        </button>

        <div className={`nav-group ${expandedMenu === 'convert' ? 'expanded' : ''}`}>
          <button className="nav-item has-arrow" onClick={() => toggleMenu('convert')}>
            Konversi PDF <span className="arrow" aria-hidden="true"><ChevronDown size={14} /></span>
          </button>
          <div className="submenu">
            <div className="submenu-title">Ke PDF</div>
            <button className={`submenu-btn ${workspaceMode === 'convert' && activeConvertKey === 'to-pdf:jpg' ? 'active' : ''}`} onClick={() => openConvertPreset('to-pdf', 'jpg')} disabled={isConverting || isMerging || isSplitting || isSaving || isCompressing}><span className="doc-icon icon-jpg" aria-hidden="true"><FileImage size={12} /></span> JPG ke PDF</button>
            <button className={`submenu-btn ${workspaceMode === 'convert' && activeConvertKey === 'to-pdf:word' ? 'active' : ''}`} onClick={() => openConvertPreset('to-pdf', 'word')} disabled={isConverting || isMerging || isSplitting || isSaving || isCompressing}><span className="doc-icon icon-word" aria-hidden="true"><FileText size={12} /></span> WORD ke PDF</button>
            <button className={`submenu-btn ${workspaceMode === 'convert' && activeConvertKey === 'to-pdf:ppt' ? 'active' : ''}`} onClick={() => openConvertPreset('to-pdf', 'ppt')} disabled={isConverting || isMerging || isSplitting || isSaving || isCompressing}><span className="doc-icon icon-ppt" aria-hidden="true"><Presentation size={12} /></span> PPT ke PDF</button>
            <button className={`submenu-btn ${workspaceMode === 'convert' && activeConvertKey === 'to-pdf:excel' ? 'active' : ''}`} onClick={() => openConvertPreset('to-pdf', 'excel')} disabled={isConverting || isMerging || isSplitting || isSaving || isCompressing}><span className="doc-icon icon-excel" aria-hidden="true"><FileSpreadsheet size={12} /></span> EXCEL ke PDF</button>
            
            <div className="submenu-title" style={{ marginTop: '10px' }}>Dari PDF</div>
            <button className={`submenu-btn ${workspaceMode === 'convert' && activeConvertKey === 'from-pdf:jpg' ? 'active' : ''}`} onClick={() => openConvertPreset('from-pdf', 'jpg')} disabled={isConverting || isMerging || isSplitting || isSaving || isCompressing}><span className="doc-icon icon-jpg" aria-hidden="true"><FileImage size={12} /></span> PDF ke JPG</button>
            <button className={`submenu-btn ${workspaceMode === 'convert' && activeConvertKey === 'from-pdf:word' ? 'active' : ''}`} onClick={() => openConvertPreset('from-pdf', 'word')} disabled={isConverting || isMerging || isSplitting || isSaving || isCompressing}><span className="doc-icon icon-word" aria-hidden="true"><FileText size={12} /></span> PDF ke WORD</button>
            <button className={`submenu-btn ${workspaceMode === 'convert' && activeConvertKey === 'from-pdf:ppt' ? 'active' : ''}`} onClick={() => openConvertPreset('from-pdf', 'ppt')} disabled={isConverting || isMerging || isSplitting || isSaving || isCompressing}><span className="doc-icon icon-ppt" aria-hidden="true"><Presentation size={12} /></span> PDF ke PPT</button>
            <button className={`submenu-btn ${workspaceMode === 'convert' && activeConvertKey === 'from-pdf:excel' ? 'active' : ''}`} onClick={() => openConvertPreset('from-pdf', 'excel')} disabled={isConverting || isMerging || isSplitting || isSaving || isCompressing}><span className="doc-icon icon-excel" aria-hidden="true"><FileSpreadsheet size={12} /></span> PDF ke EXCEL</button>
          </div>
        </div>

        <div className={`nav-group ${expandedMenu === 'tools' ? 'expanded' : ''}`}>
          <button className="nav-item has-arrow" onClick={() => toggleMenu('tools')}>
            Alat anotasi <span className="arrow" aria-hidden="true"><ChevronDown size={14} /></span>
          </button>
          <div className="submenu">
            <button className={`submenu-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => { handleToolClick('text'); closeIfMobile(); }}>
              <span className="doc-icon icon-pdf" aria-hidden="true"><Type size={12} /></span> Tambah teks
            </button>
            <button className={`submenu-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => { handleToolClick('draw'); closeIfMobile(); }}>
              <span className="doc-icon icon-pdf" aria-hidden="true"><PenTool size={12} /></span> Coretan bebas
            </button>
            <button className={`submenu-btn ${activeTool === 'highlight' ? 'active' : ''}`} onClick={() => { handleToolClick('highlight'); closeIfMobile(); }}>
              <span className="doc-icon icon-pdf" aria-hidden="true"><Highlighter size={12} /></span> Sorot area
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
          <span>Kompres saat disimpan</span>
        </label>

        <button className="save-btn" disabled={isCompressing || isConverting || isSaving} onClick={() => { onSave(); closeIfMobile(); }}>
          {(isCompressing || isSaving)
            ? <LoaderCircle className="button-icon spin" size={16} aria-hidden="true" />
            : <Save className="button-icon" size={16} aria-hidden="true" />}
          <span>{isCompressing ? 'Mengompres...' : isSaving ? 'Menyimpan...' : compressOnSave ? 'Simpan + Kompres' : 'Simpan File'}</span>
        </button>
      </div>
    </aside>
  );
}