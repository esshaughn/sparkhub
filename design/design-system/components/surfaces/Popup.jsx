import React from 'react';
import { IconButton } from '../actions/IconButton.jsx';
// Centred pop-up card: max 353px, 24px radius, fits content up to 88% then scrolls. Fade-and-grow in (popIn 220ms). No grab bar.
export function Popup({ open = true, title, sub, onClose, children, inline = false }) {
  if (!open) return null;
  const card = (
    <div role="dialog" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 353, maxHeight: '88%', overflow: 'auto', borderRadius: 24, background: '#fff', padding: '22px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: 'var(--shadow-popup)', animation: 'popIn 220ms var(--ease-out) both' }}>
      {onClose ? <span style={{ position: 'absolute', top: 12, right: 12 }}><IconButton icon="close" label="Close" size={40} onClick={onClose} /></span> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 40, marginBottom: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.4px', color: 'var(--ink)' }}>{title}</span>
        {sub ? <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--grey-700)', textWrap: 'pretty' }}>{sub}</span> : null}
      </div>
      {children}
    </div>);
  if (inline) return card;
  return <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 45, background: 'var(--scrim-popup)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'scrimIn 200ms ease-out both' }}>{card}</div>;
}
