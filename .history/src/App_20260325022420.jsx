import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb } from 'pdf-lib';
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
  const [isZoomMode, setIsZoomMode] = useState(false);
  // --- STATE BARU UNTUK FITUR CORET (DRAWING) ---
  const [drawings, setDrawings] = useState([]); // Menyimpan semua garis { page, path: [{x, y}] }
  const [currentDrawing, setCurrentDrawing] = useState(null); // Garis yang sedang ditarik

  // --- STATE BARU UNTUK WARNA CORETAN ---
  const [drawColor, setDrawColor] = useState('#ff0000'); // Default merah
  const [redoStack, setRedoStack] = useState([]);

  // Fungsi mengubah warna HEX HTML ke RGB untuk pdf-lib
  const hexToPdfRgb = (hex) => {
    // Hilangkan '#' jika ada
    const cleanHex = hex.replace('#', '');
    // Pecah menjadi R, G, B
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return { r, g, b };
  };
  
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
      if (isZoomMode) {
        e.preventDefault();
        const zoomStep = 0.1;
        
        // 1. Ambil posisi mouse relatif terhadap container (viewport)
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 2. Hitung posisi konten saat ini (sebelum zoom baru diterapkan)
        // Rumus: (Scroll Saat Ini + Posisi Mouse) / Zoom Saat Ini
        const contentX = (container.scrollLeft + mouseX) / userZoom;
        const contentY = (container.scrollTop + mouseY) / userZoom;

        // 3. Tentukan nilai zoom baru
        let nextZoom;
        if (e.deltaY < 0) {
          nextZoom = Math.min(userZoom + zoomStep, 4);
        } else {
          nextZoom = Math.max(userZoom - zoomStep, 0.25);
        }

        // 4. Update state zoom
        setUserZoom(nextZoom);

        // 5. KRITIKAL: Hitung dan terapkan scroll baru secara INSTAN
        // Kita hitung di mana koordinat konten tadi harus berada pada skala yang baru
        container.scrollLeft = contentX * nextZoom - mouseX;
        container.scrollTop = contentY * nextZoom - mouseY;
      }
    };

    // Gunakan { passive: false } agar e.preventDefault() bekerja
    container.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelZoom);
  }, [isZoomMode, userZoom]); // userZoom HARUS ada di sini agar perhitungan posisi akurat

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

  const rotateRight = () => setRotation(prev => (prev + 90) % 360);
  const rotateLeft = () => setRotation(prev => (prev - 90 + 360) % 360);
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

  // --- FUNGSI MENGGAMBAR (DRAWING) ---
  const handleDrawStart = (e) => {
    if (activeTool !== 'draw') return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    // Normalisasi koordinat agar akurat walau di-zoom
    const x = ((e.clientX - rect.left) / rect.width) * originalPageSize.width;
    const y = ((e.clientY - rect.top) / rect.height) * originalPageSize.height;
    setCurrentDrawing([{ x, y }]);
  };

  const handleDrawMove = (e) => {
    if (activeTool !== 'draw' || !currentDrawing) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * originalPageSize.width;
    const y = ((e.clientY - rect.top) / rect.height) * originalPageSize.height;
    setCurrentDrawing([...currentDrawing, { x, y }]);
  };

  const handleDrawEnd = () => {
    if (currentDrawing) {
      setDrawings([...drawings, { page: pageNumber, path: currentDrawing, color: drawColor }]);
      setCurrentDrawing(null);
      setRedoStack([]);
    }
  };

  // --- FUNGSI UNDO & REDO ---
  const handleUndo = () => {
    if (drawings.length === 0) return; // Tidak ada yang bisa di-undo
    const newDrawings = [...drawings];
    const lastDrawing = newDrawings.pop(); // Ambil dan hapus coretan terakhir
    
    setDrawings(newDrawings); // Update layar (coretan hilang)
    setRedoStack([...redoStack, lastDrawing]); // Simpan ke "jejak masa depan"
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return; // Tidak ada yang bisa di-redo
    const newRedoStack = [...redoStack];
    const drawingToRestore = newRedoStack.pop(); // Ambil dari "jejak masa depan"
    
    setRedoStack(newRedoStack);
    setDrawings([...drawings, drawingToRestore]); // Tampilkan kembali di layar
  };

  // Mengubah array koordinat menjadi format path SVG
  const makeSvgPath = (points) => {
    if (!points || points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  // --- FUNGSI UNTUK MENYIMPAN HASIL CORETAN KE PDF ---
  const savePdfWithDrawings = async () => {
    
    try {
      // 1. Baca PDF yang diupload
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      // 2. Terapkan coretan ke halaman yang sesuai
      drawings.forEach((drawing) => {
        const pageIndex = drawing.page - 1; // Index array mulai dari 0
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const { height } = page.getSize();
          const points = drawing.path;

          // pdf-lib menggunakan sistem koordinat Y dari bawah ke atas, 
          // jadi kita harus membalik nilai Y (height - y)
          for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            
            // Konversi warna HEX ke format pdf-lib
            const pdfColor = hexToPdfRgb(drawing.color || '#ff0000'); 

            page.drawLine({
              start: { x: p1.x, y: height - p1.y }, 
              end: { x: p2.x, y: height - p2.y },
              thickness: 3,
              color: rgb(pdfColor.r, pdfColor.g, pdfColor.b), // <--- GUNAKAN WARNA DINAMIS
            });
          }
        }
      });

      // 3. Simpan dan picu download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const originalName = pdfFile.name;
      const newFileName = originalName.replace(/\.[^/.]+$/, "") + "_edited.pdf";
      link.download = newFileName;
      link.click();

    } catch (error) {
      console.error("Gagal menyimpan PDF:", error);
      alert("Terjadi kesalahan saat menyimpan PDF.");
    }
  };

  return (
    <div className="app-container">
      
      <aside className="main-sidebar">
        {/* ... (KODE SIDEBAR TETAP SAMA SEPERTI SEBELUMNYA) ... */}
        <div className="brand">
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
          <button className="save-btn" onClick={savePdfWithDrawings}>
            💾 Simpan File
          </button>
        </div>
      </aside>

      <main className="workspace">
        <div 
          className="viewer-container" 
          ref={pdfWrapperRef} 
          style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            overflow: 'hidden', 
            // Hapus backgroundColor, ganti dengan backgroundImage
            backgroundImage: 'linear-gradient(135deg, #fafaf9 0%, #e7e5e4 100%)' 
          }}
        >
          {pdfFile ? (
            <div className="custom-pdf-viewer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: '20px' ,position:'relative'}}>
              
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
                    position: 'relative', // <--- SANGAT PENTING
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

                  {/* --- SVG OVERLAY UNTUK CORETAN --- */}
                  {originalPageSize && (
                    <svg
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        // Hanya aktifkan event sentuhan jika tool 'draw' aktif
                        pointerEvents: activeTool === 'draw' ? 'auto' : 'none', 
                        cursor: activeTool === 'draw' ? 'crosshair' : 'default',
                        zIndex: 10
                      }}
                      viewBox={`0 0 ${originalPageSize.width} ${originalPageSize.height}`}
                      onPointerDown={handleDrawStart}
                      onPointerMove={handleDrawMove}
                      onPointerUp={handleDrawEnd}
                      onPointerLeave={handleDrawEnd} // Berhenti nggambar jika kursor keluar PDF
                    >
                      {/* Render coretan yang sudah selesai */}
                      {drawings.filter(d => d.page === pageNumber).map((d, idx) => (
                        <path
                          key={idx}
                          d={makeSvgPath(d.path)}
                          fill="none"
                          stroke={d.color || 'red'} // <--- Panggil warna yang tersimpan
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                      {/* Render coretan yang sedang ditarik */}
                      {currentDrawing && (
                        <path
                          d={makeSvgPath(currentDrawing)}
                          fill="none"
                          stroke={drawColor} // <--- Panggil warna state saat ini
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>
                  )}
                </div>
              </div>

              <div className="floating-action-bar" style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(5px)', padding: '10px 20px', borderRadius: '99px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', gap: '10px', alignItems: 'center', zIndex: 1000, border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '11px', color: '#6b7280', marginRight: '5px' }}>Zoom: {(calculateBaseScale() * userZoom* 100).toFixed(0)}%</p>
                <button 
                  className={`action-btn ${isZoomMode ? 'active' : ''}`} 
                  onClick={() => setIsZoomMode(!isZoomMode)} 
                  title="Gunakan Scroll Mouse untuk Zoom"
                >
                  🔍 {isZoomMode ? 'Scroll Zoom: ON' : 'Scroll Zoom: OFF'}
                </button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb' }}></div>
                <button className={`action-btn ${rotation !== 0 ? 'active' : ''}`} onClick={rotateLeft} title="Putar kanan">🔄 R</button>
                <button className={`action-btn ${rotation !== 0 ? 'active' : ''}`} onClick={rotateRight} title="Putar Kiri">🔄 L</button>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb' }}></div>
                
                {/* Tombol Alat Edit (Bisa di-toggle on/off) */}
                <button className={`action-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => handleToolClick('text')}>✍️ Teks</button>
                <button className={`action-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => handleToolClick('draw')}>🖌️ Coret</button>
                {/* --- MUNCULKAN PEMILIH WARNA JIKA DRAW AKTIF --- */}
                {activeTool === 'draw' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '5px', paddingLeft: '10px', borderLeft: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>Warna:</span>
                    <input 
                      type="color" 
                      value={drawColor} 
                      onChange={(e) => setDrawColor(e.target.value)}
                      style={{ 
                        width: '24px', 
                        height: '24px', 
                        padding: '0', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer' 
                      }} 
                    />
                    
                    {/* Pembatas kecil */}
                    <div style={{ width: '1px', height: '15px', backgroundColor: '#e5e7eb', margin: '0 5px' }}></div>
                    
                    {/* Tombol Undo & Redo */}
                    <button 
                      className="action-btn" 
                      onClick={handleUndo} 
                      disabled={drawings.length === 0}
                      style={{ 
                        opacity: drawings.length === 0 ? 0.4 : 1, 
                        cursor: drawings.length === 0 ? 'not-allowed' : 'pointer' 
                      }}
                      title="Undo (Batal)"
                    >
                      ↩️
                    </button>
                    <button 
                      className="action-btn" 
                      onClick={handleRedo} 
                      disabled={redoStack.length === 0}
                      style={{ 
                        opacity: redoStack.length === 0 ? 0.4 : 1, 
                        cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer' 
                      }}
                      title="Redo (Ulangi)"
                    >
                      ↪️
                    </button>
                  </div>
                )}
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