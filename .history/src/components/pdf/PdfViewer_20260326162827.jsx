import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  ChevronLeft, ChevronRight, 
  ZoomIn, RotateCcw, RotateCw, 
  Type, PenTool, Undo2, Redo2, Palette
} from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function PdfViewer({ 
  file, activeTool, setActiveTool, 
  drawings, setDrawings,
  rotation, setRotation 
}) {
  
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const pdfWrapperRef = useRef(null);
  const scrollContainerRef = useRef(null); 

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [originalPageSize, setOriginalPageSize] = useState(null);
  const [userZoom, setUserZoom] = useState(1); 
  const [isZoomMode, setIsZoomMode] = useState(false);
  
  const [currentDrawing, setCurrentDrawing] = useState(null); 
  const [drawColor, setDrawColor] = useState('#ff0000'); 
  const [redoStack, setRedoStack] = useState([]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  useEffect(() => {
    setPageNumber(1); 
    setOriginalPageSize(null); 
    setUserZoom(1); 
  }, [file]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerSize({ width: entries[0].contentRect.width - 60, height: entries[0].contentRect.height - 100 });
      }
    });
    if (pdfWrapperRef.current) observer.observe(pdfWrapperRef.current);
    return () => observer.disconnect();
  }, [file]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleWheelZoom = (e) => {
      if (isZoomMode) {
        e.preventDefault();
        const zoomStep = 0.1;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const contentX = (container.scrollLeft + mouseX) / userZoom;
        const contentY = (container.scrollTop + mouseY) / userZoom;
        let nextZoom = e.deltaY < 0 ? Math.min(userZoom + zoomStep, 4) : Math.max(userZoom - zoomStep, 0.25);
        setUserZoom(nextZoom);
        container.scrollLeft = contentX * nextZoom - mouseX;
        container.scrollTop = contentY * nextZoom - mouseY;
      }
    };
    container.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelZoom);
  }, [isZoomMode, userZoom]);

  const isLandscapeRotation = rotation === 90 || rotation === 270;
  const docWidth = originalPageSize ? (isLandscapeRotation ? originalPageSize.height : originalPageSize.width) : 0;
  const docHeight = originalPageSize ? (isLandscapeRotation ? originalPageSize.width : originalPageSize.height) : 0;

  const calculateBaseScale = () => {
    if (!containerSize.width || !containerSize.height || !originalPageSize) return 0.2; 
    if (!originalPageSize.width || !originalPageSize.height) return 1;
    return Math.min(containerSize.width / docWidth, containerSize.height / docHeight) - 0.02;
  };

  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);
  const onPageLoadSuccess = (page) => setOriginalPageSize({ width: page.originalWidth, height: page.originalHeight });
  const changePage = (offset) => setPageNumber(prev => prev + offset);

  const handleMouseDown = (e) => {
    if (activeTool !== null) return; 
    setIsDragging(true); setDragStart({ x: e.pageX, y: e.pageY });
    setScrollStart({ left: scrollContainerRef.current.scrollLeft, top: scrollContainerRef.current.scrollTop });
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return; e.preventDefault(); 
    scrollContainerRef.current.scrollLeft = scrollStart.left - (e.pageX - dragStart.x);
    scrollContainerRef.current.scrollTop = scrollStart.top - (e.pageY - dragStart.y);
  };
  const handleMouseUpOrLeave = () => setIsDragging(false);
  const rotateRight = () => setRotation(prev => (prev + 90) % 360);
  const rotateLeft = () => setRotation(prev => (prev - 90 + 360) % 360);

  const getCursorStyle = () => activeTool ? 'crosshair' : isDragging ? 'grabbing' : 'grab'; 

  // --- FUNGSI BARU: MENANGKAP KOORDINAT LOGIS (UNROTATED) ---
  const getLogicalCoords = (e) => {
    if (!originalPageSize) return { x: 0, y: 0 };

    const rect = e.currentTarget.getBoundingClientRect();
    
    // Posisi mouse relatif terhadap visual PDF di layar (tergantung zoom)
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Dimensi visual PDF saat ini di layar
    const svw = rect.width;
    const svh = rect.height;

    // Dimensi PDF asli (tegak)
    const pw = originalPageSize.width;
    const ph = originalPageSize.height;

    // Normalisasi posisi klik ke rasio 0 sampai 1
    const nx = clientX / svw;
    const ny = clientY / svh;

    // Terapkan transformasi inversi berdasarkan rotasi workspace
    // Kita memetakan kembali posisi visual ke posisi kertas tegak asli
    switch (rotation) {
      case 90: // Diputar 90 derajat CW (Landscape)
        return {
          x: ny * pw,
          y: (1 - nx) * ph
        };
      case 180: // Terbalik
        return {
          x: (1 - nx) * pw,
          y: (1 - ny) * ph
        };
      case 270: // Diputar 270 derajat CW (Landscape Inverse)
        return {
          x: (1 - ny) * pw,
          y: nx * ph
        };
      case 0:
      default: // Normal
        return {
          x: nx * pw,
          y: ny * ph
        };
    }
  };

  const handleDrawStart = (e) => {
    if (activeTool !== 'draw') return; 
    e.preventDefault();
    // Gunakan fungsi transformasi baru
    const coords = getLogicalCoords(e);
    setCurrentDrawing([coords]);
  };

  const handleDrawMove = (e) => {
    if (activeTool !== 'draw' || !currentDrawing) return; 
    e.preventDefault();
    // Gunakan fungsi transformasi baru
    const coords = getLogicalCoords(e);
    setCurrentDrawing([...currentDrawing, coords]);
  };

  const handleDrawEnd = () => {
    if (currentDrawing) { setDrawings([...drawings, { page: pageNumber, path: currentDrawing, color: drawColor }]); setCurrentDrawing(null); setRedoStack([]); }
  };
  const handleUndo = () => {
    if (drawings.length === 0) return; 
    const newDrawings = [...drawings]; const lastDrawing = newDrawings.pop(); 
    setDrawings(newDrawings); setRedoStack([...redoStack, lastDrawing]); 
  };
  const handleRedo = () => {
    if (redoStack.length === 0) return; 
    const newRedoStack = [...redoStack]; const drawingToRestore = newRedoStack.pop(); 
    setRedoStack(newRedoStack); setDrawings([...drawings, drawingToRestore]); 
  };

  const makeSvgPath = (points) => (!points || points.length === 0) ? '' : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const currentWidth = (docWidth * calculateBaseScale()) * userZoom;

  return (
    <div className="viewer-container" ref={pdfWrapperRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundImage: 'linear-gradient(135deg, #fafaf9 0%, #e7e5e4 100%)' }}>
      <div className="custom-pdf-viewer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: '20px', position:'relative' }}>
        
        <div className="pdf-controls" style={{ flexShrink: 0, marginBottom: '15px', display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '10px 20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6' }}>
          <button onClick={() => changePage(-1)} disabled={pageNumber <= 1} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', color: '#4b5563', fontWeight: '500', transition: 'all 0.2s', opacity: pageNumber <= 1 ? 0.5 : 1 }}>
            <ChevronLeft size={18} /> Prev
          </button>
          <span style={{ fontWeight: '600', color: '#374151', fontSize: '14px', minWidth: '130px', textAlign: 'center' }}>
            Halaman {pageNumber} / {numPages || '--'}
          </span>
          <button onClick={() => changePage(1)} disabled={pageNumber >= numPages} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', color: '#4b5563', fontWeight: '500', transition: 'all 0.2s', opacity: pageNumber >= numPages ? 0.5 : 1 }}>
            Next <ChevronRight size={18} />
          </button>
        </div>

        <div className="pdf-paper-wrapper" ref={scrollContainerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUpOrLeave} onMouseLeave={handleMouseUpOrLeave} style={{ flex: 1, overflow: 'auto', justifyContent: 'center', alignItems: 'flex-start', width: '100%', paddingTop: '10px', paddingBottom: '20px', cursor: getCursorStyle(), userSelect: isDragging ? 'none' : 'auto' }}>
          <div className="pdf-paper" style={{ position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', backgroundColor: 'white', display: 'block', margin: currentWidth > containerSize.width ? '0' : '0 auto', width: currentWidth ? `${currentWidth}px` : 'auto' }}>
            
            <Document file={file} onLoadSuccess={onDocumentLoadSuccess} loading={<div style={{ padding: '50px', color: '#6b7280' }}>Memuat dokumen...</div>}>
              <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} onLoadSuccess={onPageLoadSuccess} scale={calculateBaseScale() * 4} rotate={rotation} />
            </Document>

            {originalPageSize && (
              <svg 
                style={{ 
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                    pointerEvents: activeTool === 'draw' ? 'auto' : 'none', 
                    cursor: activeTool === 'draw' ? 'crosshair' : 'default', zIndex: 10,
                    // --- PERUBAHAN PENTING UNTUK TAMPILAN ---
                    // Putar SVG overlay agar searah dengan putaran PDF di bawahnya
                    transform: `rotate(${rotation}deg)`,
                    // Karena absolut top 0, flexbox centering di 'pdf-paper' bingung 
                    // saat 90/270, kita paksa aspectRatio agar SVG pas dengan canvas
                    aspectRatio: isLandscapeRotation ? `${ph}/${pw}` : 'auto'
                }} 
                // viewBox tetap tegak lurus (unrotated)
                viewBox={`0 0 ${originalPageSize.width} ${originalPageSize.height}`} 
                onPointerDown={handleDrawStart} onPointerMove={handleDrawMove} 
                onPointerUp={handleDrawEnd} onPointerLeave={handleDrawEnd}
              >
                {drawings.filter(d => d.page === pageNumber).map((d, idx) => (
                  <path key={idx} d={makeSvgPath(d.path)} fill="none" stroke={d.color || 'red'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {currentDrawing && (
                  <path d={makeSvgPath(currentDrawing)} fill="none" stroke={drawColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            )}
          </div>
        </div>

        <div className="floating-action-bar" style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', padding: '12px 24px', borderRadius: '100px', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', display: 'flex', gap: '12px', alignItems: 'center', zIndex: 1000, border: '1px solid rgba(229, 231, 235, 0.8)' }}>
          
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', margin: '0 10px 0 0' }}>
            {(calculateBaseScale() * userZoom * 100).toFixed(0)}%
          </p>
          
          <button className={`action-btn ${isZoomMode ? 'active' : ''}`} onClick={() => setIsZoomMode(!isZoomMode)} title="Gunakan Scroll Mouse untuk Zoom" style={{ gap: '6px' }}>
            <ZoomIn size={16} /> <span style={{display: 'none'}}></span>
          </button>
          
          <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }}></div>
          
          <button className="action-btn" onClick={rotateLeft} title="Putar Kiri">
            <RotateCcw size={16} />
          </button>
          <button className="action-btn" onClick={rotateRight} title="Putar Kanan">
            <RotateCw size={16} />
          </button>
          
          <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }}></div>
          
          <button className={`action-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'text' ? null : 'text')} style={{ gap: '6px' }}>
            <Type size={16} /> Teks
          </button>
          <button className={`action-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'draw' ? null : 'draw')} style={{ gap: '6px' }}>
            <PenTool size={16} /> Coret
          </button>
          
          {activeTool === 'draw' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px', paddingLeft: '16px', borderLeft: '1px solid #e5e7eb' }}>
              <Palette size={16} color="#6b7280" />
              <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} style={{ width: '28px', height: '28px', padding: '0', border: 'none', borderRadius: '50%', cursor: 'pointer', overflow: 'hidden' }} title="Pilih Warna" />
              
              <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }}></div>
              
              <button className="action-btn" onClick={handleUndo} disabled={drawings.length === 0} style={{ opacity: drawings.length === 0 ? 0.4 : 1, cursor: drawings.length === 0 ? 'not-allowed' : 'pointer' }} title="Undo (Batal)">
                <Undo2 size={16} />
              </button>
              <button className="action-btn" onClick={handleRedo} disabled={redoStack.length === 0} style={{ opacity: redoStack.length === 0 ? 0.4 : 1, cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer' }} title="Redo (Ulangi)">
                <Redo2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}