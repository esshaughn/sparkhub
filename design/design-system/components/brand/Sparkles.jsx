import React from 'react';
const D = 'M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0Z';
export function Sparkle({ size = 12, color = 'var(--gold-500)', style }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', ...style }}><path d={D} fill={color} /></svg>;
}
// Presets copied from v8 placements (left%, top%, size px, colour, opacity). Dots are tiny round specks.
const PRESETS = {
  card: [[66, 4, 14, '#fff', 1], [86, 6, 10, '#ffe7a6', 1], [93, 62, 8, '#fff', .9], [80, 4, 9, '#ffd0e4', 1], ['dot', 90, 84, 3, .9], ['dot', 72, 86, 2.5, .7], ['dot', 96, 30, 3, .8]],
  header: [[56, 24, 14, '#f5b428', 1], [66, 12, 9, '#d6246e', 1], [62, 64, 8, '#5b4ae8', 1], [48, 52, 7, '#f5b428', .8]],
  pill: [[36, 12, 8, '#fff', 1], [70, 66, 7, '#ffe7a6', 1], [83, 14, 10, '#fff', 1], [8, 70, 6, '#ffe7a6', 1]],
  soft: [[62, 18, 10, '#fff', .8], [78, 62, 7, '#fff', .6], [48, 70, 6, '#fff', .5]],
  button: [[8, 22, 9, '#fff', .95], [20, 66, 6, '#ffe7a6', .9], [78, 18, 8, '#ffe7a6', .95], [90, 60, 10, '#fff', .95], [66, 74, 5, '#fff', .8], [32, 14, 5, '#fff', .8]],
};
export function Sparkles({ preset = 'card', items }) {
  const list = items || PRESETS[preset] || PRESETS.card;
  return (
    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {list.map((s, i) => s[0] === 'dot'
        ? <span key={i} style={{ position: 'absolute', left: s[1] + '%', top: s[2] + '%', width: s[3], height: s[3], borderRadius: 999, background: '#fff', opacity: s[4] }} />
        : <Sparkle key={i} size={s[2]} color={s[3]} style={{ position: 'absolute', left: s[0] + '%', top: s[1] + '%', opacity: s[4] }} />)}
    </span>
  );
}
