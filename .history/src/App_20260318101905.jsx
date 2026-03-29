import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import './App.css';

// Setup worker standar Vite (Wajib)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function App() {
  // --- STATE DASAR ---
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [expandedMenu, setExpandedMenu] = useState(null); 
  const fileInputRef = useRef(null);

  // --- STATE PDF VIEWER (Auto-Zoom & Navigasi) ---
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const pdfWrapperRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [originalPageSize, setOriginalPageSize] = useState(null);
  const [userZoom, setUserZoom] = useState(1); // Zoom manual tambahan (default 100%)

  // --- STATE UNTUK ACTION BAR BARU ---
  const [rotation, setRotation] = useState(0); // Rotasi kertas (0, 90, 180, 270)
  const [flipX, setFlipX] = useState(false); // Flip Horizontal
  const [flipY, setFlipY] = useState(false); // Flip Vertical

  // Mengukur area kerja yang tersedia (Fungsi 'observer' cerdas)
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerSize({
          // Mengurangi margin agar PDF tidak terlalu mepet ke ujung layar
          width: entries[0].contentRect.width - 60, 
          height: entries[0].contentRect.height - 130 // Ruang untuk tombol halaman
        });
      }
    });

    if (pdfWrapperRef.current) observer.observe(pdfWrapperRef.current);
    return () => observer.disconnect();
  }, [pdfFile]);

  // Fungsi mengkalkulasi zoom agar pas di tengah (Fit-to-Box)
  const calculateBaseScale = () => {
    if (!containerSize.width || !containerSize.height || !originalPageSize) return 1;
    const scaleX = containerSize.width / originalPageSize.width;
    const scaleY = containerSize.height / originalPageSize.height;
    return Math.min(scaleX, scaleY);
  };

  // --- FUNGSI INTERAKSI ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setPageNumber(1);
      setOriginalPageSize(null); 
      // Reset semua kontrol saat ganti dokumen baru
      setUserZoom(1); 
      setRotation(0);
      setFlipX(false);
      setFlipY(false);
    } else {
      alert("Mohon unggah file dengan format PDF.");
    }
  };

  // Fungsi saat dokumen PDF berhasil dibaca oleh mesin (onDocumentLoadSuccess)
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  // Fungsi saat halaman PDF berhasil dirender (onPageLoadSuccess)
  const onPageLoadSuccess = (page) => {
    // Menyimpan ukuran asli PDF (portrait/landscape) ke dalam memori
    setOriginalPageSize({ 
      width: page.originalWidth, 
      height: page.originalHeight 
    });
  };

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  };

  const handleToolClick = (toolName) => {
    setActiveTool(toolName);
    if (toolName === 'save') alert("Mempersiapkan data!");
  };

  // --- FUNGSI UNTUK ACTION BAR BARU ---
  const zoomIn = () => setUserZoom(prev => Math.min(prev + 0.25, 4)); // Max 400%
  const zoomOut = () => setUserZoom(prev => Math.max(prev - 0.25, 0.25)); // Min 25%
  const rotatePage = () => setRotation(prev => (prev + 90) % 360);
  const toggleFlipX = () => setFlipX(prev => !prev);
  const toggleFlipY = () => setFlipY(prev => !prev);

  const triggerUpload = () => fileInputRef.current.click();
  const toggleMenu = (menuName) => setExpandedMenu(expandedMenu === menuName ? null : menuName);

  return (
    <div className="app-container">
      
      {/* --- SIDEBAR UTAMA (DIKEMBALIKAN LENGKAP) --- */}
      <aside className="main-sidebar">
        <div className="brand">
          <span className="brand-icon">📄</span>
          <strong>PDF Editor</strong>
        </div>
        
        <nav className="sidebar-nav">
          <button className="nav-item">GABUNG PDF</button>
          <button className="nav-item">PISAH PDF</button>
          <button className="nav-item">KOMPRES PDF</button>

          {/* Grup Menu: KONVERSI PDF */}
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

          {/* Grup Menu: ALAT EDIT */}
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

        {/* Tombol Simpan selalu berada di bawah */}
        <div className="sidebar-footer">
          <button className="save-btn" onClick={() => handleToolClick('save')}>
            💾 Simpan File
          </button>
        </div>
      </aside>

      {/* --- AREA KERJA UTAMA --- */}
      <main className="workspace">
        <div 
          className="viewer-container" 
          ref={pdfWrapperRef} 
          style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#e5e7eb' }}
        >
          {pdfFile ? (
            <div className="custom-pdf-viewer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: '20px' }}>
              
              {/* Toolbar Navigasi Halaman (Dipindah ke atas agar tidak menutupi PDF) */}
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

              {/* Area Render Kertas PDF (Diberi bungkus agar posisinya stabil di tengah) */}
              <div className="pdf-paper-wrapper" style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', paddingTop: '10px', paddingBottom: '20px' }}>
                <div className="pdf-paper" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.15)', backgroundColor: 'white' }}>
                  <Document
                    file={pdfFile}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div style={{ padding: '50px' }}>Memuat mesin dan dokumen...</div>}
                  >
                    {/* Menggabungkan Base Scale (Auto-Zoom) + User Zoom + Rotasi + Flip */}
                    <Page 
                      pageNumber={pageNumber} 
                      renderTextLayer={false} 
                      renderAnnotationLayer={false} 
                      onLoadSuccess={onPageLoadSuccess}
                      scale={calculateBaseScale() * userZoom} 
                      rotate={rotation}
                      style={{
                        transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
                        transition: 'transform 0.3s ease'
                      }}
                    />
                  </Document>
                </div>
              </div>

              {/* --- 🛡️ FLOATING ACTION BAR (MENINGKATKAN FITUR EDIT) 🛡️ --- */}
              <div className="floating-action-bar" style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(5px)', padding: '10px 20px', borderRadius: '99px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', gap: '10px', alignItems: 'center', zIndex: 1000, border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '11px', color: '#6b7280', marginRight: '5px' }}>Zoom: {(calculateBaseScale() * userZoom * 100).toFixed(0)}%</p>
                <button className="action-btn" onClick={zoomIn} title="Zoom In">🔍 +</button>
                <button className="action-btn" onClick={zoomOut} title="Zoom Out">🔍 -</button>
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
            // --- AREA EMPTY STATE (Upload Baru) ---
            <div className="empty-state desktop-scene" onClick={triggerUpload} style={{ margin: '20px' }}>
              <input type="file" accept="application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
              <div className="clipboard">
                <div className="clipboard-paper">
                  <div className="clipboard-header">Kanvas Anda</div>
                  <div className="clipboard-content">
                    <div className="empty-line large"></div>
                    <div className="empty-line"></div>
                    <div className="empty-line medium"></div>
                    <div className="empty-line large"></div>
                  </div>
                </div>
              </div>
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