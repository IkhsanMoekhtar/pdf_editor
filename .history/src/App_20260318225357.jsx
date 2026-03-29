import React from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { usePdfEditor } from './usePdfEditor'; // Impor Custom Hook yang baru dibuat
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function App() {
  // Panggil hook dan ambil (destructure) semua nilai/fungsi yang dibutuhkan
  const {
    pdfFile, activeTool, expandedMenu, numPages, pageNumber, containerSize,
    userZoom, rotation, isZoomMode, setIsZoomMode, flipX, flipY, isDragging,
    fileInputRef, pdfWrapperRef, scrollContainerRef,
    calculateBaseScale, handleFileUpload, onDocumentLoadSuccess, onPageLoadSuccess,
    changePage, handleMouseDown, handleMouseMove, handleMouseUpOrLeave,
    handleToolClick, rotatePage, toggleFlipX, toggleFlipY, triggerUpload,
    toggleMenu, getCursorStyle, currentWidth
  } = usePdfEditor();

  return (
    <div className="app-container">
      
      <aside className="main-sidebar">
        <div className="brand">
          <span className="brand-icon">📄</span>
          <strong>PDF Editor</strong>
        </div>
        
        <nav className="sidebar-nav">
          <button className="nav-item">GABUNG PDF</button>
          <button className="nav-item">PISAH PDF</button>
          <button className="nav-item">KOMPRES PDF</button>

          <div className={`nav-group ${expandedMenu === 'convert' ? 'expanded' : ''}`}>
            <button className="nav-item has-arrow" onClick={() => toggleMenu('convert')}>
              KONVERSI PDF <span className="arrow">▼</span>
            </button>
            <div className="submenu">
              <div className="submenu-title">KE PDF</div>
              <button className="submenu-btn"><span className="doc-icon icon-jpg">J</span> JPG ke PDF</button>
              <button className="submenu-btn"><span className="doc-icon icon-word">W</span> WORD ke PDF</button>
              <button className="submenu-btn"><span className="doc-icon icon-ppt">P</span> PPT ke PDF</button>
              <button className="submenu-btn"><span className="doc-icon icon-excel">X</span> EXCEL ke PDF</button>
              
              <div className="submenu-title" style={{ marginTop: '10px' }}>DARI PDF</div>
              <button className="submenu-btn"><span className="doc-icon icon-jpg">J</span> PDF ke JPG</button>
              <button className="submenu-btn"><span className="doc-icon icon-word">W</span> PDF ke WORD</button>
              <button className="submenu-btn"><span className="doc-icon icon-ppt">P</span> PDF ke PPT</button>
              <button className="submenu-btn"><span className="doc-icon icon-excel">X</span> PDF ke EXCEL</button>
            </div>
          </div>

          <div className={`nav-group ${expandedMenu === 'tools' ? 'expanded' : ''}`}>
            <button className="nav-item has-arrow" onClick={() => toggleMenu('tools')}>
              ALAT EDITING <span className="arrow">▼</span>
            </button>
            <div className="submenu">
              <button className={`submenu-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => handleToolClick('text')}>
                <span className="doc-icon icon-pdf">T</span> Tambah Teks
              </button>
              <button className={`submenu-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => handleToolClick('draw')}>
                <span className="doc-icon icon-pdf">C</span> Coretan Bebas
              </button>
              <button className={`submenu-btn ${activeTool === 'highlight' ? 'active' : ''}`} onClick={() => handleToolClick('highlight')}>
                <span className="doc-icon icon-pdf">H</span> Highlight Area
              </button>
            </div>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="save-btn" onClick={() => { if(pdfFile) alert("Mempersiapkan data!"); }}>
            💾 Simpan File
          </button>
        </div>
      </aside>

      <main className="workspace">
        <div 
          className="viewer-container" 
          ref={pdfWrapperRef} 
          style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#e5e7eb' }}
        >
          {pdfFile ? (
            <div className="custom-pdf-viewer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: '20px' }}>
              
              <div className="pdf-controls" style={{ flexShrink: 0, marginBottom: '15px', display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                <button onClick={() => changePage(-1)} disabled={pageNumber <= 1} style={{ padding: '8px 12px', cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}>
                  ◀ Prev
                </button>
                <span style={{ fontWeight: 'bold', color: '#374151' }}>
                  Halaman {pageNumber} dari {numPages || '--'}
                </span>
                <button onClick={() => changePage(1)} disabled={pageNumber >= numPages} style={{ padding: '8px 12px', cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}>
                  Next ▶
                </button>
              </div>

              <div 
                className="pdf-paper-wrapper" 
                ref={scrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                style={{ 
                  flex: 1, 
                  overflow: 'auto', 
                  justifyContent: 'center', 
                  alignItems: 'flex-start', 
                  width: '100%', 
                  paddingTop: '10px', 
                  paddingBottom: '20px',
                  cursor: getCursorStyle(),
                  userSelect: isDragging ? 'none' : 'auto'
                }}
              >
                <div className="pdf-paper" 
                style={{ 
                  boxShadow: '0 10px 30px rgba(0,0,0,0.15)', 
                  backgroundColor: 'white',
                  display: 'block',
                  margin: currentWidth > containerSize.width ? '0' : '0 auto',
                  width: currentWidth ? `${currentWidth}px` : 'auto',
                }}>
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<div style={{ padding: '50px' }}>Memuat mesin dan dokumen...</div>}
                >
                  <Page 
                    pageNumber={pageNumber} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false} 
                    onLoadSuccess={onPageLoadSuccess}
                    scale={calculateBaseScale() * 4}
                    rotate={rotation} 
                  />
                </Document>
                </div>
              </div>

              <div className="floating-action-bar" style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(5px)', padding: '10px 20px', borderRadius: '99px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', gap: '10px', alignItems: 'center', zIndex: 1000, border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '11px', color: '#6b7280', marginRight: '5px' }}>Zoom: {(calculateBaseScale() * userZoom * 100).toFixed(0)}%</p>
                <button 
                  className={`action-btn ${isZoomMode ? 'active' : ''}`} 
                  onClick={() => setIsZoomMode(!isZoomMode)} 
                  title="Gunakan Scroll Mouse untuk Zoom"
                >
                  🔍 {isZoomMode ? 'Scroll Zoom: ON' : 'Scroll Zoom: OFF'}
                </button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb' }}></div>
                <button className={`action-btn ${rotation !== 0 ? 'active' : ''}`} onClick={rotatePage} title="Putar">🔄 R</button>
                <button className={`action-btn ${flipX ? 'active' : ''}`} onClick={toggleFlipX} title="Flip Horisontal">🔄 H</button>
                <button className={`action-btn ${flipY ? 'active' : ''}`} onClick={toggleFlipY} title="Flip Vertikal">🔄 V</button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb' }}></div>
                
                <button className={`action-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => handleToolClick('text')}>✍️ Teks</button>
                <button className={`action-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => handleToolClick('draw')}>🖌️ Coret</button>
              </div>

            </div>
          ) : (
            <div className="empty-state desktop-scene" onClick={triggerUpload} style={{ margin: '20px' }}>
              <input type="file" accept="application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
              <div className="clipboard"><div className="clipboard-paper"><div className="clipboard-header">Kanvas Anda</div><div className="clipboard-content"><div className="empty-line large"></div><div className="empty-line"></div><div className="empty-line medium"></div><div className="empty-line large"></div></div></div></div>
              <div className="desk-item coffee-cup">☕️</div>
              <div className="desk-item pens">✏️ 🖋️</div>
              <div className="message-container">
                <h3>Editor PDF Siap Beraksi</h3>
                <p>Ruang kerja ini sedang menanti sentuhan kreatif Anda.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;