import React from 'react';
import { Icon } from '../icons/Icon.jsx';
// grey: header Search / Bell (44px, #f2f3f6). white: × on paper / sheets. frosted: over photos. ghost: back chevrons.
const V = {
  grey: { background: 'var(--grey-50)', color: 'var(--ink)', hover: 'var(--grey-100)' },
  white: { background: '#fff', color: 'var(--ink)', boxShadow: '0 2px 8px rgba(13,17,23,.15)', hover: 'var(--grey-50)' },
  frosted: { background: 'var(--frost-light)', color: 'var(--ink)', boxShadow: 'var(--shadow-frosted-btn)', hover: '#fff' },
  dark: { background: 'var(--frost-dark)', color: '#fff', backdrop: 'blur(8px)', hover: 'rgba(13,17,23,.55)' },
  ghost: { background: 'transparent', color: 'var(--ink)', hover: 'var(--grey-50)' },
};
export function IconButton({ icon, label, variant = 'grey', size = 44, iconSize, badge, onClick, style }) {
  const [hov, setHov] = React.useState(false); const v = V[variant] || V.grey;
  return (
    <span role="button" aria-label={label} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: 'relative', flex: '0 0 ' + size + 'px', width: size, height: size, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov ? v.hover : v.background, color: v.color, boxShadow: v.boxShadow, backdropFilter: v.backdrop, WebkitBackdropFilter: v.backdrop, cursor: 'pointer', ...style }}>
      <Icon name={icon} size={iconSize || (icon === 'close' ? Math.round(size * .34) : Math.round(size * .46))} strokeWidth={icon === 'close' ? 2.8 : icon === 'bell' ? 1.9 : 2.2} />
      {badge ? <span style={{ position: 'absolute', top: -3, right: -4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--badge)', color: '#fff', fontSize: 10.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span> : null}
    </span>
  );
}
