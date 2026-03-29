import React, { useState } from 'react';
import './App.css'; // Mengimpor file CSS yang baru dibuat

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      const fileUrl = URL.createObjectURL(file);
      setPdfFile(fileUrl);
    } else {
      alert("Mohon unggah file dengan format PDF.");
    }
  };

  const handleToolClick = (toolName) => {
    setActiveTool(toolName);
    if (toolName === 'save') {
      alert("Ini akan mengirim file ke backend Golang nanti!");
      setActiveTool(null);
    }
  };

  return (
    <div className="app-container">
      
      {/* BAGIAN SIDEBAR (Kiri di Desktop, Atas di HP) */}
      <div className="sidebar">
        <h2 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>PDF Editor</h2>
        
        <label className="upload-label">
          Unggah Dokumen PDF
          <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
        </label>

        <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>Alat Edit:</p>
        
        <div className="tools-group">
          {/* Tambahkan class 'active' jika tool sedang dipilih */}
          <button 
            className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} 
            onClick={() => handleToolClick('text')}
          >
            ✍️ Tambah Teks
          </button>
          <button 
            className={`tool-btn ${activeTool === 'draw' ? 'active' : ''}`} 
            onClick={() => handleToolClick('draw')}
          >
            🖌️ Coretan Bebas
          </button>
          <button 
            className={`tool-btn ${activeTool === 'highlight' ? 'active' : ''}`} 
            onClick={() => handleToolClick('highlight')}
          >
            🖍️ Highlight
          </button>
        </div>
        
        <button 
          className="tool-btn save-btn" 
          onClick={() => handleToolClick('save')}
        >
          💾 Simpan & Proses
        </button>
      </div>

      {/* BAGIAN UTAMA (Kanan di Desktop, Bawah di HP) */}
      <div className="main-content">
        <div className="viewer-container">
          {pdfFile ? (
            <iframe 
              src={pdfFile} 
              width="100%" 
              height="100%" 
              title="PDF Viewer"
              style={{ border: 'none' }}
            />
          ) : (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
              <h3>Belum ada dokumen</h3>
              <p>Silakan unggah file PDF melalui menu yang tersedia.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default App;