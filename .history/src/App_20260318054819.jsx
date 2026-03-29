import React, { useState, useRef, useEffect} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import './App.css';

// Memuat worker secara lokal langsung dari node_modules (Sangat stabil untuk Vite)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const fileInputRef = useRef(null);
  
  // State baru untuk mengatur menu dropdown di sidebar
  const [expandedMenu, setExpandedMenu] = useState(null);

  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  // --- STATE BARU UNTUK UKURAN DINAMIS ---
  // Ref ini akan kita tempelkan ke bungkus PDF untuk diukur
  const pdfWrapperRef = useRef(null); 
  // State ini menyimpan angka lebar layar saat ini
  const [pdfWidth, setPdfWidth] = useState(null);
  // 1. STATE BARU: Merekam Lebar & Tinggi layar yang tersedia
  const [containerSize, setContainerSize] = useState({ width: null, height: null });
  // 2. STATE BARU: Merekam Lebar & Tinggi asli dari file PDF
  const [pageDetails, setPageDetails] = useState(null);

  // Efek ini akan berjalan setiap kali ukuran layar/browser berubah
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        // Merekam dimensi ruang kosong di layar Anda
        setContainerSize({
          width: entries[0].contentRect.width - 40, // Kurangi 40px untuk margin kiri-kanan
          height: entries[0].contentRect.height - 100 // Kurangi 100px untuk ruang tombol atas
        });
      }
    });

    if (pdfWrapperRef.current) observer.observe(pdfWrapperRef.current);
    return () => observer.disconnect();
  }, [pdfFile]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file); 
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
            <div 
              className="custom-pdf-viewer" 
              ref={pdfWrapperRef} /* Pasang Sensor Disini! */
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '900px', margin: '0 auto' }}
            >
              
              <div className="pdf-controls" style={{ marginBottom: '15px', display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                {/* ... (Tombol Sebelumnya / Selanjutnya tetap sama) ... */}
                <button onClick={() => changePage(-1)} disabled={pageNumber <= 1} style={{ padding: '8px 12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}>
                  ◀ Sebelumnya
                </button>
                <span style={{ fontWeight: 'bold' }}>
                  Halaman {pageNumber} dari {numPages || '--'}
                </span>
                <button onClick={() => changePage(1)} disabled={pageNumber >= numPages} style={{ padding: '8px 12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}>
                  Selanjutnya ▶
                </button>
              </div>

              <div className="pdf-paper" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.15)', backgroundColor: 'white' }}>
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<div style={{ padding: '50px' }}>Memuat mesin dan dokumen...</div>}
                >
                  {/* Gunakan variabel lebar dinamis (pdfWidth) sebagai pengganti scale statis */}
                  <Page 
                    pageNumber={pageNumber} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false} 
                    width={pdfWidth} // Kunci Dinamisnya Ada di Sini!
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