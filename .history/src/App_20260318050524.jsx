import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(URL.createObjectURL(file));
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

  const triggerUpload = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="app-container">
      
      {/* --- TOPBAR: Mega Menu Navigation --- */}
      <header className="topbar">
        <div className="brand">
          <strong>PDF Editor</strong>
        </div>
        
        {/* Kontainer Menu Utama */}
        <nav className="main-nav">
          <div className="nav-item">GABUNG PDF</div>
          <div className="nav-item">PISAH PDF</div>
          <div className="nav-item">KOMPRES PDF</div>

          {/* Menu dengan Dropdown Besar (Mega Menu) */}
          <div className="nav-item has-dropdown">
            KONVERSI PDF <span className="arrow">▼</span>
            
            <div className="dropdown-menu mega-menu">
              <div className="dropdown-column">
                <h4>KONVERSI KE PDF</h4>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-jpg">J</span> JPG ke PDF
                </button>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-word">W</span> WORD ke PDF
                </button>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-ppt">P</span> POWERPOINT ke PDF
                </button>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-excel">X</span> EXCEL ke PDF
                </button>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-html">H</span> HTML ke PDF
                </button>
              </div>
              <div className="dropdown-column">
                <h4>KONVERSI DARI PDF</h4>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-jpg">J</span> PDF ke JPG
                </button>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-word">W</span> PDF ke WORD
                </button>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-ppt">P</span> PDF ke POWERPOINT
                </button>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-excel">X</span> PDF ke EXCEL
                </button>
                <button className="dropdown-btn">
                  <span className="doc-icon icon-pdf">A</span> PDF ke PDF/A
                </button>
              </div>
            </div>
          </div>

          {/* Menu Alat Edit */}
          <div className="nav-item has-dropdown">
            SEMUA ALAT PDF <span className="arrow">▼</span>
            <div className="dropdown-menu single-menu">
              <button className={`dropdown-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => handleToolClick('text')}>
                <span className="doc-icon icon-pdf">T</span> Tambah Teks
              </button>
              <button className={`dropdown-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => handleToolClick('draw')}>
                <span className="doc-icon icon-pdf">C</span> Coretan Bebas
              </button>
            </div>
          </div>
        </nav>

        <button className="save-btn" onClick={() => handleToolClick('save')}>
          💾 Simpan File
        </button>
      </header>

      {/* --- AREA KERJA UTAMA --- */}
      <main className="workspace">
        <div className="viewer-container">
          {pdfFile ? (
            <iframe src={pdfFile} width="100%" height="100%" title="PDF Viewer" style={{ border: 'none' }} />
          ) : (
            <div className="empty-state desktop-scene" onClick={triggerUpload}>
              <input type="file" accept="application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
              
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

              <div className="desk-item coffee-cup">☕️</div>
              <div className="desk-item pens">✏️ 🖋️</div>
              
              <div className="message-container">
                <h3>Editor PDF Siap Beraksi</h3>
                <p>Ruang kerja ini sedang menanti sentuhan kreatif Anda.</p>
              </div>
              
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