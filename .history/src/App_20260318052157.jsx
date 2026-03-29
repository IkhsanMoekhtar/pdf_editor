import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const fileInputRef = useRef(null);
  
  // State baru untuk mengatur menu dropdown di sidebar
  const [expandedMenu, setExpandedMenu] = useState(null);

  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(URL.createObjectURL(file));
      setPageNumber(1);
    } else {
      alert("Mohon unggah file dengan format PDF.");
    }
  };

  // Fungsi saat dokumen PDF berhasil dibaca oleh mesin
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  // Fungsi ganti halaman
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
      
      {/* --- SIDEBAR UTAMA --- */}
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
        <div className="viewer-container" style={{ flexDirection: 'column', overflowY: 'auto', padding: '20px' }}>
          
          {pdfFile ? (
            // --- CUSTOM PDF VIEWER KITA ---
            <div className="custom-pdf-viewer">
              
              {/* Kontrol Halaman Kustom */}
              <div className="pdf-controls" style={{ marginBottom: '15px', display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                <button 
                  onClick={() => changePage(-1)} 
                  disabled={pageNumber <= 1}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                >
                  ◀ Sebelumnya
                </button>
                <span style={{ fontWeight: 'bold' }}>
                  Halaman {pageNumber} dari {numPages || '--'}
                </span>
                <button 
                  onClick={() => changePage(1)} 
                  disabled={pageNumber >= numPages}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                >
                  Selanjutnya ▶
                </button>
              </div>

              {/* Area Render Kertas PDF (Menjadi Canvas) */}
              <div className="pdf-paper" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<div style={{ padding: '50px' }}>Memuat dokumen...</div>}
                >
                  {/* renderTextLayer={false} dan renderAnnotationLayer={false} mematikan seleksi teks bawaan agar lebih bersih untuk diedit */}
                  <Page 
                    pageNumber={pageNumber} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false} 
                    scale={1.2} // Mengatur ukuran zoom kertas
                  />
                </Document>
              </div>

            </div>
          ) : (
            // --- AREA KOSONG (KLIK UNTUK UPLOAD) ---
            <div className="empty-state desktop-scene" onClick={triggerUpload} style={{ width: '100%', height: '100%' }}>
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