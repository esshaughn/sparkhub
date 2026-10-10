import React from 'react';
import { Icon } from '../icons/Icon.jsx';
// Bottom bar: Groups · Friends · Calendar · Ideas · Me. Flat 24px icons, 1.9 stroke, active = purple, others #6b7280. 84px, frosted white.
const TABS = [['groups', 'Groups', 'grid'], ['friends', 'Friends', 'people'], ['calendar', 'Calendar', 'calendar'], ['ideas', 'Ideas', 'bulb'], ['me', 'Me', 'person']];
export function TabBar({ active = 'groups', onChange, dots = {}, floating = false }) {
  return (
    <nav style={{ position: floating ? 'absolute' : 'relative', left: 0, right: 0, bottom: 0, height: 84, display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', alignItems: 'start', justifyItems: 'center', background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid #e8eaef', padding: '0 8px 26px', zIndex: 10 }}>
      {TABS.map(([k, label, icon]) => (
        <div key={k} role="button" aria-label={label} onClick={() => onChange && onChange(k)} style={{ paddingTop: 8, minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%', color: active === k ? 'var(--purple-500)' : 'var(--grey-600)', cursor: 'pointer' }}>
          <span style={{ position: 'relative', display: 'flex' }}>
            <Icon name={k === 'friends' ? 'group' : icon} size={24} strokeWidth={1.9} />
            {dots[k] ? <span style={{ position: 'absolute', top: -2, right: -4, width: 10, height: 10, borderRadius: 999, background: k === 'ideas' ? 'var(--gold-500)' : 'var(--purple-500)', border: '2px solid #fff' }} /> : null}
          </span>
          <span style={{ fontSize: 11.5, lineHeight: '13px', fontWeight: 600, letterSpacing: '-.1px', whiteSpace: 'nowrap' }}>{label}</span>
        </div>))}
    </nav>
  );
}
