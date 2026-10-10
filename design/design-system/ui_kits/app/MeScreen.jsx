// Me: header (photo, name, About you, Member since, Edit profile), Your impact pill, My tasks, Drafts · Ideas · Leading · Past, Help & info.
window.MeScreen = function MeScreen({ openFeedback, toast }) {
  const { IconButton, GradientCard, Card, ListRow, Tag, Fab } = window.SH;
  return (
    <div style={{ minHeight: 852, paddingBottom: 110 }}>
      <div style={{ background: '#fff', padding: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 0 #e8eaef' }}>
        <span style={{ width: 58, height: 58, borderRadius: 999, background: 'var(--grey-200) url(../../assets/photos/faces/eric.jpg) center/cover' }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 22, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-.5px' }}>Eric S.</span>
          <span style={{ fontSize: 14, lineHeight: 1.35, fontWeight: 500, color: 'var(--grey-700)' }}>Runs the Torrez bootcamp. Always up for a potluck.</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--grey-600)' }}>Member since Sep 2026</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--purple-500)' }}>Edit profile</span>
        </div>
        <IconButton icon="search" label="Search" size={40} /><IconButton icon="bell" label="Notifications" badge={2} />
      </div>
      <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <GradientCard kind="impact" stats={[[4, 'led'], [6, 'helped'], [2, 'attended']]} />
        <Card padding={0} gap={0} radius={16}><ListRow first icon="clipboard-check" title="My tasks" sub="3 this week" /></Card>
        <Card padding={0} gap={0} radius={16}><ListRow first role="draft" title="Drafts" count={2} /><ListRow role="idea" title="Ideas" count={3} /><ListRow role="lead" title="Leading" count={2} /><ListRow role="past" title="Past" count={9} /></Card>
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, letterSpacing: '1.1px', color: 'var(--grey-700)' }}>HELP &amp; INFO</div>
        <Card padding={0} gap={0} radius={16}><ListRow first icon="info" title="How Spark Hub works" /><ListRow icon="chat" title="Feedback & questions" onClick={openFeedback} /><ListRow icon="calendar-add" title="Add to Home Screen" trailing={<Tag kind="request" />} onClick={() => toast('soon:Add to Home Screen is a request for now')} /></Card>
      </div>
      <Fab variant="settings" floating />
    </div>);
};
