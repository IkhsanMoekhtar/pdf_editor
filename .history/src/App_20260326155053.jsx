import React, { useState } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import Sidebar from './components/layout/Sidebar';
import EmptyState from './components/layout/EmptyState';
import PdfViewer from './components/pdf/PdfViewer';
import './App.css';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [drawings, setDrawings] = useState([]);

  // Fungsi mengubah warna HEX HTML ke RGB untuk pdf-lib
  const hexToPdfRgb = (hex) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return { r, g, b };
  };

  const handleUpload = (file) => {
    setPdfFile(file);
    setActiveTool(null);
    setDrawings([]); // Reset coretan saat upload file baru
  };

  const savePdfWithDrawings = async () => {
    if (!pdfFile) return;

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      drawings.forEach((drawing) => {
        const pageIndex = drawing.page - 1; 
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const { height } = page.getSize();
          const points = drawing.path;

          for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const pdfColor = hexToPdfRgb(drawing.color || '#ff0000'); 

            page.drawLine({
              start: { x: p1.x, y: height - p1.y }, 
              end: { x: p2.x, y: height - p2.y },
              thickness: 3,
              color: rgb(pdfColor.r, pdfColor.g, pdfColor.b), 
            });
          }
        }
      });

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
      <Sidebar 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
        onSave={savePdfWithDrawings} 
      />

      <main className="workspace">
        {pdfFile ? (
          <PdfViewer 
            file={pdfFile} 
            activeTool={activeTool} 
            setActiveTool={setActiveTool}
            drawings={drawings}
            setDrawings={setDrawings}
          />
        ) : (
          <EmptyState onUpload={handleUpload} />
        )}
      </main>
    </div>
  );
}

export default App;