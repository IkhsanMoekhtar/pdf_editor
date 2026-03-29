  import React, { useState, useRef, useEffect } from 'react';
  import { Document, Page, pdfjs } from 'react-pdf';

  
  export function usePdfEditor(){
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
  }