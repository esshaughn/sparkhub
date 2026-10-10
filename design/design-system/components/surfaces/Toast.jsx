import React from 'react';
// Ink toast above the tab bar. kind: ok (green tick) · soon (amber triangle, for REQUEST / not-built) · err (red !).
export function Toast({ children, kind = 'ok', action, onAction, floating = false }) {
  const icon = kind === 'err'
    ? <span style={{ flex: '0 0 18px', width: 18, height: 18, borderRadius: 999, background: 'var(--badge)', color: '#fff', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</span>
    : kind === 'soon'
      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 18px' }}><path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" fill="#f5b428" /><path d="M12 9v4.5" stroke="#3d2a00" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="16.8" r="1.3" fill="#3d2a00" /></svg>
      : <span style={{ flex: '0 0 18px', width: 18, height: 18, borderRadius: 999, background: 'var(--green-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg></span>;
  const body = (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: '100%', background: 'var(--ink)', borderRadius: 14, padding: action ? '10px 10px 10px 14px' : '13px 16px', boxShadow: 'var(--shadow-toast)', animation: 'popIn 240ms var(--ease-pop) both' }}>
      {icon}<span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{children}</span>
      {action ? <span role="button" onClick={onAction} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', minHeight: 36, padding: '0 14px', borderRadius: 999, background: 'var(--purple-500)', color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>{action}</span> : null}
    </div>);
  if (!floating) return body;
  return <div style={{ position: 'absolute', left: 14, right: 14, bottom: 85, zIndex: 40, display: 'flex', justifyContent: 'center' }}>{body}</div>;
}
