import React from 'react';
// RSVP before: three tiles (Going · Maybe · Can't), no counts. After: one 54px folded line in the answer's colours + purple Change.
export function RsvpTiles({ value, onPick }) {
  const opts = [['going', value === 'going' ? '✓ Going' : 'I’m going'], ['maybe', 'Maybe'], ['no', 'Can’t make it']];
  const C = { going: ['#149a4b', '#e7f6ec', '#0f7a3c'], maybe: ['#f5b428', '#fdf1d6', '#8f6405'], no: ['#454b55', '#f2f3f6', '#454b55'] };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
      {opts.map(([k, label]) => { const on = value === k, c = C[k], hero = k === 'going' && !value; return (
        <button key={k} onClick={() => onPick && onPick(k)} style={{ minHeight: 54, padding: '0 6px', borderRadius: 999, border: on ? '2px solid ' + c[0] : hero ? 0 : '1.5px solid var(--grey-200)',
          background: on ? (k === 'maybe' ? 'var(--hatch-gold)' : c[1]) : hero ? 'var(--green-500)' : '#fff', color: on ? c[2] : hero ? '#fff' : 'var(--ink)', fontFamily: 'inherit',
          fontSize: k === 'going' ? 16 : 14, fontWeight: 900, whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: hero ? '0 8px 20px rgba(20,154,75,.3)' : 'none' }}>{label}</button>); })}
    </div>
  );
}
const FC = { going: ['#149a4b', '#e7f6ec', '#0f7a3c', 'M5 12.5l4.5 4.5L19 7.5', 'You’re going'], maybe: ['#f5b428', '#fdf1d6', '#8f6405', 'M9.2 9a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.6-2.8 4M12 18h.01', 'You’re a maybe'], no: ['transparent', '#f2f3f6', '#454b55', '', 'You can’t make it'], lead: ['#5b4ae8', '#f3f1fe', '#4a3ad4', '', 'You’re leading'] };
export function RsvpStatus({ value = 'going', label, onChange }) {
  const fc = FC[value] || FC.going;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 54, padding: '0 12px 0 14px', borderRadius: 16, background: fc[1], color: fc[2] }}>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: fc[0], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {value === 'no' ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#454b55" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5" /><path d="M7.8 10.2c.6-.6 1.6-.6 2.2 0M14 10.2c.6-.6 1.6-.6 2.2 0" /><path d="M8.5 16.5c1.9-1.8 5.1-1.8 7 0" /></svg>
          : value === 'lead' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6l1-8.5Z" /></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d={fc[3]} /></svg>}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 900 }}>{label || fc[4]}</span>
      <span role="button" onClick={onChange} style={{ fontSize: 15, fontWeight: 800, color: 'var(--purple-500)', cursor: 'pointer' }}>Change</span>
    </div>
  );
}
