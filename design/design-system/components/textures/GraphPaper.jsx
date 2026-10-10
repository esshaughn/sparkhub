import React from 'react';
// Graph paper (#f5f9fe, #dfeaf7 18px grid). sheet = the tilted −1° planning sheet with a soft shadow ("Help make this a plan", "What's left").
// board = the Ideas tab page background (#eceef2 / #dde1e8 grid).
export function GraphPaper({ children, variant = 'sheet', rotate = -1, padding = '18px 16px 12px', gap = 4, style }) {
  if (variant === 'board') return <div style={{ backgroundColor: 'var(--tex-graph-board-bg)', backgroundImage: 'var(--tex-graph-board)', backgroundSize: '18px 18px', ...style }}>{children}</div>;
  return (
    <div style={{ position: 'relative', backgroundColor: 'var(--graph-bg)', backgroundImage: 'var(--tex-graph)', backgroundSize: '18px 18px', borderRadius: 6, padding, display: 'flex', flexDirection: 'column', gap, transform: 'rotate(' + rotate + 'deg)', boxShadow: 'var(--shadow-paper)', ...style }}>
      {children}
    </div>
  );
}
