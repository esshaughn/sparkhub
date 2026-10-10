import React from 'react';
import { Icon } from '../icons/Icon.jsx';
import { Sparkles } from '../brand/Sparkles.jsx';
// Cards on the purple→pink→amber Spark gradient, always with small white sparkles.
// kind: allGroups (22px padding, round group photos) · startHere (40px frosted bolt tile) · impact (52px pill: "4 led · 6 helped · 2 attended").
export function GradientCard({ kind = 'allGroups', title, sub, thumbs = [], stats = [], onClick }) {
  if (kind === 'impact') return (
    <div role="button" onClick={onClick} style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 6, minHeight: 52, padding: '0 10px 0 20px', borderRadius: 999, color: '#fff', cursor: 'pointer', background: 'var(--grad-impact)', boxShadow: '0 4px 14px rgba(91,74,232,.25)' }}>
      <Sparkles preset="pill" />
      <span style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'baseline', gap: 12 }}>{stats.map(([n, w], i) => <span key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}><b style={{ fontSize: 20, fontWeight: 900 }}>{n}</b><span style={{ fontSize: 14, fontWeight: 700 }}>{w}</span></span>)}</span>
      <span style={{ position: 'relative', width: 32, height: 32, borderRadius: 999, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-right" size={14} strokeWidth={2.8} /></span>
    </div>);
  const start = kind === 'startHere';
  return (
    <div role="button" onClick={onClick} style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12, padding: start ? '14px 12px 14px 14px' : '22px 16px', borderRadius: 20, background: start ? 'var(--grad-spark-soft)' : 'var(--grad-spark)', color: '#fff', cursor: 'pointer', boxShadow: start ? 'none' : 'var(--shadow-gradient-card)' }}>
      <Sparkles preset={start ? 'soft' : 'card'} />
      {start ? <span style={{ position: 'relative', flex: '0 0 40px', width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bolt" size={20} color="#ffd166" /></span>
        : <span style={{ position: 'relative', display: 'flex' }}>{thumbs.slice(0, 3).map((src, i) => <span key={i} style={{ width: 34, height: 34, marginLeft: i ? -10 : 0, borderRadius: 999, boxShadow: '0 0 0 2px rgba(255,255,255,.9)', background: 'var(--ink-photo) url(' + src + ') center/cover' }} />)}{thumbs.length > 3 ? <span style={{ width: 34, height: 34, marginLeft: -10, borderRadius: 999, background: 'rgba(255,255,255,.25)', boxShadow: '0 0 0 2px rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>+{thumbs.length - 3}</span> : null}</span>}
      <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: start ? 0 : 2 }}>
        <span style={{ fontSize: start ? 17 : 19, fontWeight: 900, letterSpacing: start ? 0 : '-.4px' }}>{title}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, opacity: .92 }}>{sub}</span>
      </div>
      <Icon name={start ? 'chevron-right' : 'arrow-right'} size={start ? 16 : 20} strokeWidth={2.6} style={{ position: 'relative' }} />
    </div>);
}
