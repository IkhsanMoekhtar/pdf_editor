import React, { useRef } from 'react';

export default function EmptyState({ onUpload }) {
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      onUpload(file);
    } else {
      alert("Mohon unggah file dengan format PDF.");
    }
  };

  const triggerUpload = () => fileInputRef.current.click();

  return (
    <div className="empty-state desktop-scene" onClick={triggerUpload} style={{ cursor: 'pointer' }}>
      <input 
        type="file" 
        accept="application/pdf" 
        style={{ display: 'none' }} 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
      />
      <div className="clipboard">
        <div className="clipboard-paper">
          <div className="clipboard-header">Your Paper</div>
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
    </div>
  );
}