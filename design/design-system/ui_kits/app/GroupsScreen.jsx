// Groups tab: invite card, Next up, 2×2 group tiles, All groups gradient card.
window.GroupsScreen = function GroupsScreen({ go }) {
  const { ScreenHeader, NextUpCard, GradientCard, Button, Card } = window.SH;
  const [inv, setInv] = React.useState(true);
  const groups = [['Torrez Fitness', 'torrez-group.jpg', '14 members'], ['Hub on Hunters', 'get-togethers-2.jpg', '22 members'], ['Woodcliff Neighborhood', 'projects.jpg', '31 members'], ['Walnut Creek Neighborhood', 'walnut-creek-parade.jpg', '48 members']];
  return (
    <div style={{ minHeight: 852, paddingBottom: 110 }}>
      <ScreenHeader title="My groups" bellCount={2} />
      <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {inv ? <Card radius={20} gap={12}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--ink-photo) url(../../assets/photos/pickleball.jpg) center/cover' }} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15.5, fontWeight: 900 }}>Hana M. invited you to Mueller Pickleball</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--grey-600)' }}>12 members</div></div></div><div style={{ display: 'flex', gap: 8 }}><Button size="sm" style={{ flex: 1 }} onClick={() => setInv(false)}>Join</Button><Button size="sm" variant="soft" style={{ flex: 1 }} onClick={() => setInv(false)}>Not now</Button></div></Card> : null}
        <NextUpCard photo="../../assets/photos/activate.jpg" when="THU, OCT 15 · 8AM" title="Activate" sub="Torrez Fitness · you’re helping" onClick={() => go('event')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {groups.map(([n, p, m]) => (
            <div key={n} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 20, overflow: 'hidden', cursor: 'pointer', background: 'var(--ink-photo) url(../../assets/photos/' + p + ') center/cover', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,17,23,.88) 0%, rgba(13,17,23,.25) 60%, rgba(13,17,23,.05) 100%)' }} />
              <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, color: '#fff', display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontSize: 16, lineHeight: 1.1, fontWeight: 900, textShadow: '0 1px 6px rgba(0,0,0,.35)' }}>{n}</span><span style={{ fontSize: 12, fontWeight: 700, color: '#dfe2e8' }}>{m}</span></div>
            </div>))}
        </div>
        <GradientCard kind="allGroups" title="All groups" sub="All events, plans & ideas" thumbs={groups.map(g => '../../assets/photos/' + g[1])} />
      </div>
    </div>);
};
