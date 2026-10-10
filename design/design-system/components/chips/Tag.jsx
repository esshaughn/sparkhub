import React from 'react';
import { Icon } from '../icons/Icon.jsx';
// Small status chips. Every kind is copied from a specific spot in v8.
const K = {
  request: { bg: 'var(--gold-50)', fg: 'var(--gold-700)', fs: 10.5, ls: '.6px', pad: '2px 7px', text: 'REQUEST' },
  beta: { bg: 'var(--ink)', fg: '#fff', fs: 10.5, ls: '1px', pad: '4px 8px', text: 'BETA' },
  idea: { bg: 'var(--gold-mark)', fg: 'var(--gold-ink-2)', fs: 11.5, ls: '.9px', pad: '5px 12px', text: 'IDEA' },
  ideaPaper: { bg: 'var(--gold-500)', fg: 'var(--gold-ink-2)', fs: 14, ls: '1.4px', pad: '6px 12px', radius: 8, icon: 'bulb', text: 'IDEA' },
  update: { bg: 'var(--pink-500)', fg: '#fff', fs: 10, ls: '.7px', pad: '0 7px', h: 20, text: 'UPDATE' },
  lead: { bg: 'transparent', fg: 'var(--purple-500)', fs: 10.5, ls: '.6px', pad: '0', text: 'LEAD' },
  plan: { bg: 'var(--green-50)', fg: 'var(--green-700)', fs: 12, ls: '.8px', pad: '5px 11px', icon: 'check', text: 'IT’S A PLAN' },
  private: { bg: 'rgba(13,17,23,.08)', fg: 'var(--ink-2)', fs: 11.5, ls: 0, pad: '0 8px', h: 22, icon: 'lock', fw: 800, text: 'Private' },
  frosted: { bg: 'var(--frost-dark)', fg: '#fff', fs: 11.5, ls: 0, pad: '0 10px', h: 24, fw: 800, blur: true },
  today: { bg: 'var(--green-500)', fg: '#fff', fs: 13.5, ls: '.2px', pad: '0 13px 0 11px', h: 30, dot: true, shadow: '0 2px 10px rgba(20,154,75,.45)', text: 'Today' },
  count: { bg: 'var(--gold-100)', fg: 'var(--gold-700)', fs: 12, ls: 0, pad: '0 7px', h: 22, icon: 'person' },
  cancelled: { bg: 'var(--red-50)', fg: 'var(--red-700)', fs: 11.5, ls: '.9px', pad: '5px 12px', text: 'CANCELLED' },
};
export function Tag({ kind = 'request', children, icon }) {
  const k = K[kind] || K.request; const ic = icon || k.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: k.dot ? 7 : 4, height: k.h, padding: k.pad, borderRadius: k.radius || 999, background: k.bg, color: k.fg,
      fontSize: k.fs, lineHeight: 1, fontWeight: k.fw || 900, letterSpacing: k.ls, whiteSpace: 'nowrap', boxShadow: k.shadow,
      backdropFilter: k.blur ? 'blur(8px)' : undefined, WebkitBackdropFilter: k.blur ? 'blur(8px)' : undefined }}>
      {k.dot ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,.3)' }} /> : null}
      {ic ? <Icon name={ic} size={k.fs > 12 ? 15 : 11} strokeWidth={kind === 'plan' ? 3.2 : 2.8} /> : null}
      {children ?? k.text}
    </span>
  );
}
