import React from 'react';
import { Icon } from '../icons/Icon.jsx';
import { Tag } from '../chips/Tag.jsx';
// Event photo card with the role strip under it. Strip colours per role (TH table in v8):
const TH = { lead: ['#f7f6ff', '#4a3ad4', '#5b4ae8'], helping: ['#fff6f0', '#b8480c', '#e8661c'], going: ['#f3fbf6', '#0f7a3c', '#149a4b'],
  maybe: ['repeating-linear-gradient(-45deg,#f7fcf9 0 5px,#e9f6ee 5px 10px)', '#2f6e49', '#a9d6ba'], open: ['#fafafb', '#454b55', '#c3c7d0'], idea: ['#fefaef', '#8f6405', '#e8a71c'] };
const DATE_INK = { lead: '#cfc9ff', helping: '#ffb98a', maybe: '#ffd77a', going: '#9eecbc', open: '#fff', idea: '#ffd77a' };
export function EventCard({ photo, dateLine, title, place, role = 'open', stripLeft, stripRight, countdown, today = false, priv = false, height = 170, onClick }) {
  const T = TH[role] || TH.open;
  return (
    <div role="button" onClick={onClick} style={{ borderRadius: 18, overflow: 'hidden', background: '#fff', boxShadow: 'var(--shadow-card)', cursor: 'pointer' }}>
      <div style={{ position: 'relative', height, background: 'var(--ink-photo) url(' + photo + ') center/cover' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--scrim-photo-bottom)' }} />
        {priv ? <span style={{ position: 'absolute', top: 12, left: 14 }}><Tag kind="frosted" icon="lock">Private</Tag></span> : null}
        {today ? <span style={{ position: 'absolute', top: 12, right: 14 }}><Tag kind="today" /></span> : countdown ? <span style={{ position: 'absolute', top: 12, right: 14 }}><Tag kind="frosted">{countdown}</Tag></span> : null}
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.3)' }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.3px', color: DATE_INK[role] }}>{dateLine}</div>
          <div style={{ marginTop: 3, fontSize: 25, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-.6px', textWrap: 'balance' }}>{title}</div>
          {place ? <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14.5, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}><Icon name="pin" size={13} strokeWidth={2.6} />{place}</div> : null}
        </div>
      </div>
      {stripLeft || stripRight ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, height: 34, padding: '0 14px', background: T[0], color: T[1], fontSize: 12.5, fontWeight: 800 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: T[2] }} />{stripLeft}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12 }}>{stripRight}<Icon name="chevron-right" size={11} strokeWidth={3} /></span>
        </div>) : null}
    </div>
  );
}
