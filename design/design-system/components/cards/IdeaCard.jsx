import React from 'react';
import { Tag } from '../chips/Tag.jsx';
// Ideas board card on cream lined paper. Tiles: 5px gold edge down the left, photo left 36%. Grid: 5px gold edge on top, photo fades out, slight tilt.
export function IdeaCard({ variant = 'tile', title, description, by, count, photo, priv = false, rotate = 0, onClick }) {
  const grid = variant === 'grid';
  const paper = { position: 'relative', overflow: 'hidden', borderRadius: 6, backgroundColor: 'var(--paper)', backgroundImage: 'var(--tex-note-soft)', boxShadow: 'var(--shadow-snapshot)', cursor: 'pointer' };
  const foot = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 'auto' }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: 'var(--grey-550)' }}>{by}</span>
      <Tag kind="count">{count}</Tag>
    </div>);
  if (grid) return (
    <div role="button" onClick={onClick} style={{ ...paper, transform: 'rotate(' + rotate + 'deg)' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 5, background: 'var(--gold-edge)', zIndex: 2 }} />
      {photo ? <div aria-hidden="true" style={{ height: 96, background: 'url(' + photo + ') center/cover', WebkitMaskImage: 'linear-gradient(to bottom, #000 20%, rgba(0,0,0,.35) 55%, transparent 85%)', maskImage: 'linear-gradient(to bottom, #000 20%, rgba(0,0,0,.35) 55%, transparent 85%)' }} /> : null}
      <div style={{ position: 'relative', padding: photo ? '0 12px 12px' : '20px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {priv ? <span style={{ alignSelf: 'flex-start' }}><Tag kind="private" /></span> : null}
        <span style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 900, color: 'var(--ink)', textWrap: 'balance' }}>{title}</span>{foot}
      </div>
    </div>);
  return (
    <div role="button" onClick={onClick} style={{ ...paper, display: 'flex', minHeight: photo ? 96 : undefined }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: 'var(--gold-edge)', zIndex: 2 }} />
      {photo ? <div style={{ flex: '0 0 36%', background: 'url(' + photo + ') center/cover' }} /> : null}
      <div style={{ flex: 1, minWidth: 0, padding: '12px 14px 12px ' + (photo ? 12 : 18) + 'px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {priv ? <span style={{ alignSelf: 'flex-start' }}><Tag kind="private" /></span> : null}
        <span style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 900, color: 'var(--ink)', textWrap: 'balance' }}>{title}</span>
        {description ? <span style={{ fontSize: 13.5, lineHeight: 1.35, fontWeight: 500, color: 'var(--grey-700)' }}>{description}</span> : null}
        <div style={{ marginTop: 6 }}>{foot}</div>
      </div>
    </div>);
}
