import React from 'react';
import { Icon } from '../icons/Icon.jsx';
// Groups → "Next up" row card: 20px radius, 56px photo, green NEXT UP eyebrow.
export function NextUpCard({ photo, when, title, sub, onClick }) {
  return (
    <div role="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 10px', borderRadius: 20, background: '#fff', boxShadow: 'var(--shadow-card)', cursor: 'pointer' }}>
      <span style={{ flex: '0 0 56px', width: 56, height: 56, borderRadius: 14, background: 'var(--ink-photo) url(' + photo + ') center/cover' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ color: 'var(--green-500)' }}>NEXT UP</span><span style={{ color: 'var(--grey-550)' }}> · {when}</span></span>
        <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-.3px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--grey-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </div>
      <Icon name="chevron-right" size={16} color="var(--grey-400)" strokeWidth={2.6} />
    </div>
  );
}
