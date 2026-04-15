import React from 'react';
import {
  MousePointer2,
  Palette,
  PenTool,
  Redo2,
  RotateCcw,
  RotateCw,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export default function PdfViewerToolbar({
  activeTool,
  setActiveTool,
  renderScale,
  isZoomMode,
  setIsZoomMode,
  handleZoomStep,
  isLowPerformanceMode,
  setIsLowPerformanceMode,
  onRotateLeft,
  onRotateRight,
  textColor,
  setTextColor,
  textSize,
  setTextSize,
  drawColor,
  setDrawColor,
  drawThickness,
  setDrawThickness,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
}) {
  return (
    <div className="floating-action-bar viewer-action-bar">
      <p className="viewer-zoom-label">{(renderScale * 100).toFixed(0)}%</p>

      <button
        className={`action-btn viewer-action-btn viewer-scroll-zoom-btn ${isZoomMode ? 'active' : ''}`}
        onClick={() => setIsZoomMode(!isZoomMode)}
        title="Mode gulir untuk memperbesar dan memperkecil"
        aria-label="Toggle mode scroll zoom"
      >
        <MousePointer2 size={16} />
      </button>

      <button className="action-btn viewer-action-btn" onClick={() => handleZoomStep(-0.1)} title="Perkecil zoom">
        <ZoomOut size={16} />
      </button>

      <button className="action-btn viewer-action-btn" onClick={() => handleZoomStep(0.1)} title="Perbesar zoom">
        <ZoomIn size={16} />
      </button>

      <button
        className={`action-btn viewer-action-btn ${isLowPerformanceMode ? 'active' : ''}`}
        onClick={() => setIsLowPerformanceMode((prev) => !prev)}
        title="Mode ringan untuk perangkat lambat"
      >
        {isLowPerformanceMode ? 'Mode ringan: aktif' : 'Mode ringan: nonaktif'}
      </button>

      <div className="viewer-divider" />

      <button className="action-btn" onClick={onRotateLeft} title="Putar ke kiri">
        <RotateCcw size={16} />
      </button>
      <button className="action-btn" onClick={onRotateRight} title="Putar ke kanan">
        <RotateCw size={16} />
      </button>

      <div className="viewer-divider" />

      <button className={`action-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => setActiveTool((prev) => (prev === 'text' ? null : 'text'))} style={{ gap: '6px' }}>
        <Type size={16} /> Teks
      </button>
      <button className={`action-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => setActiveTool((prev) => (prev === 'draw' ? null : 'draw'))} style={{ gap: '6px' }}>
        <PenTool size={16} /> Coret
      </button>

      {activeTool === 'text' && (
        <div className="viewer-tool-options">
          <input
            type="color"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
            className="viewer-color-input"
            title="Pilih Warna Teks"
          />

          <div className="viewer-size-control">
            <span>Size:</span>
            <input
              type="number"
              min="10"
              max="72"
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              className="viewer-number-input"
            />
          </div>
        </div>
      )}

      {activeTool === 'draw' && (
        <div className="viewer-tool-options">
          <Palette size={16} color="#6b7280" />
          <input
            type="color"
            value={drawColor}
            onChange={(e) => setDrawColor(e.target.value)}
            className="viewer-color-input"
            title="Pilih Warna Coretan"
          />

          <div className="viewer-thickness-control">
            <span className="viewer-dot-small" />
            <input
              type="range"
              min="1"
              max="12"
              value={drawThickness}
              onChange={(e) => setDrawThickness(Number(e.target.value))}
              className="viewer-range-input"
            />
            <span className="viewer-dot-large" />
          </div>
        </div>
      )}

      {activeTool === 'draw' && (
        <>
          <button className="action-btn" onClick={handleUndo} title="Undo Coretan" disabled={!canUndo}>
            <Undo2 size={16} />
          </button>
          <button className="action-btn" onClick={handleRedo} title="Redo Coretan" disabled={!canRedo}>
            <Redo2 size={16} />
          </button>
        </>
      )}
    </div>
  );
}
