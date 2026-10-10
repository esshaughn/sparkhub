import React from 'react';
import { Icon } from '../icons/Icon.jsx';
const ROLE = { lead: 'var(--role-lead)', helping: 'var(--role-helping)', going: 'var(--role-going)', maybe: 'var(--role-maybe)', idea: 'var(--gold-500)', draft: 'var(--role-draft)', past: 'var(--role-past)' };
// A row inside a white card: optional 3px role bar or 40px icon tile, title, quiet count/sub, chevron. Rows are 48px (Me list), 52px (settings), 64px (with sub-line).
export function ListRow({ title, sub, count, role, icon, iconBg = 'var(--purple-50)', iconColor = 'var(--purple-500)', trailing, first = false, onClick }) {
  const h = sub ? 64 : 48;
  return (
    <div role="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: h, padding: '0 14px 0 ' + (role ? 0 : 14) + 'px', borderTop: first ? 0 : '1px solid var(--border-hairline)', cursor: 'pointer' }}>
      {role ? <span style={{ alignSelf: 'stretch', flex: '0 0 3px', margin: '12px 11px 12px 0', borderRadius: 2, background: ROLE[role] }} /> : null}
      {icon ? <span style={{ flex: '0 0 40px', width: 40, height: 40, borderRadius: 12, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} /></span> : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{title}{count != null ? <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--grey-500)' }}>{count}</span> : null}</span>
        {sub ? <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--grey-600)' }}>{sub}</span> : null}
      </div>
      {trailing}
      <Icon name="chevron-right" size={16} color="var(--grey-400)" strokeWidth={2.6} />
    </div>
  );
}
