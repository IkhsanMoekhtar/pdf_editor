import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  
  // Secara default, activeTool adalah null (Mode Kursor/Pan)
  const [activeTool, setActiveTool] = useState(null); 
  const [expandedMenu, setExpandedMenu] = useState(null); 
  const fileInputRef = useRef(null);

  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const pdfWrapperRef = useRef(null);
  
  // --- REF BARU UNTUK WADAH SCROLL ---
  const scrollContainerRef = useRef(null); 

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [originalPageSize, setOriginalPageSize] = useState(null);
  const [userZoom, setUserZoom] = useState(1); 
  const [rotation, setRotation] = useState(0); 
  const [visualZoom, setVisualZoom] = useState(1); // Zoom instan untuk efek visual CSS
  const [isZooming, setIsZooming] = useState(false); // Penanda apakah animasi zoom sedang aktif
  const zoomTimeoutRef = useRef(null);
  const [isZoomMode, setIsZoomMode] = useState(false);
  const [flipX, setFlipX] = useState(false); 
  const [flipY, setFlipY] = useState(false); 

  // --- STATE BARU UNTUK LOGIKA DRAG / PANNING ---
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerSize({
          width: entries[0].contentRect.width - 60,
          height: entries[0].contentRect.height - 100
        });
      }
    });

    if (pdfWrapperRef.current) observer.observe(pdfWrapperRef.current);
    return () => observer.disconnect();
  }, [pdfFile]);


  // --- EFEK SCROLL ZOOM (SUPER RESPONSIVE) ---
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheelZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const container = scrollContainerRef.current;
        if (!container) return;

        // 1. Dapatkan posisi kursor relatif terhadap viewport container
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 2. Simpan posisi kursor relatif terhadap isi PDF (termasuk scroll) sebelum zoom
        const scrollLeftBefore = container.scrollLeft;
        const scrollTopBefore = container.scrollTop;
        
        // Titik konten yang sedang ditunjuk kursor
        const pointInContentX = scrollLeftBefore + mouseX;
        const pointInContentY = scrollTopBefore + mouseY;

        // 3. Tentukan zoom baru
        const zoomStep = 0.2;
        let newZoom;
        if (e.deltaY < 0) {
          newZoom = Math.min(userZoom + zoomStep, 20); // Batas 20x zoom
        } else {
          newZoom = Math.max(userZoom - zoomStep, 0.25); // Batas 0.25x zoom
        }

        if (newZoom !== userZoom) {
          // 4. Hitung rasio perubahan
          const ratio = newZoom / userZoom;

          // 5. Update state zoom
          setUserZoom(newZoom);

          // 6. Sesuaikan posisi scroll agar titik konten tadi tetap di bawah kursor
          // Kita gunakan requestAnimationFrame agar scroll terjadi tepat setelah render
          requestAnimationFrame(() => {
            container.scrollLeft = pointInContentX * ratio - mouseX;
            container.scrollTop = pointInContentY * ratio - mouseY;
          });
        }
      }
    };

    container.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelZoom);
  }, [isZoomMode]);

  const calculateOptimalScale = () => {
    if (!containerSize.width || !containerSize.height || !originalPageSize) return 1;

    // Menghitung berapa persen zoom yang dibutuhkan untuk lebar dan tinggi
    const scaleX = containerSize.width / originalPageSize.width;
    const scaleY = containerSize.height / originalPageSize.height;

    // MAGIC: Ambil nilai zoom terkecil agar tidak ada bagian yang terpotong/ke-zoom!
    return Math.min(scaleX, scaleY);
  };

  const calculateBaseScale = () => {
    // Jika data belum lengkap, gunakan skala sangat kecil (0.1) 
    // agar PDF raksasa tidak langsung "meledak" dan merusak layout
    if (!containerSize.width || !containerSize.height || !originalPageSize) return 0.2; 
    
    // Pastikan nilai width/height tidak undefined untuk mencegah error NaN (Not a Number)
    if (!originalPageSize.width || !originalPageSize.height) return 1;

    const scaleX = containerSize.width / originalPageSize.width;
    const scaleY = containerSize.height / originalPageSize.height;
    
    // Kurangi 0.02 (2%) sebagai margin ekstra agar tepian PDF tidak terlalu mepet
    return Math.min(scaleX, scaleY) - 0.02;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setPageNumber(1);
      setOriginalPageSize(null); 
      setUserZoom(1); 
      setRotation(0);
      setFlipX(false);
      setFlipY(false);
      setActiveTool(null); // Reset tool ke mode pan saat file baru masuk
    } else {
      alert("Mohon unggah file dengan format PDF.");
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);
  const onPageLoadSuccess = (page) => {
    setOriginalPageSize({ 
      width: page.originalWidth, 
      height: page.originalHeight 
    });
  };
  const changePage = (offset) => setPageNumber(prev => prev + offset);

  // --- FUNGSI MOUSE UNTUK DRAG & PANNING ---
  const handleMouseDown = (e) => {
    // Hanya bisa di-drag jika TIDAK ADA tool edit yang aktif (Mode Kursor)
    if (activeTool !== null) return; 

    setIsDragging(true);
    // Catat posisi awal mouse
    setDragStart({ x: e.pageX, y: e.pageY });
    // Catat posisi awal scrollbar
    setScrollStart({
      left: scrollContainerRef.current.scrollLeft,
      top: scrollContainerRef.current.scrollTop
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault(); // Mencegah browser nge-blok (highlight teks biru) saat ditarik
    
    // Hitung jarak geser mouse
    const dx = e.pageX - dragStart.x;
    const dy = e.pageY - dragStart.y;
    
    // Terapkan jarak tersebut untuk menggeser scrollbar
    scrollContainerRef.current.scrollLeft = scrollStart.left - dx;
    scrollContainerRef.current.scrollTop = scrollStart.top - dy;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // --- FUNGSI ACTION BAR ---
  const handleToolClick = (toolName) => {
    // Jika klik tool yang sama, matikan toolnya (kembali ke mode pan/kursor)
    setActiveTool(prev => prev === toolName ? null : toolName);
  };

  const zoomIn = () => setUserZoom(prev => Math.min(prev + 0.25, 4)); 
  const zoomOut = () => setUserZoom(prev => Math.max(prev - 0.25, 0.25)); 
  const rotatePage = () => setRotation(prev => (prev + 90) % 360);
  const toggleFlipX = () => setFlipX(prev => !prev);
  const toggleFlipY = () => setFlipY(prev => !prev);
  const triggerUpload = () => fileInputRef.current.click();
  const toggleMenu = (menuName) => setExpandedMenu(prev => prev === menuName ? null : menuName);

  // --- MENENTUKAN BENTUK KURSOR ---
  const getCursorStyle = () => {
    if (activeTool) return 'crosshair'; // Bentuk "+" untuk menggambar/teks
    if (isDragging) return 'grabbing'; // Bentuk "tangan mengepal" saat ditarik
    return 'grab'; // Bentuk "tangan terbuka" saat mode pan
  };

  const baseWidth = originalPageSize ? (originalPageSize.width * calculateBaseScale()) : 0;
  const currentWidth = baseWidth * userZoom;

  return (
    <div className="app-container">
      
      <aside className="main-sidebar">
        {/* ... (KODE SIDEBAR TETAP SAMA SEPERTI SEBELUMNYA) ... */}
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

              {/* --- WADAH SCROLL DENGAN MOUSE EVENT --- */}
              <div 
                className="pdf-paper-wrapper" 
                ref={scrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave} // Berhenti drag jika mouse keluar area
                style={{ 
                  flex: 1, 
                  overflow: 'auto', 
                  justifyContent: 'center', 
                  alignItems: 'flex-start', 
                  width: '100%', 
                  paddingTop: '10px', 
                  paddingBottom: '20px',
                  cursor: getCursorStyle(), // Kursor berubah secara dinamis
                  userSelect: isDragging ? 'none' : 'auto' // Mencegah teks ke-blok saat ditarik
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
                <p style={{ fontSize: '11px', color: '#6b7280', marginRight: '5px' }}>Zoom: {(calculateBaseScale() * userZoom* 100).toFixed(0)}%</p>
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
                
                {/* Tombol Alat Edit (Bisa di-toggle on/off) */}
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