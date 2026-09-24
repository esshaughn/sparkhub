/* Sparks — Torrez Fitness · Walktober
   Production port of design_handoff_sparks_app/Walktober App.dc.html.

   Rendering: each state change re-renders the view to an HTML string and morphs
   it into the live DOM (keeps focus, caret and scroll position intact).
   Event handlers are registered per render and referenced by index via
   data-on / data-input / data-focus attributes.

   Data: seeded with the design's sample sparks. Changes are saved to this
   browser's localStorage only — there is no shared backend yet. */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Data (verbatim from the design file)
  // ---------------------------------------------------------------------------

  const CATS = {
    events:   { label: 'Walktober',   bar: '#e8a71c', ink: '#8f6405', tint: '#fdf4e2', scrim: '143,100,5' },
    projects: { label: 'Projects',    bar: '#5b4ae8', ink: '#4a3ad4', tint: '#f0eeff', scrim: '74,58,212' },
    aid:      { label: 'Helping out', bar: '#149a4b', ink: '#0f7a3c', tint: '#e7f6ec', scrim: '15,122,60' },
    fresh:    { label: 'Fresh idea',  bar: '#c97a12', ink: '#a9640d', tint: '#fbf1e3', scrim: '169,100,13' }
  };
  const KEYS = ['resource', 'place', 'when', 'people'];
  const CAT_FLOW = {
    events: [],
    aid: ['people'],
    projects: ['resource', 'place', 'people', 'when'],
    fresh: ['place', 'when', 'people']
  };
  const CHIPS = {
    place:  { 'in-mind': 'spot in mind', looking: 'looking for a spot', no: 'no spot needed' },
    when:   { 'a-day': 'day in mind', flexible: 'any time', depends: 'timing depends' },
    people: { couple: 'a couple of people', handful: 'a small handful', crowd: 'a real crowd', unknown: 'headcount open' },
    shape: { once: 'one-time', recurring: 'happens regularly', open: 'timing open' },
    resource: { yes: 'needs something hard to get', no: 'nothing hard to get' }
  };
  const FACTS = {
    place: { 'in-mind': 'There’s a place in mind for it.', looking: 'Still looking for the right spot — ideas welcome.', no: 'It doesn’t really need a place.' },
    when: { 'a-day': 'There’s a day in mind.', flexible: 'Any time works.', depends: 'When it happens depends on a few other things.' },
    people: { couple: 'A couple of people could do it.', handful: 'It’d take a small handful of us.', crowd: 'It’d take a real crowd.', unknown: 'How many people it takes is still open.' },
    resource: { yes: 'It hinges on something hard to come by.', no: 'Nothing hard to come by needed.' }
  };
  const PROMPTS = {
    place: { key: 'place', q: 'Does this need a spot?', hint: 'Only if you know. Somebody else might know a better one.',
      opts: [['I’ve got a place in mind', 'in-mind'], ['Still looking for somewhere', 'looking'], ['It doesn’t really need one', 'no']] },
    when: { key: 'when', q: 'Is there a day it has to happen?', hint: 'Plenty of good ideas float until someone picks a day.',
      opts: [['There’s a day I have in mind', 'a-day'], ['Whenever works', 'flexible'], ['Depends on other stuff', 'depends']] },
    people: { key: 'people', q: 'How many of us would it take?', hint: 'A rough feel is fine.',
      opts: [['Just a couple of us', 'couple'], ['A small handful', 'handful'], ['A real crowd', 'crowd'], ['No idea yet', 'unknown']] },
    resource: { key: 'resource', q: 'Does it hinge on something hard to come by?', hint: 'A truck, a permit, a key to the gate — that kind of thing.',
      opts: [['Yeah, there’s something like that', 'yes'], ['No, ordinary stuff', 'no']] }
  };
  const OPT_TINTS = ['#f0eeff', '#e7f6ec', '#fdeef0', '#fbf1e3'];
  const OPT_CHEV = ['#5b4ae8', '#149a4b', '#e2556b', '#c97a12'];
  const SORTS = [['new', 'Newest'], ['old', 'Oldest'], ['rich', 'Most filled in'], ['crowd', 'Needs a crowd'], ['bare', 'Still just an idea']];
  const LEADS = { w1: 'Rosa M.', w6: 'Kiran', w7: 'Curtis', w8: 'You' };
  const BASICS = { w1: true };
  const SEED_OFFERS = {
    w2: [{ who: 'Dee', line: 'knows the manager at Blast Zone.' }, { who: 'Theo', line: 'is in, and bringing his cousin.' }],
    w3: [{ who: 'Alma R.', line: 'can book a court for Saturday morning.' }]
  };
  const SEED = [
    { id: 'w1', text: 'Sunrise loop around the lake before the 7am class', vibe: 'Quiet', bits: ['Coffee after for whoever wants it'], who: 'Rosa M.', when: '6 hours ago', hrs: 6, cat: 'events', answers: { shape: 'recurring', place: 'in-mind', when: 'a-day', people: 'handful' } },
    { id: 'w2', text: 'Laser tag night', vibe: 'Competitive', bits: ['Teams by which class you take', 'Tacos after'], who: 'Darnell', when: 'yesterday', hrs: 26, cat: 'events', answers: { shape: 'once', people: 'crowd' } },
    { id: 'w3', text: 'Pickleball at Garfield Park courts', vibe: 'High energy', bits: [], who: 'Hana K.', when: '2 days ago', hrs: 48, cat: 'events', answers: { place: 'in-mind', people: 'handful' } },
    { id: 'w4', text: 'Stadium stair climb', vibe: '', bits: [], who: 'Theo', when: '3 days ago', hrs: 72, cat: 'events', answers: {} },
    { id: 'w5', text: 'Sunday stroller walk and brunch', vibe: 'Cozy', bits: ['Keep it kid friendly'], who: 'June P.', when: '4 days ago', hrs: 96, cat: 'events', answers: { shape: 'recurring', place: 'looking', people: 'couple' } },
    { id: 'w6', text: 'Headlamp night walk on the rail trail', vibe: 'Relaxed', bits: ['Someone brings a speaker'], who: 'Kiran', when: '5 days ago', hrs: 120, cat: 'events', answers: { place: 'in-mind', people: 'handful' }, minPeople: 4,
      dates: [{ id: 'k1', label: 'Thu Oct 8, 7:30pm' }, { id: 'k2', label: 'Fri Oct 9, 8pm' }, { id: 'k3', label: 'Tue Oct 13, 7:30pm' }],
      rsvps: [{ name: 'Dee', phone: '(555) 201-4410', dateIds: ['k1', 'k2'] }, { name: 'Theo', phone: '(555) 388-0192', dateIds: ['k2'] }, { name: 'Hana K.', phone: '(555) 640-7735', dateIds: ['k2', 'k3'] }, { name: 'Alma R.', phone: '(555) 912-3304', dateIds: ['k1'] }, { name: 'June P.', phone: '(555) 470-2268', none: true }] },
    { id: 'w8', text: 'Walktober kickoff 5K around the reservoir', vibe: 'Relaxed', bits: ['Group photo at the finish'], who: 'You', when: '3 hours ago', hrs: 3, cat: 'events', answers: { place: 'in-mind', people: 'crowd' }, minPeople: 3,
      dates: [{ id: 's1', label: 'Sat Oct 3, 8am' }, { id: 's2', label: 'Sun Oct 4, 9am' }],
      rsvps: [{ name: 'Rosa M.', phone: '(555) 733-1180', dateIds: ['s1'] }, { name: 'Darnell', phone: '(555) 264-9021', dateIds: ['s2'] }, { name: 'Curtis', phone: '(555) 518-6647', dateIds: ['s1', 's2'] }, { name: 'Kiran', phone: '(555) 305-7719', none: true }, { name: 'Hana K.', phone: '(555) 640-7735', none: true }] },
    { id: 'w7', text: 'Step-count bet — lowest total buys smoothies', vibe: 'Competitive', bits: [], who: 'Curtis', when: 'last week', hrs: 168, cat: 'events', answers: { shape: 'once', place: 'no', people: 'crowd' } }
  ];

  const seedSparks = () => SEED.map(s => ({
    ...s, answers: { ...s.answers },
    leadName: LEADS[s.id] || null,
    basics: !!BASICS[s.id],
    spot: null, day: null, lockedDateId: null,
    dates: (s.dates || []).slice(), rsvps: (s.rsvps || []).slice(),
    offers: (SEED_OFFERS[s.id] || []).slice()
  }));

  // ---------------------------------------------------------------------------
  // Persistence (this browser only)
  // ---------------------------------------------------------------------------

  const STORE_KEY = 'sparks-torrez-v1';
  const load = () => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const data = raw && JSON.parse(raw);
      if (data && Array.isArray(data.sparks)) return data;
    } catch (e) { /* storage blocked or corrupt — fall back to seed */ }
    return null;
  };
  const save = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ sparks: state.sparks, rsvpName: state.rsvpName, rsvpPhone: state.rsvpPhone }));
    } catch (e) { /* ignore */ }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const css = (o) => Object.keys(o).map(k => {
    const prop = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    return prop + ':' + o[k];
  }).join(';');

  const cleanTitle = (t) => {
    const s = (t || '').trim().replace(/\s+/g, ' ').replace(/[.!,;\s]+$/, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  };

  const fmtDate = (v) => {
    const d = new Date(v);
    if (isNaN(d)) return v;
    const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const h = d.getHours(), m = d.getMinutes();
    const t = (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm');
    return day + ', ' + t;
  };

  const relTime = (ts) => {
    const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + ' minutes ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs === 1 ? '1 hour ago' : hrs + ' hours ago';
    const days = Math.round(hrs / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    return days < 14 ? 'last week' : Math.round(days / 7) + ' weeks ago';
  };
  const whenOf = (s) => s.created ? relTime(s.created) : s.when;
  const hrsOf = (s) => s.created ? (Date.now() - s.created) / 3600000 : s.hrs;

  // Per-render handler registry
  let H = [];
  const reg = (fn) => { H.push(fn); return H.length - 1; };
  const on = (fn) => 'data-on="' + reg(fn) + '" role="button" tabindex="0"';
  const onArea = (fn) => 'data-on="' + reg(fn) + '"';               // clickable container holding inputs
  const onInput = (fn) => 'data-input="' + reg(fn) + '"';
  const onFocus = (fn) => 'data-focus="' + reg(fn) + '"';

  // ---------------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------------

  const BOLT = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z" fill="#e8a71c" stroke="#e8a71c" stroke-width="1.7" stroke-linejoin="round"/><path d="M4.6 4.6 6.9 7.2" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/><path d="M1.9 15.2 5.1 14.9" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/><path d="M19.4 4.6 17.1 7.2" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/><path d="M22.1 15.2 18.9 14.9" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/></svg>';
  const plus = (size, color, w) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const X = (size, color, w) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const CHEV_L = (size, color, w) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>';
  const CHEV_R = (size, color, w) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const CHECK = (size, color, w) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  const LOCK = (size, color, w) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"/></svg>';
  const ARROW_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5b4ae8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  const SHIELD_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c6270" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 20px;margin-top:2px" aria-hidden="true"><path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6l-7-2.8Z"/><path d="M9.2 12.1l2.1 2.1 3.6-3.9"/></svg>';
  const PENCIL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c6270" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 20px;margin-top:2px" aria-hidden="true"><path d="M16.6 3.8l3.6 3.6L8.4 19.2 4 20.5l1.3-4.4L16.6 3.8Z"/></svg>';
  const CLOCK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c6270" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 20px;margin-top:2px" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.2 2"/></svg>';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const saved = load();
  const state = {
    screen: 'home', cats: [], sort: 'new', menu: null,
    step: 'activity', leadInfo: false,
    activity: '', vibe: '', hopes: [],
    locMode: 'specific', locText: '', whenMode: 'one', dateOne: '', timeOne: '', timeOn: false, minPeople: 0,
    claim: false, offerKind: null, offerText: '',
    rsvpOpen: false, rsvpDates: [], rsvpNone: false,
    rsvpName: (saved && saved.rsvpName) || '', rsvpPhone: (saved && saved.rsvpPhone) || '',
    qi: 0, subjectId: null, adding: false, tag: null,
    sparks: (saved && saved.sparks) || seedSparks()
  };

  const setState = (patch) => {
    const prevStep = state.step, prevQi = state.qi;
    Object.assign(state, patch);
    save();
    render();
    if (state.step !== prevStep || state.qi !== prevQi) {
      const ov = document.querySelector('.overlay-screen');
      if (ov) ov.scrollTop = 0;
    }
  };

  const scroller = () => document.querySelector('.scroller');
  const go = (screen, extra) => {
    setState(Object.assign({ screen, menu: null }, extra || {}));
    const sc = scroller();
    if (sc) sc.scrollTop = 0;
  };

  // ---------------------------------------------------------------------------
  // Domain logic
  // ---------------------------------------------------------------------------

  const cat = (s) => CATS[s.cat] || CATS.fresh;
  const flow = (s) => CAT_FLOW[(s && s.cat) || 'fresh'] || CAT_FLOW.fresh;
  const answeredCount = (s) => KEYS.reduce((n, k) => n + (s.answers[k] ? 1 : 0), 0);
  const hasSpot = (s) => !!s.spot || s.answers.place === 'in-mind';
  const hasDay = (s) => !!s.day || s.answers.when === 'a-day';
  const ready = (s) => [!!s.leadName, hasSpot(s), hasDay(s), !!s.basics];
  const readyCount = (s) => ready(s).filter(Boolean).length;
  const subject = () => state.sparks.find(s => s.id === state.subjectId) || null;

  const patch = (id, fields, after) => {
    const sparks = state.sparks.map(s => s.id === id ? { ...s, ...fields } : s);
    setState(Object.assign({ sparks }, after || {}));
  };

  const visible = () => {
    const { sparks, cats, sort } = state;
    const out = cats.length ? sparks.filter(s => cats.indexOf(s.cat) > -1) : sparks.slice();
    const byNew = (x, y) => hrsOf(x) - hrsOf(y);
    if (sort === 'new') out.sort(byNew);
    if (sort === 'old') out.sort((x, y) => hrsOf(y) - hrsOf(x));
    if (sort === 'rich') out.sort((x, y) => answeredCount(y) - answeredCount(x) || byNew(x, y));
    if (sort === 'crowd') out.sort((x, y) => (y.answers.people === 'crowd' ? 1 : 0) - (x.answers.people === 'crowd' ? 1 : 0) || byNew(x, y));
    if (sort === 'bare') out.sort((x, y) => answeredCount(x) - answeredCount(y) || byNew(x, y));
    return out;
  };

  const createDraft = () => {
    const id = 'n' + Date.now();
    const st = state;
    const spark = {
      id, text: cleanTitle(st.activity), vibe: cleanTitle(st.vibe),
      bits: st.hopes.map(cleanTitle).filter(Boolean),
      who: 'You', when: 'just now', hrs: 0, created: Date.now(), cat: 'events', answers: {}, draft: true,
      leadName: 'You', basics: false, lockedDateId: null, rsvps: [], vision: null, offers: [],
      spot: st.locMode === 'specific' ? cleanTitle(st.locText) : null, spotOpen: st.locMode === 'open',
      day: st.whenMode === 'one'
        ? (st.timeOn && st.timeOne ? fmtDate(st.dateOne + 'T' + st.timeOne) : new Date(st.dateOne + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
        : null,
      dates: [],
      minPeople: st.minPeople
    };
    setState({
      sparks: st.sparks.concat([spark]), subjectId: id, qi: 0, adding: false, screen: flow(spark).length ? 'questions' : 'detail', tag: flow(spark).length ? null : 'It’s up',
      activity: '', vibe: '', hopes: [], locMode: 'specific', locText: '', whenMode: 'one', dateOne: '', timeOne: '', timeOn: false, minPeople: 0
    });
  };

  const answer = (key, value) => {
    const sparks = state.sparks.map(s => s.id === state.subjectId
      ? { ...s, answers: { ...s.answers, [key]: s.answers[key] === value ? undefined : value } }
      : s);
    setState({ sparks });
  };

  const finish = () => {
    const adding = state.adding;
    const sparks = state.sparks.map(s => s.id === state.subjectId ? { ...s, draft: false } : s);
    setState({ sparks, screen: 'detail', qi: 0, step: 'activity', tag: adding ? 'Nice — added' : 'It’s up' });
    const sc = scroller();
    if (sc) sc.scrollTop = 0;
  };

  const advance = () => {
    const qi = state.qi + 1;
    if (qi >= flow(subject()).length) { finish(); return; }
    setState({ qi });
  };

  const leave = () => {
    if (state.adding) { go('detail', { qi: 0 }); return; }
    go('detail', { qi: 0, step: 'activity', activity: '', vibe: '', hopes: [], tag: 'It’s up' });
  };

  const commitOffer = (subj) => {
    const kind = state.offerKind;
    const text = state.offerText.trim();
    if (kind === 'date') { patch(subj.id, { dates: (subj.dates || []).concat([{ id: 'd' + Date.now(), label: fmtDate(text) }]) }, { offerKind: null, offerText: '' }); return; }
    if (kind === 'vision') { patch(subj.id, { vision: text }, { offerKind: null, offerText: '' }); return; }
    const fields = { offers: (subj.offers || []).concat([{ who: 'You', line: kind === 'spot' ? 'offered a spot: ' + text : kind === 'day' ? 'floated a day: ' + text : 'can help: ' + text }]) };
    if (kind === 'spot') fields.spot = text;
    if (kind === 'day') fields.day = text;
    patch(subj.id, fields, { offerKind: null, offerText: '' });
  };

  // ---------------------------------------------------------------------------
  // Style factories (verbatim values from the design)
  // ---------------------------------------------------------------------------

  const btn = (ok) => css({ marginTop: '4px', width: '100%', border: 0, borderRadius: '999px', padding: '17px', fontFamily: 'inherit', fontSize: '16.5px', fontWeight: 800, color: '#fff',
    background: ok ? '#5b4ae8' : '#b9bcc4', cursor: ok ? 'pointer' : 'not-allowed', boxShadow: ok ? '0 10px 24px rgba(91,74,232,.32)' : 'none' });
  const smallBtn = (ok, shadow) => css({ marginTop: shadow ? '4px' : '2px', width: '100%', border: 0, borderRadius: '999px', padding: '16px', fontFamily: 'inherit', fontSize: '16px', fontWeight: 800, color: '#fff',
    background: ok ? '#5b4ae8' : '#b9bcc4', cursor: ok ? 'pointer' : 'not-allowed', boxShadow: shadow && ok ? '0 8px 20px rgba(91,74,232,.28)' : 'none' });
  const optVals = (isOn) => ({
    card: css({ background: '#fff', borderRadius: '18px', padding: '16px', border: '2px solid ' + (isOn ? '#5b4ae8' : '#fff'), boxShadow: isOn ? '0 6px 18px rgba(91,74,232,.14)' : '0 1px 3px rgba(15,18,25,.08)' }),
    dot: css({ flex: '0 0 22px', width: '22px', height: '22px', marginTop: '1px', borderRadius: '999px', border: '2px solid ' + (isOn ? '#5b4ae8' : '#cfd3db'), display: 'flex', alignItems: 'center', justifyContent: 'center' }),
    pip: css({ width: '10px', height: '10px', borderRadius: '999px', background: isOn ? '#5b4ae8' : 'transparent' })
  });
  const chipStyle = (c) => css({ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '999px', padding: '5px 11px', fontSize: '12.5px', fontWeight: 700, background: c.tint, color: c.ink });

  const CARD = 'background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08)';
  const EYEBROW = 'font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280';
  const FIELD = 'background:#fff;border:2px solid #e6e7eb;font-family:inherit;font-size:16px;font-weight:600;color:#0d1117;outline:none';
  const OUTLINE_BTN = 'width:100%;background:#fff;border:1.5px solid #dcdfe6;border-radius:999px;padding:16px;font-family:inherit;font-size:16px;font-weight:800;color:#0d1117;cursor:pointer';
  const OFFER_CHIP = 'border:1.5px solid #dcdfe6;border-radius:999px;padding:11px 15px;font-size:14.5px;font-weight:800;color:#0d1117;cursor:pointer';
  const PRIMARY = 'width:100%;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16.5px;font-weight:800;padding:17px;box-shadow:0 10px 24px rgba(91,74,232,.32);cursor:pointer';
  const ROUND_ICON = (size) => 'flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer';

  // ---------------------------------------------------------------------------
  // Shared fragments
  // ---------------------------------------------------------------------------

  const ideaCta = (marginTop) =>
    '<button type="button" class="hov-primary" ' + on(goCompose) + ' style="margin-top:' + marginTop + 'px;' + PRIMARY + ';display:flex;align-items:center;justify-content:center;gap:9px">' +
      plus(19, '#fff', 2.5) + 'I have an idea</button>';

  const sparksHeader = (withBack) =>
    '<header style="background:#fff;padding:26px 20px ' + (withBack ? 20 : 16) + 'px">' +
      (withBack
        ? '<div ' + on(() => go('home')) + ' style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer">' + ARROW_L
        : '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">') +
        '<span style="font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#5b4ae8">Torrez Fitness</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px">' + BOLT +
        '<h1 style="margin:0;font-size:46px;line-height:.94;font-weight:900;letter-spacing:-1.4px;color:#0d1117">Sparks</h1>' +
      '</div>' +
      '<p style="margin:13px 0 0;max-width:330px;font-size:19px;line-height:1.3;font-weight:700;letter-spacing:-.3px;color:#2b303a;text-wrap:pretty">What should we get up to?</p>' +
      '<ol style="margin:10px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:2px;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">' +
        '<li>Post an idea with rough details</li><li>Everyone adds on until it’s a plan</li>' +
      '</ol>' +
      ideaCta(18) +
      (withBack ? '' :
        '<div style="display:flex;justify-content:center;margin-top:14px">' +
          '<span ' + on(scrollToHow) + ' style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">More about how this works' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5b4ae8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v13M6 12.5l6 6 6-6"/></svg>' +
          '</span>' +
        '</div>') +
    '</header>';

  const howContent = (eyebrowColor) => {
    const step = (n, bg, ink, title, body) =>
      '<div style="display:flex;gap:14px">' +
        '<div style="flex:0 0 34px;width:34px;height:34px;border-radius:999px;background:' + bg + ';color:' + ink + ';font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center">' + n + '</div>' +
        '<div><div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + title + '</div>' +
        '<p style="margin:3px 0 0;font-size:14.5px;line-height:1.42;font-weight:500;color:#5c6270">' + body + '</p></div>' +
      '</div>';
    const point = (icon, lead, body) =>
      '<div style="display:flex;gap:12px">' + icon +
        '<p style="margin:0;font-size:14.5px;line-height:1.42;font-weight:500;color:#454b55"><strong style="font-weight:800;color:#0d1117">' + lead + '</strong> ' + body + '</p>' +
      '</div>';
    return '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:' + eyebrowColor + '">How this works</div>' +
      '<h2 style="margin:8px 0 0;font-size:28px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">Good ideas grow when we build them together</h2>' +
      '<p style="margin:12px 0 0;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.</p>' +
      '<div style="margin-top:20px;display:flex;flex-direction:column;gap:16px">' +
        step(1, '#efedfd', '#4a3ad4', 'Sed ut perspiciatis', 'Unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa.') +
        step(2, '#fdf4e2', '#8f6405', 'Nemo enim ipsam voluptatem', 'Quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.') +
        step(3, '#e7f6ec', '#0f7a3c', 'Neque porro quisquam est', 'Qui dolorem ipsum quia dolor sit amet, consectetur adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore.') +
      '</div>' +
      '<div style="height:1px;background:#eceef2;margin:22px 0"></div>' +
      '<div style="' + EYEBROW + '">Duis aute irure dolor</div>' +
      '<div style="margin-top:12px;display:flex;flex-direction:column;gap:12px">' +
        point(SHIELD_CHECK, 'Excepteur sint occaecat.', 'Cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.') +
        point(PENCIL, 'At vero eos et accusamus.', 'Iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti.') +
        point(CLOCK, 'Temporibus autem quibusdam.', 'Et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint.') +
      '</div>' +
      ideaCta(26);
  };

  const subHeader = (title, back, bordered) =>
    '<header style="background:#fff;' + (bordered ? 'border-bottom:1px solid #e6e7eb;' : '') + 'padding:16px 20px;display:flex;align-items:center;gap:14px">' +
      '<div ' + on(back) + ' aria-label="Back" style="' + ROUND_ICON(38) + '">' + CHEV_L(18, '#0d1117', 2.2) + '</div>' +
      '<div>' +
        '<div style="font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#5b4ae8">Torrez Fitness</div>' +
        '<div style="font-size:19px;font-weight:800;letter-spacing:-.3px;color:#0d1117">' + title + '</div>' +
      '</div>' +
    '</header>';

  const backLink = (fn) =>
    '<span ' + on(fn) + ' style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;width:fit-content">' +
      CHEV_L(14, '#6b7280', 2.2) + 'Back</span>';

  const modalClose = (fn) =>
    '<div ' + on(fn) + ' aria-label="Close" style="position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + X(15, '#0d1117', 2.4) + '</div>';

  const stepEyebrow = () => '<div style="font-size:12.5px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#8f6405">' + esc(cleanTitle(state.activity)) + '</div>';

  // ---------------------------------------------------------------------------
  // Navigation actions
  // ---------------------------------------------------------------------------

  function goCompose() {
    go('compose', { activity: '', vibe: '', hopes: [], step: 'activity', leadInfo: false,
      locMode: 'specific', locText: '', whenMode: 'one', dateOne: '', timeOne: '', timeOn: false, minPeople: 0 });
  }
  function scrollToHow() {
    const sec = document.getElementById('home-how');
    const sc = scroller();
    if (sec && sc) sc.scrollTo({ top: sec.offsetTop - 8, behavior: 'smooth' });
  }

  // ---------------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------------

  function countEvents() {
    const n = state.sparks.filter(s => s.cat === 'events').length;
    return n + (n === 1 ? ' idea' : ' ideas') + ' so far';
  }

  function viewHome() {
    return '<div data-screen-label="Home">' +
      sparksHeader(false) +
      '<div style="padding:16px 14px 10px">' +
        '<div ' + on(() => go('browse', { cats: [] })) + ' aria-label="Walktober 2026 — see all ideas" style="position:relative;height:200px;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.1);cursor:pointer">' +
          '<img src="photos/torrez-trail.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 35%">' +
          '<div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(143,100,5,.88) 0%, rgba(143,100,5,.42) 45%, rgba(143,100,5,.05) 100%)"></div>' +
          '<div style="position:absolute;left:16px;right:16px;bottom:15px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px">' +
            '<div>' +
              '<div style="font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#fff">Walktober 2026</div>' +
              '<div style="margin-top:3px;font-size:13.5px;font-weight:700;color:rgba(255,255,255,.92)">' + countEvents() + '</div>' +
            '</div>' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M12.5 6l6 6-6 6"/></svg>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<section id="home-how" style="margin:2px 0 22px;background:#fff;border-radius:22px;padding:24px 20px 26px">' + howContent('#5b4ae8') + '</section>' +
      '<div style="height:92px"></div>' +
    '</div>';
  }

  function viewBrowse() {
    const cards = visible().map(s => {
      const c = cat(s);
      const chips = KEYS.map(k => (CHIPS[k] || {})[s.answers[k]]).filter(Boolean);
      if (s.vibe) chips.unshift(s.vibe.toLowerCase());
      const pips = ready(s).map(met => '<span style="width:16px;height:5px;border-radius:999px;background:' + (met ? c.bar : '#dfe2e8') + '"></span>').join('');
      return '<div ' + on(() => go('detail', { subjectId: s.id, tag: null })) + ' style="display:grid;grid-template-columns:8px 1fr;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
        '<div style="background:' + c.bar + '"></div>' +
        '<div style="padding:15px 16px 14px;display:flex;flex-direction:column;gap:11px">' +
          '<div style="display:flex;align-items:center;gap:7px">' +
            '<span style="width:7px;height:7px;border-radius:999px;background:' + c.ink + '"></span>' +
            '<span style="font-size:11.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + c.ink + '">' + c.label + '</span>' +
          '</div>' +
          '<div style="font-size:19px;line-height:1.28;font-weight:800;letter-spacing:-.3px;color:#0d1117;text-wrap:pretty">' + esc(s.text) + '</div>' +
          (chips.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
            chips.map(l => '<span style="' + chipStyle(c) + '"><span style="width:6px;height:6px;border-radius:999px;background:currentColor"></span>' + esc(l) + '</span>').join('') +
          '</div>' : '') +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<div style="display:flex;gap:4px">' + pips + '</div>' +
            (s.leadName ? '' : '<span style="font-size:12.5px;font-weight:800;letter-spacing:.2px;color:#6b7280">needs a lead</span>') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="width:28px;height:28px;border-radius:999px;background:' + c.bar + ';color:#fff;font-size:12.5px;font-weight:800;display:flex;align-items:center;justify-content:center">' + esc(s.who.charAt(0)) + '</span>' +
            '<span style="font-size:13.5px;font-weight:700;color:#454b55">' + esc(s.who) + '</span>' +
            '<span style="width:3px;height:3px;border-radius:999px;background:#9aa0ac"></span>' +
            '<span style="font-size:13.5px;font-weight:500;color:#6b7280">' + esc(whenOf(s)) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    });

    const sortLabel = (SORTS.find(s => s[0] === state.sort) || SORTS[0])[1];
    const sortMenu = state.menu === 'sort'
      ? '<div data-menu style="position:absolute;top:calc(100% + 6px);right:0;min-width:216px;background:#fff;border:1px solid #eceef2;border-radius:16px;padding:6px;box-shadow:0 18px 44px rgba(15,18,25,.2);animation:popIn 280ms cubic-bezier(.22,.9,.28,1) both">' +
          '<div style="padding:8px 12px 6px;font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#9aa0ac">Order by</div>' +
          SORTS.map(([key, label]) => {
            const isOn = state.sort === key;
            return '<div ' + on(() => setState({ sort: key, menu: null })) + ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-radius:12px;background:' + (isOn ? '#f3f1fe' : 'transparent') + ';cursor:pointer">' +
              '<span style="font-size:15.5px;font-weight:' + (isOn ? 700 : 600) + ';color:' + (isOn ? '#5b4ae8' : '#0d1117') + '">' + label + '</span>' +
              (isOn ? CHECK(16, '#5b4ae8', 2.6) : '') +
            '</div>';
          }).join('') +
        '</div>'
      : '';

    return '<div data-screen-label="Browse">' +
      sparksHeader(true) +
      '<div style="position:relative;padding:16px 14px 0;display:flex;gap:8px;z-index:3;align-items:flex-start">' +
        '<div style="flex:1 1 auto;padding:13px 2px;font-size:15.5px;font-weight:800;color:#0d1117">' + countEvents() + '</div>' +
        '<div style="position:relative;flex:0 0 auto" data-menu>' +
          '<div ' + on(() => setState({ menu: state.menu === 'sort' ? null : 'sort' })) + ' aria-haspopup="true" aria-expanded="' + (state.menu === 'sort') + '" style="display:flex;align-items:center;gap:8px;border:1.5px solid #dcdfe6;background:#fff;border-radius:999px;padding:13px 16px;cursor:pointer">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5c6270" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M17 20V4M17 4l3 3"/></svg>' +
            '<span style="font-size:15.5px;font-weight:800;color:#0d1117">' + sortLabel + '</span>' +
          '</div>' +
          sortMenu +
        '</div>' +
      '</div>' +
      '<div style="padding:16px 14px 22px;display:flex;flex-direction:column;gap:14px">' +
        cards.join('') +
        (cards.length === 0
          ? '<div style="' + CARD + ';padding:22px 18px">' +
              '<div style="font-size:17px;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + (state.cats.length > 1 ? 'Nothing in these piles yet.' : 'Nothing in this pile yet.') + '</div>' +
              '<div ' + on(() => setState({ cats: [] })) + ' style="margin-top:14px;display:inline-flex;border:1.5px solid #dcdfe6;border-radius:999px;padding:11px 16px;font-size:15px;font-weight:800;color:#0d1117;cursor:pointer">Show everything</div>' +
            '</div>'
          : '') +
      '</div>' +
      '<div style="height:73px"></div>' +
    '</div>';
  }

  function viewHow() {
    return '<div data-screen-label="How this works" style="background:#fff;min-height:100%">' +
      '<header style="background:#fff;padding:26px 20px 18px">' +
        '<div ' + on(() => go('home')) + ' style="display:flex;align-items:center;gap:8px;cursor:pointer;width:fit-content">' + ARROW_L +
          '<span style="font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#5b4ae8">Torrez Fitness</span>' +
        '</div>' +
      '</header>' +
      '<div style="height:1px;background:#e6e7eb"></div>' +
      '<section style="padding:20px 20px 26px">' + howContent('#0f7a3c') + '</section>' +
      '<div style="height:92px"></div>' +
    '</div>';
  }

  function viewDetail(subj) {
    const st = state;
    const c = cat(subj);
    const met = ready(subj);
    const n = met.filter(Boolean).length;
    const exec = n === 4;
    const youLead = subj.leadName === 'You';
    const spot = hasSpot(subj), day = hasDay(subj);
    const dates = subj.dates || [], rsvps = subj.rsvps || [], nDates = dates.length;
    const mine = rsvps.find(r => r.mine);
    const openRsvp = () => setState({ rsvpOpen: true, rsvpDates: mine ? (mine.dateIds || []).slice() : [], rsvpNone: mine ? !!mine.none : false, rsvpName: mine ? mine.name : st.rsvpName, rsvpPhone: mine ? mine.phone : st.rsvpPhone });

    // Facts
    const factRow = (line, dotTop) => ({ line, dotTop });
    const facts = KEYS.map(k => {
      let line = (FACTS[k] || {})[subj.answers[k]];
      if (k === 'place' && subj.spot) line = 'The spot: ' + subj.spot + '.';
      if (k === 'when' && subj.day) line = 'The day: ' + subj.day + '.';
      return line ? factRow(line, 7) : null;
    }).filter(Boolean);
    if (subj.spotOpen && !subj.spot) facts.push(factRow('Location: we’ll decide together.', 6));
    if (subj.minPeople && !dates.length) facts.push(factRow('It’s a success with ' + subj.minPeople + ' or more.', 6));

    // Dates
    const counted = dates.map((d, i) => ({ d, i, people: rsvps.filter(r => (r.dateIds || []).indexOf(d.id) > -1) }));
    counted.sort((a, b) => b.people.length - a.people.length || a.i - b.i);
    const top = counted.length ? counted[0].people.length : 0;
    const tied = top > 0 && counted.filter(x => x.people.length === top).length > 1;
    const lockedId = subj.lockedDateId;
    const none = rsvps.filter(r => r.none);
    const going = rsvps.filter(r => !r.none).length;
    const badge = (bg, ink, label) => '<span style="border-radius:999px;padding:3px 9px;background:' + bg + ';color:' + ink + ';font-size:11.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase">' + label + '</span>';

    const dateRows = counted.map((x, rank) => {
      const cnt = x.people.length, isLocked = lockedId === x.d.id, isTop = cnt > 0 && cnt === top;
      const minP = subj.minPeople || 0, withLead = cnt + 1;
      const countLabel = (cnt === 0 ? 'Nobody yet' : cnt === 1 ? '1 can make it' : cnt + ' can make it') + (minP && withLead < minP ? ' · ' + (minP - withLead) + ' short of ' + minP : '');
      const barBg = isLocked ? '#0f7a3c' : isTop && !lockedId ? c.bar : '#c3c7cf';
      return '<div style="padding:12px;margin:0 -12px;border-radius:14px;background:' + (isLocked ? '#e8f6ee' : 'transparent') + '">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<span style="flex:0 0 26px;width:26px;height:26px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#454b55">' + (rank + 1) + '</span>' +
          '<div style="flex:1 1 auto;min-width:0">' +
            '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px">' +
              '<span style="font-size:16px;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + esc(x.d.label) + '</span>' +
              (!lockedId && isTop && !tied ? badge('#fdf1d6', '#8f6405', 'Most support') : '') +
              (!lockedId && isTop && tied ? badge('#f2f3f6', '#454b55', 'Tied') : '') +
              (minP && withLead >= minP && !isLocked ? badge('#e8f6ee', '#0f7a3c', 'Enough to go') : '') +
              (isLocked ? badge('#0f7a3c', '#fff', 'Locked in') : '') +
            '</div>' +
            '<div style="margin-top:2px;font-size:13.5px;font-weight:600;color:#6b7280">' + countLabel + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin:10px 0 0 38px;height:6px;border-radius:999px;background:#eff0f3;overflow:hidden"><div style="height:100%;border-radius:999px;width:' + (top ? cnt / top * 100 : 0) + '%;background:' + barBg + ';transition:width .3s ease"></div></div>' +
        (youLead && cnt > 0 ? '<div style="margin:8px 0 0 38px;font-size:13.5px;line-height:1.4;font-weight:600;color:#454b55">' + esc(x.people.map(p => p.mine ? 'You' : p.name).join(', ')) + '</div>' : '') +
        (youLead && !lockedId && cnt > 0
          ? '<span ' + on(() => patch(subj.id, { lockedDateId: x.d.id, day: x.d.label })) + ' style="margin:8px 0 0 38px;display:inline-flex;align-items:center;gap:5px;font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' + LOCK(12, '#5b4ae8', 2.4) + 'Lock this one in</span>'
          : '') +
      '</div>';
    });

    // Readiness
    const line = !subj.leadName
      ? (n === 0 ? 'Still just an idea — nobody out front yet.' : 'Coming together, but it needs somebody out front.')
      : (exec ? 'All four in place. This one’s happening.' : n + ' of 4 in place — ' + (youLead ? 'you’re' : subj.leadName + ' is') + ' working on the rest.');

    const rows = [
      { label: 'Somebody out front', met: met[0],
        note: subj.leadName ? (youLead ? 'You’re leading this one.' : subj.leadName + ' is leading this one.') : 'Nobody’s taken it on yet.',
        actionable: false, locked: false, act: null },
      { label: 'A place for it', met: spot,
        note: subj.spot ? subj.spot : (spot ? 'There’s a place in mind.' : 'No spot settled — open to suggestions.'),
        actionable: !spot, locked: false, act: spot ? null : () => setState({ offerKind: 'spot', offerText: '' }) },
      { label: 'A day it happens', met: day,
        note: subj.day ? subj.day : (day ? 'There’s a day in mind.' : nDates ? nDates + (nDates === 1 ? ' date' : ' dates') + ' up for a vote — ' + (youLead ? 'lock one in when you’re ready.' : 'the lead locks one in.') : youLead ? 'Put up to three dates to vote on.' : 'No day yet — anybody can float one.'),
        actionable: !day && !youLead, locked: false, act: day || youLead ? null : (nDates ? openRsvp : () => setState({ offerKind: 'day', offerText: '' })) },
      { label: 'Basics established', met: !!subj.basics,
        note: subj.basics ? 'The lead says the essentials are covered.' : (subj.leadName ? (youLead ? 'Your call — mark it when the essentials are covered.' : 'The lead’s call, once the essentials are covered.') : 'Unlocks once somebody’s out front.'),
        actionable: youLead && !subj.basics, locked: !subj.leadName,
        act: youLead && !subj.basics ? () => patch(subj.id, { basics: true }) : null }
    ];

    const checkpoints = rows.map(r => {
      const mark = r.met
        ? 'flex:0 0 20px;width:20px;height:20px;border-radius:999px;background:' + c.bar + ';display:flex;align-items:center;justify-content:center;margin-top:2px'
        : 'flex:0 0 20px;width:20px;height:20px;border-radius:999px;border:1.5px ' + (r.locked ? 'solid' : 'dashed') + ' #cfd3db;background:' + (r.locked ? '#f2f3f6' : '#fff') + ';display:flex;align-items:center;justify-content:center;margin-top:2px';
      return '<div ' + (r.actionable ? on(r.act) : '') + ' style="display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-top:1px solid #f2f3f6;opacity:' + (r.locked ? .55 : 1) + ';cursor:' + (r.actionable ? 'pointer' : 'default') + '">' +
        '<span style="' + mark + '">' + (r.met ? CHECK(12, '#fff', 3.2) : '') + (r.locked ? LOCK(11, '#9aa0ac', 2.2) : '') + '</span>' +
        '<div style="flex:1 1 auto">' +
          '<div style="font-size:15.5px;font-weight:800;letter-spacing:-.2px;color:' + (r.met ? '#0d1117' : '#2b303a') + '">' + r.label + '</div>' +
          '<div style="font-size:13.5px;line-height:1.4;font-weight:500;color:#6b7280">' + esc(r.note) + '</div>' +
        '</div>' +
        (r.actionable ? CHEV_R(16, '#5b4ae8', 2.4) : '') +
      '</div>';
    });

    const bits = subj.bits || [];
    const offers = subj.offers || [];
    const pill = (label) =>
      '<div style="margin-top:16px;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.18);border-radius:999px;padding:9px 14px;width:fit-content">' +
        '<span style="width:8px;height:8px;border-radius:999px;background:#fff"></span>' +
        '<span style="font-size:13px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#fff">' + label + '</span>' +
      '</div>';
    const offerChip = (label, fn, onWhite) => '<span class="hov-outline" ' + on(fn) + ' style="' + OFFER_CHIP + (onWhite ? ';background:#fff' : '') + '">' + label + '</span>';

    return '<div data-screen-label="Detail">' +
      '<header style="background:#fff;padding:16px 20px;display:flex;align-items:center;gap:14px">' +
        '<div ' + on(() => go('browse')) + ' aria-label="Back" style="' + ROUND_ICON(38) + '">' + CHEV_L(18, '#0d1117', 2.2) + '</div>' +
        '<div>' +
          '<div style="font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#5b4ae8">Torrez Fitness</div>' +
          '<div style="font-size:19px;font-weight:800;letter-spacing:-.3px;color:#0d1117">Idea</div>' +
        '</div>' +
      '</header>' +
      '<div style="position:relative;background:' + c.bar + ';padding:26px 20px 28px">' +
        (st.tag ? '<div style="position:absolute;top:14px;right:16px;transform:rotate(5deg);background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:800;color:#0d1117;box-shadow:0 8px 20px rgba(15,18,25,.18);animation:popIn 320ms cubic-bezier(.22,.9,.28,1) both">' + esc(st.tag) + '</div>' : '') +
        '<div style="font-size:12.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.82)">Spark</div>' +
        '<div style="margin-top:10px;font-size:29px;line-height:1.14;font-weight:900;letter-spacing:-.8px;color:#fff;text-wrap:pretty">' + esc(subj.text) + '</div>' +
        '<div style="margin-top:18px;display:flex;align-items:center;gap:10px">' +
          '<span style="width:32px;height:32px;border-radius:999px;background:rgba(255,255,255,.22);color:#fff;font-size:13.5px;font-weight:800;display:flex;align-items:center;justify-content:center">' + esc(subj.who.charAt(0)) + '</span>' +
          '<span style="font-size:13.5px;font-weight:700;color:#fff">' + esc(subj.who) + '</span>' +
          '<span style="width:3px;height:3px;border-radius:999px;background:rgba(255,255,255,.6)"></span>' +
          '<span style="font-size:13.5px;font-weight:500;color:rgba(255,255,255,.85)">' + esc(whenOf(subj)) + '</span>' +
        '</div>' +
        (exec ? pill('Deciding &amp; executing') : '') +
        (!subj.leadName ? pill('Needs a lead') : '') +
      '</div>' +

      '<div style="padding:18px 16px 26px;display:flex;flex-direction:column;gap:14px">' +
        (facts.length
          ? '<div style="' + CARD + ';padding:8px 18px">' +
              facts.map((f, i) =>
                '<div style="display:flex;gap:12px;padding:14px 0' + (i < facts.length - 1 ? ';border-bottom:1px solid #eff0f3' : '') + '">' +
                  '<span style="flex:0 0 9px;width:9px;height:9px;border-radius:999px;background:' + c.bar + ';margin-top:' + f.dotTop + 'px"></span>' +
                  '<span style="font-size:15.5px;line-height:1.45;font-weight:500;color:#0d1117">' + esc(f.line) + '</span>' +
                '</div>').join('') +
            '</div>'
          : '<div style="' + CARD + ';padding:18px;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">Just the idea so far. That’s a perfectly good place for it to sit.</div>') +

        (subj.vibe || bits.length
          ? '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:14px">' +
              (subj.vibe ? '<div><div style="' + EYEBROW + '">The vibe</div><div style="margin-top:4px;font-size:17px;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + esc(subj.vibe) + '</div></div>' : '') +
              (bits.length
                ? '<div style="display:flex;flex-direction:column;gap:8px"><div style="' + EYEBROW + '">Hoping for</div>' +
                    bits.map(b => '<div style="display:flex;gap:10px"><span style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:#e8a71c;margin-top:8px"></span><span style="font-size:15.5px;line-height:1.45;font-weight:500;color:#0d1117">' + esc(b) + '</span></div>').join('') +
                  '</div>'
                : '') +
            '</div>'
          : '') +

        (nDates > 0
          ? '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:12px">' +
              '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">' +
                '<div style="' + EYEBROW + '">' + (lockedId ? 'The date' : 'Dates on the table') + '</div>' +
                '<div style="font-size:13px;font-weight:700;color:#6b7280">' + (rsvps.length === 0 ? 'No RSVPs yet' : going + ' in' + (none.length ? ' · ' + none.length + ' can’t make these' : '')) + '</div>' +
              '</div>' +
              (subj.minPeople ? '<div style="margin-top:-4px;font-size:13.5px;font-weight:700;color:#454b55">Success is ' + subj.minPeople + ' or more, counting the lead</div>' : '') +
              dateRows.join('') +
              (none.length
                ? '<div style="border-top:1px solid #eff0f3;padding-top:12px;display:flex;flex-direction:column;gap:8px">' +
                    '<div style="font-size:15px;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + (none.length === 1 ? '1 interested, but none of these work' : none.length + ' interested, but none of these work') + '</div>' +
                    (youLead
                      ? '<div style="display:flex;flex-direction:column;gap:6px">' +
                          none.map(r =>
                            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f7f7f9;border-radius:12px;padding:10px 12px">' +
                              '<span style="font-size:14.5px;font-weight:700;color:#0d1117">' + esc(r.mine ? 'You' : r.name) + '</span>' +
                              '<a href="tel:' + esc(r.phone.replace(/[^\d+]/g, '')) + '" style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800;color:#5b4ae8;text-decoration:none">' +
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5b4ae8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>' +
                                esc(r.phone) +
                              '</a>' +
                            '</div>').join('') +
                        '</div>'
                      : '') +
                    '<p style="margin:0;font-size:13.5px;line-height:1.45;font-weight:500;color:#5c6270">' + esc(youLead ? 'That one’s yours to chase. Give them a call and see if there’s a day that works for more of the group.' : (subj.leadName || 'The lead') + ' sees these and reaches out directly.') + '</p>' +
                  '</div>'
                : '') +
              (!youLead ? '<button type="button" class="hov-primary" ' + on(openRsvp) + ' style="' + PRIMARY + '">' + (mine ? 'Change my RSVP' : 'RSVP') + '</button>' : '') +
              (youLead && nDates < 3 && !lockedId ? '<button type="button" class="hov-outline" ' + on(() => setState({ offerKind: 'date', offerText: '' })) + ' style="' + OUTLINE_BTN + ';padding:15px;font-size:15.5px">Add a date option (' + nDates + ' of 3)</button>' : '') +
            '</div>'
          : '') +

        (youLead && nDates === 0 && !subj.day
          ? '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:12px">' +
              '<div style="' + EYEBROW + '">Pick a day</div>' +
              '<div style="font-size:17px;line-height:1.35;font-weight:800;letter-spacing:-.2px;color:#0d1117">Put up to three dates to vote on.</div>' +
              '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">Everyone RSVPs to the ones that work, with a name and number. You see which date has the most support and lock it in.</p>' +
              '<button type="button" class="hov-primary" ' + on(() => setState({ offerKind: 'date', offerText: '' })) + ' style="' + PRIMARY + '">Add a date option</button>' +
            '</div>'
          : '') +

        (subj.vision
          ? '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:8px">' +
              '<div style="' + EYEBROW + '">' + esc(youLead ? 'What you’re picturing' : 'What ' + subj.leadName + ' is picturing') + '</div>' +
              '<p style="margin:0;font-size:15.5px;line-height:1.5;font-weight:500;color:#2b303a">' + esc(subj.vision) + '</p>' +
            '</div>'
          : '') +

        (youLead ? '<button type="button" class="hov-outline" ' + on(() => setState({ offerKind: 'vision', offerText: subj.vision || '' })) + ' style="' + OUTLINE_BTN + '">' + (subj.vision ? 'Change what you wrote' : 'Say more about what you’re picturing') + '</button>' : '') +

        (flow(subj).length ? '<button type="button" class="hov-outline" ' + on(() => go('questions', { qi: 0, adding: true, tag: null })) + ' style="' + OUTLINE_BTN + '">Add a little to this</button>' : '') +

        (exec
          ? '<div style="' + CARD + ';padding:20px 18px;display:flex;flex-direction:column;gap:10px">' +
              '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#0f7a3c">Everything’s in place</div>' +
              '<div style="font-size:19px;line-height:1.3;font-weight:800;letter-spacing:-.3px;color:#0d1117">' + esc(youLead ? 'You’re out front, with a day, a place, and the basics covered.' : subj.leadName + ' is out front, with a day, a place, and the basics covered.') + '</div>' +
              '<div style="display:flex;flex-direction:column;gap:2px">' +
                [['Out front', youLead ? 'You' : subj.leadName], ['Place', subj.spot || 'There’s a place in mind.'], ['Day', subj.day || 'There’s a day in mind.'], ['Basics', 'Essentials covered — the lead says go']].map(([l, v]) =>
                  '<div style="display:flex;align-items:flex-start;gap:11px;padding:10px 0;border-top:1px solid #f2f3f6">' +
                    '<span style="flex:0 0 15px;margin-top:4px;display:flex">' + CHECK(15, '#0f7a3c', 3.2) + '</span>' +
                    '<div style="flex:1 1 auto">' +
                      '<div style="font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#6b7280">' + l + '</div>' +
                      '<div style="margin-top:2px;font-size:15.5px;line-height:1.4;font-weight:700;letter-spacing:-.2px;color:#0d1117">' + esc(v) + '</div>' +
                    '</div>' +
                  '</div>').join('') +
              '</div>' +
              '<p style="margin:2px 0 0;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">The calls from here — what’s still needed, who’s bringing it — sit with whoever’s out front and whoever they pull in.</p>' +
            '</div>'
          : '<div style="' + CARD + ';padding:20px 18px;display:flex;flex-direction:column;gap:14px">' +
              '<div>' +
                '<div style="' + EYEBROW + '">How close this is</div>' +
                '<div style="margin-top:10px;display:flex;gap:6px">' + met.map(m => '<span style="flex:1 1 0;height:7px;border-radius:999px;background:' + (m ? c.bar : '#e4e7ec') + '"></span>').join('') + '</div>' +
                '<div style="margin-top:10px;font-size:15.5px;line-height:1.4;font-weight:700;letter-spacing:-.2px;color:#0d1117">' + esc(line) + '</div>' +
              '</div>' +
              '<div style="display:flex;flex-direction:column;gap:2px">' + checkpoints.join('') + '</div>' +
              (!subj.leadName
                ? '<div style="display:flex;flex-direction:column;gap:10px">' +
                    '<button type="button" class="hov-primary" ' + on(() => patch(subj.id, { leadName: 'You' }, { claim: true })) + ' style="' + PRIMARY + '">I’ll take the lead on this</button>' +
                    '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">Leading isn’t doing it all yourself. It means somebody’s out front, so the idea doesn’t sit and wait.</p>' +
                  '</div>'
                : '') +
              (youLead ? '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">You’re out front on this one. If it stops being yours to carry, step back and hand it down — it goes back to the group, not in the bin.</p>' : '') +
              '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
                offerChip('Offer a spot', () => setState({ offerKind: 'spot', offerText: '' })) +
                (!youLead && nDates === 0 ? offerChip('Offer a day', () => setState({ offerKind: 'day', offerText: '' })) : '') +
                offerChip('I can help with something', () => setState({ offerKind: 'help', offerText: '' })) +
              '</div>' +
            '</div>') +

        (offers.length
          ? '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:10px">' +
              '<div style="' + EYEBROW + '">Who’s already in</div>' +
              offers.map(o =>
                '<div style="display:flex;gap:10px">' +
                  '<span style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:' + c.bar + ';margin-top:7px"></span>' +
                  '<span style="font-size:14.5px;line-height:1.42;font-weight:500;color:#454b55"><strong style="font-weight:800;color:#0d1117">' + esc(o.who) + '</strong> ' + esc(o.line) + '</span>' +
                '</div>').join('') +
            '</div>'
          : '') +

        (exec ? '<div style="display:flex;flex-wrap:wrap;gap:8px">' + offerChip('I can help with something', () => setState({ offerKind: 'help', offerText: '' }), true) + '</div>' : '') +
      '</div>' +
      '<div style="height:73px"></div>' +
    '</div>';
  }

  // ---- Compose (multi-step) --------------------------------------------------

  function viewCompose() {
    const st = state;
    const actReady = st.activity.trim().length > 0;
    const locReady = st.locMode === 'open' || (st.locMode === 'specific' && st.locText.trim().length > 0);
    const whenReady = st.whenMode === 'open' || (st.whenMode === 'one' && st.dateOne.length > 0);
    const closeCompose = () => {
      if (st.step !== 'activity') { setState({ step: 'activity' }); return; }
      go('home', { activity: '', vibe: '', hopes: [], leadInfo: false });
    };
    let body = '';

    if (st.step === 'activity') {
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:16px">' +
        '<h2 style="margin:0;font-size:34px;line-height:1.04;font-weight:900;letter-spacing:-1px;color:#0d1117;text-wrap:pretty">What’s your idea?</h2>' +
        '<p style="margin:-6px 0 0;font-size:15.5px;line-height:1.42;font-weight:500;color:#5c6270;text-wrap:pretty">Something you’d like to do with the group: a walk, a workout, a night out.</p>' +
        '<div><textarea class="fld" rows="2" maxlength="80" aria-label="Your idea" placeholder="E.g. a sunrise walk, laser tag, pickleball at the park" ' + onInput(e => setState({ activity: e.target.value.slice(0, 80) })) +
          ' style="width:100%;display:block;background:#fff;border:2px solid #e6e7eb;border-radius:18px;padding:16px 18px;font-size:21px;line-height:1.35;font-weight:700;letter-spacing:-.3px;color:#0d1117;resize:none;outline:none">' + esc(st.activity) + '</textarea></div>' +
        '<button type="button" ' + on(() => { if (actReady) setState({ step: 'location' }); }) + ' aria-disabled="' + !actReady + '" style="' + btn(actReady).replace('margin-top:4px', 'margin-top:2px') + '">Next</button>' +
        backLink(closeCompose) +
      '</div>';
    }

    if (st.step === 'location') {
      const a = optVals(st.locMode === 'specific'), b = optVals(st.locMode === 'open');
      const pickSpecific = () => { if (st.locMode !== 'specific') setState({ locMode: 'specific' }); };
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:12px">' +
        '<div>' + stepEyebrow() +
          '<h2 style="margin:6px 0 0;font-size:31px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">Location</h2>' +
          '<p style="margin:8px 0 0;font-size:15.5px;line-height:1.42;font-weight:500;color:#5c6270">Name a spot or choose later</p>' +
        '</div>' +
        '<div style="' + a.card + '">' +
          '<div ' + onArea(pickSpecific) + ' role="radio" aria-checked="' + (st.locMode === 'specific') + '" style="display:flex;align-items:flex-start;gap:12px;cursor:pointer">' +
            '<span style="' + a.dot + '"><span style="' + a.pip + '"></span></span>' +
            '<div style="flex:1 1 auto;display:flex;flex-direction:column;gap:10px">' +
              '<div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">I have a spot in mind</div>' +
              '<input class="fld" type="text" maxlength="80" aria-label="Location" placeholder="Enter the location" value="' + esc(st.locText) + '" ' +
                onInput(e => setState({ locText: e.target.value.slice(0, 80), locMode: 'specific' })) + ' ' + onFocus(pickSpecific) +
                ' style="width:100%;' + FIELD + ';border-radius:12px;padding:12px 14px">' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="' + b.card + '">' +
          '<div ' + onArea(() => setState({ locMode: 'open' })) + ' tabindex="0" role="radio" aria-checked="' + (st.locMode === 'open') + '" style="display:flex;align-items:flex-start;gap:12px;cursor:pointer">' +
            '<span style="' + b.dot + '"><span style="' + b.pip + '"></span></span>' +
            '<div style="flex:1 1 auto"><div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">We’ll decide later</div></div>' +
          '</div>' +
        '</div>' +
        '<button type="button" ' + on(() => { if (locReady) setState({ step: 'when' }); }) + ' aria-disabled="' + !locReady + '" style="' + btn(locReady) + '">Next</button>' +
        backLink(() => setState({ step: 'activity' })) +
      '</div>';
    }

    if (st.step === 'when') {
      const a = optVals(st.whenMode === 'one'), b = optVals(st.whenMode === 'open');
      const pickOne = () => { if (st.whenMode !== 'one') setState({ whenMode: 'one' }); };
      const timeOpts = Array.from({ length: 48 }, (_, i) => {
        const hh = Math.floor(i / 2), mm = i % 2 ? '30' : '00';
        const v = String(hh).padStart(2, '0') + ':' + mm;
        return '<option value="' + v + '"' + (v === st.timeOne ? ' selected' : '') + '>' + (hh % 12 || 12) + ':' + mm + (hh < 12 ? ' am' : ' pm') + '</option>';
      }).join('');
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:12px">' +
        '<div>' + stepEyebrow() +
          '<h2 style="margin:6px 0 0;font-size:31px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">Date &amp; time</h2>' +
          '<p style="margin:8px 0 0;font-size:15.5px;line-height:1.42;font-weight:500;color:#5c6270">Pick a date or decide together later.</p>' +
        '</div>' +
        '<div style="' + a.card + '">' +
          '<div ' + onArea(pickOne) + ' role="radio" aria-checked="' + (st.whenMode === 'one') + '" style="display:flex;align-items:flex-start;gap:12px;cursor:pointer">' +
            '<span style="' + a.dot + '"><span style="' + a.pip + '"></span></span>' +
            '<div style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:10px">' +
              '<div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">I have a date</div>' +
              '<input class="fld" type="date" aria-label="Date" min="2026-10-01" max="2026-10-31" value="' + esc(st.dateOne) + '" ' +
                onInput(e => setState({ dateOne: e.target.value, whenMode: 'one' })) + ' ' + onFocus(pickOne) +
                ' style="width:100%;min-width:0;min-height:50px;' + FIELD + ';border-radius:12px;padding:10px 12px;color-scheme:light">' +
              (st.timeOn
                ? '<div style="display:flex;align-items:center;gap:8px">' +
                    '<select class="fld" aria-label="Time" ' + onInput(e => setState({ timeOne: e.target.value, whenMode: 'one' })) +
                      ' style="flex:1 1 auto;min-width:0;min-height:50px;' + FIELD + ';border-radius:12px;padding:10px 12px;color-scheme:light">' + timeOpts + '</select>' +
                    '<div ' + on(() => setState({ timeOn: false, timeOne: '' })) + ' aria-label="Remove time" style="' + ROUND_ICON(44) + '">' + X(14, '#5c6270', 2.4) + '</div>' +
                  '</div>'
                : '<div ' + on(() => setState({ timeOn: true, whenMode: 'one', timeOne: st.timeOne || '18:00' })) + ' style="display:flex;align-items:center;gap:6px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer;width:fit-content">' +
                    plus(14, '#5b4ae8', 2.6) + 'Add a time</div>') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="' + b.card + '">' +
          '<div ' + onArea(() => setState({ whenMode: 'open' })) + ' tabindex="0" role="radio" aria-checked="' + (st.whenMode === 'open') + '" style="display:flex;align-items:flex-start;gap:12px;cursor:pointer">' +
            '<span style="' + b.dot + '"><span style="' + b.pip + '"></span></span>' +
            '<div style="flex:1 1 auto"><div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">We’ll decide later</div></div>' +
          '</div>' +
        '</div>' +
        '<button type="button" ' + on(() => { if (whenReady) setState({ step: 'headcount' }); }) + ' aria-disabled="' + !whenReady + '" style="' + btn(whenReady) + '">Next</button>' +
        backLink(() => setState({ step: 'location' })) +
      '</div>';
    }

    if (st.step === 'headcount') {
      const okN = st.minPeople > 0;
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:12px">' +
        '<div>' + stepEyebrow() +
          '<h2 style="margin:6px 0 0;font-size:31px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">Head count</h2>' +
        '</div>' +
        '<div style="background:#fff;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
          '<div>' +
            '<div style="font-size:17px;line-height:1.3;font-weight:800;letter-spacing:-.3px;color:#0d1117;text-wrap:pretty">What’s the fewest people it would take to make this worth doing?</div>' +
            '<p style="margin:4px 0 0;font-size:13.5px;line-height:1.4;font-weight:500;color:#6b7280">Counting you. A rough number is fine.</p>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:14px">' +
            '<div ' + on(() => setState({ minPeople: Math.max(0, st.minPeople - 1) })) + ' aria-label="Fewer" style="' + ROUND_ICON(48) + '">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d1117" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></div>' +
            '<input class="fld" type="number" inputmode="numeric" min="0" max="99" aria-label="Minimum people" value="' + st.minPeople + '" ' +
              onInput(e => { const v = parseInt(e.target.value, 10); setState({ minPeople: isNaN(v) ? 0 : Math.max(0, Math.min(99, v)) }); }) +
              ' style="width:72px;text-align:center;background:#fff;border:2px solid #e6e7eb;border-radius:14px;padding:10px 6px;font-family:inherit;font-size:24px;font-weight:900;color:#0d1117;outline:none">' +
            '<div ' + on(() => setState({ minPeople: Math.min(99, st.minPeople + 1) })) + ' aria-label="More" style="' + ROUND_ICON(48) + '">' + plus(16, '#0d1117', 2.6) + '</div>' +
            '<span style="font-size:15px;font-weight:700;color:#454b55">people</span>' +
          '</div>' +
        '</div>' +
        '<button type="button" ' + on(() => { if (okN) setState({ step: 'specifics' }); }) + ' aria-disabled="' + !okN + '" style="' + btn(okN) + '">Next</button>' +
        backLink(() => setState({ step: 'when' })) +
      '</div>';
    }

    if (st.step === 'specifics') {
      const hopes = st.hopes.map((v, i) =>
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<input class="fld" type="text" maxlength="60" aria-label="Something you’d love to see happen" placeholder="' + (i === 0 ? 'Something you’re hoping for' : 'One more') + '" value="' + esc(v) + '" ' +
            onInput(e => { const h = st.hopes.slice(); h[i] = e.target.value.slice(0, 60); setState({ hopes: h }); }) +
            ' style="flex:1 1 auto;min-width:0;' + FIELD + ';border-radius:14px;padding:13px 16px">' +
          '<div ' + on(() => setState({ hopes: st.hopes.filter((_, j) => j !== i) })) + ' aria-label="Remove" style="' + ROUND_ICON(44) + '">' + X(14, '#5c6270', 2.4) + '</div>' +
        '</div>').join('');
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:14px">' +
        '<div>' + stepEyebrow() +
          '<h2 style="margin:6px 0 0;font-size:31px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">A couple more specifics</h2>' +
          '<p style="margin:8px 0 0;font-size:15.5px;line-height:1.42;font-weight:500;color:#5c6270">All optional. Skip anything you haven’t figured out.</p>' +
        '</div>' +
        '<div style="background:#fff;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
          '<label for="vibe" style="font-size:18px;font-weight:800;letter-spacing:-.3px;color:#0d1117">What’s the vibe you want?</label>' +
          '<input class="fld" id="vibe" type="text" maxlength="40" data-light placeholder="Chill, competitive, cozy" value="' + esc(st.vibe) + '" ' +
            onInput(e => setState({ vibe: e.target.value.slice(0, 40) })) + ' style="width:100%;' + FIELD + ';border-radius:14px;padding:13px 16px">' +
        '</div>' +
        '<div style="background:#fff;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
          '<div>' +
            '<div style="font-size:18px;font-weight:800;letter-spacing:-.3px;color:#0d1117">Two things you’d love to see happen</div>' +
            '<p style="margin:3px 0 0;font-size:14px;line-height:1.4;font-weight:500;color:#6b7280">Stop for ice cream, bring our kids, make it a tournament</p>' +
          '</div>' +
          hopes +
          (st.hopes.length < 2
            ? '<div class="hov-dash" ' + on(() => { if (st.hopes.length < 2) { setState({ hopes: st.hopes.concat(['']) }); focusLastHope(); } }) + ' style="display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border:1.5px dashed #cfd3db;border-radius:14px;font-size:15px;font-weight:800;color:#5b4ae8;cursor:pointer">' +
                plus(16, '#5b4ae8', 2.6) + (st.hopes.length === 0 ? 'Add something' : 'Add one more') + '</div>'
            : '') +
        '</div>' +
        '<div style="border-top:1px solid #e6e7eb;padding-top:14px;display:flex;flex-direction:column;gap:8px">' +
          '<div style="display:flex;gap:11px">' +
            '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5b4ae8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 19px;margin-top:2px" aria-hidden="true"><path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6l-7-2.8Z"/></svg>' +
            '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#454b55"><strong style="font-weight:800;color:#0d1117">Posting it means you’re holding it.</strong> Not doing it all yourself — just keeping it moving, or saying honestly when it’s time to let it sit.</p>' +
          '</div>' +
          '<div ' + on(() => setState({ leadInfo: true })) + ' style="display:flex;align-items:center;gap:6px;cursor:pointer;padding-left:30px;width:fit-content">' +
            '<span style="font-size:13.5px;font-weight:700;color:#5b4ae8">What holding it actually involves</span>' + CHEV_R(14, '#5b4ae8', 2.4) +
          '</div>' +
        '</div>' +
        '<button type="button" class="hov-primary" ' + on(() => { if (whenReady && locReady) createDraft(); }) + ' style="' + btn(true) + '">Put it up</button>' +
        backLink(() => setState({ step: 'headcount' })) +
      '</div>';
    }

    return '<div class="overlay-screen" data-screen-label="New spark">' + subHeader('Post your idea', closeCompose, true) + body + '</div>';
  }

  function focusLastHope() {
    const inputs = document.querySelectorAll('[data-screen-label="New spark"] input[maxlength="60"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  // ---- Questions ------------------------------------------------------------

  function viewQuestions(subj) {
    const st = state;
    const fl = flow(subj);
    const qKey = fl[Math.min(st.qi, fl.length - 1)];
    const prompt = PROMPTS[qKey];
    const picked = subj.answers[qKey];
    const lastQ = st.qi >= fl.length - 1;
    const options = prompt.opts.map(([label, value], i) => {
      const isOn = picked === value;
      return '<div ' + onArea(() => answer(qKey, value)) + ' tabindex="0" role="radio" aria-checked="' + isOn + '" style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1.5px solid ' + (isOn ? OPT_CHEV[i] : OPT_TINTS[i]) + ';background:' + OPT_TINTS[i] + ';border-radius:14px;padding:15px 16px;cursor:pointer">' +
        '<span style="font-size:15.5px;font-weight:700;color:#0d1117">' + label + '</span>' +
        '<span style="' + (isOn
          ? 'flex:0 0 20px;width:20px;height:20px;border-radius:999px;background:' + OPT_CHEV[i] + ';display:flex;align-items:center;justify-content:center'
          : 'flex:0 0 20px;width:20px;height:20px;border-radius:999px;border:1.5px solid rgba(15,18,25,.16)') + '">' + (isOn ? CHECK(12, '#fff', 3.2) : '') + '</span>' +
      '</div>';
    }).join('');
    const dots = fl.map((k, i) => '<span style="width:' + (i === st.qi ? 16 : 6) + 'px;height:6px;border-radius:999px;background:' + (i === st.qi ? '#5b4ae8' : (subj.answers[k] ? '#c3bdf7' : '#dfe2e8')) + '"></span>').join('');
    const addingEyebrow = subj.who === 'You' ? 'Adding to your idea' : 'Adding to ' + subj.who.toUpperCase() + '’S IDEA';

    return '<div class="overlay-screen" data-screen-label="Questions">' +
      subHeader('A few quick ones', leave, true) +
      '<div style="padding:18px 16px 26px;display:flex;flex-direction:column;gap:14px">' +
        (!st.adding
          ? '<div style="background:#0d1117;border-radius:18px;padding:18px 18px 20px;animation:popIn 300ms cubic-bezier(.22,.9,.28,1) both">' +
              '<div style="font-size:13px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#b9b1ff">Your idea</div>' +
              '<div style="margin-top:8px;max-width:260px;font-size:19px;line-height:1.3;font-weight:800;letter-spacing:-.3px;color:#fff">' + esc(subj.text) + '</div>' +
            '</div>'
          : '<div style="' + CARD + ';padding:18px">' +
              '<div style="font-size:13px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#5b4ae8">' + esc(addingEyebrow) + '</div>' +
              '<div style="margin-top:8px;font-size:16px;line-height:1.35;font-weight:700;color:#0d1117">' + esc(subj.text) + '</div>' +
            '</div>') +
        '<div style="' + CARD + ';padding:20px 18px;display:flex;flex-direction:column;gap:12px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
            '<div style="background:#f3f1fe;border-radius:999px;padding:7px 13px;font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#5b4ae8">Only if you feel like it</div>' +
            '<div style="display:flex;gap:5px">' + dots + '</div>' +
          '</div>' +
          '<h2 style="margin:0;font-size:27px;line-height:1.06;font-weight:900;letter-spacing:-.7px;color:#0d1117;text-wrap:pretty">' + prompt.q + '</h2>' +
          '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#6b7280">' + prompt.hint + '</p>' +
          '<div role="radiogroup" style="display:flex;flex-direction:column;gap:10px;margin-top:2px">' + options + '</div>' +
          '<button type="button" ' + on(advance) + ' style="' + smallBtn(!!picked, true).replace('cursor:not-allowed', 'cursor:pointer') + '">' + (lastQ ? 'Done' : 'Next') + '</button>' +
          (st.qi > 0 ? backLink(() => setState({ qi: Math.max(0, st.qi - 1) })) : '') +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
            '<span ' + on(advance) + ' style="display:flex;align-items:center;gap:6px;font-size:15px;font-weight:600;color:#6b7280;cursor:pointer">Skip this one' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M12.5 6l6 6-6 6"/></svg>' +
            '</span>' +
            '<span ' + on(finish) + ' style="font-size:15px;font-weight:800;color:#0d1117;cursor:pointer">' + (st.adding ? 'I’m good for now' : 'That’s enough for now') + '</span>' +
          '</div>' +
        '</div>' +
        '<p style="margin:0 4px;font-size:14.5px;line-height:1.45;font-weight:500;color:#6b7280">' +
          (st.adding ? 'Their idea’s already out there. These are shortcuts for whoever reads it — stop whenever you like.' : 'It’s already up. These just save the next person a question — skip any of them.') +
        '</p>' +
      '</div>' +
    '</div>';
  }

  // ---- Modals ---------------------------------------------------------------

  function viewModals(subj) {
    const st = state;
    let out = '';

    if (st.claim) {
      const close = () => setState({ claim: false });
      out += '<div class="modal-scrim" data-scrim="' + reg(close) + '" style="z-index:25">' +
        '<div role="dialog" aria-modal="true" aria-labelledby="claim-h" style="position:relative;width:100%;max-width:330px;max-height:82%;overflow:auto;background:#fff;border-radius:22px;padding:24px 20px 22px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 60px rgba(15,18,25,.3);animation:popIn 300ms cubic-bezier(.22,.9,.28,1) both">' +
          modalClose(close) +
          '<div style="display:flex;gap:6px">' +
            '<span style="width:9px;height:9px;border-radius:2px;background:#e8a71c;transform:rotate(18deg)"></span>' +
            '<span style="width:9px;height:9px;border-radius:2px;background:#5b4ae8;transform:rotate(-12deg)"></span>' +
            '<span style="width:9px;height:9px;border-radius:2px;background:#149a4b;transform:rotate(24deg)"></span>' +
            '<span style="width:9px;height:9px;border-radius:2px;background:#e2556b;transform:rotate(-20deg)"></span>' +
          '</div>' +
          '<h3 id="claim-h" style="margin:0;padding-right:36px;font-size:24px;line-height:1.1;font-weight:900;letter-spacing:-.6px;color:#0d1117">You’re out front on this one.</h3>' +
          '<p style="margin:0;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">Good on you. This one’s been sitting out here waiting for somebody, and now it isn’t.</p>' +
          '<p style="margin:0;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">It doesn’t mean you do it all yourself — plenty of hands will turn up. It does mean you’re the one carrying it: you say when, you say where, and when it comes down to a call, the call is yours.</p>' +
          '<p style="margin:0;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">Don’t go it alone, though. Find one person to think it through with — somebody who already likes this idea is the easiest ask you’ll make all week.</p>' +
          '<button type="button" class="hov-primary" ' + on(close) + ' style="margin-top:4px;width:100%;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16.5px;font-weight:800;padding:16px;cursor:pointer">Alright, let’s get it going</button>' +
        '</div>' +
      '</div>';
    }

    if (st.rsvpOpen && subj) {
      const phoneOk = st.rsvpPhone.replace(/\D/g, '').length >= 7;
      const rsvpReady = (st.rsvpDates.length > 0 || st.rsvpNone) && st.rsvpName.trim().length > 0 && phoneOk;
      const box = (isOn) => isOn
        ? 'flex:0 0 22px;width:22px;height:22px;border-radius:7px;background:#5b4ae8;display:flex;align-items:center;justify-content:center'
        : 'flex:0 0 22px;width:22px;height:22px;border-radius:7px;border:1.5px solid #cfd3db;background:#fff';
      const optRow = (isOn) => 'display:flex;align-items:center;gap:12px;min-height:52px;padding:12px 14px;border-radius:14px;border:1.5px solid ' + (isOn ? '#5b4ae8' : '#e6e7eb') + ';background:' + (isOn ? '#f3f1fe' : '#fff') + ';cursor:pointer';
      const rsvps = subj.rsvps || [];
      const submit = () => {
        if (!rsvpReady) return;
        const entry = { name: cleanTitle(st.rsvpName), phone: st.rsvpPhone.trim(), dateIds: st.rsvpNone ? [] : st.rsvpDates.slice(), none: st.rsvpNone, mine: true };
        patch(subj.id, { rsvps: rsvps.filter(r => !r.mine).concat([entry]) }, { rsvpOpen: false, tag: st.rsvpNone ? 'The lead will reach out' : 'You’re on the list' });
      };
      out += '<div class="modal-scrim" style="z-index:26">' +
        '<div role="dialog" aria-modal="true" aria-labelledby="rsvp-h" style="position:relative;width:100%;max-width:340px;max-height:100%;overflow-y:auto;background:#fff;border-radius:22px;padding:22px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 60px rgba(15,18,25,.3)">' +
          modalClose(() => setState({ rsvpOpen: false })) +
          '<h3 id="rsvp-h" style="margin:0;padding-right:36px;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Which dates work?</h3>' +
          '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#6b7280">Pick every one you could make.</p>' +
          '<div style="display:flex;flex-direction:column;gap:8px">' +
            (subj.dates || []).map(d => {
              const isOn = st.rsvpDates.indexOf(d.id) > -1;
              return '<div ' + onArea(() => setState({ rsvpNone: false, rsvpDates: isOn ? st.rsvpDates.filter(x => x !== d.id) : st.rsvpDates.concat([d.id]) })) + ' tabindex="0" role="checkbox" aria-checked="' + isOn + '" style="' + optRow(isOn) + '">' +
                '<span style="' + box(isOn) + '">' + (isOn ? CHECK(12, '#fff', 3.4) : '') + '</span>' +
                '<span style="font-size:15.5px;font-weight:700;color:#0d1117">' + esc(d.label) + '</span>' +
              '</div>';
            }).join('') +
            '<div ' + onArea(() => setState({ rsvpNone: !st.rsvpNone, rsvpDates: [] })) + ' tabindex="0" role="checkbox" aria-checked="' + st.rsvpNone + '" style="' + optRow(st.rsvpNone) + '">' +
              '<span style="' + box(st.rsvpNone) + '">' + (st.rsvpNone ? CHECK(12, '#fff', 3.4) : '') + '</span>' +
              '<span style="font-size:15px;line-height:1.35;font-weight:700;color:#0d1117">I’m interested, but none of these dates work for me</span>' +
            '</div>' +
          '</div>' +
          '<div style="border-top:1px solid #eff0f3;padding-top:12px;display:flex;flex-direction:column;gap:8px">' +
            '<input class="fld" type="text" maxlength="40" autocomplete="name" aria-label="Your name" placeholder="Your name" value="' + esc(st.rsvpName) + '" ' + onInput(e => setState({ rsvpName: e.target.value.slice(0, 40) })) + ' style="width:100%;' + FIELD + ';border-radius:14px;padding:13px 16px">' +
            '<input class="fld" type="tel" maxlength="20" autocomplete="tel" aria-label="Phone number" placeholder="Phone number" value="' + esc(st.rsvpPhone) + '" ' + onInput(e => setState({ rsvpPhone: e.target.value.slice(0, 20) })) + ' style="width:100%;' + FIELD + ';border-radius:14px;padding:13px 16px">' +
            '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Only the lead sees your number. It’s how they’ll reach you — plans get sorted by text, not in here.</p>' +
          '</div>' +
          '<button type="button" ' + on(submit) + ' aria-disabled="' + !rsvpReady + '" style="' + smallBtn(rsvpReady, false) + '">Send my RSVP</button>' +
        '</div>' +
      '</div>';
    }

    if (st.offerKind && subj) {
      const kind = st.offerKind;
      const copy = {
        spot: { title: 'Know a spot?', hint: 'Somewhere this could actually happen. The lead takes it from there.', ph: 'e.g. the loop trail at the lake', cta: 'Offer this spot' },
        day: { title: 'Got a day in mind?', hint: 'Rough is fine — a weekend, a month, a “before it gets cold”.', ph: 'e.g. Saturday the 12th, early', cta: 'Offer this day' },
        help: { title: 'What can you help with?', hint: 'Be specific if you can — a ride, a speaker, a cooler of water.', ph: 'e.g. I can bring a speaker and a cooler', cta: 'Send it over' },
        date: { title: 'Add a date option', hint: 'Up to three. Everyone RSVPs to the ones that work, and you lock one in.', ph: '', cta: 'Put it up for a vote' },
        vision: { title: 'Say more about it', hint: 'What you’re picturing, in your own words. It’s your idea — take the room.', ph: 'e.g. Nothing fancy. Meet in the gym lot, loop the lake, coffee after for whoever wants it.', cta: 'Add it to the spark' }
      }[kind] || { title: '', hint: '', ph: '', cta: '' };
      const offerReady = st.offerText.trim().length > 0;
      const close = () => setState({ offerKind: null, offerText: '' });
      out += '<div class="modal-scrim" data-scrim="' + reg(close) + '" style="z-index:25">' +
        '<div role="dialog" aria-modal="true" aria-labelledby="offer-h" style="position:relative;width:100%;max-width:330px;background:#fff;border-radius:22px;padding:22px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 60px rgba(15,18,25,.3);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
          modalClose(close) +
          '<h3 id="offer-h" style="margin:0;padding-right:36px;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + copy.title + '</h3>' +
          '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#6b7280">' + copy.hint + '</p>' +
          (kind === 'date'
            ? '<input class="fld" type="datetime-local" aria-label="Date and time" min="2026-10-01T00:00" max="2026-10-31T23:59" value="' + esc(st.offerText) + '" ' + onInput(e => setState({ offerText: e.target.value })) + ' style="width:100%;min-height:52px;' + FIELD + ';border-radius:14px;padding:12px 14px;color-scheme:light">'
            : '<textarea class="fld" rows="2" aria-label="' + esc(copy.title) + '" placeholder="' + esc(copy.ph) + '" ' + onInput(e => setState({ offerText: e.target.value })) + ' style="width:100%;display:block;background:#fff;border:2px solid #e6e7eb;border-radius:16px;padding:14px 16px;font-size:16px;line-height:1.4;font-weight:600;color:#0d1117;resize:none;outline:none">' + esc(st.offerText) + '</textarea>') +
          '<button type="button" ' + on(() => { if (offerReady) commitOffer(subj); }) + ' aria-disabled="' + !offerReady + '" style="' + smallBtn(offerReady, false) + '">' + copy.cta + '</button>' +
        '</div>' +
      '</div>';
    }

    if (st.leadInfo) {
      const close = () => setState({ leadInfo: false });
      out += '<div class="modal-scrim" data-scrim="' + reg(close) + '" style="z-index:20">' +
        '<div role="dialog" aria-modal="true" aria-labelledby="lead-h" style="position:relative;width:100%;max-width:330px;max-height:78%;overflow:auto;background:#fff;border-radius:22px;padding:22px 20px;display:flex;flex-direction:column;gap:10px;box-shadow:0 24px 60px rgba(15,18,25,.3);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
          modalClose(close) +
          '<h3 id="lead-h" style="margin:0;padding-right:40px;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Holding an idea</h3>' +
          '<p style="margin:0;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">It’s lighter than it sounds. You’re not signing up to do the work — you’re just the one who answers for what happens to the idea.</p>' +
          '<p style="margin:0;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">That means one of two things: keep it moving, or say out loud that it’s not the season for it and let it sit. Both are fine. Letting it go quiet without saying so is the only bad outcome.</p>' +
          '<p style="margin:0;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">Everyone turns up with spots, days and hands. When it comes down to a call, the call is yours — and you can hand it down to somebody else whenever you like.</p>' +
        '</div>' +
      '</div>';
    }
    return out;
  }

  function viewNav() {
    const screen = state.screen;
    const tab = (active) => 'padding:9px 0;min-height:44px;display:flex;align-items:center;justify-content:center;width:100%;color:' + (active ? '#5b4ae8' : '#5c6270') + ';cursor:pointer';
    const ic = (paths) => '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
    return '<nav class="tabbar" aria-label="Main">' +
      '<div ' + on(() => go('home')) + ' aria-label="Home" style="' + tab(screen === 'home') + '">' + ic('<path d="M3 10.5 12 3.5l9 7"/><path d="M5.5 9.5V20h13V9.5"/>') + '</div>' +
      '<div ' + on(() => go('how')) + ' aria-label="How this works" style="' + tab(screen === 'how') + '">' + ic('<path d="M12 6.5C10.5 5 8 4.3 4 4.5V18c4-.2 6.5.5 8 2 1.5-1.5 4-2.2 8-2V4.5c-4-.2-6.5.5-8 2Z"/><path d="M12 6.5V20"/>') + '</div>' +
      '<div ' + on(goCompose) + ' aria-label="Post an idea" style="width:44px;height:44px;border-radius:999px;background:#5b4ae8;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(91,74,232,.3);cursor:pointer">' + plus(23, '#fff', 2.5) + '</div>' +
      '<div ' + on(() => go('browse', { cats: [] })) + ' aria-label="All sparks" style="' + tab(screen === 'browse') + '">' + ic('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>') + '</div>' +
      '<div aria-label="Profile (coming soon)" style="' + tab(false) + '">' + ic('<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5c.6-3.8 3.6-5.8 7.2-5.8s6.6 2 7.2 5.8"/>') + '</div>' +
    '</nav>';
  }

  function view() {
    const screen = state.screen;
    const subj = subject();
    let main = '';
    if (screen === 'home') main = viewHome();
    else if (screen === 'browse') main = viewBrowse();
    else if (screen === 'how') main = viewHow();
    else if (subj && screen === 'detail') main = viewDetail(subj);
    return '<div class="scroller">' + main + '</div>' +
      (screen === 'compose' ? viewCompose() : '') +
      (screen === 'questions' && subj && flow(subj).length ? viewQuestions(subj) : '') +
      viewModals(subj) +
      viewNav();
  }

  // ---------------------------------------------------------------------------
  // Render + DOM morph
  // ---------------------------------------------------------------------------

  const root = document.getElementById('app');
  const tpl = document.createElement('template');
  let handlers = [];

  const isField = (el) => el.nodeName === 'INPUT' || el.nodeName === 'TEXTAREA' || el.nodeName === 'SELECT';

  function morphAttrs(from, to) {
    const fa = from.attributes, ta = to.attributes;
    for (let i = fa.length - 1; i >= 0; i--) {
      const name = fa[i].name;
      if (!to.hasAttribute(name)) from.removeAttribute(name);
    }
    for (let i = 0; i < ta.length; i++) {
      const { name, value } = ta[i];
      if (from.getAttribute(name) !== value) from.setAttribute(name, value);
    }
  }

  function morph(from, to) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) {
      from.replaceWith(to.cloneNode(true));
      return;
    }
    if (from.nodeType === 3 || from.nodeType === 8) {
      if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
      return;
    }
    if (from.nodeType !== 1) return;
    morphAttrs(from, to);

    if (from.nodeName === 'TEXTAREA') {
      const v = to.textContent;
      if (document.activeElement !== from && from.value !== v) from.value = v;
      return;
    }
    morphChildren(from, to);
    if (isField(from) && document.activeElement !== from) {
      if (from.nodeName === 'SELECT') {
        const sel = to.querySelector('option[selected]');
        if (sel && from.value !== sel.value) from.value = sel.value;
      } else if (from.value !== (to.getAttribute('value') || '')) {
        from.value = to.getAttribute('value') || '';
      }
    }
  }

  function morphChildren(from, to) {
    const fc = Array.from(from.childNodes), tc = Array.from(to.childNodes);
    for (let i = 0; i < tc.length; i++) {
      if (i < fc.length) morph(fc[i], tc[i]);
      else from.appendChild(tc[i].cloneNode(true));
    }
    for (let i = fc.length - 1; i >= tc.length; i--) from.removeChild(fc[i]);
  }

  function render() {
    H = [];
    const html = view();
    handlers = H;
    tpl.innerHTML = html;
    morphChildren(root, tpl.content);
  }

  // ---------------------------------------------------------------------------
  // Events (delegated)
  // ---------------------------------------------------------------------------

  root.addEventListener('click', (e) => {
    // Resolve the handler before any re-render can change indexes
    const scrim = e.target.closest('[data-scrim]');
    const el = e.target.closest('[data-on]');
    const fn = scrim && e.target === scrim
      ? handlers[+scrim.getAttribute('data-scrim')]
      : el ? handlers[+el.getAttribute('data-on')] : null;

    // Clicking outside the sort menu closes it
    if (state.menu && !e.target.closest('[data-menu]')) setState({ menu: null });
    if (fn) fn(e);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.offerKind) return setState({ offerKind: null, offerText: '' });
      if (state.rsvpOpen) return setState({ rsvpOpen: false });
      if (state.claim) return setState({ claim: false });
      if (state.leadInfo) return setState({ leadInfo: false });
      if (state.menu) return setState({ menu: null });
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-on][role]') && !isField(e.target)) {
      e.preventDefault();
      const fn = handlers[+e.target.getAttribute('data-on')];
      if (fn) fn(e);
    }
  });

  // 'change' as well: some native date/time pickers only fire change
  const onField = (e) => {
    const el = e.target.closest('[data-input]');
    if (!el) return;
    const fn = handlers[+el.getAttribute('data-input')];
    if (fn) fn(e);
  };
  root.addEventListener('input', onField);
  root.addEventListener('change', onField);

  root.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-focus]');
    if (!el) return;
    const fn = handlers[+el.getAttribute('data-focus')];
    if (fn) fn(e);
  });

  // Refresh relative timestamps once a minute
  setInterval(() => { if (!document.activeElement || !isField(document.activeElement)) render(); }, 60000);

  render();
})();
