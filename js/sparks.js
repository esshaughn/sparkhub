/* Spark Hub
   Built from the Claude Design handoff "Spark Torrez - Full Site 3" (design_handoff_spark_hub:
   Spark Hub App.dc.html). One app, many groups; Torrez Fitness is one of them.

   Rendering: each state change re-renders the view to an HTML string and morphs
   it into the live DOM (keeps focus, caret and scroll position intact).
   Event handlers are registered per render and referenced by index via
   data-on / data-input / data-focus attributes.

   Data: Supabase (see supabase/migrations/; js/config.js picks live vs test).
   Every visitor gets an anonymous session. Signing in (email code or Google)
   is needed to post, to join or start a group, and for Profile. Row-level
   security decides who sees a group's ideas (its members, plus anyone holding
   one idea's link) and who sees a guest's phone number (that idea's lead). */

(function () {
  'use strict';

  const SORTS = [['popular', 'Most popular'], ['soon', 'Happening soon'], ['new', 'Newest'], ['old', 'Oldest']];
  const VIEWS = ['cards', 'grid', 'list'];
  const HOPE_PH = ['tacos after', 'teams by class', 'glow-in-the-dark shirts'];
  const FACE_COLORS = ['#5b4ae8', '#e8a71c', '#0f7a3c'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const OFFER_LINES = { spot: 'offered a location: ', day: 'suggested a date: ', help: 'can help: ' };

  // ---------------------------------------------------------------------------
  // Supabase client + per-device prefs
  // ---------------------------------------------------------------------------

  const CFG = window.SPARKS_CONFIG || {};
  // Read before the client starts: coming back from Google adds ?code=… or ?error=…
  const AUTH_RETURN = (() => {
    try {
      const q = new URLSearchParams(location.search);
      return { any: q.has('code') || q.has('error'), error: q.get('error'), errorCode: q.get('error_code') };
    } catch (e) { return {}; }
  })();
  // PKCE keeps the Google round trip in the query string, clear of our #/ routes
  const sb = window.supabase && CFG.supabaseUrl
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { flowType: 'pkce' } })
    : null;

  // Only conveniences live in the browser: current group, view, sort, and a guest's name + number
  const PREFS_KEY = 'spark-hub-prefs';
  const loadPrefs = () => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
  };
  let lastPrefs = '';
  const savePrefs = () => {
    const next = JSON.stringify({ groupId: state.groupId, view: state.view, sort: state.sort, guestName: state.guestName, guestPhone: state.guestPhone });
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

  const css = (o) => Object.keys(o).map(k => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + ':' + o[k]).join(';');

  const cleanTitle = (t) => {
    const s = (t || '').trim().replace(/\s+/g, ' ').replace(/[.!,;\s]+$/, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  };
  const titleCase = (t) => cleanTitle(t).replace(/(^|\s)(\S)/g, (m, a, c) => a + c.toUpperCase());
  const initialOf = (n) => (n || '').trim().charAt(0).toUpperCase();
  const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';

  const pad2 = (n) => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const fmtTime = (hhmm) => {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    return (h % 12 || 12) + (m ? ':' + pad2(m) : '') + (h < 12 ? 'am' : 'pm');
  };
  const fmtDay = (iso) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const uuid = () => (crypto.randomUUID && crypto.randomUUID()) ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });

  const PHOTO_BUCKET = 'spark-photos';
  // Storage paths are '<uploader uid>/<uuid>.jpg' (the database checks the same shape)
  const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
  const SITE_PHOTO = /^photos\/[a-z0-9-]+\.(jpg|png)$/;
  const photoUrl = (path) => PHOTO_PATH.test(path || '')
    ? CFG.supabaseUrl + '/storage/v1/object/public/' + PHOTO_BUCKET + '/' + path
    : SITE_PHOTO.test(path || '') ? '/' + path : null;

  // Per-render handler registry
  let H = [];
  const reg = (fn) => { H.push(fn); return H.length - 1; };
  const on = (fn) => 'data-on="' + reg(fn) + '" role="button" tabindex="0"';
  const onInput = (fn) => 'data-input="' + reg(fn) + '"';
  const onFocus = (fn) => 'data-focus="' + reg(fn) + '"';
  const stop = (e) => { if (e && e.stopPropagation) e.stopPropagation(); };

  // ---------------------------------------------------------------------------
  // Icons (inline SVG, from the design file)
  // ---------------------------------------------------------------------------

  const svg = (size, attrs, body) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true" ' + attrs + '>' + body + '</svg>';
  const stroke = (color, w) => 'fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"';
  const I = {
    bolt: (size, fill) => svg(size, 'fill="none"', '<path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z" fill="' + fill + '" stroke="' + fill + '" stroke-width="1.7" stroke-linejoin="round"/>'),
    boltRays: (size) => svg(size, 'fill="none"', '<path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z" fill="#f3c55a" stroke="#f3c55a" stroke-width="1.7" stroke-linejoin="round"/><path d="M4.6 4.6 6.9 7.2" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/><path d="M1.9 15.2 5.1 14.9" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/><path d="M19.4 4.6 17.1 7.2" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/><path d="M22.1 15.2 18.9 14.9" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/>'),
    boltSolid: (size) => svg(size, 'fill="#e8a71c"', '<path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z"/>'),
    plus: (size, color, w) => svg(size, stroke(color, w), '<path d="M12 5v14M5 12h14"/>'),
    x: (size, color, w) => svg(size, stroke(color, w), '<path d="M6 6l12 12M18 6 6 18"/>'),
    chevL: (size, color, w) => svg(size, stroke(color, w), '<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
    chevR: (size, color, w) => svg(size, stroke(color, w), '<path d="M9 6l6 6-6 6"/>'),
    chevD: (size, color, w) => svg(size, stroke(color, w), '<path d="m6 9 6 6 6-6"/>'),
    check: (size, color, w) => svg(size, stroke(color, w), '<path d="M5 12.5l4.5 4.5L19 7"/>'),
    cal: (size, w) => svg(size, stroke('currentColor', w || 2.2) + ' style="flex:0 0 ' + size + 'px"', '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
    pin: (size, w) => svg(size, stroke('currentColor', w || 2.2) + ' style="flex:0 0 ' + size + 'px"', '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>'),
    person: (size, w) => svg(size, stroke('currentColor', w || 2.4), '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5c.6-3.8 3.6-5.8 7.2-5.8s6.6 2 7.2 5.8"/>'),
    edit: (size, color) => svg(size, stroke(color || 'currentColor', 2.2), '<path d="M16.6 3.8l3.6 3.6L8.4 19.2 4 20.5l1.3-4.4L16.6 3.8Z"/>'),
    trash: (size, color) => svg(size, stroke(color, 2.1), '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2l.9-12.2"/>'),
    photo: (size, color, w) => svg(size, stroke(color, w), '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="M20.5 15.5l-4.5-4.5-7.5 7.5"/>'),
    camera: (size) => svg(size, stroke('#0d1117', 2.2), '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10H4Z"/><circle cx="12" cy="13" r="3.2"/>'),
    shield: (size, color, w) => svg(size, stroke(color, w) + ' style="flex:0 0 ' + size + 'px;margin-top:2px"', '<path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6l-7-2.8Z"/>'),
    keypad: (size) => svg(size, stroke('#5b4ae8', 2.2), '<rect x="4" y="7" width="16" height="11" rx="2.5"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 14.5h8"/>'),
    star: (size) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="#e8a71c" aria-hidden="true"><path d="M12 2.5 14.6 8l6 .7-4.5 4.1 1.2 5.9L12 15.8l-5.3 2.9 1.2-5.9L3.4 8.7l6-.7Z"/></svg>',
    offline: svg(16, stroke('#9b1c31', 2.2), '<path d="M4.5 9.5a11 11 0 0 1 15 0M7.5 13a6.5 6.5 0 0 1 9 0"/><circle cx="12" cy="17" r="1.2" fill="#9b1c31"/><path d="M4 4l16 16"/>'),
    viewCards: svg(15, 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"', '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/>'),
    viewGrid: svg(15, 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"', '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>'),
    viewList: svg(15, 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"', '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>'),
    tabHome: svg(23, stroke('currentColor', 1.9), '<path d="M3 10.5 12 3.5l9 7"/><path d="M5.5 9.5V20h13V9.5"/>'),
    tabHow: svg(23, stroke('currentColor', 1.9), '<path d="M12 6.5C10.5 5 8 4.3 4 4.5V18c4-.2 6.5.5 8 2 1.5-1.5 4-2.2 8-2V4.5c-4-.2-6.5.5-8 2Z"/><path d="M12 6.5V20"/>'),
    tabAll: svg(23, stroke('currentColor', 1.9), '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
    tabProfile: svg(23, stroke('currentColor', 1.9), '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5c.6-3.8 3.6-5.8 7.2-5.8s6.6 2 7.2 5.8"/>'),
    google: '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style="flex:0 0 20px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const prefs = loadPrefs();
  const blankCompose = () => ({
    step: 'activity', activity: '', hopes: ['', '', ''], photos: [],
    locMode: 'specific', locText: '', locPlace: null, locSuggest: [],
    whenMode: 'one', dateOne: '', timeOne: '', timeOn: false
  });
  const state = Object.assign({
    screen: 'home', menu: null, subjectId: null, gpId: null, tag: null, zoom: null,
    sort: SORTS.some(s => s[0] === prefs.sort) ? prefs.sort : 'popular',
    view: VIEWS.indexOf(prefs.view) > -1 ? prefs.view : 'cards',
    groupId: prefs.groupId || null,

    me: null, email: '', isGoogle: false, myName: '', myAvatar: null,
    loaded: false, error: null, busy: null, toast: null, goneOpen: false,

    groups: [], sparks: [], profiles: {},

    editText: '', editHopes: ['', '', ''],

    loginStep: null, loginFrom: 'default', loginThen: null, loginMode: 'link', loginEmail: '', loginCode: '',
    resent: false, mergeToken: null, googleFailed: false,
    nameAsk: null, nameText: '',
    guestOpen: false, guestThen: null, guest: null,
    guestName: prefs.guestName || '', guestPhone: prefs.guestPhone || '',
    offerKind: null, offerText: '', offerPlace: null, offerSuggest: [],
    joinOpen: false, joinCode: '', joinBad: false,
    create: null, createName: '', created: null,
    pe: null, confirm: null, interestList: false,
    gpCode: '', gpMembers: null
  }, blankCompose());

  // ---- URL <-> screen, so ideas and invites can be shared and the back button works

  const hashFor = () => {
    const s = state.screen;
    if (s === 'detail' && state.subjectId) return '#/idea/' + state.subjectId;
    if (s === 'groupPage' && state.gpId) return '#/group/' + state.gpId;
    return { home: '', browse: '#/ideas', how: '#/how', profile: '#/me' }[s] != null
      ? { home: '', browse: '#/ideas', how: '#/how', profile: '#/me' }[s] : null;
  };
  const syncHash = () => {
    const h = hashFor();
    if (h === null || (location.hash || '') === h) return;   // compose / edit keep the current URL
    history.pushState(null, '', h || location.pathname + location.search);
  };
  const JOIN_PATH = /^\/join\/([A-Za-z0-9]{6})\/?$/;
  const fromUrl = () => {
    const h = location.hash;
    let m = h.match(/^#\/idea\/([0-9a-f-]{36})$/);
    if (m) return { screen: 'detail', subjectId: m[1], tag: null };
    m = h.match(/^#\/group\/([0-9a-f-]{36})$/);
    if (m) return { screen: 'groupPage', gpId: m[1] };
    m = h.match(/^#\/join\/([A-Za-z0-9]{6})$/) || location.pathname.match(JOIN_PATH);
    if (m) return { screen: 'home', inviteCode: m[1].toUpperCase() };
    if (h === '#/ideas') return { screen: 'browse' };
    if (h === '#/how') return { screen: 'how' };
    if (h === '#/me') return { screen: 'profile' };
    return { screen: 'home' };
  };

  const setState = (patch) => {
    const prevStep = state.step, prevScreen = state.screen, prevSubj = state.subjectId, prevGp = state.gpId;
    Object.assign(state, patch);
    savePrefs();
    render();
    if (state.step !== prevStep) {
      const ov = document.querySelector('.overlay-screen');
      if (ov) ov.scrollTop = 0;
    }
    if (state.screen !== prevScreen || state.subjectId !== prevSubj || state.gpId !== prevGp) syncHash();
  };

  const scroller = () => document.querySelector('.scroller');
  const go = (screen, extra) => {
    setState(Object.assign({ screen, menu: null, zoom: null }, extra || {}));
    const sc = scroller();
    if (sc) sc.scrollTop = 0;
  };

  let toastTimer = null;
  const toast = (text, ok) => {
    setState({ toast: { text, ok: !!ok } });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setState({ toast: null }), 3500);
  };
  const FAILED = 'That didn’t go through. Try again in a moment.';
  const BAD_PHOTO = 'That photo couldn’t be read. Try a different one.';

  const must = (res) => { if (res.error) throw res.error; return res; };

  // ---------------------------------------------------------------------------
  // Domain
  // ---------------------------------------------------------------------------

  const subject = () => state.sparks.find(s => s.id === state.subjectId) || null;
  const myGroups = () => state.groups.filter(g => g.role);          // groups you belong to
  const groupById = (id) => state.groups.find(g => g.id === id) || null;
  const currentGroup = () => {
    const mine = myGroups();
    return mine.find(g => g.id === state.groupId) || mine.find(g => g.role === 'admin') || mine[0] || null;
  };
  const isLead = (s) => !!s && !!state.me && s.leadId === state.me;
  // The lead, or an admin of the idea's group, can edit or delete it
  const isGroupAdmin = (s) => { const g = s && groupById(s.groupId); return !!g && g.role === 'admin'; };
  const canEdit = (s) => isLead(s) || isGroupAdmin(s);
  const nameOf = (uid, fallback) => {
    if (uid && uid === state.me && state.myName) return state.myName;
    const p = uid && state.profiles[uid];
    return (p && p.name) || fallback || 'Someone';
  };
  const avatarOf = (uid) => {
    if (uid && uid === state.me) return state.myAvatar ? photoUrl(state.myAvatar) : null;
    const p = uid && state.profiles[uid];
    return p && p.avatar ? photoUrl(p.avatar) : null;
  };
  const freshCount = (g) => g.lastSeen ? state.sparks.filter(s => s.groupId === g.id && s.created > g.lastSeen && s.createdBy !== state.me).length : 0;

  const dayOf = (s) => s.dayDate ? { day: fmtDay(s.dayDate), time: fmtTime(s.dayTime) } : (s.dayText ? { day: s.dayText, time: '' } : null);

  const visible = () => {
    const g = currentGroup();
    const out = state.sparks.filter(s => g && s.groupId === g.id);
    const byNew = (x, y) => y.created - x.created;
    if (state.sort === 'new') out.sort(byNew);
    if (state.sort === 'old') out.sort((x, y) => x.created - y.created);
    if (state.sort === 'popular') out.sort((x, y) => y.interested.length - x.interested.length || byNew(x, y));
    if (state.sort === 'soon') {
      // Upcoming dates first (soonest on top), then ideas with no date yet (newest first), then past dates
      const today = todayISO(), when = (x) => x.dayDate + (x.dayTime || '');
      const rank = (x) => !x.dayDate ? 1 : x.dayDate >= today ? 0 : 2;
      out.sort((x, y) => rank(x) - rank(y) || (rank(x) === 0 ? when(x).localeCompare(when(y)) : rank(x) === 2 ? when(y).localeCompare(when(x)) : byNew(x, y)));
    }
    return out;
  };

  const comingUp = () => {
    const today = todayISO();
    const mine = new Set(myGroups().map(g => g.id));
    return state.sparks
      .filter(s => mine.has(s.groupId) && s.dayDate && s.dayDate >= today)
      .sort((a, b) => (a.dayDate + (a.dayTime || '')).localeCompare(b.dayDate + (b.dayTime || '')))
      .slice(0, 3);
  };

  // ---------------------------------------------------------------------------
  // Data (Supabase)
  // ---------------------------------------------------------------------------

  const toSpark = (row, offers, interests, contacts) => ({
    id: row.id, groupId: row.group_id, text: row.text,
    hopes: (row.hopes || []).filter(Boolean),
    createdBy: row.created_by, created: Date.parse(row.created_at),
    leadId: row.lead_id, leadName: row.lead_name || row.author_name || 'Someone',
    spot: row.spot || '', spotAddress: row.spot_address || '',
    spotPoint: Number.isFinite(row.spot_lat) && Number.isFinite(row.spot_lon) ? [row.spot_lat, row.spot_lon] : null,
    dayDate: row.day_date || null, dayTime: row.day_time ? String(row.day_time).slice(0, 5) : null,
    dayText: row.day_date ? '' : (row.day || ''),
    vision: row.vision || '',
    photoPaths: (row.photos || []).filter(p => PHOTO_PATH.test(p)),
    mood: (row.mood || []).filter(p => PHOTO_PATH.test(p)),
    offers: offers.filter(o => o.spark_id === row.id && o.status === 'accepted')
      .map(o => ({ userId: o.user_id, who: o.who, kind: o.kind, body: o.body })),
    pending: offers.filter(o => o.spark_id === row.id && o.status === 'pending')
      .map(o => ({ id: o.id, userId: o.user_id, who: o.who, kind: o.kind, body: o.body })),
    interested: interests.filter(i => i.spark_id === row.id).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(i => i.user_id),
    contacts: contacts.filter(c => c.spark_id === row.id)
  });

  const offerText = (o) => o.kind === 'day' && /^\d{4}-\d{2}-\d{2}/.test(o.body)
    ? fmtDay(o.body.slice(0, 10)) + (o.body.length > 10 ? ', ' + fmtTime(o.body.slice(11, 16)) : '')
    : o.body;

  const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

  async function loadAll() {
    if (!sb) return;
    const [mem, grp, sp, of, it, gc] = await Promise.all([
      sb.from('memberships').select('group_id,role,last_seen_at'),
      sb.from('groups').select('id,name,photo'),
      sb.from('sparks').select('*').order('created_at', { ascending: false }),
      sb.from('offers').select('*').order('created_at'),
      sb.from('interests').select('spark_id,user_id,created_at'),
      sb.from('guest_contacts').select('spark_id,user_id,name,phone')
    ]);
    [mem, grp, sp, of, it, gc].forEach(must);

    const roles = {};
    mem.data.forEach(m => { roles[m.group_id] = { role: m.role, lastSeen: Date.parse(m.last_seen_at) }; });
    const groups = grp.data.map(g => Object.assign({ id: g.id, name: g.name, photo: g.photo, role: null, lastSeen: 0 }, roles[g.id] || {}))
      .sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || a.name.localeCompare(b.name));

    const sparks = sp.data.map(r => toSpark(r, of.data, it.data, gc.data));

    // Names and photos of everyone on screen
    const ids = new Set([state.me]);
    sparks.forEach(s => { ids.add(s.leadId); s.interested.forEach(u => ids.add(u)); s.offers.concat(s.pending).forEach(o => ids.add(o.userId)); });
    ids.delete(null); ids.delete(undefined);
    const profiles = {};
    for (const part of chunks(Array.from(ids), 80)) {
      const res = must(await sb.from('profiles').select('id,name,avatar_path').in('id', part));
      res.data.forEach(p => { profiles[p.id] = { name: p.name || '', avatar: PHOTO_PATH.test(p.avatar_path || '') ? p.avatar_path : null }; });
    }
    const mine = profiles[state.me] || {};
    document.documentElement.setAttribute('data-loaded', 'true');   // tests wait for this
    setState({
      groups, sparks, profiles, loaded: true, error: null,
      myName: mine.name || state.myName, myAvatar: mine.avatar || null
    });
  }

  // ---- Session recovery ------------------------------------------------------
  // The anonymous session can go bad mid-visit (site data cleared, refresh token
  // revoked). Supabase then falls back to the bare publishable key and reads come
  // back refused. Quietly start a fresh session and retry.

  // Our name lives in display_name (Google overwrites `name` with the full name on every sign-in)
  const metaName = (meta) => meta.display_name ||
    (/google/.test(meta.iss || '') ? firstName(meta.name || meta.full_name) : meta.name) || '';

  const noteSession = (session) => {
    const u = session.user, meta = u.user_metadata || {};
    const email = !u.is_anonymous && u.email ? u.email : '';
    const google = !u.is_anonymous && ((u.app_metadata || {}).provider === 'google' || ((u.app_metadata || {}).providers || []).indexOf('google') > -1);
    if (u.id !== state.me || email !== state.email || google !== state.isGoogle) {
      setState({ me: u.id, email, isGoogle: google, myName: (u.is_anonymous ? state.myName : metaName(meta) || state.myName).slice(0, 30) });
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
    e.code === 'PGRST301' || e.code === 'PGRST303' ||
    e.status === 401 || /jwt|refresh token|session/i.test(e.message || ''));

  const loadFresh = async () => {
    try {
      await loadAll();
    } catch (e) {
      if (!isAuthFailure(e)) throw e;
      await ensureSession(true);
      await loadAll();
    }
  };

  // Run a write, then refresh. Errors become the "didn't go through" toast.
  const run = async (work, after) => {
    setState({ busy: 'save' });
    try {
      await ensureSession();
      await work();
      await loadFresh();
      setState(Object.assign({ busy: null }, typeof after === 'function' ? after() : (after || {})));
      return true;
    } catch (e) {
      console.error(e);
      setState({ busy: null });
      toast(FAILED);
      return false;
    }
  };

  // Opening a shared idea link grants this session access to that one idea
  const opened = new Set();
  const openLink = async (id) => {
    if (!id || opened.has(id)) return true;
    const res = must(await sb.rpc('open_idea', { p_spark: id }));
    if (res.data) opened.add(id);
    return !!res.data;
  };

  // Load, and make sure a linked idea is reachable; an unknown one shows "That idea isn't up anymore"
  const loadForRoute = async () => {
    if (state.screen === 'detail' && state.subjectId) {
      const ok = await openLink(state.subjectId);
      if (!ok) setState({ screen: 'home', subjectId: null, goneOpen: true });
    }
    await loadFresh();
    if (state.screen === 'detail' && !subject()) setState({ screen: 'home', subjectId: null, goneOpen: true });
    if (state.screen === 'groupPage') openGroupPage(state.gpId, true);
  };

  // ---------------------------------------------------------------------------
  // Gates: sign-in, name, guest info
  // ---------------------------------------------------------------------------

  const openLogin = (from, then) => setState({
    loginStep: 'email', loginFrom: from || 'default', loginThen: then || null, loginMode: 'link',
    loginCode: '', resent: false, googleFailed: false, loginEmailOnly: false, nameAsk: null, guestOpen: false, menu: null
  });
  const closeLogin = () => setState({ loginStep: null, loginCode: '', loginThen: null, googleFailed: false, loginEmailOnly: false, busy: null });

  const needSignIn = (fn, from) => { if (state.email) fn(); else openLogin(from, fn); };
  const needName = (fn) => { if (state.myName) fn(); else setState({ nameAsk: fn, nameText: '' }); };
  // Guests (not signed in) leave a name and number once per visit so the lead can reach them
  const needGuest = (fn) => {
    if (state.email) { needName(fn); return; }
    if (state.guest) { fn(); return; }
    setState({ guestOpen: true, guestThen: fn, guestName: state.guestName || state.myName || '' });
  };
  const saveGuestContact = async (sparkId) => {
    if (state.email || !state.guest || !sparkId) return;
    must(await sb.from('guest_contacts').upsert({ spark_id: sparkId, user_id: state.me, name: state.guest.name, phone: state.guest.phone }, { onConflict: 'spark_id,user_id' }));
  };

  const saveName = async (name, stampEverywhere) => {
    setState({ myName: name });
    if (!sb) return;
    sb.auth.updateUser({ data: { name, display_name: name } }).catch(() => {});
    if (stampEverywhere) must(await sb.rpc('rename_me', { p_name: name }));
    else must(await sb.from('profiles').upsert({ id: state.me, name }, { onConflict: 'id' }));
  };

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------

  const markSeen = (g) => {
    if (!g || !g.role || !sb) return;
    g.lastSeen = Date.now();
    sb.from('memberships').update({ last_seen_at: new Date().toISOString() }).eq('group_id', g.id).eq('user_id', state.me)
      .then(() => {}, () => {});
  };
  const openGroup = (g) => { if (!g) return; markSeen(g); go('browse', { groupId: g.id }); };
  const pickGroup = (g) => { markSeen(g); setState({ groupId: g.id, menu: null }); };

  const inviteLink = (code) => location.origin + '/join/' + code;
  const copy = (text, note) => {
    const done = () => toast(note, true);
    try { navigator.clipboard.writeText(text).then(done, done); } catch (e) { done(); }
  };

  const openGroupPage = async (id, quiet) => {
    if (!quiet) go('groupPage', { gpId: id, gpCode: '', gpMembers: null });
    try {
      const [code, count] = await Promise.all([sb.rpc('group_code', { p_group: id }), sb.rpc('member_count', { p_group: id })]);
      setState({ gpCode: code.data || '', gpMembers: count.data });
    } catch (e) { console.error(e); }
  };

  const openJoin = (code) => {
    setState({ menu: null });
    needSignIn(() => setState({ joinOpen: true, joinCode: code || state.joinCode || '', joinBad: false }), 'join');
  };
  const submitJoin = async () => {
    const code = state.joinCode;
    if (code.length !== 6 || state.busy) return;
    setState({ busy: 'join' });
    try {
      const res = must(await sb.rpc('join_group', { p_code: code }));
      if (!res.data) { setState({ busy: null, joinBad: true }); return; }
      await loadFresh();
      const g = groupById(res.data);
      setState({ busy: null, joinOpen: false, joinCode: '' });
      openGroup(g);
    } catch (e) {
      console.error(e);
      setState({ busy: null });
      toast(FAILED);
    }
  };

  const startGroup = () => { setState({ menu: null }); needSignIn(() => setState({ create: 'name', createName: '' }), 'group'); };
  const submitCreate = async () => {
    const name = titleCase(state.createName);
    if (name.length < 2 || state.busy) return;
    setState({ busy: 'create' });
    try {
      const res = must(await sb.rpc('create_group', { p_name: name }));
      const row = (res.data || [])[0];
      await loadFresh();
      setState({ busy: null, create: 'done', created: { id: row.id, name, code: row.code } });
    } catch (e) {
      console.error(e);
      setState({ busy: null });
      toast(FAILED);
    }
  };

  // ---------------------------------------------------------------------------
  // Photos
  // ---------------------------------------------------------------------------

  // Shrink to ≤1600px JPEG before upload: phone photos are 3–10 MB, this is ~300 KB
  const shrinkImage = (file, max) => new Promise((resolve, reject) => {
    if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '')) { reject(new Error('heic')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, (max || 1600) / Math.max(img.naturalWidth, img.naturalHeight));
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

  const uploadBlob = async (blob) => {
    const path = state.me + '/' + uuid() + '.jpg';
    must(await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
    return path;
  };
  const deletePhotos = (paths) => {
    const own = (paths || []).filter(p => p && p.indexOf(state.me + '/') === 0);
    if (own.length) sb.storage.from(PHOTO_BUCKET).remove(own).catch(() => {});
  };

  const addPhotos = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 3 - state.photos.length);
    for (const file of files) {
      try {
        const blob = await shrinkImage(file);
        if (state.photos.length >= 3) break;
        setState({ photos: state.photos.concat([{ blob, url: URL.createObjectURL(blob) }]) });
      } catch (e) {
        toast(BAD_PHOTO);
      }
    }
  };
  const removePhoto = (i) => {
    const p = state.photos[i];
    if (p) URL.revokeObjectURL(p.url);
    setState({ photos: state.photos.filter((_, j) => j !== i) });
  };

  // ---------------------------------------------------------------------------
  // Location suggestions (Geoapify autocomplete, OpenStreetMap data)
  // ---------------------------------------------------------------------------
  // Suggestions only help: whatever is typed can still be used as-is. Lookups
  // start at 3 characters (2 return nothing useful), wait 150ms for a pause in
  // typing, and are remembered, so a location costs a few requests. If the
  // service is down or over its daily limit, the list just doesn't appear.

  const PLACES = CFG.places || null;   // { key, lat, lon, radius (m) }
  let placeTimer = null, placeAbort = null;
  const placeCache = new Map();
  const shortAddr = (a) => (a || '').replace(/,\s*United States( of America)?$/, '').slice(0, 200);
  const toPlaces = (results) => {
    const seen = {};
    return (results || []).map(r => ({
      name: cleanTitle(r.name || r.address_line1 || '').slice(0, 80),
      sub: shortAddr(r.address_line2),
      address: shortAddr(r.name ? r.address_line2 : r.formatted),
      lat: +r.lat, lon: +r.lon
    })).filter(p => {
      const k = p.name + '|' + p.sub;
      if (!p.name || seen[k] || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
      return (seen[k] = true);
    });
  };
  // `field` is 'loc' (post flow) or 'offer' (the lead setting a location)
  const findPlaces = (text, field) => {
    const key = field === 'offer' ? 'offerSuggest' : 'locSuggest';
    const textKey = field === 'offer' ? 'offerText' : 'locText';
    const pickKey = field === 'offer' ? 'offerPlace' : 'locPlace';
    clearTimeout(placeTimer);
    if (placeAbort) { placeAbort.abort(); placeAbort = null; }
    const q = text.trim();
    if (!PLACES || q.length < 3) { if (state[key].length) setState({ [key]: [] }); return; }
    const ck = q.toLowerCase();
    if (placeCache.has(ck)) { setState({ [key]: placeCache.get(ck) }); return; }
    placeTimer = setTimeout(async () => {
      const ctrl = placeAbort = new AbortController();
      const url = 'https://api.geoapify.com/v1/geocode/autocomplete?format=json&limit=5&lang=en' +
        '&text=' + encodeURIComponent(q) +
        '&filter=circle:' + PLACES.lon + ',' + PLACES.lat + ',' + PLACES.radius +
        '&bias=proximity:' + PLACES.lon + ',' + PLACES.lat +
        '&apiKey=' + encodeURIComponent(PLACES.key);
      try {
        const res = await fetch(url, { signal: ctrl.signal, referrerPolicy: 'origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const found = toPlaces((await res.json()).results);
        if (placeCache.size > 100) placeCache.clear();
        placeCache.set(ck, found);
        if (state[textKey].trim() !== q || state[pickKey]) return;   // typing moved on
        setState({ [key]: found });
      } catch (e) {
        if (e.name === 'AbortError') return;
        console.warn('Location suggestions unavailable:', e.message);
        setState({ [key]: [] });
      }
    }, 150);
  };

  // ---------------------------------------------------------------------------
  // Posting and editing
  // ---------------------------------------------------------------------------

  const composeReset = () => {
    state.photos.forEach(p => URL.revokeObjectURL(p.url));
    return blankCompose();
  };
  const goCompose = () => {
    setState({ menu: null });
    if (state.email && !currentGroup()) { openJoin(); return; }
    go('compose', composeReset());
  };

  const dayFields = (st) => st.whenMode === 'one' && st.dateOne
    ? { day_date: st.dateOne, day_time: st.timeOn && st.timeOne ? st.timeOne : null }
    : { day_date: null, day_time: null };

  // Leads need an account: sign in first, then carry on posting the same draft
  const createDraft = () => needSignIn(() => {
    if (!currentGroup()) { openJoin(); return; }
    needName(postDraft);
  }, 'post');
  const postDraft = () => {
    const st = state, g = currentGroup();
    if (!g || st.busy) return;
    const place = st.locMode === 'specific' && st.locPlace ? st.locPlace : null;
    let id = null, paths = [];
    setState({ busy: 'post' });
    (async () => {
      try {
        await ensureSession();
        for (const p of st.photos) paths.push(await uploadBlob(p.blob));
        const row = Object.assign({
          group_id: g.id, author_name: st.myName, text: cleanTitle(st.activity),
          hopes: st.hopes.map(cleanTitle).filter(Boolean), photos: paths, cat: 'events', answers: {},
          lead_id: st.me, lead_name: st.myName, created_by: st.me,
          spot: st.locMode === 'specific' ? cleanTitle(st.locText) || null : null, spot_open: st.locMode === 'open',
          spot_address: place ? place.address : null, spot_lat: place ? place.lat : null, spot_lon: place ? place.lon : null
        }, dayFields(st));
        try {
          id = must(await sb.from('sparks').insert(row).select('id').single()).data.id;
        } catch (e) {
          deletePhotos(paths);
          throw e;
        }
        await loadFresh();
        setState(Object.assign(composeReset(), { busy: null }));
        go('detail', { subjectId: id, tag: 'It’s up' });
      } catch (e) {
        console.error(e);
        setState({ busy: null });
        toast(FAILED);
      }
    })();
  };

  const openEdit = (s) => setState({ screen: 'edit', editText: s.text, editHopes: [0, 1, 2].map(i => s.hopes[i] || '') });
  const saveEdit = (s) => {
    if (!state.editText.trim() || state.busy) return;
    run(async () => {
      const text = cleanTitle(state.editText), hopes = state.editHopes.map(cleanTitle).filter(Boolean);
      if (isLead(s)) must(await sb.from('sparks').update({ text, hopes }).eq('id', s.id));
      else must(await sb.rpc('admin_edit_spark', { p_spark: s.id, p_text: text, p_hopes: hopes }));
    }, { screen: 'detail', tag: 'Saved' });
  };
  const askDelete = (s) => setState({ confirm: {
    title: 'Delete this idea?',
    body: 'It comes down for everyone, along with its offers and interest. This can’t be undone.',
    cta: 'Delete it', keep: 'Keep it', danger: true,
    run: () => {
      const photos = s.photoPaths.concat(s.mood);
      run(async () => {
        must(await sb.from('sparks').delete().eq('id', s.id));
      }, { confirm: null, screen: 'browse', subjectId: null, tag: null }).then(ok => { if (ok) deletePhotos(photos); });
    }
  } });

  // ---------------------------------------------------------------------------
  // Taking part: interest, suggestions, the lead's calls, mood board
  // ---------------------------------------------------------------------------

  // Taking interest back needs nothing; showing interest asks a guest for their info
  const toggleInterest = (s) => {
    if (s.interested.indexOf(state.me) > -1) {
      run(async () => { must(await sb.from('interests').delete().eq('spark_id', s.id).eq('user_id', state.me)); }, { tag: null });
      return;
    }
    needGuest(() => run(async () => {
      await saveGuestContact(s.id);
      must(await sb.from('interests').insert({ spark_id: s.id, user_id: state.me }));
    }, { tag: 'You’re interested' }));
  };

  // Non-leads suggest (waits for the lead); the lead sets it straight away
  const openOffer = (s, kind) => {
    const text = kind === 'vision' ? s.vision : '';
    const open = () => setState({ offerKind: kind, offerText: text, offerPlace: null, offerSuggest: [] });
    if (isLead(s)) open(); else needGuest(open);
  };
  const commitOffer = (s) => {
    const kind = state.offerKind, text = state.offerText.trim(), place = state.offerPlace;
    if (!text || state.busy) return;
    if (kind === 'vision') {
      run(async () => { must(await sb.from('sparks').update({ vision: text.slice(0, 1000) }).eq('id', s.id)); }, { offerKind: null, offerText: '' });
      return;
    }
    if (isLead(s)) {
      const row = kind === 'day'
        ? { day_date: text.slice(0, 10), day_time: text.length > 10 ? text.slice(11, 16) : null }
        : { spot: cleanTitle(text).slice(0, 80), spot_open: false, spot_address: place ? place.address : null, spot_lat: place ? place.lat : null, spot_lon: place ? place.lon : null };
      run(async () => { must(await sb.from('sparks').update(row).eq('id', s.id)); },
        { offerKind: null, offerText: '', offerPlace: null, tag: kind === 'day' ? 'Date set' : 'Location set' });
      return;
    }
    run(async () => {
      await saveGuestContact(s.id);
      must(await sb.rpc('add_offer', { p_spark: s.id, p_kind: kind, p_body: kind === 'spot' ? cleanTitle(text) : text, p_who: state.myName || 'Someone' }));
    }, { offerKind: null, offerText: '', tag: 'Sent to the lead' });
  };
  const resolveOffer = (s, p, accept) => run(async () => {
    must(await sb.rpc('resolve_offer', { p_offer: p.id, p_accept: accept }));
  }, accept ? { tag: p.kind === 'spot' ? 'Location set' : 'Date set' } : {});

  const addMood = async (s, fileList) => {
    const f = (fileList || [])[0];
    if (!f || s.mood.length >= 3) return;
    let blob;
    try { blob = await shrinkImage(f); } catch (e) { toast(BAD_PHOTO); return; }
    let path = null;
    run(async () => {
      path = await uploadBlob(blob);
      const cur = (subject() || s).mood;
      try {
        must(await sb.from('sparks').update({ mood: cur.concat([path]).slice(0, 3) }).eq('id', s.id));
      } catch (e) { deletePhotos([path]); throw e; }
    });
  };
  // Files are removed after the page has stopped showing them
  const removeMood = (s, path) => run(async () => {
    must(await sb.from('sparks').update({ mood: s.mood.filter(p => p !== path) }).eq('id', s.id));
  }).then(ok => { if (ok) deletePhotos([path]); });

  // Admins: replace the group's header photo (Profile → Your groups → the group)
  const setGroupPhoto = async (g, fileList) => {
    const f = (fileList || [])[0];
    if (!f || state.busy) return;
    let blob;
    try { blob = await shrinkImage(f); } catch (e) { toast(BAD_PHOTO); return; }
    const old = g.photo;
    let path = null;
    const ok = await run(async () => {
      path = await uploadBlob(blob);
      try { must(await sb.rpc('set_group_photo', { p_group: g.id, p_photo: path })); } catch (e) { deletePhotos([path]); throw e; }
    });
    if (ok) { if (old) deletePhotos([old]); toast('Group photo updated', true); }
  };

  // ---------------------------------------------------------------------------
  // Email sign-in (Supabase email OTP, a 6-digit code)
  // ---------------------------------------------------------------------------
  // 'link':   attach the email to this browser's anonymous identity (same user id).
  // 'signin': the email already has an account. Sign in to it, then pull this
  //           browser's anonymous activity across with a one-time merge token.

  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const tooSoon = (e) => !!e && (e.status === 429 || /security purposes|rate limit|after \d+ seconds/i.test(e.message || ''));

  const sendCode = async (again) => {
    const st = state;
    if (again && st.resent) { toast('One code a minute. Wait a moment, then try again.'); return; }
    const email = st.loginEmail.trim().toLowerCase();
    setState({ busy: 'send' });
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
      setState({ busy: null, loginMode: mode, loginStep: 'code', loginCode: again ? st.loginCode : '', resent: !!again });
    } catch (e) {
      console.error(e);
      setState({ busy: null });
      toast(tooSoon(e) ? 'One code a minute. Wait a moment, then try again.' : 'Couldn’t send a code to that email. Check it and try again.');
    }
  };

  // After any sign-in: stamp the name into the profile, reload, then carry on
  const finishSignIn = async (st, session) => {
    noteSession(session);
    const meta = (session.user && session.user.user_metadata) || {};
    await loadFresh();
    if (!state.profiles[state.me] || !state.profiles[state.me].name) {
      const name = (state.myName || metaName(meta) || '').slice(0, 30);
      if (name) await saveName(name, false).catch(() => {});
    }
    const then = st.loginThen;
    setState({ busy: null, loginStep: null, loginCode: '', loginThen: null, mergeToken: null, googleFailed: false });
    if (typeof then === 'function') then();
    else if (state.screen === 'home') go('home');
  };

  const verifyCode = async () => {
    const st = state;
    const email = st.loginEmail.trim().toLowerCase();
    setState({ busy: 'signin' });
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
      setState({ busy: null });
      toast('That code didn’t work. Check it, or send it again.');
    }
  };

  const signOut = async () => {
    await sb.auth.signOut().catch(() => {});
    setState({ email: '', isGoogle: false, myName: '', myAvatar: null, guest: null, groups: [], sparks: [] });
    go('home');
    await ensureSession(true);
    await loadFresh().catch(() => {});
  };

  // ---------------------------------------------------------------------------
  // "Continue with Google" (Supabase OAuth, a full-page trip to Google)
  // ---------------------------------------------------------------------------
  // The page reloads on the way back, so anything in progress is parked in
  // sessionStorage first: the draft (photos as data URLs), a merge token, the
  // name, and where to pick up. 'link' attaches Google to this anonymous
  // identity. If that Google account already has an account, Supabase sends us
  // back with identity_already_exists: sign in to it instead, then merge.

  const GOOGLE_ON = !!CFG.googleSignIn;
  const RESUME_KEY = 'spark-hub-google-resume';
  const DRAFT_KEYS = ['activity', 'hopes', 'locMode', 'locText', 'locPlace', 'whenMode', 'dateOne', 'timeOne', 'timeOn'];
  const readResume = () => {
    try {
      const r = JSON.parse(sessionStorage.getItem(RESUME_KEY));
      return r && Date.now() - r.at < 30 * 60 * 1000 ? r : null;   // a stale trip is ignored
    } catch (e) { return null; }
  };
  const writeResume = (r) => sessionStorage.setItem(RESUME_KEY, JSON.stringify(r));
  const clearResume = () => { try { sessionStorage.removeItem(RESUME_KEY); } catch (e) { /* ignore */ } };
  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  const dataUrlToBlob = (url) => {
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'image/jpeg' });
  };
  const backHere = () => location.origin + '/';

  const googleSignIn = async () => {
    const st = state;
    if (st.busy) return;
    setState({ busy: 'google', googleFailed: false });
    try {
      await ensureSession();
      const r = { at: Date.now(), stage: 'link', from: st.loginFrom, anonId: st.me, name: st.myName,
        subjectId: st.subjectId, joinCode: st.joinCode, screen: st.screen, draft: null };
      if (st.loginFrom === 'post') {
        r.draft = {};
        DRAFT_KEYS.forEach(k => { r.draft[k] = st[k]; });
        r.draft.photos = [];
        for (const p of st.photos) r.draft.photos.push(await blobToDataUrl(p.blob));
      }
      r.mergeToken = must(await sb.rpc('prepare_merge')).data;
      writeResume(r);
      must(await sb.auth.linkIdentity({ provider: 'google', options: { redirectTo: backHere() } }));
      // The browser is now leaving for Google
    } catch (e) {
      console.error(e);
      clearResume();
      setState({ busy: null });
      toast('Couldn’t open Google sign-in. Try again, or use your email.');
    }
  };

  const restoreDraft = (r) => {
    if (!r.draft) return {};
    const d = r.draft, out = {};
    DRAFT_KEYS.forEach(k => { if (k in d) out[k] = d[k]; });
    out.photos = (d.photos || []).map(u => { const blob = dataUrlToBlob(u); return { blob, url: URL.createObjectURL(blob) }; });
    return Object.assign(out, { screen: 'compose', step: 'review' });
  };

  // What to do once signed in, by where sign-in started
  const resumeAfter = (r) => {
    if (r.from === 'post') return () => createDraft();
    if (r.from === 'join') return () => setState({ joinOpen: true, joinCode: r.joinCode || '', joinBad: false });
    if (r.from === 'group') return () => setState({ create: 'name', createName: '' });
    if (r.from === 'profile') return () => go('profile');
    return null;
  };

  // Runs once at start-up, after the session is ready. Returns true if the page is leaving again.
  const finishGoogle = async () => {
    const r = readResume();
    if (AUTH_RETURN.any) history.replaceState(null, '', backHere() + location.hash);
    if (!r) return false;
    if (AUTH_RETURN.errorCode === 'identity_already_exists' && r.stage === 'link') {
      writeResume(Object.assign(r, { stage: 'signin', at: Date.now() }));
      const res = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: backHere() } });
      if (!res.error) return true;
    }
    clearResume();
    const session = (await sb.auth.getSession()).data.session;
    const back = Object.assign(restoreDraft(r), r.subjectId && r.screen === 'detail' ? { screen: 'detail', subjectId: r.subjectId } : {});
    if (!session || session.user.is_anonymous) {
      // Cancelled at Google, or it didn't finish: put them back where they were, sign-in still open
      setState(Object.assign(back, { loginStep: 'email', loginFrom: r.from || 'default', loginThen: resumeAfter(r), googleFailed: true, joinCode: r.joinCode || '' }));
      await loadFresh().catch(() => {});
      return false;
    }
    if (r.stage === 'signin' && r.mergeToken && session.user.id !== r.anonId) {
      await sb.rpc('complete_merge', { p_token: r.mergeToken }).catch(() => {});
    }
    if (r.name) state.myName = r.name;
    setState(back);
    await finishSignIn({ loginThen: resumeAfter(r) }, session);
    return false;
  };

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  const openProfileEdit = () => setState({ pe: {
    name: state.myName, email: state.email, step: 'form', code: '',
    avatar: state.myAvatar ? { url: photoUrl(state.myAvatar), path: state.myAvatar } : null
  } });
  const setPe = (p) => setState({ pe: Object.assign({}, state.pe, p) });

  const savePe = async () => {
    const pe = state.pe, name = cleanTitle(pe.name).slice(0, 30);
    const newEmail = pe.email.trim().toLowerCase();
    const emailChanged = !state.isGoogle && newEmail !== state.email.toLowerCase();
    if (!name || (emailChanged && !EMAIL_OK.test(newEmail)) || state.busy) return;
    setState({ busy: 'profile' });
    try {
      await ensureSession();
      const old = state.myAvatar;
      let avatar = old;
      if (pe.avatar && pe.avatar.blob) avatar = await uploadBlob(pe.avatar.blob);
      if (!pe.avatar) avatar = null;
      if (avatar !== old) must(await sb.from('profiles').upsert({ id: state.me, avatar_path: avatar, updated_at: new Date().toISOString() }, { onConflict: 'id' }));
      if (name !== state.myName) await saveName(name, true);
      if (emailChanged) must(await sb.auth.updateUser({ email: newEmail }));
      await loadFresh();
      if (avatar !== old && old) deletePhotos([old]);
      if (emailChanged) { setState({ busy: null, pe: Object.assign({}, state.pe, { step: 'code', code: '', email: newEmail }) }); return; }
      setState({ busy: null, pe: null });
      toast('Profile saved', true);
    } catch (e) {
      console.error(e);
      setState({ busy: null });
      toast(tooSoon(e) ? 'One code a minute. Wait a moment, then try again.' : FAILED);
    }
  };

  const confirmPe = async () => {
    const pe = state.pe;
    if (pe.code.length < 6 || state.busy) return;
    setState({ busy: 'profile' });
    try {
      must(await sb.auth.verifyOtp({ email: pe.email, token: pe.code, type: 'email_change' }));
      noteSession(must(await sb.auth.refreshSession()).data.session);
      setState({ busy: null, pe: null });
      toast('Email updated', true);
    } catch (e) {
      console.error(e);
      setState({ busy: null });
      toast('That code didn’t work. Check it, or send it again.');
    }
  };

  const onPeAvatar = async (fileList) => {
    const f = (fileList || [])[0];
    if (!f) return;
    try {
      const blob = await shrinkImage(f, 600);
      setPe({ avatar: { blob, url: URL.createObjectURL(blob) } });
    } catch (e) { toast(BAD_PHOTO); }
  };

  // ---------------------------------------------------------------------------
  // Style factories (values from the design file)
  // ---------------------------------------------------------------------------

  const btn = (ok) => css({ marginTop: '4px', width: '100%', border: 0, borderRadius: '999px', padding: '17px', fontFamily: 'inherit', fontSize: '16.5px', fontWeight: 800, color: '#fff',
    background: ok ? '#5b4ae8' : '#b9bcc4', cursor: ok ? 'pointer' : 'not-allowed', boxShadow: ok ? '0 10px 24px rgba(91,74,232,.32)' : 'none' });
  const primary = (ok) => css({ width: '100%', border: 0, borderRadius: '999px', padding: '16px', fontFamily: 'inherit', fontSize: '16px', fontWeight: 800, color: '#fff',
    background: ok ? '#5b4ae8' : '#b9bcc4', cursor: ok ? 'pointer' : 'not-allowed' });
  const SECONDARY = 'width:100%;background:#fff;border:1.5px solid #dcdfe6;border-radius:999px;padding:15px;font-family:inherit;font-size:16px;font-weight:800;color:#0d1117;cursor:pointer';
  const OUTLINE_PURPLE = 'width:100%;background:#fff;border:2px solid #5b4ae8;border-radius:999px;padding:16px;font-family:inherit;font-size:16.5px;font-weight:800;color:#5b4ae8;cursor:pointer';
  const CARD = 'background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08)';
  const EYEBROW = 'font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280';
  const FIELD = 'width:100%;background:#fff;border:2px solid #e6e7eb;border-radius:14px;padding:13px 16px;font-family:inherit;font-size:16px;font-weight:600;color:#0d1117;outline:none';
  const MENU = 'background:#fff;border:1px solid #eceef2;border-radius:16px;padding:6px;box-shadow:0 18px 44px rgba(15,18,25,.2);animation:popIn 280ms cubic-bezier(.22,.9,.28,1) both';
  const menuLabel = (t) => '<div style="padding:8px 12px 6px;font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#9aa0ac">' + t + '</div>';
  const backLink = (fn) => '<span ' + on(fn) + ' style="display:flex;align-items:center;gap:5px;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;width:fit-content">' + I.chevL(14, '#6b7280', 2.2) + 'Back</span>';
  const orDivider = () => '<div style="display:flex;align-items:center;gap:12px;margin:2px 0"><span style="flex:1 1 auto;height:1px;background:#dcdfe6"></span><span style="font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280">or</span><span style="flex:1 1 auto;height:1px;background:#dcdfe6"></span></div>';
  const bg = (url, pos) => url ? 'url(\'' + esc(url) + '\') ' + (pos || 'center') + '/cover' : '';

  // A person's face: photo, or a coloured initial
  const face = (uid, name, size, color, extra) => {
    const url = avatarOf(uid);
    return '<span aria-hidden="true" style="flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:' +
      (url ? bg(url) : (color || '#e8a71c')) + ';color:#fff;font-size:' + Math.round(size * 0.46) + 'px;font-weight:900;display:flex;align-items:center;justify-content:center;' + (extra || '') + '">' +
      (url ? '' : esc(initialOf(name) || '?')) + '</span>';
  };

  const groupPhoto = (g) => g && g.photo ? photoUrl(g.photo) : null;

  // ---- Logo, group switcher and its menu -----------------------------------

  const logo = (onDark) => '<div ' + on(() => go('home')) + ' aria-label="Spark Hub home" style="display:flex;align-items:center;gap:6px;min-height:44px;cursor:pointer;width:fit-content">' +
    (onDark ? I.boltRays(24) : I.bolt(24, '#e8a71c')) +
    '<span style="font-size:18px;line-height:1;font-weight:900;letter-spacing:-.5px;color:' + (onDark ? '#fff;text-shadow:0 1px 4px rgba(0,0,0,.3)' : '#0d1117') + '">Spark Hub</span></div>';

  const switcher = (onPhoto) => {
    const g = currentGroup();
    const color = onPhoto ? '#fff' : '#5b4ae8';
    return '<div data-menu style="position:absolute;top:10.5px;right:10px;z-index:3">' +
      '<div ' + on((e) => { stop(e); setState({ menu: state.menu === 'groups' ? null : 'groups' }); }) + ' aria-label="Switch group" aria-expanded="' + (state.menu === 'groups') + '" style="display:flex;align-items:center;gap:6px;min-height:44px;padding:0 10px;cursor:pointer">' +
        '<span style="font-size:11.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + color + (onPhoto ? ';text-shadow:0 1px 4px rgba(0,0,0,.3)' : '') + '">' + esc(g ? g.name : 'Your groups') + '</span>' +
        I.chevD(12, color, 2.8) +
      '</div>' +
      (state.menu === 'groups' ? groupMenu() : '') +
    '</div>';
  };

  const groupMenu = () => {
    const cur = currentGroup();
    return '<div role="menu" aria-label="Your groups" style="position:absolute;top:44px;right:2px;z-index:4;min-width:220px;' + MENU + '">' +
      menuLabel('Your groups') +
      myGroups().map(g => {
        const onIt = cur && g.id === cur.id, fresh = onIt ? 0 : freshCount(g);
        return '<div ' + on(() => pickGroup(g)) + ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:9px 12px;border-radius:12px;background:' + (onIt ? '#f3f1fe' : 'transparent') + ';cursor:pointer">' +
          '<div style="min-width:0;display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:15px;font-weight:800;color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + esc(g.name) + '</span>' +
            (g.role === 'admin' ? '<span aria-label="You’re an admin" style="flex:0 0 auto;border-radius:999px;padding:2px 7px;background:#fdf1d6;color:#8f6405;font-size:11px;font-weight:900;letter-spacing:.6px;text-transform:uppercase">Admin</span>' : '') +
            (fresh ? '<span aria-label="' + fresh + ' new ideas" style="flex:0 0 auto;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center">' + fresh + '</span>' : '') +
          '</div></div>';
      }).join('') +
      (myGroups().length ? '<div style="height:1px;background:#f2f3f6;margin:6px"></div>' : '') +
      '<div ' + on(() => openJoin()) + ' style="display:flex;align-items:center;gap:10px;min-height:46px;padding:9px 12px;border-radius:12px;cursor:pointer" class="hov-row">' +
        '<span style="flex:0 0 26px;width:26px;height:26px;border-radius:999px;background:#f3f1fe;display:flex;align-items:center;justify-content:center">' + I.plus(13, '#5b4ae8', 2.8) + '</span>' +
        '<span style="font-size:15px;font-weight:800;color:#5b4ae8">Join a group</span>' +
      '</div>' +
    '</div>';
  };

  const ideaButton = (extra) => '<button type="button" class="hov-primary" ' + on(goCompose) + ' style="width:100%;min-height:54px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 10px 24px rgba(91,74,232,.32);cursor:pointer;' + (extra || '') + '">' +
    I.plus(19, '#fff', 2.5) + 'I have an idea</button>';

  // "That idea isn't up anymore": a dead or cut-short idea link
  const goneCard = () => state.goneOpen
    ? '<div role="status" style="position:relative;' + CARD + ';padding:18px 48px 18px 18px">' +
        '<span ' + on(() => setState({ goneOpen: false })) + ' aria-label="Dismiss" style="position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(14, '#0d1117', 2.4) + '</span>' +
        '<div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">That idea isn’t up anymore</div>' +
        '<div style="margin-top:4px;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Its lead may have taken it down, or the link got cut short.</div>' +
        '<span ' + on(() => { setState({ goneOpen: false }); go('browse'); }) + ' style="display:inline-flex;margin-top:10px;min-height:32px;align-items:center;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">See what’s up now →</span>' +
      '</div>'
    : '';

  // ---------------------------------------------------------------------------
  // 1. Welcome (Home, signed out)
  // ---------------------------------------------------------------------------

  // The 1-2-3 steps as one pill (Home)
  const stepsPill = (dark) =>
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;background:' + (dark ? 'rgba(255,255,255,.1)' : '#f2f3f6') + ';border-radius:999px;padding:9px 11px">' +
      [['#e8a71c', '1', 'Post an idea'], ['#5b4ae8', '2', 'People pitch in'], ['#0f7a3c', '3', 'It happens']].map(([c, n, t], i) =>
        (i ? '<span aria-hidden="true" style="flex:0 0 auto;display:flex;margin:0 1px">' + I.chevR(10, dark ? '#8a909b' : '#b3b8c2', 2.4) + '</span>' : '') +
        '<span style="display:flex;align-items:center;gap:5px;min-width:0"><span style="flex:0 0 20px;width:20px;height:20px;border-radius:999px;background:' + c + ';color:#fff;font-size:11.5px;font-weight:900;display:flex;align-items:center;justify-content:center">' + n + '</span>' +
        '<span style="font-size:13px;font-weight:800;color:' + (dark ? '#fff' : '#0d1117') + ';white-space:nowrap">' + t + '</span></span>').join('') +
    '</div>';

  function viewWelcome() {
    const st = state, busy = st.busy, from = st.joinCode ? 'join' : 'default';
    const steps = [['#e8a71c', '1', 'Post an idea'], ['#5b4ae8', '2', 'People pitch in'], ['#0f7a3c', '3', 'It happens']];
    // Google straight from here; email opens the sign-in pop-up without the Google button
    const google = () => { if (busy) return; setState({ loginFrom: from, loginThen: null }); googleSignIn(); };
    const email = () => { openLogin(from, st.joinCode ? () => openJoin(st.joinCode) : null); setState({ loginEmailOnly: true }); };
    return '<div data-screen-label="Welcome" style="position:relative;overflow:hidden;background:#0d1117;min-height:100%">' +
      '<div aria-hidden="true" style="position:absolute;left:0;right:0;top:-90px;height:560px;background:' + bg('/photos/welcome.jpg', 'center') + '"></div>' +
      '<div aria-hidden="true" style="position:absolute;left:0;right:0;top:0;height:561px;background:linear-gradient(to bottom, rgba(13,17,23,.15) 0%, rgba(13,17,23,.3) 30%, rgba(13,17,23,.78) 50%, rgba(13,17,23,.93) 70%, #0d1117 100%)"></div>' +
      '<div style="position:relative;padding:10.5px 16px 0">' +
        '<div aria-label="Spark Hub" style="display:flex;align-items:center;gap:6px;min-height:44px">' + I.bolt(24, '#f3c55a') + '<span style="font-size:18px;line-height:1;font-weight:900;letter-spacing:-.5px;color:#fff">Spark Hub</span></div>' +
        '<div style="padding:220px 4px 0">' +
          '<h1 style="margin:0;font-size:40px;line-height:1;font-weight:900;letter-spacing:-1.3px;color:#fff">Turn your idea<br><span style="color:#a99cff">into a plan.</span></h1>' +
          '<p style="margin:14px 0 0;font-size:16px;line-height:1.45;font-weight:500;color:#f1f2f5;text-wrap:pretty">Post an idea. Your group helps pick the day, find the place and make it happen.</p>' +
          '<ol style="list-style:none;margin:20px 0 0;padding:0;display:flex;flex-direction:column;gap:12px">' +
            steps.map(([c, n, t]) => '<li style="display:flex;align-items:center;gap:12px"><span aria-hidden="true" style="flex:0 0 28px;width:28px;height:28px;border-radius:999px;background:' + c + ';color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center">' + n + '</span>' +
              '<span style="font-size:17px;font-weight:800;color:#fff">' + t + '</span></li>').join('') +
          '</ol>' +
        '</div>' +
      '</div>' +
      '<div style="position:relative;padding:28px 16px 26px;display:flex;flex-direction:column;gap:12px">' +
        goneCard() +
        (st.joinCode ? '<div style="text-align:center;font-size:14.5px;font-weight:700;color:#dfe2e8">Sign in to join the group <strong style="font-weight:900;letter-spacing:1px;color:#fff">' + esc(st.joinCode) + '</strong></div>' : '') +
        (GOOGLE_ON
          ? '<button type="button" class="hov-grey" ' + on(google) + ' style="width:100%;min-height:54px;display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;border:0;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;color:#0d1117;cursor:' + (busy === 'google' ? 'wait' : 'pointer') + '">' +
              I.google + (busy === 'google' ? 'Opening Google…' : 'Continue with Google') + '</button>'
          : '') +
        '<button type="button" ' + on(email) + ' style="width:100%;min-height:54px;display:flex;align-items:center;justify-content:center;gap:10px;background:transparent;border:1.5px solid #454b55;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;color:#fff;cursor:pointer">' +
          svg(19, stroke('#fff', 1.9), '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>') + 'Continue with email</button>' +
        '<p style="margin:10px 0 0;text-align:center;font-size:14.5px;font-weight:500;color:#9aa0ac">New here? Either one creates your account.</p>' +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // 2. Home (signed in)
  // ---------------------------------------------------------------------------

  function viewHome() {
    const st = state, cur = currentGroup(), groups = myGroups();
    const tiles = groups.slice().sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || (cur && b.id === cur.id) - (cur && a.id === cur.id));
    const first = tiles[0], rest = tiles.slice(1);
    const tileBg = (g) => groupPhoto(g) ? bg(groupPhoto(g), '50% 40%') : '#e8a71c';
    const nIn = (g) => st.sparks.filter(s => s.groupId === g.id).length;
    const firstMeta = first ? (cur && first.id === cur.id ? nIn(first) + (nIn(first) === 1 ? ' idea' : ' ideas') : (freshCount(first) ? freshCount(first) + ' new' : 'Open')) : '';
    const coming = comingUp();

    return '<div data-screen-label="Home">' +
      '<header style="position:relative;background:#fff;padding:12px 16px 24px">' +
        switcher(false) +
        logo(false) +
        '<h1 style="margin:22px 0 0;font-size:40px;line-height:1;font-weight:900;letter-spacing:-1.3px;color:#0d1117">Turn your idea<br><span style="color:#5b4ae8">into a plan.</span></h1>' +
        '<p style="margin:12px 0 0;font-size:16px;line-height:1.45;font-weight:500;color:#454b55;text-wrap:pretty">Post an idea. Your group helps pick the day, find the place and make it happen.</p>' +
        '<div style="margin-top:18px">' + stepsPill(false) + '</div>' +
        ideaButton('margin-top:16px') +
      '</header>' +
      '<div style="padding:18px 14px 26px;display:flex;flex-direction:column;gap:18px">' +
        goneCard() +
        '<div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 4px 8px">' +
            '<span style="' + EYEBROW + '">Your groups</span>' +
            '<span ' + on(() => openJoin()) + ' style="display:flex;align-items:center;min-height:32px;font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Join with a code</span>' +
          '</div>' +
          (first
            ? '<div style="display:flex;flex-direction:column;gap:10px">' +
                '<div ' + on(() => openGroup(first)) + ' style="position:relative;height:108px;border-radius:18px;overflow:hidden;cursor:pointer;background:' + tileBg(first) + '">' +
                  '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to right, rgba(13,17,23,.82) 0%, rgba(13,17,23,.35) 70%, rgba(13,17,23,.2) 100%)"></div>' +
                  '<div style="position:absolute;left:16px;top:14px;bottom:14px;right:44px;display:flex;flex-direction:column;justify-content:space-between;color:#fff">' +
                    (first.role === 'admin' ? '<span style="align-self:flex-start;border-radius:999px;padding:3px 8px;background:#fdf1d6;color:#8f6405;font-size:10.5px;font-weight:900;letter-spacing:.6px">ADMIN</span>' : '') +
                    '<div style="margin-top:auto"><div style="font-size:20px;font-weight:900;letter-spacing:-.4px">' + esc(first.name) + '</div><div style="font-size:13px;font-weight:700;color:#dfe2e8">' + esc(firstMeta) + '</div></div>' +
                  '</div>' +
                  '<span style="position:absolute;right:14px;top:45px">' + I.chevR(18, '#fff', 2.4) + '</span>' +
                '</div>' +
                (rest.length
                  ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
                      rest.map(g => {
                        const fresh = cur && g.id === cur.id ? 0 : freshCount(g);
                        return '<div ' + on(() => openGroup(g)) + ' style="position:relative;height:92px;border-radius:16px;overflow:hidden;cursor:pointer;background:' + tileBg(g) + '">' +
                          '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.85), rgba(13,17,23,.2))"></div>' +
                          (fresh ? '<span aria-label="' + fresh + ' new ideas" style="position:absolute;top:10px;right:10px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center">' + fresh + '</span>' : '') +
                          (g.role === 'admin' ? '<span style="position:absolute;top:10px;left:10px;border-radius:999px;padding:2px 7px;background:#fdf1d6;color:#8f6405;font-size:10px;font-weight:900;letter-spacing:.6px">ADMIN</span>' : '') +
                          '<div style="position:absolute;left:12px;right:10px;bottom:10px;color:#fff;font-size:15px;line-height:1.15;font-weight:900">' + esc(g.name) + '</div>' +
                        '</div>';
                      }).join('') +
                    '</div>'
                  : '') +
              '</div>'
            : noGroupCard()) +
        '</div>' +
        (coming.length
          ? '<div>' +
              '<div style="padding:0 4px 8px;' + EYEBROW + '">Coming up</div>' +
              '<div style="' + CARD + ';overflow:hidden">' +
                coming.map((s, k) => {
                  const g = groupById(s.groupId);
                  return '<div ' + on(() => go('detail', { subjectId: s.id, tag: null })) + ' class="hov-row" style="display:flex;align-items:center;gap:12px;padding:10px 14px;min-height:66px;border-top:' + (k ? '1px solid #f2f3f6' : '0') + ';cursor:pointer">' +
                    '<span style="flex:0 0 46px;border-radius:11px;overflow:hidden;text-align:center;box-shadow:0 0 0 1px #eceef2"><span style="display:block;background:#e8a71c;color:#fff;font-size:10px;font-weight:900;padding:2px 0">' + MONTHS[+s.dayDate.slice(5, 7) - 1] + '</span><span style="display:block;font-size:18px;font-weight:900;color:#0d1117;padding:3px 0">' + (+s.dayDate.slice(8, 10)) + '</span></span>' +
                    '<div style="flex:1 1 auto;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.text) + '</div><div style="font-size:13px;font-weight:600;color:#6b7280">' + esc((g ? g.name : '') + (s.dayTime ? ' · ' + fmtTime(s.dayTime) : '')) + '</div></div>' +
                    I.chevR(16, '#9aa0ac', 2.4) +
                  '</div>';
                }).join('') +
              '</div>' +
            '</div>'
          : '') +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  // Signed in but in no group yet (not designed; built to match the Welcome card)
  const noGroupCard = () =>
    '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:12px">' +
      '<div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">You’re not in a group yet.</div>' +
      '<div style="font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Join one with a code from its organiser, or start your own.</div>' +
      '<button type="button" class="hov-primary" ' + on(() => openJoin()) + ' style="' + primary(true) + '">Join with a code</button>' +
      '<button type="button" class="hov-outline" ' + on(startGroup) + ' style="' + SECONDARY + '">Start a group</button>' +
    '</div>';

  // ---------------------------------------------------------------------------
  // 3. All ideas (per group)
  // ---------------------------------------------------------------------------

  const VIEW_META = { cards: ['Cards', I.viewCards], grid: ['Grid', I.viewGrid], list: ['List', I.viewList] };

  function viewBrowse() {
    const st = state, g = currentGroup();
    const cards = visible();
    const gPhoto = groupPhoto(g);
    const viewMenu = st.menu === 'view', sortMenu = st.menu === 'sort';
    const loading = !st.loaded;

    // z-index 4: the group menu opens down over the sort row (z-index 3)
    const header = '<header style="position:relative;z-index:4;height:236px;background:#e8a71c">' +
      (gPhoto ? '<div aria-hidden="true" style="position:absolute;inset:0;background:' + bg(gPhoto, '50% 40%') + '"></div>' : '') +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(13,17,23,.85) 0%, rgba(13,17,23,.56) 30%, rgba(13,17,23,.52) 45%, rgba(13,17,23,.72) 62%, rgba(13,17,23,.96) 100%)"></div>' +
      switcher(true) +
      '<div style="position:absolute;top:10.5px;left:16px;z-index:2">' + logo(true) + '</div>' +
      '<div style="position:absolute;left:20px;right:20px;bottom:40px;color:#fff">' +
        '<div style="font-size:12.5px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:#f3c55a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(g ? g.name : 'Spark Hub') + '</div>' +
        '<h1 style="margin:4px 0 0;font-size:40px;line-height:1;font-weight:900;letter-spacing:-1.2px;color:#fff">All ideas</h1>' +
      '</div>' +
      '<div style="position:absolute;left:16px;right:16px;bottom:-26px;z-index:2">' + ideaButton('box-shadow:0 12px 28px rgba(91,74,232,.4)') + '</div>' +
    '</header>';

    const offline = st.error === 'load'
      ? '<div role="status" style="margin:40px 14px 0;display:flex;align-items:flex-start;gap:12px;background:#fdeef0;border:1.5px solid #f5c2cb;border-radius:14px;padding:13px 14px">' +
          '<span style="flex:0 0 30px;width:30px;height:30px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center">' + I.offline + '</span>' +
          '<div style="flex:1 1 auto;min-width:0"><div style="font-size:14.5px;font-weight:800;color:#9b1c31">Couldn’t load ideas</div>' +
          '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:600;color:#9b1c31;text-wrap:pretty">Check your connection. We’ll keep trying, and this goes away once you’re back.</div></div>' +
          '<span ' + on(retryNow) + ' style="flex:0 0 auto;min-height:30px;display:flex;align-items:center;font-size:13.5px;font-weight:800;color:#9b1c31;text-decoration:underline;text-underline-offset:3px;cursor:pointer">Try now</span>' +
        '</div>'
      : '';

    const menuRow = (onIt, fn, inner) => '<div ' + on((e) => { stop(e); fn(); }) + ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:9px 12px;border-radius:12px;background:' + (onIt ? '#f3f1fe' : 'transparent') + ';cursor:pointer">' +
      inner + (onIt ? I.check(16, '#5b4ae8', 2.6) : '') + '</div>';

    const controls = '<div style="position:relative;padding:' + (offline ? '12px' : '36px') + ' 14px 0;display:flex;gap:8px;z-index:3;align-items:center">' +
      '<div data-menu style="position:relative;flex:1 1 auto;display:flex">' +
        '<div ' + on((e) => { stop(e); setState({ menu: viewMenu ? null : 'view' }); }) + ' aria-label="Change view" aria-expanded="' + viewMenu + '" style="display:flex;align-items:center;gap:6px;min-height:40px;padding:0 4px;cursor:pointer">' +
          '<span style="display:flex;color:#6b7280">' + VIEW_META[st.view][1] + '</span>' +
          '<span style="font-size:14px;font-weight:700;color:#6b7280">' + VIEW_META[st.view][0] + '</span>' + I.chevD(12, '#6b7280', 2.8) +
        '</div>' +
        (viewMenu
          ? '<div role="menu" aria-label="View" style="position:absolute;top:calc(100% + 6px);left:0;min-width:200px;' + MENU + '">' + menuLabel('View') +
              VIEWS.map(k => {
                const onIt = k === st.view;
                return menuRow(onIt, () => setState({ view: k, menu: null }),
                  '<span style="display:flex;align-items:center;gap:10px"><span style="display:flex;color:' + (onIt ? '#5b4ae8' : '#6b7280') + '">' + VIEW_META[k][1] + '</span><span style="font-size:15px;font-weight:800;color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + VIEW_META[k][0] + '</span></span>');
              }).join('') + '</div>'
          : '') +
      '</div>' +
      '<div data-menu style="position:relative;flex:0 0 auto">' +
        '<div ' + on((e) => { stop(e); setState({ menu: sortMenu ? null : 'sort' }); }) + ' aria-label="Sort" aria-expanded="' + sortMenu + '" style="display:flex;align-items:center;gap:5px;min-height:40px;padding:0 4px;cursor:pointer">' +
          '<span style="font-size:14px;font-weight:700;color:#6b7280">' + (SORTS.find(s => s[0] === st.sort) || SORTS[0])[1] + '</span>' + I.chevD(12, '#6b7280', 2.8) +
        '</div>' +
        (sortMenu
          ? '<div role="menu" aria-label="Order by" style="position:absolute;top:calc(100% + 6px);right:0;min-width:216px;' + MENU + '">' + menuLabel('Order by') +
              SORTS.map(([k, label]) => {
                const onIt = k === st.sort;
                return menuRow(onIt, () => setState({ sort: k, menu: null }), '<span style="font-size:15.5px;font-weight:' + (onIt ? 700 : 600) + ';color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + label + '</span>');
              }).join('') + '</div>'
          : '') +
      '</div>' +
    '</div>';

    let list;
    if (loading) {
      list = [0, 1, 2].map(() =>
        '<div aria-hidden="true" style="' + CARD + ';padding:17px 16px 14px;display:flex;flex-direction:column;gap:13px;animation:skPulse 1.4s ease-in-out infinite">' +
          '<div style="height:17px;width:72%;border-radius:8px;background:#eceef1"></div>' +
          '<div style="display:flex;flex-direction:column;gap:7px">' +
            '<div style="display:flex;align-items:center;gap:9px"><span style="width:26px;height:26px;border-radius:999px;background:#f2f3f6"></span><span style="height:11px;width:46%;border-radius:6px;background:#f2f3f6"></span></div>' +
            '<div style="display:flex;align-items:center;gap:9px"><span style="width:26px;height:26px;border-radius:999px;background:#f2f3f6"></span><span style="height:11px;width:32%;border-radius:6px;background:#f2f3f6"></span></div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid #f2f3f6"><span style="width:28px;height:28px;border-radius:999px;background:#f2f3f6"></span><span style="height:11px;width:30%;border-radius:6px;background:#f2f3f6"></span><span style="margin-left:auto;height:24px;width:46px;border-radius:999px;background:#f2f3f6"></span></div>' +
        '</div>').join('');
    } else if (!g) {
      list = noGroupCard();
    } else if (!cards.length) {
      list = '<div style="' + CARD + ';padding:18px"><div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">No ideas yet.</div>' +
        '<div style="margin-top:4px;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Be the first to put one up — rough is fine.</div></div>';
    } else if (st.view === 'grid') {
      list = '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' + cards.map(s => cardGrid(s, gPhoto)).join('') + '</div>';
    } else if (st.view === 'list') {
      list = '<div style="' + CARD + ';overflow:hidden">' + cards.map((s, i) => cardRow(s, gPhoto, i)).join('') + '</div>';
    } else {
      list = cards.map(s => cardFull(s, gPhoto)).join('');
    }

    return '<div data-screen-label="Browse">' + header + offline + controls +
      '<div style="padding:4px 14px 22px;display:flex;flex-direction:column;gap:14px">' +
        (loading ? '<div style="padding:0 4px;font-size:14px;font-weight:700;color:#6b7280">Loading ideas…</div>' : '') + list +
      '</div>' +
      '<div style="height:var(--nav-h)"></div></div>';
  }

  // Card pieces shared by the three views
  const cardBits = (s) => {
    const d = dayOf(s);
    const row = (ok) => 'display:flex;align-items:center;gap:8px;min-width:0;color:' + (ok ? '#8f6405' : '#b3b8c2');
    return {
      d, cover: s.photoPaths[0] ? photoUrl(s.photoPaths[0]) : null,
      dateRow: row(!!d), placeRow: row(!!s.spot),
      dayLabel: d ? d.day : 'Date TBD', timeSuffix: d && d.time ? ' · ' + d.time : '',
      dayStrong: 'font-weight:800;color:' + (d ? '#0d1117' : '#9aa0ac'),
      placeLabel: s.spot || 'Location TBD',
      placeText: 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (s.spot ? '#454b55' : '#9aa0ac'),
      count: s.interested.length,
      lead: nameOf(s.leadId, s.leadName)
    };
  };
  // An idea without a photo shows its group's photo (sharp, under the same darkening)
  const groupFallback = (gPhoto, overlay) => '<div aria-hidden="true" style="position:absolute;inset:0;background:' + (gPhoto ? bg(gPhoto, '50% 40%') : '#2b2413') + '"></div>' +
    '<div aria-hidden="true" style="position:absolute;inset:0;background:' + overlay + '"></div>';
  const openIdea = (s) => () => go('detail', { subjectId: s.id, tag: null });

  const cardFull = (s, gPhoto) => {
    const b = cardBits(s);
    return '<div ' + on(openIdea(s)) + ' style="border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<div style="position:relative;height:112px;overflow:hidden;background:' + (b.cover ? bg(b.cover) : '#2b2413') + '">' +
        (b.cover ? '' : groupFallback(gPhoto, 'rgba(13,17,23,.3)')) +
      '</div>' +
      '<div style="position:relative;margin-top:-22px;background:#fff;border-radius:20px 20px 0 0;padding:16px 16px 14px;display:flex;flex-direction:column;gap:8px">' +
        '<div style="font-size:21px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117;text-wrap:pretty">' + esc(s.text) + '</div>' +
        '<div style="margin-top:-2px;display:flex;flex-direction:column;gap:6px;font-size:13.5px;font-weight:600">' +
          '<span style="' + b.dateRow + '">' + I.cal(14) + '<span style="min-width:0;color:#454b55"><strong style="' + b.dayStrong + '">' + esc(b.dayLabel) + '</strong>' + esc(b.timeSuffix) + '</span></span>' +
          '<span style="' + b.placeRow + '">' + I.pin(14) + '<span style="' + b.placeText + '">' + esc(b.placeLabel) + '</span></span>' +
        '</div>' +
        '<div style="margin-top:2px;padding-top:10px;border-top:1px solid #f2f3f6;display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:700;color:#454b55">' +
          face(s.leadId, b.lead, 26) +
          '<span style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;color:#6b7280">Led by <span style="font-weight:700;color:#454b55">' + esc(b.lead) + '</span></span>' +
          '<span aria-label="' + b.count + ' interested" style="flex:0 0 auto;display:flex;align-items:center;gap:4px;border-radius:999px;padding:4px 10px;background:#f2f3f6;font-size:13px;font-weight:800;color:#5c6270">' + I.person(12) + b.count + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  };

  const cardGrid = (s, gPhoto) => {
    const b = cardBits(s);
    return '<div ' + on(openIdea(s)) + ' style="border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer;display:flex;flex-direction:column">' +
      '<div style="position:relative;height:112px;overflow:hidden;background:' + (b.cover ? 'linear-gradient(to top, rgba(13,17,23,.85) 0%, rgba(13,17,23,.4) 55%, rgba(13,17,23,.08) 100%), ' + bg(b.cover) : '#2b2413') + '">' +
        (b.cover ? '' : groupFallback(gPhoto, 'linear-gradient(to top, rgba(13,17,23,.85) 0%, rgba(13,17,23,.55) 55%, rgba(13,17,23,.35) 100%)')) +
        '<div style="position:absolute;z-index:1;left:11px;right:11px;bottom:9px;font-size:16px;line-height:1.18;font-weight:900;letter-spacing:-.3px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.3);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + esc(s.text) + '</div>' +
      '</div>' +
      '<div style="padding:9px 11px 10px;display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:600">' +
        '<span style="' + b.dateRow + '">' + I.cal(13, 2.3) + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#454b55"><strong style="' + b.dayStrong + '">' + esc(b.dayLabel) + '</strong>' + esc(b.timeSuffix) + '</span></span>' +
        '<span style="' + b.placeRow + '">' + I.pin(13, 2.3) + '<span style="' + b.placeText + '">' + esc(b.placeLabel) + '</span></span>' +
        '<div style="margin-top:4px;display:flex;align-items:center;gap:6px">' +
          face(s.leadId, b.lead, 22) +
          '<span style="flex:1 1 auto;min-width:0;font-size:12.5px;font-weight:700;color:#454b55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(b.lead) + '</span>' +
          '<span aria-label="' + b.count + ' interested" style="display:flex;align-items:center;gap:3px;font-size:12.5px;font-weight:800;color:#5c6270">' + I.person(12) + b.count + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  };

  const cardRow = (s, gPhoto, i) => {
    const b = cardBits(s);
    const thumb = b.cover ? bg(b.cover) : (gPhoto ? 'linear-gradient(rgba(13,17,23,.35), rgba(13,17,23,.35)), url(\'' + esc(gPhoto) + '\') 50% 40%/260% auto' : '#2b2413');
    const meta = [b.d ? b.d.day + (b.d.time ? ' · ' + b.d.time : '') : 'Date TBD', s.spot || 'Location TBD'].join(' · ');
    return '<div ' + on(openIdea(s)) + ' class="hov-row" style="display:flex;align-items:center;gap:12px;min-height:68px;padding:10px 14px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + ';cursor:pointer">' +
      '<span aria-hidden="true" style="flex:0 0 48px;width:48px;height:48px;border-radius:12px;background:' + thumb + '"></span>' +
      '<div style="flex:1 1 auto;min-width:0">' +
        '<div style="font-size:16px;line-height:1.25;font-weight:800;letter-spacing:-.2px;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.text) + '</div>' +
        '<div style="margin-top:2px;font-size:13.5px;font-weight:600;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(meta) + '</div>' +
      '</div>' +
      '<span aria-label="' + b.count + ' interested" style="margin-left:auto;display:flex;align-items:center;gap:4px;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;background:#f2f3f6;color:#5c6270">' + I.person(13) + b.count + '</span>' +
    '</div>';
  };

  const retryNow = () => {
    setState({ error: null, loaded: false });
    loadFresh().then(() => {}, (e) => { console.error(e); setState({ error: 'load', loaded: true }); });
  };

  // ---------------------------------------------------------------------------
  // 9. How this works (content still placeholder, as designed)
  // ---------------------------------------------------------------------------

  function viewHow() {
    const step = (n, b, c, t, p) => '<div style="display:flex;gap:14px"><div style="flex:0 0 34px;width:34px;height:34px;border-radius:999px;background:' + b + ';color:' + c + ';font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center">' + n + '</div>' +
      '<div><div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + t + '</div><p style="margin:3px 0 0;font-size:14.5px;line-height:1.42;font-weight:500;color:#5c6270">' + p + '</p></div></div>';
    const note = (icon, strong, p) => '<div style="display:flex;gap:12px">' + icon + '<p style="margin:0;font-size:14.5px;line-height:1.42;font-weight:500;color:#454b55"><strong style="font-weight:800;color:#0d1117">' + strong + '</strong> ' + p + '</p></div>';
    const ic = (body) => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c6270" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 20px;margin-top:2px" aria-hidden="true">' + body + '</svg>';
    return '<div data-screen-label="How this works" style="background:#fff;min-height:100%">' +
      '<header style="position:relative;background:#fff;padding:26px 20px 18px;min-height:70px">' + (myGroups().length ? switcher(false) : '') + '</header>' +
      '<div style="height:1px;background:#e6e7eb"></div>' +
      '<section style="padding:20px 20px 26px">' +
        '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#0f7a3c">How this works</div>' +
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
          note(ic('<path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6l-7-2.8Z"/><path d="M9.2 12.1l2.1 2.1 3.6-3.9"/>'), 'Excepteur sint occaecat.', 'Cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.') +
          note(ic('<path d="M16.6 3.8l3.6 3.6L8.4 19.2 4 20.5l1.3-4.4L16.6 3.8Z"/>'), 'At vero eos et accusamus.', 'Iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti.') +
          note(ic('<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.2 2"/>'), 'Temporibus autem quibusdam.', 'Et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint.') +
        '</div>' +
        ideaButton('margin-top:26px') +
      '</section>' +
      '<div style="height:92px"></div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // 4. Idea page
  // ---------------------------------------------------------------------------

  function viewDetail(s) {
    const st = state, lead = isLead(s), g = groupById(s.groupId);
    const cover = s.photoPaths[0] ? photoUrl(s.photoPaths[0]) : null;
    const gPhoto = groupPhoto(g);
    const leadName = nameOf(s.leadId, s.leadName);
    const d = dayOf(s);
    const meIn = s.interested.indexOf(st.me) > -1;

    // Interested faces: you first once you're in, up to 3, then +N
    const n = s.interested.length;
    const people = (meIn ? [st.me] : []).concat(s.interested.filter(u => u !== st.me)).slice(0, 3);
    const faceTile = (i) => 'width:26px;height:26px;border-radius:999px;border:2px solid #fff;margin-left:' + (i ? '-9px' : '0') + ';display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:900;color:#fff';
    const faces = people.map((u, i) => {
      const url = avatarOf(u);
      return '<span style="' + faceTile(i) + ';background:' + (url ? bg(url) : FACE_COLORS[i % 3]) + '">' + (url ? '' : esc(initialOf(nameOf(u)) || '?')) + '</span>';
    }).join('') + (n > people.length ? '<span style="' + faceTile(people.length) + ';background:#f2f3f6;color:#5c6270">+' + (n - people.length) + '</span>' : '');

    const tile = (ok) => 'flex:0 0 38px;width:38px;height:38px;border-radius:11px;background:' + (ok ? '#fdf1d6' : '#f2f3f6') + ';color:' + (ok ? '#8f6405' : '#9aa0ac') + ';display:flex;align-items:center;justify-content:center';
    const main = (ok) => 'font-size:15.5px;font-weight:800;letter-spacing:-.2px;color:' + (ok ? '#0d1117' : '#6b7280');
    const note = (t) => t ? '<div style="margin-top:1px;font-size:13px;font-weight:500;color:#8a909b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + t + '</div>' : '';
    const action = (t) => '<span style="flex:0 0 auto;font-size:13.5px;font-weight:800;color:#5b4ae8;text-align:right">' + t + '</span>';
    const rowAttrs = (missing, kind) => missing ? on(() => openOffer(s, kind)) + ' ' : '';
    const directions = s.spotPoint
      ? '<a href="https://www.google.com/maps/dir/?api=1&amp;destination=' + s.spotPoint[0] + ',' + s.spotPoint[1] + '" target="_blank" rel="noopener noreferrer" style="font-weight:800;color:#5b4ae8">Directions</a>'
      : '';
    // The address shortens with an ellipsis; "Directions" always stays visible
    const placeNote = s.spotAddress || directions
      ? '<div style="margin-top:1px;display:flex;gap:4px;font-size:13px;font-weight:500;color:#8a909b;min-width:0">' +
          (s.spotAddress ? '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.spotAddress) + '</span>' : '') +
          (directions ? '<span style="flex:0 0 auto">' + (s.spotAddress ? '· ' : '') + directions + '</span>' : '') +
        '</div>'
      : '';

    const pending = lead ? s.pending : [];
    const myWaiting = lead ? [] : s.pending.filter(p => p.userId === st.me);
    const pitching = s.offers.map(o => ({ who: nameOf(o.userId, o.who), line: OFFER_LINES[o.kind] + offerText(o), waiting: false }))
      .concat(myWaiting.map(p => ({ who: nameOf(p.userId, p.who), line: OFFER_LINES[p.kind] + offerText(p), waiting: true })));

    const mood = s.mood.slice(0, 3);
    const showMood = mood.length > 0 || lead;

    return '<div data-screen-label="Idea page">' +
      '<div style="position:relative;height:210px;overflow:hidden;background:' + (cover ? bg(cover) : '#2b2413') + '">' +
        (cover ? '' : '<div aria-hidden="true" style="position:absolute;inset:0;background:' + (gPhoto ? bg(gPhoto, '50% 40%') : '#2b2413') + '"></div>') +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(13,17,23,.68) 0%, rgba(13,17,23,.18) 40%, rgba(13,17,23,.18) 70%, rgba(13,17,23,.45) 100%)"></div>' +
        '<div style="position:absolute;top:12px;left:12px;right:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;z-index:1">' +
          '<span ' + on(() => go(g && g.role ? 'browse' : 'home', g && g.role ? { groupId: g.id } : {})) + ' aria-label="Back" style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.chevL(18, '#fff', 2.3) + '</span>' +
          '<span style="min-width:0;font-size:11.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(g ? g.name : '') + '</span>' +
          (canEdit(s)
            ? '<span ' + on(() => openEdit(s)) + ' style="flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.2);font-size:14px;font-weight:800;color:#fff;cursor:pointer">' + I.edit(14, '#fff') + 'Edit</span>'
            : '<span style="flex:0 0 40px;width:40px"></span>') +
        '</div>' +
        (st.tag ? '<div style="position:absolute;right:16px;bottom:44px;z-index:1;transform:rotate(5deg);background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:800;color:#0d1117;box-shadow:0 8px 20px rgba(15,18,25,.18);animation:popIn 320ms cubic-bezier(.22,.9,.28,1) both">' + esc(st.tag) + '</div>' : '') +
      '</div>' +

      '<div style="position:relative;margin-top:-28px;background:#fff;border-radius:26px 26px 0 0;padding:22px 20px 20px;display:flex;flex-direction:column;gap:12px">' +
        '<h1 style="margin:0;font-size:30px;line-height:1.08;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">' + esc(s.text) + '</h1>' +
        '<div style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#454b55">' +
          face(s.leadId, leadName, 26) +
          '<span style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Led by ' + esc(leadName) + '</span>' +
          (n > 0
            ? '<span ' + (lead ? on(() => setState({ interestList: true })) : '') + ' aria-label="' + n + ' interested" style="flex:0 0 auto;display:flex;align-items:center;gap:7px' + (lead ? ';cursor:pointer' : '') + '">' +
                '<span style="font-size:14px;font-weight:600;color:#5c6270"><strong style="font-weight:800;color:#0d1117">' + n + '</strong> interested</span>' +
                '<span style="display:flex">' + faces + '</span>' +
              '</span>'
            : '') +
        '</div>' +
        (lead ? '' :
          '<button type="button" ' + on(() => { if (!st.busy) toggleInterest(s); }) + ' style="width:100%;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer;' +
            (meIn ? 'border:2px solid #e8a71c;background:#fdf1d6;color:#8f6405' : 'border:2px solid #5b4ae8;background:#5b4ae8;color:#fff') + '">' +
            I.person(16, 2.3) + (meIn ? 'You’re interested' : 'I’m interested') + '</button>') +
      '</div>' +

      '<div style="padding:12px 14px 26px;display:flex;flex-direction:column;gap:12px">' +
        (pending.length
          ? '<div style="background:#fff;border-radius:18px;padding:18px;box-shadow:0 0 0 2px #f1d58f, 0 1px 3px rgba(15,18,25,.08);display:flex;flex-direction:column;gap:4px">' +
              '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#8f6405">' + (pending.length === 1 ? 'Waiting on you' : pending.length + ' waiting on you') + '</div>' +
              '<p style="margin:2px 0 0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">Nothing changes until you say so.</p>' +
              pending.map(p => {
                const current = p.kind === 'spot' ? s.spot : (d ? d.day + (d.time ? ', ' + d.time : '') : '');
                return '<div style="margin-top:10px;padding-top:12px;border-top:1px solid #f2f3f6;display:flex;flex-direction:column;gap:6px">' +
                  '<div style="font-size:14px;font-weight:600;color:#5c6270"><strong style="font-weight:800;color:#0d1117">' + esc(nameOf(p.userId, p.who)) + '</strong> ' + (p.kind === 'spot' ? 'offered a location' : 'suggested a date') + '</div>' +
                  '<div style="font-size:17px;line-height:1.3;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + esc(offerText(p)) + '</div>' +
                  (current ? '<div style="font-size:13.5px;font-weight:600;color:#6b7280">Replaces ' + esc(current) + '</div>' : '') +
                  '<div style="margin-top:6px;display:flex;gap:8px">' +
                    '<button type="button" class="hov-primary" ' + on(() => { if (!st.busy) resolveOffer(s, p, true); }) + ' style="flex:1 1 0;min-height:46px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer">' + (p.kind === 'spot' ? 'Use this location' : 'Use this date') + '</button>' +
                    '<button type="button" class="hov-outline" ' + on(() => { if (!st.busy) resolveOffer(s, p, false); }) + ' style="flex:1 1 0;min-height:46px;background:#fff;border:1.5px solid #dcdfe6;border-radius:999px;font-family:inherit;font-size:15px;font-weight:800;color:#0d1117;cursor:pointer">Not this time</button>' +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>'
          : '') +

        '<div style="' + CARD + ';padding:4px 16px">' +
          '<div ' + rowAttrs(!d, 'day') + 'style="display:flex;align-items:center;gap:12px;min-height:60px' + (d ? '' : ';cursor:pointer') + '">' +
            '<span style="' + tile(!!d) + '">' + I.cal(17) + '</span>' +
            '<div style="flex:1 1 auto;min-width:0"><div style="' + main(!!d) + '">' + esc(d ? d.day : 'Date TBD') + '</div>' + note(d && d.time ? esc(d.time) : '') + '</div>' +
            (d ? '' : action(lead ? 'Set' : 'Suggest')) +
          '</div>' +
          '<div ' + rowAttrs(!s.spot, 'spot') + 'style="display:flex;align-items:center;gap:12px;min-height:60px;border-top:1px solid #f2f3f6' + (s.spot ? '' : ';cursor:pointer') + '">' +
            '<span style="' + tile(!!s.spot) + '">' + I.pin(17) + '</span>' +
            '<div style="flex:1 1 auto;min-width:0"><div style="' + main(!!s.spot) + '">' + esc(s.spot || 'Location TBD') + '</div>' + placeNote + '</div>' +
            (s.spot ? '' : action(lead ? 'Set' : 'Suggest')) +
          '</div>' +
        '</div>' +

        '<div style="' + CARD + ';padding:18px 16px;display:flex;flex-direction:column;gap:10px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
            '<span style="' + EYEBROW + '">The basics</span>' +
            (lead && s.hopes.length ? '<span ' + on(() => openEdit(s)) + ' style="font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span>' : '') +
          '</div>' +
          (s.hopes.length
            ? '<div style="display:flex;flex-direction:column;gap:9px">' + s.hopes.slice(0, 3).map(h =>
                '<div style="display:flex;align-items:center;gap:11px"><span style="flex:0 0 8px;width:8px;height:8px;border-radius:999px;background:#e8a71c"></span><span style="font-size:16.5px;line-height:1.35;font-weight:700;letter-spacing:-.2px;color:#0d1117">' + esc(h) + '</span></div>').join('') + '</div>'
            : lead
              ? '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">What’s the core of it? Up to three short lines.</p>' +
                '<span ' + on(() => openEdit(s)) + ' class="hov-outline" style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:40px;padding:0 15px;border:1.5px solid #dcdfe6;border-radius:999px;font-size:14.5px;font-weight:800;color:#0d1117;cursor:pointer">+ Add the basics</span>'
              : '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#9aa0ac">' + esc(leadName) + ' hasn’t added the basics yet.</p>') +
        '</div>' +

        (s.vision
          ? '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:8px">' +
              '<div style="' + EYEBROW + '">' + (lead ? 'What you’re picturing' : 'What ' + esc(leadName) + ' is picturing') + '</div>' +
              '<p style="margin:0;font-size:15.5px;line-height:1.5;font-weight:500;color:#2b303a;white-space:pre-line">' + esc(s.vision) + '</p>' +
            '</div>'
          : '') +
        (lead ? '<button type="button" class="hov-outline" ' + on(() => openOffer(s, 'vision')) + ' style="' + SECONDARY + ';padding:16px">' + (s.vision ? 'Change what you wrote' : 'Say more about what you’re picturing') + '</button>' : '') +

        (pitching.length
          ? '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:10px">' +
              '<div style="' + EYEBROW + '">Who’s pitching in</div>' +
              pitching.map(o => '<div style="display:flex;gap:10px"><span style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:' + (o.waiting ? '#e8c46a' : '#e8a71c') + ';margin-top:7px"></span>' +
                '<span style="font-size:14.5px;line-height:1.42;font-weight:500;color:#454b55"><strong style="font-weight:800;color:#0d1117">' + esc(o.who) + '</strong> ' + esc(o.line) +
                (o.waiting ? '<span style="font-weight:700;color:#8f6405"> · waiting on ' + esc(leadName) + '</span>' : '') + '</span></div>').join('') +
            '</div>'
          : '') +

        (showMood
          ? '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
                '<span style="' + EYEBROW + '">The vibe</span>' +
                (lead ? '<span style="font-size:12.5px;font-weight:700;color:#9aa0ac">' + mood.length + ' / 3</span>' : '') +
              '</div>' +
              (lead && !mood.length ? '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">Add up to three photos that set the mood: the place, past years, the feel you’re going for.</p>' : '') +
              '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
                mood.map((p, i) => '<div ' + on(() => setState({ zoom: { photos: mood.map(photoUrl), i } })) + ' aria-label="View mood photo ' + (i + 1) + '" style="position:relative;aspect-ratio:1;border-radius:12px;cursor:zoom-in;background:' + bg(photoUrl(p)) + '">' +
                  (lead ? '<span ' + on((e) => { stop(e); if (!st.busy) removeMood(s, p); }) + ' aria-label="Remove photo" style="position:absolute;top:5px;right:5px;width:24px;height:24px;border-radius:999px;background:rgba(13,17,23,.6);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(11, '#fff', 3) + '</span>' : '') +
                  '</div>').join('') +
                (lead && mood.length < 3
                  ? '<label class="hov-dash" style="aspect-ratio:1;border-radius:12px;border:1.5px dashed #cfd3db;background:#f7f7f9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer">' +
                      I.plus(20, '#5b4ae8', 2.4) + '<span style="font-size:12.5px;font-weight:800;color:#5b4ae8">Add photo</span>' +
                      '<input type="file" accept="image/*" aria-label="Add a mood photo" ' + onInput(e => { if (e.type !== 'change') return; const f = Array.from(e.target.files || []); e.target.value = ''; addMood(s, f); }) + ' style="display:none">' +
                    '</label>'
                  : '') +
              '</div>' +
            '</div>'
          : '') +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // 7. Profile (signed in only)
  // ---------------------------------------------------------------------------

  function viewProfile() {
    const st = state;
    const mine = st.sparks.filter(s => isLead(s));
    const groups = myGroups();
    const avatar = st.myAvatar ? photoUrl(st.myAvatar) : null;
    const section = (label, inner) => '<div><div style="padding:0 6px 8px;' + EYEBROW + '">' + label + '</div><div style="' + CARD + ';padding:0 16px">' + inner + '</div></div>';
    return '<div data-screen-label="Profile">' +
      '<header style="background:#fff;padding:30px 20px 22px;display:flex;align-items:center;gap:14px">' +
        '<div ' + on(openProfileEdit) + ' aria-label="Change photo" style="position:relative;flex:0 0 64px;width:64px;height:64px;cursor:pointer">' +
          '<span style="width:64px;height:64px;border-radius:999px;background:' + (avatar ? bg(avatar) : '#e8a71c') + ';color:#fff;font-size:26px;font-weight:900;display:flex;align-items:center;justify-content:center">' + (avatar ? '' : esc(initialOf(st.myName) || '?')) + '</span>' +
          '<span style="position:absolute;right:-2px;bottom:-2px;width:26px;height:26px;border-radius:999px;background:#fff;box-shadow:0 1px 4px rgba(15,18,25,.2);display:flex;align-items:center;justify-content:center">' + I.camera(14) + '</span>' +
        '</div>' +
        '<div style="flex:1 1 auto;min-width:0">' +
          '<div style="font-size:26px;line-height:1.05;font-weight:900;letter-spacing:-.7px;color:#0d1117;overflow-wrap:break-word">' + esc(st.myName || 'No name yet') + '</div>' +
          '<div style="margin-top:3px;font-size:14px;font-weight:600;color:#6b7280;overflow-wrap:anywhere">' + esc(st.email) + '</div>' +
        '</div>' +
        '<button type="button" class="hov-outline" ' + on(openProfileEdit) + ' style="flex:0 0 auto;min-height:40px;padding:0 15px;background:#fff;border:1.5px solid #dcdfe6;border-radius:999px;font-family:inherit;font-size:14px;font-weight:800;color:#0d1117;cursor:pointer">Edit</button>' +
      '</header>' +
      '<div style="padding:18px 14px 26px;display:flex;flex-direction:column;gap:20px">' +
        section('Your ideas', mine.length
          ? mine.map((s, i) => {
              const g = groupById(s.groupId), d = dayOf(s);
              return '<div ' + on(() => go('detail', { subjectId: s.id, tag: null })) + ' style="display:flex;align-items:center;gap:12px;min-height:60px;padding:11px 0;border-top:' + (i ? '1px solid #f2f3f6' : '0') + ';cursor:pointer">' +
                '<div style="flex:1 1 auto;min-width:0"><div style="font-size:15.5px;line-height:1.3;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + esc(s.text) + '</div>' +
                '<div style="margin-top:1px;font-size:13px;font-weight:600;color:#6b7280">' + esc((g ? g.name : '') + (d ? ' · ' + d.day : '')) + '</div></div>' +
                I.chevR(16, '#9aa0ac', 2.4) + '</div>';
            }).join('')
          : '<div style="padding:16px 0;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Nothing yet. Anything you post shows up here.</div>') +
        section('Your groups',
          groups.map(g => '<div ' + on(() => g.role === 'admin' ? openGroupPage(g.id) : openGroup(g)) + ' style="display:flex;align-items:center;gap:10px;min-height:54px;border-bottom:1px solid #f2f3f6;cursor:pointer">' +
            '<span style="flex:1 1 auto;min-width:0;font-size:15.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">' + esc(g.name) + '</span>' +
            (g.role === 'admin' ? '<span aria-label="You’re an admin" style="flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 9px 3px 7px;background:#fdf1d6;color:#8f6405;font-size:11px;font-weight:900;letter-spacing:.6px;text-transform:uppercase">' + I.star(11) + 'Admin</span>' : '') +
            I.chevR(16, '#9aa0ac', 2.4) + '</div>').join('') +
          '<div ' + on(() => openJoin()) + ' style="display:flex;align-items:center;gap:10px;min-height:54px;cursor:pointer">' + I.keypad(16) + '<span style="font-size:15.5px;font-weight:800;color:#5b4ae8">Join with a code</span></div>' +
          '<div ' + on(startGroup) + ' style="display:flex;align-items:center;gap:10px;min-height:48px;border-top:1px solid #f2f3f6;cursor:pointer">' + I.plus(15, '#6b7280', 2.4) + '<span style="font-size:14.5px;font-weight:700;color:#5c6270">Start a group</span></div>') +
        '<div style="display:flex;flex-direction:column;gap:14px">' +
          '<div ' + on(signOut) + ' style="' + CARD + ';padding:0 16px;min-height:52px;display:flex;align-items:center;cursor:pointer"><span style="font-size:15.5px;font-weight:800;color:#9b1c31">Sign out</span></div>' +
          '<a href="/privacy.html" target="_blank" rel="noopener" style="align-self:center;display:flex;align-items:center;min-height:36px;padding:0 10px;font-size:13.5px;font-weight:700;color:#6b7280">Privacy</a>' +
        '</div>' +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // 8. Group page (admins)
  // ---------------------------------------------------------------------------

  function viewGroupPage() {
    const st = state, g = groupById(st.gpId);
    if (!g || g.role !== 'admin') return viewHome();
    const link = st.gpCode ? inviteLink(st.gpCode) : '';
    const share = () => {
      if (!link) return;
      if (navigator.share) navigator.share({ title: 'Join ' + g.name + ' on Spark Hub', url: link }).catch(() => {});
      else copy(link, 'Invite link copied');
    };
    return '<div data-screen-label="Group you run">' +
      '<header style="background:#fff;padding:16px 20px;display:flex;align-items:center;gap:14px">' +
        '<div ' + on(() => go('profile')) + ' aria-label="Back" style="flex:0 0 38px;width:38px;height:38px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.chevL(18, '#0d1117', 2.2) + '</div>' +
        '<div style="min-width:0"><div style="font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#8f6405">You’re an admin</div>' +
        '<div style="font-size:19px;font-weight:800;letter-spacing:-.3px;color:#0d1117">' + esc(g.name) + '</div></div>' +
      '</header>' +
      '<div style="padding:18px 14px 26px;display:flex;flex-direction:column;gap:14px">' +
        '<div style="background:#fff;border-radius:20px;padding:20px 18px;box-shadow:0 1px 3px rgba(15,18,25,.08);display:flex;flex-direction:column;gap:12px">' +
          '<div style="' + EYEBROW + '">Invite people</div>' +
          '<div style="background:#f3f1fe;border-radius:16px;padding:16px;text-align:center">' +
            '<div style="font-size:30px;line-height:1;font-weight:900;letter-spacing:6px;color:#0d1117;min-height:30px">' + esc(st.gpCode || '······') + '</div>' +
            '<div style="margin-top:8px;font-size:13px;font-weight:600;color:#5c6270;overflow-wrap:break-word">' + esc(link.replace(/^https?:\/\//, '')) + '</div>' +
          '</div>' +
          '<button type="button" class="hov-primary" ' + on(share) + ' style="' + primary(!!link) + ';box-shadow:0 10px 24px rgba(91,74,232,.32)">Share invite link</button>' +
          '<button type="button" class="hov-outline" ' + on(() => { if (st.gpCode) copy(st.gpCode, 'Code copied'); }) + ' style="' + SECONDARY + ';padding:14px;font-size:15.5px">Copy code</button>' +
        '</div>' +
        '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:12px">' +
          '<div style="' + EYEBROW + '">Group photo</div>' +
          '<div role="img" aria-label="Group photo" style="position:relative;height:120px;border-radius:14px;overflow:hidden;background:' + (groupPhoto(g) ? bg(groupPhoto(g), '50% 40%') : '#e8a71c') + '">' +
            '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to right, rgba(13,17,23,.75), rgba(13,17,23,.15))"></div>' +
            '<div style="position:absolute;left:14px;bottom:12px;right:14px;font-size:18px;font-weight:900;letter-spacing:-.3px;color:#fff">' + esc(g.name) + '</div>' +
          '</div>' +
          '<label class="hov-outline" style="' + SECONDARY + ';padding:12px;font-size:15px;text-align:center;cursor:' + (st.busy ? 'wait' : 'pointer') + '">' +
            (st.busy === 'save' ? 'Saving…' : 'Replace photo') +
            '<input type="file" accept="image/*" aria-label="Replace group photo" ' + onInput(e => { if (e.type !== 'change') return; const f = Array.from(e.target.files || []); e.target.value = ''; setGroupPhoto(g, f); }) + ' style="display:none">' +
          '</label>' +
          '<div style="font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Shows on the group’s tile and at the top of its ideas, for everyone in the group.</div>' +
        '</div>' +
        '<div style="' + CARD + ';padding:0 16px">' +
          '<div style="display:flex;align-items:center;gap:10px;min-height:54px"><span style="flex:1 1 auto;font-size:15.5px;font-weight:700;color:#0d1117">Members</span><span style="font-size:15px;font-weight:600;color:#6b7280">' + (st.gpMembers == null ? '…' : st.gpMembers) + '</span></div>' +
          '<div ' + on(() => openGroup(g)) + ' style="display:flex;align-items:center;gap:10px;min-height:54px;border-top:1px solid #f2f3f6;cursor:pointer"><span style="flex:1 1 auto;font-size:15.5px;font-weight:700;color:#0d1117">Go to this group</span>' + I.chevR(16, '#9aa0ac', 2.4) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // Location field with suggestions (post flow and the lead's "Set")
  // ---------------------------------------------------------------------------

  const placeField = (field, opts) => {
    const st = state;
    const text = field === 'offer' ? st.offerText : st.locText;
    const picked = field === 'offer' ? st.offerPlace : st.locPlace;
    const sugg = field === 'offer' ? st.offerSuggest : st.locSuggest;
    const setText = (v) => field === 'offer'
      ? setState({ offerText: v, offerPlace: null })
      : setState({ locText: v, locMode: 'specific', locPlace: null });
    const pick = (p) => { clearTimeout(placeTimer); setState(field === 'offer'
      ? { offerText: p.name, offerPlace: p, offerSuggest: [] }
      : { locText: p.name, locPlace: p, locSuggest: [], locMode: 'specific' }); };
    return '<div style="position:relative;display:flex;flex-direction:column;gap:4px">' +
      '<input class="fld" type="text" maxlength="80" autocomplete="off" aria-label="Location" placeholder="' + esc(opts.placeholder) + '" value="' + esc(text) + '" ' +
        onInput(e => { const v = e.target.value.slice(0, 80); setText(v); findPlaces(v, field); }) +
        ' style="' + opts.style + '">' +
      (picked
        ? '<div style="display:flex;align-items:flex-start;gap:8px;padding:2px 4px 0;font-size:14px;line-height:1.4;font-weight:600;color:#5c6270">' +
            '<span aria-hidden="true" style="flex:0 0 auto;margin-top:1px;color:#5b4ae8">' + I.pin(14) + '</span><span>' + esc(picked.address) + '</span></div>'
        : '') +
      (!picked && sugg.length
        ? '<div role="group" aria-label="Suggested places" style="background:#fff;border:2px solid #e6e7eb;border-radius:18px;overflow:hidden;box-shadow:0 12px 28px rgba(15,18,25,.08)">' +
            sugg.map((p, i) =>
              '<div ' + on(() => pick(p)) + ' class="hov-row" style="display:flex;align-items:flex-start;gap:10px;padding:12px 16px;cursor:pointer' + (i ? ';border-top:1px solid #f2f3f6' : '') + '">' +
                '<span aria-hidden="true" style="flex:0 0 auto;margin-top:2px;color:#9aa0ac">' + I.pin(14) + '</span>' +
                '<span style="min-width:0"><span style="display:block;font-size:15.5px;line-height:1.3;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.name) + '</span>' +
                (p.sub ? '<span style="display:block;margin-top:1px;font-size:13.5px;line-height:1.35;font-weight:500;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.sub) + '</span>' : '') +
                '</span></div>').join('') +
            '<div style="padding:8px 16px 10px;border-top:1px solid #f2f3f6;font-size:11.5px;font-weight:500;color:#9aa0ac">' +
              'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" style="color:inherit">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style="color:inherit">OpenStreetMap</a> contributors</div>' +
          '</div>'
        : '') +
    '</div>';
  };

  // ---------------------------------------------------------------------------
  // 5. Post an idea: event → location → date → the basics → photos → look good?
  // ---------------------------------------------------------------------------

  const TIME_OPTS = Array.from({ length: 48 }, (_, i) => {
    const hh = Math.floor(i / 2), mm = i % 2 ? '30' : '00';
    return [pad2(hh) + ':' + mm, (hh % 12 || 12) + ':' + mm + (hh < 12 ? ' am' : ' pm')];
  });

  const overlayHeader = (title, back) => {
    const g = currentGroup();
    return '<header style="background:#fff;border-bottom:1px solid #e6e7eb;padding:16px 20px;display:flex;align-items:center;gap:14px">' +
      '<div ' + on(back) + ' aria-label="Back" style="flex:0 0 38px;width:38px;height:38px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.chevL(18, '#0d1117', 2.2) + '</div>' +
      '<div><div style="font-size:11.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#5b4ae8">' + esc(g ? g.name : 'Spark Hub') + '</div>' +
      '<div style="font-size:19px;font-weight:800;letter-spacing:-.3px;color:#0d1117">' + title + '</div></div>' +
    '</header>';
  };
  const stepHead = (title) => '<div><div style="font-size:12.5px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#8f6405">' + esc(cleanTitle(state.activity)) + '</div>' +
    '<h2 style="margin:6px 0 0;font-size:31px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">' + title + '</h2></div>';

  const basicsInputs = (values, onChange) => values.map((v, i) =>
    '<div style="display:flex;align-items:center;gap:12px;border-bottom:1.5px solid #eff0f3">' +
      '<span style="flex:0 0 8px;width:8px;height:8px;border-radius:999px;background:' + (v ? '#e8a71c' : '#dfe2e8') + '"></span>' +
      '<input type="text" maxlength="30" aria-label="The basics, line ' + (i + 1) + '" placeholder="' + esc(HOPE_PH[i]) + '" value="' + esc(v) + '" ' +
        onInput(e => onChange(i, e.target.value.slice(0, 30))) +
        ' style="flex:1 1 auto;min-width:0;background:transparent;border:0;padding:14px 0;font-family:inherit;font-size:17px;font-weight:700;color:#0d1117;outline:none">' +
      '<span style="flex:0 0 auto;font-size:12px;font-weight:700;color:#9aa0aa">' + (v ? 30 - v.length : '') + '</span>' +
    '</div>').join('');

  function viewCompose() {
    const st = state;
    const to = (step) => () => setState({ step });
    const close = () => {
      if (st.step !== 'activity') { setState({ step: 'activity' }); return; }
      go('home', composeReset());
    };
    const actReady = st.activity.trim().length > 0;
    let body = '';

    if (st.step === 'activity') {
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:16px">' +
        '<h2 style="margin:0;font-size:34px;line-height:1.04;font-weight:900;letter-spacing:-1px;color:#0d1117;text-wrap:pretty">What’s the event?</h2>' +
        '<div><textarea class="fld" rows="2" maxlength="80" aria-label="The event" placeholder="E.g. a sunrise walk, laser tag, pickleball at the park" ' + onInput(e => setState({ activity: e.target.value.slice(0, 80) })) +
          ' style="width:100%;display:block;background:#fff;border:2px solid #e6e7eb;border-radius:18px;padding:16px 18px;font-size:21px;line-height:1.35;font-weight:700;letter-spacing:-.3px;color:#0d1117;resize:none;outline:none">' + esc(st.activity) + '</textarea></div>' +
        '<button type="button" ' + on(() => { if (actReady) setState({ step: 'location' }); }) + ' aria-disabled="' + !actReady + '" style="' + btn(actReady) + ';margin-top:2px">Next</button>' +
        backLink(close) +
      '</div>';
    }

    if (st.step === 'location') {
      const locReady = st.locText.trim().length > 0;
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:12px">' +
        stepHead('Location') +
        placeField('loc', { placeholder: 'Enter the location', style: 'width:100%;background:#fff;border:2px solid #e6e7eb;border-radius:18px;padding:16px 18px;font-family:inherit;font-size:18px;font-weight:700;letter-spacing:-.2px;color:#0d1117;outline:none' }) +
        '<button type="button" ' + on(() => { if (locReady) setState({ step: 'when', locMode: 'specific', locSuggest: [] }); }) + ' aria-disabled="' + !locReady + '" style="' + btn(locReady) + '">Next</button>' +
        orDivider() +
        '<button type="button" class="hov-tint" ' + on(() => { findPlaces('', 'loc'); setState({ step: 'when', locMode: 'open', locText: '', locPlace: null, locSuggest: [] }); }) + ' style="' + OUTLINE_PURPLE + '">Decide location later</button>' +
        backLink(to('activity')) +
      '</div>';
    }

    if (st.step === 'when') {
      const whenReady = st.dateOne.length > 0;
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:12px">' +
        stepHead('Date') +
        '<div style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:8px">' +
          '<input class="fld" type="date" aria-label="Date" min="' + todayISO() + '" value="' + esc(st.dateOne) + '" ' + onInput(e => setState({ dateOne: e.target.value, whenMode: 'one' })) +
            ' style="width:100%;min-width:0;height:58px;padding:0 12px;background:#fff;border:2px solid #e6e7eb;border-radius:18px;font-family:inherit;font-size:16px;font-weight:700;color:#0d1117;outline:none;color-scheme:light">' +
          (st.timeOn
            ? '<div style="position:relative;height:58px">' +
                '<select class="fld" aria-label="Time" ' + onInput(e => setState({ timeOne: e.target.value })) + ' style="width:100%;height:58px;padding:0 34px 0 12px;appearance:none;-webkit-appearance:none;background:#fff;border:2px solid #e6e7eb;border-radius:18px;font-family:inherit;font-size:16px;font-weight:700;color:#0d1117;outline:none;color-scheme:light">' +
                  TIME_OPTS.map(([v, l]) => '<option value="' + v + '"' + (v === st.timeOne ? ' selected' : '') + '>' + l + '</option>').join('') +
                '</select>' +
                '<div ' + on(() => setState({ timeOn: false, timeOne: '' })) + ' aria-label="Remove time" style="position:absolute;top:50%;right:6px;transform:translateY(-50%);width:28px;height:28px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(12, '#5c6270', 2.6) + '</div>' +
              '</div>'
            : '<div ' + on(() => setState({ timeOn: true, whenMode: 'one', timeOne: st.timeOne || '18:00' })) + ' class="hov-dash" style="height:58px;border:2px dashed #cfd3db;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:15px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(14, '#5b4ae8', 2.6) + 'Add time</div>') +
        '</div>' +
        '<button type="button" ' + on(() => { if (whenReady) setState({ step: 'specifics', whenMode: 'one' }); }) + ' aria-disabled="' + !whenReady + '" style="' + btn(whenReady) + '">Next</button>' +
        orDivider() +
        '<button type="button" class="hov-tint" ' + on(() => setState({ step: 'specifics', whenMode: 'open', dateOne: '', timeOn: false, timeOne: '' })) + ' style="' + OUTLINE_PURPLE + '">Decide date later</button>' +
        backLink(to('location')) +
      '</div>';
    }

    if (st.step === 'specifics') {
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:14px">' +
        stepHead('Paint the picture') +
        '<div style="background:#fff;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:6px;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
          '<div style="font-size:18px;font-weight:800;letter-spacing:-.3px;color:#0d1117">The basics</div>' +
          '<p style="margin:2px 0 6px;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">Up to three short lines about the core of it. Skip any you like.</p>' +
          basicsInputs(st.hopes, (i, v) => { const hopes = state.hopes.slice(); hopes[i] = v; setState({ hopes }); }) +
        '</div>' +
        '<button type="button" ' + on(to('photos')) + ' style="' + btn(true) + '">Next</button>' +
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
              '<div role="img" aria-label="Photo ' + (i + 1) + '" style="position:absolute;inset:0;background:' + bg(p.url) + '"></div>' +
              '<div ' + on(() => removePhoto(i)) + ' aria-label="Remove photo" style="position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:999px;background:rgba(13,17,23,.6);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(12, '#fff', 2.8) + '</div>' +
            '</div>').join('') +
          (st.photos.length < 3
            ? '<label class="hov-dash" style="aspect-ratio:1/1;border-radius:16px;overflow:hidden;position:relative;border:2px dashed #cfd3db;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer">' +
                I.photo(22, '#5b4ae8', 2.2) + '<span style="font-size:13.5px;font-weight:800;color:#5b4ae8">' + (has ? 'Add another' : 'Add photo') + '</span>' +
                '<input type="file" accept="image/*" multiple aria-label="Add photos" ' + onInput(e => { if (e.type !== 'change') return; const f = Array.from(e.target.files || []); e.target.value = ''; addPhotos(f); }) + ' style="display:none">' +
              '</label>'
            : '') +
        '</div>' +
        '<button type="button" ' + on(() => { if (has) setState({ step: 'review' }); }) + ' aria-disabled="' + !has + '" style="' + btn(has) + '">Next</button>' +
        orDivider() +
        '<button type="button" class="hov-tint" ' + on(() => { st.photos.forEach(p => URL.revokeObjectURL(p.url)); setState({ step: 'review', photos: [] }); }) + ' style="' + OUTLINE_PURPLE + '">Skip photos</button>' +
        backLink(to('specifics')) +
      '</div>';
    }

    if (st.step === 'review') {
      const hopes = st.hopes.map(cleanTitle).filter(Boolean);
      const place = st.locMode === 'specific' && st.locPlace ? st.locPlace : null;
      const busy = st.busy === 'post';
      const row = (label, value, step, gold) => '<div style="display:flex;align-items:flex-start;gap:12px;padding:14px 0;border-top:' + (gold ? '0' : '1px solid #f2f3f6') + '">' +
        '<div style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:' + (gold ? '3' : '6') + 'px">' +
          '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:' + (gold ? '#8f6405' : '#6b7280') + '">' + label + '</div>' + value +
        '</div>' +
        '<span ' + on(to(step)) + ' aria-label="Edit ' + label.toLowerCase() + '" style="flex:0 0 auto;min-height:36px;display:flex;align-items:center;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span>' +
      '</div>';
      const plain = (t, muted) => '<div style="font-size:16.5px;line-height:1.35;font-weight:' + (muted ? 600 : 700) + ';color:' + (muted ? '#6b7280' : '#0d1117') + '">' + esc(t) + '</div>';
      const when = st.whenMode === 'one' && st.dateOne ? fmtDay(st.dateOne) + (st.timeOn && st.timeOne ? ', ' + fmtTime(st.timeOne) : '') : '';
      body = '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:14px">' +
        '<h2 style="margin:0;font-size:31px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117">Look good?</h2>' +
        '<div style="background:#fff;border-radius:20px;padding:4px 18px;box-shadow:0 1px 3px rgba(15,18,25,.08);display:flex;flex-direction:column">' +
          row('The event', '<div style="font-size:21px;line-height:1.2;font-weight:900;letter-spacing:-.4px;color:#0d1117">' + esc(cleanTitle(st.activity)) + '</div>', 'activity', true) +
          row('Location', (st.locMode === 'specific' && st.locText.trim() ? plain(cleanTitle(st.locText)) : plain('Decide later', true)) +
            (place ? '<div style="font-size:13.5px;line-height:1.35;font-weight:500;color:#6b7280">' + esc(place.address) + '</div>' : ''), 'location') +
          row('Date', when ? plain(when) : plain('Decide later', true), 'when') +
          row('The basics', hopes.length
            ? hopes.map(h => '<div style="display:flex;gap:10px"><span style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:#e8a71c;margin-top:8px"></span><span style="font-size:16px;line-height:1.4;font-weight:700;color:#0d1117">' + esc(h) + '</span></div>').join('')
            : '<div style="font-size:16px;font-weight:600;color:#6b7280">Nothing yet</div>', 'specifics') +
          row('Photos', st.photos.length
            ? '<div style="display:flex;gap:6px">' + st.photos.map(p => '<div style="width:56px;height:56px;border-radius:10px;background:' + bg(p.url) + '"></div>').join('') + '</div>'
            : '<div style="font-size:16px;font-weight:600;color:#6b7280">None</div>', 'photos') +
        '</div>' +
        '<div style="display:flex;gap:11px;padding:4px 2px">' + I.shield(19, '#5b4ae8', 1.9) +
          '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#454b55"><strong style="font-weight:800;color:#0d1117">You’ll be the Lead of this event.</strong> You’ve got final say, the dates, the details, but that doesn’t mean doing it alone. Leading well means bringing other people in and deciding together.</p>' +
        '</div>' +
        '<button type="button" class="hov-primary" ' + on(() => { if (!busy) createDraft(); }) + ' aria-disabled="' + busy + '" style="' + btn(true) + (busy ? ';opacity:.72;cursor:wait' : '') + '">' + (busy ? 'Putting it up…' : 'Put it up') + '</button>' +
        backLink(to('photos')) +
      '</div>';
    }

    return '<div class="overlay-screen" data-screen-label="New spark">' + overlayHeader('Post your idea', close) + body + '</div>';
  }

  // ---------------------------------------------------------------------------
  // 6. Edit idea (lead, or an admin of its group)
  // ---------------------------------------------------------------------------

  function viewEdit(s) {
    const st = state, ok = st.editText.trim().length > 0 && st.busy !== 'save';
    return '<div class="overlay-screen" data-screen-label="Edit idea">' +
      overlayHeader('Edit idea', () => setState({ screen: 'detail' })) +
      '<div style="padding:22px 20px 26px;display:flex;flex-direction:column;gap:14px">' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<div style="font-size:18px;font-weight:800;letter-spacing:-.3px;color:#0d1117">The idea</div>' +
          '<textarea class="fld" rows="2" maxlength="80" aria-label="The idea" ' + onInput(e => setState({ editText: e.target.value.slice(0, 80) })) +
            ' style="width:100%;display:block;background:#fff;border:2px solid #e6e7eb;border-radius:18px;padding:14px 16px;font-size:19px;line-height:1.35;font-weight:700;letter-spacing:-.3px;color:#0d1117;resize:none;outline:none">' + esc(st.editText) + '</textarea>' +
        '</div>' +
        '<div style="background:#fff;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:6px;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
          '<div style="font-size:18px;font-weight:800;letter-spacing:-.3px;color:#0d1117">The basics</div>' +
          basicsInputs(st.editHopes, (i, v) => { const h = state.editHopes.slice(); h[i] = v; setState({ editHopes: h }); }) +
        '</div>' +
        '<p style="margin:0 4px;font-size:14px;line-height:1.45;font-weight:500;color:#6b7280">The location, date and offers stay as they are.' +
          (isLead(s) ? '' : ' You’re editing as an admin of ' + esc((groupById(s.groupId) || {}).name || 'this group') + '; ' + esc(nameOf(s.leadId, s.leadName) || 'the lead') + ' still leads it.') + '</p>' +
        '<button type="button" class="hov-primary" ' + on(() => { if (ok) saveEdit(s); }) + ' aria-disabled="' + !ok + '" style="' + btn(ok) + '">' + (st.busy === 'save' ? 'Saving…' : 'Save changes') + '</button>' +
        '<div style="height:1px;background:#e2e4e9;margin:6px 0"></div>' +
        '<span ' + on(() => askDelete(s)) + ' style="display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;font-size:15px;font-weight:800;color:#9b1c31;cursor:pointer">' + I.trash(15, '#9b1c31') + 'Delete this idea</span>' +
      '</div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // Pop-ups
  // ---------------------------------------------------------------------------

  const modal = (label, close, inner, opts) => '<div class="modal-scrim" ' + (close ? 'data-scrim="' + reg(close) + '" ' : '') + 'style="z-index:' + ((opts && opts.z) || 30) + '">' +
    '<div role="' + ((opts && opts.role) || 'dialog') + '" aria-modal="true" aria-label="' + esc(label) + '" data-screen-label="' + esc(label) + '" style="position:relative;width:100%;max-width:' + ((opts && opts.max) || 340) + 'px;max-height:100%;overflow-y:auto;background:#fff;border-radius:22px;padding:22px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 60px rgba(15,18,25,.3);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
      (close ? '<div ' + on(close) + ' aria-label="Close" style="position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(15, '#0d1117', 2.4) + '</div>' : '') +
      inner +
    '</div></div>';
  const h3 = (t, extra) => '<h3 style="margin:' + (extra || '0') + ';padding-right:36px;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117;text-wrap:pretty">' + t + '</h3>';
  const para = (t, color) => '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:' + (color || '#5c6270') + ';text-wrap:pretty;overflow-wrap:break-word">' + t + '</p>';
  const codeInput = (value, label, onChange, size) => '<input class="fld" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label="' + label + '" placeholder="000000" value="' + esc(value) + '" ' +
    onInput(e => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))) +
    ' style="width:100%;background:#fff;border:2px solid #e6e7eb;border-radius:14px;padding:14px 16px;font-family:inherit;font-size:' + (size || 26) + 'px;font-weight:800;letter-spacing:10px;text-align:center;color:#0d1117;outline:none">';

  function viewLogin() {
    const st = state, busy = st.busy;
    if (st.loginStep === 'email') {
      const emailOk = EMAIL_OK.test(st.loginEmail.trim()), withGoogle = GOOGLE_ON && !st.loginEmailOnly;
      const lead = { post: 'Sign in to put your idea up. ', guest: 'Your name fills in, and everything you add is saved to your account. ', join: 'Sign in to join a group. ' }[st.loginFrom] ||
        'Your ideas, groups and name are saved to your account. ';
      return modal('Sign in', closeLogin,
        h3(st.loginFrom === 'post' ? 'Sign in to post' : 'Sign in') +
        para(lead + (withGoogle ? 'Use Google, or we’ll email you a 6-digit code. No password.' : 'We’ll email you a 6-digit code. No password.')) +
        (st.googleFailed
          ? '<div role="alert" style="display:flex;align-items:flex-start;gap:9px;background:#fdeef0;border:1.5px solid #f5c2cb;border-radius:14px;padding:11px 13px">' +
              '<span style="flex:0 0 18px;width:18px;height:18px;margin-top:1px;border-radius:999px;background:#9b1c31;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center">!</span>' +
              '<span style="font-size:14px;line-height:1.4;font-weight:700;color:#9b1c31">Google sign-in didn’t finish. Try again, or use your email.</span></div>'
          : '') +
        (withGoogle
          ? '<button type="button" class="hov-grey" ' + on(googleSignIn) + ' style="width:100%;min-height:54px;display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;border:2px solid #dcdfe6;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;color:#0d1117;cursor:' + (busy === 'google' ? 'wait' : 'pointer') + ';opacity:' + (busy && busy !== 'google' ? '.5' : '1') + '">' +
              I.google + (busy === 'google' ? 'Opening Google…' : 'Continue with Google') + '</button>' + orDivider()
          : '') +
        '<input class="fld" type="email" inputmode="email" maxlength="80" autocomplete="email" autocapitalize="off" spellcheck="false" aria-label="Email" placeholder="you@example.com" value="' + esc(st.loginEmail) + '" ' +
          onInput(e => setState({ loginEmail: e.target.value.slice(0, 80) })) + ' style="' + FIELD + '">' +
        '<button type="button" ' + on(() => { if (emailOk && !busy) sendCode(false); }) + ' aria-disabled="' + !(emailOk && !busy) + '" style="' + primary(emailOk && !busy) + '">' + (busy === 'send' ? 'Sending…' : 'Email me a code') + '</button>' +
        '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Only used to sign you in. Nobody else sees it. <a href="/privacy.html" target="_blank" rel="noopener" style="font-weight:800;color:#5b4ae8">Privacy</a></p>',
        { z: 32 });
    }
    const codeOk = st.loginCode.length >= 6 && !busy;
    return modal('Enter the code', closeLogin,
      h3('Enter the code') +
      para('Sent to <strong style="font-weight:700;color:#0d1117">' + esc(st.loginEmail.trim()) + '</strong> · <span ' + on(() => setState({ loginStep: 'email' })) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Change</span>') +
      codeInput(st.loginCode, 'Code from the email', v => setState({ loginCode: v })) +
      '<button type="button" ' + on(() => { if (codeOk) verifyCode(); }) + ' aria-disabled="' + !codeOk + '" style="' + primary(codeOk) + '">' + (busy === 'signin' ? 'Signing in…' : 'Sign in') + '</button>' +
      '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:4px;font-size:14px;line-height:1.45;font-weight:500;color:#6b7280"><span>Not there? Check spam, or</span>' +
        '<span ' + on(() => { if (!busy) sendCode(true); }) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">' + (st.resent ? 'Sent again' : 'Send it again') + '</span></div>',
      { z: 32 });
  }

  function viewName() {
    const st = state, ok = st.nameText.trim().length > 0;
    const close = () => setState({ nameAsk: null, nameText: '' });
    const submit = async () => {
      if (!ok) return;
      const then = st.nameAsk, name = cleanTitle(st.nameText).slice(0, 30);
      setState({ nameAsk: null, nameText: '' });
      try { await saveName(name, false); } catch (e) { console.error(e); }
      if (typeof then === 'function') then();
    };
    return modal('Your name', close,
      '<span aria-hidden="true" style="width:52px;height:52px;border-radius:999px;background:' + (ok ? '#e8a71c' : '#dfe2e8') + ';color:' + (ok ? '#fff' : '#6b7280') + ';font-size:21px;font-weight:900;display:flex;align-items:center;justify-content:center;transition:background .2s ease">' + esc(initialOf(st.nameText) || '?') + '</span>' +
      h3(st.myName ? 'Change name' : 'Your name', '2px 0 0') +
      '<input class="fld" type="text" maxlength="30" autocomplete="given-name" aria-label="First name" placeholder="First name" value="' + esc(st.nameText) + '" ' + onInput(e => setState({ nameText: e.target.value.slice(0, 30) })) + ' style="' + FIELD + '">' +
      '<button type="button" ' + on(submit) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">Continue</button>' +
      (!st.myName && !st.email
        ? '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:4px;font-size:13.5px;font-weight:500;color:#6b7280"><span>Been here before?</span><span ' + on(() => openLogin('default', st.nameAsk)) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Sign in</span></div>'
        : ''),
      { max: 330 });
  }

  function viewGuest() {
    const st = state, s = subject();
    const nameOk = st.guestName.trim().length > 0;
    const phoneOk = st.guestPhone.replace(/\D/g, '').length >= 10;
    const ok = nameOk && phoneOk && !st.busy;
    const to = s ? firstName(nameOf(s.leadId, s.leadName)) : 'The lead';
    const close = () => setState({ guestOpen: false, guestThen: null });
    const submit = async () => {
      if (!ok) return;
      const name = cleanTitle(st.guestName).slice(0, 30), phone = st.guestPhone.trim();
      const then = st.guestThen;
      setState({ guest: { name, phone }, guestOpen: false, guestThen: null, myName: st.myName || name });
      try { await ensureSession(); must(await sb.from('profiles').upsert({ id: state.me, name }, { onConflict: 'id' })); } catch (e) { console.error(e); }
      if (typeof then === 'function') then();
    };
    return modal('Your info', close,
      h3('Your info') +
      para('So ' + esc(to) + ' can reach you. Only they see it.') +
      '<input class="fld" type="text" maxlength="30" autocomplete="name" aria-label="Your name" placeholder="Jane Smith" value="' + esc(st.guestName) + '" ' + onInput(e => setState({ guestName: e.target.value.slice(0, 30) })) + ' style="' + FIELD + '">' +
      '<input class="fld" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" aria-label="Phone number" placeholder="Phone number" value="' + esc(st.guestPhone) + '" ' + onInput(e => setState({ guestPhone: e.target.value.replace(/[^\d\s()+.-]/g, '').slice(0, 20) })) + ' style="' + FIELD + '">' +
      '<button type="button" ' + on(submit) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">Continue</button>' +
      '<div style="margin-top:4px;background:#f3f1fe;border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:12px">' +
        '<div style="flex:1 1 auto;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">Have an account?</div>' +
        '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:500;color:#454b55">Sign in to skip this.</div></div>' +
        '<span ' + on(() => { const fn = st.guestThen; setState({ guestOpen: false, guestThen: null }); openLogin('guest', () => needName(fn || (() => {}))); }) + ' class="hov-primary" style="flex:0 0 auto;display:flex;align-items:center;min-height:40px;padding:0 16px;background:#5b4ae8;border-radius:999px;font-size:14.5px;font-weight:800;color:#fff;cursor:pointer">Sign in</span>' +
      '</div>');
  }

  function viewOffer(s) {
    const st = state, kind = st.offerKind, lead = isLead(s);
    const copy = kind === 'vision'
      ? { title: 'Say more about it', hint: 'What you’re picturing, in your own words. It’s your idea — take the room.', ph: 'e.g. Nothing fancy. Meet in the gym lot, loop the lake, coffee after for whoever wants it.', cta: 'Add it to the spark' }
      : lead
        ? (kind === 'day'
          ? { title: 'Set the date & time', hint: 'It shows on the idea straight away.', cta: 'Set it' }
          : { title: 'Set the location', hint: 'It shows on the idea straight away.', ph: 'Enter the location', cta: 'Set it' })
        : (kind === 'day'
          ? { title: 'Got a date & time in mind?', hint: 'Pick the day and time you’re thinking of. The lead takes it from there.', cta: 'Offer this date' }
          : { title: 'Know a location?', hint: 'Somewhere this could actually happen. The lead takes it from there.', ph: 'e.g. the loop trail at the lake', cta: 'Offer this location' });
    const ready = st.offerText.trim().length > 0 && !st.busy;
    const close = () => setState({ offerKind: null, offerText: '', offerPlace: null, offerSuggest: [] });
    let field;
    if (kind === 'day') {
      field = '<input class="fld" type="datetime-local" aria-label="Date and time" min="' + todayISO() + 'T00:00" value="' + esc(st.offerText) + '" ' + onInput(e => setState({ offerText: e.target.value })) +
        ' style="width:100%;min-height:52px;' + FIELD.replace('padding:13px 16px', 'padding:12px 14px') + ';color-scheme:light">';
    } else if (kind === 'spot' && lead) {
      field = placeField('offer', { placeholder: copy.ph, style: FIELD });
    } else {
      field = '<textarea class="fld" rows="' + (kind === 'vision' ? 4 : 2) + '" maxlength="' + (kind === 'vision' ? 1000 : 80) + '" aria-label="' + esc(copy.title) + '" placeholder="' + esc(copy.ph) + '" ' + onInput(e => setState({ offerText: e.target.value })) +
        ' style="width:100%;display:block;background:#fff;border:2px solid #e6e7eb;border-radius:16px;padding:14px 16px;font-size:16px;line-height:1.4;font-weight:600;color:#0d1117;resize:none;outline:none">' + esc(st.offerText) + '</textarea>';
    }
    return modal(copy.title, close,
      h3(copy.title) + '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#6b7280">' + copy.hint + '</p>' + field +
      '<button type="button" ' + on(() => { if (ready) commitOffer(s); }) + ' aria-disabled="' + !ready + '" style="' + primary(ready) + ';margin-top:2px">' + (st.busy === 'save' ? 'Saving…' : copy.cta) + '</button>',
      { z: 25, max: 330 });
  }

  function viewJoin() {
    const st = state, ok = st.joinCode.length === 6 && !st.busy;
    return modal('Join a group', () => setState({ joinOpen: false }),
      h3('Join a group') + para('Got a code from an organiser? Enter it here.') +
      '<input class="fld" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Group code" placeholder="ABC123" value="' + esc(st.joinCode) + '" ' +
        onInput(e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); if (e.target.value !== v) e.target.value = v; setState({ joinCode: v, joinBad: false }); }) +
        ' style="' + FIELD + ';padding:14px 16px;font-size:24px;font-weight:800;letter-spacing:8px;text-align:center;text-transform:uppercase">' +
      (st.joinBad ? '<div role="alert" style="font-size:14px;line-height:1.4;font-weight:700;color:#9b1c31">That code didn’t match a group. Check it with your organiser.</div>' : '') +
      '<button type="button" ' + on(submitJoin) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">' + (st.busy === 'join' ? 'Joining…' : 'Join') + '</button>' +
      '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Organisers find their group’s code in its settings, and can share it as a link too.</p>',
      { z: 31, max: 330 });
  }

  function viewCreate() {
    const st = state, close = () => setState({ create: null, busy: null });
    if (st.create === 'done' && st.created) {
      const c = st.created, link = inviteLink(c.code);
      return modal('Start a group', close,
        I.boltSolid(30) +
        h3(esc(c.name) + ' is ready') +
        para('Share the code or link so people can join. Find it any time under Profile → Your groups.') +
        '<div style="background:#f3f1fe;border-radius:16px;padding:16px;text-align:center">' +
          '<div style="font-size:11.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#5b4ae8">Invite code</div>' +
          '<div style="margin-top:4px;font-size:30px;line-height:1;font-weight:900;letter-spacing:6px;color:#0d1117">' + esc(c.code) + '</div>' +
          '<div style="margin-top:8px;font-size:13px;font-weight:600;color:#5c6270;overflow-wrap:break-word">' + esc(link.replace(/^https?:\/\//, '')) + '</div>' +
        '</div>' +
        '<button type="button" class="hov-primary" ' + on(() => copy(link, 'Invite link copied')) + ' style="' + primary(true) + ';box-shadow:0 10px 24px rgba(91,74,232,.32)">Copy invite link</button>' +
        '<button type="button" class="hov-outline" ' + on(() => { setState({ create: null }); openGroup(groupById(c.id)); }) + ' style="' + SECONDARY + '">Go to ' + esc(c.name) + '</button>',
        { z: 31 });
    }
    const ok = st.createName.trim().length > 1 && st.busy !== 'create';
    return modal('Start a group', close,
      h3('Start a group') +
      para('A place for your people to post ideas and turn them into plans. You’ll run it, and get a code to invite others.') +
      '<input class="fld" type="text" maxlength="40" aria-label="Group name" placeholder="E.g. Mueller Neighbors" value="' + esc(st.createName) + '" ' + onInput(e => setState({ createName: e.target.value.slice(0, 40) })) + ' style="' + FIELD + ';font-size:17px;font-weight:700">' +
      '<button type="button" ' + on(submitCreate) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">' + (st.busy === 'create' ? 'Creating…' : 'Create group') + '</button>',
      { z: 31 });
  }

  function viewProfileEdit() {
    const st = state, pe = st.pe, busy = st.busy === 'profile';
    const close = () => setState({ pe: null });
    if (pe.step === 'code') {
      const ok = pe.code.length >= 6 && !busy;
      return modal('Confirm your new email', close,
        h3('Confirm your new email') +
        para('We sent a code to <strong style="font-weight:700;color:#0d1117">' + esc(pe.email) + '</strong> · <span ' + on(() => setPe({ step: 'form' })) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Change</span>') +
        codeInput(pe.code, 'Code from the email', v => setPe({ code: v })) +
        '<button type="button" ' + on(confirmPe) + ' aria-disabled="' + !ok + '" style="' + btn(ok) + '">' + (busy ? 'Confirming…' : 'Confirm') + '</button>' +
        '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Until you confirm, you keep signing in with ' + esc(st.email) + '.</p>');
    }
    const nameOk = pe.name.trim().length > 0;
    const newEmail = pe.email.trim().toLowerCase();
    const changed = !st.isGoogle && newEmail !== st.email.toLowerCase();
    const ok = nameOk && (!changed || EMAIL_OK.test(newEmail)) && !busy;
    return modal('Edit profile', close,
      h3('Edit profile') +
      '<div style="display:flex;align-items:center;gap:14px">' +
        '<span aria-hidden="true" style="flex:0 0 64px;width:64px;height:64px;border-radius:999px;background:' + (pe.avatar ? bg(pe.avatar.url) : '#e8a71c') + ';color:#fff;font-size:26px;font-weight:900;display:flex;align-items:center;justify-content:center">' + (pe.avatar ? '' : esc(initialOf(pe.name) || '?')) + '</span>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px 14px">' +
          '<label style="display:flex;align-items:center;min-height:32px;font-size:15px;font-weight:800;color:#5b4ae8;cursor:pointer">' + (pe.avatar ? 'Change photo' : 'Add a photo') +
            '<input type="file" accept="image/*" aria-label="Profile photo" ' + onInput(e => { if (e.type !== 'change') return; const f = Array.from(e.target.files || []); e.target.value = ''; onPeAvatar(f); }) + ' style="display:none"></label>' +
          (pe.avatar ? '<span ' + on(() => setPe({ avatar: null })) + ' style="display:flex;align-items:center;min-height:32px;font-size:15px;font-weight:800;color:#6b7280;cursor:pointer">Remove</span>' : '') +
        '</div>' +
      '</div>' +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:800;color:#454b55">Name</span>' +
        '<input class="fld" type="text" maxlength="30" autocomplete="given-name" placeholder="First name" value="' + esc(pe.name) + '" ' + onInput(e => setPe({ name: e.target.value.slice(0, 30) })) + ' style="' + FIELD + '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:800;color:#454b55">Email</span>' +
        (st.isGoogle
          ? '<div style="' + FIELD + ';background:#f7f7f9;border-color:#f2f3f6;color:#6b7280;overflow-wrap:anywhere">' + esc(st.email) + '</div><span style="font-size:13px;line-height:1.4;font-weight:500;color:#6b7280">From your Google account.</span>'
          : '<input class="fld" type="email" inputmode="email" autocomplete="email" maxlength="80" value="' + esc(pe.email) + '" ' + onInput(e => setPe({ email: e.target.value.slice(0, 80) })) + ' style="' + FIELD + '">' +
            '<span style="font-size:13px;line-height:1.4;font-weight:500;color:#6b7280">Change it and we’ll send a code to the new address.</span>') +
      '</label>' +
      '<button type="button" ' + on(() => { if (ok) savePe(); }) + ' aria-disabled="' + !ok + '" style="' + btn(ok) + '">' + (busy ? 'Saving…' : changed ? 'Save and send code' : 'Save') + '</button>');
  }

  function viewConfirm() {
    const c = state.confirm;
    return modal(c.title, null,
      '<h3 style="margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + esc(c.title) + '</h3>' +
      '<p style="margin:0;font-size:15px;line-height:1.45;font-weight:500;color:#454b55">' + esc(c.body) + '</p>' +
      '<div style="margin-top:4px;display:flex;flex-direction:column;gap:8px">' +
        '<button type="button" ' + on(() => { if (!state.busy) c.run(); }) + ' style="' + primary(true) + ';background:' + (c.danger ? '#9b1c31' : '#5b4ae8') + '">' + esc(c.cta) + '</button>' +
        '<button type="button" ' + on(() => setState({ confirm: null })) + ' style="' + SECONDARY + '">' + esc(c.keep) + '</button>' +
      '</div>',
      { z: 34, role: 'alertdialog', max: 330 });
  }

  // The lead's list of who's interested, with guests' numbers (not in the design yet)
  function viewInterestList(s) {
    const close = () => setState({ interestList: false });
    return modal('Who’s interested', close,
      h3('Who’s interested') +
      para('Only you see phone numbers. They’re from people who took part without an account.') +
      '<div style="display:flex;flex-direction:column">' +
        s.interested.map((u, i) => {
          const c = s.contacts.find(x => x.user_id === u);
          const name = c ? c.name : nameOf(u);
          return '<div style="display:flex;align-items:center;gap:12px;min-height:52px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + '">' +
            face(u, name, 32, FACE_COLORS[i % 3]) +
            '<span style="flex:1 1 auto;min-width:0;font-size:15.5px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</span>' +
            (c ? '<a href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '" style="flex:0 0 auto;font-size:14px;font-weight:800;color:#5b4ae8">' + esc(c.phone) + '</a>' : '') +
          '</div>';
        }).join('') +
      '</div>');
  }

  function viewToast() {
    const t = state.toast;
    return '<div role="status" style="position:absolute;left:14px;right:14px;bottom:calc(var(--nav-h) + 12px);z-index:40;display:flex;justify-content:center;pointer-events:none">' +
      '<div style="display:flex;align-items:flex-start;gap:10px;max-width:100%;background:#0d1117;border-radius:14px;padding:13px 16px;box-shadow:0 12px 30px rgba(15,18,25,.3);animation:popIn 240ms cubic-bezier(.22,.9,.28,1) both">' +
        (t.ok
          ? '<span style="flex:0 0 18px;width:18px;height:18px;margin-top:1px;border-radius:999px;background:#149a4b;display:flex;align-items:center;justify-content:center">' + I.check(10, '#fff', 4) + '</span>'
          : '<span style="flex:0 0 18px;width:18px;height:18px;margin-top:1px;border-radius:999px;background:#e2556b;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center">!</span>') +
        '<span style="font-size:14.5px;line-height:1.35;font-weight:700;color:#fff">' + esc(t.text) + '</span>' +
      '</div></div>';
  }

  // ---------------------------------------------------------------------------
  // Tab bar and the whole view
  // ---------------------------------------------------------------------------

  function viewNav() {
    const s = state.screen;
    const tab = (active, label, icon, fn) => '<div ' + on(fn) + ' aria-label="' + label + '"' + (active ? ' aria-current="page"' : '') +
      ' style="padding:9px 0;min-height:44px;display:flex;align-items:center;justify-content:center;width:100%;color:' + (active ? '#5b4ae8' : '#5c6270') + ';cursor:pointer">' + icon + '</div>';
    return '<nav class="tabbar" aria-label="Main">' +
      tab(s === 'home', 'Home', I.tabHome, () => go('home')) +
      tab(s === 'how', 'How this works', I.tabHow, () => go('how')) +
      '<div ' + on(goCompose) + ' aria-label="Post an idea" style="width:44px;height:44px;border-radius:999px;background:#5b4ae8;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(91,74,232,.3);cursor:pointer">' + I.plus(23, '#fff', 2.5) + '</div>' +
      tab(s === 'browse', 'All ideas', I.tabAll, () => go('browse')) +
      tab(s === 'profile' || s === 'groupPage', 'Profile', I.tabProfile, () => needSignIn(() => go('profile'), 'profile')) +
    '</nav>';
  }

  // Full-screen photo (the vibe photos): tap anywhere or ✕ to close, arrows between them
  function viewZoom() {
    const z = state.zoom, n = z.photos.length, close = () => setState({ zoom: null });
    const step = (d) => (e) => { stop(e); setState({ zoom: { photos: z.photos, i: (z.i + d + n) % n } }); };
    const arrow = (d, label, path) => '<span ' + on(step(d)) + ' aria-label="' + label + '" style="position:absolute;top:50%;' + (d < 0 ? 'left' : 'right') + ':12px;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;cursor:pointer">' + path + '</span>';
    return '<div role="dialog" aria-modal="true" aria-label="Photo" data-scrim="' + reg(close) + '" style="position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;animation:fadeIn 160ms ease both;cursor:zoom-out">' +
      '<img src="' + esc(z.photos[z.i]) + '" alt="Mood photo ' + (z.i + 1) + ' of ' + n + '" data-scrim="' + reg(close) + '" style="max-width:100%;max-height:100%;object-fit:contain;display:block">' +
      '<span ' + on(close) + ' aria-label="Close" style="position:absolute;top:max(14px, env(safe-area-inset-top));right:14px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(16, '#fff', 2.6) + '</span>' +
      (n > 1
        ? arrow(-1, 'Previous photo', I.chevL(18, '#fff', 2.4)) + arrow(1, 'Next photo', I.chevR(18, '#fff', 2.4)) +
          '<span style="position:absolute;bottom:max(18px, env(safe-area-inset-bottom));left:0;right:0;text-align:center;font-size:13px;font-weight:700;color:rgba(255,255,255,.75)">' + (z.i + 1) + ' / ' + n + '</span>'
        : '') +
    '</div>';
  }

  function view() {
    const st = state, s = st.screen, subj = subject();
    const home = () => st.email ? viewHome() : viewWelcome();
    let main;
    if (s === 'browse') main = viewBrowse();
    else if (s === 'how') main = viewHow();
    else if (s === 'profile') main = st.email ? viewProfile() : home();
    else if (s === 'groupPage') main = st.email ? viewGroupPage() : home();
    else if ((s === 'detail' || s === 'edit') && subj) main = viewDetail(subj);
    else if (s === 'detail' && !st.loaded) main = '<div style="padding:40px 20px;font-size:15px;font-weight:600;color:#6b7280">Loading…</div>';
    else if (s === 'compose') main = st.email ? viewHome() : viewWelcome();
    else main = home();

    return '<div class="scroller">' + main + '</div>' +
      (s === 'compose' ? viewCompose() : '') +
      (s === 'edit' && subj ? viewEdit(subj) : '') +
      (st.offerKind && subj ? viewOffer(subj) : '') +
      (st.interestList && subj ? viewInterestList(subj) : '') +
      (st.guestOpen ? viewGuest() : '') +
      (st.nameAsk ? viewName() : '') +
      (st.pe ? viewProfileEdit() : '') +
      (st.create ? viewCreate() : '') +
      (st.joinOpen ? viewJoin() : '') +
      (st.loginStep ? viewLogin() : '') +
      (st.confirm ? viewConfirm() : '') +
      (st.zoom ? viewZoom() : '') +
      (st.toast ? viewToast() : '') +
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
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName ||
        (from.nodeName === 'INPUT' && from.type !== to.getAttribute('type') && to.getAttribute('type'))) {
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
    if (isField(from) && document.activeElement !== from && from.type !== 'file') {
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
    // Clicking outside a menu closes it
    if (state.menu && !e.target.closest('[data-menu]')) setState({ menu: null });
    if (fn) fn(e);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.zoom) return setState({ zoom: null });
      if (state.confirm) return setState({ confirm: null });
      if (state.loginStep) return closeLogin();
      if (state.joinOpen) return setState({ joinOpen: false });
      if (state.create) return setState({ create: null });
      if (state.pe) return setState({ pe: null });
      if (state.nameAsk) return setState({ nameAsk: null, nameText: '' });
      if (state.guestOpen) return setState({ guestOpen: false, guestThen: null });
      if (state.offerKind) return setState({ offerKind: null, offerText: '' });
      if (state.interestList) return setState({ interestList: false });
      if (state.menu) return setState({ menu: null });
    }
    if (state.zoom && state.zoom.photos.length > 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const z = state.zoom, n = z.photos.length;
      return setState({ zoom: { photos: z.photos, i: (z.i + (e.key === 'ArrowLeft' ? -1 : 1) + n) % n } });
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

  // An invite link (/join/CODE): fill the code in, and open Join for someone signed in
  const takeInvite = (code) => {
    if (!code) return;
    if (JOIN_PATH.test(location.pathname) || /^#\/join\//.test(location.hash)) history.replaceState(null, '', '/');
    setState({ joinCode: code, joinBad: false });
    if (state.email) setState({ joinOpen: true });
  };

  // Back/forward buttons fire popstate; a link opened or pasted in the same tab only fires hashchange
  const followUrl = () => {
    const target = fromUrl();
    if (target.inviteCode) { takeInvite(target.inviteCode); return; }
    if (target.screen === state.screen && target.subjectId === state.subjectId && target.gpId === state.gpId) return;
    setState(Object.assign({ menu: null, offerKind: null, nameAsk: null, confirm: null, loginStep: null, loginThen: null, interestList: false }, target));
    const sc = scroller();
    if (sc) sc.scrollTop = 0;
    if (state.me) loadForRoute().catch(e => console.error(e));
  };
  window.addEventListener('popstate', followUrl);
  window.addEventListener('hashchange', followUrl);

  const refresh = () => {
    if (!state.me || state.busy || document.hidden) return;
    loadFresh()
      .then(() => { if (state.error === 'load') setState({ error: null }); })
      .catch(e => { console.error(e); if (!state.loaded || state.error) setState({ error: 'load', loaded: true }); });
  };
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 30000);   // picks up other people's posts; also retries after "Couldn't load"

  async function init() {
    if (!sb) { setState({ error: 'load', loaded: true }); return; }
    // Supabase signs the session out when a token refresh fails; replace it right away
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !reauthing) {
        setTimeout(() => { ensureSession().then(() => loadAll()).catch(e => console.error(e)); }, 0);
      }
    });
    const invite = fromUrl().inviteCode;
    try {
      await ensureSession();
      if (await finishGoogle().catch(e => { console.error(e); return false; })) return;
      await loadForRoute();
      if (invite) takeInvite(invite);
      if (state.screen === 'profile' && !state.email) openLogin('profile', () => go('profile'));
    } catch (e) {
      console.error(e);
      setState({ error: 'load', loaded: true });
    }
  }

  Object.assign(state, fromUrl());
  delete state.inviteCode;
  render();
  init();
})();
