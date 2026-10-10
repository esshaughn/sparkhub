// Ideas tab: graph-paper board, group picker + quiet sort, tiles ⇄ grid, idea slide-up on tap.
const IDEAS = [
  { id: 'i1', title: 'Cul-de-sac movie night', desc: 'Projector, blankets, popcorn. Kids welcome.', by: 'Hana M.', n: 7, photo: '../../assets/photos/welcome-picnic.jpg' },
  { id: 'i2', title: 'Tool library in the garage', desc: 'Lend and borrow drills, ladders, the good saw.', by: 'Dee R.', n: 4 },
  { id: 'i3', title: 'Pumpkin carving on the porch', desc: 'Bring a pumpkin, we’ll have the tools.', by: 'Darnell P.', n: 12, photo: '../../assets/photos/pumpkin-nights.jpg', priv: true },
  { id: 'i4', title: 'Saturday creek walk', desc: 'Easy loop, coffee after.', by: 'Marisol T.', n: 3, photo: '../../assets/photos/creekside-meditation.jpg' },
];
window.IdeasScreen = function IdeasScreen({ openIdea }) {
  const { ScreenHeader, FilterPill, IdeaCard, Icon, Menu, GraphPaper } = window.SH;
  const [grid, setGrid] = React.useState(false); const [sort, setSort] = React.useState('Newest'); const [sortOpen, setSortOpen] = React.useState(false);
  return (
    <GraphPaper variant="board" style={{ minHeight: 852, paddingBottom: 110 }}>
      <ScreenHeader title="Ideas" sparkles tile={<Icon name="bulb" size={24} strokeWidth={2.4} />} />
      <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ position: 'relative', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 }}>
          <FilterPill label="All groups" thumbs={['../../assets/photos/torrez-group.jpg', '../../assets/photos/get-togethers-2.jpg', '../../assets/photos/projects.jpg']} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <FilterPill quiet label={sort} onClick={() => setSortOpen(!sortOpen)} />
            <span role="button" onClick={() => setGrid(!grid)} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 32, padding: '0 7px', color: 'var(--grey-600)', cursor: 'pointer' }}><Icon name={grid ? 'grid' : 'view-tiles'} size={17} /><Icon name="chevron-down" size={12} strokeWidth={2.8} /></span>
            {sortOpen ? <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 40 }}><Menu width={170} options={['Newest', 'Popular', 'Almost a Plan'].map(l => ({ label: l, selected: l === sort, onClick: () => { setSort(l); setSortOpen(false); } }))} /></div> : null}
          </div>
        </div>
        {grid ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
            {[IDEAS.filter((_, i) => i % 2 === 0), IDEAS.filter((_, i) => i % 2)].map((col, c) => <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: c ? 20 : 0 }}>{col.map((d, i) => <IdeaCard key={d.id} variant="grid" title={d.title} by={'by ' + d.by} count={d.n} photo={d.photo} priv={d.priv} rotate={[-1.5, 1, -.6, 1.4][(i * 2 + c) % 4]} onClick={() => openIdea(d)} />)}</div>)}
          </div>) : IDEAS.map(d => <IdeaCard key={d.id} title={d.title} description={d.desc} by={'by ' + d.by} count={d.n} photo={d.photo} priv={d.priv} onClick={() => openIdea(d)} />)}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 0 0' }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--gold-100)', color: 'var(--gold-icon)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bulb" size={20} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--grey-700)' }}>That's every idea for now.</span>
        </div>
      </div>
    </GraphPaper>);
};
// Idea slide-up: note-paper top with snapshot, torn edge, I'm interested card, swipe chevron; expands to 54px from the top.
window.IdeaSheet = function IdeaSheet({ idea, onClose, toast }) {
  const { NotePaper, Snapshot, Tag, Card, Button, FaceStack, GraphPaper, Icon, IconButton } = window.SH;
  const [exp, setExp] = React.useState(false); const [inn, setIn] = React.useState(false); const [offered, setOffered] = React.useState(false);
  const faces = ['hana', 'dee', 'darnell'].map(n => ({ src: '../../assets/photos/faces/' + n + '.jpg' }));
  const first = idea.by.split(' ')[0];
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'var(--scrim)', animation: 'scrimIn 180ms ease-out both' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: exp ? 54 : 150, zIndex: 41, background: 'var(--surface-page)', borderRadius: '24px 24px 0 0', overflow: 'hidden auto', transition: 'top 420ms var(--ease-out)', animation: 'sheetUp 280ms var(--ease-out) both' }}>
        <span style={{ position: 'absolute', top: 12, right: 14, zIndex: 3 }}><IconButton icon="close" label="Close" size={40} variant="white" onClick={onClose} /></span>
        <NotePaper handle gap={12}>
          {idea.photo ? <Snapshot src={idea.photo} width={170} height={118} rotate={idea.id === 'i1' ? -2 : 1.6} /> : null}
          <span style={{ alignSelf: 'flex-start', display: 'flex', gap: 8 }}><Tag kind="ideaPaper" />{idea.priv ? <Tag kind="private" /> : null}</span>
          <span style={{ fontSize: 34, lineHeight: 1.02, fontWeight: 900, letterSpacing: '-1px' }}>{idea.title}</span>
          <span style={{ fontSize: 23, lineHeight: 1.25, fontWeight: 500, color: 'var(--ink-2)' }}>{idea.desc}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--grey-600)' }}>Floated by {idea.by} <span style={{ fontWeight: 500 }}>· 2 days ago</span></span>
        </NotePaper>
        <div style={{ padding: '6px 14px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card radius={20}>
            <Button variant={inn ? 'outlineGold' : 'gold'} full onClick={() => { setIn(!inn); setExp(true); toast(inn ? null : 'You’re interested'); }}>{inn ? '✓ Interested' : 'I’m interested'}</Button>
            <div style={{ display: 'flex', justifyContent: 'center' }}><FaceStack faces={faces} label={(idea.n + (inn ? 1 : 0)) + ' people so far ›'} /></div>
          </Card>
          {!exp ? <div role="button" onClick={() => setExp(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 20, cursor: 'pointer', color: 'var(--gold-700)' }}><span style={{ animation: 'swipeBounce 1.8s ease-in-out infinite' }}><Icon name="chevron-up" size={22} strokeWidth={2.8} /></span><span style={{ marginTop: 2, fontSize: 14.5, fontWeight: 800 }}>Swipe up for more</span></div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp 360ms 120ms var(--ease-out) both' }}>
              {offered ? <Card tone="goldSoft" gap={6} radius={20}><span style={{ fontSize: 17, fontWeight: 900 }}>You offered to lead</span><span style={{ fontSize: 14.5, lineHeight: 1.4, fontWeight: 500, color: 'var(--grey-700)' }}>We'll tell you when {first} picks.</span><span role="button" onClick={() => { setOffered(false); toast('Offer taken back'); }} style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--gold-700)', cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center' }}>Take back my offer</span></Card>
                : <Card tone="goldTop" radius={20} padding="18px 16px" gap={10}><span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '1.5px', color: 'var(--gold-700)' }}>NEEDS A LEAD</span><span style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 900, letterSpacing: '-.3px', textWrap: 'pretty' }}>{first} floated this and is looking for someone to run it.</span><span style={{ fontSize: 15, lineHeight: 1.4, fontWeight: 500, color: 'var(--grey-700)' }}>You'd pick the date and make it happen. {first} chooses from the people who offer.</span><Button variant="gold" size="md" full onClick={() => { setOffered(true); toast('Offer sent to ' + first); }}>Offer to lead</Button></Card>}
              <div style={{ padding: '4px' }}><GraphPaper>
                <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.6px' }}>Help make this a plan</span>
                {[['person-plus', 'Invite a friend'], ['calendar', 'Vote on a date'], ['pin', 'Suggest a location']].map(([ic, t]) => <div key={t} role="button" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, fontSize: 17, fontWeight: 700, cursor: 'pointer' }}><Icon name={ic} size={20} color="var(--gold-icon)" /><span style={{ flex: 1 }}>{t}</span><Icon name="chevron-right" size={16} color="var(--grey-400)" strokeWidth={2.6} /></div>)}
              </GraphPaper></div>
            </div>}
        </div>
      </div>
    </>);
};
