import React, { useState } from 'react';

function App() {
  // --- STATE (Ingatan Komponen) ---
  // pdfFile menyimpan file PDF yang diunggah agar bisa ditampilkan
  const [pdfFile, setPdfFile] = useState(null);
  // activeTool mengingat alat apa yang sedang diklik (teks, gambar, dll)
  const [activeTool, setActiveTool] = useState(null);

  // --- FUNGSI-FUNGSI ---
  // Fungsi ini berjalan saat Anda memilih file dari komputer
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      // Membuat URL sementara agar browser bisa membaca file lokal
      const fileUrl = URL.createObjectURL(file);
      setPdfFile(fileUrl);
    } else {
      alert("Mohon unggah file dengan format PDF.");
    }
  };

  // Fungsi untuk menangani klik pada toolbar
  const handleToolClick = (toolName) => {
    setActiveTool(toolName);
    if (toolName === 'save') {
      alert("Ini akan mengirim file ke backend Golang nanti!");
      setActiveTool(null);
    }
  };

  // --- DESAIN TAMPILAN (CSS INLINE) ---
  const styles = {
    container: { display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6' },
    sidebar: { width: '250px', backgroundColor: '#1f2937', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' },
    main: { flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' },
    button: (isActive) => ({
      padding: '10px 15px',
      backgroundColor: isActive ? '#3b82f6' : '#374151',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      textAlign: 'left',
      fontWeight: 'bold',
      transition: 'background 0.2s'
    }),
    uploadLabel: {
      padding: '15px', backgroundColor: '#10b981', color: 'white', textAlign: 'center',
      borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px'
    },
    viewerContainer: {
      flex: 1, backgroundColor: 'white', borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden',
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }
  };

  // --- RENDER UI (Mirip HTML) ---
  return (
    <div style={styles.container}>
      
      {/* BAGIAN KIRI: TOOLBAR */}
      <div style={styles.sidebar}>
        <h2 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>PDF Editor</h2>
        
        {/* Tombol Upload (Disembunyikan input aslinya, diganti label agar rapi) */}
        <label style={styles.uploadLabel}>
          Unggah Dokumen PDF
          <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
        </label>

        <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '0' }}>Alat Edit:</p>
        <button style={styles.button(activeTool === 'text')} onClick={() => handleToolClick('text')}>
          ✍️ Tambah Teks
        </button>
        <button style={styles.button(activeTool === 'draw')} onClick={() => handleToolClick('draw')}>
          🖌️ Coretan Bebas
        </button>
        <button style={styles.button(activeTool === 'highlight')} onClick={() => handleToolClick('highlight')}>
          🖍️ Highlight
        </button>
        
        <div style={{ marginTop: 'auto' }}>
          <button style={{...styles.button(false), backgroundColor: '#ef4444', width: '100%'}} onClick={() => handleToolClick('save')}>
            💾 Simpan & Proses
          </button>
        </div>
      </div>

      {/* BAGIAN KANAN: AREA KERJA (VIEWER) */}
      <div style={styles.main}>
        <div style={styles.viewerContainer}>
          {/* Logika: Jika pdfFile ada isinya, tampilkan PDF. Jika kosong, tampilkan teks. */}
          {pdfFile ? (
            <iframe 
              src={pdfFile} 
              width="100%" 
              height="100%" 
              title="PDF Viewer"
              style={{ border: 'none' }}
            />
          ) : (
            <div style={{ color: '#9ca3af', textAlign: 'center' }}>
              <h3>Belum ada dokumen</h3>
              <p>Silakan unggah file PDF melalui menu di samping kiri.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default App;