import React from 'react';
import { Icon } from '../icons/Icon.jsx';
// Floating action button, bottom-right above the tab bar (right 18, bottom 100).
// plus = purple + (opens the + menu; turns ink × when open). idea = gold + on Ideas. settings = white gear on Me.
export function Fab({ variant = 'plus', open = false, onClick, floating = false }) {
  const pos = floating ? { position: 'absolute', right: 18, bottom: 100, zIndex: 9 } : {};
  const base = { width: 48, height: 48, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', ...pos };
  if (variant === 'settings') return <span role="button" aria-label="Settings" onClick={onClick} style={{ ...base, background: '#fff', color: 'var(--grey-700)', boxShadow: 'var(--shadow-fab-white)' }}><Icon name="gear" size={22} strokeWidth={2.1} /></span>;
  const gold = variant === 'idea';
  return (
    <span role="button" aria-label={gold ? 'Float an Idea' : 'Create'} aria-expanded={open} onClick={onClick}
      style={{ ...base, background: gold ? 'var(--gold-500)' : open ? 'var(--ink)' : 'var(--purple-500)', color: gold ? 'var(--gold-ink)' : '#fff',
        boxShadow: gold ? '0 8px 20px rgba(245,180,40,.4),0 2px 6px rgba(13,17,23,.18)' : 'var(--shadow-fab)', transition: 'background .18s' }}>
      <Icon name="plus" size={22} strokeWidth={2.8} style={{ transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .2s var(--ease-out)' }} />
    </span>
  );
}
// The two pills that pop out of the + (17d): Create a Plan (purple, left) · Float an Idea (gold, above).
export function PlusMenuPill({ kind = 'plan', onClick }) {
  const plan = kind === 'plan';
  return (
    <span role="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minHeight: 52, padding: '0 20px 0 16px', borderRadius: 999,
      background: plan ? 'var(--purple-500)' : 'var(--gold-500)', color: plan ? '#fff' : 'var(--gold-ink)', boxShadow: '0 8px 20px rgba(13,17,23,.22)', fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap', cursor: 'pointer', animation: 'plusPop 260ms var(--ease-spring) both' }}>
      <Icon name={plan ? 'calendar' : 'bulb'} size={20} strokeWidth={2.3} />{plan ? 'Create a Plan' : 'Float an Idea'}
    </span>
  );
}
