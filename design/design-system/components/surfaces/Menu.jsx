import React from 'react';
import { Icon } from '../icons/Icon.jsx';
// Dropdown menu (sort, view, group picker, Share link · QR code). 16px radius, 6px inner padding, 42–48px options.
export function Menu({ options = [], width = 200, multi = false, onDone }) {
  return (
    <div role="listbox" style={{ minWidth: width, background: '#fff', border: '1px solid var(--grey-75)', borderRadius: 16, padding: 6, boxShadow: 'var(--shadow-menu)', display: 'flex', flexDirection: 'column' }}>
      {options.map((o, i) => (
        <div key={i} role="option" aria-selected={!!o.selected} onClick={o.onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: multi ? 44 : 42, padding: '0 10px', borderRadius: 10, cursor: 'pointer', fontSize: 14.5, fontWeight: o.selected && !multi ? 900 : 700, color: o.selected && !multi ? 'var(--purple-500)' : 'var(--ink)' }}>
          {multi ? <span style={{ flex: '0 0 22px', width: 22, height: 22, borderRadius: 7, background: o.selected ? 'var(--purple-500)' : '#fff', boxShadow: o.selected ? 'none' : 'inset 0 0 0 1.6px var(--grey-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{o.selected ? <Icon name="check" size={12} color="#fff" strokeWidth={3.6} /> : null}</span> : o.icon ? <Icon name={o.icon} size={18} /> : null}
          <span style={{ flex: 1 }}>{o.label}</span>
          {o.count != null ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--grey-500)' }}>{o.count}</span> : null}
        </div>))}
      {onDone ? <span role="button" onClick={onDone} style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: 999, background: 'var(--purple-500)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Done</span> : null}
    </div>
  );
}
