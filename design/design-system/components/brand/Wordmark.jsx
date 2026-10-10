import React from 'react';
// Bolt + "Spark Hub" + BETA chip, as on Welcome. BETA sits beside every wordmark (row) or under it (stacked).
export function Wordmark({ tone = 'dark', stacked = false, size = 18 }) {
  const onDark = tone === 'dark';
  const beta = <span style={{ padding: '4px 8px', borderRadius: 999, background: onDark ? 'rgba(255,255,255,.18)' : 'var(--ink)', color: '#fff', fontSize: 10.5, lineHeight: 1, fontWeight: 900, letterSpacing: '1px' }}>BETA</span>;
  const bolt = <svg width={size * 1.33} height={size * 1.33} viewBox="0 0 24 24" fill="none"><path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z" fill="#f3c55a" stroke="#f3c55a" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
  const word = <span style={{ fontSize: size, lineHeight: 1, fontWeight: 900, letterSpacing: '-.5px', color: onDark ? '#fff' : 'var(--ink)' }}>Spark Hub</span>;
  if (stacked) return <div aria-label="Spark Hub, beta" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>{bolt}{word}{beta}</div>;
  return <div aria-label="Spark Hub, beta" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{bolt}{word}{beta}</div>;
}
