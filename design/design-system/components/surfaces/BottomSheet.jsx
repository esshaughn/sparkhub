import React from 'react';
import { IconButton } from '../actions/IconButton.jsx';
// Slide-up sheet: scrim rgba(13,17,23,.45), grey #e8eaee body, 24px top corners, 40×5 grab handle, white sticky header.
// Positioned absolute inside the 393×852 phone frame. top = distance from the top of the screen (44–64px typical).
export function BottomSheet({ open = true, title, eyebrow, eyebrowColor = 'var(--gold-700)', top = 64, onClose, children, footer }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'var(--scrim)', animation: 'scrimIn 180ms ease-out both' }} />
      <div role="dialog" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top, zIndex: 41, background: 'var(--surface-page)', borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'sheetUp 260ms var(--ease-out) both' }}>
        <header style={{ position: 'relative', background: '#fff', padding: '26px 16px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 40, height: 5, borderRadius: 999, background: 'var(--grey-200)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow ? <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '1px', color: eyebrowColor }}>{eyebrow}</div> : null}
            <h3 style={{ margin: eyebrow ? '2px 0 0' : 0, fontSize: 22, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-.5px', color: 'var(--ink)' }}>{title}</h3>
          </div>
          <IconButton icon="close" label="Close" size={40} onClick={onClose} />
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 30px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
        {footer ? <div style={{ background: '#fff', borderTop: '1px solid var(--border-hairline)', padding: '12px 16px 30px' }}>{footer}</div> : null}
      </div>
    </>
  );
}
