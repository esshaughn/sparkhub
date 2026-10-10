import React from 'react';
// Text field: white, 1.5px #dcdfe6 inset ring, 14px corners, 16px text (never smaller — iPhone zoom). Placeholders italic #b9bcc4.
export function Field({ label, optional = false, value, placeholder, onChange, multiline = false, height, counter, max }) {
  const [focus, setFocus] = React.useState(false);
  const common = { width: '100%', border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, color: 'var(--ink)', resize: 'none' };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label ? <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, fontWeight: 900, letterSpacing: '1.1px', color: 'var(--grey-700)' }}>{label}{optional ? <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0, color: 'var(--grey-500)' }}>Optional</span> : null}</span> : null}
      <span style={{ position: 'relative', display: 'flex', alignItems: multiline ? 'flex-start' : 'center', minHeight: height || (multiline ? 132 : 52), padding: multiline ? '14px' : '0 14px', borderRadius: 14, background: '#fff', boxShadow: focus ? 'inset 0 0 0 2px var(--purple-500), var(--shadow-focus)' : 'var(--shadow-ring)' }}>
        {multiline ? <textarea value={value} placeholder={placeholder} onChange={onChange} maxLength={max} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={{ ...common, minHeight: (height || 132) - 28 }} />
          : <input value={value} placeholder={placeholder} onChange={onChange} maxLength={max} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={{ ...common, height: 48 }} />}
        {counter ? <span style={{ position: 'absolute', right: 12, bottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--grey-400)' }}>{counter}</span> : null}
      </span>
    </label>
  );
}
// iOS-style toggle: 46×28 track, green when on.
export function Toggle({ on = false, onChange }) {
  return <span role="switch" aria-checked={on} onClick={() => onChange && onChange(!on)} style={{ flex: '0 0 46px', width: 46, height: 28, borderRadius: 999, background: on ? 'var(--green-500)' : 'var(--grey-200)', position: 'relative', transition: 'background 160ms', cursor: 'pointer' }}><span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left 160ms' }} /></span>;
}
// Square checkbox (Post to: rounded squares). tone gold = the 30px date-vote box.
export function Checkbox({ checked = false, tone = 'purple', size = 22, onChange }) {
  const c = tone === 'gold' ? 'var(--gold-500)' : 'var(--purple-500)';
  return <span role="checkbox" aria-checked={checked} onClick={() => onChange && onChange(!checked)} style={{ flex: '0 0 ' + size + 'px', width: size, height: size, borderRadius: Math.round(size * .3), background: checked ? c : '#fff', boxShadow: checked ? 'none' : 'inset 0 0 0 1.6px ' + (tone === 'gold' ? 'var(--gold-600)' : 'var(--grey-500)'), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{checked ? <svg width={size * .55} height={size * .55} viewBox="0 0 24 24" fill="none" stroke={tone === 'gold' ? '#2a1d00' : '#fff'} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}</span>;
}
