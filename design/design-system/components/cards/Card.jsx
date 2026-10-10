import React from 'react';
// White card on the grey page. tone: white (default) · empty (#dfe2e7 until filled) · goldTop (3px gold top, NEEDS A LEAD) · goldSoft (#fdf6e3) · dark (ink).
export function Card({ children, tone = 'white', radius = 18, padding = 16, gap = 12, onClick, style }) {
  const T = { white: ['#fff', 'var(--shadow-card)'], empty: ['var(--surface-empty)', 'none'], goldTop: ['#fff', 'inset 0 3px 0 var(--gold-500), var(--shadow-card)'], goldSoft: ['var(--gold-75)', 'none'], dark: ['var(--ink)', 'none'] }[tone] || ['#fff', 'var(--shadow-card)'];
  return <div onClick={onClick} role={onClick ? 'button' : undefined} style={{ background: T[0], color: tone === 'dark' ? '#fff' : undefined, borderRadius: radius, boxShadow: T[1], padding, display: 'flex', flexDirection: 'column', gap, cursor: onClick ? 'pointer' : undefined, ...style }}>{children}</div>;
}
// Eyebrow label above a section ("NO DATE YET · 3", "WHERE IT GOES").
export function SectionLabel({ children, color = 'var(--grey-700)' }) {
  return <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '1.1px', textTransform: 'uppercase', color }}>{children}</div>;
}
