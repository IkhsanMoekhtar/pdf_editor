import React, { useRef } from 'react';
import { Coffee, PenTool, PencilLine } from 'lucide-react';

export default function EmptyState({ onUpload, onNotify }) {
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      onUpload(file);
    } else {
      onNotify?.('Mohon unggah file dengan format PDF.', 'error');
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
          <div className="clipboard-header-skeleton" aria-hidden="true"></div>
          <div className="clipboard-content">
            <div className="empty-line large"></div>
            <div className="empty-line"></div>
            <div className="empty-line medium"></div>
            <div className="empty-line large"></div>
          </div>
        </div>
      </div>
      <div className="desk-item coffee-cup" aria-hidden="true"><Coffee size={32} /></div>
      <div className="desk-item pens" aria-hidden="true"><PencilLine size={30} /><PenTool size={30} /></div>
      <div className="message-container">
        <h3>Taruh PDF di atas meja, lalu mulai menandai.</h3>
        <p>Ruang ini dibuat untuk kerja cepat yang tetap terasa rapi dan manusiawi.</p>
      </div>
    </div>
  );
}