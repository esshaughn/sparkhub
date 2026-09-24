/* Sparks — Torrez Fitness · Walktober
   Built from the Claude Design handoffs (currently "Walktober App v2.dc.html").

   Rendering: each state change re-renders the view to an HTML string and morphs
   it into the live DOM (keeps focus, caret and scroll position intact).
   Event handlers are registered per render and referenced by index via
   data-on / data-input / data-focus attributes.

   Data: Supabase (see supabase/migrations/; js/config.js picks live vs test). Every visitor gets an anonymous
   session; row-level security decides who can edit a spark and who can see
   RSVP names and numbers (only the lead). */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Data (verbatim from the design file)
  // ---------------------------------------------------------------------------

  const CATS = {
    events:   { label: 'Walktober',   bar: '#e8a71c', ink: '#8f6405', tint: '#fdf4e2' },
    projects: { label: 'Projects',    bar: '#5b4ae8', ink: '#4a3ad4', tint: '#f0eeff' },
    aid:      { label: 'Helping out', bar: '#149a4b', ink: '#0f7a3c', tint: '#e7f6ec' },
    fresh:    { label: 'Fresh idea',  bar: '#c97a12', ink: '#a9640d', tint: '#fbf1e3' }
  };
  const KEYS = ['resource', 'place', 'when', 'people'];
  const CAT_FLOW = {
    events: [],
    aid: ['people'],
    projects: ['resource', 'place', 'people', 'when'],
    fresh: ['place', 'when', 'people']
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
  const SORTS = [['new', 'Newest'], ['old', 'Oldest'], ['popular', 'Most popular']];
  const OFFER_LINES = { spot: 'offered a spot: ', day: 'floated a day: ', help: 'can help: ' };

  // ---------------------------------------------------------------------------
  // Supabase client + per-device prefs
  // ---------------------------------------------------------------------------

  const CFG = window.SPARKS_CONFIG || {};
  const sb = window.supabase && CFG.supabaseUrl ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;

  // Only conveniences live in the browser: your name and number, so you don't retype them
  const PREFS_KEY = 'sparks-torrez-prefs';
  const loadPrefs = () => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
  };
  let lastPrefs = '';
  const savePrefs = () => {
    const next = JSON.stringify({ myName: state.myName, rsvpName: state.rsvpName, rsvpPhone: state.rsvpPhone });
    if (next === lastPrefs) return;
    lastPrefs = next;
    try { localStorage.setItem(PREFS_KEY, next); } catch (e) { /* storage blocked: conveniences only */ }
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
  const whenOf = (s) => relTime(s.created);
  const hrsOf = (s) => (Date.now() - s.created) / 3600000;

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
  const ICON_PHOTO = (size, color, w) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="M20.5 15.5l-4.5-4.5-7.5 7.5"/></svg>';
  const ICON_PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>';
  const ICON_CAL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>';
  const BOLT_SOLID = (size, color) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (color || 'currentColor') + '" aria-hidden="true"><path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z"/></svg>';
  const ICON_PERSON = (size) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5c.6-3.8 3.6-5.8 7.2-5.8s6.6 2 7.2 5.8"/></svg>';
  const ICON_EDIT = (size) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.6 3.8l3.6 3.6L8.4 19.2 4 20.5l1.3-4.4L16.6 3.8Z"/></svg>';
  const ICON_TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9b1c31" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2l.9-12.2"/></svg>';
  const SHIELD = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5b4ae8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 19px;margin-top:2px" aria-hidden="true"><path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6l-7-2.8Z"/></svg>';
  const ARROW_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5b4ae8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  const SHIELD_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c6270" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 20px;margin-top:2px" aria-hidden="true"><path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6l-7-2.8Z"/><path d="M9.2 12.1l2.1 2.1 3.6-3.9"/></svg>';
  const PENCIL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c6270" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 20px;margin-top:2px" aria-hidden="true"><path d="M16.6 3.8l3.6 3.6L8.4 19.2 4 20.5l1.3-4.4L16.6 3.8Z"/></svg>';
  const CLOCK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c6270" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 20px;margin-top:2px" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.2 2"/></svg>';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const prefs = loadPrefs();
  const state = {
    screen: 'home', sort: 'new', menu: null,
    step: 'activity',
    activity: '', hopes: ['', '', ''], photos: [],
    locMode: 'specific', locText: '', whenMode: 'one', dateOne: '', timeOne: '', timeOn: false,
    offerKind: null, offerText: '',
    rsvpOpen: false, rsvpDates: [], rsvpNone: false,
    rsvpName: prefs.rsvpName || '', rsvpPhone: prefs.rsvpPhone || '',
    myName: prefs.myName || '', nameAsk: null, nameText: '',
    email: '', loginStep: null, loginMode: 'link', loginWhy: 'keep', loginThen: null, loginEmail: '', loginCode: '', resent: false, mergeToken: null,
    confirm: null, editText: '', editHopes: ['', '', ''],
    qi: 0, subjectId: null, adding: false, tag: null,
    me: null, loaded: false, error: null, toast: null, busy: false,
    sparks: []
  };

  // ---- URL <-> screen, so ideas can be shared and the back button works -----

  const ROUTES = { home: '', browse: '#/ideas', how: '#/how', profile: '#/me' };
  const hashFor = () => state.screen === 'detail' && state.subjectId
    ? '#/idea/' + state.subjectId
    : (ROUTES[state.screen] != null ? ROUTES[state.screen] : null);
  const syncHash = () => {
    const h = hashFor();
    if (h === null || (location.hash || '') === h) return;  // compose/questions keep the current URL
    history.pushState(null, '', h || location.pathname + location.search);
  };
  const fromHash = () => {
    const h = location.hash;
    const m = h.match(/^#\/idea\/([0-9a-f-]{36})$/);
    if (m) return { screen: 'detail', subjectId: m[1], tag: null };
    if (h === '#/ideas') return { screen: 'browse' };
    if (h === '#/how') return { screen: 'how' };
    if (h === '#/me') return { screen: 'profile' };
    return { screen: 'home' };
  };

  const setState = (patch) => {
    const prevStep = state.step, prevQi = state.qi, prevScreen = state.screen, prevSubj = state.subjectId;
    Object.assign(state, patch);
    savePrefs();
    render();
    if (state.step !== prevStep || state.qi !== prevQi) {
      const ov = document.querySelector('.overlay-screen');
      if (ov) ov.scrollTop = 0;
    }
    if (state.screen !== prevScreen || state.subjectId !== prevSubj) syncHash();
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
  const hasSpot = (s) => !!s.spot || s.answers.place === 'in-mind';
  const hasDay = (s) => !!s.day || s.answers.when === 'a-day';
  const ready = (s) => [!!s.leadName, hasSpot(s), hasDay(s), !!s.basics];
  const readyCount = (s) => ready(s).filter(Boolean).length;
  const subject = () => state.sparks.find(s => s.id === state.subjectId) || null;

  const visible = () => {
    const { sparks, sort } = state;
    const out = sparks.slice();
    const byNew = (x, y) => hrsOf(x) - hrsOf(y);
    if (sort === 'new') out.sort(byNew);
    if (sort === 'old') out.sort((x, y) => hrsOf(y) - hrsOf(x));
    if (sort === 'popular') out.sort((x, y) => y.interested - x.interested || byNew(x, y));   // most "I'm interested" first
    return out;
  };

  // ---------------------------------------------------------------------------
  // Data: load + write
  // ---------------------------------------------------------------------------

  const PHOTO_BUCKET = 'spark-photos';
  // Only paths the app itself creates (<uploader uid>/<uuid>.jpg) are turned into URLs.
  // The database enforces the same shape; this is the second lock on the door.
  const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
  const photoUrl = (path) => sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;

  const toSpark = (row, dates, offers, counts, rsvps, interests) => ({
    id: row.id, text: row.text, vibe: row.vibe || '', bits: row.hopes || [],
    // The poster shows by name, even to themselves; "You" only if they never gave one
    who: row.author_name || (row.created_by === state.me ? 'You' : 'Someone'),
    created: Date.parse(row.created_at),
    cat: row.cat, answers: row.answers || {},
    leadName: row.lead_id ? (row.lead_id === state.me ? 'You' : row.lead_name || 'Someone') : null,
    basics: row.basics, spot: row.spot, spotOpen: row.spot_open, day: row.day,
    lockedDateId: row.locked_date_id, vision: row.vision,
    photoPaths: (row.photos || []).filter(p => PHOTO_PATH.test(p)),
    photos: (row.photos || []).filter(p => PHOTO_PATH.test(p)).map(photoUrl),
    dates: dates.map(d => ({ id: d.id, label: d.label })),
    offers: offers.filter(o => o.status === 'accepted')
      .map(o => ({ who: o.user_id === state.me ? 'You' : o.who, line: OFFER_LINES[o.kind] + o.body })),
    pending: offers.filter(o => o.status === 'pending')
      .map(o => ({ id: o.id, who: o.who, byMe: o.user_id === state.me, kind: o.kind, text: o.body })),
    counts: counts || { going: 0, none_count: 0, dates: {} },
    interested: interests.length,
    meIn: interests.some(i => i.user_id === state.me),
    // RLS returns only your own RSVP — or every RSVP on sparks you lead
    rsvps: rsvps.map(r => ({ name: r.name, phone: r.phone, dateIds: r.date_ids || [], none: r.none_work, mine: r.user_id === state.me }))
  });

  const loadAll = async () => {
    const res = await Promise.all([
      sb.from('sparks').select('*').order('created_at', { ascending: false }),
      sb.from('date_options').select('*').order('created_at'),
      sb.from('offers').select('*').order('created_at'),
      sb.from('rsvps').select('*'),
      sb.rpc('rsvp_counts'),
      sb.from('interests').select('spark_id,user_id')
    ]);
    const bad = res.find(r => r.error);
    if (bad) throw bad.error;
    const [sp, dt, of, rs, ct, it] = res.map(r => r.data || []);
    const by = (rows, id) => rows.filter(r => r.spark_id === id);
    const sparks = sp.map(row => toSpark(row, by(dt, row.id), by(of, row.id), ct.find(c => c.spark_id === row.id), by(rs, row.id), by(it, row.id)));
    setState({ sparks, loaded: true, error: null });
  };

  let toastTimer = null;
  const toast = (msg) => {
    setState({ toast: msg });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setState({ toast: null }), 3500);
  };

  const must = (res) => { if (res.error) throw res.error; return res; };

  // ---- Session recovery ------------------------------------------------------
  // The anonymous session can go bad mid-visit: site data cleared, refresh token
  // revoked, user removed in Supabase. Supabase then falls back to the bare
  // publishable key, so reads come back empty and rsvp_counts() is refused.
  // Instead of failing every refresh, quietly start a fresh session and retry.
  // (A fresh session is a new identity, so lead status from the old one is lost,
  // which is unavoidable without real accounts.)

  const noteSession = (session) => {
    const u = session.user, meta = u.user_metadata || {};
    const email = !u.is_anonymous && u.email ? u.email : '';
    if (u.id !== state.me || email !== state.email) {
      setState({ me: u.id, email, myName: (u.is_anonymous ? state.myName || meta.name : meta.name || state.myName) || '' });
    }
  };

  let reauthing = null;
  const ensureSession = (force) => {
    if (reauthing) return reauthing;
    reauthing = (async () => {
      let session = force ? null : (await sb.auth.getSession()).data.session;
      if (!session) {
        await sb.auth.signOut({ scope: 'local' }).catch(() => {});
        session = must(await sb.auth.signInAnonymously()).data.session;
      }
      noteSession(session);
      return session;
    })().finally(() => { reauthing = null; });
    return reauthing;
  };

  // Only applied to reads. Writes can't use this test: an RLS rejection on a
  // write has the same code (42501) and must not trigger a new identity.
  const isAuthFailure = (e) => !!e && (
    e.code === '42501' || e.code === 'PGRST301' || e.code === 'PGRST303' ||
    e.status === 401 || /jwt|refresh token|session/i.test(e.message || ''));

  const loadFresh = async () => {
    try {
      await loadAll();
    } catch (e) {
      if (!isAuthFailure(e)) throw e;
      console.warn('Session lost; starting a new one', e);
      await ensureSession(true);
      await loadAll();
    }
  };

  // Run a write, reload, then apply `after` (object, or function evaluated after the write)
  const run = async (work, after) => {
    if (state.busy) return;
    setState({ busy: true });
    try {
      await ensureSession();
      await work();
      await loadFresh();
      setState(Object.assign({ busy: false }, typeof after === 'function' ? after() : (after || {})));
    } catch (e) {
      console.error(e);
      setState({ busy: false });
      toast('That didn’t go through. Try again in a moment.');
    }
  };

  // Posting, leading and offering show your name to others — ask once, then remember it
  const withName = (fn) => {
    if (state.myName) { fn(); return; }
    setState({ nameAsk: fn, nameText: '' });
  };
  const saveName = (name, renameEverywhere) => {
    setState({ myName: name });
    if (!sb) return;
    sb.auth.updateUser({ data: { name } }).catch(() => {});
    if (renameEverywhere) run(async () => { must(await sb.rpc('rename_me', { p_name: name })); });
  };

  const COLS = { basics: 'basics', lockedDateId: 'locked_date_id', day: 'day', vision: 'vision', text: 'text', hopes: 'hopes' };
  const patch = (id, fields, after) => {
    const row = {};
    Object.keys(fields).forEach(k => { row[COLS[k] || k] = fields[k]; });
    run(async () => { must(await sb.from('sparks').update(row).eq('id', id)); }, after);
  };

  // ---- Photos -----------------------------------------------------------------

  // Shrink to ≤1600px JPEG before upload: phone photos are 3–10 MB, this is ~300 KB
  const shrinkImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not a readable image')); };
    img.src = url;
  });

  const addPhotos = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 3 - state.photos.length);
    for (const file of files) {
      try {
        const blob = await shrinkImage(file);
        if (state.photos.length >= 3) break;
        setState({ photos: state.photos.concat([{ blob, url: URL.createObjectURL(blob) }]) });
      } catch (e) {
        console.error(e);
        toast('That photo couldn’t be read. Try a different one.');
      }
    }
  };
  const removePhoto = (i) => {
    const p = state.photos[i];
    if (p) URL.revokeObjectURL(p.url);
    setState({ photos: state.photos.filter((_, j) => j !== i) });
  };

  const uploadPhotos = async (photos) => {
    const paths = [];
    for (const p of photos) {
      const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
      const path = state.me + '/' + id + '.jpg';
      must(await sb.storage.from(PHOTO_BUCKET).upload(path, p.blob, { contentType: 'image/jpeg', upsert: false }));
      paths.push(path);
    }
    return paths;
  };
  const deletePhotos = (paths) => {
    const own = (paths || []).filter(p => p.indexOf(state.me + '/') === 0);
    if (own.length) sb.storage.from(PHOTO_BUCKET).remove(own).catch(() => {});
  };

  // ---- Posting ----------------------------------------------------------------

  const dayLabel = (st) => st.whenMode === 'one' && st.dateOne
    ? (st.timeOn && st.timeOne ? fmtDate(st.dateOne + 'T' + st.timeOne) : new Date(st.dateOne + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
    : null;

  const composeReset = () => {
    state.photos.forEach(p => URL.revokeObjectURL(p.url));
    return { activity: '', hopes: ['', '', ''], photos: [], step: 'activity', locMode: 'specific', locText: '', whenMode: 'one', dateOne: '', timeOne: '', timeOn: false };
  };

  // Leads need an account: sign in first, then carry on posting the same draft
  const createDraft = () => (state.email ? withName(postDraft) : openLogin('post', createDraft));
  const postDraft = () => {
    const st = state;
    let id = null, paths = [];
    run(async () => {
      paths = await uploadPhotos(st.photos);
      const row = {
        author_name: st.myName, text: cleanTitle(st.activity),
        hopes: st.hopes.map(cleanTitle).filter(Boolean), photos: paths, cat: 'events', answers: {},
        lead_id: st.me, lead_name: st.myName,
        spot: st.locMode === 'specific' ? cleanTitle(st.locText) : null, spot_open: st.locMode === 'open',
        day: dayLabel(st)
      };
      try {
        id = must(await sb.from('sparks').insert(row).select('id').single()).data.id;
      } catch (e) {
        deletePhotos(paths);
        throw e;
      }
    }, () => Object.assign(composeReset(), { subjectId: id, qi: 0, adding: false, screen: 'detail', tag: 'It’s up' }));
  };

  const answer = (key, value) => {
    const s = subject();
    if (!s) return;
    const answers = { ...s.answers };
    if (answers[key] === value) delete answers[key]; else answers[key] = value;
    run(async () => { must(await sb.from('sparks').update({ answers }).eq('id', s.id)); });
  };

  const finish = () => {
    const adding = state.adding;
    setState({ screen: 'detail', qi: 0, step: 'activity', tag: adding ? 'Nice — added' : 'It’s up' });
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
    go('detail', { qi: 0, step: 'activity', tag: 'It’s up' });
  };

  // ---- Idea page actions ------------------------------------------------------

  const openOffer = (kind) => withName(() => setState({ offerKind: kind, offerText: '' }));

  const commitOffer = (subj) => {
    const kind = state.offerKind;
    const text = state.offerText.trim();
    const done = { offerKind: null, offerText: '' };
    if (kind === 'date') {
      run(async () => { must(await sb.from('date_options').insert({ spark_id: subj.id, label: fmtDate(text) })); }, done);
      return;
    }
    if (kind === 'vision') { patch(subj.id, { vision: text }, done); return; }
    let status = null;
    withName(() => run(async () => {
      status = must(await sb.rpc('add_offer', { p_spark: subj.id, p_kind: kind, p_body: text, p_who: state.myName })).data;
    }, () => Object.assign({}, done, status === 'pending' ? { tag: 'Sent to the lead' } : {})));
  };

  const resolveOffer = (offer, accept) => run(async () => {
    must(await sb.rpc('resolve_offer', { p_offer: offer.id, p_accept: accept }));
  }, accept ? { tag: offer.kind === 'spot' ? 'Spot set' : 'Day set' } : {});

  const toggleInterest = (subj) => run(async () => {
    if (subj.meIn) must(await sb.from('interests').delete().eq('spark_id', subj.id).eq('user_id', state.me));
    else must(await sb.from('interests').insert({ spark_id: subj.id, user_id: state.me }));
  }, subj.meIn ? {} : { tag: 'You’re interested' });

  const askRemoveDate = (subj, d, n) => {
    const doIt = () => run(async () => { must(await sb.rpc('remove_date_option', { p_date: d.id })); }, { confirm: null });
    if (!n) { doIt(); return; }
    setState({ confirm: { title: 'Remove ' + d.label + '?', body: (n === 1 ? '1 person picked it.' : n + ' people picked it.') + ' They stay on the RSVP list, just not for this date.', cta: 'Remove it', keep: 'Keep it', run: doIt } });
  };

  const openEdit = (subj) => setState({ screen: 'edit', editText: subj.text, editHopes: [0, 1, 2].map(i => (subj.bits || [])[i] || '') });
  const saveEdit = (subj) => {
    if (!state.editText.trim()) return;
    patch(subj.id, { text: cleanTitle(state.editText), hopes: state.editHopes.map(cleanTitle).filter(Boolean) }, { screen: 'detail', tag: 'Saved' });
  };
  const askDelete = (subj) => setState({ confirm: {
    title: 'Delete this idea?',
    body: 'It comes down for everyone, along with its dates and RSVPs. This can’t be undone.',
    cta: 'Delete it', keep: 'Keep it', danger: true,
    run: () => run(async () => {
      must(await sb.from('sparks').delete().eq('id', subj.id));
      deletePhotos(subj.photoPaths);
    }, { confirm: null, screen: 'browse', subjectId: null, tag: null })
  } });

  const submitRsvp = (subj) => {
    const st = state;
    const name = cleanTitle(st.rsvpName);
    if (!st.myName) saveName(name);
    run(async () => {
      must(await sb.from('rsvps').upsert({
        spark_id: subj.id, user_id: st.me, name, phone: st.rsvpPhone.trim(),
        date_ids: st.rsvpNone ? [] : st.rsvpDates.slice(), none_work: st.rsvpNone
      }, { onConflict: 'spark_id,user_id' }));
    }, { rsvpOpen: false, tag: st.rsvpNone ? 'The lead will reach out' : 'You’re on the list' });
  };

  // ---- Email sign-in (Supabase email OTP, a 6-digit code) -----------------------
  // Everyone starts as an anonymous session, which is enough to browse, say
  // you're interested, offer and RSVP. Posting an idea needs a real account
  // (the database refuses anonymous posts), so "Put it up" asks for an email.
  // 'link': attach the email to this browser's anonymous identity. Same user id,
  //         so nothing moves.
  // 'signin': the email already has an account. Sign in to it, then pull this
  //           browser's anonymous activity across with a one-time merge token.

  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const tooSoon = (e) => !!e && (e.status === 429 || /security purposes|rate limit|after \d+ seconds/i.test(e.message || ''));

  const openLogin = (why, then) => setState({ loginStep: 'email', loginWhy: why || 'keep', loginThen: then || null, loginMode: 'link', loginCode: '', resent: false, nameAsk: null });
  const closeLogin = () => setState({ loginStep: null, loginCode: '', loginThen: null });

  const sendCode = async (again) => {
    const st = state;
    const email = st.loginEmail.trim().toLowerCase();
    setState({ busy: true });
    try {
      await ensureSession();
      let mode = again ? st.loginMode : 'link';
      if (mode === 'link') {
        const res = await sb.auth.updateUser({ email });
        if (res.error && (res.error.code === 'email_exists' || /already|registered|exists|taken/i.test(res.error.message || ''))) mode = 'signin';
        else must(res);
        // Projects with "Confirm email" off attach the email at once and send nothing
        const u = res.data && res.data.user;
        if (mode === 'link' && u && u.email === email && !u.new_email) {
          await finishSignIn(st, must(await sb.auth.refreshSession()).data.session);
          return;
        }
      }
      if (mode === 'signin') {
        const token = st.mergeToken || must(await sb.rpc('prepare_merge')).data;
        setState({ mergeToken: token });
        must(await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }));
      }
      setState({ busy: false, loginMode: mode, loginStep: 'code', loginCode: again ? st.loginCode : '', resent: !!again });
    } catch (e) {
      console.error(e);
      setState({ busy: false });
      toast(tooSoon(e) ? 'One code a minute. Wait a moment, then try again.' : 'Couldn’t send a code to that email. Check it and try again.');
    }
  };

  const finishSignIn = async (st, session) => {
    noteSession(session);
    const meta = (session.user && session.user.user_metadata) || {};
    if (!meta.name && state.myName) sb.auth.updateUser({ data: { name: state.myName } }).catch(() => {});
    await loadFresh();
    const then = st.loginThen;
    setState({ busy: false, loginStep: null, loginCode: '', loginThen: null, mergeToken: null, tag: then ? null : 'Signed in' });
    if (typeof then === 'function') then();
  };

  const verifyCode = async () => {
    const st = state;
    const email = st.loginEmail.trim().toLowerCase();
    setState({ busy: true });
    try {
      const res = must(await sb.auth.verifyOtp({ email, token: st.loginCode, type: st.loginMode === 'link' ? 'email_change' : 'email' }));
      if (st.loginMode === 'signin' && st.mergeToken) {
        await sb.rpc('complete_merge', { p_token: st.mergeToken });   // best effort: nothing to merge is fine
      }
      // A linked account keeps the same session; refresh it so the token says "not anonymous"
      await finishSignIn(st, st.loginMode === 'link'
        ? must(await sb.auth.refreshSession()).data.session
        : res.data.session || (await sb.auth.getSession()).data.session);
    } catch (e) {
      console.error(e);
      setState({ busy: false });
      toast('That code didn’t work. Check it, or send it again.');
    }
  };

  const signOut = async () => {
    await sb.auth.signOut().catch(() => {});
    setState({ email: '' });
    await ensureSession(true);
    await loadFresh().catch(() => {});
  };

  // ---------------------------------------------------------------------------
  // Style factories (verbatim values from the design)
  // ---------------------------------------------------------------------------

  const btn = (ok) => css({ marginTop: '4px', width: '100%', border: 0, borderRadius: '999px', padding: '17px', fontFamily: 'inherit', fontSize: '16.5px', fontWeight: 800, color: '#fff',
    background: ok ? '#5b4ae8' : '#b9bcc4', cursor: ok ? 'pointer' : 'not-allowed', boxShadow: ok ? '0 10px 24px rgba(91,74,232,.32)' : 'none' });
  const smallBtn = (ok, shadow, clickableWhenDim) => css({ marginTop: shadow ? '4px' : '2px', width: '100%', border: 0, borderRadius: '999px', padding: '16px', fontFamily: 'inherit', fontSize: '16px', fontWeight: 800, color: '#fff',
    background: ok ? '#5b4ae8' : '#b9bcc4', cursor: ok || clickableWhenDim ? 'pointer' : 'not-allowed', boxShadow: shadow && ok ? '0 8px 20px rgba(91,74,232,.28)' : 'none' });
  const primaryBtn = (ok) => css({ width: '100%', border: 0, borderRadius: '999px', padding: '16px', fontFamily: 'inherit', fontSize: '16px', fontWeight: 800, color: '#fff', background: ok ? '#5b4ae8' : '#b9bcc4', cursor: ok ? 'pointer' : 'not-allowed' });
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
      '<h2 style="margin:8px 0 0;font-size:28px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">Ideas come to life when we build them together</h2>' +
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
    go('compose', composeReset());
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
    if (!state.loaded) return 'Loading ideas…';
    const n = state.sparks.filter(s => s.cat === 'events').length;
    return n + (n === 1 ? ' idea' : ' ideas') + ' so far';
  }

  function viewHome() {
    return '<div data-screen-label="Home">' +
      sparksHeader(false) +
      '<div style="padding:16px 14px 10px">' +
        '<div ' + on(() => go('browse')) + ' aria-label="Walktober 2026 — see all ideas" style="position:relative;height:200px;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.1);cursor:pointer">' +
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
      const locOk = hasSpot(s), dateOk = hasDay(s), nOpts = (s.dates || []).length;
      const icon = (ok) => 'flex:0 0 26px;width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:' + (ok ? '#fdf1d6' : '#f2f3f6') + ';color:' + (ok ? '#8f6405' : '#b3b8c2');
      const txt = (ok) => 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14.5px;font-weight:' + (ok ? 700 : 600) + ';color:' + (ok ? '#0d1117' : '#9aa0aa');
      const locText = locOk ? (s.spot || 'Spot picked') : 'Location TBD';
      const dateText = dateOk ? (s.day || 'Day picked') : (nOpts ? 'Date TBD · ' + nOpts + ' options' : 'Date TBD');
      const photos = s.photos || [];
      return '<div ' + on(() => go('detail', { subjectId: s.id, tag: null })) + ' style="display:grid;grid-template-columns:8px 1fr;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
        '<div style="background:' + c.bar + '"></div>' +
        '<div style="min-width:0">' +
          (photos.length
            ? '<div style="position:relative;height:150px;background:#dfe2e8 url(\'' + esc(photos[0]) + '\') center/cover no-repeat">' +
                (photos.length > 1
                  ? '<span style="position:absolute;right:10px;bottom:10px;display:flex;align-items:center;gap:5px;background:rgba(13,17,23,.62);color:#fff;border-radius:999px;padding:5px 10px;font-size:12.5px;font-weight:800">' + ICON_PHOTO(12, '#fff', 2.4) + photos.length + '</span>'
                  : '') +
              '</div>'
            : '') +
          '<div style="padding:15px 16px 14px;display:flex;flex-direction:column;gap:11px">' +
            '<div style="font-size:19px;line-height:1.28;font-weight:800;letter-spacing:-.3px;color:#0d1117;text-wrap:pretty">' + esc(s.text) + '</div>' +
            '<div style="display:flex;flex-direction:column;gap:6px">' +
              '<div style="display:flex;align-items:center;gap:9px;min-width:0"><span style="' + icon(locOk) + '">' + ICON_PIN + '</span><span style="' + txt(locOk) + '">' + esc(locText) + '</span></div>' +
              '<div style="display:flex;align-items:center;gap:9px;min-width:0"><span style="' + icon(dateOk) + '">' + ICON_CAL + '</span><span style="' + txt(dateOk) + '">' + esc(dateText) + '</span></div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid #f2f3f6">' +
              '<span style="width:28px;height:28px;border-radius:999px;background:' + c.bar + ';color:#fff;font-size:12.5px;font-weight:800;display:flex;align-items:center;justify-content:center">' + esc(s.who.charAt(0).toUpperCase()) + '</span>' +
              '<span style="font-size:13.5px;font-weight:700;color:#454b55">' + esc(s.who) + '</span>' +
              '<span style="width:3px;height:3px;border-radius:999px;background:#9aa0ac"></span>' +
              '<span style="font-size:13.5px;font-weight:500;color:#6b7280">' + esc(whenOf(s)) + '</span>' +
              '<span aria-label="' + s.interested + ' interested" style="margin-left:auto;display:flex;align-items:center;gap:4px;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;background:' + (s.meIn ? '#fdf1d6' : '#f2f3f6') + ';color:' + (s.meIn ? '#8f6405' : '#5c6270') + '">' + ICON_PERSON(13) + s.interested + '</span>' +
            '</div>' +
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
        (cards.length === 0 && state.loaded
          ? '<div style="' + CARD + ';padding:18px">' +
              '<div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">No ideas yet.</div>' +
              '<div style="margin-top:4px;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Be the first to put one up — rough is fine.</div>' +
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
    const openRsvp = () => setState({ rsvpOpen: true, rsvpDates: mine ? (mine.dateIds || []).slice() : [], rsvpNone: mine ? !!mine.none : false, rsvpName: mine ? mine.name : (st.rsvpName || st.myName), rsvpPhone: mine ? mine.phone : st.rsvpPhone });

    // Facts
    const factRow = (line, dotTop) => ({ line, dotTop });
    const facts = KEYS.map(k => {
      let line = (FACTS[k] || {})[subj.answers[k]];
      if (k === 'place' && subj.spot) line = 'The spot: ' + subj.spot + '.';
      if (k === 'when' && subj.day) line = 'The day: ' + subj.day + '.';
      return line ? factRow(line, 7) : null;
    }).filter(Boolean);
    if (subj.spotOpen && !subj.spot) facts.push(factRow('Location: we’ll decide together.', 6));

    // Dates
    const counts = subj.counts || { going: 0, none_count: 0, dates: {} };
    const counted = dates.map((d, i) => ({ d, i, n: (counts.dates || {})[d.id] || 0, people: rsvps.filter(r => (r.dateIds || []).indexOf(d.id) > -1) }));
    counted.sort((a, b) => b.n - a.n || a.i - b.i);
    const top = counted.length ? counted[0].n : 0;
    const tied = top > 0 && counted.filter(x => x.n === top).length > 1;
    const lockedId = subj.lockedDateId;
    const none = rsvps.filter(r => r.none);          // names: only populated for the lead
    const noneCount = counts.none_count || 0;
    const going = counts.going || 0;
    const badge = (bg, ink, label) => '<span style="border-radius:999px;padding:3px 9px;background:' + bg + ';color:' + ink + ';font-size:11.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase">' + label + '</span>';

    const dateRows = counted.map((x, rank) => {
      const cnt = x.n, isLocked = lockedId === x.d.id, isTop = cnt > 0 && cnt === top;
      const countLabel = cnt === 0 ? 'Nobody yet' : cnt === 1 ? '1 can make it' : cnt + ' can make it';
      const barBg = isLocked ? '#0f7a3c' : isTop && !lockedId ? c.bar : '#c3c7cf';
      return '<div style="padding:12px;margin:0 -12px;border-radius:14px;background:' + (isLocked ? '#e8f6ee' : 'transparent') + '">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<span style="flex:0 0 26px;width:26px;height:26px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#454b55">' + (rank + 1) + '</span>' +
          '<div style="flex:1 1 auto;min-width:0">' +
            '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px">' +
              '<span style="font-size:16px;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + esc(x.d.label) + '</span>' +
              (!lockedId && isTop && !tied ? badge('#fdf1d6', '#8f6405', 'Most support') : '') +
              (!lockedId && isTop && tied ? badge('#f2f3f6', '#454b55', 'Tied') : '') +
              (isLocked ? badge('#0f7a3c', '#fff', 'Locked in') : '') +
            '</div>' +
            '<div style="margin-top:2px;font-size:13.5px;font-weight:600;color:#6b7280">' + countLabel + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin:10px 0 0 38px;height:6px;border-radius:999px;background:#eff0f3;overflow:hidden"><div style="height:100%;border-radius:999px;width:' + (top ? cnt / top * 100 : 0) + '%;background:' + barBg + ';transition:width .3s ease"></div></div>' +
        (youLead && cnt > 0 ? '<div style="margin:8px 0 0 38px;font-size:13.5px;line-height:1.4;font-weight:600;color:#454b55">' + esc(x.people.map(p => p.mine ? 'You' : p.name).join(', ')) + '</div>' : '') +
        (youLead && !isLocked
          ? '<div style="margin:8px 0 0 38px;display:flex;align-items:center;gap:18px">' +
              (!lockedId && cnt > 0
                ? '<span ' + on(() => patch(subj.id, { lockedDateId: x.d.id, day: x.d.label })) + ' style="display:inline-flex;align-items:center;gap:5px;min-height:32px;font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' + LOCK(12, '#5b4ae8', 2.4) + 'Lock this one in</span>'
                : '') +
              '<span class="hov-danger" ' + on(() => askRemoveDate(subj, x.d, cnt)) + ' style="display:inline-flex;align-items:center;gap:5px;min-height:32px;font-size:13.5px;font-weight:700;color:#6b7280;cursor:pointer">' + X(11, 'currentColor', 2.6) + 'Remove</span>' +
            '</div>'
          : '') +
      '</div>';
    });

    // Readiness
    const leadLabel = subj.leadName || 'The lead';
    const line = exec ? 'All four in place. This one’s happening.' : n + ' of 4 in place — ' + (youLead ? 'you’re' : leadLabel + ' is') + ' working on the rest.';

    const rows = [
      { label: 'Somebody out front', met: met[0],
        note: youLead ? 'You’re leading this one.' : leadLabel + ' is leading this one.',
        actionable: false, act: null },
      { label: 'A place for it', met: spot,
        note: subj.spot ? subj.spot : (spot ? 'There’s a place in mind.' : 'No spot settled — open to suggestions.'),
        actionable: !spot, act: spot ? null : () => openOffer('spot') },
      { label: 'A day it happens', met: day,
        note: subj.day ? subj.day : (day ? 'There’s a day in mind.' : nDates ? nDates + (nDates === 1 ? ' date' : ' dates') + ' up for a vote — ' + (youLead ? 'lock one in when you’re ready.' : 'the lead locks one in.') : youLead ? 'Put up to three dates to vote on.' : 'No day yet — anybody can float one.'),
        actionable: !day && !youLead, act: day || youLead ? null : (nDates ? openRsvp : () => openOffer('day')) },
      { label: 'Basics established', met: !!subj.basics,
        note: subj.basics ? 'The lead says the essentials are covered.' : (youLead ? 'Your call — mark it when the essentials are covered.' : 'The lead’s call, once the essentials are covered.'),
        actionable: youLead && !subj.basics,
        act: youLead && !subj.basics ? () => patch(subj.id, { basics: true }) : null }
    ];

    const checkpoints = rows.map(r => {
      const mark = r.met
        ? 'flex:0 0 20px;width:20px;height:20px;border-radius:999px;background:' + c.bar + ';display:flex;align-items:center;justify-content:center;margin-top:2px'
        : 'flex:0 0 20px;width:20px;height:20px;border-radius:999px;border:1.5px dashed #cfd3db;background:#fff;display:flex;align-items:center;justify-content:center;margin-top:2px';
      return '<div ' + (r.actionable ? on(r.act) : '') + ' style="display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-top:1px solid #f2f3f6;cursor:' + (r.actionable ? 'pointer' : 'default') + '">' +
        '<span style="' + mark + '">' + (r.met ? CHECK(12, '#fff', 3.2) : '') + '</span>' +
        '<div style="flex:1 1 auto">' +
          '<div style="font-size:15.5px;font-weight:800;letter-spacing:-.2px;color:' + (r.met ? '#0d1117' : '#2b303a') + '">' + r.label + '</div>' +
          '<div style="font-size:13.5px;line-height:1.4;font-weight:500;color:#6b7280">' + esc(r.note) + '</div>' +
        '</div>' +
        (r.actionable ? CHEV_R(16, '#5b4ae8', 2.4) : '') +
      '</div>';
    });

    const bits = subj.bits || [];
    const pending = subj.pending || [];
    const offers = (subj.offers || []).map(o => Object.assign({ waiting: false }, o)).concat(
      youLead ? [] : pending.filter(p => p.byMe).map(p => ({
        who: 'You', line: OFFER_LINES[p.kind] + p.text, waiting: true,
        note: 'waiting on ' + (subj.leadName || 'the lead')
      })));
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
        (youLead
          ? '<div class="hov-outline" ' + on(() => openEdit(subj)) + ' style="margin-left:auto;display:flex;align-items:center;gap:6px;min-height:40px;border:1.5px solid #dcdfe6;border-radius:999px;padding:0 14px;font-size:14px;font-weight:800;color:#0d1117;cursor:pointer">' + ICON_EDIT(14) + 'Edit</div>'
          : '') +
      '</header>' +
      '<div style="position:relative;background:' + c.bar + ';padding:26px 20px 28px">' +
        (st.tag ? '<div style="position:absolute;top:14px;right:16px;transform:rotate(5deg);background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:800;color:#0d1117;box-shadow:0 8px 20px rgba(15,18,25,.18);animation:popIn 320ms cubic-bezier(.22,.9,.28,1) both">' + esc(st.tag) + '</div>' : '') +
        '<div style="font-size:12.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.82)">Spark</div>' +
        '<div style="margin-top:10px;font-size:29px;line-height:1.14;font-weight:900;letter-spacing:-.8px;color:#fff;text-wrap:pretty">' + esc(subj.text) + '</div>' +
        '<div style="margin-top:18px;display:flex;align-items:center;gap:10px">' +
          '<span style="width:32px;height:32px;border-radius:999px;background:rgba(255,255,255,.22);color:#fff;font-size:13.5px;font-weight:800;display:flex;align-items:center;justify-content:center">' + esc(subj.who.charAt(0).toUpperCase()) + '</span>' +
          '<span style="font-size:13.5px;font-weight:700;color:#fff">' + esc(subj.who) + '</span>' +
          '<span style="width:3px;height:3px;border-radius:999px;background:rgba(255,255,255,.6)"></span>' +
          '<span style="font-size:13.5px;font-weight:500;color:rgba(255,255,255,.85)">' + esc(whenOf(subj)) + '</span>' +
        '</div>' +
        (exec ? pill('Deciding &amp; executing') : '') +
      '</div>' +

      '<div style="padding:18px 16px 26px;display:flex;flex-direction:column;gap:14px">' +
        ((subj.photos || []).length
          ? '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
              subj.photos.map(u => '<div role="img" aria-label="Photo" style="width:100%;aspect-ratio:1/1;border-radius:14px;background:#dfe2e8 url(\'' + esc(u) + '\') center/cover no-repeat"></div>').join('') +
            '</div>'
          : '') +
        (!youLead
          ? '<div style="display:flex;align-items:center;gap:12px">' +
              '<button type="button" ' + on(() => toggleInterest(subj)) + ' aria-pressed="' + subj.meIn + '" style="flex:1 1 auto;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer;border:2px solid ' + (subj.meIn ? '#e8a71c' : '#5b4ae8') + ';background:' + (subj.meIn ? '#fdf1d6' : '#5b4ae8') + ';color:' + (subj.meIn ? '#8f6405' : '#fff') + '">' +
                BOLT_SOLID(16) + (subj.meIn ? 'You’re interested' : 'I’m interested') +
              '</button>' +
              '<span style="flex:0 0 auto;font-size:14px;font-weight:700;color:#5c6270">' + (subj.interested === 0 ? 'Be the first' : subj.interested + ' interested') + '</span>' +
            '</div>'
          : '<div style="display:flex;align-items:center;gap:8px;background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
              BOLT_SOLID(16, '#e8a71c') +
              '<span style="font-size:15px;font-weight:800;color:#0d1117">' + (subj.interested === 0 ? 'Be the first' : subj.interested + ' interested') + '</span>' +
            '</div>') +
        (youLead && pending.length
          ? '<div style="background:#fff;border-radius:18px;padding:18px;box-shadow:0 0 0 2px #f1d58f, 0 1px 3px rgba(15,18,25,.08);display:flex;flex-direction:column;gap:4px">' +
              '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#8f6405">' + (pending.length === 1 ? 'Waiting on you' : pending.length + ' waiting on you') + '</div>' +
              '<p style="margin:2px 0 0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">Nothing changes until you say so.</p>' +
              pending.map(p => {
                const current = p.kind === 'spot' ? subj.spot : subj.day;
                return '<div style="margin-top:10px;padding-top:12px;border-top:1px solid #f2f3f6;display:flex;flex-direction:column;gap:6px">' +
                  '<div style="font-size:14px;font-weight:600;color:#5c6270"><strong style="font-weight:800;color:#0d1117">' + esc(p.who) + '</strong> ' + (p.kind === 'spot' ? 'offered a spot' : 'floated a day') + '</div>' +
                  '<div style="font-size:17px;line-height:1.3;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + esc(p.text) + '</div>' +
                  (current ? '<div style="font-size:13.5px;font-weight:600;color:#6b7280">Replaces ' + esc(current) + '</div>' : '') +
                  '<div style="margin-top:6px;display:flex;gap:8px">' +
                    '<button type="button" class="hov-primary" ' + on(() => resolveOffer(p, true)) + ' style="flex:1 1 0;min-height:46px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer">' + (p.kind === 'spot' ? 'Use this spot' : 'Use this day') + '</button>' +
                    '<button type="button" class="hov-outline" ' + on(() => resolveOffer(p, false)) + ' style="flex:1 1 0;min-height:46px;background:#fff;border:1.5px solid #dcdfe6;border-radius:999px;font-family:inherit;font-size:15px;font-weight:800;color:#0d1117;cursor:pointer">Not this time</button>' +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>'
          : '') +
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
                '<div style="font-size:13px;font-weight:700;color:#6b7280">' + (going + noneCount === 0 ? 'No RSVPs yet' : going + ' in' + (noneCount ? ' · ' + noneCount + ' can’t make these' : '')) + '</div>' +
              '</div>' +
              dateRows.join('') +
              (noneCount
                ? '<div style="border-top:1px solid #eff0f3;padding-top:12px;display:flex;flex-direction:column;gap:8px">' +
                    '<div style="font-size:15px;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + (noneCount === 1 ? '1 interested, but none of these work' : noneCount + ' interested, but none of these work') + '</div>' +
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
              '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
                offerChip('Offer a spot', () => openOffer('spot')) +
                (!youLead && nDates === 0 ? offerChip('Offer a day', () => openOffer('day')) : '') +
                offerChip('I can help with something', () => openOffer('help')) +
              '</div>' +
            '</div>') +

        (offers.length
          ? '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:10px">' +
              '<div style="' + EYEBROW + '">Who’s already in</div>' +
              offers.map(o =>
                '<div style="display:flex;gap:10px">' +
                  '<span style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:' + (o.waiting ? '#e8c46a' : c.bar) + ';margin-top:7px"></span>' +
                  '<span style="font-size:14.5px;line-height:1.42;font-weight:500;color:#454b55"><strong style="font-weight:800;color:#0d1117">' + esc(o.who) + '</strong> ' + esc(o.line) +
                    (o.waiting ? '<span style="font-weight:700;color:#8f6405"> · ' + esc(o.note) + '</span>' : '') + '</span>' +
                '</div>').join('') +
            '</div>'
          : '') +

        (exec ? '<div style="display:flex;flex-wrap:wrap;gap:8px">' + offerChip('I can help with something', () => openOffer('help'), true) + '</div>' : '') +
      '</div>' +
      '<div style="height:73px"></div>' +
    '</div>';
  }

  // ---- Shared bits for the post flow and edit screen ------------------------

  const orDivider = () =>
    '<div style="display:flex;align-items:center;gap:12px;margin:2px 0">' +
      '<span style="flex:1 1 auto;height:1px;background:#dcdfe6"></span>' +
      '<span style="font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280">or</span>' +
      '<span style="flex:1 1 auto;height:1px;background:#dcdfe6"></span>' +
    '</div>';
  const laterBtn = (label, fn) =>
    '<button type="button" class="hov-tint" ' + on(fn) + ' style="width:100%;background:#fff;border:2px solid #5b4ae8;border-radius:999px;padding:16px;font-family:inherit;font-size:16.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' + label + '</button>';
  const stepHead = (title) => '<div>' + stepEyebrow() +
    '<h2 style="margin:6px 0 0;font-size:31px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">' + title + '</h2></div>';

  const HOPE_PH = ['tacos after', 'teams by class', 'glow-in-the-dark shirts'];
  const dreamCard = (values, setAt) =>
    '<div style="background:#fff;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:6px;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
      '<div style="font-size:18px;font-weight:800;letter-spacing:-.3px;color:#0d1117">What’s in your dream version?</div>' +
      '<p style="margin:2px 0 6px;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">A few words each, for the little things that would make it great. Skip any you like.</p>' +
      values.map((v, i) =>
        '<div style="display:flex;align-items:center;gap:12px;border-bottom:1.5px solid #eff0f3">' +
          '<span style="flex:0 0 8px;width:8px;height:8px;border-radius:999px;background:' + (v ? '#e8a71c' : '#dfe2e8') + '"></span>' +
          '<input type="text" maxlength="30" aria-label="Dream version, line ' + (i + 1) + '" placeholder="' + HOPE_PH[i] + '" value="' + esc(v) + '" ' +
            onInput(e => setAt(i, e.target.value.slice(0, 30))) +
            ' style="flex:1 1 auto;min-width:0;background:transparent;border:0;padding:14px 0;font-family:inherit;font-size:17px;font-weight:700;color:#0d1117;outline:none">' +
          '<span style="flex:0 0 auto;font-size:12px;font-weight:700;color:#9aa0aa">' + (v ? 30 - v.length : '') + '</span>' +
        '</div>').join('') +
    '</div>';

  // ---- Post flow: Event → Location → Date → Paint the picture → Photos → Look good?

  function viewCompose() {
    const st = state;
    const actReady = st.activity.trim().length > 0;
    const locReady = st.locText.trim().length > 0;
    const closeCompose = () => {
      if (st.step !== 'activity') { setState({ step: 'activity' }); return; }
      go('home', composeReset());
    };
    const to = (step) => () => setState({ step });
    let body = '';

    if (st.step === 'activity') {
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:16px">' +
        '<h2 style="margin:0;font-size:34px;line-height:1.04;font-weight:900;letter-spacing:-1px;color:#0d1117;text-wrap:pretty">What’s the event?</h2>' +
        '<div><textarea class="fld" rows="2" maxlength="80" aria-label="The event" placeholder="E.g. a sunrise walk, laser tag, pickleball at the park" ' + onInput(e => setState({ activity: e.target.value.slice(0, 80) })) +
          ' style="width:100%;display:block;background:#fff;border:2px solid #e6e7eb;border-radius:18px;padding:16px 18px;font-size:21px;line-height:1.35;font-weight:700;letter-spacing:-.3px;color:#0d1117;resize:none;outline:none">' + esc(st.activity) + '</textarea></div>' +
        '<button type="button" ' + on(() => { if (actReady) setState({ step: 'location' }); }) + ' aria-disabled="' + !actReady + '" style="' + btn(actReady).replace('margin-top:4px', 'margin-top:2px') + '">Next</button>' +
        backLink(closeCompose) +
      '</div>';
    }

    if (st.step === 'location') {
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:12px">' +
        stepHead('Location') +
        '<input class="fld" type="text" maxlength="80" aria-label="Location" placeholder="Enter the location" value="' + esc(st.locText) + '" ' +
          onInput(e => setState({ locText: e.target.value.slice(0, 80), locMode: 'specific' })) +
          ' style="width:100%;background:#fff;border:2px solid #e6e7eb;border-radius:18px;padding:16px 18px;font-family:inherit;font-size:18px;font-weight:700;letter-spacing:-.2px;color:#0d1117;outline:none">' +
        '<button type="button" ' + on(() => { if (locReady) setState({ step: 'when', locMode: 'specific' }); }) + ' aria-disabled="' + !locReady + '" style="' + btn(locReady) + '">Next</button>' +
        orDivider() +
        laterBtn('Decide location later', () => setState({ step: 'when', locMode: 'open', locText: '' })) +
        backLink(to('activity')) +
      '</div>';
    }

    if (st.step === 'when') {
      const dateReady = st.dateOne.length > 0;
      const timeOpts = Array.from({ length: 48 }, (_, i) => {
        const hh = Math.floor(i / 2), mm = i % 2 ? '30' : '00';
        const v = String(hh).padStart(2, '0') + ':' + mm;
        return '<option value="' + v + '"' + (v === st.timeOne ? ' selected' : '') + '>' + (hh % 12 || 12) + ':' + mm + (hh < 12 ? ' am' : ' pm') + '</option>';
      }).join('');
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:12px">' +
        stepHead('Date') +
        '<div style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:8px">' +
          '<input class="fld" type="date" aria-label="Date" min="2026-10-01" max="2026-10-31" value="' + esc(st.dateOne) + '" ' + onInput(e => setState({ dateOne: e.target.value, whenMode: 'one' })) +
            ' style="width:100%;min-width:0;height:58px;padding:0 12px;background:#fff;border:2px solid #e6e7eb;border-radius:18px;font-family:inherit;font-size:16px;font-weight:700;color:#0d1117;outline:none;color-scheme:light">' +
          (st.timeOn
            ? '<div style="position:relative;height:58px">' +
                '<select class="fld" aria-label="Time" ' + onInput(e => setState({ timeOne: e.target.value })) +
                  ' style="width:100%;height:58px;padding:0 34px 0 12px;appearance:none;-webkit-appearance:none;background:#fff;border:2px solid #e6e7eb;border-radius:18px;font-family:inherit;font-size:16px;font-weight:700;color:#0d1117;outline:none;color-scheme:light">' + timeOpts + '</select>' +
                '<div ' + on(() => setState({ timeOn: false, timeOne: '' })) + ' aria-label="Remove time" style="position:absolute;top:50%;right:6px;transform:translateY(-50%);width:28px;height:28px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + X(12, '#5c6270', 2.6) + '</div>' +
              '</div>'
            : '<div class="hov-dash" ' + on(() => setState({ timeOn: true, timeOne: st.timeOne || '18:00' })) + ' style="height:58px;border:2px dashed #cfd3db;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:15px;font-weight:800;color:#5b4ae8;cursor:pointer">' + plus(14, '#5b4ae8', 2.6) + 'Add time</div>') +
        '</div>' +
        '<button type="button" ' + on(() => { if (dateReady) setState({ step: 'specifics', whenMode: 'one' }); }) + ' aria-disabled="' + !dateReady + '" style="' + btn(dateReady) + '">Next</button>' +
        orDivider() +
        laterBtn('Decide date later', () => setState({ step: 'specifics', whenMode: 'open', dateOne: '', timeOn: false, timeOne: '' })) +
        backLink(to('location')) +
      '</div>';
    }

    if (st.step === 'specifics') {
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:14px">' +
        stepHead('Paint the picture') +
        dreamCard(st.hopes, (i, v) => { const h = st.hopes.slice(); h[i] = v; setState({ hopes: h }); }) +
        '<button type="button" class="hov-primary" ' + on(to('photos')) + ' style="' + btn(true) + '">Next</button>' +
        backLink(to('when')) +
      '</div>';
    }

    if (st.step === 'photos') {
      const has = st.photos.length > 0;
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:12px">' +
        stepHead('Add a photo') +
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
          st.photos.map((p, i) =>
            '<div style="aspect-ratio:1/1;border-radius:16px;overflow:hidden;position:relative;background:#dfe2e8">' +
              '<div style="position:absolute;inset:0;background:url(\'' + esc(p.url) + '\') center/cover no-repeat"></div>' +
              '<div ' + on(() => removePhoto(i)) + ' aria-label="Remove photo" style="position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:999px;background:rgba(13,17,23,.6);display:flex;align-items:center;justify-content:center;cursor:pointer">' + X(12, '#fff', 2.8) + '</div>' +
            '</div>').join('') +
          (st.photos.length < 3
            ? '<label class="hov-dash" style="aspect-ratio:1/1;border-radius:16px;overflow:hidden;position:relative;border:2px dashed #cfd3db;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer">' +
                ICON_PHOTO(22, '#5b4ae8', 2.2) +
                '<span style="font-size:13.5px;font-weight:800;color:#5b4ae8">' + (has ? 'Add another' : 'Add photo') + '</span>' +
                '<input type="file" accept="image/*" multiple aria-label="' + (has ? 'Add another photo' : 'Add a photo') + '" ' +
                  onInput(e => { if (e.type !== 'change') return; const files = Array.from(e.target.files || []); e.target.value = ''; addPhotos(files); }) +
                  ' style="position:absolute;inset:0;opacity:0;cursor:pointer">' +
              '</label>'
            : '') +
        '</div>' +
        '<button type="button" ' + on(() => { if (has) setState({ step: 'review' }); }) + ' aria-disabled="' + !has + '" style="' + btn(has) + '">Next</button>' +
        orDivider() +
        laterBtn('Skip photos', () => { st.photos.forEach(p => URL.revokeObjectURL(p.url)); setState({ step: 'review', photos: [] }); }) +
        backLink(to('specifics')) +
      '</div>';
    }

    if (st.step === 'review') {
      const row = (label, value, step, first, gold) =>
        '<div style="display:flex;align-items:flex-start;gap:12px;padding:14px 0' + (first ? '' : ';border-top:1px solid #f2f3f6') + '">' +
          '<div style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:' + (label === 'Photos' ? 8 : 6) + 'px">' +
            '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:' + (gold ? '#8f6405' : '#6b7280') + '">' + label + '</div>' +
            value +
          '</div>' +
          '<span ' + on(to(step)) + ' style="flex:0 0 auto;min-height:36px;display:flex;align-items:center;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span>' +
        '</div>';
      const plain = (t) => '<div style="font-size:16.5px;line-height:1.35;font-weight:700;color:#0d1117">' + esc(t) + '</div>';
      const muted = (t) => '<div style="font-size:16px;font-weight:600;color:#6b7280">' + t + '</div>';
      const hopes = st.hopes.map(cleanTitle).filter(Boolean);
      const busy = st.busy;
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:14px">' +
        '<h2 style="margin:0;font-size:31px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">Look good?</h2>' +
        '<div style="background:#fff;border-radius:20px;padding:4px 18px;box-shadow:0 1px 3px rgba(15,18,25,.08);display:flex;flex-direction:column">' +
          row('The event', '<div style="font-size:21px;line-height:1.2;font-weight:900;letter-spacing:-.4px;color:#0d1117">' + esc(cleanTitle(st.activity)) + '</div>', 'activity', true, true) +
          row('Location', plain(st.locMode === 'specific' && st.locText.trim() ? cleanTitle(st.locText) : 'Decide later'), 'location') +
          row('Date', plain(dayLabel(st) || 'Decide later'), 'when') +
          row('Dream version', hopes.length
            ? hopes.map(h => '<div style="display:flex;gap:10px"><span style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:#e8a71c;margin-top:8px"></span><span style="font-size:16px;line-height:1.4;font-weight:700;color:#0d1117">' + esc(h) + '</span></div>').join('')
            : muted('Nothing yet'), 'specifics') +
          row('Photos', st.photos.length
            ? '<div style="display:flex;gap:6px">' + st.photos.map(p => '<div style="width:56px;height:56px;border-radius:10px;background:#dfe2e8 url(\'' + esc(p.url) + '\') center/cover no-repeat"></div>').join('') + '</div>'
            : muted('None'), 'photos') +
        '</div>' +
        '<div style="display:flex;gap:11px;padding:4px 2px">' + SHIELD +
          '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#454b55"><strong style="font-weight:800;color:#0d1117">You’ll be the Lead of this event.</strong> You’ve got final say, the dates, the details, but that doesn’t mean doing it alone. Leading well means bringing other people in and deciding together.</p>' +
        '</div>' +
        '<button type="button" class="hov-primary" ' + on(() => { if (!busy) createDraft(); }) + ' aria-disabled="' + busy + '" style="' + btn(!busy) + '">' + (busy ? 'Putting it up…' : 'Put it up') + '</button>' +
        backLink(to('photos')) +
      '</div>';
    }

    return '<div class="overlay-screen" data-screen-label="New spark">' + subHeader('Post your idea', closeCompose, true) + body + '</div>';
  }

  // ---- Edit idea (lead only) ----------------------------------------------------

  function viewEdit(subj) {
    const st = state;
    const ok = st.editText.trim().length > 0;
    return '<div class="overlay-screen" data-screen-label="Edit idea">' +
      subHeader('Edit idea', () => setState({ screen: 'detail' }), true) +
      '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:14px">' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<label for="edit-text" style="font-size:18px;font-weight:800;letter-spacing:-.3px;color:#0d1117">The idea</label>' +
          '<textarea class="fld" id="edit-text" rows="2" maxlength="80" ' + onInput(e => setState({ editText: e.target.value.slice(0, 80) })) +
            ' style="width:100%;display:block;background:#fff;border:2px solid #e6e7eb;border-radius:18px;padding:14px 16px;font-size:19px;line-height:1.35;font-weight:700;letter-spacing:-.3px;color:#0d1117;resize:none;outline:none">' + esc(st.editText) + '</textarea>' +
        '</div>' +
        dreamCard(st.editHopes, (i, v) => { const h = st.editHopes.slice(); h[i] = v; setState({ editHopes: h }); }) +
        '<p style="margin:0 4px;font-size:14px;line-height:1.45;font-weight:500;color:#6b7280">The spot, dates, RSVPs and offers stay as they are.</p>' +
        '<button type="button" ' + on(() => saveEdit(subj)) + ' aria-disabled="' + !ok + '" style="' + btn(ok) + '">Save changes</button>' +
        '<div style="height:1px;background:#e2e4e9;margin:6px 0"></div>' +
        '<span ' + on(() => askDelete(subj)) + ' style="display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;font-size:15px;font-weight:800;color:#9b1c31;cursor:pointer">' + ICON_TRASH + 'Delete this idea</span>' +
      '</div>' +
    '</div>';
  }

  // ---- Profile --------------------------------------------------------------------

  function viewProfile() {
    const st = state;
    const initial = (st.myName || '').trim().charAt(0).toUpperCase() || '?';
    const mine = st.sparks.filter(s => s.leadName === 'You');
    return '<div data-screen-label="Profile">' +
      '<header style="background:#fff;padding:26px 20px 22px">' +
        '<div ' + on(() => go('home')) + ' style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer;width:fit-content">' + ARROW_L +
          '<span style="font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#5b4ae8">Torrez Fitness</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:14px">' +
          '<span style="flex:0 0 56px;width:56px;height:56px;border-radius:999px;background:#e8a71c;color:#fff;font-size:22px;font-weight:900;display:flex;align-items:center;justify-content:center">' + esc(initial) + '</span>' +
          '<div style="flex:1 1 auto;min-width:0">' +
            '<div style="font-size:28px;line-height:1.05;font-weight:900;letter-spacing:-.8px;color:#0d1117">' + esc(st.myName || 'No name yet') + '</div>' +
            '<span ' + on(() => setState({ nameAsk: 'change', nameText: st.myName })) + ' style="display:inline-flex;margin-top:4px;min-height:28px;align-items:center;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">' + (st.myName ? 'Change name' : 'Add your name') + '</span>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<div style="padding:16px 14px 26px;display:flex;flex-direction:column;gap:14px">' +
        (!st.email
          ? '<div style="' + CARD + ';padding:20px 18px;display:flex;flex-direction:column;gap:10px">' +
              '<div style="' + EYEBROW + '">Your account</div>' +
              '<div style="font-size:19px;line-height:1.25;font-weight:800;letter-spacing:-.3px;color:#0d1117;text-wrap:pretty">Sign in to post and lead ideas.</div>' +
              '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">We’ll email you a 6-digit code. No password. Anything you lead follows your email to any phone.</p>' +
              '<button type="button" class="hov-primary" ' + on(() => openLogin('keep')) + ' style="margin-top:4px;width:100%;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16px;font-weight:800;padding:16px;box-shadow:0 10px 24px rgba(91,74,232,.32);cursor:pointer">Sign in with email</button>' +
            '</div>'
          : '<div style="' + CARD + ';padding:18px;display:flex;align-items:center;gap:14px">' +
              '<span style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#e8f6ee;display:flex;align-items:center;justify-content:center">' + CHECK(16, '#0f7a3c', 3) + '</span>' +
              '<div style="flex:1 1 auto;min-width:0">' +
                '<div style="font-size:15.5px;font-weight:800;color:#0d1117;overflow-wrap:anywhere">Signed in as ' + esc(st.email) + '</div>' +
                '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:500;color:#6b7280">Your ideas follow this email to any phone.</div>' +
              '</div>' +
              '<span ' + on(signOut) + ' style="flex:0 0 auto;min-height:36px;display:flex;align-items:center;font-size:14px;font-weight:800;color:#6b7280;cursor:pointer">Sign out</span>' +
            '</div>') +
        '<div style="' + CARD + ';padding:18px 18px 8px">' +
          '<div style="' + EYEBROW + '">Ideas you lead</div>' +
          (mine.length
            ? mine.map(s => {
                const n = readyCount(s);
                return '<div ' + on(() => go('detail', { subjectId: s.id, tag: null })) + ' style="display:flex;align-items:center;gap:12px;padding:13px 0;border-top:1px solid #f2f3f6;cursor:pointer">' +
                  '<div style="flex:1 1 auto;min-width:0">' +
                    '<div style="font-size:15.5px;line-height:1.3;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + esc(s.text) + '</div>' +
                    '<div style="margin-top:2px;font-size:13.5px;font-weight:600;color:#6b7280">' + (n === 4 ? 'Happening' : n + ' of 4 in place') + '</div>' +
                  '</div>' + CHEV_R(16, '#9aa0ac', 2.4) +
                '</div>';
              }).join('')
            : '<p style="margin:8px 0 12px;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Nothing yet. Anything you post or take the lead on shows up here.</p>') +
        '</div>' +
      '</div>' +
      '<div style="height:73px"></div>' +
    '</div>';
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
          '<button type="button" ' + on(advance) + ' style="' + smallBtn(!!picked, true, true) + '">' + (lastQ ? 'Done' : 'Next') + '</button>' +
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

    if (st.rsvpOpen && subj) {
      const phoneOk = st.rsvpPhone.replace(/\D/g, '').length >= 7;
      const rsvpReady = (st.rsvpDates.length > 0 || st.rsvpNone) && st.rsvpName.trim().length > 0 && phoneOk;
      const box = (isOn) => isOn
        ? 'flex:0 0 22px;width:22px;height:22px;border-radius:7px;background:#5b4ae8;display:flex;align-items:center;justify-content:center'
        : 'flex:0 0 22px;width:22px;height:22px;border-radius:7px;border:1.5px solid #cfd3db;background:#fff';
      const optRow = (isOn) => 'display:flex;align-items:center;gap:12px;min-height:52px;padding:12px 14px;border-radius:14px;border:1.5px solid ' + (isOn ? '#5b4ae8' : '#e6e7eb') + ';background:' + (isOn ? '#f3f1fe' : '#fff') + ';cursor:pointer';
      const submit = () => { if (rsvpReady) submitRsvp(subj); };
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

    if (st.nameAsk) {
      const nameOk = st.nameText.trim().length > 0;
      const close = () => setState({ nameAsk: null, nameText: '' });
      const submit = () => {
        if (!nameOk) return;
        const then = st.nameAsk, had = st.myName, name = cleanTitle(st.nameText).slice(0, 30);
        saveName(name, !!had && had !== name);
        setState({ nameAsk: null, nameText: '' });
        if (typeof then === 'function') then();
      };
      out += '<div class="modal-scrim" data-scrim="' + reg(close) + '" style="z-index:30">' +
        '<div role="dialog" aria-modal="true" aria-labelledby="name-h" style="position:relative;width:100%;max-width:330px;background:#fff;border-radius:22px;padding:22px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 60px rgba(15,18,25,.3);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
          modalClose(close) +
          '<span aria-hidden="true" style="width:52px;height:52px;border-radius:999px;background:' + (nameOk ? '#e8a71c' : '#dfe2e8') + ';color:' + (nameOk ? '#fff' : '#6b7280') + ';font-size:21px;font-weight:900;display:flex;align-items:center;justify-content:center;transition:background .2s ease">' + esc(st.nameText.trim().charAt(0).toUpperCase() || '?') + '</span>' +
          '<h3 id="name-h" style="margin:2px 0 0;padding-right:36px;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + (st.myName ? 'Change name' : 'Your name') + '</h3>' +
          '<input class="fld" type="text" maxlength="30" autocomplete="given-name" aria-label="First name" placeholder="First name" value="' + esc(st.nameText) + '" ' +
            onInput(e => setState({ nameText: e.target.value.slice(0, 30) })) + ' style="width:100%;' + FIELD + ';border-radius:14px;padding:13px 16px">' +
          '<button type="button" ' + on(submit) + ' aria-disabled="' + !nameOk + '" style="' + primaryBtn(nameOk) + '">Continue</button>' +
          (!st.myName && !st.email
            ? '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:4px;font-size:13.5px;font-weight:500;color:#6b7280"><span>Been here before?</span><span ' + on(() => openLogin('keep')) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Sign in</span></div>'
            : '') +
        '</div>' +
      '</div>';
    }

    if (st.loginStep) {
      const close = closeLogin;
      const emailOk = EMAIL_OK.test(st.loginEmail.trim());
      const codeOk = st.loginCode.length >= 6;
      const forPost = st.loginWhy === 'post';
      out += '<div class="modal-scrim" style="z-index:32">' +
        '<div role="dialog" aria-modal="true" aria-labelledby="login-h" style="position:relative;width:100%;max-width:330px;background:#fff;border-radius:22px;padding:22px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 60px rgba(15,18,25,.3);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
          modalClose(close) +
          (st.loginStep === 'email'
            ? '<h3 id="login-h" style="margin:0;padding-right:36px;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + (forPost ? 'Sign in to post' : 'Sign in') + '</h3>' +
              '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#6b7280">' + (forPost
                ? 'Whoever posts an idea leads it, so leads sign in. We’ll email you a 6-digit code. No password.'
                : 'We’ll email you a 6-digit code. No password. Anything you lead follows your email to any phone.') + '</p>' +
              '<input class="fld" type="email" maxlength="120" autocomplete="email" autocapitalize="off" spellcheck="false" aria-label="Email" placeholder="you@example.com" value="' + esc(st.loginEmail) + '" ' +
                onInput(e => setState({ loginEmail: e.target.value.slice(0, 120) })) + ' style="width:100%;' + FIELD + ';border-radius:14px;padding:13px 16px">' +
              '<button type="button" ' + on(() => { if (emailOk && !st.busy) sendCode(false); }) + ' aria-disabled="' + !(emailOk && !st.busy) + '" style="' + primaryBtn(emailOk && !st.busy) + '">' + (st.busy ? 'Sending…' : 'Email me a code') + '</button>' +
              '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Only used to sign you in. Nobody else sees it.</p>'
            : '<h3 id="login-h" style="margin:0;padding-right:36px;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Enter the code</h3>' +
              '<div style="display:flex;flex-wrap:wrap;gap:6px;font-size:14.5px;line-height:1.45;font-weight:500;color:#6b7280"><span style="overflow-wrap:anywhere">Sent to ' + esc(st.loginEmail.trim()) + '.</span><span ' + on(() => setState({ loginStep: 'email' })) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Change</span></div>' +
              '<input class="fld" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label="Code from the email" placeholder="000000" value="' + esc(st.loginCode) + '" ' +
                onInput(e => setState({ loginCode: e.target.value.replace(/\D/g, '').slice(0, 8) })) +
                ' style="width:100%;background:#fff;border:2px solid #e6e7eb;border-radius:14px;padding:14px 16px;font-family:inherit;font-size:26px;font-weight:800;letter-spacing:8px;text-align:center;color:#0d1117;outline:none">' +
              '<button type="button" ' + on(() => { if (codeOk && !st.busy) verifyCode(); }) + ' aria-disabled="' + !(codeOk && !st.busy) + '" style="' + primaryBtn(codeOk && !st.busy) + '">' + (st.busy ? 'Signing in…' : 'Sign in') + '</button>' +
              '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280;text-align:center">Not there? Check spam, or</p>' +
              '<span ' + on(() => { if (!st.busy) sendCode(true); }) + ' style="margin-top:-10px;display:flex;justify-content:center;min-height:32px;align-items:center;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">' + (st.resent ? 'Sent again' : 'Send it again') + '</span>') +
        '</div>' +
      '</div>';
    }

    if (st.confirm) {
      const c = st.confirm;
      out += '<div class="modal-scrim" style="z-index:34">' +
        '<div role="alertdialog" aria-modal="true" aria-labelledby="confirm-h" style="position:relative;width:100%;max-width:330px;background:#fff;border-radius:22px;padding:22px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 60px rgba(15,18,25,.3);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
          '<h3 id="confirm-h" style="margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + esc(c.title) + '</h3>' +
          '<p style="margin:0;font-size:15px;line-height:1.45;font-weight:500;color:#454b55">' + esc(c.body) + '</p>' +
          '<div style="margin-top:4px;display:flex;flex-direction:column;gap:8px">' +
            '<button type="button" ' + on(() => { if (!st.busy) c.run(); }) + ' style="width:100%;border:0;border-radius:999px;padding:16px;font-family:inherit;font-size:16px;font-weight:800;color:#fff;background:' + (c.danger ? '#9b1c31' : '#5b4ae8') + ';cursor:pointer">' + esc(c.cta) + '</button>' +
            '<button type="button" ' + on(() => setState({ confirm: null })) + ' style="width:100%;background:#fff;border:1.5px solid #dcdfe6;border-radius:999px;padding:15px;font-family:inherit;font-size:16px;font-weight:800;color:#0d1117;cursor:pointer">' + esc(c.keep) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    if (st.toast) {
      out += '<div role="status" style="position:absolute;left:16px;right:16px;bottom:calc(var(--nav-h) + 12px);z-index:40;display:flex;justify-content:center;pointer-events:none">' +
        '<div style="background:#0d1117;color:#fff;border-radius:14px;padding:12px 16px;font-size:14.5px;font-weight:700;box-shadow:0 12px 30px rgba(15,18,25,.3);animation:popIn 240ms cubic-bezier(.22,.9,.28,1) both">' + esc(st.toast) + '</div>' +
      '</div>';
    }
    return out;
  }

  function viewProblem() {
    if (!state.error) return '';
    const msg = state.error === 'config'
      ? 'Sparks isn’t connected to its database yet.'
      : 'Couldn’t load ideas. Check your connection, then refresh.';
    return '<div role="alert" style="margin:12px 14px 0;background:#fdeef0;border:1.5px solid #f5c2cb;border-radius:14px;padding:12px 14px;font-size:14.5px;line-height:1.4;font-weight:700;color:#9b1c31">' + msg + '</div>';
  }

  function viewNav() {
    const screen = state.screen;
    const tab = (active) => 'padding:9px 0;min-height:44px;display:flex;align-items:center;justify-content:center;width:100%;color:' + (active ? '#5b4ae8' : '#5c6270') + ';cursor:pointer';
    const ic = (paths) => '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
    return '<nav class="tabbar" aria-label="Main">' +
      '<div ' + on(() => go('home')) + ' aria-label="Home" style="' + tab(screen === 'home') + '">' + ic('<path d="M3 10.5 12 3.5l9 7"/><path d="M5.5 9.5V20h13V9.5"/>') + '</div>' +
      '<div ' + on(() => go('how')) + ' aria-label="How this works" style="' + tab(screen === 'how') + '">' + ic('<path d="M12 6.5C10.5 5 8 4.3 4 4.5V18c4-.2 6.5.5 8 2 1.5-1.5 4-2.2 8-2V4.5c-4-.2-6.5.5-8 2Z"/><path d="M12 6.5V20"/>') + '</div>' +
      '<div ' + on(goCompose) + ' aria-label="Post an idea" style="width:44px;height:44px;border-radius:999px;background:#5b4ae8;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(91,74,232,.3);cursor:pointer">' + plus(23, '#fff', 2.5) + '</div>' +
      '<div ' + on(() => go('browse')) + ' aria-label="All sparks" style="' + tab(screen === 'browse') + '">' + ic('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>') + '</div>' +
      '<div ' + on(() => go('profile')) + ' aria-label="Profile" style="' + tab(screen === 'profile') + '">' + ic('<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5c.6-3.8 3.6-5.8 7.2-5.8s6.6 2 7.2 5.8"/>') + '</div>' +
    '</nav>';
  }

  function view() {
    const screen = state.screen;
    const subj = subject();
    let main = '';
    if (screen === 'home') main = viewHome();
    else if (screen === 'browse') main = viewBrowse();
    else if (screen === 'how') main = viewHow();
    else if (screen === 'profile') main = viewProfile();
    else if (subj && screen === 'detail') main = viewDetail(subj);
    else if (screen === 'detail' && state.loaded) main = viewHome();
    return '<div class="scroller">' + viewProblem() + main + '</div>' +
      (screen === 'compose' ? viewCompose() : '') +
      (screen === 'edit' && subj ? viewEdit(subj) : '') +
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
      if (state.confirm) return setState({ confirm: null });
      if (state.loginStep) return closeLogin();
      if (state.nameAsk) return setState({ nameAsk: null, nameText: '' });
      if (state.offerKind) return setState({ offerKind: null, offerText: '' });
      if (state.rsvpOpen) return setState({ rsvpOpen: false });
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

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  // Back/forward buttons fire popstate; a link opened or pasted in the same tab only fires hashchange
  const followUrl = () => {
    const target = fromHash();
    if (target.screen === state.screen && target.subjectId === state.subjectId) return;
    setState(Object.assign({ menu: null, offerKind: null, rsvpOpen: false, nameAsk: null, confirm: null, loginStep: null, loginThen: null }, target));
    const sc = scroller();
    if (sc) sc.scrollTop = 0;
    // A link to an idea posted after this page loaded: fetch now rather than wait for the 30 s refresh
    if (target.subjectId && state.me && !subject()) loadFresh().catch(e => console.error(e));
  };
  window.addEventListener('popstate', followUrl);
  window.addEventListener('hashchange', followUrl);

  const refresh = () => {
    if (!state.me || state.busy || document.hidden) return;
    loadFresh()
      .then(() => { if (state.error === 'load') setState({ error: null }); })
      .catch(e => console.error(e));
  };
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 30000);   // picks up other people's posts and RSVPs; also ages "x minutes ago"

  async function init() {
    if (!sb) { setState({ error: 'config', loaded: true }); return; }
    // Supabase signs the session out when a token refresh fails; replace it right away
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !reauthing) {
        setTimeout(() => { ensureSession().then(() => loadAll()).catch(e => console.error(e)); }, 0);
      }
    });
    try {
      await ensureSession();
      await loadFresh();
    } catch (e) {
      console.error(e);
      setState({ error: 'load', loaded: true });
    }
  }

  Object.assign(state, fromHash());
  render();
  init();
})();
