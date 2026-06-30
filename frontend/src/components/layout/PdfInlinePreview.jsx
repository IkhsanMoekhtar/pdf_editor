import React, { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function PdfInlinePreview({ file, url, title, mobileLabel = 'Buka PDF' }) {
  const previewFile = useMemo(() => file || null, [file]);
  const [numPages, setNumPages] = useState(0);

  const handleLoadSuccess = ({ numPages: nextNumPages }) => {
    setNumPages(nextNumPages || 0);
  };

  return (
    <div className="batch-preview-frameWrap">
      <iframe
        className="batch-pdf-preview batch-pdf-preview-desktop"
        src={`${url}#toolbar=0&navpanes=0`}
        title={title}
      />

      <div className="batch-pdf-preview-mobile" aria-label={`${title} preview mobile`}>
        <Document
          file={previewFile}
          loading={<div className="batch-preview-mobile-loading">Memuat preview...</div>}
          onLoadSuccess={handleLoadSuccess}
        >
          <div className="batch-preview-mobile-meta">
            <span>Halaman 1</span>
            <span>{numPages ? `dari ${numPages}` : '...'}</span>
          </div>
          <Page
            pageNumber={1}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            scale={0.95}
            className="batch-preview-mobile-page"
          />
        </Document>
        <a className="batch-preview-open-btn" href={url} target="_blank" rel="noreferrer">
          {mobileLabel}
        </a>
      </div>
    </div>
  );
}