import React, { useState } from 'react';
import './App.css';

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
      alert("Mempersiapkan data untuk dikirim ke backend Golang!");
      setActiveTool(null);
    }
  };

  return (
    <div className="app-container">
      
      {/* --- TOPBAR: Menu Editing Utama --- */}
      <header className="topbar">
        <div className="brand">
          <strong>PDF Editor</strong>
        </div>
        
        <div className="tools-group">
          <button 
            className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} 
            onClick={() => handleToolClick('text')}
          >
            ✍️ Teks
          </button>
          <button 
            className={`tool-btn ${activeTool === 'draw' ? 'active' : ''}`} 
            onClick={() => handleToolClick('draw')}
          >
            🖌️ Coretan
          </button>
          <button 
            className={`tool-btn ${activeTool === 'highlight' ? 'active' : ''}`} 
            onClick={() => handleToolClick('highlight')}
          >
            🖍️ Highlight
          </button>
        </div>

        <button className="tool-btn save-btn" onClick={() => handleToolClick('save')}>
          💾 Simpan & Proses
        </button>
      </header>

      {/* --- AREA KERJA UTAMA --- */}
      <main className="workspace">
        
        {/* --- SIDEBAR TERSEMBUNYI (Slide dari Kiri) --- */}
        <aside className="slide-sidebar">
          {/* Elemen visual kecil agar user tahu ada menu di kiri */}
          <div className="sidebar-hint">▶</div> 
          
          <div className="sidebar-content">
            <h3 style={{ marginBottom: '20px', borderBottom: '1px solid #4b5563', paddingBottom: '10px' }}>
              Detail Dokumen
            </h3>
            
            <label className="upload-label">
              Unggah Dokumen PDF
              <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>

            {pdfFile && (
              <div className="document-info">
                <p>✅ Dokumen aktif dimuat.</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '10px' }}>
                  Arahkan mouse keluar dari area ini untuk menutup panel.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* --- AREA PENAMPIL PDF --- */}
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
            <div className="empty-state">
              <h3>Belum ada dokumen</h3>
              <p>Arahkan mouse ke ujung kiri layar untuk membuka menu unggah.</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default App;