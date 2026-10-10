import React from 'react';
import { Icon } from '../icons/Icon.jsx';
// The group picker pill (All groups ⌄) and the quiet sort control (⇅ Popular ⌄).
export function FilterPill({ label, thumbs = [], quiet = false, icon, onClick }) {
  if (quiet) return (
    <span role="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 38, padding: '0 2px', fontSize: 13, fontWeight: 700, color: 'var(--grey-550)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      <Icon name={icon || 'sort'} size={14} strokeWidth={2.4} /><span style={{ color: 'var(--ink)', fontWeight: 800 }}>{label}</span><Icon name="chevron-down" size={13} strokeWidth={2.8} />
    </span>);
  return (
    <span role="button" aria-haspopup="listbox" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', minHeight: 38, padding: thumbs.length ? '0 10px 0 6px' : '0 10px 0 14px', borderRadius: 999, background: '#fff', boxShadow: 'var(--shadow-ring)', fontSize: 14, fontWeight: 800, color: 'var(--ink)', cursor: 'pointer' }}>
      {thumbs.length ? <span style={{ display: 'flex' }}>{thumbs.slice(0, 3).map((src, i) => <span key={i} style={{ width: 26, height: 26, borderRadius: 999, marginLeft: i ? -8 : 0, boxShadow: '0 0 0 2px #fff', background: 'var(--ink-photo) url(' + src + ') center/cover' }} />)}</span> : null}
      {label}<span style={{ display: 'flex', color: 'var(--grey-600)' }}><Icon name="chevron-down" size={13} strokeWidth={2.8} /></span>
    </span>
  );
}
