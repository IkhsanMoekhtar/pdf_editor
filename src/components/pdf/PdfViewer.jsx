import React from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import usePdfViewerState from '../../hooks/usePdfViewerState';
import PdfAnnotationOverlay from './PdfAnnotationOverlay';
import PdfThumbnailSidebar from './PdfThumbnailSidebar';
import PdfViewerToolbar from './PdfViewerToolbar';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function PdfViewer({
  file,
  activeTool,
  setActiveTool,
  drawings,
  setDrawings,
  rotation,
  setRotation,
  texts,
  setTexts,
}) {
  const viewer = usePdfViewerState({
    file,
    activeTool,
    drawings,
    setDrawings,
    rotation,
    setRotation,
    texts,
    setTexts,
  });

  return (
    <div className="viewer-container viewer-shell" ref={viewer.pdfWrapperRef}>
      <div className="custom-pdf-viewer viewer-layout">
        <div className="pdf-controls viewer-controls">
          <button
            onClick={() => viewer.changePage(-1)}
            disabled={viewer.pageNumber <= 1}
            className="viewer-nav-btn"
            style={{ opacity: viewer.pageNumber <= 1 ? 0.5 : 1 }}
          >
            <ChevronLeft size={18} /> Sebelumnya
          </button>
          <span className="viewer-page-indicator">
            Halaman {viewer.pageNumber} / {viewer.numPages || '--'}
          </span>
          <button
            onClick={() => viewer.changePage(1)}
            disabled={viewer.pageNumber >= viewer.numPages}
            className="viewer-nav-btn"
            style={{ opacity: viewer.pageNumber >= viewer.numPages ? 0.5 : 1 }}
          >
            Berikutnya <ChevronRight size={18} />
          </button>
        </div>

        <div className="viewer-body viewer-main">
          <div
            className="pdf-paper-wrapper pdf-scroll-area"
            ref={viewer.scrollContainerRef}
            onPointerDown={viewer.handlePanPointerDown}
            onPointerMove={viewer.handlePanPointerMove}
            onPointerUp={viewer.handlePanPointerEnd}
            onPointerCancel={viewer.handlePanPointerEnd}
            onPointerLeave={viewer.handlePanPointerEnd}
            style={{
              cursor: viewer.getCursorStyle(),
              userSelect: viewer.isDragging ? 'none' : 'auto',
              touchAction: activeTool ? 'none' : 'pan-y pinch-zoom',
            }}
          >
            <div
              className="pdf-paper"
              style={{
                position: 'relative',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                backgroundColor: 'white',
                display: 'block',
                margin: viewer.currentWidth > viewer.containerSize.width ? '0' : '0 auto',
                width: viewer.currentWidth ? `${viewer.currentWidth}px` : 'auto',
              }}
            >
              <Document file={file} onLoadSuccess={viewer.onDocumentLoadSuccess} loading={<div className="viewer-loading">Menata halaman...</div>}>
                <Page
                  pageNumber={viewer.pageNumber}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadSuccess={viewer.onPageLoadSuccess}
                  scale={viewer.renderScale}
                  rotate={rotation}
                />
              </Document>

              <PdfAnnotationOverlay
                activeTool={activeTool}
                rotation={rotation}
                originalPageSize={viewer.originalPageSize}
                pageDrawings={viewer.pageDrawings}
                currentDrawing={viewer.currentDrawing}
                drawColor={viewer.drawColor}
                drawThickness={viewer.drawThickness}
                pageTexts={viewer.pageTexts}
                makeSvgPath={viewer.makeSvgPath}
                handleSvgPointerDown={viewer.handleSvgPointerDown}
                handleDrawMove={viewer.handleDrawMove}
                handleDrawEnd={viewer.handleDrawEnd}
                setTexts={viewer.setTexts}
                texts={texts}
              />
            </div>
          </div>

          <PdfThumbnailSidebar
            file={file}
            numPages={viewer.numPages}
            pageNumber={viewer.pageNumber}
            thumbSize={viewer.thumbSize}
            setThumbSize={viewer.setThumbSize}
            thumbnailListRef={viewer.thumbnailListRef}
            thumbnailPages={viewer.thumbnailPages}
            isLowPerformanceMode={viewer.isLowPerformanceMode}
            recentlyChangedPage={viewer.recentlyChangedPage}
            setPageNumber={viewer.setPageNumber}
            setThumbnailRef={viewer.setThumbnailRef}
            shouldRenderThumbnailPage={viewer.shouldRenderThumbnailPage}
            thumbnailWidth={viewer.thumbnailWidth}
          />
        </div>

        <PdfViewerToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          renderScale={viewer.renderScale}
          isZoomMode={viewer.isZoomMode}
          setIsZoomMode={viewer.setIsZoomMode}
          handleZoomStep={viewer.handleZoomStep}
          isLowPerformanceMode={viewer.isLowPerformanceMode}
          setIsLowPerformanceMode={viewer.setIsLowPerformanceMode}
          onRotateLeft={() => setRotation((prev) => (prev - 90 + 360) % 360)}
          onRotateRight={() => setRotation((prev) => (prev + 90) % 360)}
          textColor={viewer.textColor}
          setTextColor={viewer.setTextColor}
          textSize={viewer.textSize}
          setTextSize={viewer.setTextSize}
          drawColor={viewer.drawColor}
          setDrawColor={viewer.setDrawColor}
          drawThickness={viewer.drawThickness}
          setDrawThickness={viewer.setDrawThickness}
          handleUndo={viewer.handleUndo}
          handleRedo={viewer.handleRedo}
          canUndo={drawings.length > 0}
          canRedo={viewer.redoStack.length > 0}
        />
      </div>
    </div>
  );
}
