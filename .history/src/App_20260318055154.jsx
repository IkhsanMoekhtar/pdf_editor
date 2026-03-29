import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import './App.css';

// Setup worker standar Vite
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

  // --- STATE PDF VIEWER ---
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  
  // --- STATE UNTUK ZOOM OTOMATIS (FIT TO BOX) ---
  const pdfWrapperRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [pageDetails, setPageDetails] = useState(null);

  // Mengukur area kerja yang tersedia saat browser diubah ukurannya
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerSize({
          // Mengurangi padding agar PDF tidak terlalu mepet ke ujung layar
          width: entries[0].contentRect.width - 60, 
          height: entries[0].contentRect.height - 100 
        });
      }
    });

    if (pdfWrapperRef.current) {
      observer.observe(pdfWrapperRef.current);
    }

    return () => observer.disconnect();
  }, [pdfFile]);

  // Fungsi mengkalkulasi zoom agar pas di tengah (tidak memotong tinggi/lebar)
  const calculateScale = () => {
    if (!containerSize.width || !containerSize.height || !pageDetails) {
      return 1; // Skala default saat sedang proses memuat
    }
    
    // Bandingkan rasio ruang kosong dengan ukuran asli PDF
    const scaleX = containerSize.width / pageDetails.width;
    const scaleY = containerSize.height / pageDetails.height;
    
    // Ambil zoom yang paling kecil agar PDF tidak keluar dari layar
    return Math.min(scaleX, scaleY);
  };

  // --- FUNGSI INTERAKSI ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setPageNumber(1);
      setPageDetails(null); // Reset ukuran saat ganti dokumen baru
    } else {
      alert("Mohon unggah file dengan format PDF.");
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = (page) => {
    // Menyimpan ukuran asli PDF (portrait/landscape) ke dalam memori
    setPageDetails({ 
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

  const triggerUpload = () => fileInputRef.current.click();
  const toggleMenu = (menuName) => setExpandedMenu(expandedMenu === menuName ? null : menuName);

  return (
    <div className="app-container">
      
      {/* --- SIDEBAR --- */}
      <aside className="main-sidebar">
        <div className="brand">
          <span className="brand-icon">📄</span>
          <strong>PDF Editor</strong>
        </div>
        
        <nav className="sidebar-nav">
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
            </div>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="save-btn" onClick={() => handleToolClick('save')}>💾 Simpan File</button>
        </div>
      </aside>

      {/* --- AREA KERJA UTAMA --- */}
      <main className="workspace">
        
        {/* Kontainer yang diukur oleh ResizeObserver */}
        <div 
          className="viewer-container" 
          ref={pdfWrapperRef} 
          style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#e5e7eb' }}
        >
          
          {pdfFile ? (
            <div className="custom-pdf-viewer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: '20px' }}>
              
              {/* Toolbar Navigasi Halaman */}
              <div className="pdf-controls" style={{ flexShrink: 0, marginBottom: '15px', display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                <button onClick={() => changePage(-1)} disabled={pageNumber <= 1} style={{ padding: '8px 12px', cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}>
                  ◀ Sebelumnya
                </button>
                <span style={{ fontWeight: 'bold', color: '#374151' }}>
                  Halaman {pageNumber} dari {numPages || '--'}
                </span>
                <button onClick={() => changePage(1)} disabled={pageNumber >= numPages} style={{ padding: '8px 12px', cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}>
                  Selanjutnya ▶
                </button>
              </div>

              {/* Area Render Kertas PDF (Diberi bungkus agar posisinya stabil di tengah) */}
              <div className="pdf-paper-wrapper" style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                <div className="pdf-paper" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.15)', backgroundColor: 'white' }}>
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
                      scale={calculateScale()} 
                    />
                  </Document>
                </div>
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