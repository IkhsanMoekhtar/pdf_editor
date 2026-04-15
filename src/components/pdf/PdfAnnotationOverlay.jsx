import React from 'react';

export default function PdfAnnotationOverlay({
  activeTool,
  rotation,
  originalPageSize,
  pageDrawings,
  currentDrawing,
  drawColor,
  drawThickness,
  pageTexts,
  makeSvgPath,
  handleSvgPointerDown,
  handleDrawMove,
  handleDrawEnd,
  setTexts,
  texts,
}) {
  if (!originalPageSize) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: activeTool === 'draw' || activeTool === 'text' ? 'auto' : 'none',
        cursor: activeTool === 'draw' ? 'crosshair' : activeTool === 'text' ? 'text' : 'default',
        touchAction: activeTool === 'draw' || activeTool === 'text' ? 'none' : 'auto',
        transform: `rotate(${rotation}deg)`,
        aspectRatio: rotation === 90 || rotation === 270
          ? `${originalPageSize.height}/${originalPageSize.width}`
          : 'auto',
      }}
      viewBox={`0 0 ${originalPageSize.width} ${originalPageSize.height}`}
      onPointerDown={handleSvgPointerDown}
      onPointerMove={handleDrawMove}
      onPointerUp={handleDrawEnd}
      onPointerLeave={handleDrawEnd}
    >
      {pageDrawings.map((d, idx) => (
        <path
          key={idx}
          d={makeSvgPath(d.path)}
          fill="none"
          stroke={d.color || 'red'}
          strokeWidth={d.thickness || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {currentDrawing && (
        <path
          d={makeSvgPath(currentDrawing)}
          fill="none"
          stroke={drawColor}
          strokeWidth={drawThickness}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {pageTexts.map((t) =>
        t.isEditing ? (
          <foreignObject
            key={t.id}
            x={t.x}
            y={t.y - t.size}
            width="100%"
            height={t.size * 3}
          >
            <input
              autoFocus
              type="text"
              value={t.text}
              onChange={(e) =>
                setTexts(texts.map((txt) => (txt.id === t.id ? { ...txt, text: e.target.value } : txt)))
              }
              onBlur={() => {
                if (!t.text.trim()) setTexts(texts.filter((txt) => txt.id !== t.id));
                else setTexts(texts.map((txt) => (txt.id === t.id ? { ...txt, isEditing: false } : txt)));
              }}
              style={{
                fontSize: `${t.size}px`,
                color: t.color,
                background: 'transparent',
                border: '1px dashed #3b82f6',
                outline: 'none',
                fontFamily: 'Helvetica, Arial, sans-serif',
                width: 'max-content',
                minWidth: '50px',
              }}
            />
          </foreignObject>
        ) : (
          <text
            key={t.id}
            x={t.x}
            y={t.y}
            fontSize={t.size}
            fill={t.color}
            fontFamily="Helvetica, Arial, sans-serif"
            onPointerDown={(e) => {
              if (activeTool === 'text') {
                e.stopPropagation();
                setTexts(texts.map((txt) => (txt.id === t.id ? { ...txt, isEditing: true } : txt)));
              }
            }}
            style={{ cursor: activeTool === 'text' ? 'text' : 'default', userSelect: 'none' }}
          >
            {t.text}
          </text>
        ),
      )}
    </svg>
  );
}
