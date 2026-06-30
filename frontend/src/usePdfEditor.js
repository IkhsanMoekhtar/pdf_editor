import { useState, useRef, useEffect } from 'react';

export function usePdfEditor({ onNotify } = {}) {
  // --- 1. SEMUA STATE ---
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null); 
  const [expandedMenu, setExpandedMenu] = useState(null); 
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [originalPageSize, setOriginalPageSize] = useState(null);
  const [userZoom, setUserZoom] = useState(1); 
  const [rotation, setRotation] = useState(0); 
  const [isZoomMode, setIsZoomMode] = useState(false);
  const [flipX, setFlipX] = useState(false); 
  const [flipY, setFlipY] = useState(false); 
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  // --- 2. SEMUA REFS ---
  const fileInputRef = useRef(null);
  const pdfWrapperRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // --- 3. EFFECTS ---
  // Effect untuk mengamati ukuran wadah PDF
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

  // Effect untuk Scroll Zoom
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

        let nextZoom;
        if (e.deltaY < 0) {
          nextZoom = Math.min(userZoom + zoomStep, 4);
        } else {
          nextZoom = Math.max(userZoom - zoomStep, 0.25);
        }

        setUserZoom(nextZoom);

        container.scrollLeft = contentX * nextZoom - mouseX;
        container.scrollTop = contentY * nextZoom - mouseY;
      }
    };

    container.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelZoom);
  }, [isZoomMode, userZoom]);

  // --- 4. FUNGSI KALKULASI & HANDLERS ---
  const calculateBaseScale = () => {
    if (!containerSize.width || !containerSize.height || !originalPageSize) return 0.2; 
    if (!originalPageSize.width || !originalPageSize.height) return 1;

    const scaleX = containerSize.width / originalPageSize.width;
    const scaleY = containerSize.height / originalPageSize.height;
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
      setActiveTool(null); 
    } else {
      onNotify?.('Mohon unggah file dengan format PDF.', 'error');
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

  const handleMouseDown = (e) => {
    if (activeTool !== null) return; 
    setIsDragging(true);
    setDragStart({ x: e.pageX, y: e.pageY });
    setScrollStart({
      left: scrollContainerRef.current.scrollLeft,
      top: scrollContainerRef.current.scrollTop
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault(); 
    const dx = e.pageX - dragStart.x;
    const dy = e.pageY - dragStart.y;
    scrollContainerRef.current.scrollLeft = scrollStart.left - dx;
    scrollContainerRef.current.scrollTop = scrollStart.top - dy;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleToolClick = (toolName) => {
    setActiveTool(prev => prev === toolName ? null : toolName);
  };

  const rotatePage = () => setRotation(prev => (prev + 90) % 360);
  const toggleFlipX = () => setFlipX(prev => !prev);
  const toggleFlipY = () => setFlipY(prev => !prev);
  const triggerUpload = () => fileInputRef.current.click();
  const toggleMenu = (menuName) => setExpandedMenu(prev => prev === menuName ? null : menuName);

  const getCursorStyle = () => {
    if (activeTool) return 'crosshair'; 
    if (isDragging) return 'grabbing'; 
    return 'grab'; 
  };

  const baseWidth = originalPageSize ? (originalPageSize.width * calculateBaseScale()) : 0;
  const currentWidth = baseWidth * userZoom;

  // --- 5. EKSPOR SEMUA YANG DIBUTUHKAN OLEH TAMPILAN ---
  return {
    pdfFile, activeTool, expandedMenu, numPages, pageNumber, containerSize,
    userZoom, rotation, isZoomMode, setIsZoomMode, flipX, flipY, isDragging,
    fileInputRef, pdfWrapperRef, scrollContainerRef,
    calculateBaseScale, handleFileUpload, onDocumentLoadSuccess, onPageLoadSuccess,
    changePage, handleMouseDown, handleMouseMove, handleMouseUpOrLeave,
    handleToolClick, rotatePage, toggleFlipX, toggleFlipY, triggerUpload,
    toggleMenu, getCursorStyle, currentWidth
  };
}