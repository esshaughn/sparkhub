import React from 'react';
import { Icon } from '../icons/Icon.jsx';
import { Sparkles } from '../brand/Sparkles.jsx';
const V = {
  primary: { background: 'var(--purple-500)', color: '#fff', hover: 'var(--purple-600)' },
  gold: { background: 'var(--gold-500)', color: 'var(--gold-ink)', hover: 'var(--gold-550)' },
  green: { background: 'var(--green-500)', color: '#fff', hover: '#0f8a42' },
  ink: { background: 'var(--ink)', color: '#fff', hover: '#1d232c' },
  white: { background: '#fff', color: 'var(--ink)', hover: 'var(--grey-50)' },
  outline: { background: '#fff', color: 'var(--purple-500)', boxShadow: 'inset 0 0 0 2px var(--purple-500)', hover: 'var(--purple-25)' },
  outlineGold: { background: '#fff', color: 'var(--gold-700)', boxShadow: 'inset 0 0 0 2px var(--gold-500)', hover: 'var(--gold-75)' },
  soft: { background: 'var(--grey-50)', color: 'var(--ink)', hover: 'var(--grey-100)' },
  pink: { background: 'var(--pink-50)', color: 'var(--pink-500)', hover: 'var(--pink-100)' },
  gradient: { background: 'var(--grad-spark-cta)', color: '#fff', hover: null },
  text: { background: 'transparent', color: 'var(--purple-500)', hover: null },
  danger: { background: 'transparent', color: 'var(--red-700)', hover: null },
};
const S = { lg: [54, 17, 900, '0 22px'], md: [48, 16, 800, '0 20px'], sm: [36, 14, 800, '0 14px'] };
export function Button({ children, variant = 'primary', size = 'lg', icon, iconRight, full = false, disabled = false, sparkles, onClick, type = 'button', style }) {
  const [hov, setHov] = React.useState(false);
  const v = V[variant] || V.primary; const s = S[size] || S.lg;
  const isText = variant === 'text' || variant === 'danger';
  const bg = disabled ? 'var(--grey-250)' : hov && v.hover ? v.hover : v.background;
  const st = { position: 'relative', overflow: 'hidden', display: full ? 'flex' : 'inline-flex', width: full ? '100%' : undefined, alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: isText ? 40 : s[0], padding: isText ? '0 4px' : s[3], border: 0, borderRadius: 999, background: bg, color: disabled ? '#fff' : v.color,
    boxShadow: disabled ? 'none' : v.boxShadow, fontFamily: 'inherit', fontSize: s[1], fontWeight: isText ? 800 : s[2], whiteSpace: 'nowrap',
    cursor: disabled ? 'default' : 'pointer', filter: variant === 'gradient' && hov ? 'brightness(1.05)' : 'none', transition: 'background .15s', ...style };
  const showSparkles = sparkles ?? variant === 'gradient';
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={st} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {showSparkles && !disabled ? <Sparkles preset="button" /> : null}
      {icon ? <Icon name={icon} size={s[1] + 3} strokeWidth={2.4} /> : null}
      <span style={{ position: 'relative' }}>{children}</span>
      {iconRight ? <Icon name={iconRight} size={s[1] - 2} strokeWidth={2.8} /> : null}
    </button>
  );
}
