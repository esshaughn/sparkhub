import React from 'react';
// Round photo face; falls back to an initial on a tinted disc. FaceStack overlaps faces with a white ring.
export function Face({ src, name = '', size = 28, ring = false, grey = false }) {
  return (
    <span title={name} style={{ flex: '0 0 ' + size + 'px', width: size, height: size, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: grey ? 'var(--grey-200)' : src ? 'var(--grey-200) url(' + src + ') center/cover' : 'var(--purple-100)', color: 'var(--purple-600)',
      fontSize: Math.round(size * .4), fontWeight: 900, boxShadow: ring ? '0 0 0 2px #fff' : 'none' }}>{!src && !grey ? name.slice(0, 1) : null}</span>
  );
}
export function FaceStack({ faces = [], size = 28, max = 4, label }) {
  const shown = faces.slice(0, max);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'flex' }}>{shown.map((f, i) => <span key={i} style={{ marginLeft: i ? -Math.round(size * .3) : 0 }}><Face {...f} size={size} ring /></span>)}</span>
      {label ? <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--grey-700)' }}>{label}</span> : null}
    </span>
  );
}
