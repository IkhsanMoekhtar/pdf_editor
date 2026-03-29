import React from 'react';

export default function TextOverlay({ texts, setTexts, pageNumber, activeTool }) {
  // Hanya tampilkan teks untuk halaman yang sedang aktif
  const pageTexts = texts.filter(t => t.page === pageNumber);

  const updateText = (id, newProps) => {
    setTexts(texts.map(t => t.id === id ? { ...t, ...newProps } : t));
  };

  const removeText = (id) => {
    setTexts(texts.filter(t => t.id !== id));
  };

  return (
    <>
      {pageTexts.map(t => (
        <div
          key={t.id}
          style={{
            position: 'absolute',
            left: `${t.x}px`,
            top: `${t.y}px`,
            // Geser sedikit ke atas agar posisi mouse pas dengan tengah teks
            transform: `translateY(-50%)`, 
            zIndex: 30,
          }}
        >
          {t.isEditing ? (
            <input
              autoFocus
              type="text"
              value={t.text}
              placeholder="Ketik teks..."
              onChange={(e) => updateText(t.id, { text: e.target.value })}
              onBlur={() => {
                // Hapus jika kosong saat user klik di luar, jika tidak simpan
                if (!t.text.trim()) removeText(t.id);
                else updateText(t.id, { isEditing: false });
              }}
              style={{
                fontSize: `${t.size}px`,
                color: t.color,
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px dashed #3b82f6',
                borderRadius: '4px',
                outline: 'none',
                minWidth: '100px',
                padding: '2px 4px',
                fontFamily: 'Helvetica, Arial, sans-serif'
              }}
            />
          ) : (
            <div
              onClick={(e) => {
                if (activeTool === 'text') {
                  e.stopPropagation(); // Cegah membuat teks baru di belakangnya
                  updateText(t.id, { isEditing: true });
                }
              }}
              style={{
                fontSize: `${t.size}px`,
                color: t.color,
                whiteSpace: 'pre',
                fontFamily: 'Helvetica, Arial, sans-serif',
                cursor: activeTool === 'text' ? 'text' : 'default',
                padding: '3px 5px',
                border: activeTool === 'text' ? '1px solid transparent' : 'none',
              }}
              title={activeTool === 'text' ? 'Klik untuk edit' : ''}
            >
              {t.text}
            </div>
          )}
        </div>
      ))}
    </>
  );
}