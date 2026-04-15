import { useEffect, useMemo, useRef, useState } from 'react';

export default function usePdfViewerState({ file, activeTool, drawings, setDrawings, rotation, setRotation, texts, setTexts }) {
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
  const drawingFrameRef = useRef(null);
  const pendingPointRef = useRef(null);
  const panFrameRef = useRef(null);
  const pendingPanRef = useRef(null);
  const panPointerIdRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  const [textColor, setTextColor] = useState('#000000');
  const [textSize, setTextSize] = useState(16);
  const [thumbSize, setThumbSize] = useState('md');
  const [isLowPerformanceMode, setIsLowPerformanceMode] = useState(false);
  const [recentlyChangedPage, setRecentlyChangedPage] = useState(null);
  const [visibleThumbnailPages, setVisibleThumbnailPages] = useState({});
  const thumbnailRefs = useRef({});
  const thumbnailObserverRef = useRef(null);
  const thumbnailListRef = useRef(null);

  useEffect(() => {
    setPageNumber(1);
    setOriginalPageSize(null);
    setUserZoom(1);
    setVisibleThumbnailPages({});
  }, [file]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerSize({
          width: entries[0].contentRect.width - 60,
          height: entries[0].contentRect.height - 100,
        });
      }
    });

    if (pdfWrapperRef.current) observer.observe(pdfWrapperRef.current);
    return () => observer.disconnect();
  }, [file]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheelZoom = (e) => {
      if (!isZoomMode) return;

      e.preventDefault();
      const zoomStep = 0.1;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const contentX = (container.scrollLeft + mouseX) / userZoom;
      const contentY = (container.scrollTop + mouseY) / userZoom;
      const nextZoom = e.deltaY < 0 ? Math.min(userZoom + zoomStep, 4) : Math.max(userZoom - zoomStep, 0.25);

      setUserZoom(nextZoom);
      container.scrollLeft = contentX * nextZoom - mouseX;
      container.scrollTop = contentY * nextZoom - mouseY;
    };

    container.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelZoom);
  }, [isZoomMode, userZoom]);

  useEffect(() => {
    return () => {
      if (drawingFrameRef.current) {
        cancelAnimationFrame(drawingFrameRef.current);
      }

      if (panFrameRef.current) {
        cancelAnimationFrame(panFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!numPages || numPages <= 1) return;
    const activeThumb = thumbnailRefs.current[pageNumber];
    if (!activeThumb) return;

    if (!isLowPerformanceMode) {
      setRecentlyChangedPage(pageNumber);
    }

    activeThumb.scrollIntoView({
      behavior: isLowPerformanceMode ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });

    if (isLowPerformanceMode) return;

    const timer = window.setTimeout(() => {
      setRecentlyChangedPage(null);
    }, 320);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pageNumber, numPages, isLowPerformanceMode]);

  useEffect(() => {
    if (!numPages || numPages <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleThumbnailPages((prev) => {
          let changed = false;
          const next = { ...prev };

          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const rawPage = entry.target.getAttribute('data-page');
            const page = rawPage ? Number(rawPage) : NaN;
            if (!Number.isFinite(page)) return;

            if (!next[page]) {
              next[page] = true;
              changed = true;
            }
          });

          return changed ? next : prev;
        });
      },
      {
        root: thumbnailListRef.current,
        rootMargin: '120px 0px',
        threshold: 0.1,
      },
    );

    thumbnailObserverRef.current = observer;

    Object.values(thumbnailRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      thumbnailObserverRef.current = null;
    };
  }, [numPages]);

  const isLandscapeRotation = rotation === 90 || rotation === 270;
  const docWidth = originalPageSize ? (isLandscapeRotation ? originalPageSize.height : originalPageSize.width) : 0;
  const docHeight = originalPageSize ? (isLandscapeRotation ? originalPageSize.width : originalPageSize.height) : 0;

  const calculateBaseScale = () => {
    if (!containerSize.width || !containerSize.height || !originalPageSize) return 0.2;
    if (!originalPageSize.width || !originalPageSize.height) return 1;
    return Math.min(containerSize.width / docWidth, containerSize.height / docHeight) - 0.02;
  };

  const baseScale = useMemo(() => calculateBaseScale(), [containerSize, originalPageSize, docWidth, docHeight]);

  const onDocumentLoadSuccess = ({ numPages: nextNumPages }) => setNumPages(nextNumPages);
  const onPageLoadSuccess = (page) => setOriginalPageSize({ width: page.originalWidth, height: page.originalHeight });

  const changePage = (offset) => {
    if (!numPages) return;

    setPageNumber((prev) => {
      const nextPage = prev + offset;
      return Math.min(Math.max(nextPage, 1), numPages);
    });
  };

  useEffect(() => {
    const isTypingTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) return false;

      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      return target.isContentEditable;
    };

    const handleKeyDown = (event) => {
      if (!numPages || numPages <= 1) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        changePage(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        changePage(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [numPages]);

  const handlePanPointerDown = (e) => {
    if (activeTool !== null) return;
    if (e.pointerType === 'touch') return;
    if (e.button !== undefined && e.button !== 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    e.preventDefault();
    panPointerIdRef.current = e.pointerId;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({ left: container.scrollLeft, top: container.scrollTop });

    if (typeof e.currentTarget?.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Abaikan jika browser tidak mengizinkan pointer capture.
      }
    }
  };

  const handlePanPointerMove = (e) => {
    if (!isDragging || panPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();

    pendingPanRef.current = {
      left: scrollStart.left - (e.clientX - dragStart.x),
      top: scrollStart.top - (e.clientY - dragStart.y),
    };

    if (panFrameRef.current) return;

    panFrameRef.current = requestAnimationFrame(() => {
      panFrameRef.current = null;
      const pendingPan = pendingPanRef.current;
      if (!pendingPan || !scrollContainerRef.current) return;

      scrollContainerRef.current.scrollLeft = pendingPan.left;
      scrollContainerRef.current.scrollTop = pendingPan.top;
      pendingPanRef.current = null;
    });
  };

  const handlePanPointerEnd = (e) => {
    if (panPointerIdRef.current !== null && e.pointerId !== undefined && panPointerIdRef.current !== e.pointerId) {
      return;
    }

    if (panFrameRef.current) {
      cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
    }

    pendingPanRef.current = null;
    panPointerIdRef.current = null;
    setIsDragging(false);
  };

  const handleZoomStep = (step) => {
    const nextZoom = userZoom + step;
    const clampedZoom = Math.min(4, Math.max(0.25, nextZoom));
    const container = scrollContainerRef.current;

    if (!container) {
      setUserZoom(clampedZoom);
      return;
    }

    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const contentX = (container.scrollLeft + centerX) / userZoom;
    const contentY = (container.scrollTop + centerY) / userZoom;

    setUserZoom(clampedZoom);

    requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;
      scrollContainerRef.current.scrollLeft = contentX * clampedZoom - centerX;
      scrollContainerRef.current.scrollTop = contentY * clampedZoom - centerY;
    });
  };

  const getCursorStyle = () => (activeTool ? 'crosshair' : isDragging ? 'grabbing' : 'grab');

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
    pendingPointRef.current = null;
    setCurrentDrawing([coords]);
  };

  const handleDrawMove = (e) => {
    if (activeTool !== 'draw' || !currentDrawing) return;
    e.preventDefault();
    const coords = getLogicalCoords(e);
    pendingPointRef.current = coords;

    if (drawingFrameRef.current) return;

    drawingFrameRef.current = requestAnimationFrame(() => {
      drawingFrameRef.current = null;
      const nextPoint = pendingPointRef.current;
      if (!nextPoint) return;

      setCurrentDrawing((prev) => {
        if (!prev) return prev;
        return [...prev, nextPoint];
      });
      pendingPointRef.current = null;
    });
  };

  const handleDrawEnd = () => {
    if (drawingFrameRef.current) {
      cancelAnimationFrame(drawingFrameRef.current);
      drawingFrameRef.current = null;
    }

    const pendingPoint = pendingPointRef.current;
    pendingPointRef.current = null;

    if (currentDrawing) {
      const finalPath = pendingPoint ? [...currentDrawing, pendingPoint] : currentDrawing;
      setDrawings([
        ...drawings,
        { page: pageNumber, path: finalPath, color: drawColor, thickness: drawThickness },
      ]);
      setCurrentDrawing(null);
      setRedoStack([]);
    }
  };

  const handleUndo = () => {
    if (drawings.length === 0) return;
    const newDrawings = [...drawings];
    const lastDrawing = newDrawings.pop();
    setDrawings(newDrawings);
    setRedoStack([...redoStack, lastDrawing]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const newRedoStack = [...redoStack];
    const drawingToRestore = newRedoStack.pop();
    setRedoStack(newRedoStack);
    setDrawings([...drawings, drawingToRestore]);
  };

  const makeSvgPath = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;

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
    if (e.target !== e.currentTarget) return;

    const coords = getLogicalCoords(e);
    const newText = {
      id: Date.now().toString(),
      page: pageNumber,
      x: coords.x,
      y: coords.y,
      text: '',
      color: textColor,
      size: textSize,
      isEditing: true,
    };
    setTexts([...texts, newText]);
  };

  const handleSvgPointerDown = (e) => {
    if (activeTool === 'draw') {
      handleDrawStart(e);
    } else if (activeTool === 'text') {
      if (e.target.tagName.toLowerCase() === 'text' || e.target.tagName.toLowerCase() === 'input') return;

      e.preventDefault();
      const coords = getLogicalCoords(e);
      const newText = {
        id: Date.now().toString(),
        page: pageNumber,
        x: coords.x,
        y: coords.y,
        text: '',
        color: textColor,
        size: textSize,
        isEditing: true,
      };
      setTexts([...texts, newText]);
    }
  };

  const pageDrawings = useMemo(() => drawings.filter((d) => d.page === pageNumber), [drawings, pageNumber]);
  const pageTexts = useMemo(() => texts.filter((t) => t.page === pageNumber), [texts, pageNumber]);
  const thumbnailPages = useMemo(() => Array.from({ length: numPages || 0 }, (_, index) => index + 1), [numPages]);
  const thumbnailWidth = thumbSize === 'lg' ? 152 : 126;
  const thumbnailWindowRadius = isLowPerformanceMode ? 1 : 3;

  const setThumbnailRef = (page, el) => {
    const existingEl = thumbnailRefs.current[page];

    if (existingEl && thumbnailObserverRef.current) {
      thumbnailObserverRef.current.unobserve(existingEl);
    }

    if (!el) {
      delete thumbnailRefs.current[page];
      return;
    }

    thumbnailRefs.current[page] = el;

    if (thumbnailObserverRef.current) {
      thumbnailObserverRef.current.observe(el);
    }
  };

  const shouldRenderThumbnailPage = (page) => {
    if (!numPages) return false;

    const isVisible = Boolean(visibleThumbnailPages[page]);
    const isNearCurrent = Math.abs(page - pageNumber) <= thumbnailWindowRadius;
    const isEdgePage = page <= 2 || page > numPages - 2;
    return isVisible || isNearCurrent || isEdgePage;
  };

  const renderScale = baseScale * userZoom;
  const currentWidth = docWidth * renderScale;

  return {
    numPages,
    pageNumber,
    setPageNumber,
    pdfWrapperRef,
    scrollContainerRef,
    containerSize,
    originalPageSize,
    userZoom,
    isZoomMode,
    setIsZoomMode,
    currentDrawing,
    drawColor,
    setDrawColor,
    drawThickness,
    setDrawThickness,
    redoStack,
    isDragging,
    textColor,
    setTextColor,
    textSize,
    setTextSize,
    thumbSize,
    setThumbSize,
    isLowPerformanceMode,
    setIsLowPerformanceMode,
    recentlyChangedPage,
    setRecentlyChangedPage,
    thumbnailListRef,
    pageDrawings,
    pageTexts,
    thumbnailPages,
    thumbnailWidth,
    thumbnailWindowRadius,
    setThumbnailRef,
    shouldRenderThumbnailPage,
    renderScale,
    currentWidth,
    isLandscapeRotation,
    docWidth,
    docHeight,
    onDocumentLoadSuccess,
    onPageLoadSuccess,
    changePage,
    handlePanPointerDown,
    handlePanPointerMove,
    handlePanPointerEnd,
    handleZoomStep,
    getCursorStyle,
    handleSvgPointerDown,
    handleDrawMove,
    handleDrawEnd,
    handleTextContainerClick,
    handleUndo,
    handleRedo,
    makeSvgPath,
    setCurrentDrawing,
    setDrawings,
    setTexts,
  };
}
