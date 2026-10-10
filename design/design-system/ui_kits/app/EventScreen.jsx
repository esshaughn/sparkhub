// Event page: photo header (title, overview, tilted calendar tile), RSVP card, take-part line, Discussion.
window.EventScreen = function EventScreen({ back, toast }) {
  const { IconButton, Card, RsvpTiles, RsvpStatus, FaceStack, Popup, Button, Icon, Tag, Face } = window.SH;
  const [rsvp, setRsvp] = React.useState(null); const [edit, setEdit] = React.useState(false); const [pop, setPop] = React.useState(false);
  const faces = ['hana', 'dee', 'darnell', 'marisol'].map(n => ({ src: '../../assets/photos/faces/' + n + '.jpg' }));
  const pick = (v) => { setRsvp(v); setEdit(false); if (v === 'going') setPop(true); else toast(v === 'maybe' ? 'You’re a maybe' : 'Got it'); };
  return (
    <div style={{ minHeight: 852, paddingBottom: 60 }}>
      <div style={{ position: 'relative', height: 330, background: 'var(--ink-photo) url(../../assets/photos/activate.jpg) center/cover' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim-photo-header)' }} />
        <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between' }}><IconButton icon="chevron-left" label="Back" variant="frosted" size={44} onClick={back} /><IconButton icon="share" label="Share" variant="frosted" size={44} /></div>
        <div style={{ position: 'absolute', top: 88, right: 20, width: 78, borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 8px 20px rgba(0,0,0,.3)', transform: 'rotate(5deg)', textAlign: 'center' }}>
          <div style={{ background: 'var(--green-500)', color: '#fff', fontSize: 12, fontWeight: 900, letterSpacing: '1px', padding: '4px 0' }}>OCT</div>
          <div style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 900, color: 'var(--ink)' }}>15</div><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--grey-600)', paddingBottom: 6 }}>Thursday</div>
        </div>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 40, color: '#fff' }}>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1, fontWeight: 900, letterSpacing: '-1px' }}>Activate</h1>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 500, textWrap: 'pretty' }}>Joseph’s Saturday session. All levels — show up, we’ll scale it.</div>
        </div>
      </div>
      <div style={{ position: 'relative', marginTop: -22, borderRadius: '22px 22px 0 0', background: 'var(--surface-page)', padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Card padding={16} gap={4}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="calendar" size={20} color="var(--purple-500)" /><span style={{ fontSize: 16, fontWeight: 900 }}>Thu, Oct 15 · 8am</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}><Icon name="pin" size={20} color="var(--purple-500)" /><div><div style={{ fontSize: 16, fontWeight: 900 }}>Torrez Fitness</div></div></div>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card>
            {rsvp && !edit ? <RsvpStatus value={rsvp} onChange={() => setEdit(true)} /> : <RsvpTiles value={rsvp} onPick={pick} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><FaceStack faces={faces} label={(rsvp === 'going' ? 18 : 17) + ' going · 3 maybe'} /><span style={{ fontSize: 14, fontWeight: 800, color: 'var(--purple-500)' }}>See all ›</span></div>
          </Card>
          <span style={{ alignSelf: 'center', fontSize: 14.5, fontWeight: 800, color: 'var(--purple-500)' }}>3 ways to help · 2 posts ›</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-.5px' }}>Discussion</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 14px', borderRadius: 16, background: '#fff', boxShadow: 'var(--shadow-card)' }}><Icon name="chat" size={20} color="var(--grey-700)" /><span style={{ flex: 1, fontSize: 15.5, fontWeight: 800 }}>Event group chat</span><Tag kind="request" /><Icon name="chevron-right" size={16} color="var(--grey-400)" strokeWidth={2.6} /></div>
          <Card gap={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 46, padding: '0 6px 0 10px', borderRadius: 999, background: 'var(--grey-50)' }}><Icon name="emoji" size={20} color="var(--grey-600)" /><span style={{ flex: 1, fontSize: 15, fontStyle: 'italic', color: 'var(--grey-400)' }}>Ask a question or say hi…</span><span style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--grey-250)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow-up" size={16} strokeWidth={2.6} /></span></div>
            <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 14, background: 'var(--grey-50)' }}><Face src="../../assets/photos/faces/eric.jpg" size={34} /><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800 }}>Joseph K.<Tag kind="update" /><span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--grey-550)' }}>· 2h</span></span><span style={{ fontSize: 15, lineHeight: 1.4, fontWeight: 500, color: 'var(--ink-2)' }}>Two people to set up before the session starts.</span></div></div>
            <div style={{ display: 'flex', gap: 10 }}><Face src="../../assets/photos/faces/dee.jpg" size={34} /><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 14, fontWeight: 800 }}>Dee R. <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--grey-550)' }}>· 1h</span></span><span style={{ fontSize: 15, lineHeight: 1.4, fontWeight: 500, color: 'var(--ink-2)' }}>Is there parking on Torrez?</span><span style={{ display: 'flex', gap: 16, fontSize: 13, fontWeight: 800, color: 'var(--grey-650)', marginTop: 4 }}><Icon name="heart" size={16} />Reply</span></div></div>
          </Card>
        </div>
      </div>
      {pop ? <Popup title="You’re going!" sub="Bringing anyone?" onClose={() => setPop(false)}><Button variant="green" full onClick={() => { setPop(false); toast('You’re going. See you there!'); }}>Done</Button><div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 14.5, fontWeight: 800 }}><span style={{ color: 'var(--blue-500)' }}>Invite others</span><span style={{ color: 'var(--grey-600)' }}>Change RSVP</span></div></Popup> : null}
    </div>);
};
