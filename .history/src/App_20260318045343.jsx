import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  
  // Membuat referensi untuk elemen input file yang disembunyikan
  const fileInputRef = useRef(null);

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

  // Fungsi yang dijalankan saat area kosong diklik
  const triggerUpload = () => {
    fileInputRef.current.click(); // Memicu klik pada input file yang asli
  };

  return (
    <div className="app-container">
      
      {/* --- TOPBAR: Menu Editing Utama --- */}
      <header className="topbar">
        <div className="brand">
          <strong>PDF Editor</strong>
        </div>
        
        <div className="tools-group">
          <button className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => handleToolClick('text')}>
            ✍️ Teks
          </button>
          <button className={`tool-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => handleToolClick('draw')}>
            🖌️ Coretan
          </button>
          <button className={`tool-btn ${activeTool === 'highlight' ? 'active' : ''}`} onClick={() => handleToolClick('highlight')}>
            🖍️ Highlight
          </button>
        </div>

        <button className="tool-btn save-btn" onClick={() => handleToolClick('save')}>
          💾 Simpan & Proses
        </button>
      </header>

      {/* --- AREA KERJA UTAMA --- */}
      <main className="workspace">
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
            // --- AREA KOSONG (KLIK UNTUK UPLOAD) ---
            // Tambahkan event onClick ke kontainer utama
            <div className="empty-state desktop-scene" onClick={triggerUpload}>
              
              {/* INPUT FILE TERSEMBUNYI */}
              <input 
                type="file" 
                accept="application/pdf" 
                style={{ display: 'none' }} 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />

              {/* Dekorasi Papan Klip */}
              <div className="clipboard">
                <div className="clipboard-paper">
                  <div className="clipboard-header">Kanvas Anda</div>
                  <div className="clipboard-content">
                    <div className="empty-line large"></div>
                    <div className="empty-line"></div>
                    <div className="empty-line medium"></div>
                    <div className="empty-line large"></div>
                  </div>
                </div>
              </div>

              {/* Dekorasi Meja */}
              <div className="desk-item coffee-cup">☕️</div>
              <div className="desk-item pens">✏️ 🖋️</div>
              
              {/* Pesan */}
              <div className="message-container">
                <h3>Editor PDF Siap Beraksi</h3>
                <p>Ruang kerja ini sedang menanti sentuhan kreatif Anda.</p>
              </div>
              
              {/* Petunjuk Memulai */}
              <div className="start-hint-pil">
                <span className="bouncy-arrow">🖱️</span> Klik area ini untuk memilih PDF
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;