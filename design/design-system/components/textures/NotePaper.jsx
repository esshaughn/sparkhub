import React from 'react';
// Cream lined note paper (#fffdf5, rule #ece6d2 every 22px). torn = the organic torn bottom edge. handle = the #d8d2bd grab bar of an idea slide-up.
export function NotePaper({ children, torn = true, handle = false, padding = '34px 16px 28px', gap = 12, style }) {
  return (
    <div style={{ position: 'relative', backgroundColor: 'var(--paper)', backgroundImage: 'var(--tex-note)', padding, display: 'flex', flexDirection: 'column', gap,
      filter: torn ? 'drop-shadow(0 1px 1px rgba(13,17,23,.08))' : undefined, clipPath: torn ? 'var(--torn-edge)' : undefined, ...style }}>
      {handle ? <span aria-hidden="true" style={{ position: 'absolute', top: 9, left: '50%', marginLeft: -20, width: 40, height: 5, borderRadius: 999, background: 'var(--paper-handle)' }} /> : null}
      {children}
    </div>
  );
}
// A photo pinned onto the paper as a snapshot: 6px white border, soft shadow, tilted 1–3°.
export function Snapshot({ src, width = 150, height = 110, rotate = -2 }) {
  return <div style={{ alignSelf: 'flex-start', padding: 6, background: '#fff', boxShadow: 'var(--shadow-snapshot)', transform: 'rotate(' + rotate + 'deg)' }}><div style={{ width, height, background: 'var(--ink-photo) url(' + src + ') center/cover' }} /></div>;
}
