import React from 'react';
import { IconButton } from '../actions/IconButton.jsx';
import { Sparkles } from '../brand/Sparkles.jsx';
// White tab header: optional tilted icon tile, 30px/900 title, grey round Search + Bell on the right.
export function ScreenHeader({ title, tile, tileColor = 'var(--gold-500)', back = false, onBack, sparkles = false, bellCount, actions = true }) {
  return (
    <header style={{ position: 'relative', overflow: 'hidden', background: '#fff', padding: '16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 0 #e8eaef' }}>
      {sparkles ? <Sparkles preset="header" /> : null}
      {back ? <IconButton icon="chevron-left" label="Back" variant="ghost" size={40} onClick={onBack} style={{ marginLeft: -6 }} /> : null}
      {tile ? <span aria-hidden="true" style={{ position: 'relative', flex: '0 0 48px', width: 48, height: 48, borderRadius: 14, background: tileColor, transform: 'rotate(-6deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(245,180,40,.4)', color: 'var(--gold-ink-2)' }}>{tile}</span> : null}
      <h1 style={{ position: 'relative', flex: 1, minWidth: 0, margin: 0, fontSize: 30, lineHeight: 1, fontWeight: 900, letterSpacing: '-1px', color: 'var(--ink)' }}>{title}</h1>
      {actions ? <><IconButton icon="search" label="Search" /><IconButton icon="bell" label="Notifications" badge={bellCount} /></> : null}
    </header>
  );
}
