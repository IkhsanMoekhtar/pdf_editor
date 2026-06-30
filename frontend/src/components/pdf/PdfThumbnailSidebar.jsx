import React from 'react';
import { Document, Page } from 'react-pdf';

export default function PdfThumbnailSidebar({
  file,
  numPages,
  pageNumber,
  thumbSize,
  setThumbSize,
  thumbnailListRef,
  thumbnailPages,
  isLowPerformanceMode,
  recentlyChangedPage,
  setPageNumber,
  setThumbnailRef,
  shouldRenderThumbnailPage,
  thumbnailWidth,
}) {
  if (!numPages || numPages <= 1) return null;

  return (
    <aside className="page-thumbnails" aria-label="Preview halaman PDF">
      <div className="page-thumbnails-header">
        <p className="page-thumbnails-title">Cuplikan halaman</p>
        <div className="thumb-size-switch" role="group" aria-label="Ukuran thumbnail">
          <button
            type="button"
            className={`thumb-size-btn ${thumbSize === 'md' ? 'active' : ''}`}
            onClick={() => setThumbSize('md')}
          >
            Kecil
          </button>
          <button
            type="button"
            className={`thumb-size-btn ${thumbSize === 'lg' ? 'active' : ''}`}
            onClick={() => setThumbSize('lg')}
          >
            Besar
          </button>
        </div>
      </div>
      <Document file={file}>
        <div className="page-thumbnails-list" ref={thumbnailListRef}>
          {thumbnailPages.map((page) => (
            <button
              key={page}
              data-page={page}
              type="button"
              className={`page-thumbnail-btn ${page === pageNumber ? 'active' : ''} ${!isLowPerformanceMode && page === recentlyChangedPage ? 'pulse' : ''}`}
              onClick={() => setPageNumber(page)}
              aria-label={`Pilih halaman ${page}`}
              ref={(el) => setThumbnailRef(page, el)}
            >
              <span className="page-thumbnail-badge">{page}</span>
              {shouldRenderThumbnailPage(page) ? (
                <Page
                  pageNumber={page}
                  width={thumbnailWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={<div className="page-thumbnail-loading">Menyusun...</div>}
                />
              ) : (
                <div className="page-thumbnail-placeholder" style={{ width: `${thumbnailWidth}px` }} aria-hidden="true">
                  Cuplikan
                </div>
              )}
              <span className="page-thumbnail-label">Hal {page}</span>
            </button>
          ))}
        </div>
      </Document>
    </aside>
  );
}
