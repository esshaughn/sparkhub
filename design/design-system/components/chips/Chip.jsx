import React from 'react';
// Choice chip / filter pill. Picked = solid ink with white text; unpicked = white with a 1.5px #dcdfe6 ring.
// size md = 38px (Feedback kinds, TYPE tags), sm = 36px (list filter row), xs = 32px (time chips, purple when picked).
export function Chip({ children, selected = false, size = 'md', tone = 'ink', dashed = false, onClick }) {
  const h = size === 'xs' ? 32 : size === 'sm' ? 36 : 38;
  const onBg = tone === 'purple' ? 'var(--purple-500)' : tone === 'gold' ? 'var(--gold-500)' : 'var(--ink)';
  const onInk = tone === 'gold' ? 'var(--gold-ink)' : '#fff';
  return (
    <span role="button" aria-pressed={selected} onClick={onClick}
      style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: h, padding: size === 'xs' ? '0 12px' : '0 14px', borderRadius: 999,
        fontSize: size === 'xs' ? 13 : 14, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer',
        background: selected ? onBg : dashed ? 'transparent' : '#fff', color: selected ? onInk : 'var(--grey-700)',
        boxShadow: selected || dashed ? 'none' : 'inset 0 0 0 1.5px ' + (size === 'xs' ? 'var(--grey-250)' : 'var(--grey-200)'),
        border: dashed && !selected ? '1.5px dashed var(--grey-350)' : 0 }}>
      {children}
    </span>
  );
}
// One row of chips that runs off the right edge and scrolls sideways (no wrap, no scrollbar).
export function ChipRow({ children, style }) {
  return <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', ...style }}>{children}</div>;
}
