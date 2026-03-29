import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  ChevronLeft, ChevronRight, 
  ZoomIn, RotateCcw, RotateCw, 
  Type, PenTool, Undo2, Redo2, Palette
} from 'lucide-react';
import TextOverlay from './TextOverlay'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function PdfViewer({ 
  file, activeTool, setActiveTool, 
  drawings, setDrawings,
  rotation, setRotation, 
  texts, setTexts 
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
  const [drawThickness, setDrawThickness] = useState(3);
  const [redoStack, setRedoStack] = useState([]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  const [textColor, setTextColor] = useState('#000000');
  const [textSize, setTextSize] = useState(16);

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

  const getLogicalCoords = (e) => {
    if (!originalPageSize) return { x: 0, y: 0 };

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const svw = rect.width;
    const svh = rect.height;

    const pw = originalPageSize.width;
    const ph = originalPageSize.height;

    const nx = clientX / svw;
    const ny = clientY / svh;

    switch (rotation) {
      case 90: 
        return { x: ny * pw, y: (1 - nx) * ph };
      case 180: 
        return { x: (1 - nx) * pw, y: (1 - ny) * ph };
      case 270: 
        return { x: (1 - ny) * pw, y: nx * ph };
      case 0:
      default: 
        return { x: nx * pw, y: ny * ph };
    }
  };

  const handleDrawStart = (e) => {
    if (activeTool !== 'draw') return; 
    e.preventDefault();
    const coords = getLogicalCoords(e);
    setCurrentDrawing([coords]);
  };

  const handleDrawMove = (e) => {
    if (activeTool !== 'draw' || !currentDrawing) return; 
    e.preventDefault();
    const coords = getLogicalCoords(e);
    setCurrentDrawing([...currentDrawing, coords]);
  };

  const handleDrawEnd = () => {
    if (currentDrawing) { 
      setDrawings([
        ...drawings, 
        { page: pageNumber, path: currentDrawing, color: drawColor, thickness: drawThickness } // TAMBAH THICKNESS DI SINI
      ]); 
      setCurrentDrawing(null); 
      setRedoStack([]); 
    }
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

  const makeSvgPath = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
    
    // Menggunakan Quadratic Bezier Curves untuk efek pulpen yang lebih mulus
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      path += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
    }
    path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    return path;
  };

  const handleTextContainerClick = (e) => {
    if (activeTool !== 'text') return;
    
    // Pastikan user mengklik kanvas kosong, bukan mengklik teks yang sudah ada
    if (e.target !== e.currentTarget) return;

    const coords = getLogicalCoords(e);
    const newText = {
      id: Date.now().toString(), // ID Unik
      page: pageNumber,
      x: coords.x,
      y: coords.y,
      text: '',
      color: textColor,
      size: textSize,
      isEditing: true // Langsung masuk mode ketik
    };
    setTexts([...texts, newText]);
  };

  const handleSvgPointerDown = (e) => {
    if (activeTool === 'draw') {
      handleDrawStart(e);
    } else if (activeTool === 'text') {
      // Cegah buat teks baru jika user mengklik teks yang sudah ada
      if (e.target.tagName.toLowerCase() === 'text' || e.target.tagName.toLowerCase() === 'input') return;

      e.preventDefault();
      const coords = getLogicalCoords(e);
      const newText = {
        id: Date.now().toString(),
        page: pageNumber,
        x: coords.x,
        y: coords.y,
        text: '',
        color: textColor, // pastikan state textColor & textSize sudah ada di komponen
        size: textSize,
        isEditing: true
      };
      setTexts([...texts, newText]);
    }
  };

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

            {/* ERROR FIX: Menggunakan originalPageSize.height dan originalPageSize.width */}
            {originalPageSize && (
              <svg 
                style={{ 
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                    pointerEvents: (activeTool === 'draw' || activeTool === 'text') ? 'auto' : 'none', 
                    cursor: activeTool === 'draw' ? 'crosshair' : (activeTool === 'text' ? 'text' : 'default'),
                    transform: `rotate(${rotation}deg)`,
                    aspectRatio: isLandscapeRotation ? `${originalPageSize.height}/${originalPageSize.width}` : 'auto'
                }} 
                viewBox={`0 0 ${originalPageSize.width} ${originalPageSize.height}`} 
                onPointerDown={handleSvgPointerDown} 
                onPointerMove={handleDrawMove} 
                onPointerUp={handleDrawEnd} 
                onPointerLeave={handleDrawEnd}
              >
                {drawings.filter(d => d.page === pageNumber).map((d, idx) => (
                  <path 
                    key={idx} 
                    d={makeSvgPath(d.path)} 
                    fill="none" 
                    stroke={d.color || 'red'} 
                    strokeWidth={d.thickness || 3} // UPDATE INI
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                ))}
                {currentDrawing && (
                  <path 
                    d={makeSvgPath(currentDrawing)} 
                    fill="none" 
                    stroke={drawColor} 
                    strokeWidth={drawThickness} // UPDATE INI
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                )}
                {/* RENDER TEKS BARU (MENUMPANG DI DALAM SVG) */}
                {texts.filter(t => t.page === pageNumber).map(t => (
                  t.isEditing ? (
                    // foreignObject memungkinkan kita menaruh tag HTML (input) ke dalam SVG
                    <foreignObject 
                      key={t.id} 
                      x={t.x} 
                      y={t.y - t.size} // Geser ke atas sedikit agar pas dengan kursor
                      width="100%" 
                      height={t.size * 3}
                    >
                      <input
                        autoFocus
                        type="text"
                        value={t.text}
                        onChange={(e) => setTexts(texts.map(txt => txt.id === t.id ? { ...txt, text: e.target.value } : txt))}
                        onBlur={() => {
                          if (!t.text.trim()) setTexts(texts.filter(txt => txt.id !== t.id));
                          else setTexts(texts.map(txt => txt.id === t.id ? { ...txt, isEditing: false } : txt));
                        }}
                        style={{
                          fontSize: `${t.size}px`,
                          color: t.color,
                          background: 'transparent',
                          border: '1px dashed #3b82f6',
                          outline: 'none',
                          fontFamily: 'Helvetica, Arial, sans-serif',
                          width: 'max-content',
                          minWidth: '50px'
                        }}
                      />
                    </foreignObject>
                  ) : (
                    // Mode baca (Native SVG Text)
                    <text
                      key={t.id}
                      x={t.x}
                      y={t.y}
                      fontSize={t.size}
                      fill={t.color}
                      fontFamily="Helvetica, Arial, sans-serif"
                      onPointerDown={(e) => {
                        if (activeTool === 'text') {
                          e.stopPropagation();
                          setTexts(texts.map(txt => txt.id === t.id ? { ...txt, isEditing: true } : txt));
                        }
                      }}
                      style={{ cursor: activeTool === 'text' ? 'text' : 'default', userSelect: 'none' }}
                    >
                      {t.text}
                    </text>
                  )
                ))}
              </svg>
            )}
            {originalPageSize && (
              <div 
                onClick={handleTextContainerClick}
                style={{ 
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                  pointerEvents: activeTool === 'text' ? 'auto' : 'none', 
                  zIndex: 20,
                  transform: `rotate(${rotation}deg)`,
                  aspectRatio: isLandscapeRotation ? `${originalPageSize.height}/${originalPageSize.width}` : 'auto'
                }}
              >
                <TextOverlay 
                  texts={texts} 
                  setTexts={setTexts} 
                  pageNumber={pageNumber} 
                  activeTool={activeTool}
                />
              </div>
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

          {activeTool === 'text' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px', paddingLeft: '16px', borderLeft: '1px solid #e5e7eb' }}>
              <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ width: '28px', height: '28px', padding: '0', border: 'none', borderRadius: '50%', cursor: 'pointer' }} title="Pilih Warna Teks" />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                <span style={{fontSize: '12px', color: '#6b7280', fontWeight: 'bold'}}>Size:</span>
                <input 
                  type="number" 
                  min="10" max="72" 
                  value={textSize} 
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  style={{ width: '45px', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '2px 4px' }}
                />
              </div>
            </div>
          )}
          
          {activeTool === 'draw' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px', paddingLeft: '16px', borderLeft: '1px solid #e5e7eb' }}>
              <Palette size={16} color="#6b7280" />
              <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} style={{ width: '28px', height: '28px', padding: '0', border: 'none', borderRadius: '50%', cursor: 'pointer', overflow: 'hidden' }} title="Pilih Warna" />
              
              {/* TAMBAHAN BARU: Slider Ketebalan */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#6b7280' }}></div>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  value={drawThickness} 
                  onChange={(e) => setDrawThickness(Number(e.target.value))}
                  style={{ width: '60px', cursor: 'pointer' }}
                  title="Ketebalan Coretan"
                />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6b7280' }}></div>
              </div>
              {/* AKHIR TAMBAHAN BARU */}

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