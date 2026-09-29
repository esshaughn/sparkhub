/* Spark Hub
   Built from the Claude Design handoff "Spark Torrez - Full Site 3" (design_handoff_spark_hub:
   Spark Hub App.dc.html). One app, many groups; Torrez Fitness is one of them.

   Rendering: each state change re-renders the view to an HTML string and morphs
   it into the live DOM (keeps focus, caret and scroll position intact).
   Event handlers are registered per render and referenced by index via
   data-on / data-input attributes.

   Data: Supabase (see supabase/migrations/; js/config.js picks live vs test).
   Every visitor gets an anonymous session. Signing in (email code or Google)
   is needed to post, to join or start a group, and for Profile. Row-level
   security decides who sees a group's ideas (its members, plus anyone holding
   one idea's link) and who sees a guest's phone number (that idea's lead). */

(function () {
  'use strict';

  const SORTS = [['popular', 'Most popular'], ['soon', 'Happening soon'], ['new', 'Newest'], ['old', 'Oldest']];
  const VIEWS = ['tiles', 'list', 'grid'];
  const SCHED_VIEWS = ['tiles', 'list'];           // v6 Your schedule (Grid is gone there)
  const CVIEWS = ['list', 'tiles', 'month'];       // v6 Calendar
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
  // "View as a tester" (demo admin only) is look-only: while it's on, nothing but reads leaves the app
  let previewing = false;
  const READ_RPCS = /\/rest\/v1\/rpc\/(my_group_sizes|demo_testers)(\?|$)/;
  const guardedFetch = (url, opts) => {
    const m = String((opts && opts.method) || 'GET').toUpperCase(), u = String((url && url.url) || url);
    if (previewing && m !== 'GET' && m !== 'HEAD' && !/\/auth\/v1\//.test(u) && !READ_RPCS.test(u))
      return Promise.resolve(new Response(JSON.stringify({ message: 'Viewing as a tester: changes are off' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    return fetch(url, opts);
  };
  const sb = window.supabase && CFG.supabaseUrl
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { flowType: 'pkce' }, global: { fetch: guardedFetch } })
    : null;

  // The last data a signed-in person saw, shown straight away on the next open while fresh data
  // loads (so the app never looks empty between sessions). Per database, and only used for the
  // same account; guests' phone numbers are left out; cleared on sign-out.
  const REF = CFG && CFG.supabaseUrl ? new URL(CFG.supabaseUrl).host.split('.')[0] : 'none';
  const CACHE_KEY = 'spark-hub-cache-' + REF;
  const signedInUser = () => {   // who the saved Supabase session belongs to, read without waiting on the network
    try {
      const t = JSON.parse(localStorage.getItem('sb-' + REF + '-auth-token'));
      const u = t && t.user;
      return u && !u.is_anonymous && u.email ? u : null;
    } catch (e) { return null; }
  };
  const readCache = (uid) => {
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); return c && c.me === uid ? c : null; } catch (e) { return null; }
  };
  const writeCache = () => {
    if (state.viewAs || !state.email || !state.loaded || state.error) return;
    const sparks = state.sparks.map(s => Object.assign({}, s, { contacts: s.contacts.map(c => ({ spark_id: c.spark_id, user_id: c.user_id, name: c.name })) }));
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ me: state.me, email: state.email, isGoogle: state.isGoogle, myName: state.myName, myAvatar: state.myAvatar, myPlace: state.myPlace, myBio: state.myBio, memberSince: state.memberSince,
        groups: state.groups, sparks, profiles: state.profiles, sizes: state.sizes, notif: state.notif, demoAdmin: state.demoAdmin, at: Date.now() }));
    } catch (e) { /* storage full or blocked: the app just loads as before */ }
  };
  const clearCache = () => { try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* blocked */ } };

  // Only conveniences live in the browser: current group, view, sort, and a guest's name + number
  const PREFS_KEY = 'spark-hub-prefs';
  const loadPrefs = () => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
  };
  let lastPrefs = '';
  const savePrefs = () => {
    const next = JSON.stringify({ groupId: state.groupId, view: state.view, homeView: state.homeView, cView: state.cView, sort: state.sort, guestName: state.guestName, guestPhone: state.guestPhone, pastStatsHidden: state.pastStatsHidden, jobsOpen: state.jobsOpen });
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

  // Per-render handler registry. Ids carry the render they belong to ("gen.index"), so an
  // event from an element that has just been removed (e.g. a late "change" on a text box)
  // can't reach whatever handler now has the same index.
  let H = [], GEN = 0;
  const reg = (fn) => { H.push(fn); return GEN + '.' + (H.length - 1); };
  const handlerFor = (id) => { const [g, i] = String(id || '').split('.'); return +g === GEN ? handlers[+i] : null; };
  const on = (fn, role) => 'data-on="' + reg(fn) + '" role="' + (role || 'button') + '" tabindex="0"';
  const onInput = (fn) => 'data-input="' + reg(fn) + '"';
  const stop = (e) => { if (e && e.stopPropagation) e.stopPropagation(); };

  // ---------------------------------------------------------------------------
  // Icons (inline SVG, from the design file)
  // ---------------------------------------------------------------------------

  const svg = (size, attrs, body) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true" ' + attrs + '>' + body + '</svg>';
  const stroke = (color, w) => 'fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"';
  const I = {
    bolt: (size, fill) => svg(size, 'fill="none"', '<path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z" fill="' + fill + '" stroke="' + fill + '" stroke-width="1.7" stroke-linejoin="round"/>'),
    boltRays: (size) => svg(size, 'fill="none"', '<path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z" fill="#f3c55a" stroke="#f3c55a" stroke-width="1.7" stroke-linejoin="round"/><path d="M4.6 4.6 6.9 7.2" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/><path d="M1.9 15.2 5.1 14.9" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/><path d="M19.4 4.6 17.1 7.2" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/><path d="M22.1 15.2 18.9 14.9" stroke="#e8a71c" stroke-width="1.1" stroke-linecap="round"/>'),
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
    camera2: svg(14, stroke('#fff', 2.2), '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><circle cx="12" cy="12.5" r="3.2"/><path d="M9 6l1.2-2h3.6L15 6"/>'),
    keypad: (size) => svg(size, stroke('#5b4ae8', 2.2), '<rect x="4" y="7" width="16" height="11" rx="2.5"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 14.5h8"/>'),
    offline: svg(16, stroke('#9b1c31', 2.2), '<path d="M4.5 9.5a11 11 0 0 1 15 0M7.5 13a6.5 6.5 0 0 1 9 0"/><circle cx="12" cy="17" r="1.2" fill="#9b1c31"/><path d="M4 4l16 16"/>'),
    tabTicket: svg(23, stroke('currentColor', 1.9), '<path d="M4 8.5V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v2.5a2.5 2.5 0 0 0 0 5V16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16v-2.5a2.5 2.5 0 0 0 0-5Z" transform="translate(0 1)"/><path d="m9.2 12.2 2 2 3.8-4"/>'),
    tabSquares: svg(23, stroke('currentColor', 1.9), '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>'),
    google: '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style="flex:0 0 20px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const prefs = loadPrefs();
  // Create event (v6 Update 6): the flow's fields, its step, and its sheets (one at a time)
  const blankCompose = () => ({
    evStep: 'title', activity: '', photos: [], evPhotoPath: null, coverPos: null,
    evDate: '', evTime: '', evEnd: '', evEndOn: false, timeOpen: null,
    locMode: 'specific', locText: '', locPlace: null, locSuggest: [],
    evBits: ['', '', ''], evNeeds: [], evDatePoll: null, evSpotPoll: null, evLater: {},
    evPriv: false, evGroups: null, evDraftId: null, evLeave: false, pollSheet: null, needSheet: null
  });
  const state = Object.assign({
    screen: 'calendar', menu: null, subjectId: null, gpId: null, tag: null, zoom: null, membersOpen: null, membersList: null,
    sort: SORTS.some(s => s[0] === prefs.sort) ? prefs.sort : 'popular',
    view: VIEWS.indexOf(prefs.view) > -1 ? prefs.view : 'tiles',                 // a group's page
    homeView: SCHED_VIEWS.indexOf(prefs.homeView) > -1 ? prefs.homeView : 'tiles',   // Your schedule
    groupId: prefs.groupId || null,

    me: null, email: '', isGoogle: false, myName: '', myAvatar: null,
    loaded: false, fromCache: false, error: null, busy: null, toast: null, goneOpen: false,

    groups: [], sparks: [], profiles: {},

    drafts: [], notes: [], pushOn: false, pushCardHidden: (() => { try { return localStorage.getItem('spark-hub-push-card') === 'hidden'; } catch (e) { return false; } })(),
    canInstall: false, installPop: false, sec: null, needEd: null, share: null,

    loginStep: null, loginFrom: 'default', loginThen: null, loginMode: 'link', loginEmail: '', loginCode: '',
    resent: false, mergeToken: null, googleFailed: false,
    nameAsk: null, nameText: '',
    guestOpen: false, guestThen: null, guest: null,
    guestName: prefs.guestName || '', guestPhone: prefs.guestPhone || '',
    offerKind: null, offerText: '', offerPlace: null, offerSuggest: [],
    joinOpen: false, joinCode: '', joinBad: false,
    notif: { allReadAt: 0, read: [], topics: {}, email: true, loaded: false }, nFilter: 'all', nSettings: false, demoAdmin: false, ownTab: 'plan', back: null, myPlace: '', myBio: '', memberSince: null, ownGrp: null, taskOpen: {}, sizes: {}, membersQ: '', gpRename: null, gpDel: null, ph: null,
    startName: null, phaseTab: 'plan', sigDraft: '', sigNeed: '', sigTime: '', blast: null, prepEdit: null, prepText: '', invite: null,
    pe: null, confirm: null, interestList: false, thanksList: false,
    gpCode: '', gpMembers: null,
    // v6: Profile / Notifications are sheets; Your tasks' "View all", expansions, the RSVP ask
    profSheet: false, notifSheet: false, dashAll: null, dashOpen: {}, schedOpen: {}, shiftPick: null, banner: null, sigAdding: false,
    // v6 Calendar: search, filters, sort, view, month, discovery cards
    cq: '', cSearch: false, cGrps: null, cTypes: [], cSort: 'soon', cView: CVIEWS.indexOf(prefs.cView) > -1 ? prefs.cView : 'list',
    cMon: null, cDay: null, cWildHidden: false, cNeedsHidden: false, cHandSheet: false,
    // v6 Update 2: search's Try chips; Your schedule and group pages' Sort · Filter; a group's search
    cTry: null, cWhen: 'any', cHelp: false, sSort: 'soon', sFilt: [], gSort: 'soon', gFilt: [], iSort: 'interest', pastStatsHidden: prefs.pastStatsHidden || {}, jobsOpen: prefs.jobsOpen || {}, descOpen: {}, viewAs: null, testers: null, gSearch: false, gq: '', gTry: null
  }, blankCompose());

  // ---- URL <-> screen, so ideas and invites can be shared and the back button works

  const hashFor = () => {
    const s = state.screen;
    if (s === 'detail' && state.subjectId) return '#/idea/' + state.subjectId;
    if (s === 'groupPage' && state.gpId) return '#/group/' + state.gpId;
    // The Calendar is the home screen (owner, 2026-09-27); Your tasks has its own link
    const plain = { calendar: '', home: '#/tasks', sched: '#/schedule', browse: '#/ideas', how: '#/how', own: '#/own', groups: '#/groups' };
    return plain[s] != null ? plain[s] : null;
  };
  const syncHash = () => {
    const h = hashFor();
    if (h === null || (location.hash || '') === h) return;   // compose / edit keep the current URL
    history.pushState(null, '', h || location.pathname + location.search);
  };
  const JOIN_PATH = /^\/join\/([A-Za-z0-9]{6})\/?$/;
  const IDEA_PATH = /^\/i\/([0-9a-f-]{36})\/?$/;   // shared idea links (a real path so chat apps can preview them)
  const fromUrl = () => {
    const h = location.hash;
    let m = h.match(/^#\/idea\/([0-9a-f-]{36})$/) || (!h && location.pathname.match(IDEA_PATH));
    if (m) return { screen: 'detail', subjectId: m[1], tag: null };
    m = h.match(/^#\/group\/([0-9a-f-]{36})$/);
    if (m) return { screen: 'groupPage', gpId: m[1] };
    m = h.match(/^#\/join\/([A-Za-z0-9]{6})$/) || location.pathname.match(JOIN_PATH);
    if (m) return { screen: 'calendar', inviteCode: m[1].toUpperCase() };
    if (h === '#/ideas') return { screen: 'browse' };
    if (h === '#/how') return { screen: 'how' };
    if (h === '#/calendar') return { screen: 'calendar' };
    if (h === '#/schedule') return { screen: 'sched' };
    if (h === '#/tasks') return { screen: 'home' };
    if (h === '#/own') return { screen: 'own' };
    if (h === '#/groups') return { screen: 'groups' };
    // v6: Profile and Notifications are sheets over the Calendar
    if (h === '#/notifications') return { screen: 'calendar', notifSheet: true };
    if (h === '#/me') return { screen: 'calendar', profSheet: true };
    return { screen: 'calendar' };
  };

  const setState = (patch) => {
    const prevStep = state.evStep, prevScreen = state.screen, prevSubj = state.subjectId, prevGp = state.gpId;
    Object.assign(state, patch);
    savePrefs();
    render();
    if (state.evStep !== prevStep) {
      const ov = document.querySelector('.overlay-screen');
      if (ov) ov.scrollTop = 0;
    }
    if (state.screen !== prevScreen || state.subjectId !== prevSubj || state.gpId !== prevGp) syncHash();
  };

  const scroller = () => document.querySelector('.scroller');
  // Screens an event page can come back to, with their scroll position; anywhere else falls back to the group's page
  const ORIGINS = ['home', 'sched', 'own', 'calendar', 'groups', 'browse'];
  const go = (screen, extra) => {
    const sc = scroller();
    if (screen === 'detail' && state.screen !== 'detail') {
      state.back = ORIGINS.indexOf(state.screen) > -1 ? { screen: state.screen, groupId: state.groupId, phaseTab: state.phaseTab, ownTab: state.ownTab, scroll: sc ? sc.scrollTop : 0 } : null;
    }
    // Going anywhere closes the v6 sheets (Profile, Notifications, View all, Could use a hand, Search)
    setState(Object.assign({ screen, menu: null, zoom: null, sec: null, needEd: null, share: null, profSheet: false, notifSheet: false, dashAll: null, cHandSheet: false, cSearch: false, cq: '', gSearch: false, gq: '', gTry: null }, extra || {}));
    if (sc) sc.scrollTop = 0;
  };

  let toastTimer = null;
  const toast = (text, ok) => {
    setState({ toast: { text, ok: !!ok } });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setState({ toast: null }), 3500);
  };
  // The invite flow's larger toast ("You’re already in {group}"), 3s
  const toastIn = (text) => {
    setState({ toast: { text, ok: true, big: true } });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setState({ toast: null }), 3000);
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
    return mine.find(g => g.id === state.groupId) || mine.find(g => runs(g)) || mine[0] || null;
  };
  // Owners are admins too (and also decide who the admins are)
  const runs = (g) => !!g && (g.role === 'admin' || g.role === 'owner');
  const ROLE_WORD = { owner: 'Owner', admin: 'Admin', member: 'Member' };
  const roleBadge = (role, extra) => '<span aria-label="You’re ' + (role === 'owner' ? 'an owner' : 'an admin') + '" style="flex:0 0 auto;border-radius:999px;padding:2px 7px;' +
    (role === 'owner' ? 'background:#ece9fd;color:#4a3ad4' : 'background:#fdf1d6;color:#8f6405') + ';font-size:11px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;' + (extra || '') + '">' + ROLE_WORD[role] + '</span>';
  const isLead = (s) => !!s && !!state.me && s.leadId === state.me;
  // The lead, or an admin of the idea's group, can edit or delete it
  const isGroupAdmin = (s) => { const g = s && groupById(s.groupId); return runs(g); };
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
  // Home → Your groups order: pinned first, then most recently opened
  const groupsInOrder = () => myGroups().slice().sort((a, b) => b.pinned - a.pinned || b.lastSeen - a.lastSeen || a.name.localeCompare(b.name));

  const dayOf = (s) => s.dayDate ? { day: fmtDay(s.dayDate), time: fmtTime(s.dayTime) } : (s.dayText ? { day: s.dayText, time: '' } : null);

  const visible = (phase) => {
    const g = currentGroup(), ph = phase || state.phaseTab;
    const out = state.sparks.filter(s => g && inGroup(s, g.id) && (ph === 'all' || phaseOf(s) === ph));
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

  // ---------------------------------------------------------------------------
  // Data (Supabase)
  // ---------------------------------------------------------------------------

  // Plan data grouped by idea (RSVPs, votes, sign-ups, updates, organizers, album, the lead's prep)
  const byKey = (rows, key) => { const m = {}; (rows || []).forEach(r => { (m[r[key]] = m[r[key]] || []).push(r); }); return m; };
  // Sign-ups (v6 Update 5). `signups` is every spot people can claim: plain jobs, and each shift of a
  // job that has shifts (a shift row points at its job with shift_of and carries the job's name).
  // `jobs` is what the event page lists: plain jobs, and shift jobs with their `shifts`.
  const hm = (t) => t ? String(t).slice(0, 5) : null;
  const toSignups = (rows, claims) => {
    const unit = (i, job) => ({ id: i.id, item: i.item, need: i.need || null, time: hm(i.time), endTime: hm(i.end_time), desc: i.descr || '', jobId: job ? job.id : null,
      createdBy: i.created_by, claims: (claims[i.id] || []).map(c => ({ userId: c.user_id, note: c.note || '', created: Date.parse(c.created_at) })) });
    const byAge = rows.slice().sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || String(a.time || '').localeCompare(String(b.time || '')));
    const kids = byKey(byAge.filter(i => i.shift_of), 'shift_of');
    const signups = [], jobs = [];
    byAge.filter(i => !i.shift_of).forEach(i => {
      if (!kids[i.id]) { const u = unit(i); signups.push(u); jobs.push(u); return; }
      const job = { id: i.id, item: i.item, desc: i.descr || '', createdBy: i.created_by, shifts: [] };
      kids[i.id].sort((a, b) => String(a.time || '').localeCompare(String(b.time || ''))).forEach(k => { const u = unit(k, job); u.desc = u.desc || job.desc; job.shifts.push(u); signups.push(u); });
      job.time = job.shifts[0].time; job.endTime = job.shifts[job.shifts.length - 1].endTime || null;
      job.need = job.shifts.reduce((a, u) => a + (u.need || 0), 0) || null;
      job.claims = [].concat(...job.shifts.map(u => u.claims));
      jobs.push(job);
    });
    return { signups, jobs };
  };
  // "5:00 – 6:00pm", "8:30am"; a shift job: "2 shifts · 6:00 – 8:00pm"
  const spanTime = (it) => {
    if (!it || !it.time) return '';
    if (!it.endTime) return fmtTime(it.time);
    const a = fmtTime(it.time), b = fmtTime(it.endTime), am = (t) => +t.slice(0, 2) < 12;
    const whole = (t) => { const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + pad2(m); };
    return (am(it.time) === am(it.endTime) ? whole(it.time) : a) + ' – ' + whole(it.endTime) + (am(it.endTime) ? 'am' : 'pm');
  };
  const jobTime = (j) => j.shifts ? j.shifts.length + (j.shifts.length === 1 ? ' shift' : ' shifts') +(j.time ? ' · ' + spanTime(j) : '') : spanTime(j);
  const toSpark = (row, offers, interests, contacts, x) => ({
    id: row.id, groupId: row.group_id, text: row.text,
    groupIds: [row.group_id].concat((x.groups[row.id] || []).map(g => g.group_id).filter(g => g !== row.group_id)),
    hopes: (row.hopes || []).filter(Boolean),
    createdBy: row.created_by, created: Date.parse(row.created_at),
    leadId: row.lead_id, leadName: row.lead_name || row.author_name || 'Someone',
    spot: row.spot || '', spotAddress: row.spot_address || '',
    spotPoint: Number.isFinite(row.spot_lat) && Number.isFinite(row.spot_lon) ? [row.spot_lat, row.spot_lon] : null,
    dayDate: row.day_date || null, dayTime: row.day_time ? String(row.day_time).slice(0, 5) : null, dayEnd: row.day_end ? String(row.day_end).slice(0, 5) : null,
    dayText: row.day_date ? '' : (row.day || ''),
    vision: row.vision || '',
    photoPaths: (row.photos || []).filter(p => PHOTO_PATH.test(p)),
    coverPos: row.cover_pos || null,
    mood: (row.mood || []).filter(p => PHOTO_PATH.test(p)),
    offers: offers.filter(o => o.spark_id === row.id && o.status === 'accepted')
      .map(o => ({ userId: o.user_id, who: o.who, kind: o.kind, body: o.body })),
    pending: offers.filter(o => o.spark_id === row.id && o.status === 'pending')
      .map(o => ({ id: o.id, userId: o.user_id, who: o.who, kind: o.kind, body: o.body })),
    interested: interests.filter(i => i.spark_id === row.id).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(i => i.user_id),
    interestAt: interests.filter(i => i.spark_id === row.id).reduce((m, i) => { m[i.user_id] = Date.parse(i.created_at); return m; }, {}),
    contacts: contacts.filter(c => c.spark_id === row.id),
    demo: !!row.demo,   // seeded demo content; never shown, only counted for the owner's wipe
    planned: !!row.planned, visibility: row.visibility || 'group', autoRemind: row.auto_remind !== false, minPeople: row.min_people || null,
    rsvps: (x.rsvps[row.id] || []).map(r => ({ userId: r.user_id, status: r.status, created: Date.parse(r.created_at) })),
    dateOpts: (x.dateOpts[row.id] || []).map(o => ({ id: o.id, dayDate: o.day_date, dayTime: o.day_time ? String(o.day_time).slice(0, 5) : null, who: o.who, createdBy: o.created_by, created: Date.parse(o.created_at), votes: (x.dateVotes[o.id] || []).map(v => v.user_id) })),
    spotOpts: (x.spotOpts[row.id] || []).map(o => ({ id: o.id, name: o.name, address: o.address || '', lat: o.lat, lon: o.lon, who: o.who, createdBy: o.created_by, created: Date.parse(o.created_at), votes: (x.spotVotes[o.id] || []).map(v => v.user_id) })),
    ...toSignups(x.signups[row.id] || [], x.claims),
    updates: (x.updates[row.id] || []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(u => ({ id: u.id, body: u.body, audience: u.audience, created: Date.parse(u.created_at) })),
    organizers: (x.organizers[row.id] || []).map(o => o.user_id),
    organizerAt: (x.organizers[row.id] || []).reduce((m, o) => { m[o.user_id] = Date.parse(o.created_at); return m; }, {}),
    album: (x.album[row.id] || []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).filter(a => PHOTO_PATH.test(a.path)).map(a => ({ id: a.id, path: a.path, createdBy: a.created_by })),
    prep: (x.prep[row.id] || [])[0] ? x.prep[row.id][0].answers || {} : {},
    reactions: (x.reactions[row.id] || []).map(r => ({ userId: r.user_id, kind: r.kind }))
  });

  const offerText = (o) => o.kind === 'day' && /^\d{4}-\d{2}-\d{2}/.test(o.body)
    ? fmtDay(o.body.slice(0, 10)) + (o.body.length > 10 ? ', ' + fmtTime(o.body.slice(11, 16)) : '')
    : o.body;

  const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

  let loadSeq = 0, loadWritten = 0;   // loads overlap (30s refresh, a write's reload); older data never lands over newer
  async function loadAll() {
    if (!sb) return;
    const seq = ++loadSeq, t0 = performance.now();
    diagNote('load started');
    const [mem, grp, sp, of, it, gc, rs, dop, dvo, sop, svo, sui, scl, upd, org, alb, prp, rct, sgr, drf, nts] = await Promise.all([
      sb.from('memberships').select('group_id,role,last_seen_at,pinned'),
      sb.from('groups').select('id,name,photo,photo_pos'),
      sb.from('sparks').select('*').order('created_at', { ascending: false }),
      sb.from('offers').select('*').order('created_at'),
      sb.from('interests').select('spark_id,user_id,created_at'),
      sb.from('guest_contacts').select('spark_id,user_id,name,phone'),
      sb.from('rsvps').select('spark_id,user_id,status,created_at'),
      sb.from('date_options').select('id,spark_id,day_date,day_time,who,created_by,created_at'),
      sb.from('date_votes').select('option_id,user_id'),
      sb.from('spot_options').select('id,spark_id,name,address,lat,lon,who,created_by,created_at'),
      sb.from('spot_votes').select('option_id,user_id'),
      // Descriptions, end times and shifts came with v6 Update 5; a database without them still loads
      sb.from('signup_items').select('id,spark_id,item,need,time,end_time,descr,shift_of,created_by,created_at')
        .then(r => r.error && r.error.code === '42703' ? sb.from('signup_items').select('id,spark_id,item,need,time,created_by,created_at') : r),
      sb.from('signup_claims').select('item_id,user_id,note,created_at'),
      sb.from('plan_updates').select('id,spark_id,body,audience,created_at'),
      sb.from('organizers').select('spark_id,user_id,created_at'),
      sb.from('album_photos').select('id,spark_id,path,created_by,created_at'),
      sb.from('plan_prep').select('spark_id,answers'),
      sb.from('reactions').select('spark_id,user_id,kind'),
      // v6 Update 6: extra groups an event is posted to, and your drafts (a database without them still loads)
      sb.from('spark_groups').select('spark_id,group_id'),
      state.email ? sb.from('event_drafts').select('id,data,updated_at').order('updated_at', { ascending: false }) : Promise.resolve({ data: [] }),
      // v6 Update 7: notes about events and jobs that were taken down (a database without them still loads)
      state.email ? sb.from('notes').select('id,body,created_by,created_at').order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] })
    ]);
    [mem, grp, sp, of, it, gc, rs, dop, dvo, sop, svo, sui, scl, upd, org, alb, prp].forEach(must);
    const x = {
      rsvps: byKey(rs.data, 'spark_id'), dateOpts: byKey(dop.data, 'spark_id'), dateVotes: byKey(dvo.data, 'option_id'),
      spotOpts: byKey(sop.data, 'spark_id'), spotVotes: byKey(svo.data, 'option_id'), signups: byKey(sui.data, 'spark_id'),
      claims: byKey(scl.data, 'item_id'), updates: byKey(upd.data, 'spark_id'), organizers: byKey(org.data, 'spark_id'),
      album: byKey(alb.data, 'spark_id'), prep: byKey(prp.data, 'spark_id'),
      reactions: byKey(rct.error ? [] : rct.data, 'spark_id'),   // v6 Update 2 (reactions on past events)
      groups: byKey(sgr.error ? [] : sgr.data, 'spark_id')
    };

    const roles = {};
    mem.data.forEach(m => { roles[m.group_id] = { role: m.role, lastSeen: Date.parse(m.last_seen_at), pinned: !!m.pinned }; });
    const va = state.viewAs;
    const drafts = va || drf.error ? [] : (drf.data || []).map(d => ({ id: d.id, data: d.data || {}, saved: Date.parse(d.updated_at) }));
    const notes = va || nts.error ? [] : (nts.data || []).map(n => ({ id: n.id, body: n.body, createdBy: n.created_by, created: Date.parse(n.created_at) }));
    const groups = grp.data.map(g => Object.assign({ id: g.id, name: g.name, photo: g.photo, photoPos: g.photo_pos || null, role: null, lastSeen: 0, pinned: false }, (va ? va.roles : roles)[g.id] || {}))
      .filter(g => !va || va.roles[g.id])
      .sort((a, b) => runs(b) - runs(a) || a.name.localeCompare(b.name));

    // Previewing as a tester: only what they'd see (the rule in can_see_spark_row, minus shared links)
    const sparks = sp.data.map(r => toSpark(r, of.data, it.data, gc.data, x)).filter(s => {
      const m = va && va.roles[s.groupId];
      const m2 = va && s.groupIds.map(id => va.roles[id]).find(Boolean);
      return !va || ((m || m2) && (s.visibility === 'group' || s.leadId === va.id || [m, m2].some(x => x && (x.role === 'owner' || x.role === 'admin')) || s.rsvps.some(r => r.userId === va.id)));
    });

    // Names and photos of everyone on screen
    const ids = new Set([state.me]);
    sparks.forEach(s => {
      ids.add(s.leadId); s.interested.forEach(u => ids.add(u)); s.offers.concat(s.pending).forEach(o => ids.add(o.userId));
      s.rsvps.forEach(r => ids.add(r.userId)); s.organizers.forEach(u => ids.add(u));
      s.signups.forEach(i => i.claims.forEach(c => ids.add(c.userId)));
      s.reactions.forEach(r => ids.add(r.userId));
    });
    notes.forEach(n => ids.add(n.createdBy));
    ids.delete(null); ids.delete(undefined);
    const profiles = {};
    for (const part of chunks(Array.from(ids), 80)) {
      const res = must(await sb.from('profiles').select('id,name,avatar_path,place,bio').in('id', part));
      res.data.forEach(p => { profiles[p.id] = { name: p.name || '', avatar: PHOTO_PATH.test(p.avatar_path || '') ? p.avatar_path : null, place: p.place || '', bio: p.bio || '' }; });
    }
    if (seq < loadWritten) return;   // a newer load already wrote fresher data
    loadWritten = seq;
    const mine = profiles[state.me] || {};
    if (performance.now() - t0 > 3000) diag('slow load', performance.now() - t0, 'waiting on the network');
    document.documentElement.setAttribute('data-loaded', 'true');   // tests wait for this
    setState({
      groups, sparks, profiles, drafts, notes, loaded: true, fromCache: false, error: null,
      myName: mine.name || state.myName, myAvatar: mine.avatar || null, myPlace: mine.place || '', myBio: mine.bio || ''
    });
    writeCache();
    if (state.email && !va) syncPush();
    // Whether you're the account that can wipe the demo content (Profile)
    if (state.email && !va) {
      sb.from('demo_admins').select('user_id').eq('user_id', state.me).maybeSingle()
        .then(r => { if (!r.error) { setState({ demoAdmin: !!r.data }); writeCache(); } }, () => {});
    }
    // Notification read state and settings (signed-in people only)
    if (state.email && !va) {
      const asked = Date.now();
      sb.from('notif_state').select('all_read_at,read_keys,topics,email').maybeSingle().then(r => {
        if (r.error || asked < notifSavedAt) return;   // a read/setting saved since then is newer than this answer
        const d = r.data || {};
        setState({ notif: { allReadAt: d.all_read_at ? Date.parse(d.all_read_at) : 0, read: d.read_keys || [], topics: d.topics || {}, email: d.email !== false, loaded: true } });
        writeCache();
      }, () => {});
    }
    // Member counts for the Groups page (a nicety: the page works without them)
    sb.rpc('my_group_sizes').then(r => {
      if (r.error) return;
      const sizes = {};
      (r.data || []).forEach(x => { sizes[x.group_id] = x.members; });
      setState({ sizes });
      writeCache();
    }, () => {});
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
    if (state.me && u.id !== state.me && state.fromCache) {   // cached data was someone else's: don't show it
      setState({ groups: [], sparks: [], profiles: {}, sizes: {}, loaded: false, fromCache: false, demoAdmin: false });
    }
    if (u.id !== state.me || email !== state.email || google !== state.isGoogle) {
      if (state.viewAs) return;   // previewing as a tester: stay them until Exit (which reloads)
      setState({ me: u.id, email, isGoogle: google, myName: (u.is_anonymous ? state.myName : metaName(meta) || state.myName).slice(0, 30), memberSince: u.created_at ? new Date(u.created_at).getFullYear() : state.memberSince });
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
    if (state.viewAs) { toast('You’re viewing as ' + firstName(state.viewAs.name) + ', so nothing changes. Exit to make changes.'); return false; }
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
    if (!id || opened.has(id) || previewing) return true;
    const res = must(await sb.rpc('open_idea', { p_spark: id }));
    if (res.data) opened.add(id);
    return !!res.data;
  };

  // Load, and make sure a linked idea is reachable; an unknown one shows "That idea isn't up anymore"
  const loadForRoute = async () => {
    if (state.screen === 'detail' && state.subjectId) {
      const ok = await openLink(state.subjectId);
      if (!ok) setState({ screen: 'calendar', subjectId: null, goneOpen: true });
    }
    await loadFresh();
    if (state.screen === 'detail' && !subject()) setState({ screen: 'calendar', subjectId: null, goneOpen: true });
    if (state.screen === 'groupPage') openGroupPage(state.gpId, true);
  };

  // ---------------------------------------------------------------------------
  // Gates: sign-in, name, guest info
  // ---------------------------------------------------------------------------

  const openLogin = (from, then) => setState({
    loginStep: 'email', loginFrom: from || 'default', loginThen: then || null, loginMode: 'link',
    loginCode: '', resent: false, googleFailed: false, nameAsk: null, guestOpen: false, menu: null
  });
  const closeLogin = () => setState({ loginStep: null, loginCode: '', loginThen: null, googleFailed: false, busy: null });

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
  const togglePin = (g) => {
    const pinned = !g.pinned;
    g.pinned = pinned;
    toast(pinned ? 'Pinned' : 'Unpinned', true);
    sb.from('memberships').update({ pinned }).eq('group_id', g.id).eq('user_id', state.me)
      .then(r => { if (r.error) throw r.error; }).catch(e => { console.error(e); g.pinned = !pinned; toast(FAILED); });
  };

  // The owner's one-tap removal of the seeded demo content (wipe_demo() checks it's them)
  const wipeDemo = () => {
    const n = state.sparks.filter(s => s.demo).length;
    setState({ confirm: { title: 'Remove all demo content?', danger: true, cta: 'Remove it', keep: 'Keep it',
      body: 'Deletes the ' + n + (n === 1 ? ' demo idea or plan' : ' demo ideas and plans') + ' in your groups (with their replies, sign-ups and photos), takes the demo people out of the groups, and stops adding new sign-ups to them. Real posts and people stay. This can’t be undone.',
      run: () => run(async () => {
        const r = must(await sb.rpc('wipe_demo')).data;
        const row = (r && r[0]) || {};
        toast('Removed ' + (row.ideas || 0) + ' demo ideas and plans', true);
      }, { confirm: null }) } });
  };

  // "View as a tester" (demo admin): pick a tester, and the app draws itself as them (look only)
  const openTesters = () => {
    if (state.testers) return setState({ testers: null });
    sb.rpc('demo_testers').then(r => {
      if (r.error) { console.error(r.error); toast(FAILED); return; }
      setState({ testers: r.data || [] });
    }, () => toast(FAILED));
  };
  const viewAsTester = (t) => {
    const roles = {};
    (t.memberships || []).forEach(m => { roles[m.group_id] = { role: m.role, pinned: !!m.pinned, lastSeen: Date.parse(m.last_seen_at) || 0 }; });
    previewing = true;
    setState({ viewAs: { id: t.user_id, name: t.name || 'Tester', roles }, me: t.user_id, email: t.email || 'tester', myName: t.name || '', myAvatar: null, myPlace: '', myBio: '',
      testers: null, profSheet: false, notif: { allReadAt: 0, read: [], topics: {}, email: true, loaded: true }, demoAdmin: false, loaded: false });
    go('calendar');
    loadFresh().then(() => toast('Viewing as ' + t.name + '. Nothing you tap changes anything.', true), (e) => { console.error(e); setState({ error: 'load', loaded: true }); });
  };
  const exitPreview = () => { location.hash = '#/'; location.reload(); };
  const previewBar = () => '<div role="status" data-preview style="position:fixed;z-index:90;bottom:calc(var(--nav-h) + 10px);left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);height:44px;padding:0 6px 0 16px;border-radius:999px;background:#1f2433;color:#fff;box-shadow:0 8px 20px rgba(13,17,23,.3);font-size:14px;font-weight:800;white-space:nowrap">' +
    '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis">Viewing as ' + esc(state.viewAs.name) + '</span>' +
    '<span ' + on(exitPreview) + ' style="flex:0 0 auto;display:flex;align-items:center;height:34px;padding:0 14px;border-radius:999px;background:#ffd98a;color:#1f2433;font-size:13.5px;font-weight:900;cursor:pointer">Exit</span></div>';
  const testerCard = () => {
    const st = state;
    if (st.viewAs) return '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;align-items:flex-start;gap:10px"><div style="font-size:17px;font-weight:900;color:#0d1117">Viewing as ' + esc(firstName(st.viewAs.name)) + '</div>' +
      '<div style="font-size:13.5px;line-height:1.4;font-weight:600;color:#5c6270">Look only. Nothing you tap changes anything.</div>' +
      '<button type="button" ' + on(exitPreview) + ' style="min-height:42px;padding:0 18px;border:0;border-radius:999px;background:#0d1117;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Exit</button></div>';
    if (!st.demoAdmin) return '';
    const list = st.testers;
    return '<div data-screen-label="View as a tester" style="display:flex;flex-direction:column;gap:12px"><div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;align-items:flex-start;gap:10px">' +
        '<div style="font-size:17px;font-weight:900;color:#0d1117">View as a tester</div>' +
        '<div style="font-size:13.5px;line-height:1.4;font-weight:600;color:#5c6270">See the app the way a tester does when they sign in. Look only. Only you can see this.</div>' +
        '<button type="button" ' + on(openTesters) + ' aria-expanded="' + !!list + '" style="min-height:42px;padding:0 16px;border:1.5px solid #dcdfe6;border-radius:999px;background:#fff;color:#0d1117;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">' + (list ? 'Close' : 'Pick one') + '</button></div>' +
      (list ? '<div style="' + CARD + ';padding:4px 16px;display:flex;flex-direction:column">' + (list.length ? list.map((t, i) => '<div ' + on(() => viewAsTester(t)) + ' class="hov-row" data-tester="' + esc(t.email) + '" style="display:flex;align-items:center;gap:12px;min-height:54px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + ';cursor:pointer">' +
          face(t.user_id, t.name, 36, '#7b6ef0') + '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">' + esc(t.name) + '</div><div style="font-size:12.5px;font-weight:600;color:#8a909b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t.email) + ' · ' + (t.memberships || []).length + ((t.memberships || []).length === 1 ? ' group' : ' groups') + '</div></div></div>').join('')
        : '<div style="padding:14px 0;font-size:14px;font-weight:600;color:#6b7280">No testers have signed in yet.</div>') + '</div>' : '') +
    '</div>';
  };

  const inviteLink = (code) => location.origin + '/join/' + code;
  const copy = (text, note) => {
    const done = () => toast(note, true);
    try { navigator.clipboard.writeText(text).then(done, done); } catch (e) { done(); }
  };

  // Edit group (owners and admins): Profile → Your groups, or Edit on All ideas
  const loadMembers = async (id) => {
    const res = must(await sb.rpc('group_members', { p_group: id }));
    const list = res.data || [];
    setState({ membersList: list, gpMembers: list.length });
  };
  const openGroupPage = async (id, quiet, from) => {
    if (!quiet) go('groupPage', { gpId: id, gpCode: '', gpMembers: null, membersList: null, gpRename: null, gpFrom: from || 'groups' });
    try {
      const code = await sb.rpc('group_code', { p_group: id });
      setState({ gpCode: code.data || '' });
      await loadMembers(id);
    } catch (e) { console.error(e); }
  };
  const closeGroupPage = () => {
    const g = groupById(state.gpId);
    if (state.gpFrom === 'browse' && g) go('browse', { groupId: g.id }); else go('groups');
  };
  const openMembers = () => setState({ membersOpen: state.gpId, membersQ: '' });

  // Owners set roles (two owners at most, never none); admins see the list
  const setRole = (g, m, role) => {
    if (role === m.role || state.busy) return;
    const first = firstName(m.name) || m.name;
    const word = { owner: 'is now an owner', admin: 'is now an admin', member: 'is no longer an admin' };
    const note = m.role === 'owner' ? first + ' is no longer an owner' : first + ' ' + word[role];
    const apply = () => run(async () => {
      must(await sb.rpc('set_member_role', { p_group: g.id, p_user: m.user_id, p_role: role }));
      await loadMembers(g.id);
    }, { confirm: null }).then(ok => { if (ok) toast(m.user_id === state.me ? 'You’re ' + (role === 'admin' ? 'an admin' : 'a member') + ' now' : note, true); });
    const me = m.user_id === state.me;
    if (role === 'owner') {
      setState({ confirm: { title: 'Make ' + first + ' an owner?', body: 'Owners can do everything admins can, and choose who the admins and owners are. They could also take the owner role away from you. A group can have two owners.', cta: 'Make them an owner', keep: 'Cancel', run: apply } });
    } else if (m.role === 'owner') {
      setState({ confirm: { title: me ? 'Step down as owner?' : 'Remove ' + first + ' as owner?', body: me ? 'You’ll be an admin and can’t change roles any more.' : first + ' will be an admin.', cta: me ? 'Step down' : 'Remove as owner', keep: 'Cancel', danger: true, run: apply } });
    } else apply();
  };

  const saveRename = async (g) => {
    const name = (state.gpRename || '').trim();
    if (name.length < 2 || name === g.name || state.busy) return;
    const ok = await run(async () => { must(await sb.rpc('rename_group', { p_group: g.id, p_name: name })); }, { gpRename: null });
    if (ok) toast('Group renamed', true);
  };
  const askDeleteGroup = (g) => {
    if (myGroups().length < 2) { toast('You need to be in at least one group.'); return; }
    setState({ gpDel: '' });
  };
  const deleteGroup = async (g) => {
    if ((state.gpDel || '').trim() !== 'DELETE' || state.busy) return;
    const ok = await run(async () => { must(await sb.rpc('delete_group', { p_group: g.id })); }, { gpDel: null });
    if (!ok) return;
    if (state.groupId === g.id) setState({ groupId: null });
    go('calendar');
    toast(g.name + ' was deleted', true);
  };

  // Start a group (V5 brings it back): name it, then land on its Edit group page with the code
  const startGroup = () => { setState({ menu: null }); needSignIn(() => setState({ startName: '' }), 'profile'); };
  const submitStartGroup = async () => {
    const name = titleCase(state.startName || '').slice(0, 40);
    if (name.length < 2 || state.busy) return;
    setState({ busy: 'save' });
    try {
      const row = (must(await sb.rpc('create_group', { p_name: name })).data || [])[0];
      await loadFresh();
      setState({ busy: null, startName: null });
      if (row) openGroupPage(row.id, false, 'groups'); else go('groups');
      toast(name + ' is ready. Share the code to invite people.', true);
    } catch (e) {
      console.error(e);
      setState({ busy: null });
      toast(/lot of new groups/.test(e.message || '') ? 'That’s a lot of new groups at once. Try again in a bit.' : FAILED);
    }
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

  // ---- Invite links (/join/CODE; design handoff "Invite flow", 2026-09-29) ------------------------
  // The group's name and photo lead every screen; the code itself is never shown. Signed out: the invite
  // landing (Google, or a 6-digit email code in a pop-up), then the join runs by itself. Signed in before
  // the tap: one confirm (it may be the wrong account). Then Welcome to {group} (once per group) → its
  // Plans tab. state.inv = { code, group (undefined while loading, null if the code matches nothing),
  // step: land · confirm · joining · neterr · welcome · bad, busy, gid, copied }.
  const PENDING_INVITE = 'pendingInvite', WELCOMED = 'spark-hub-welcomed-groups';
  const IN_APP = /Instagram|FBAN|FBAV|Messenger|Line\/|TikTok|Snapchat/i.test(navigator.userAgent);
  const setPending = (code) => { try { if (code) sessionStorage.setItem(PENDING_INVITE, code); else sessionStorage.removeItem(PENDING_INVITE); } catch (e) { /* fine */ } };
  const welcomedIds = () => { try { return JSON.parse(localStorage.getItem(WELCOMED)) || []; } catch (e) { return []; } };
  const markWelcomed = (id) => { try { localStorage.setItem(WELCOMED, JSON.stringify(welcomedIds().filter(x => x !== id).concat(id).slice(-50))); } catch (e) { /* fine */ } };
  const setInv = (patch) => { if (state.inv) setState({ inv: Object.assign({}, state.inv, patch) }); };
  // Full-screen invite steps (no tab bar); the landing stays up while a join it started is running
  const invFull = () => { const v = state.inv; return !!v && (v.step === 'land' ? !state.email || !!v.busy : v.step !== 'confirm'); };

  const loadInviteGroup = async (code, tries) => {
    try {
      const g = (must(await sb.rpc('group_preview', { p_code: code })).data || [])[0];
      if (!state.inv || state.inv.code !== code) return;
      if (g) setInv({ group: { name: g.name, photo: photoUrl(g.photo) } });
      else if (state.inv.step !== 'joining') setInv({ group: null, step: 'bad' });
    } catch (e) {
      console.error(e);
      const n = (tries || 0) + 1;
      if (n < 5) setTimeout(() => loadInviteGroup(code, n), 1500 * n);
    }
  };
  // Opening the link: signed in already → the confirm pop-up over their Calendar; otherwise the landing
  const startInvite = (code, step) => {
    setPending(code);
    setState({ inv: { code, group: undefined, step: step || (state.email ? 'confirm' : 'land') }, screen: 'calendar', joinOpen: false, loginStep: null, installPop: false, menu: null });
    loadInviteGroup(code);
  };
  const closeInvite = () => { setPending(''); setState({ inv: null }); };

  // Join as soon as there's a session: no confirm (E3 had it). Under 400ms, skip the Joining screen.
  const inviteJoin = async () => {
    const inv = state.inv;
    if (!inv || inv.busy) return;
    const code = inv.code;
    setInv({ busy: true, step: inv.step === 'neterr' ? 'joining' : inv.step });
    const slow = setTimeout(() => { if (state.inv && state.inv.busy) setInv({ step: 'joining' }); }, 400);
    try {
      const session = await ensureSession();
      if (state.fromCache || !state.loaded) await loadFresh();
      const before = myGroups().map(g => g.id);
      const id = must(await sb.rpc('join_group', { p_code: code })).data;
      clearTimeout(slow);
      setPending('');
      if (!id) { setState({ inv: { code, group: null, step: 'bad' } }); return; }
      await loadFresh();
      const g = groupById(id), group = state.inv && state.inv.group ? state.inv.group : { name: g ? g.name : '', photo: groupPhoto(g) };
      // A brand-new account can't have been a member before (the demo world may add it to groups on sign-up)
      const created = Date.parse((session.user || {}).created_at || '') || 0;
      const isNew = Date.now() - created < 20 * 60 * 1000;
      if (before.indexOf(id) > -1 && !isNew) {   // E2: nothing to decide, go to the group
        setState({ inv: null });
        if (g) { markSeen(g); go('browse', { groupId: g.id, phaseTab: 'plan' }); }
        toastIn('You’re already in ' + group.name);
        return;
      }
      if (welcomedIds().indexOf(id) > -1) {   // Welcome shows once per group
        setState({ inv: null, invA2hs: true });
        if (g) { markSeen(g); go('browse', { groupId: g.id, phaseTab: 'plan' }); }
        return;
      }
      markWelcomed(id);
      setState({ inv: { code, gid: id, group, step: 'welcome' }, screen: 'calendar' });
      const sc = scroller();
      if (sc) sc.scrollTop = 0;
    } catch (e) {
      clearTimeout(slow);
      console.error(e);
      setInv({ busy: false, step: 'neterr' });
    }
  };
  // Leaving Welcome for the group page; the Add to Home Screen pop-up follows 1.2s later
  const leaveWelcome = (tab) => {
    const g = groupById(state.inv && state.inv.gid);
    setState({ inv: null, invA2hs: true });
    if (g) { markSeen(g); go('browse', { groupId: g.id, phaseTab: tab }); } else go('calendar');
  };
  // Signed out on the landing: email → a code in pop-up 2; Google → a full-page trip, back into the join
  const invSendCode = () => {
    const st = state;
    if (!EMAIL_OK.test(st.loginEmail.trim()) || st.busy) return;
    setState({ loginFrom: 'invite', loginThen: () => inviteJoin(), joinCode: st.inv.code, invCodeBad: false });
    sendCode(false).then(() => { if (state.loginStep === 'code') setState({ invResendAt: Date.now() + 60000 }); });
  };
  const invResend = () => {
    if (state.busy || (state.invResendAt || 0) > Date.now()) return;
    setState({ resent: false, loginCode: '', invCodeBad: false });
    sendCode(true).then(() => { if (state.loginStep === 'code') setState({ invResendAt: Date.now() + 60000, resent: false }); });
  };
  const invGoogle = () => {
    if (state.busy) return;
    setState({ loginFrom: 'invite', joinCode: state.inv.code });
    googleSignIn();
  };
  // E3: sign out, keep the invite, and show the landing
  const invOtherAccount = async () => {
    const { code, group } = state.inv;
    setState({ inv: { code, group, step: 'land' } });
    await signOut();
    setPending(code);
    setState({ inv: { code, group, step: 'land' } });
  };
  const invCopyLink = () => {
    const url = location.origin + '/join/' + state.inv.code;
    const done = () => setInv({ copied: true });
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => toast('Couldn’t copy. Tap ··· then Open in browser.'));
    else toast('Couldn’t copy. Tap ··· then Open in browser.');
  };
  // Pop-up 2 sits near the top third, but always above the keyboard
  const placeInvPop = () => {
    const el = document.querySelector('[data-inv-pop]');
    if (!el) return;
    const vv = window.visualViewport, h = vv ? vv.height : innerHeight, off = vv ? vv.offsetTop : 0;
    root.style.setProperty('--inv-top', Math.round(off + Math.max(12, Math.min(170, h - el.offsetHeight - 12))) + 'px');
  };
  if (window.visualViewport) { visualViewport.addEventListener('resize', placeInvPop); visualViewport.addEventListener('scroll', placeInvPop); }
  // "Resend in 0:42" counts down while pop-up 2 is open
  setInterval(() => { if (state.inv && state.loginStep === 'code' && (state.invResendAt || 0) > Date.now() - 1500) render(); }, 1000);

  // ---------------------------------------------------------------------------
  // Photos
  // ---------------------------------------------------------------------------

  // Shrink to ≤1200px JPEG before upload (sharp on a 430px-wide phone at 3x): phone photos are 3–10 MB,
  // this is ~150 KB. scripts/demo/shrink-photos.py applies the same size to photos already stored.
  const shrinkImage = (file, max) => new Promise((resolve, reject) => {
    if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '')) { reject(new Error('heic')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, (max || 1200) / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', 0.78);
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
    if (!PLACES || q.length < 2) { if (state[key].length) setState({ [key]: [] }); return; }
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

  const askDelete = (s) => setState({ confirm: {
    title: s.planned ? 'Delete this event?' : 'Delete this idea?',
    body: s.planned ? (() => { const n = going(s).filter(r => r.userId !== state.me).length;
      return 'It comes down for everyone, along with its RSVPs and sign-ups. ' + (n ? (n === 1 ? 'The 1 person going gets' : 'The ' + n + ' people going get') + ' a note that it’s off. ' : '') + 'This can’t be undone.'; })()
      : 'It comes down for everyone, along with its offers and interest. This can’t be undone.',
    cta: 'Delete it', keep: 'Keep it', danger: true,
    run: () => {
      const photos = s.photoPaths.concat(s.mood);
      run(async () => {
        must(await sb.rpc('delete_event', { p_spark: s.id }));
      }, () => {   // land where the Back button would have: where you came from, else the group's page, else the Calendar
        const b = state.back, g = groupById(s.groupId), member = !!(g && g.role);
        return { confirm: null, screen: b ? b.screen : member ? 'browse' : 'calendar', groupId: b ? (b.groupId || state.groupId) : member ? g.id : state.groupId, subjectId: null, tag: null, back: null };
      }).then(ok => { if (ok) deletePhotos(photos); });
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
        { offerKind: null, offerText: '', offerPlace: null, tag: kind === 'day' ? 'Day set' : 'Location set' });
      return;
    }
    // Everyone else's suggestions go on the idea's board, where anyone can vote and the lead picks
    run(async () => {
      await saveGuestContact(s.id);
      const who = (state.myName || (state.guest && state.guest.name) || 'Someone').slice(0, 40);
      if (kind === 'day') {
        must(await sb.from('date_options').insert({ spark_id: s.id, day_date: text.slice(0, 10), day_time: text.length > 10 ? text.slice(11, 16) : null, who }));
      } else {
        must(await sb.from('spot_options').insert({ spark_id: s.id, name: cleanTitle(text).slice(0, 80), address: place ? place.address : null, lat: place ? place.lat : null, lon: place ? place.lon : null, who }));
      }
    }, { offerKind: null, offerText: '', offerPlace: null, tag: kind === 'day' ? 'Date suggested' : 'Location suggested' });
  };
  const resolveOffer = (s, p, accept) => run(async () => {
    must(await sb.rpc('resolve_offer', { p_offer: p.id, p_accept: accept }));
  }, accept ? { tag: p.kind === 'spot' ? 'Location set' : 'Day set' } : {});

  // ---- V5 plans ----------------------------------------------------------------------
  // An idea is a plan once the lead locks in a day and a time; the day after, it "happened"
  const phaseOf = (s) => !s.planned ? 'idea' : (s.dayDate && s.dayDate < todayISO() ? 'done' : 'plan');
  const myRsvp = (s) => { const r = s.rsvps.find(x => x.userId === state.me); return r ? r.status : null; };
  const going = (s) => s.rsvps.filter(r => r.status === 'going');
  const whenLong = (s) => s.dayDate ? fmtDay(s.dayDate) + (s.dayTime ? ' at ' + fmtTime(s.dayTime) : '') : '';

  const setRsvp = (s, status) => {
    const cur = myRsvp(s), next = cur === status ? null : status, lead = nameOf(s.leadId, s.leadName);
    const note = { going: 'You’re going. See you there!', maybe: 'Marked as maybe', no: 'Thanks for letting ' + lead + ' know' }[next];
    needGuest(() => run(async () => {
      await saveGuestContact(s.id);
      if (!next) must(await sb.from('rsvps').delete().eq('spark_id', s.id).eq('user_id', state.me));
      else must(await sb.from('rsvps').upsert({ spark_id: s.id, user_id: state.me, status: next }, { onConflict: 'spark_id,user_id' }));
    }).then(ok => { if (ok && note) toast(note, true); }));
  };

  const vote = (table, s, o) => needGuest(() => run(async () => {
    await saveGuestContact(s.id);
    if (o.votes.indexOf(state.me) > -1) must(await sb.from(table).delete().eq('option_id', o.id).eq('user_id', state.me));
    else must(await sb.from(table).insert({ option_id: o.id, user_id: state.me }));
  }));
  const pickDate = (s, o) => setState({ confirm: { title: 'Use ' + fmtDay(o.dayDate) + '?', body: 'It becomes the date on the idea' + (o.dayTime ? ', at ' + fmtTime(o.dayTime) : '') + '. You can still change it.', cta: 'Use this date', keep: 'Not yet',
    run: () => run(async () => { must(await sb.from('sparks').update({ day_date: o.dayDate, day_time: o.dayTime }).eq('id', s.id)); }, { confirm: null, tag: 'Day set' }) } });
  const pickSpot = (s, o) => setState({ confirm: { title: 'Use ' + o.name + '?', body: 'It becomes the location on the idea. You can still change it.', cta: 'Use this location', keep: 'Not yet',
    run: () => run(async () => { must(await sb.from('sparks').update({ spot: o.name, spot_open: false, spot_address: o.address || null, spot_lat: o.lat, spot_lon: o.lon }).eq('id', s.id)); }, { confirm: null, tag: 'Location set' }) } });

  const makePlan = (s) => {
    const n = s.interested.length;
    setState({ confirm: { title: 'Make it a plan?', green: true, cta: 'Make it a plan', keep: 'Not yet',
      body: 'It’s on for ' + whenLong(s) + '. ' + (n ? (n === 1 ? 'The 1 person who’s interested shows as going.' : 'The ' + n + ' people who are interested show as going.') : 'Anyone who joins shows as going.'),
      run: () => run(async () => { must(await sb.rpc('make_plan', { p_spark: s.id })); }, { confirm: null, tag: 'It’s a plan' }) } });
  };
  const clearPlan = (s) => {
    const n = going(s).length;
    setState({ confirm: { title: 'Clear the date?', danger: true, cta: 'Clear the date', keep: 'Keep it',
      body: 'It goes back to being an idea.' + (n ? (n === 1 ? ' The 1 person going shows as interested again.' : ' The ' + n + ' people going show as interested again.') : ''),
      run: () => run(async () => { must(await sb.rpc('clear_plan', { p_spark: s.id })); }, { confirm: null, tag: null }) } });
  };

  const toggleOrganizer = (s) => {
    const on = s.organizers.indexOf(state.me) > -1;
    needGuest(() => run(async () => {
      await saveGuestContact(s.id);
      if (on) must(await sb.from('organizers').delete().eq('spark_id', s.id).eq('user_id', state.me));
      else must(await sb.from('organizers').insert({ spark_id: s.id, user_id: state.me }));
    }).then(ok => { if (ok && !on) toast('You’re helping organize. ' + nameOf(s.leadId, s.leadName) + ' will see it.', true); }));
  };

  // v6 Update 5: signing up is one tap, then a "You're on it" banner with Undo (4s). Taking yourself
  // off later shows "You're off it" with Find a replacement (7s); on your own event, just a toast.
  let bannerTimer = null;
  const showBanner = (b, ms) => {
    clearTimeout(toastTimer); clearTimeout(bannerTimer);
    setState({ toast: null, banner: b });
    bannerTimer = setTimeout(() => setState({ banner: null }), ms);
  };
  const onItBanner = (s, undo) => showBanner({ kind: 'on', id: s.id, undo }, 4000);
  const offIt = (s, job) => isLead(s) ? toast('Removed you from ' + job.item.toLowerCase(), true) : showBanner({ kind: 'off', id: s.id, job: job.item }, 7000);
  const undoClaim = (b) => {
    clearTimeout(bannerTimer);
    run(async () => {
      if (b.undo.del) must(await sb.from('signup_items').delete().eq('id', b.undo.del));
      else must(await sb.from('signup_claims').delete().in('item_id', b.undo.items).eq('user_id', state.me));
    }, { banner: null }).then(ok => { if (ok) toast('Okay, you’re off it', true); });
  };
  const jobOf = (s, it) => (s.jobs || s.signups).find(j => j.id === (it.jobId || it.id)) || it;
  const myShiftIds = (job) => (job.shifts || []).filter(u => u.claims.some(c => c.userId === state.me)).map(u => u.id);

  // Sign-ups: the lead adds items (with an optional "how many"); others add what they're bringing
  const addSignup = (s) => {
    const item = cleanTitle(state.sigDraft).slice(0, 60), need = isLead(s) ? (parseInt(state.sigNeed, 10) || null) : null, time = isLead(s) ? (state.sigTime || null) : null;
    if (!item || state.busy) return;
    let row = null;
    const add = () => run(async () => {
      await saveGuestContact(s.id);
      row = must(await sb.from('signup_items').insert({ spark_id: s.id, item, need, time }).select('id').single()).data;
      if (!isLead(s)) must(await sb.from('signup_claims').insert({ item_id: row.id, user_id: state.me }));
    }, { sigDraft: '', sigNeed: '', sigTime: '', sigAdding: false }).then(ok => { if (ok) { if (isLead(s)) toast('Added to sign-ups', true); else onItBanner(s, { del: row.id }); } });
    if (isLead(s)) add(); else needGuest(add);
  };
  const toggleClaim = (s, it) => {
    const mine = it.claims.some(c => c.userId === state.me);
    needGuest(() => run(async () => {
      await saveGuestContact(s.id);
      if (mine) must(await sb.from('signup_claims').delete().eq('item_id', it.id).eq('user_id', state.me));
      else must(await sb.from('signup_claims').insert({ item_id: it.id, user_id: state.me }));
    }).then(ok => { if (ok) { if (mine) offIt(s, jobOf(s, it)); else onItBanner(s, { items: [it.id] }); } }));
  };
  // Pick a shift: tick any shifts (more than one is fine), an optional note, Done
  const openShifts = (s, job) => needGuest(() => {
    const mine = myShiftIds(job), c = job.shifts.map(u => u.claims.find(x => x.userId === state.me)).find(Boolean);
    setState({ shiftPick: { id: s.id, job: job.id, sel: mine, note: c ? c.note : '' } });
  });
  const saveShifts = (s, job) => {
    const p = state.shiftPick, had = myShiftIds(job), sel = p.sel, note = (p.note || '').trim().slice(0, 60) || null;
    const add = sel.filter(id => had.indexOf(id) < 0), drop = had.filter(id => sel.indexOf(id) < 0), keep = had.filter(id => sel.indexOf(id) > -1);
    const noteChanged = keep.some(id => { const u = job.shifts.find(x => x.id === id), c = u && u.claims.find(x => x.userId === state.me); return c && (c.note || null) !== note; });
    if (!add.length && !drop.length && !noteChanged) return setState({ shiftPick: null });
    run(async () => {
      await saveGuestContact(s.id);
      if (drop.length) must(await sb.from('signup_claims').delete().in('item_id', drop).eq('user_id', state.me));
      if (add.length) must(await sb.from('signup_claims').insert(add.map(id => ({ item_id: id, user_id: state.me, note }))));
      if (keep.length && noteChanged) must(await sb.from('signup_claims').update({ note }).in('item_id', keep).eq('user_id', state.me));
    }, { shiftPick: null }).then(ok => {
      if (!ok) return;
      if (add.length) onItBanner(s, { items: sel });
      else if (drop.length) offIt(s, job);
    });
  };
  const saveClaimNote = (it, note) => {
    sb.from('signup_claims').update({ note: note.slice(0, 60) || null }).eq('item_id', it.id).eq('user_id', state.me)
      .then(r => { if (r.error) throw r.error; }).catch(e => { console.error(e); toast(FAILED); });
  };
  const removeSignup = (s, it) => {
    const n = new Set(it.claims.map(c => c.userId).filter(u => u !== state.me)).size;
    setState({ confirm: { title: 'Remove “' + it.item + '”?', body: n ? (n === 1 ? 'The 1 person signed up gets' : 'The ' + n + ' people signed up get') + ' a note that it’s off the list.' : 'It comes off the list.', cta: 'Remove', keep: 'Keep it', danger: true,
      run: () => run(async () => { must(await sb.rpc('remove_signup', { p_item: it.id })); }, { confirm: null }) } });
  };

  // Updates from the host (they show on the plan; delivery comes with notifications)
  const postUpdate = (s) => {
    const b = state.blast;
    if (!b || !b.text.trim() || state.busy) return;
    run(async () => { must(await sb.from('plan_updates').insert({ spark_id: s.id, body: b.text.trim().slice(0, 320), audience: b.to })); }, { blast: null })
      .then(ok => { if (ok) toast('Posted to the plan', true); });
  };
  // The album, once it's happened
  const addAlbumPhoto = async (s, file) => {
    if (!file) return;
    let blob;
    try { blob = await shrinkImage(file); } catch (e) { toast(BAD_PHOTO); return; }
    let path = null;
    needGuest(() => run(async () => {
      path = await uploadBlob(blob);
      try { must(await sb.from('album_photos').insert({ spark_id: s.id, path })); } catch (e) { deletePhotos([path]); throw e; }
    }).then(ok => { if (ok) toast('Added to the album', true); }));
  };

  // "Add to calendar": a one-hour .ics event
  const addToCalendar = (s) => {
    if (!s.dayDate) return;
    const t = (s.dayTime || '09:00').replace(':', '') + '00', d = s.dayDate.replace(/-/g, '');
    const end = new Date(s.dayDate + 'T' + (s.dayTime || '09:00') + ':00'); end.setHours(end.getHours() + 1);
    const p2 = (n) => String(n).padStart(2, '0');
    const endStr = end.getFullYear() + p2(end.getMonth() + 1) + p2(end.getDate()) + 'T' + p2(end.getHours()) + p2(end.getMinutes()) + '00';
    const escIcs = (v) => String(v || '').replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Spark Hub//EN', 'BEGIN:VEVENT', 'UID:' + s.id + '@sparkhub',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', 'DTSTART:' + d + 'T' + t, 'DTEND:' + endStr,
      'SUMMARY:' + escIcs(s.text), 'LOCATION:' + escIcs([s.spot, s.spotAddress].filter(Boolean).join(', ')),
      'DESCRIPTION:' + escIcs(location.origin + '/i/' + s.id), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = (s.text.replace(/[^\w ]+/g, '').trim() || 'plan') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // "Do it again": a new event with the place and details filled in
  const doItAgain = (s) => goCompose({ activity: s.text.slice(0, 40), locText: s.spot || '', locPlace: s.spotAddress ? { name: s.spot, address: s.spotAddress, lat: s.spotPoint && s.spotPoint[0], lon: s.spotPoint && s.spotPoint[1] } : null,
    evBits: [0, 1, 2].map(i => (basicsOf(s)[i] || '').slice(0, 40)) });

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

  // ---- Photo positioner: group headers (admins), idea covers (lead) and the post flow's cover.
  // What's saved is a focal point + zoom, rendered with the same rule everywhere (photoLayer / posAt).
  const phDef = (kind) => kind === 'group' ? GROUP_POS : IDEA_POS;
  const openPositioner = (t) => {
    const img = new Image();
    const open = (w, h) => setState({ ph: Object.assign({}, t, { pos: posOf(t.pos, phDef(t.kind)), nat: { w, h } }) });
    img.onload = () => open(img.naturalWidth, img.naturalHeight);
    img.onerror = () => open(0, 0);
    img.src = t.url;
  };
  const pickForPositioner = async (file, t) => {
    if (!file) return;
    let blob;
    try { blob = await shrinkImage(file); } catch (e) { toast(BAD_PHOTO); return; }
    openPositioner(Object.assign({}, t, { url: URL.createObjectURL(blob), blob, pos: null }));
  };
  const closePositioner = () => { const ph = state.ph; if (ph && ph.blob && ph.kind !== 'draft') URL.revokeObjectURL(ph.url); setState({ ph: null }); };

  // Dragging moves the focal point; the DOM is updated directly while dragging, state on release
  let phDrag = null;
  const phStyle = (el, pos) => {
    el.style.backgroundPosition = pos.x + '% ' + pos.y + '%';
    el.style.transformOrigin = pos.x + '% ' + pos.y + '%';
  };
  const phDown = (e) => {
    const box = e.target.closest('[data-ph]');
    if (!box || !state.ph) return;
    const r = box.getBoundingClientRect(), nat = state.ph.nat, pos = state.ph.pos;
    const cover = nat.w && nat.h ? Math.max(r.width / nat.w, r.height / nat.h) : 1;
    const spareX = Math.max(nat.w * cover * pos.zoom - r.width, r.width * .25);
    const spareY = Math.max(nat.h * cover * pos.zoom - r.height, r.height * .25);
    phDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: pos, pos, spareX, spareY, box, layer: box.querySelector('[data-ph-img]') };
    box.setPointerCapture(e.pointerId);
    box.classList.add('ph-dragging');
    e.preventDefault();
  };
  const phMove = (e) => {
    if (!phDrag || e.pointerId !== phDrag.id) return;
    const d = phDrag, clamp = (v) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
    d.pos = { x: clamp(d.start.x - (e.clientX - d.x) / d.spareX * 100), y: clamp(d.start.y - (e.clientY - d.y) / d.spareY * 100), zoom: d.start.zoom };
    if (d.layer) phStyle(d.layer, d.pos);
  };
  const phUp = (e) => {
    if (!phDrag || e.pointerId !== phDrag.id) return;
    const d = phDrag;
    phDrag = null;
    d.box.classList.remove('ph-dragging');
    if (state.ph) setState({ ph: Object.assign({}, state.ph, { pos: d.pos }) });
  };

  const savePositioner = async () => {
    const ph = state.ph;
    if (!ph || state.busy) return;
    if (ph.kind === 'draft') {
      // A different photo picked in the positioner replaces the draft's first photo
      const photos = state.photos.slice();
      if (ph.blob && photos[0]) { URL.revokeObjectURL(photos[0].url); photos[0] = { blob: ph.blob, url: ph.url }; }
      setState({ coverPos: ph.pos, ph: null, photos });
      return;
    }
    let path = null, old = null;
    const ok = await run(async () => {
      if (ph.blob) path = await uploadBlob(ph.blob);
      try {
        if (ph.kind === 'group') {
          old = path ? (groupById(ph.id) || {}).photo : null;
          must(await sb.rpc('set_group_photo', { p_group: ph.id, p_photo: path, p_pos: ph.pos }));
        } else if (path) {
          old = must(await sb.rpc('set_idea_cover', { p_spark: ph.id, p_photo: path, p_pos: ph.pos })).data;
        } else {
          must(await sb.from('sparks').update({ cover_pos: ph.pos }).eq('id', ph.id));
        }
      } catch (e) { if (path) deletePhotos([path]); throw e; }
    });
    if (!ok) return;
    if (old) deletePhotos([old]);   // only files in your own folder are touched
    if (ph.blob) URL.revokeObjectURL(ph.url);
    setState({ ph: null });
    toast('Photo saved', true);
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
    else if (state.screen === 'calendar') go('calendar');
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
      if (state.inv && state.loginStep === 'code') setState({ invCodeBad: true });   // pop-up 2 shows it under the boxes
      else toast('That code didn’t work. Check it, or send it again.');
    }
  };

  const signOut = async () => {
    await forgetPush();   // this phone stops getting the old account's notifications
    clearCache();
    await sb.auth.signOut().catch(() => {});
    setState({ email: '', isGoogle: false, myName: '', myAvatar: null, myPlace: '', myBio: '', guest: null, groups: [], sparks: [], drafts: [], notes: [], profiles: {}, sizes: {},
      notif: { allReadAt: 0, read: [], topics: {}, email: true, loaded: false }, demoAdmin: false, back: null, subjectId: null, gpId: null,
      cq: '', cSearch: false, cGrps: null, cTypes: [], cSort: 'soon', cMon: null, cDay: null, cWildHidden: false, cNeedsHidden: false });
    go('calendar');
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
  const DRAFT_KEYS = ['activity', 'evStep', 'evDate', 'evTime', 'evEnd', 'evEndOn', 'locText', 'locPlace', 'evBits', 'evNeeds', 'evDatePoll', 'evSpotPoll', 'evLater', 'evPriv', 'evGroups', 'coverPos', 'evPhotoPath', 'evDraftId'];
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
    return Object.assign(out, { screen: 'compose', evStep: 'review' });
  };

  // What to do once signed in, by where sign-in started
  const resumeAfter = (r) => {
    if (r.from === 'post') return () => createEvent();
    if (r.from === 'join') return () => setState({ joinOpen: true, joinCode: r.joinCode || '', joinBad: false });
    if (r.from === 'invite') return () => { if (!state.inv) startInvite(r.joinCode, 'joining'); inviteJoin(); };
    if (r.from === 'profile') return () => go('calendar', { profSheet: true });
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
    if ((!session || session.user.is_anonymous) && r.from === 'invite' && r.joinCode) {
      // Back on the invite landing, not the sign-in pop-up
      setState({ inv: { code: r.joinCode, group: state.inv ? state.inv.group : undefined, step: 'land' } });
      toast('Google sign-in didn’t finish. Try again, or use your email.');
      await loadFresh().catch(() => {});
      return false;
    }
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
    name: state.myName, email: state.email, place: state.myPlace, bio: state.myBio, step: 'form', code: '',
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
      const place = (pe.place || '').trim().slice(0, 40), bio = (pe.bio || '').trim().slice(0, 160);
      if (place !== state.myPlace || bio !== state.myBio) must(await sb.from('profiles').upsert({ id: state.me, place: place || null, bio: bio || null, updated_at: new Date().toISOString() }, { onConflict: 'id' }));
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
      const blob = await shrinkImage(f, 400);
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
  const PHOTO_PILL = 'position:absolute;left:12px;bottom:40px;z-index:1;display:flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:999px;background:rgba(13,17,23,.45);font-size:13px;font-weight:800;color:#fff;cursor:pointer';
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

  // ---- Photo framing: {x, y, zoom}; the positioner and every place a photo shows use the same rule
  const GROUP_POS = { x: 50, y: 40, zoom: 1 }, IDEA_POS = { x: 50, y: 50, zoom: 1 };
  const posOf = (p, def) => {
    const ok = p && [p.x, p.y, p.zoom].every(Number.isFinite);
    return ok ? { x: Math.min(100, Math.max(0, p.x)), y: Math.min(100, Math.max(0, p.y)), zoom: Math.min(2.5, Math.max(1, p.zoom)) } : def;
  };
  const posAt = (p, def) => { const q = posOf(p, def); return q.x + '% ' + q.y + '%'; };
  // A full layer: position + zoom (headers, positioner)
  const photoLayer = (url, p, def, extra) => {
    const q = posOf(p, def);
    return '<div aria-hidden="true" style="position:absolute;inset:0;background:' + bg(url, q.x + '% ' + q.y + '%') + ';transform:scale(' + q.zoom + ');transform-origin:' + q.x + '% ' + q.y + '%;' + (extra || '') + '"></div>';
  };
  // Other shapes (tiles, cards, thumbnails): the same focal point
  const groupBg = (g, fallback) => groupPhoto(g) ? bg(groupPhoto(g), posAt(g.photoPos, GROUP_POS)) : (fallback || '#e8a71c');

  // ---- Logo, group switcher and its menu -----------------------------------

  const logo = (onDark) => '<div ' + on(() => go('calendar')) + ' aria-label="Spark Hub home" style="display:flex;align-items:center;gap:6px;min-height:44px;cursor:pointer;width:fit-content">' +
    (onDark ? I.boltRays(24) : I.bolt(24, '#e8a71c')) +
    '<span style="font-size:18px;line-height:1;font-weight:900;letter-spacing:-.5px;color:' + (onDark ? '#fff;text-shadow:0 1px 4px rgba(0,0,0,.3)' : '#0d1117') + '">Spark Hub</span></div>';

  const switcher = (onPhoto) => {
    const g = currentGroup();
    const color = onPhoto ? '#fff' : '#5b4ae8';
    return '<div data-menu style="position:absolute;top:calc(10.5px + var(--pt));right:10px;z-index:3">' +
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
      groupsInOrder().map(g => {
        const onIt = cur && g.id === cur.id;
        return '<div ' + on(() => pickGroup(g)) + ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:9px 12px;border-radius:12px;background:' + (onIt ? '#f3f1fe' : 'transparent') + ';cursor:pointer">' +
          '<div style="min-width:0;display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:15px;font-weight:800;color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + esc(g.name) + '</span>' +
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
    I.plus(19, '#fff', 2.5) + 'Start an event</button>';

  // "That idea isn't up anymore": a dead or cut-short idea link
  const goneCard = () => state.goneOpen
    ? '<div role="status" style="position:relative;' + CARD + ';padding:18px 48px 18px 18px">' +
        '<span ' + on(() => setState({ goneOpen: false })) + ' aria-label="Dismiss" style="position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(14, '#0d1117', 2.4) + '</span>' +
        '<div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">That idea isn’t up anymore</div>' +
        '<div style="margin-top:4px;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Its lead may have taken it down, or the link got cut short.</div>' +
        '<span ' + on(() => { setState({ goneOpen: false }); go('calendar'); }) + ' style="display:inline-flex;margin-top:10px;min-height:32px;align-items:center;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">See what’s up now →</span>' +
      '</div>'
    : '';

  // ---------------------------------------------------------------------------
  // 1. Welcome (Home, signed out)
  // ---------------------------------------------------------------------------

  const STEPS = [['#e8a71c', '1', 'Create an event'], ['#5b4ae8', '2', 'RSVP &amp; pitch in'], ['#0f7a3c', '3', 'Make it happen']];

  function viewWelcome() {
    const st = state, from = st.joinCode ? 'join' : 'default', then = st.joinCode ? () => openJoin(st.joinCode) : null;
    // Both open the sign-in pop-up: Google straight into "Opening Google…", email with the field focused
    const google = () => { if (st.busy) return; openLogin(from, then); googleSignIn(); };
    const email = () => { openLogin(from, then); setTimeout(() => { const f = document.querySelector('[data-screen-label="Sign in"] input[type=email]'); if (f) f.focus(); }, 0); };
    // A full-screen column: the photo behind the top, then the logo, headline and steps,
    // with the sign-in buttons anchored near the bottom of the screen
    return '<div data-screen-label="Welcome" style="position:relative;min-height:100%;display:flex;flex-direction:column;background:#0d1117;overflow:hidden">' +
      '<div aria-hidden="true" style="position:absolute;left:0;right:0;top:calc(-70px + var(--pt));height:500px;background:' + bg('/photos/welcome.jpg', '40% 50%') + '"></div>' +
      '<div aria-hidden="true" style="position:absolute;left:0;right:0;top:0;height:calc(430px + var(--pt));background:linear-gradient(to bottom, rgba(13,17,23,.4) 0%, rgba(13,17,23,.18) 25%, rgba(13,17,23,.62) 48%, rgba(13,17,23,.92) 70%, #0d1117 100%)"></div>' +
      '<div style="flex:1 0 calc(200px + var(--pt))"></div>' +
      '<div style="position:relative;padding:0 20px;color:#fff;text-shadow:0 1px 12px rgba(13,17,23,.5)">' +
        '<div aria-label="Spark Hub" style="display:flex;align-items:center;gap:6px;margin-bottom:14px">' + I.bolt(24, '#f3c55a') + '<span style="font-size:18px;line-height:1;font-weight:900;letter-spacing:-.5px;color:#fff">Spark Hub</span></div>' +
        '<h1 style="margin:0;font-size:42px;line-height:.98;font-weight:900;letter-spacing:-1.4px;color:#fff">Plans with<br><span style="color:#9d93f7">your people.</span></h1>' +
        '<ol style="list-style:none;margin:18px 0 0;padding:0;display:flex;flex-direction:column;gap:12px">' +
          STEPS.map(([c, n, t]) => '<li style="display:flex;align-items:center;gap:12px"><span aria-hidden="true" style="flex:0 0 28px;width:28px;height:28px;border-radius:999px;background:' + c + ';color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;text-shadow:none">' + n + '</span>' +
            '<span style="font-size:16.5px;line-height:1.2;font-weight:800;color:#fff">' + t + '</span></li>').join('') +
        '</ol>' +
      '</div>' +
      '<div style="position:relative;padding:32px 16px calc(22px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:10px">' +
        goneCard() +
        // Not designed yet (README → Open, invite link flow): say which group the link is for
        (st.joinCode ? '<div style="text-align:center;font-size:14.5px;font-weight:700;color:#dfe2e8">Sign in to join the group <strong style="font-weight:900;letter-spacing:1px;color:#fff">' + esc(st.joinCode) + '</strong></div>' : '') +
        (GOOGLE_ON
          ? '<button type="button" class="hov-fill-grey" ' + on(google) + ' style="width:100%;min-height:54px;display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;border:0;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;color:#0d1117;cursor:pointer">' +
              I.google + 'Continue with Google</button>'
          : '') +
        '<button type="button" class="hov-white-line" ' + on(email) + ' style="width:100%;min-height:54px;display:flex;align-items:center;justify-content:center;gap:10px;background:transparent;border:1.5px solid rgba(255,255,255,.3);border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;color:#fff;cursor:pointer">' +
          svg(19, stroke('currentColor', 2.1), '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7.5 8 6 8-6"/>') + 'Continue with email</button>' +
        '<p style="margin:6px 0 0;text-align:center;font-size:13.5px;line-height:1.45;font-weight:600;color:#8a909b">New here? Either one creates your account.</p>' +
      '</div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // 1b. Invite link screens (design handoff "Invite flow": 1a landing, 2 email code, 3 joining,
  //     4 welcome, E1 bad link, E3 confirm account, E4 in-app browser; E2 is a toast)
  // ---------------------------------------------------------------------------

  const INV_BTN = 'width:100%;min-height:54px;display:flex;align-items:center;justify-content:center;gap:12px;border-radius:999px;font-family:inherit;font-size:17px;font-weight:800;cursor:pointer;';
  const invPrimary = (ok, h) => INV_BTN + 'min-height:' + (h || 54) + 'px;border:0;color:#fff;background:' + (ok ? '#5b4ae8' : '#c3c5ce') + ';cursor:' + (ok ? 'pointer' : 'default');
  const INV_OUTLINE = INV_BTN + 'background:#fff;border:2px solid #e3e5ec;color:#11131f';
  const INV_EYEBROW = 'font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase';
  // The group's photo; no photo → its colour with the initial; still loading → grey
  const invPhoto = (g, h, initialSize) => g === undefined
    ? '<div aria-hidden="true" style="height:' + h + ';background:#e3e5ec;animation:skPulse 1.4s ease-in-out infinite"></div>'
    : g && g.photo ? '<div aria-hidden="true" style="height:' + h + ';background:' + bg(g.photo) + '"></div>'
    : '<div aria-hidden="true" style="height:' + h + ';background:#e8a71c;display:flex;align-items:center;justify-content:center;font-size:' + initialSize + 'px;font-weight:900;color:#fff">' + esc(initialOf(g && g.name)) + '</div>';
  const invThumb = (g, size, ring) => '<span aria-hidden="true" style="flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:999px;overflow:hidden;display:block' + (ring ? ';box-shadow:' + ring : '') + '">' + invPhoto(g, size + 'px', Math.round(size * 0.45)) + '</span>';
  const invName = (g) => g && g.name ? esc(g.name) : '';
  const invNameSize = (g) => g && g.name && g.name.length > 16 ? 34 : 38;
  const statusFade = '<div aria-hidden="true" style="position:absolute;left:0;right:0;top:0;height:calc(120px + var(--pt));background:linear-gradient(rgba(0,0,0,.45),transparent)"></div>';
  const brandPill = '<div aria-label="Spark Hub" style="position:absolute;top:calc(var(--pt) + 16px);left:24px;display:flex;align-items:center;gap:6px;padding:6px 12px 6px 9px;border-radius:999px;background:rgba(17,19,31,.55);font-size:14px;font-weight:700;color:#fff">' + I.bolt(18, '#f2b51c') + 'Spark Hub</div>';

  // 1a / E4: the invite landing, signed out
  function viewInvLanding() {
    const st = state, g = st.inv.group, busy = st.busy, emailOk = EMAIL_OK.test(st.loginEmail.trim()) && !busy;
    const photoH = IN_APP ? 230 : 300;
    const nameBlock = g === undefined
      ? '<div aria-hidden="true" style="margin-top:8px;width:72%;height:38px;border-radius:10px;background:#e3e5ec;animation:skPulse 1.4s ease-in-out infinite"></div>'
      : '<h1 style="margin:6px 0 0;font-size:' + (IN_APP ? 34 : invNameSize(g)) + 'px;line-height:1.05;font-weight:900;letter-spacing:-.025em;color:#11131f;overflow-wrap:break-word">' + invName(g) + '</h1>';
    const email = '<input class="fld" data-inv-email type="email" inputmode="email" maxlength="80" autocomplete="email" autocapitalize="off" spellcheck="false" aria-label="Email" placeholder="you@example.com" value="' + esc(st.loginEmail) + '" ' +
        onInput(e => { if (e.type === 'input') setState({ loginEmail: e.target.value.slice(0, 80) }); }) +
        ' style="width:100%;height:54px;border:2px solid #e3e5ec;border-radius:16px;padding:0 18px;font-family:inherit;font-size:17px;font-weight:500;color:#11131f;background:#fff;outline:none">' +
      '<button type="button" ' + on(invSendCode) + ' aria-disabled="' + !emailOk + '" style="margin-top:10px;' + invPrimary(emailOk) + '">' + (busy === 'send' ? 'Sending…' : 'Email me a code') + '</button>';
    const body = IN_APP
      ? email +
        '<div style="margin-top:16px;display:flex;flex-direction:column;gap:10px;background:#fdf5e1;border-radius:18px;padding:14px 16px">' +
          '<p style="margin:0;font-size:15px;line-height:1.4;color:#5c4510"><b style="font-weight:800">Want to use Google?</b> It won’t work inside this app. Tap <b style="font-weight:800">···</b> then <b style="font-weight:800">Open in browser</b>.</p>' +
          '<span ' + on(invCopyLink) + ' style="align-self:flex-start;display:flex;align-items:center;padding:8px 14px;border-radius:999px;background:#fff;border:1.5px solid #ecd9a6;font-size:14px;font-weight:800;color:#5c4510;cursor:pointer">' +
            (st.inv.copied ? 'Copied. Paste it in ' + (/Android/i.test(navigator.userAgent) ? 'Chrome' : 'Safari') + '.' : 'Copy link') + '</span></div>'
      : '<p style="margin:10px 0 0;font-size:16px;line-height:1.4;color:#5f6475">This is where the group plans get-togethers. See what’s coming up and RSVP in a tap.</p>' +
        (GOOGLE_ON
          ? '<button type="button" ' + on(invGoogle) + ' style="margin-top:22px;' + INV_OUTLINE + ';opacity:' + (busy && busy !== 'google' ? '.5' : '1') + '">' + I.google + (busy === 'google' ? 'Opening Google…' : 'Continue with Google') + '</button>' +
            '<div style="display:flex;align-items:center;gap:14px;margin:16px 0"><span style="flex:1;height:1px;background:#e3e5ec"></span><span style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#8a8fa0">OR</span><span style="flex:1;height:1px;background:#e3e5ec"></span></div>'
          : '<div style="height:22px"></div>') +
        email +
        '<p style="margin:14px 0 0;text-align:center;font-size:14px;color:#6b7080">New here? Either one creates your account.</p>';
    return '<div data-screen-label="Invite" style="position:relative;min-height:100%;display:flex;flex-direction:column;background:#fff">' +
      '<div style="position:relative;flex:0 0 auto">' + invPhoto(g, 'calc(' + photoH + 'px + var(--pt))', 96) + statusFade + brandPill + '</div>' +
      '<div style="position:relative;flex:1 0 auto;margin-top:-28px;border-radius:28px 28px 0 0;background:#fff;padding:26px 24px calc(24px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column">' +
        '<div style="' + INV_EYEBROW + ';color:#5b4ae8">You’re invited to</div>' + nameBlock + body +
      '</div></div>';
  }

  // 2: the 6-digit email code, over the landing. One hidden input drawn as six boxes (paste and iOS autofill work).
  function viewInvCode() {
    const st = state, g = st.inv.group, code = st.loginCode.slice(0, 6), bad = !!st.invCodeBad, ok = code.length === 6 && !st.busy;
    const close = () => { closeLogin(); setState({ invCodeBad: false }); };
    const left = Math.max(0, Math.ceil(((st.invResendAt || 0) - Date.now()) / 1000));
    const boxes = Array.from({ length: 6 }, (_, i) => {
      const active = !bad && i === Math.min(code.length, 5);
      return '<span style="height:58px;border-radius:14px;border:2px solid ' + (bad ? '#d93a3a' : active ? '#5b4ae8' : '#e3e5ec') + ';' + (active ? 'box-shadow:0 0 0 4px #e6e3fc;' : '') +
        'display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#11131f">' + esc(code.charAt(i)) + '</span>';
    }).join('');
    const onCode = (e) => {
      if (e.type !== 'input') return;
      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
      if (e.target.value !== v) e.target.value = v;
      setState({ loginCode: v, invCodeBad: false });
      if (v.length === 6 && !state.busy) verifyCode();
    };
    return '<div class="modal-scrim" data-scrim="' + reg(close) + '" style="z-index:32;display:block;padding:0;background:rgba(17,19,31,.55)">' +
      '<div data-inv-pop role="dialog" aria-modal="true" aria-label="Check your email" style="position:absolute;left:18px;right:18px;top:var(--inv-top, 170px);max-width:420px;margin:0 auto;background:#fff;border-radius:32px;padding:22px 22px 24px;box-shadow:0 24px 60px rgba(17,19,31,.3);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
          '<span style="min-width:0;display:flex;align-items:center;gap:8px;padding:4px 12px 4px 4px;border-radius:999px;background:#f0f1f5;font-size:14px;font-weight:700;color:#3a3e4d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + invThumb(g, 28) + 'Joining ' + invName(g) + '</span>' +
          '<span ' + on(close) + ' aria-label="Close" style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#f0f1f5;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(16, '#11131f', 2.4) + '</span></div>' +
        '<h2 style="margin:18px 0 0;font-size:28px;line-height:1.1;font-weight:900;letter-spacing:-.02em;color:#11131f">Check your email</h2>' +
        '<p style="margin:8px 0 0;font-size:16px;line-height:1.4;color:#5f6475;overflow-wrap:anywhere">We sent a 6-digit sign-in code to <b style="font-weight:700;color:#11131f">' + esc(st.loginEmail.trim()) + '</b></p>' +
        '<div style="position:relative;margin-top:20px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px">' + boxes +
          '<input data-inv-code type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="6-digit code" value="' + esc(code) + '" ' + onInput(onCode) +
            ' style="position:absolute;inset:0;width:100%;height:100%;border:0;padding:0;background:transparent;color:transparent;caret-color:transparent;font-size:16px;letter-spacing:40px;outline:none;opacity:.01"></div>' +
        (bad ? '<div role="alert" style="margin-top:10px;font-size:14px;line-height:1.4;color:#d93a3a">That code didn’t work. Check the newest email from Spark Hub.</div>' : '') +
        '<button type="button" ' + on(() => { if (ok) verifyCode(); }) + ' aria-disabled="' + !ok + '" style="margin-top:18px;' + invPrimary(ok) + '">' + (st.busy === 'signin' ? 'Signing in…' : 'Sign in & join') + '</button>' +
        '<div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px">' +
          (left > 0 ? '<span style="color:#6b7080">Resend in 0:' + pad2(left) + '</span>' : '<span ' + on(invResend) + ' style="font-weight:700;color:#5b4ae8;cursor:pointer">Send a new code</span>') +
          '<span ' + on(() => { close(); setTimeout(() => { const f = document.querySelector('[data-inv-email]'); if (f) f.focus(); }, 0); }) + ' style="font-weight:700;color:#5b4ae8;cursor:pointer">Use a different email</span></div>' +
      '</div></div>';
  }

  // 3: joining (only after 400ms), or the network error with Try again
  function viewInvJoining() {
    const st = state, g = st.inv.group, err = st.inv.step === 'neterr';
    return '<div data-screen-label="Joining" style="min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:24px;background:#fff;text-align:center">' +
      invThumb(g, 112, '0 0 0 6px #fff, 0 0 0 8px #e6e3fc') +
      '<div style="font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-.02em;color:#11131f">' + (g && g.name ? 'Joining ' + invName(g) + '…' : 'Joining…') + '</div>' +
      (err
        ? '<div style="display:flex;flex-direction:column;align-items:center;gap:14px"><span style="font-size:16px;color:#5f6475">Couldn’t reach Spark Hub.</span>' +
            '<button type="button" ' + on(inviteJoin) + ' style="' + invPrimary(true) + ';width:auto;padding:0 28px">Try again</button></div>'
        : '<div role="progressbar" aria-label="Joining" style="position:relative;width:140px;height:6px;border-radius:999px;background:#eceef2;overflow:hidden"><span style="position:absolute;top:0;bottom:0;width:40%;border-radius:999px;background:#5b4ae8;animation:invBar 1.1s ease-in-out infinite"></span></div>') +
    '</div>';
  }

  // 4: Welcome to {group}, once per group joined by link
  function viewInvWelcome() {
    const st = state, inv = st.inv, g = inv.group, gid = inv.gid;
    const next = state.sparks.filter(s => inGroup(s, gid) && phaseOf(s) === 'plan' && s.dayDate).sort(byWhen)[0];
    const rows = [['#e8a317', 'Plans', 'see what’s coming up and RSVP'], ['#5b4ae8', 'Ideas', 'suggest something, see who’s up for it'], ['#1f8a4c', 'Pitch in', 'bring something or lend a hand']];
    let card;
    if (next) {
      const f = signupFill(next), n = going(next).length;
      const rsvp = () => { const s = next; leaveWelcome('plan'); if (myRsvp(s) !== 'going') setRsvp(s, 'going'); };
      card = '<div style="margin-top:22px;display:flex;align-items:center;gap:12px;border-radius:22px;padding:16px 18px;color:#fff;background:' +
          (next.photoPaths[0] ? 'linear-gradient(rgba(13,17,23,.5),rgba(13,17,23,.72)),' + photoBg(next) : 'linear-gradient(180deg,#a57a1c,#4a3a1a)') + '">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.9">Next up · ' + esc(when6(next)) + '</div>' +
          '<div style="margin-top:2px;font-size:20px;line-height:1.2;font-weight:900;overflow-wrap:break-word">' + esc(next.text) + '</div>' +
          '<div style="margin-top:2px;font-size:14px;opacity:.85">' + esc((f.open > 0 ? f.open + (f.open === 1 ? ' spot left · ' : ' spots left · ') : '') + n + ' going') + '</div></div>' +
        '<button type="button" ' + on(rsvp) + ' style="flex:0 0 auto;border:0;border-radius:999px;background:#fff;color:#11131f;padding:10px 18px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer">' + (myRsvp(next) === 'going' ? 'Going' : 'RSVP') + '</button></div>';
    } else {
      card = '<div style="margin-top:22px;display:flex;align-items:center;gap:12px;border-radius:22px;padding:16px 18px;background:#fff;border:2px solid #e3e5ec">' +
        '<div style="flex:1;min-width:0;font-size:16px;line-height:1.35;font-weight:700;color:#11131f">Nothing planned yet. Got an idea?</div>' +
        '<button type="button" ' + on(() => { leaveWelcome('idea'); goCompose(); }) + ' style="flex:0 0 auto;border:0;border-radius:999px;background:#5b4ae8;color:#fff;padding:10px 18px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer">Suggest one</button></div>';
    }
    return '<div data-screen-label="Welcome to group" style="position:relative;min-height:100%;display:flex;flex-direction:column;background:#f0f1f5">' +
      '<div style="position:relative;flex:0 0 auto">' + invPhoto(g, 'calc(240px + var(--pt))', 80) + statusFade + '</div>' +
      '<div style="position:relative;flex:1 0 auto;margin-top:-28px;border-radius:28px 28px 0 0;background:#fff;padding:26px 24px calc(24px + env(safe-area-inset-bottom, 0px))">' +
        '<span aria-hidden="true" style="position:absolute;top:-28px;right:24px;width:56px;height:56px;border-radius:999px;background:#1f8a4c;box-shadow:0 0 0 5px #fff;display:flex;align-items:center;justify-content:center">' + I.check(26, '#fff', 3.2) + '</span>' +
        '<div style="' + INV_EYEBROW + ';color:#1f8a4c">You’re in</div>' +
        '<h1 style="margin:6px 0 0;font-size:34px;line-height:1.05;font-weight:900;letter-spacing:-.025em;color:#11131f;overflow-wrap:break-word">Welcome to<br>' + invName(g) + '</h1>' +
        '<div style="margin-top:20px;display:flex;flex-direction:column;gap:14px">' + rows.map(([c, b, t], i) =>
          '<div style="display:flex;align-items:flex-start;gap:14px"><span aria-hidden="true" style="flex:0 0 34px;width:34px;height:34px;border-radius:999px;background:' + c + ';color:#fff;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center">' + (i + 1) + '</span>' +
          '<span style="padding-top:5px;font-size:16px;line-height:1.35;color:#5f6475"><b style="font-weight:800;color:#11131f">' + b + '</b> — ' + t + '</span></div>').join('') + '</div>' +
        card +
        '<button type="button" ' + on(() => leaveWelcome('plan')) + ' style="margin-top:14px;' + invPrimary(true, 56) + '">See what’s coming up</button>' +
      '</div></div>';
  }

  // E1: a mistyped, rotated or deleted link (one message for all three)
  function viewInvBad() {
    const signedIn = !!state.email;
    return '<div data-screen-label="Bad invite link" style="min-height:100%;display:flex;flex-direction:column;padding:calc(var(--pt) + 14px) 24px calc(40px + env(safe-area-inset-bottom, 0px));background:#fff">' +
      '<div aria-label="Spark Hub" style="display:flex;align-items:center;gap:6px;font-size:15px;font-weight:800;color:#11131f">' + I.bolt(18, '#f2b51c') + 'Spark Hub</div>' +
      '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:32px 0">' +
        '<span aria-hidden="true" style="width:72px;height:72px;border-radius:999px;background:#fde8e8;color:#d93a3a;font-size:36px;font-weight:900;display:flex;align-items:center;justify-content:center">?</span>' +
        '<h1 style="margin:22px 0 0;font-size:34px;line-height:1.08;font-weight:900;letter-spacing:-.025em;color:#11131f">This invite link isn’t working</h1>' +
        '<p style="margin:12px 0 0;font-size:17px;line-height:1.45;color:#5f6475">It may have a typo, or the group may have made a new one. Ask the person who sent it for a fresh link.</p>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
        '<button type="button" ' + on(() => { closeInvite(); openJoin(); }) + ' style="' + invPrimary(true) + '">Enter a group code</button>' +
        (signedIn
          ? '<button type="button" ' + on(() => { closeInvite(); go('calendar'); }) + ' style="' + INV_OUTLINE + '">Go to my calendar</button>'
          : '<button type="button" ' + on(closeInvite) + ' style="' + INV_OUTLINE + '">What’s Spark Hub?</button>') +
      '</div></div>';
  }

  // E3: signed in before the tap — join as this account, or switch
  function viewInvConfirm() {
    const st = state, g = st.inv.group, busy = !!st.inv.busy, first = firstName(st.myName) || 'me';
    return '<div class="modal-scrim" data-scrim="' + reg(closeInvite) + '" style="z-index:32;background:rgba(17,19,31,.55);padding:18px">' +
      '<div role="dialog" aria-modal="true" aria-label="Join ' + esc(g && g.name ? g.name : 'this group') + '?" style="position:relative;width:100%;max-width:420px;background:#fff;border-radius:32px;padding:26px 22px 22px;box-shadow:0 24px 60px rgba(17,19,31,.3);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
        '<span ' + on(closeInvite) + ' aria-label="Close" style="position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:999px;background:#f0f1f5;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(16, '#11131f', 2.4) + '</span>' +
        invThumb(g, 64) +
        '<h2 style="margin:16px 0 0;padding-right:40px;font-size:28px;line-height:1.1;font-weight:900;letter-spacing:-.02em;color:#11131f;overflow-wrap:break-word">' + (g && g.name ? 'Join ' + invName(g) + '?' : 'Join this group?') + '</h2>' +
        '<p style="margin:10px 0 0;font-size:16px;color:#5f6475">You’ll join as:</p>' +
        '<div style="margin-top:10px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:#f0f1f5">' +
          face(st.me, st.myName || st.email, 40, '#5b4ae8') +
          '<div style="min-width:0"><div style="font-size:16px;font-weight:700;color:#11131f">' + esc(st.myName || st.email) + '</div>' +
          '<div style="font-size:14px;color:#6b7080;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(st.email) + '</div></div></div>' +
        '<button type="button" ' + on(() => { if (!busy && g !== undefined) inviteJoin(); }) + ' style="margin-top:18px;' + invPrimary(!busy && g !== undefined) + '">' + (busy ? 'Joining…' : 'Join as ' + esc(first)) + '</button>' +
        '<div ' + on(invOtherAccount) + ' style="margin-top:14px;text-align:center;font-size:15px;font-weight:700;color:#5b4ae8;cursor:pointer">Use a different account</div>' +
      '</div></div>';
  }

  // ---------------------------------------------------------------------------
  // 2. Home (signed in)
  // ---------------------------------------------------------------------------

  const PIN = (fill, strokeColor) => '<svg width="11" height="11" viewBox="0 0 24 24" fill="' + fill + '" stroke="' + strokeColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z"/><path d="M12 14v7"/></svg>';

  // ---- V5 update: Your plans · Your events & ideas · all-groups Calendar -----------------------
  const DAY_MS = 864e5;
  const midnight = (iso) => new Date(iso + 'T00:00').getTime();
  const dayDiff = (iso) => Math.round((midnight(iso) - midnight(todayISO())) / DAY_MS);
  const whenOf = (s) => s.dayDate ? s.dayDate + (s.dayTime || '') : '';
  const byWhen = (a, b) => whenOf(a).localeCompare(whenOf(b));
  // An event can be posted to several groups (v6 Update 6): its home group first, then the rest
  const gIds = (s) => s.groupIds || [s.groupId];
  const inGroup = (s, gid) => gIds(s).indexOf(gid) > -1;
  const inMine = (s) => gIds(s).some(id => { const g = groupById(id); return !!(g && g.role); });
  const inScope = (s, gid) => inMine(s) && (!gid || inGroup(s, gid));
  const photoBg = (s) => s.photoPaths[0] ? bg(photoUrl(s.photoPaths[0]), posAt(s.coverPos, IDEA_POS)) : groupBg(groupById(s.groupId), "url('/photos/torrez-trail.jpg') center/cover");
  const monthDay = (iso) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const monthLabel = (iso) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: iso.slice(0, 4) !== todayISO().slice(0, 4) ? 'numeric' : undefined });
  // v6 Update 6: an undecided date or place reads "… to be decided" (amber), or the poll's size
  const dateTbd = (s) => s.dateOpts.length ? 'Voting on ' + s.dateOpts.length + (s.dateOpts.length === 1 ? ' date' : ' dates') : 'Date to be decided';
  const spotTbd = (s) => s.spotOpts.length ? 'Voting on ' + s.spotOpts.length + (s.spotOpts.length === 1 ? ' spot' : ' spots') : 'Location to be decided';
  const TBD_ON_PHOTO = '#ffd98a', TBD_INK = '#8f6405';
  const tbdSpan = (t, color) => '<span style="color:' + (color || TBD_INK) + '">' + esc(t) + '</span>';
  // Events posted to several groups: "Torrez Fitness +1"
  const groupsLabel = (s) => { const n = (s.groupIds || [s.groupId]).map(id => groupById(id)).filter(g => g && g.role).map(g => g.name); return n.length ? n[0] + (n.length > 1 ? ' +' + (n.length - 1) : '') : ((groupById(s.groupId) || {}).name || ''); };
  const shortWhen = (s) => s.dayDate ? fmtDay(s.dayDate) + (s.dayTime ? ' · ' + fmtTime(s.dayTime) : '') : 'No date yet';
  const dateLineOf = (s) => s.dayDate ? shortWhen(s) : (phaseOf(s) === 'idea' ? 'Idea · no date yet' : dateTbd(s));
  const signupFill = (s) => {
    const counted = s.signups.filter(i => i.need);
    const needed = counted.reduce((n, i) => n + i.need, 0), filled = counted.reduce((n, i) => n + Math.min(i.claims.length, i.need), 0);
    return { rows: s.signups.length, counted: counted.length, needed, filled, open: needed - filled };
  };
  const myClaims = (s) => s.signups.filter(it => it.claims.some(c => c.userId === state.me));
  const maybes = (s) => s.rsvps.filter(r => r.status === 'maybe');
  const openSpark = (s) => go('detail', { subjectId: s.id, tag: null, menu: null });
  const backLabel = (s) => {
    const b = state.back, g = groupById(s.groupId);
    if (!b) return g && g.role ? g.name : 'Calendar';
    return { home: 'Your tasks', sched: 'Your schedule', own: b.ownTab === 'idea' ? 'Your ideas' : 'Your plans', calendar: 'Calendar', groups: 'Groups', browse: (groupById(b.groupId) || g || {}).name || 'the group' }[b.screen];
  };
  const goBack = (s) => {
    const b = state.back, g = groupById(s.groupId);
    if (!b) { go(g && g.role ? 'browse' : 'calendar', g && g.role ? { groupId: g.id } : {}); return; }
    setState({ screen: b.screen, groupId: b.groupId || state.groupId, phaseTab: b.phaseTab, ownTab: b.ownTab, back: null, menu: null, zoom: null });
    const sc = scroller();
    if (sc) sc.scrollTop = b.scroll;
  };
  const backBtn = (s) => '<span ' + on(() => goBack(s)) + ' aria-label="Back to ' + esc(backLabel(s)) + '" style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 2px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.chevL(20, '#0d1117', 2.6) + '</span>';
  const EDIT_PILL = 'flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 2px 10px rgba(0,0,0,.25);font-size:14px;font-weight:800;color:#0d1117;cursor:pointer';

  // Ideas you lead, your upcoming plans, and ones that happened in the last 3 days
  const leadingList = (gid) => state.sparks.filter(s => isLead(s) && inScope(s, gid) && (phaseOf(s) !== 'done' || (s.dayDate && dayDiff(s.dayDate) >= -3)));

  // What a lead could do next (Your plans' Actions tile): the same list as Your tasks (ownActs, below)
  const nextSteps = (s) => ownActs(s).map(a => ({ text: a.act, cta: a.cta }));

  // Loading placeholders (never the empty-state copy) until the first data arrives
  const skeleton = (n, h) => '<div role="status" aria-label="Loading" style="display:flex;flex-direction:column;gap:14px">' +
    Array.from({ length: n }, () => '<div aria-hidden="true" style="height:' + h + 'px;border-radius:20px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);animation:skPulse 1.4s ease-in-out infinite"></div>').join('') + '</div>';

  const H1 = (text, extra) => '<h1 style="margin:0;font-size:36px;line-height:1;font-weight:900;letter-spacing:-1.2px;color:#0d1117;' + (extra || '') + '">' + text + '</h1>';
  // Every other tab: the title at 40px, one optional control on its row, no logo or photo
  const titleHead = (title, right, below) => '<header style="background:#fff;padding:40px 18px 16px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' + title + (right || '') + '</div>' + (below || '') + '</header>';
  const scopePicker = (key, cur, pick, label, mode) => {
    const big = mode === 'big', pill = mode === 'pill';
    const open = state.menu === key, g = groupById(cur);
    const row = (id, name) => {
      const onIt = (id || null) === (cur || null);
      return '<div ' + on((e) => { stop(e); pick(id); }) + ' style="display:flex;align-items:center;min-height:42px;padding:0 12px;border-radius:12px;background:' + (onIt ? '#f3f1fe' : 'transparent') + ';font-size:15px;font-weight:' + (onIt ? 900 : 700) + ';color:' + (onIt ? '#5b4ae8' : '#0d1117') + ';cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</div>';
    };
    const name = g && g.role ? g.name : 'All groups';
    return '<div data-menu style="position:relative;min-width:0">' +
      '<div ' + on((e) => { stop(e); setState({ menu: open ? null : key }); }) + ' aria-label="' + label + '" aria-expanded="' + open + '" style="' + (pill ? 'display:flex;align-items:center;gap:8px;min-height:44px;padding:0 14px 0 16px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);font-size:15px;font-weight:800;color:#0d1117;cursor:pointer' : 'display:flex;align-items:center;gap:' + (big ? 8 : 5) + 'px;min-height:' + (big ? 44 : 40) + 'px;cursor:pointer;min-width:0') + '">' +
        (pill ? '<span>' + esc(name) + '</span>' + I.chevD(14, '#0d1117', 2.8) : big ? '<span style="font-size:32px;line-height:1.05;font-weight:900;letter-spacing:-1px;color:#0d1117">' + esc(name) + '</span>' + I.chevD(20, '#0d1117', 2.6)
          : '<span style="font-size:14px;font-weight:800;color:#454b55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px">' + esc(name) + '</span>' + I.chevD(12, '#454b55', 2.8)) +
      '</div>' +
      (open
        ? '<div role="menu" aria-label="' + label + '" style="position:absolute;top:calc(100% + 6px);' + (big ? 'left:-4px' : pill ? 'left:0' : 'right:-50px') + ';z-index:25;width:' + (big ? 290 : 230) + 'px;padding:6px;border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(15,18,25,.18), 0 0 0 1px #e6e7eb;animation:popIn 160ms ease both">' +
            row(null, 'All groups') + groupsInOrder().map(x => row(x.id, x.name)).join('') + '</div>'
        : '') +
    '</div>';
  };

  // Tiles · List · Grid switcher (Your plans and group pages)
  const VIEW_ICONS = {
    tiles: '<rect x="4" y="4.5" width="16" height="6" rx="1.6"/><rect x="4" y="13.5" width="16" height="6" rx="1.6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="3"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
    month: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01" stroke-width="3"/>'
  };
  const VIEW_NAMES = { tiles: 'Tiles', list: 'List', grid: 'Grid', month: 'Month' };
  // The current view's icon opens a menu (Your schedule and group pages); it sits on the first month row
  const viewPicker = (key, cur, set, views) => {
    const open = state.menu === key, icon = (k, c) => svg(17, 'fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round"', VIEW_ICONS[k]);
    return '<div data-menu style="position:relative;flex:0 0 auto">' +
      '<div ' + on((e) => { stop(e); setState({ menu: open ? null : key }); }) + ' aria-label="View: ' + VIEW_NAMES[cur] + '" aria-haspopup="menu" aria-expanded="' + open + '" style="display:flex;align-items:center;gap:4px;min-height:40px;padding:0 6px;color:#6b7280;cursor:pointer">' + icon(cur, 'currentColor') + I.chevD(12, 'currentColor', 2.8) + '</div>' +
      (open
        ? '<div role="menu" aria-label="View" style="position:absolute;top:calc(100% + 4px);right:0;z-index:25;min-width:160px;padding:6px;border-radius:16px;background:#fff;border:1px solid #eceef2;box-shadow:0 18px 44px rgba(15,18,25,.2);animation:popIn 160ms ease both">' +
            (views || VIEWS).map(k => '<div ' + on((e) => { stop(e); set(k); }) + ' style="display:flex;align-items:center;gap:10px;min-height:42px;padding:0 10px;border-radius:10px;cursor:pointer">' + icon(k, '#6b7280') +
              '<span style="flex:1;font-size:15px;font-weight:' + (k === cur ? 900 : 700) + ';color:' + (k === cur ? '#5b4ae8' : '#0d1117') + '">' + VIEW_NAMES[k] + '</span>' + (k === cur ? I.check(16, '#5b4ae8', 2.6) : '') + '</div>').join('') + '</div>'
        : '') +
    '</div>';
  };

  // Photo cards: the date line, title and place over the photo
  const PIN_SM = svg(11, stroke('currentColor', 2.6) + ' style="flex:0 0 11px"', '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>');
  const FLAG_SM = svg(11, stroke('currentColor', 2.6), '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>');
  const HAND_SM = svg(11, stroke('currentColor', 2.6), '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-3a2 2 0 0 0-4 0"/>');
  const PHOTO_GRAD = '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.92) 0%, rgba(13,17,23,.4) 45%, rgba(13,17,23,0) 75%)"></div>';
  const overlay = (s, ink, small, line, place) => '<div style="position:absolute;left:' + (small ? 10 : 14) + 'px;right:' + (small ? 10 : 14) + 'px;bottom:' + (small ? 9 : 12) + 'px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.3)">' +
    '<div style="font-size:10.5px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:' + (!line && s.planned && !s.dayDate ? TBD_ON_PHOTO : ink) + '">' + esc(line || dateLineOf(s)) + '</div>' +
    '<div style="margin-top:2px;font-size:' + (small ? '15px;line-height:1.18;letter-spacing:-.3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' : '20px;line-height:1.12;letter-spacing:-.4px;text-wrap:pretty') + ';font-weight:900">' + esc(s.text) + '</div>' +
    '<div style="margin-top:' + (small ? 3 : 4) + 'px;display:flex;align-items:center;gap:' + (small ? 4 : 5) + 'px;font-size:' + (small ? 11 : 12.5) + 'px;font-weight:700;color:rgba(255,255,255,.88);min-width:0">' + PIN_SM + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (s.spot || place ? esc(s.spot || place) : tbdSpan(spotTbd(s), TBD_ON_PHOTO)) + '</span></div>' +
  '</div>';
  // Sections by month, and within them by day (list views)
  const byMonth = (list, undatedLabel) => {
    const secs = [];
    list.forEach(s => {
      const label = s.dayDate ? monthLabel(s.dayDate) : undatedLabel;
      let z = secs.find(q => q.label === label);
      if (!z) { z = { label, items: [], days: [] }; secs.push(z); }
      z.items.push(s);
      const key = s.dayDate ? fmtDay(s.dayDate) : label;
      let d = z.days.find(q => q.key === key);
      if (!d) { d = { key, items: [] }; z.days.push(d); }
      d.items.push(s);
    });
    return secs.sort((a, b) => (a.label === undatedLabel) - (b.label === undatedLabel));
  };
  // "Date to be decided" reads amber (Round 65d), and the month grid's strip scrolls to it
  const monthHead = (label, right) => { const tbd = label === 'Date to be decided';
    return '<div' + (tbd ? ' data-sec-tbd' : '') + ' style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 4px;scroll-margin-top:12px"><h3 style="margin:0;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:' + (tbd ? '#8f6405' : '#0d1117') + '">' + esc(label) + '</h3>' + (right || '') + '</div>'; };

  // The helping list ("YOU'RE HELPING:"), two at a time with "+N more"
  const helpBlock = (s, withTime, small) => {
    const mine = myClaims(s);
    if (!mine.length) return '';
    const open = !!state.taskOpen[s.id], shown = open || mine.length <= 2 ? mine : mine.slice(0, 2);
    const f = small ? [9.5, 12.5, 5, 11] : [10.5, 14, 6, 12];   // label, item, dot, time chip
    return '<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:' + f[0] + 'px;font-weight:900;letter-spacing:.9px;color:#8f6405">YOU’RE HELPING:</span>' +
      shown.map(it => '<div style="display:flex;align-items:center;gap:8px;font-size:' + f[1] + 'px;font-weight:700;color:#3d2a00"><span style="flex:0 0 ' + f[2] + 'px;width:' + f[2] + 'px;height:' + f[2] + 'px;border-radius:999px;background:#e8a71c"></span><span style="flex:1;min-width:0">' + esc(it.item) + '</span>' +
        (withTime && it.time ? '<span style="flex:0 0 auto;padding:2px 8px;border-radius:999px;background:#fdf1d6;font-size:' + f[3] + 'px;font-weight:800;color:#8f6405">' + fmtTime(it.time) + '</span>' : '') + '</div>').join('') +
      (mine.length > 2 ? '<span ' + on((e) => { stop(e); setState({ taskOpen: Object.assign({}, state.taskOpen, { [s.id]: !open }) }); }) + ' style="align-self:flex-start;display:flex;align-items:center;gap:4px;min-height:32px;padding:0 2px;font-size:13px;font-weight:800;color:#8f6405;cursor:pointer">' +
        (open ? 'Show less' : '+' + (mine.length - 2) + ' more') + svg(12, stroke('#c28a12', 3) + ' style="transform:' + (open ? 'rotate(180deg)' : 'none') + '"', '<path d="M6 9l6 6 6-6"/>') + '</span>' : '') +
    '</div>';
  };

  // The organizer dashboard on plans you lead: Going · Maybe · Sign-ups, and an Actions tile
  const ORG_ICONS = {
    going: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 19a5.5 5.5 0 0 0-2.5-4.6"/>',
    maybe: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.4M12 16.8h.01"/>',
    sign: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.3 1.3L7 5M3.5 12l1.3 1.3L7 11M3.5 18l1.3 1.3L7 17"/>'
  };
  const orgRing = (frac, color, icon, val, label, aria) => {
    const C = 2 * Math.PI * 22;
    return '<div aria-label="' + esc(aria) + '" style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0">' +
      '<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center">' +
        '<svg width="40" height="40" viewBox="0 0 52 52" aria-hidden="true" style="position:absolute;inset:0;transform:rotate(-90deg)"><circle cx="26" cy="26" r="22" fill="#fff" stroke="#eceef2" stroke-width="5"/>' +
          (frac > 0 ? '<circle cx="26" cy="26" r="22" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round"' + (frac >= 1 ? '' : ' stroke-dasharray="' + (C * frac).toFixed(1) + ' ' + C.toFixed(1) + '"') + '/>' : '') + '</svg>' +
        svg(14, stroke('#3b4150', 2.2) + ' style="position:absolute"', icon) +
      '</div>' +
      '<div aria-hidden="true" style="display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0"><span style="font-size:13px;font-weight:900;color:#0d1117">' + esc(val) + '</span><span style="font-size:10.5px;font-weight:700;color:#6b7280">' + label + '</span></div>' +
    '</div>';
  };
  const leadDash = (s) => {
    const g = going(s).length, m = maybes(s).length, f = signupFill(s), acts = nextSteps(s), both = g + m;
    const rings = orgRing(g ? g / both : 0, g && g === both ? '#149a4b' : '#e8a71c', ORG_ICONS.going, String(g), 'Going', g + ' going') +
      orgRing(m ? m / both : 0, '#e8a71c', ORG_ICONS.maybe, String(m), 'Maybe', m + ' maybe') +
      (f.counted ? orgRing(f.filled / f.needed, f.open <= 0 ? '#149a4b' : '#e8a71c', ORG_ICONS.sign, f.filled + '/' + f.needed, 'Sign-ups', 'Sign-ups: ' + f.filled + ' of ' + f.needed)
        : orgRing(0, '', ORG_ICONS.sign, '—', 'Sign-ups', 'No sign-up list'));
    const tile = acts.length
      ? '<div aria-label="' + acts.length + (acts.length === 1 ? ' action' : ' actions') + '" style="flex:0 0 92px;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:10px;border-radius:14px;background:#eeebff">' +
          '<div style="display:flex;align-items:center;justify-content:space-between">' + svg(18, stroke('#5b4ae8', 2.3), '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z"/>') +
            '<span style="display:flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:11.5px;font-weight:900">' + acts.length + '</span></div>' +
          '<span style="margin-top:4px;font-size:12.5px;line-height:1.15;font-weight:900;color:#2a1f8f">Actions</span>' +
          '<span style="display:flex;align-items:center;gap:2px;font-size:11px;font-weight:800;color:#5b4ae8">Review' + I.chevR(10, '#5b4ae8', 3.2) + '</span></div>'
      : '<div aria-label="All set" style="flex:0 0 92px;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:10px;border-radius:14px;background:#e7f6ec">' + svg(18, stroke('#0f7a3c', 3), '<path d="M5 12.5 10 17l9-10"/>') +
          '<span style="margin-top:4px;font-size:12.5px;line-height:1.15;font-weight:900;color:#0f7a3c">All set</span><span style="font-size:11px;font-weight:700;color:#3f7a55">No actions</span></div>';
    return '<div style="display:flex;align-items:stretch;gap:10px;width:100%"><div style="flex:1;min-width:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:2px 0">' + rings + '</div>' + tile + '</div>';
  };

  const leadChip = (small, n) => '<div aria-label="You’re leading" style="position:absolute;top:' + (small ? 8 : 12) + 'px;right:' + (small ? 8 : 12) + 'px;display:flex;align-items:center;gap:3px;height:' + (small ? 22 : 24) + 'px;padding:0 8px 0 6px;border-radius:999px;background:#5b4ae8;box-shadow:0 1px 4px rgba(0,0,0,.3);font-size:' + (small ? 10.5 : 11.5) + 'px;font-weight:900;color:#fff">' + FLAG_SM + (n ? 'Leading · ' + n + ' to do' : 'Leading') + '</div>';

  // An idea's four readiness steps (Your ideas): a ring fills as it comes together, then goes solid green
  const STEP_ICON = {
    cal: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/>',
    people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.5-3 2.7-4.7 5.5-4.7s5 1.7 5.5 4.7"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M16 14.4c2.4 0 4.1 1.5 4.5 4.1"/>',
    list: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="m3.8 6.5 1.4 1.4 2.3-2.6M3.8 12l1.4 1.4 2.3-2.6"/><path d="M4.5 17.5h1.5"/>'
  };
  const readiness = (s) => {
    const n = s.interested.length, top = s.dateOpts.reduce((m, o) => Math.max(m, o.votes.length), 0), f = signupFill(s);
    return [
      ['cal', 'Date', s.dayDate ? 1 : Math.min(.9, top / Math.max(1, n))],
      ['pin', 'Location', s.spot ? 1 : (s.spotOpts.length || s.pending.some(o => o.kind === 'spot')) ? .5 : 0],
      ['people', 'People', s.minPeople ? Math.min(1, n / s.minPeople) : (n ? 1 : 0)],   // no minimum to set yet: done once anyone's in
      ['list', 'Tasks', f.counted ? f.filled / f.needed : (f.rows ? 1 : 0)]
    ];
  };
  const stepRing = ([icon, label, frac]) => {
    const done = frac >= 1, C = 2 * Math.PI * 16;
    return '<div aria-label="' + label + (done ? ': done' : ': not yet') + '" style="display:flex;flex-direction:column;align-items:center;gap:5px">' +
      (done
        ? '<span style="width:36px;height:36px;border-radius:999px;background:#149a4b;display:flex;align-items:center;justify-content:center">' + svg(16, stroke('#fff', 2.4), '<path d="m5.5 12.5 4.2 4.2 8.8-9.4"/>') + '</span>'
        : '<span style="position:relative;width:36px;height:36px;display:block"><svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" style="position:absolute;inset:0;transform:rotate(-90deg)"><circle cx="18" cy="18" r="16" fill="none" stroke="#eef0f3" stroke-width="3"/>' +
            (frac > 0 ? '<circle cx="18" cy="18" r="16" fill="none" stroke="#e8a71c" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + (C * frac).toFixed(1) + ' ' + C.toFixed(1) + '"/>' : '') + '</svg>' +
            '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">' + svg(16, stroke('#454b55', 2.1), STEP_ICON[icon]) + '</span></span>') +
      '<span aria-hidden="true" style="font-size:11.5px;font-weight:800;color:' + (done ? '#0f7a3c' : '#454b55') + '">' + label + '</span></div>';
  };

  // A plan's photo tile: date line, title, place; the helping list and/or the lead's dashboard below.
  // Ideas (Your ideas) get "IDEA · GROUP" and the readiness steps instead.
  const planTile = (s, o) => {
    o = o || {};
    const lead = isLead(s), help = !lead && myClaims(s).length > 0, g = groupById(s.groupId);
    const body = o.idea ? '<div style="display:flex;justify-content:space-between;padding:12px 22px 14px">' + readiness(s).map(stepRing).join('') + '</div>'
      : (lead || help) ? '<div style="padding:12px 14px 14px;display:flex;flex-direction:column;gap:8px">' + (help ? helpBlock(s, true) : '') + (lead ? leadDash(s) : '') + '</div>' : '';
    return '<div ' + on(() => openSpark(s)) + ' aria-label="' + esc(s.text) + '" data-plan="' + esc(s.text) + '" style="display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<div style="position:relative;height:160px;background:' + photoBg(s) + (o.dim ? ';filter:saturate(.6)' : '') + '">' + PHOTO_GRAD + (lead && !o.noChip && !o.idea ? leadChip(false) : '') +
        overlay(s, o.idea ? '#f3c55a' : lead ? '#cfc9ff' : '#9eecbc', false, o.idea ? 'Idea · ' + (g ? g.name : '') : null, o.idea && g ? g.name : null) + '</div>' + body + '</div>';
  };

  // Your plans / Your ideas: what you run. The title is the switch.
  function viewOwn() {
    const st = state, gid = st.ownGrp && groupById(st.ownGrp) ? st.ownGrp : null, ideas = st.ownTab === 'idea';
    const mine = leadingList(gid);
    const sw = (k, label) => '<span ' + on(() => setState({ ownTab: k, menu: null }), 'tab') + ' aria-selected="' + (st.ownTab === k) + '" style="font-size:30px;line-height:1;font-weight:900;letter-spacing:-1px;color:' + (st.ownTab === k ? '#0d1117' : '#c3c7d0') + ';cursor:pointer">' + label + '</span>';
    const CTA = 'display:flex;align-items:center;gap:6px;min-height:44px;padding:0 16px 0 12px;border:0;border-radius:999px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;';
    const head = titleHead('<div role="tablist" aria-label="Your plans and ideas" style="display:flex;align-items:baseline;gap:16px">' + sw('plan', 'Your plans') + sw('idea', 'Your ideas') + '</div>', '',
      '<div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:10px">' + scopePicker('ownGrp', gid, (id) => setState({ ownGrp: id, menu: null }), 'Group', 'pill') +
        (ideas
          ? '<button type="button" ' + on(() => goCompose()) + ' style="' + CTA + 'background:#f5b428;color:#3d2a00">' + I.plus(14, '#3d2a00', 2.8) + 'Float an idea</button>'
          : '<button type="button" class="hov-primary" ' + on(() => goCompose()) + ' style="' + CTA + 'background:#149a4b;color:#fff">' + I.plus(14, '#fff', 2.8) + 'Post an event</button>') + '</div>');
    const label = (t) => '<div style="padding:0 4px;font-size:14px;font-weight:800;color:#6b7280">' + t + '</div>';
    const empty = (t, sub) => '<div style="' + CARD + ';padding:18px"><div style="font-size:16px;font-weight:800;color:#0d1117">' + t + '</div><div style="margin-top:2px;font-size:14px;line-height:1.45;font-weight:500;color:#6b7280">' + sub + '</div></div>';
    let body;
    if (!st.loaded) body = skeleton(3, 220);
    else if (ideas) {
      const list = mine.filter(x => phaseOf(x) === 'idea').sort((x, y) => y.created - x.created);
      body = list.length ? label('Your ideas') + list.map(x => planTile(x, { idea: true })).join('') : empty('No ideas yet.', 'Float one and see who’s in before you pick a date.');
    } else {
      const up = mine.filter(x => phaseOf(x) === 'plan').sort(byWhen), past = mine.filter(x => phaseOf(x) === 'done').sort((x, y) => byWhen(y, x));
      body = (up.length ? up.map(x => planTile(x, { noChip: true })).join('') : empty('Nothing on the books yet.', 'Post an event and it lives here.')) +
        (past.length ? label('Past events') + past.map(x => planTile(x, { noChip: true, dim: true })).join('') : '');
    }
    return '<div data-screen-label="Your plans & ideas">' + head + '<div style="padding:12px 14px 26px;display:flex;flex-direction:column;gap:12px">' + body + '</div><div style="height:var(--nav-h)"></div></div>';
  }

  // Groups: pinned groups as big cards, the rest as a grid of square tiles
  const newIn = (g) => state.sparks.filter(s => inGroup(s, g.id) && s.createdBy !== state.me && s.created > (g.lastSeen || 0)).length;
  const pinBtn = (g, size) => '<span ' + on((e) => { stop(e); togglePin(g); }) + ' aria-label="' + (g.pinned ? 'Unpin ' : 'Pin ') + esc(g.name) + '" aria-pressed="' + g.pinned + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;' +
    (g.pinned ? 'background:#fff;box-shadow:0 2px 8px rgba(15,18,25,.2)' : 'background:rgba(13,17,23,.35);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.55);opacity:.85') + '">' +
    (g.pinned ? PIN('#5b4ae8', '#5b4ae8').replace(/width="11" height="11"/, 'width="15" height="15"') : PIN('none', '#fff').replace(/width="11" height="11"/, 'width="15" height="15"')) + '</span>';
  const roleChip = (g) => runs(g) ? '<span style="display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;font-size:10.5px;font-weight:900;letter-spacing:.6px;' +
    (g.role === 'owner' ? 'background:#ece9fd;color:#4a3ad4' : 'background:#fdf1d6;color:#8f6405') + '">' + (g.role === 'owner' ? 'OWNER' : 'ADMIN') + '</span>' : '';
  const gearBtn = (g) => runs(g) ? '<span ' + on((e) => { stop(e); openGroupPage(g.id, false, 'groups'); }) + ' aria-label="Edit ' + esc(g.name) + '" style="width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;cursor:pointer">' +
    svg(18, stroke('#fff', 1.9), '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>') + '</span>' : '';
  const GRAD = '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.85), rgba(13,17,23,.1) 60%)"></div>';

  function viewGroups() {
    // Pinned groups get the big photo cards; everything else (all of them, when nothing is pinned) is a tile
    const groups = groupsInOrder(), big = groups.filter(g => g.pinned);
    const rest = groups.filter(g => !g.pinned), hero = groups.find(groupPhoto) || null;   // the header photo: the first of your groups with one
    const newDot = (g) => newIn(g) ? '<span aria-label="New ideas" style="display:inline-block;width:9px;height:9px;border-radius:999px;background:#9d93f7;margin-right:6px;vertical-align:1px"></span>' : '';
    const bigCard = (g) => {
      const size = state.sizes[g.id];
      return '<div ' + on(() => openGroup(g)) + ' aria-label="' + esc(g.name) + '" style="position:relative;height:170px;border-radius:22px;overflow:hidden;background:#e8a71c;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
        (groupPhoto(g) ? photoLayer(groupPhoto(g), g.photoPos, GROUP_POS) : '') + GRAD +
        '<div style="position:absolute;top:12px;left:12px">' + roleChip(g) + '</div>' +
        '<div style="position:absolute;top:10px;right:10px;display:flex;gap:8px">' + gearBtn(g) + pinBtn(g, 36) + '</div>' +
        '<div style="position:absolute;left:16px;right:16px;bottom:12px;color:#fff">' +
          '<div style="font-size:26px;line-height:1.05;font-weight:900;letter-spacing:-.6px">' + newDot(g) + esc(g.name) + '</div>' +
          (size ? '<div style="margin-top:3px;font-size:13px;font-weight:700;color:#dfe2e8">' + size + (size === 1 ? ' member' : ' members') + '</div>' : '') +
        '</div>' +
      '</div>';
    };
    const tile = (g) => '<div ' + on(() => openGroup(g)) + ' aria-label="' + esc(g.name) + '" style="position:relative;aspect-ratio:1 / 1;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.08);background:#e8a71c;cursor:pointer">' + (groupPhoto(g) ? photoLayer(groupPhoto(g), g.photoPos, GROUP_POS) : '') + GRAD +
      '<div style="position:absolute;top:10px;left:10px">' + roleChip(g) + '</div>' +
      '<div style="position:absolute;top:8px;right:8px">' + pinBtn(g, 32) + '</div>' +
      '<div style="position:absolute;left:12px;right:10px;bottom:10px;color:#fff;font-size:16px;line-height:1.15;font-weight:900">' +
        newDot(g) + esc(g.name) + '</div>' +
    '</div>';
    // v6 Update 2: a Calendar-style photo header (YOUR PEOPLE · Groups · N groups), the bell, a white Join pill
    const header = '<header style="position:relative;height:calc(180px + var(--pt));overflow:hidden;background:#2b303a">' +
      (hero ? '<div style="position:absolute;inset:0;overflow:hidden">' + photoLayer(groupPhoto(hero), hero.photoPos, GROUP_POS) + '</div>' : '<div aria-hidden="true" style="position:absolute;inset:0;background:' + bg('/photos/walnut-creek.jpg', '50% 45%') + '"></div>') +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.9) 0%, rgba(13,17,23,.45) 55%, rgba(13,17,23,.25) 100%)"></div>' +
      '<div style="position:absolute;top:calc(14px + var(--pt));right:16px;z-index:2;display:flex;gap:8px">' + bellBtn(true) + '</div>' +
      '<div style="position:absolute;left:18px;right:110px;bottom:16px;z-index:2;color:#fff">' +
        '<div style="font-size:13px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#cfc9ff">Your people</div>' +
        '<h1 style="margin:2px 0 0;font-size:40px;line-height:1;font-weight:900;letter-spacing:-1.4px;color:#fff">Groups</h1>' +
        '<div style="margin-top:6px;font-size:14px;font-weight:700;color:rgba(255,255,255,.88)">' + (state.loaded ? groups.length + (groups.length === 1 ? ' group' : ' groups') : '') + '</div></div>' +
      '<span ' + on(() => openJoin()) + ' aria-label="Join a group" style="position:absolute;right:16px;bottom:18px;z-index:3;display:flex;align-items:center;gap:6px;height:40px;padding:0 16px 0 13px;border-radius:999px;background:#fff;color:#0d1117;font-size:14.5px;font-weight:900;box-shadow:0 6px 16px rgba(13,17,23,.3);cursor:pointer;white-space:nowrap" class="hov-fill-grey">' +
        svg(16, stroke('#0d1117', 2.4), '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>') + 'Join</span>' +
    '</header>';
    const startBox = '<div ' + on(startGroup) + ' aria-label="Start a new group" style="display:flex;align-items:center;justify-content:center;gap:6px;min-height:52px;margin-top:4px;border-radius:14px;border:1.5px dotted #9aa0aa;color:#6b7280;font-size:14.5px;font-weight:800;cursor:pointer">' + I.plus(14, '#6b7280', 2.6) + 'Start a new group</div>';
    return '<div data-screen-label="Groups">' + header +
      '<div style="padding:16px 14px 26px;display:flex;flex-direction:column;gap:12px">' +
        (!state.loaded ? skeleton(2, 200) : groups.length ? big.map(bigCard).join('') : noGroupCard()) +
        (rest.length ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + rest.map(tile).join('') + '</div>' : '') +
        (state.loaded ? startBox : '') +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  const isoOf = (y, m, d) => y + '-' + pad2(m + 1) + '-' + pad2(d);
  const isoAdd = (iso, n) => { const x = new Date(iso + 'T12:00'); x.setDate(x.getDate() + n); return isoOf(x.getFullYear(), x.getMonth(), x.getDate()); };

  // ---------------------------------------------------------------------------
  // v6 (design/spark-hub/README-v6.md): Your tasks · Your schedule · the community Calendar
  // ---------------------------------------------------------------------------

  // Role colours: dot/bar, strip, pill, ink, the date line on photos, the "+N more" sliver
  const R6 = {
    lead: { dot: '#5b4ae8', strip: '#f7f6ff', pill: '#f3f1fe', ink: '#4a3ad4', kick: '#cfc9ff', sliver: '#f9f8ff', word: 'Leading' },
    help: { dot: '#e8a71c', strip: '#fefaef', pill: '#fdf1d6', ink: '#8f6405', kick: '#ffd98a', sliver: '#fefaef', word: 'Helping' },
    go: { dot: '#149a4b', strip: '#f3fbf6', pill: '#e7f6ec', ink: '#0f7a3c', kick: '#9eecbc', sliver: '#f4fbf6', word: 'Going' },
    open: { dot: '#c3c7d0', strip: '#fafafb', pill: '#f2f3f6', ink: '#454b55', kick: '#dfe2e8', sliver: '#fafafb', word: '' }
  };
  const P6 = {
    people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.6a3 3 0 0 1 0 5.8M17.5 14a5 5 0 0 1 3 5"/>',
    maybe: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.4M12 16.8h.01"/>',
    clip: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4.5"/>',
    bell: '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.6 2H4.4L6 16.5Z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    roles: '<path d="M9 6h11M9 12h6M9 18h5"/><path d="M4 6h.01M4 12h.01M4 18h.01"/><path d="M19 15v6M16 18h6"/>',
    tasks: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="m3.5 6.5 1.5 1.5 2.5-3M3.5 12l1.5 1.5 2.5-3M3.5 17.5l1.5 1.5 2.5-3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.5 6.5a1.4 1.4 0 0 1-2 0Z"/><circle cx="8" cy="8" r="1.4"/>',
    sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    bolt: '<path d="M13.2 2.5 6.8 13.4l4.3-.4-1 8.5 7.1-11.3-4.4.4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    person: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'
  };
  const ic6 = (k, size, color, w) => svg(size, stroke(color || 'currentColor', w || 2.2) + ' style="flex:0 0 ' + size + 'px"', P6[k]);
  const chev6 = (size, color, up) => svg(size, stroke(color, 3) + ' style="flex:0 0 ' + size + 'px;transition:transform 160ms;transform:' + (up ? 'rotate(180deg)' : 'none') + '"', '<path d="m6 9 6 6 6-6"/>');

  const daysTo = (s) => s.dayDate ? dayDiff(s.dayDate) : null;
  const helpsOn = (s) => myClaims(s).length > 0;
  const street = (s) => s.spotAddress ? s.spotAddress.split(',')[0] : (s.spot || spotTbd(s));
  // "Today · 7pm", "Tomorrow", "Yesterday", "3 days ago", "Sat, Oct 17 · 6pm"
  const when6 = (s) => {
    if (!s.dayDate) return phaseOf(s) === 'idea' ? 'Idea · ' + ((groupById(s.groupId) || {}).name || 'no date yet') : dateTbd(s);
    const d = dayDiff(s.dayDate), t = s.dayTime ? ' · ' + fmtTime(s.dayTime) : '';
    if (phaseOf(s) === 'idea') return 'Idea · ' + fmtDay(s.dayDate);
    return d === 0 ? 'Today' + t : d === 1 ? 'Tomorrow' + t : d === -1 ? 'Yesterday' : d < 0 ? -d + ' days ago' : fmtDay(s.dayDate) + t;
  };

  // What the lead should do next (the prototype's ownActs). Invites are share links, so nothing counts
  // them: no "N haven't replied · Nudge" or "No one invited yet" (HANDOFF §1 #4).
  const ownActs = (s) => {
    const ph = phaseOf(s), dd = daysTo(s), out = [];
    const review = (who, kind, word) => out.push({ act: firstName(who) + '’s ' + (kind === 'spot' ? 'spot idea' : kind === 'day' ? word + ' idea' : 'idea'), cta: 'Review' });
    if (ph === 'idea') {
      const p = s.pending[0], top = s.dateOpts.slice().sort((a, b) => b.votes.length - a.votes.length)[0], other = s.spotOpts.find(o => o.createdBy !== state.me);
      if (p) review(nameOf(p.userId, p.who), p.kind, 'date');
      else if (!s.spot && other) review(other.who, 'spot');
      if (!s.dayDate && top && top.votes.length) out.push({ act: monthDay(top.dayDate) + ' has ' + top.votes.length + (top.votes.length === 1 ? ' vote' : ' votes'), cta: 'Pick date' });
      else if (!s.dayDate) out.push({ act: 'No date yet', cta: 'Add date' });
      if (!s.spot) out.push({ act: 'No location yet', cta: 'Add spot' });
      if (!s.signups.length) out.push({ act: 'No roles yet', cta: 'Add roles' });
      if (!out.length) out.push({ act: 'Everything’s ready', cta: 'Make it a plan' });
      return out;
    }
    if (ph === 'done') return [{ act: 'Say thanks', cta: 'Thank' }, { act: 'Add photos', cta: 'Add' }];
    const f = signupFill(s);
    if (dd === 0) out.push({ act: 'Post an update', cta: 'Post' });
    if (dd === 1 && !s.autoRemind) out.push({ act: 'Send a reminder', cta: 'Send' });
    s.pending.slice(0, 1).forEach(p => review(nameOf(p.userId, p.who), p.kind, 'time'));
    if (!s.dayDate) out.push({ act: dateTbd(s), cta: s.dateOpts.length ? 'Pick' : 'Add it' });
    if (!s.spot) out.push({ act: spotTbd(s), cta: s.spotOpts.length ? 'Pick' : 'Add it' });
    if (f.open > 0) out.push({ act: f.open + (f.open === 1 ? ' spot open' : ' spots open'), cta: 'Share list' });
    return out;
  };
  // What someone going, maybe, or signed up for (not leading) should keep in mind
  const helpActs = (s) => {
    const my = myRsvp(s), out = [];
    if (!my) out.push({ act: 'Confirm RSVP', cta: 'RSVP' });
    if (my === 'maybe') out.push({ act: 'You said maybe', cta: 'Update RSVP' });
    // Only what you signed up for (owner, 2026-09-29): no location or countdown rows
    myClaims(s).forEach(it => out.push({ act: it.item, cta: spanTime(it) || fmtTime(s.dayTime) || 'Any time', time: true }));
    return out;
  };
  // Your tasks: plans you lead (upcoming, or in the last 3 days) with something to do, what you're helping
  // with (most to-dos first), and the ideas you lead
  const tasksData = () => {
    const mine = state.sparks.filter(inMine);
    const leads = mine.filter(s => isLead(s) && (phaseOf(s) !== 'done' || dayDiff(s.dayDate) >= -3));
    const rank = (s) => phaseOf(s) === 'done' ? 1e6 : daysTo(s) == null ? 5e5 : daysTo(s);
    const plans = leads.filter(s => s.planned).map(s => ({ s, a: ownActs(s) })).filter(z => z.a.length)
      .sort((p, q) => rank(p.s) - rank(q.s) || byWhen(p.s, q.s));
    const ideas = leads.filter(s => !s.planned).sort((a, b) => b.created - a.created);
    const help = mine.filter(s => !isLead(s) && phaseOf(s) === 'plan' && (['going', 'maybe'].indexOf(myRsvp(s)) > -1 || helpsOn(s)))
      .map(s => ({ s, a: helpActs(s) })).filter(z => z.a.length)
      .sort((p, q) => q.a.length - p.a.length || byWhen(p.s, q.s));
    return { plans, ideas, help, leadsAny: leads.some(s => s.planned) };
  };
  const tasksBadge = () => { if (!state.email || !state.loaded) return 0; const d = tasksData(); return d.plans.length + d.help.length; };

  // Leading plans: Going · Maybe · Sign-ups · Reminder (Maybe in place of Invited: invites aren't counted)
  const statsStrip = (s) => {
    const g = going(s).length, m = maybes(s).length, f = signupFill(s), dd = daysTo(s);
    const col = { ok: '#454b55', warn: '#b07a0a', off: '#9aa0ac' };
    const items = [['people', 'Going', String(g), 'ok'], ['maybe', 'Maybe', String(m), 'ok'],
      ['clip', 'Sign-ups', f.counted ? f.filled + '/' + f.needed : '—', !f.counted ? 'off' : f.open <= 0 ? 'ok' : 'warn'],
      ['bell', 'Reminder', dd != null && dd <= 0 ? 'Sent' : s.autoRemind ? (s.dayDate ? monthDay(isoAdd(s.dayDate, -1)) : '—') : 'Off', s.autoRemind || (dd != null && dd <= 0) ? 'ok' : 'warn']];
    return '<div style="display:flex;align-items:center;justify-content:space-between;height:40px;padding:0 30px;border-top:1px solid #f2f3f6;background:#fafafb">' +
      items.map(([k, label, v, c]) => '<span aria-label="' + label + ': ' + esc(v) + '" style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:800;color:' + col[c] + '">' + ic6(k, 14) + esc(v) + '</span>').join('') + '</div>';
  };

  // To-do rows: a role dot, the text, a pill (or a sign-up's time as plain text)
  const actRow = (a, R) => '<div style="display:flex;align-items:center;gap:10px;min-height:46px;padding:9px 12px;border-top:1px solid #f2f3f6">' +
    '<span style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:' + R.dot + '"></span>' +
    '<span style="flex:1 1 0;min-width:0;font-size:14.5px;line-height:1.3;font-weight:700;color:#2a2f38;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(a.act) + '</span>' +
    (a.time ? '<span style="flex:0 0 auto;font-size:13.5px;font-weight:800;color:' + R.ink + '">' + esc(a.cta) + '</span>'
      : '<span style="flex:0 0 auto;display:flex;align-items:center;min-height:28px;padding:0 11px;border-radius:999px;background:' + R.pill + ';color:' + R.ink + ';font-size:13px;font-weight:800;white-space:nowrap">' + esc(a.cta) + '</span>') + '</div>';
  // Two rows, then "+N more ⌄"; a tap anywhere here expands them in place (with two or fewer, it opens the event)
  const actBlock = (s, acts, R, key) => {
    const open = !!state[key][s.id], shown = open || acts.length <= 2 ? acts : acts.slice(0, 2);
    const tap = (e) => { stop(e); if (acts.length < 3) openSpark(s); else setState({ [key]: Object.assign({}, state[key], { [s.id]: !open }) }); };
    return '<div ' + on(tap) + ' aria-label="' + (acts.length < 3 ? 'Open ' + esc(s.text) : open ? 'Show fewer to-dos' : 'Show all ' + acts.length + ' to-dos') + '" aria-expanded="' + (acts.length < 3 ? 'false' : open) + '" style="display:flex;flex-direction:column">' +
      shown.map(a => actRow(a, R)).join('') +
      (acts.length > 2 ? '<div style="height:26px;padding:0 12px;border-top:1px solid ' + R.sliver + ';background:' + R.sliver + ';display:flex;align-items:center;justify-content:center;gap:3px;font-size:12px;font-weight:800;color:' + R.ink + '">' +
        (open ? 'Show less' : '+' + (acts.length - 2) + ' more') + chev6(11, R.ink, open) + '</div>' : '') +
    '</div>';
  };

  // A photo banner: title (up to two lines, growing upward) and the date line, with a chevron
  const banner6 = (s, R, h) => '<div style="position:relative;height:' + (h || 92) + 'px;background:' + photoBg(s) + '">' +
    '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.94) 0%, rgba(13,17,23,.55) 60%, rgba(13,17,23,.3) 100%)"></div>' +
    '<span aria-hidden="true" style="position:absolute;right:10px;top:0;bottom:0;display:flex;align-items:center;opacity:.85">' + I.chevR(22, '#fff', 2.6) + '</span>' +
    '<div style="position:absolute;left:14px;right:40px;bottom:11px;display:flex;flex-direction:column;gap:3px;color:#fff">' +
      '<div style="font-size:18px;line-height:1.15;font-weight:900;letter-spacing:-.3px;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(s.text) + '</div>' +
      '<div style="font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:' + (s.planned && !s.dayDate ? TBD_ON_PHOTO : R.kick) + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(when6(s)) + '</div>' +
    '</div></div>';

  // An idea's four checkpoints: Date · Location · Roles→Helpers · People
  const ideaSteps6 = (s) => {
    const n = s.interested.length, top = s.dateOpts.reduce((m, o) => Math.max(m, o.votes.length), 0), rows = s.signups;
    const slots = rows.reduce((a, r) => a + (r.need || 1), 0), filled = rows.reduce((a, r) => a + Math.min(r.need || 1, r.claims.length), 0);
    const roles = rows.length > 0;
    return [
      { label: 'Date', icon: 'cal', p: s.dayDate ? 1 : Math.min(.9, top / Math.max(1, n)), todo: 'Pick a date', done: 'Date set', sec: 'sec-dates' },
      { label: 'Location', icon: 'pin', p: s.spot ? 1 : (s.spotOpts.length || s.pending.some(o => o.kind === 'spot')) ? .5 : 0, todo: 'Pick a location', done: 'Location set', sec: 'sec-loc' },
      { label: roles ? 'Helpers' : 'Roles', icon: roles ? 'clip' : 'roles', p: !roles ? 0 : filled >= slots ? 1 : .25 + .75 * (filled / slots) * .99, todo: roles ? 'Get helpers' : 'Add essential roles', done: 'Helpers on board', sec: 'sec-tasks' },
      { label: 'People', icon: 'people', p: s.minPeople ? Math.min(1, n / s.minPeople) : Math.min(.9, n / 10), todo: 'Get more people interested', done: 'Enough people in', sec: 'sec-people' }
    ];
  };
  const ring6 = (st, size) => {
    const done = st.p >= 1, r = size * 17 / 40, C = 2 * Math.PI * r, sw = size > 34 ? 3.5 : 3;
    return done
      ? '<span style="flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:#149a4b;display:flex;align-items:center;justify-content:center">' + svg(Math.round(size * .45), stroke('#fff', 3.4), P6.check) + '</span>'
      : '<span style="position:relative;flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;display:flex;align-items:center;justify-content:center">' +
          '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true" style="position:absolute;inset:0;transform:rotate(-90deg)"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#eef0f3" stroke-width="' + sw + '"/>' +
          '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#e8a71c" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + (C * Math.max(.04, st.p)).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>' +
          ic6(st.icon, size > 34 ? 16 : 13, '#6b7280', 2) + '</span>';
  };
  // Opens the event scrolled to that part (Dates, Location, Sign-ups, who's interested)
  const openToSection = (s, sec) => {
    openSpark(s);
    setTimeout(() => {
      const el = document.getElementById(sec), sc = scroller();
      if (el && sc) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 72;
    }, 60);
  };

  // Headers: the bell opens Notifications (Profile is only on the tab bar since Update 3)
  const bellBtn = (frosted) => {
    const n = state.email ? unreadCount() : 0;
    return '<span ' + on(() => setState({ notifSheet: true, menu: null })) + ' aria-label="' + (n ? 'Notifications, ' + n + ' new' : 'Notifications') + '" style="position:relative;flex:0 0 44px;width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;' +
      (frosted ? 'background:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff' : 'background:#f2f3f6;color:#0d1117') + '">' + ic6('bell', 21, 'currentColor', 1.9) +
      (n ? '<span aria-hidden="true" style="position:absolute;top:-3px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#e2556b;color:#fff;font-size:10.5px;font-weight:900;display:flex;align-items:center;justify-content:center;box-sizing:border-box">' + (n > 9 ? '9+' : n) + '</span>' : '') + '</span>';
  };
  const openProfileSheet = () => needSignIn(() => setState({ profSheet: true, menu: null }), 'profile');
  // Search (the Calendar's search sheet: every upcoming event in your groups)
  const openSearch = () => { setState({ cSearch: true, menu: null }); setTimeout(() => { const f = document.querySelector('[data-csearch]'); if (f) f.focus(); }, 30); };
  const searchBtn = () => '<span ' + on(openSearch) + ' aria-label="Search events" style="flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#f2f3f6;color:#0d1117;display:flex;align-items:center;justify-content:center;cursor:pointer">' + ic6('search', 20, 'currentColor', 2.1) + '</span>';
  const head6 = (title, left) => '<header style="background:#fff;padding:14px 16px;display:flex;align-items:center;gap:12px">' + (left || '') +
    '<h1 style="flex:1 1 0;min-width:0;margin:0;font-size:30px;line-height:1;font-weight:900;letter-spacing:-1px;color:#0d1117">' + title + '</h1>' +
    '<div style="flex:0 0 auto;display:flex;gap:8px">' + (state.email ? searchBtn() : '') + bellBtn() + '</div></header>';

  // A slide-up sheet (v6): from a fixed top to the bottom, a white header block with the grab handle
  const sheet6 = (label, close, head, body, top, headPad) => '<div class="v6-scrim"' + (close ? ' data-scrim="' + reg(close) + '"' : '') + '>' +
    '<div role="dialog" aria-modal="true" aria-label="' + esc(label) + '" data-screen-label="' + esc(label) + '" class="v6-sheet" style="--sheet-top:' + (top || 64) + 'px">' +
      '<div style="position:relative;flex:0 0 auto;background:#fff;padding:' + (headPad || '8px 16px 14px') + '"><div aria-hidden="true" style="width:40px;height:5px;border-radius:999px;background:#dcdfe6;margin:0 auto 10px"></div>' + head + '</div>' +
      '<div class="v6-sheet-body">' + body + '</div>' +
    '</div></div>';
  const closeX = (fn, extra) => '<span ' + on(fn) + ' aria-label="Close" style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer;' + (extra || '') + '">' + I.x(16, '#0d1117', 2.4) + '</span>';

  // ---- Screen 1: Your tasks (the default screen) ----------------------------------------------
  const secHead6 = (n, color, title, all) => '<div style="display:flex;align-items:center;gap:7px;padding:0 4px">' +
    '<span style="min-width:19px;height:19px;padding:0 6px;border-radius:999px;background:' + color + ';color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center">' + n + '</span>' +
    '<h2 style="margin:0;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + title + '</h2>' +
    (all ? '<span ' + on(all) + ' aria-label="View all ' + title.toLowerCase() + '" style="margin-left:auto;display:flex;align-items:center;gap:3px;min-height:32px;padding:0 2px 0 8px;font-size:14px;font-weight:800;color:#6b7280;cursor:pointer">View all' + I.chevR(12, 'currentColor', 3) + '</span>' : '') + '</div>';
  const inviteCard = (icon, title, sub, fn) => '<div ' + on(fn) + ' class="hov-grey-fill" style="display:flex;align-items:center;gap:12px;padding:14px 14px 14px 16px;border-radius:18px;background:#f4f5f7;box-shadow:inset 0 0 0 1.5px #dcdfe6;cursor:pointer">' +
    '<span style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;display:flex;align-items:center;justify-content:center">' + icon + '</span>' +
    '<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:15.5px;font-weight:800;color:#0d1117">' + title + '</span><span style="font-size:13.5px;line-height:1.35;font-weight:600;color:#6b7280">' + sub + '</span></div>' +
    I.chevR(16, '#b9bcc4', 2.6) + '</div>';
  const note6 = (t) => '<div style="' + CARD + ';padding:16px 18px;font-size:15px;line-height:1.45;font-weight:600;color:#6b7280">' + t + '</div>';
  const CARD6 = 'align-self:flex-start;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer';

  const ideaStepGrid = (s) => '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;justify-items:center;padding:10px 14px 11px;border-top:1px solid #f2f3f6">' +
    ideaSteps6(s).map(st => '<span ' + on((e) => { stop(e); openToSection(s, st.sec); }) + ' aria-label="' + st.label + ': ' + (st.p >= 1 ? st.done : st.todo) + '" style="display:flex;flex-direction:column;align-items:center;gap:5px;min-width:56px;padding:2px 0;border-radius:12px;cursor:pointer">' +
      ring6(st, 40) + '<span style="font-size:11.5px;font-weight:800;color:' + (st.p >= 1 ? '#0f7a3c' : '#454b55') + '">' + st.label + '</span></span>').join('') + '</div>';

  function viewTasks() {
    const st = state;
    const wrap = (inner) => '<div data-screen-label="Your tasks">' + head6('Your tasks') +
      '<div style="padding:14px 14px 22px;display:flex;flex-direction:column;gap:16px">' + inner + '</div><div style="height:var(--nav-h)"></div></div>';
    if (!st.loaded) return wrap(skeleton(2, 200));
    if (!myGroups().length) return wrap(goneCard() + noGroupCard());
    const d = tasksData();
    const row = (cards) => '<div class="snap-row" style="margin:0 -14px">' + cards + '</div>';
    const leadCard = (z) => '<div ' + on(() => openSpark(z.s)) + ' data-task="' + esc(z.s.text) + '" style="' + CARD6 + '">' + banner6(z.s, R6.lead) +
      (phaseOf(z.s) === 'plan' ? statsStrip(z.s) : '') + actBlock(z.s, z.a, R6.lead, 'dashOpen') + '</div>';
    const helpCard = (z) => '<div ' + on(() => openSpark(z.s)) + ' data-task="' + esc(z.s.text) + '" style="' + CARD6 + '">' + banner6(z.s, R6.go) + actBlock(z.s, z.a, R6.go, 'dashOpen') + '</div>';
    const ideaCard = (s) => '<div ' + on(() => openSpark(s)) + ' data-task="' + esc(s.text) + '" style="' + CARD6 + '">' + banner6(s, R6.help) + ideaStepGrid(s) + '</div>';
    const lead = d.leadsAny
      ? '<section aria-label="Leading" style="display:flex;flex-direction:column;gap:8px">' + secHead6(d.plans.length, '#5b4ae8', 'Leading', d.plans.length ? () => setState({ dashAll: 'lead' }) : null) +
          (d.plans.length ? row(d.plans.map(leadCard).join('')) : note6('Nothing needs you on the events you lead.')) + '</section>'
      : '';
    const help = '<section aria-label="Helping" style="display:flex;flex-direction:column;gap:8px">' + secHead6(d.help.length, '#149a4b', 'Helping', d.help.length ? () => setState({ dashAll: 'help' }) : null) +
      (d.help.length ? row(d.help.map(helpCard).join(''))
        : inviteCard(ic6('heart', 18, '#454b55', 2.4), 'Find something to help with', 'Leads in your groups need a hand. Sign up to bring something or pitch in.', () => go('calendar'))) + '</section>';
    const invite = d.leadsAny ? '' : '<section aria-label="Leading" style="display:flex;flex-direction:column;gap:8px">' + secHead6(0, '#5b4ae8', 'Leading') +
      inviteCard(I.plus(18, '#454b55', 2.6), 'Start an event', 'You’re not leading anything yet. Got an idea for your group?', () => goCompose()) + '</section>';
    const ideas = d.ideas.length ? '<section aria-label="Ideas" style="display:flex;flex-direction:column;gap:8px">' + secHead6(d.ideas.length, '#e8a71c', 'Ideas', () => setState({ dashAll: 'idea' })) +
      row(d.ideas.map(ideaCard).join('')) + '</section>' : '';
    return wrap(goneCard() + draftsSection() + lead + help + invite + ideas);
  }

  // "View all": one card per event with every to-do (ideas: the four checkpoints as rows)
  function viewDashAll() {
    const k = state.dashAll, d = tasksData(), close = () => setState({ dashAll: null });
    const title = { lead: 'Leading', help: 'Helping', idea: 'Ideas' }[k], R = k === 'lead' ? R6.lead : k === 'help' ? R6.go : R6.help;
    const list = k === 'lead' ? d.plans : k === 'help' ? d.help : d.ideas.map(s => ({ s, a: [] }));
    const thumb = (s) => '<span aria-hidden="true" style="flex:0 0 40px;width:40px;height:40px;border-radius:10px;background:' + photoBg(s) + '"></span>';
    const stepRows = (s) => ideaSteps6(s).map(st => '<div ' + on((e) => { stop(e); openToSection(s, st.sec); }) + ' style="display:flex;align-items:center;gap:12px;min-height:50px;padding:8px 12px;border-top:1px solid #f2f3f6;cursor:pointer">' +
      ring6(st, 30) + '<span style="flex:1;min-width:0;font-size:14.5px;font-weight:700;color:' + (st.p >= 1 ? '#8a909b' : '#2a2f38') + '">' + (st.p >= 1 ? st.done : st.todo) + '</span>' + I.chevR(14, '#b9bcc4', 2.6) + '</div>').join('');
    const card = (z) => '<div ' + on(() => openSpark(z.s)) + ' data-task="' + esc(z.s.text) + '" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px">' + thumb(z.s) +
        '<div style="flex:1;min-width:0"><div style="font-size:15px;line-height:1.25;font-weight:800;color:#0d1117;text-wrap:balance">' + esc(z.s.text) + '</div>' +
        '<div style="margin-top:2px;font-size:12.5px;font-weight:700;color:' + R.ink + '">' + esc(when6(z.s)) + '</div></div>' + I.chevR(14, '#b9bcc4', 2.6) + '</div>' +
      (k === 'lead' && phaseOf(z.s) === 'plan' ? statsStrip(z.s) : '') +
      (k === 'idea' ? stepRows(z.s) : z.a.map(a => actRow(a, R)).join('')) + '</div>';
    return sheet6(title, close,
      '<div style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:999px;background:' + R.dot + '"></span>' +
        '<h2 style="flex:1;margin:0;font-size:26px;line-height:1.1;font-weight:900;letter-spacing:-.6px;color:#0d1117">' + title + '</h2>' + closeX(close) + '</div>',
      '<div style="padding:14px 14px 30px;display:flex;flex-direction:column;gap:10px">' + (list.length ? list.map(card).join('') : '<div style="' + CARD + ';padding:26px 16px;text-align:center;font-size:15px;font-weight:700;color:#6b7280">Nothing here right now.</div>') + '</div>');
  }

  // ---- Screen 2: Your schedule ----------------------------------------------------------------
  // Upcoming plans you lead, said Going / Maybe to, or signed up to help with
  const schedList = () => state.sparks.filter(s => inMine(s) && phaseOf(s) === 'plan' && (isLead(s) || ['going', 'maybe'].indexOf(myRsvp(s)) > -1 || helpsOn(s))).sort(byWhen);
  // Your part in a plan: its colours, word, icon, what's left to do and the strip's right side
  const partOf = (s, cal) => {
    const my = myRsvp(s);
    if (isLead(s)) return { k: 'lead', R: R6.lead, word: 'Leading', icon: 'bolt', rows: ownActs(s) };
    if (helpsOn(s)) return { k: 'help', R: R6.help, word: 'Helping', icon: 'clip', rows: helpActs(s) };
    if (my === 'going' || my === 'maybe') return { k: 'go', R: R6.go, word: my === 'maybe' ? 'Maybe' : 'Going', icon: 'check', rows: [], right: my === 'maybe' ? 'Update RSVP' : 'Change RSVP' };
    return cal ? { k: 'open', R: R6.open, word: '', rows: [], right: 'RSVP' } : null;
  };
  // The strip under a card: your role on the left; tasks (tap to expand in place), All set, or Change / Update RSVP
  const strip6 = (s, P, h, cal) => {
    const open = !!state.schedOpen[s.id] && P.rows.length > 0;
    const expands = P.rows.length > 0 && (P.k !== 'lead' || !cal);
    const tap = (e) => { stop(e); if (!expands) openSpark(s); else setState({ schedOpen: Object.assign({}, state.schedOpen, { [s.id]: !open }) }); };
    const f = signupFill(s), n = going(s).length;
    let left, right;
    if (P.k === 'open') {
      left = f.open > 0 ? '<b style="font-weight:800">' + f.open + (f.open === 1 ? ' spot left' : ' spots left') + '</b><span style="font-weight:600;color:#8a909b"> · ' + n + ' going</span>' : '<b style="font-weight:800">' + n + ' going</b>';
      right = '<span style="color:#0d1117">RSVP</span>';
    } else {
      left = '<span style="display:flex;align-items:center;gap:6px">' + (h > 30 ? ic6(P.icon, 14, P.R.ink, 2.4) : '') + P.word + '</span>';
      const word = P.right || (P.rows.length ? (cal && P.k === 'help' ? String(P.rows.length) : cal && P.k === 'lead' ? 'Manage' : P.rows.length + (P.rows.length === 1 ? ' task' : ' tasks')) : 'All set');
      right = '<span style="display:flex;align-items:center;gap:4px">' + (open ? '' : word) + (expands || P.k === 'go' ? chev6(11, P.R.ink, open) : '') + '</span>';
    }
    return '<div ' + on(tap) + ' aria-expanded="' + open + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;height:' + h + 'px;padding:0 14px;background:' + P.R.strip + ';border-top:1px solid ' + P.R.strip + ';font-size:' + (h > 30 ? 13.5 : 12) + 'px;font-weight:800;color:' + P.R.ink + ';cursor:pointer">' + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + left + '</span>' + right + '</div>' +
      (open ? '<div style="display:flex;flex-direction:column;background:#fff">' + P.rows.map(a => actRow(a, P.R)).join('') + '</div>' : '');
  };
  // Tiles: the photo with date, title and place; the strip under it
  const tile6 = (s, P, h, cal) => {
    const g = groupById(s.groupId);
    return '<div ' + on(() => openSpark(s)) + ' data-plan="' + esc(s.text) + '" aria-label="' + esc(s.text) + '" style="border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<div style="position:relative;height:' + h + 'px;background:' + photoBg(s) + '">' +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.95) 0%, rgba(13,17,23,.65) 45%, rgba(13,17,23,.3) 100%)"></div>' +
        (cal && g ? '<span style="position:absolute;top:10px;left:10px;display:flex;align-items:center;height:24px;padding:0 9px;border-radius:999px;background:rgba(13,17,23,.4);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-size:11.5px;font-weight:800;color:#fff">' + esc(groupsLabel(s)) + '</span>' : '') +
        '<div style="position:absolute;left:16px;right:16px;bottom:14px;color:#fff;display:flex;flex-direction:column;gap:3px">' +
          '<div style="font-size:13px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:' + (!s.dayDate ? TBD_ON_PHOTO : P.k === 'open' ? '#dfe2e8' : P.R.kick) + '">' + esc(when6(s)) + '</div>' +
          '<div style="font-size:25px;line-height:1.05;font-weight:900;letter-spacing:-.6px;text-wrap:balance">' + esc(s.text) + '</div>' +
          '<div style="display:flex;align-items:center;gap:5px;font-size:14.5px;font-weight:700;color:rgba(255,255,255,.9);min-width:0">' + ic6('pin', 14, 'currentColor', 2.3) + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (s.spot ? esc(s.spot) : tbdSpan(spotTbd(s), TBD_ON_PHOTO)) + '</span></div>' +
        '</div></div>' + strip6(s, P, 40, cal) + '</div>';
  };
  // List: date block, role bar, title, time · place (and on the Calendar, a photo) over the strip
  const listCard6 = (s, P, cal) => {
    const dp = s.dayDate ? dateParts(s.dayDate) : null;
    return '<div ' + on(() => openSpark(s)) + ' data-plan="' + esc(s.text) + '" aria-label="' + esc(s.text) + '" style="border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px">' +
        '<div style="flex:0 0 40px;display:flex;flex-direction:column;align-items:center">' + (dp ? '<span style="font-size:10.5px;font-weight:900;letter-spacing:.6px;color:#6b7280">' + dp.dow + '</span><span style="font-size:20px;line-height:1.1;font-weight:900;color:#0d1117">' + dp.day + '</span>'
          : '<span style="font-size:10.5px;font-weight:900;letter-spacing:.6px;color:#8f6405">TBD</span><span style="font-size:20px;line-height:1.1;font-weight:900;color:#8f6405">?</span>') + '</div>' +
        '<span aria-hidden="true" style="flex:0 0 3px;align-self:stretch;border-radius:999px;background:' + P.R.dot + '"></span>' +
        '<div style="flex:1;min-width:0"><div style="font-size:15px;line-height:1.3;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(s.text) + '</div>' +
          '<div style="font-size:12.5px;font-weight:600;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + [s.dayDate ? esc(fmtTime(s.dayTime)) : tbdSpan(dateTbd(s)), s.spot ? esc(cal ? street(s) : s.spot) : tbdSpan(spotTbd(s))].filter(Boolean).join(' · ') + '</div></div>' +
        (cal ? '<span aria-hidden="true" style="flex:0 0 44px;width:44px;height:44px;border-radius:10px;background:' + photoBg(s) + '"></span>' : I.chevR(16, '#b9bcc4', 2.6)) +
      '</div>' + strip6(s, P, 28, cal) + '</div>';
  };

  // ---- v6 Update 2: Sort · Filter pills (Your schedule and group pages) ------------------------
  const SORTS6 = [['soon', 'Soonest'], ['lively', 'Most lively'], ['new', 'Newest'], ['help', 'Needs you']];
  const sortName6 = (k) => (SORTS6.find(x => x[0] === k) || SORTS6[0])[1];
  const PILL6 = 'display:flex;align-items:center;gap:5px;min-height:32px;padding:0 11px 0 9px;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap';
  const FILTER_ICON = svg(14, stroke('currentColor', 2.4) + ' style="flex:0 0 14px"', '<path d="M4 6h16M7 12h10M10 18h4"/>');
  // Sort: a ringed pill with the current order; the menu lists the four
  const sortPill = (key, cur, set) => {
    const open = state.menu === key;
    return '<div data-menu style="position:relative;flex:0 0 auto">' +
      '<span ' + on((e) => { stop(e); setState({ menu: open ? null : key }); }) + ' aria-label="Sort: ' + sortName6(cur) + '" aria-haspopup="menu" aria-expanded="' + open + '" style="' + PILL6 + ';background:transparent;box-shadow:inset 0 0 0 1.5px #c3c7d0;color:#454b55">' + ic6('sort', 14, 'currentColor', 2.4) + sortName6(cur) + '</span>' +
      (open ? '<div role="menu" aria-label="Sort" style="position:absolute;top:44px;right:0;z-index:25;width:200px;padding:6px;border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(15,18,25,.18),0 0 0 1px #e6e7eb;animation:popIn 160ms ease both">' +
          SORTS6.map(([k, name]) => '<div ' + on((e) => { stop(e); set(k); }, 'menuitemradio') + ' aria-checked="' + (k === cur) + '" style="display:flex;align-items:center;gap:10px;min-height:42px;padding:0 12px;border-radius:10px;font-size:14.5px;font-weight:' + (k === cur ? 800 : 700) + ';color:' + (k === cur ? '#5b4ae8' : '#0d1117') + ';cursor:pointer">' + name + '</div>').join('') + '</div>' : '') +
    '</div>';
  };
  // Filter: a "SHOW ONLY" checklist with counts; the pill turns black with the count while any are on
  const filterPill = (key, opts, sel, toggle, clear, shown) => {
    const open = state.menu === key, n = sel.length;
    const box = (on_) => '<span aria-hidden="true" style="flex:0 0 20px;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;' + (on_ ? 'background:#5b4ae8' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #c3c7d0') + '">' + (on_ ? svg(12, stroke('#fff', 3.4), P6.check) : '') + '</span>';
    return '<div data-menu style="position:relative;flex:0 0 auto">' +
      '<span ' + on((e) => { stop(e); setState({ menu: open ? null : key }); }) + ' aria-label="Filter' + (n ? ', ' + n + ' on' : '') + '" aria-haspopup="menu" aria-expanded="' + open + '" style="' + PILL6 + ';' + (n ? 'background:#0d1117;color:#fff' : 'background:transparent;box-shadow:inset 0 0 0 1.5px #c3c7d0;color:#454b55') + '">' + FILTER_ICON + (n ? 'Filter · ' + n : 'Filter') + '</span>' +
      (open ? '<div role="menu" aria-label="Show only" style="position:absolute;top:44px;right:0;z-index:25;width:250px;padding:6px;border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(15,18,25,.18),0 0 0 1px #e6e7eb;animation:popIn 160ms ease both">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px 8px;border-bottom:1px solid #f2f3f6"><span style="font-size:12px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#8a909b">Show only</span><span ' + on((e) => { stop(e); clear(); }) + ' style="font-size:13px;font-weight:800;color:#6b7280;cursor:pointer">Clear</span></div>' +
          opts.map(o => '<div ' + on((e) => { stop(e); toggle(o.k); }, 'menuitemcheckbox') + ' aria-checked="' + o.on + '" style="display:flex;align-items:center;gap:10px;min-height:42px;padding:0 12px;border-radius:10px;font-size:14.5px;font-weight:' + (o.on ? 800 : 700) + ';color:#0d1117;cursor:pointer">' + box(o.on) + '<span style="flex:1">' + esc(o.name) + '</span><span style="font-size:13px;font-weight:800;color:#8a909b">' + o.n + '</span></div>').join('') +
          '<button type="button" ' + on((e) => { stop(e); setState({ menu: null }); }) + ' style="margin-top:6px;width:100%;min-height:44px;border:0;border-radius:999px;background:#0d1117;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Show ' + shown + (shown === 1 ? ' event' : ' events') + '</button>' +
        '</div>' : '') +
    '</div>';
  };
  // What each filter keeps (all the chosen ones must hold)
  const FILTERS6 = {
    lead: ['Leading', (s) => isLead(s)],
    help: ['Helping', (s) => !isLead(s) && helpsOn(s)],
    going: ['Going', (s) => !isLead(s) && myRsvp(s) === 'going'],
    maybe: ['Maybe', (s) => myRsvp(s) === 'maybe'],
    open: ['Not joined yet', (s) => !isLead(s) && !helpsOn(s) && !myRsvp(s)],
    needs: ['Needs helpers', (s) => signupFill(s).open > 0],
    week: ['This week', (s) => daysTo(s) != null && daysTo(s) < 7]
  };
  const filterOpts = (keys, all, sel) => keys.map(k => ({ k, name: FILTERS6[k][0], n: all.filter(FILTERS6[k][1]).length, on: sel.indexOf(k) > -1 }));
  const applyFilters = (list, sel) => list.filter(s => sel.every(k => FILTERS6[k][1](s)));
  const applySort = (list, sort) => {
    const out = list.slice(), f = (s) => signupFill(s).open;
    if (sort === 'help') out.sort((a, b) => f(b) - f(a) || byWhen(a, b));
    else if (sort === 'lively') out.sort((a, b) => lively(b) - lively(a) || byWhen(a, b));
    else if (sort === 'new') out.sort((a, b) => b.created - a.created);
    else out.sort(byWhen);
    return out.filter(s => s.dayDate).concat(out.filter(s => !s.dayDate));   // undecided dates last
  };
  // Soonest: a section per month; any other sort: one section named after it
  const sections6 = (list, sort, undated) => sort === 'soon' ? byMonth(list, undated) : (list.length ? [{ label: sortName6(sort), items: list }] : []);
  // Empty filters (Round 64a): one line, the filters that are on as dark chips, and Clear filters
  const filterEmpty = (clear, chips) => '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;align-items:flex-start;gap:10px"><div style="font-size:16px;font-weight:800;color:#0d1117">No events match these filters.</div>' +
    (chips && chips.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px">' + chips.map(c => '<span style="display:flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;background:#0d1117;color:#fff;font-size:13px;font-weight:800">' + esc(c) + '</span>').join('') + '</div>' : '') +
    '<span ' + on(clear) + ' style="display:flex;align-items:center;min-height:32px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Clear filters</span></div>';

  function viewSched() {
    const st = state, view = st.homeView === 'list' ? 'list' : 'tiles';
    const wrap = (inner) => '<div data-screen-label="Your schedule">' + head6('Your schedule') + '<div style="padding:14px 14px 24px;display:flex;flex-direction:column;gap:22px">' + inner + '</div><div style="height:var(--nav-h)"></div></div>';
    if (!st.loaded) return wrap(skeleton(2, 220));
    if (!myGroups().length) return wrap(goneCard() + noGroupCard());
    const all = schedList();
    if (!all.length) return wrap(goneCard() + '<div style="' + CARD + ';padding:18px;display:flex;align-items:center;gap:12px"><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;color:#0d1117">Nothing on the books yet.</div><div style="font-size:14px;line-height:1.45;font-weight:500;color:#6b7280">RSVP to something in your groups, or post your own.</div></div>' +
      '<span ' + on(() => goCompose()) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:40px;padding:0 14px;border-radius:999px;background:#0d1117;color:#fff;font-size:13.5px;font-weight:800;cursor:pointer">Post an event</span></div>');
    // Sort · Filter · view, on the first heading row
    const plans = applySort(applyFilters(all, st.sFilt), st.sSort), clear = () => setState({ sFilt: [], menu: null });
    const controls = '<div style="display:flex;align-items:center;gap:6px">' +
      sortPill('sSort', st.sSort, (k) => setState({ sSort: k, menu: null })) +
      filterPill('sFilt', filterOpts(['lead', 'help', 'going', 'maybe', 'needs', 'week'], all, st.sFilt), st.sFilt,
        (k) => setState({ sFilt: st.sFilt.indexOf(k) > -1 ? st.sFilt.filter(x => x !== k) : st.sFilt.concat([k]) }), clear, plans.length) +
      viewPicker('hview', view, (k) => setState({ homeView: k, menu: null }), SCHED_VIEWS) + '</div>';
    if (!plans.length) return wrap(goneCard() + '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(st.sSort === 'soon' ? 'Coming up' : sortName6(st.sSort), controls) + filterEmpty(clear) + '</div>');
    return wrap(goneCard() + draftsSection() + sections6(plans, st.sSort, 'Date to be decided').map((z, i) => '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(z.label, i ? '' : controls) +
      '<div style="display:flex;flex-direction:column;gap:' + (view === 'list' ? 10 : 14) + 'px">' + z.items.map(s => view === 'list' ? listCard6(s, partOf(s)) : tile6(s, partOf(s), 180)).join('') + '</div></div>').join(''));
  }

  // ---- Screen 3: the community Calendar -------------------------------------------------------
  // Placeholder event types, guessed from the title until hosts pick tags (never written to the data)
  const TYPES6 = [
    ['outdoors', 'Outdoors', /walk|trail|hike|park|creek|lake|garden|bonfire|loop|paintball|soccer|basketball|pickleball|yard/i],
    ['food', 'Food & drink', /potluck|ice cream|friendsgiving|picnic|brunch|coffee|bbq|gras|dinner|sale|taco|pie/i],
    ['fitness', 'Fitness', /activate|fitness|wake-up|wind-down|pickleball|basketball|soccer|meditation|walk|run|5k/i],
    ['kids', 'Kids & family', /egg hunt|eek|pumpkin|youth|kids|family|4th of july|parade/i],
    ['arts', 'Arts & crafts', /craft|mural|paint a|song|music|folk|hootenanny/i],
    ['games', 'Games', /poker|game|paintball/i],
    ['helping', 'Volunteering', /cleanup|cleaning|workday|work day|mutual aid|swap|garden work/i],
    ['social', 'Social', /hang|night|circle|party|dance|get-together|bonfire|potluck/i]
  ];
  const typesOf = (s) => { const t = TYPES6.filter(x => x[2].test(s.text)).map(x => x[0]); return t.length ? t : ['social']; };
  const typeName = (k) => (TYPES6.find(x => x[0] === k) || [])[1] || k;
  // Upcoming plans in your groups (invite-only ones only show if you can see them)
  const calBase = () => state.sparks.filter(s => inMine(s) && phaseOf(s) === 'plan');
  const inGroups6 = (s) => !state.cGrps || gIds(s).some(id => state.cGrps.indexOf(id) > -1);
  const inTypes6 = (s) => !state.cTypes.length || typesOf(s).some(t => state.cTypes.indexOf(t) > -1);
  const matchQ = (s, q) => { q = (q || '').trim().toLowerCase(); return !q || [s.text, s.spot, s.spotAddress].concat(gIds(s).map(id => (groupById(id) || {}).name)).some(v => (v || '').toLowerCase().indexOf(q) > -1); };
  const lively = (s) => going(s).length * 2 + maybes(s).length + s.signups.reduce((a, i) => a + i.claims.length, 0) + s.updates.length +
    ((Date.now() - s.created) < 48 * 3600000 ? 4 : (Date.now() - s.created) < 120 * 3600000 ? 2 : 0);
  const calResults = () => {
    const out = calBase().filter(s => inGroups6(s) && inTypes6(s));
    const f = (s) => signupFill(s).open;
    if (state.cSort === 'help') out.sort((a, b) => f(b) - f(a) || byWhen(a, b));
    else if (state.cSort === 'lively') out.sort((a, b) => lively(b) - lively(a) || byWhen(a, b));
    else if (state.cSort === 'new') out.sort((a, b) => b.created - a.created);
    else out.sort(byWhen);
    return out.filter(s => s.dayDate).concat(out.filter(s => !s.dayDate));   // undecided dates last
  };
  // "Could use a hand": plans you don't lead with open sign-ups, in two weeks from the first of them
  const handList = () => {
    const cand = calBase().filter(s => s.dayDate && !isLead(s) && signupFill(s).open > 0).sort(byWhen);
    if (!cand.length) return [];
    const from = cand[0].dayDate < todayISO() ? todayISO() : cand[0].dayDate, to = isoAdd(from, 14);
    return cand.filter(s => s.dayDate < to);
  };
  const clearFilters = () => setState({ cGrps: null, cTypes: [], cq: '', menu: null });

  // A checklist dropdown (Groups, Type of event)
  const checkMenu = (key, label, icon, title, rows, allOn, onAll, onClear, footer) => {
    const open = state.menu === key;
    const box = (on_) => '<span aria-hidden="true" style="flex:0 0 20px;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;' + (on_ ? 'background:#5b4ae8' : 'box-shadow:inset 0 0 0 2px #c3c7d0') + '">' + (on_ ? svg(12, stroke('#fff', 3.4), P6.check) : '') + '</span>';
    return '<div data-menu style="position:relative;flex:0 0 auto">' +
      '<span ' + on((e) => { stop(e); setState({ menu: open ? null : key }); }) + ' aria-label="' + esc(title) + ': ' + esc(label) + '" aria-expanded="' + open + '" style="display:flex;align-items:center;gap:7px;min-height:36px;padding:0 12px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;font-size:13.5px;font-weight:800;color:#0d1117;cursor:pointer;white-space:nowrap">' +
        ic6(icon, 15, '#454b55', 2.2) + esc(label) + I.chevD(11, '#454b55', 3) + '</span>' +
      (open ? '<div role="menu" aria-label="' + esc(title) + '" style="position:absolute;top:calc(100% + 6px);left:0;z-index:25;width:278px;padding:8px;border-radius:16px;background:#fff;box-shadow:0 18px 44px rgba(15,18,25,.2),0 0 0 1px #eceef2;animation:popIn 160ms ease both">' +
          '<div style="display:flex;align-items:center;gap:14px;padding:4px 10px 8px"><span style="flex:1;font-size:11.5px;font-weight:900;letter-spacing:1.1px;text-transform:uppercase;color:#8a909b">' + esc(title) + '</span>' +
            (onAll ? '<span ' + on((e) => { stop(e); onAll(); }) + ' style="font-size:13.5px;font-weight:800;color:' + (allOn ? '#b9b2f5' : '#5b4ae8') + ';cursor:pointer">Select all</span>' : '') +
            '<span ' + on((e) => { stop(e); onClear(); }) + ' style="font-size:13.5px;font-weight:800;color:#6b7280;cursor:pointer">Clear</span></div>' +
          rows.map(r => '<div ' + on((e) => { stop(e); r.toggle(); }, 'menuitemcheckbox') + ' aria-checked="' + r.on + '" style="display:flex;align-items:center;gap:12px;min-height:44px;padding:0 10px;border-top:1px solid #f2f3f6;cursor:pointer">' + box(r.on) +
            '<span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.name) + '</span><span style="font-size:13px;font-weight:800;color:#8a909b">' + r.n + '</span></div>').join('') +
          (footer ? '<button type="button" ' + on((e) => { stop(e); setState({ menu: null }); }) + ' style="margin-top:8px;width:100%;min-height:46px;border:0;border-radius:999px;background:#0d1117;color:#fff;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer">' + footer + '</button>' : '') +
        '</div>' : '') +
    '</div>';
  };
  // Sort (text + icon) and View (icon) menus on the first section heading
  const miniMenu = (key, label, trigger, items, cur, set) => {
    const open = state.menu === key;
    return '<div data-menu style="position:relative;flex:0 0 auto">' +
      '<span ' + on((e) => { stop(e); setState({ menu: open ? null : key }); }) + ' aria-label="' + esc(label) + '" aria-haspopup="menu" aria-expanded="' + open + '" style="display:flex;align-items:center;gap:5px;min-height:36px;padding:0 6px;font-size:14px;font-weight:800;color:#6b7280;cursor:pointer">' + trigger + '</span>' +
      (open ? '<div role="menu" aria-label="' + esc(label.split(':')[0]) + '" style="position:absolute;top:calc(100% + 4px);right:0;z-index:25;min-width:170px;padding:6px;border-radius:16px;background:#fff;border:1px solid #eceef2;box-shadow:0 18px 44px rgba(15,18,25,.2);animation:popIn 160ms ease both">' +
          items.map(([k, name, icon]) => '<div ' + on((e) => { stop(e); set(k); }) + ' style="display:flex;align-items:center;gap:10px;min-height:42px;padding:0 10px;border-radius:10px;cursor:pointer">' + (icon || '') +
            '<span style="flex:1;font-size:15px;font-weight:' + (k === cur ? 900 : 700) + ';color:' + (k === cur ? '#5b4ae8' : '#0d1117') + '">' + name + '</span>' + (k === cur ? I.check(16, '#5b4ae8', 2.6) : '') + '</div>').join('') + '</div>' : '') +
    '</div>';
  };
  const CSORTS = [['soon', 'Soonest'], ['lively', 'Most lively'], ['new', 'Newest'], ['help', 'Needs you']];
  const calViewMenu = () => {
    const icon = (k, c) => svg(17, 'fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"', VIEW_ICONS[k]);
    return miniMenu('cView', 'View: ' + VIEW_NAMES[state.cView], icon(state.cView, 'currentColor') + I.chevD(12, 'currentColor', 2.8),
      CVIEWS.map(k => [k, VIEW_NAMES[k], icon(k, '#6b7280')]), state.cView, (k) => setState({ cView: k, menu: null, cMon: null, cDay: null }));
  };

  function viewCalendar() {
    const st = state, groups = groupsInOrder(), base = calBase(), list = calResults(), hand = handList();
    const header = '<header style="position:relative;height:calc(180px + var(--pt));overflow:hidden;background:#2b303a">' +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:' + bg('/photos/walnut-creek.jpg', '50% 45%') + '"></div>' +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.95) 0%, rgba(13,17,23,.65) 45%, rgba(13,17,23,.3) 100%)"></div>' +
      '<div style="position:absolute;top:calc(14px + var(--pt));right:16px;display:flex;gap:10px;z-index:2">' +
        '<span ' + on(openSearch) + ' aria-label="Search events" style="width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer">' + ic6('search', 20, '#fff', 2.3) + '</span>' +
        bellBtn(true) + '</div>' +
      '<div style="position:absolute;left:18px;right:90px;bottom:16px;color:#fff;display:flex;flex-direction:column;gap:2px">' +
        '<span style="font-size:13px;font-weight:900;letter-spacing:1px;color:#cfc9ff">COMMUNITY</span>' +
        '<h1 style="margin:0;font-size:40px;line-height:1;font-weight:900;letter-spacing:-1.4px;color:#fff">Calendar</h1>' +
        '<span style="font-size:14px;font-weight:700;color:rgba(255,255,255,.88)">' + (groups.length ? 'All events from your ' + groups.length + (groups.length === 1 ? ' group' : ' groups') : 'Join a group to see its events') + '</span></div>' +
      '<button type="button" ' + on(() => goCompose()) + ' aria-label="Post an event" style="position:absolute;right:16px;bottom:18px;z-index:2;width:52px;height:52px;border:0;border-radius:999px;background:#5b4ae8;box-shadow:0 6px 16px rgba(13,17,23,.35);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.plus(24, '#fff', 2.6) + '</button>' +
    '</header>';

    // Filters: Groups · Type · Clear filters
    const gSel = st.cGrps, nG = gSel ? gSel.length : groups.length;
    const gLabel = !gSel ? 'All groups' : !nG ? 'No groups' : nG === 1 ? '1 group' : nG + ' groups';
    const toggleG = (id) => { const cur = st.cGrps || groups.map(g => g.id), next = cur.indexOf(id) > -1 ? cur.filter(x => x !== id) : cur.concat([id]); setState({ cGrps: next.length === groups.length ? null : next }); };
    const shown = base.filter(s => inGroups6(s) && inTypes6(s)).length;
    const gMenu = checkMenu('cGrp', gLabel, 'people', 'Groups', groups.map(g => ({ name: g.name, n: base.filter(s => inGroup(s, g.id)).length, on: !gSel || gSel.indexOf(g.id) > -1, toggle: () => toggleG(g.id) })),
      !gSel, () => setState({ cGrps: null }), () => setState({ cGrps: [] }), 'Show ' + shown + (shown === 1 ? ' event' : ' events'));
    const tSel = st.cTypes, tLabel = !tSel.length ? 'All types' : tSel.length === 1 ? typeName(tSel[0]) : tSel.length + ' types';
    const toggleT = (k) => setState({ cTypes: tSel.indexOf(k) > -1 ? tSel.filter(x => x !== k) : tSel.concat([k]) });
    const tMenu = checkMenu('cType', tLabel, 'tag', 'Type of event', TYPES6.map(([k, name]) => ({ name, n: base.filter(s => inGroups6(s) && typesOf(s).indexOf(k) > -1).length, on: tSel.indexOf(k) > -1, toggle: () => toggleT(k) })),
      false, null, () => setState({ cTypes: [] }), 'Show ' + shown + (shown === 1 ? ' event' : ' events'));
    const filtered = !!gSel || tSel.length > 0;
    const filters = '<div style="position:relative;z-index:6;display:flex;align-items:center;gap:8px;padding:14px 14px 0">' + gMenu + tMenu +
      (filtered ? '<span ' + on(clearFilters) + ' style="margin-left:auto;font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer;white-space:nowrap">Clear filters</span>' : '') + '</div>';

    // Discovery: "Feeling wild?" and "N events could use a hand" (each can be put away for the visit)
    const xBtn = (fn, label) => '<span ' + on((e) => { stop(e); fn(); }) + ' aria-label="' + label + '" style="flex:0 0 32px;width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(13, '#6b7280', 2.6) + '</span>';
    const pool = list.length ? list : base, faces = pool.slice(0, 3);
    const card = (s, i) => {
      const [rank, suit, red] = [['A', '♠', 0], ['K', '♥', 1], ['Q', '♣', 0]][i];
      return '<span aria-hidden="true" style="position:absolute;left:' + (i * 13) + 'px;top:' + (i === 1 ? 0 : 3) + 'px;width:34px;height:46px;border-radius:6px;background:#fff;box-shadow:0 2px 6px rgba(15,18,25,.25);transform:rotate(' + [-14, 0, 14][i] + 'deg);padding:2px">' +
        '<span style="position:absolute;left:3px;top:1px;z-index:1;font-size:9px;line-height:1;font-weight:900;color:' + (red ? '#e2556b' : '#0d1117') + '">' + rank + '<br>' + suit + '</span>' +
        '<span style="display:block;width:100%;height:100%;border-radius:4px;background:' + (s ? photoBg(s) : '#e8eaee') + '"></span></span>';
    };
    const wild = !st.cWildHidden && pool.length ? '<div ' + on(() => { const p = pool[Math.floor(Math.random() * pool.length)]; if (p) openSpark(p); }) + ' aria-label="Feeling wild? Open a random event" style="display:flex;align-items:center;gap:12px;padding:12px 8px 12px 14px;border-radius:18px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<span style="position:relative;flex:0 0 66px;height:50px">' + [0, 1, 2].map(i => card(faces[i] || pool[0], i)).join('') + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">Feeling wild?</div><div style="font-size:13px;font-weight:600;color:#6b7280">We’ll deal you a random event</div></div>' +
      I.chevR(14, '#b9bcc4', 2.6) + xBtn(() => setState({ cWildHidden: true }), 'Hide Feeling wild') + '</div>' : '';
    const needs = !st.cNeedsHidden && hand.length ? '<div ' + on(() => setState({ cHandSheet: true, menu: null })) + ' aria-label="' + hand.length + (hand.length === 1 ? ' event could' : ' events could') + ' use a hand" style="display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px;border-radius:18px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<span style="display:flex">' + hand.slice(0, 3).map((s, i) => '<span aria-hidden="true" style="width:26px;height:26px;border-radius:999px;border:2px solid #fff;margin-left:' + (i ? -9 : 0) + 'px;background:' + photoBg(s) + '"></span>').join('') + '</span>' +
      '<span style="flex:1;min-width:0;font-size:14.5px;font-weight:700;color:#0d1117"><b style="font-weight:900;color:#b07a0a">' + hand.length + (hand.length === 1 ? ' event' : ' events') + '</b> could use a hand</span>' +
      I.chevR(14, '#b9bcc4', 2.6) + xBtn(() => setState({ cNeedsHidden: true }), 'Hide could use a hand') + '</div>' : '';

    // Sections: Today / This week / Month (Soonest); Could use a hand / All covered (Needs you)
    const sortMenu = miniMenu('cSort', 'Sort: ' + (CSORTS.find(x => x[0] === st.cSort) || CSORTS[0])[1], ic6('sort', 15, 'currentColor', 2.2) + (CSORTS.find(x => x[0] === st.cSort) || CSORTS[0])[1],
      CSORTS, st.cSort, (k) => setState({ cSort: k, menu: null }));
    const secOf = (s) => {
      if (st.cSort === 'help') return signupFill(s).open > 0 ? 'Could use a hand' : 'All covered';
      if (st.cSort === 'lively') return 'Most lively';
      if (st.cSort === 'new') return 'Newest';
      const d = daysTo(s);
      return d == null ? 'Date to be decided' : d === 0 ? 'Today' : d < 7 ? 'This week' : monthLabel(s.dayDate);
    };
    const secs = [];
    list.forEach(s => { const l = secOf(s); let z = secs.find(q => q.label === l); if (!z) { z = { label: l, items: [] }; secs.push(z); } z.items.push(s); });
    const card6 = (s) => st.cView === 'tiles' ? tile6(s, partOf(s, true), 170, true) : listCard6(s, partOf(s, true), true);
    let body;
    if (!st.loaded) body = skeleton(3, 90);
    else if (st.cView === 'month') {
      const first = list.find(s => s.dayDate) || null, cm = st.cMon || (first ? first.dayDate.slice(0, 7) : todayISO().slice(0, 7));
      const [y, m] = cm.split('-').map(Number), start = new Date(y, m - 1, 1), nDays = new Date(y, m, 0).getDate(), today = todayISO();
      const inMonth = list.filter(s => s.dayDate && s.dayDate.slice(0, 7) === cm), undatedN = list.filter(s => !s.dayDate).length;
      const sel = st.cDay && st.cDay.slice(0, 7) === cm ? st.cDay : (today.slice(0, 7) === cm ? today : (inMonth[0] ? inMonth[0].dayDate : cm + '-01'));
      const shift = (d) => () => { const x = new Date(y, m - 1 + d, 1); setState({ cMon: x.getFullYear() + '-' + pad2(x.getMonth() + 1), cDay: null }); };
      const navBtn = (fn, label, icon) => '<span ' + on(fn) + ' aria-label="' + label + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + icon + '</span>';
      const cells = [];
      for (let i = 0; i < start.getDay(); i++) cells.push('<span></span>');
      for (let d = 1; d <= nDays; d++) {
        const iso = cm + '-' + pad2(d), onIt = iso === sel, day = inMonth.filter(s => s.dayDate === iso);
        const dot = (s) => { const P = partOf(s, true); return onIt ? '#fff' : P.k === 'open' ? '#9aa0ac' : P.R.dot; };
        cells.push('<span ' + on(() => setState({ cDay: iso })) + ' aria-label="' + esc(fmtDay(iso) + (day.length ? ', ' + day.length + (day.length === 1 ? ' event' : ' events') : '')) + '" aria-pressed="' + onIt + '" style="height:46px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;background:' + (onIt ? '#0d1117' : 'transparent') + '">' +
          '<span style="font-size:15px;font-weight:' + (day.length || onIt ? 900 : 700) + ';color:' + (onIt ? '#fff' : iso === today ? '#5b4ae8' : day.length ? '#0d1117' : '#9aa0ac') + '">' + d + '</span>' +
          '<span style="display:flex;gap:3px;height:5px">' + day.slice(0, 3).map(s => '<span style="width:5px;height:5px;border-radius:999px;background:' + dot(s) + '"></span>').join('') + '</span></span>');
      }
      const dayList = list.filter(s => s.dayDate === sel);
      body = '<div style="display:flex;flex-direction:column;gap:10px">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:0 4px"><h2 style="flex:1;margin:0;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + esc(start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })) + '</h2>' +
          navBtn(shift(-1), 'Previous month', I.chevL(15, '#0d1117', 2.6)) + navBtn(shift(1), 'Next month', I.chevR(15, '#0d1117', 2.6)) + calViewMenu() + '</div>' +
        '<div style="' + CARD + ';padding:10px 8px">' +
          '<div aria-hidden="true" style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));padding-bottom:4px">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => '<span style="text-align:center;font-size:11px;font-weight:800;letter-spacing:.6px;color:#6b7280">' + x + '</span>').join('') + '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px">' + cells.join('') + '</div></div>' +
        // Undated events stay out of the grid; the strip opens List at "Date to be decided" (Round 65d)
        (undatedN ? '<div ' + on(() => { setState({ cView: 'list', menu: null, cMon: null, cDay: null }); setTimeout(() => { const el = document.querySelector('[data-sec-tbd]'); if (el) el.scrollIntoView({ block: 'start' }); }, 0); }) + ' data-no-date style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:#fef7dd;box-shadow:inset 0 0 0 1.5px #e3c979;cursor:pointer">' +
          svg(18, stroke('#8f6405', 2.2), '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>') +
          '<span style="flex:1;font-size:14px;font-weight:800;color:#8f6405">' + undatedN + (undatedN === 1 ? ' event with no date yet' : ' events with no date yet') + '</span>' + I.chevR(14, '#8f6405', 2.6) + '</div>' : '') +
        '<div style="padding:6px 4px 0;font-size:16px;font-weight:900;color:#0d1117">' + esc(new Date(sel + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) + '</div>' +
        (dayList.length ? dayList.map(card6).join('') : '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px">' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px"><span style="font-size:17px;font-weight:900;color:#0d1117">' + esc(fmtDay(sel)) + '</span><span style="font-size:13px;font-weight:700;color:#9aa0ac">0 events</span></div>' +
          '<div style="font-size:15px;font-weight:700;color:#6b7280">Nothing on this day.</div>' +
          (sel >= today ? '<span ' + on(() => goCompose({ evDate: sel })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:32px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(15, '#5b4ae8', 2.8) + 'Start an event on ' + esc(new Date(sel + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + '</span>' : '') + '</div>') + '</div>';
    } else if (!list.length) {
      body = st.loaded && !groups.length ? '' : '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(st.cSort === 'soon' ? 'Coming up' : (CSORTS.find(x => x[0] === st.cSort) || CSORTS[0])[1], '<div style="display:flex;align-items:center">' + sortMenu + calViewMenu() + '</div>') +
        (filtered ? filterEmpty(clearFilters, (gSel ? groups.filter(g => gSel.indexOf(g.id) > -1).map(g => g.name) : []).concat(tSel.map(typeName))) : note6('Nothing coming up in your groups yet.')) + '</div>';
    } else {
      body = secs.map((z, i) => '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(z.label, i ? '' : '<div style="display:flex;align-items:center">' + sortMenu + calViewMenu() + '</div>') +
        z.items.map(card6).join('') + '</div>').join('');
    }
    return '<div data-screen-label="Calendar">' + header + filters +
      '<div style="padding:10px 14px 0;display:flex;flex-direction:column;gap:10px">' + goneCard() + (st.loaded && !groups.length ? noGroupCard() : '') + wild + needs + '</div>' +
      '<div style="padding:16px 14px 26px;display:flex;flex-direction:column;gap:22px">' + body + '</div>' +
      '<div style="height:var(--nav-h)"></div></div>';
  }

  // "Could use a hand": each event's open roles, with Claim
  const claimRole = (s, it) => needGuest(() => run(async () => {
    await saveGuestContact(s.id);
    must(await sb.from('signup_claims').insert({ item_id: it.id, user_id: state.me }));
  }).then(ok => { if (ok) onItBanner(s, { items: [it.id] }); }));
  function viewHandSheet() {
    const list = handList(), close = () => setState({ cHandSheet: false });
    const card = (s) => {
      const dp = dateParts(s.dayDate), rows = s.signups.filter(it => it.need && (it.claims.length < it.need || it.claims.some(c => c.userId === state.me)));
      return '<div data-hand="' + esc(s.text) + '" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
        '<div ' + on(() => openSpark(s)) + ' style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer">' +
          '<div style="flex:0 0 40px;display:flex;flex-direction:column;align-items:center"><span style="font-size:10.5px;font-weight:900;letter-spacing:.6px;color:#6b7280">' + dp.dow + '</span><span style="font-size:20px;line-height:1.1;font-weight:900;color:#0d1117">' + dp.day + '</span></div>' +
          '<span aria-hidden="true" style="flex:0 0 3px;align-self:stretch;border-radius:999px;background:#e8a71c"></span>' +
          '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(s.text) + '</div>' +
            '<div style="font-size:12.5px;font-weight:600;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + [esc(fmtTime(s.dayTime)), s.spot ? esc(s.spot) : tbdSpan(spotTbd(s))].filter(Boolean).join(' · ') + '</div></div>' +
          I.chevR(16, '#b9bcc4', 2.6) + '</div>' +
        rows.map(it => {
          const mine = it.claims.some(c => c.userId === state.me), left = it.need - it.claims.length;
          return '<div data-signup="' + esc(it.item) + '" style="display:flex;align-items:center;gap:12px;min-height:52px;padding:8px 14px;border-top:1px solid #f2f3f6">' +
            '<span aria-hidden="true" style="flex:0 0 10px;width:10px;height:10px;border-radius:999px;box-shadow:inset 0 0 0 2px #e8a71c"></span>' +
            '<div style="flex:1;min-width:0"><div style="font-size:14.5px;font-weight:700;color:#0d1117">' + esc(it.item) + '</div><div style="font-size:12.5px;font-weight:' + (it.jobId ? '800;color:#8f6405' : '600;color:#6b7280') + '">' + esc([it.jobId ? spanTime(it) : '', Math.max(0, left) + ' of ' + it.need + ' open'].filter(Boolean).join(' · ')) + '</div></div>' +
            (mine ? '<span style="flex:0 0 auto;display:flex;align-items:center;gap:4px;min-height:32px;padding:0 12px;border-radius:999px;background:#fdf1d6;color:#8f6405;font-size:13.5px;font-weight:800">' + svg(12, stroke('#8f6405', 3), P6.check) + 'Yours</span>'
              : '<button type="button" ' + on(() => { if (!state.busy) claimRole(s, it); }) + ' style="flex:0 0 auto;min-height:32px;padding:0 14px;border:0;border-radius:999px;background:#0d1117;color:#fff;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer">Claim</button>') + '</div>';
        }).join('') + '</div>';
    };
    return sheet6('Could use a hand', close,
      '<div style="display:flex;align-items:center;gap:10px"><h2 style="flex:1;margin:0;font-size:26px;line-height:1.1;font-weight:900;letter-spacing:-.6px;color:#0d1117">Could use a hand</h2>' + closeX(close) + '</div>' +
        '<div style="margin-top:6px;font-size:14px;font-weight:600;color:#6b7280">' + list.length + (list.length === 1 ? ' event' : ' events') + ' coming up in the next 2 weeks</div>',
      '<div style="padding:14px 14px 30px;display:flex;flex-direction:column;gap:10px">' + (list.length ? list.map(card).join('') : '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px"><span style="font-size:11.5px;font-weight:900;letter-spacing:1px;color:#8f6405">COULD USE A HAND</span>' +
        '<div style="display:flex;gap:12px;align-items:center"><span aria-hidden="true" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#e7f6ec;display:flex;align-items:center;justify-content:center">' + svg(18, stroke('#149a4b', 2.8), P6.check) + '</span>' +
          '<div><div style="font-size:16px;font-weight:800;color:#0d1117">Everything’s covered for the next two weeks.</div><div style="margin-top:2px;font-size:13.5px;font-weight:600;color:#6b7280">New asks show up here.</div></div></div></div>') + '</div>');
  }

  // Search (v6 Update 2): before typing, Try chips and "Or something unexpected"; live results as you type
  const TRY6 = [['weekend', 'This weekend', { cWhen: 'weekend' }], ['outdoors', 'Outdoors', { cTypes: ['outdoors'] }], ['kids', 'Kid-friendly', { cTypes: ['kids'] }], ['help', 'Needs helpers', { cHelp: true }], ['food', 'Food & drink', { cTypes: ['food'] }]];
  const TRY_UNDO = { cTry: null, cWhen: 'any', cTypes: [], cHelp: false };
  // "This weekend": the coming Friday to Sunday (today included when it's one of them)
  const inWhen6 = (s) => {
    if (state.cWhen !== 'weekend') return true;
    const d = daysTo(s);
    if (d == null || d < 0) return false;
    const dow = new Date(s.dayDate + 'T12:00').getDay(), left = (7 - new Date().getDay()) % 7;   // days until Sunday
    return d <= left && (dow === 5 || dow === 6 || dow === 0);
  };
  const MAGIC_ICON = {
    cards: '<rect x="3.5" y="6" width="10" height="14" rx="2" transform="rotate(-10 8.5 13)"/><rect x="10" y="4" width="10" height="14" rx="2" transform="rotate(8 15 11)"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z"/>',
    people: P6.people,
    cup: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1 1 2s-1 1-1 2M12 3.5c0 1 1 1 1 2s-1 1-1 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>'
  };
  const magicGrid = (cards) => '<span style="margin-top:16px;font-size:11.5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#8a909b">Or something unexpected</span>' +
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-top:4px">' + cards.map(m => '<div ' + on(m.pick) + ' data-magic="' + esc(m.title) + '" style="display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:16px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<span style="width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:' + m.bg + ';color:' + m.ink + '">' + svg(20, stroke('currentColor', 2), MAGIC_ICON[m.icon]) + '</span>' +
      '<div><div style="font-size:14.5px;line-height:1.2;font-weight:900;color:#0d1117">' + m.title + '</div><div style="margin-top:2px;font-size:12px;line-height:1.35;font-weight:600;color:#6b7280">' + m.sub + '</div></div></div>').join('') + '</div>';
  const tryChip = (label, fn) => '<span ' + on(fn) + ' style="display:flex;align-items:center;min-height:34px;padding:0 13px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #e6e7eb;font-size:13.5px;font-weight:800;color:#454b55;cursor:pointer">' + label + '</span>';
  const tryOn = (label, clear) => '<div style="display:flex;padding:0 2px 4px"><span ' + on(clear) + ' aria-label="Clear ' + esc(label) + '" style="display:flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;background:#0d1117;color:#fff;font-size:13px;font-weight:800;cursor:pointer">' + esc(label) + I.x(10, '#fff', 3.4) + '</span></div>';
  const searchHead = (label, value, placeholder, onType, clearFn, close) => '<div style="display:flex;align-items:center;gap:10px">' +
    '<label style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;min-height:48px;padding:0 10px 0 14px;border-radius:14px;background:#fff;box-shadow:0 1px 3px rgba(13,17,23,.08),0 0 0 1px rgba(13,17,23,.06)">' + ic6('search', 18, '#6b7280', 2.4) +
      '<input class="fld" type="search" data-csearch aria-label="' + esc(label) + '" placeholder="' + esc(placeholder) + '" value="' + esc(value) + '" ' + onInput(e => { if (e.type === 'input') onType(e.target.value.slice(0, 60)); }) + ' style="flex:1;min-width:0;border:0;outline:none;background:transparent;font-family:inherit;font-size:15.5px;font-weight:600;color:#0d1117">' +
      (value ? '<span ' + on(() => { clearFn(); const f = document.querySelector('[data-csearch]'); if (f) f.focus(); }) + ' aria-label="Clear search" style="flex:0 0 24px;width:24px;height:24px;border-radius:999px;background:#c3c7d0;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(10, '#fff', 4) + '</span>' : '') +
    '</label>' +
    '<span ' + on(close) + ' style="flex:0 0 auto;font-size:14.5px;font-weight:800;color:#454b55;cursor:pointer">Cancel</span></div>';
  const searchRow = (s, sub) => '<div ' + on(() => openSpark(s)) + ' data-result="' + esc(s.text) + '" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
    '<span aria-hidden="true" style="flex:0 0 40px;width:40px;height:40px;border-radius:10px;background:' + photoBg(s) + '"></span>' +
    '<div style="flex:1;min-width:0"><div style="font-size:14.5px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(s.text) + '</div>' +
      '<div style="font-size:12.5px;font-weight:600;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(sub) + '</div></div>' + I.chevR(14, '#b9bcc4', 2.6) + '</div>';
  const rnd6 = (a) => a.length ? a[Math.floor(Math.random() * a.length)] : null;
  function viewSearch() {
    const st = state, q = st.cq.trim(), tr = st.cTry ? TRY6.find(x => x[0] === st.cTry) : null;
    const undo = st.cTry ? TRY_UNDO : {};
    const close = () => setState(Object.assign({ cSearch: false, cq: '' }, undo));
    const pool = calBase(), list = pool.filter(s => matchQ(s, q) && inTypes6(s) && inWhen6(s) && (!st.cHelp || signupFill(s).open > 0)).sort(byWhen);
    const results = q || tr ? list.slice(0, 30) : [];
    const pick = (fn) => () => { const x = fn(); if (!x) { toast('Nothing like that yet'); return; } setState(Object.assign({ cSearch: false, cq: '' }, undo)); openSpark(x); };
    const notMine = pool.filter(s => !isLead(s) && !myRsvp(s) && !helpsOn(s));
    const myTypes = {};
    pool.filter(s => isLead(s) || myRsvp(s)).forEach(s => typesOf(s).forEach(k => { myTypes[k] = 1; }));
    const magic = [
      { icon: 'cards', title: 'Deal me a wildcard', sub: 'Any event, totally at random', bg: '#f3f1fe', ink: '#5b4ae8', pick: pick(() => rnd6(pool)) },
      { icon: 'compass', title: 'Something new to me', sub: 'A kind of event I haven’t tried', bg: '#e7f6ec', ink: '#149a4b', pick: pick(() => rnd6(notMine.filter(s => typesOf(s).some(k => !myTypes[k]))) || rnd6(notMine)) },
      { icon: 'moon', title: 'Soonest surprise', sub: 'The next thing happening that I’m not in', bg: '#1f2433', ink: '#cfc9ff', pick: pick(() => notMine.slice().sort(byWhen)[0]) },
      { icon: 'people', title: 'Tag along', sub: 'Where the most neighbors are going', bg: '#fdf1d6', ink: '#8f6405', pick: pick(() => notMine.slice().sort((a, b) => going(b).length - going(a).length)[0]) },
      { icon: 'cup', title: 'Small & cozy', sub: 'An intimate one with just a few people', bg: '#fde8ec', ink: '#c2415a', pick: pick(() => notMine.slice().sort((a, b) => going(a).length - going(b).length)[0]) },
      { icon: 'sun', title: 'Get outside', sub: 'A random outdoor adventure', bg: '#e6f3fb', ink: '#1f7ab8', pick: pick(() => rnd6(pool.filter(s => typesOf(s).indexOf('outdoors') > -1))) }
    ];
    const hint = '<div style="display:flex;flex-direction:column;gap:4px;padding:0 4px">' +
      '<span style="font-size:11.5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#8a909b">Try</span>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:4px">' + TRY6.map(([k, label, patch]) => tryChip(label, () => setState(Object.assign({}, TRY_UNDO, { cTry: k }, patch)))).join('') + '</div>' +
      magicGrid(magic) + '</div>';
    return sheet6('Search', close,
      searchHead('Search events', st.cq, 'Search events, places, groups', (v) => setState({ cq: v }), () => setState({ cq: '' }), close),
      '<div style="padding:14px 14px 28px;display:flex;flex-direction:column;gap:8px">' +
        (!q && !tr ? hint : '') +
        (tr ? tryOn(tr[1], () => setState(TRY_UNDO)) : '') +
        ((q || tr) && !results.length ? (q ? '<div style="background:#fff;border-radius:16px;padding:16px;font-size:15px;font-weight:600;color:#6b7280">No events match “' + esc(q) + '”.</div>'
          : '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:4px"><div style="font-size:15.5px;font-weight:800;color:#0d1117">No events match ' + esc(tr[1]) + '.</div><div style="font-size:13.5px;font-weight:600;color:#6b7280">Try taking it off.</div></div>') : '') +
        results.map(s => searchRow(s, (s.dayDate ? shortWhen(s) : dateTbd(s)) + ' · ' + groupsLabel(s))).join('') +
      '</div>', 64, '8px 14px 12px');
  }

  // Pick a shift (v6 Update 5): a job split into shifts. Tick any (full ones can't be picked unless
  // they're yours), an optional note saved on your entry in each shift, then Done.
  function viewShiftSheet() {
    const p = state.shiftPick, s = state.sparks.find(x => x.id === p.id), job = s && (s.jobs || []).find(j => j.id === p.job);
    if (!job || !job.shifts) return '';
    const close = () => setState({ shiftPick: null });
    const row = (u) => {
      const was = u.claims.some(c => c.userId === state.me), sel = p.sel.indexOf(u.id) > -1, n = u.claims.length - (was ? 1 : 0) + (sel ? 1 : 0);
      const full = !!u.need && u.claims.length >= u.need && !was;
      const pick = () => { if (!full) setState({ shiftPick: Object.assign({}, p, { sel: sel ? p.sel.filter(x => x !== u.id) : p.sel.concat(u.id) }) }); };
      return '<div ' + (full ? '' : on(pick, 'checkbox') + ' aria-checked="' + sel + '" ') + 'data-shift="' + esc(spanTime(u)) + '" style="display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:14px;' +
          (sel ? 'background:#f7f6ff;box-shadow:inset 0 0 0 2px #5b4ae8;cursor:pointer' : full ? 'background:#f7f8fa;box-shadow:inset 0 0 0 1.5px #eef0f3;opacity:.6' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #e3e5ea;cursor:pointer') + '">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<span aria-hidden="true" style="flex:0 0 22px;width:22px;height:22px;border-radius:999px;display:flex;align-items:center;justify-content:center;' + (sel ? 'background:#5b4ae8' : 'box-shadow:inset 0 0 0 2px ' + (full ? '#dcdfe6' : '#b9bcc4')) + '">' + (sel ? I.check(12, '#fff', 3.4) : '') + '</span>' +
          '<span style="flex:1;min-width:0;font-size:16px;font-weight:800;color:' + (full ? '#9aa0ac' : '#0d1117') + '">' + esc(spanTime(u) || 'Any time') + '</span>' +
          '<span style="flex:0 0 auto;font-size:13px;font-weight:800;color:' + (sel ? '#4a3ad4' : '#6b7280') + '">' + (full ? 'Full' : u.need ? n + ' of ' + u.need : n + ' in') + '</span></div>' +
        (u.need ? '<div aria-hidden="true" style="display:flex;gap:4px">' + Array.from({ length: u.need }, (_, i) => '<span style="flex:1;height:4px;border-radius:999px;background:' + (i < n ? '#5b4ae8' : '#e3e5ea') + '"></span>').join('') + '</div>' : '') +
      '</div>';
    };
    return sheet('Pick a shift', close, 'padding:10px 16px calc(22px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:10px',
      '<div style="display:flex;align-items:center;gap:10px"><h2 style="flex:1;min-width:0;margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + esc(job.item) + '</h2>' + closeX(close) + '</div>' +
      '<div style="margin-top:-4px;font-size:14px;font-weight:700;color:#6b7280">' + esc([s.dayDate ? fmtDay(s.dayDate) : '', 'you can pick more than one'].filter(Boolean).join(' · ')) + '</div>' +
      (job.desc ? '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#454b55">' + esc(job.desc) + '</p>' : '') +
      job.shifts.map(row).join('') +
      '<input class="fld" type="text" maxlength="60" aria-label="Add a note, if you want" placeholder="Add a note, if you want" value="' + esc(p.note) + '" ' + onInput(e => { if (e.type === 'input') state.shiftPick = Object.assign({}, state.shiftPick, { note: e.target.value.slice(0, 60) }); }) + ' style="width:100%;min-height:48px;border:1.5px solid #dcdfe6;border-radius:14px;padding:10px 14px;font-family:inherit;font-size:15px;font-weight:600;color:#0d1117;background:#fff;outline:none">' +
      '<button type="button" class="hov-primary" ' + on(() => { if (!state.busy) saveShifts(s, job); }) + ' style="min-height:52px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer">Done</button>', 36);
  }

  // "You're on it" (after any new sign-up, with Undo) and "You're off it" (after taking yourself off)
  function viewBanner() {
    const b = state.banner, s = state.sparks.find(x => x.id === b.id);
    if (!s) return '';
    const host = nameOf(s.leadId, s.leadName), hostFirst = firstName(host), wrap = (style, inner) =>
      '<div role="status" data-banner="' + b.kind + '" style="position:absolute;left:14px;right:14px;bottom:calc(var(--nav-h) + 12px);z-index:40;border-radius:18px;padding:14px;animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both;' + style + '">' + inner + '</div>';
    if (b.kind === 'on') return wrap('background:#0f7a3c;box-shadow:0 10px 28px rgba(15,122,60,.35);display:flex;align-items:center;gap:12px',
      '<span style="flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center">' + I.check(22, '#149a4b', 3.4) + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:900;color:#fff">You’re on it</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;font-size:12.5px;font-weight:800;color:rgba(255,255,255,.9)">' +
          (isLead(s) ? 'Added to your jobs' : face(s.leadId, host, 18) + '<span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(hostFirst) + ' is counting on you</span>') + '</div></div>' +
      '<button type="button" ' + on(() => { if (!state.busy) undoClaim(b); }) + ' style="flex:0 0 auto;min-height:36px;padding:0 14px;border:0;border-radius:999px;background:rgba(255,255,255,.18);color:#fff;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer">Undo</button>');
    const msg = 'Hey! I can’t make it to ' + b.job.toLowerCase() + ' for ' + s.text + ' anymore. Any chance you could take my spot?';
    return wrap('background:#fff6dc;box-shadow:0 10px 28px rgba(15,18,25,.18), inset 0 0 0 1.5px #f3d98b;display:flex;flex-direction:column;gap:12px',
      '<div style="display:flex;align-items:flex-start;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:900;color:#0d1117">You’re off it</div>' +
        '<p style="margin:4px 0 0;font-size:14px;line-height:1.4;font-weight:600;color:#5c4a12">We’ll let ' + esc(hostFirst) + ' know. A quick check-in with them helps too, or find someone to take your spot.</p></div>' +
        '<span ' + on(() => { clearTimeout(bannerTimer); setState({ banner: null }); }) + ' aria-label="Dismiss" style="flex:0 0 32px;width:32px;height:32px;border-radius:999px;background:rgba(13,17,23,.06);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(13, '#5c4a12', 2.6) + '</span></div>' +
      '<button type="button" ' + on(() => { clearTimeout(bannerTimer); setState({ banner: null, invite: { id: s.id, msg, title: 'Find a replacement', sub: [b.job, shortWhen(s)].filter(Boolean).join(' · ') } }); }) + ' style="min-height:44px;border:0;border-radius:999px;background:#0d1117;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Find a replacement</button>');
  }

  // ---- V5: Notifications, built from what's already stored (last 7 days) --------------------
  // In-app only for now (the owner doesn't want email notifications yet); notif_state.email is unused.
  // Topics (Settings) → filter chips: new events = Invites; updates + reminders = Updates; the rest = Hosting
  const N_TYPES = {
    newevent: { bg: '#149a4b', glyph: '●', cat: 'invites', topic: 'newevents' },
    update: { bg: '#0d1117', glyph: '“', cat: 'updates', topic: 'updates' },
    reminder: { bg: '#e2556b', glyph: '⏰', cat: 'updates', topic: 'reminders' },
    rsvp: { bg: '#149a4b', glyph: '✓', cat: 'hosting', topic: 'hosting' },
    signup: { bg: '#e8a71c', glyph: '+', cat: 'hosting', topic: 'hosting' },
    interest: { bg: '#5b4ae8', glyph: '♥', cat: 'hosting', topic: 'hosting' },
    vote: { bg: '#e8a71c', glyph: '▲', cat: 'hosting', topic: 'hosting' },
    lead: { bg: '#7b6ef0', glyph: '★', cat: 'hosting', topic: 'hosting' },
    note: { bg: '#e2556b', glyph: '!', cat: 'updates', topic: 'updates' }   // an event or job was taken down
  };
  const N_TOPICS = [
    ['newevents', 'New events in your groups', 'When something goes on the books'],
    ['updates', 'Updates from hosts', 'Changes and last calls on plans you’re in'],
    ['reminders', 'Day-before reminders', 'For anything you said you’re going to'],
    ['hosting', 'Things you’re hosting', 'Replies, sign-ups, suggestions and people pitching in']
  ];
  // A guest's name comes from what they left the lead; everyone else from their profile
  const personName = (s, uid) => {
    const c = s.contacts.find(x => x.user_id === uid);
    return (state.profiles[uid] && state.profiles[uid].name) || (c && c.name) || 'Someone';
  };
  const notifList = () => {
    if (!state.email || !state.me) return [];
    const me = state.me, since = Date.now() - 7 * DAY_MS, out = [];
    const add = (n) => { if (n.t >= since && n.t <= Date.now() + 60000) out.push(n); };
    state.sparks.filter(inMine).forEach(s => {
      const lead = isLead(s), ph = phaseOf(s), my = myRsvp(s);
      // Updates from the host: "everyone" / going / maybe reach people in the plan (replied or signed up);
      // "haven't replied" reaches the rest of the group
      const inIt = !!my || s.signups.some(it => it.claims.some(c => c.userId === me));
      if (!lead && ph === 'plan') s.updates.forEach(u => {
        const aud = u.audience || 'all';
        if (aud === 'noreply' ? !my : inIt && (aud === 'all' || aud === my))
          add({ key: 'u:' + u.id, type: 'update', s, t: u.created, uid: s.leadId, who: nameOf(s.leadId, s.leadName), text: 'posted an update on', quote: u.body });
      });
      // Day-before reminder (and the day itself) for plans you're going to
      if (ph === 'plan' && s.autoRemind && (my === 'going' || my === 'maybe') && !lead) {
        const d = dayDiff(s.dayDate);
        if (d === 0 || d === 1) add({ key: 'r:' + s.id + ':' + s.dayDate, type: 'reminder', s, t: Math.min(Date.now(), midnight(s.dayDate) - (d === 1 ? DAY_MS : 0) + 8 * 3600000),   // 8am on the day before (or the day)
          uid: s.leadId, who: d === 1 ? 'Tomorrow:' : 'Today:', text: '', after: (s.dayTime ? ' at ' + fmtTime(s.dayTime) : '') + (s.spot ? ' · ' + s.spot : '') });
      }
      // A new plan in one of your groups
      if (!lead && s.planned && s.created && ph === 'plan')
        add({ key: 'e:' + s.id, type: 'newevent', s, t: s.created, uid: s.leadId, who: nameOf(s.leadId, s.leadName), text: 'put an event on the books:', rsvp: !my });
      if (!lead) return;
      // Things you're hosting
      s.rsvps.filter(r => r.userId !== me).forEach(r => add({ key: 'rv:' + s.id + ':' + r.userId, type: 'rsvp', s, t: r.created, uid: r.userId, who: personName(s, r.userId),
        text: r.status === 'going' ? 'is going to' : r.status === 'maybe' ? 'might come to' : 'can’t make it to' }));
      s.signups.forEach(it => it.claims.filter(c => c.userId !== me && c.created).forEach(c => add({ key: 's:' + it.id + ':' + c.userId, type: 'signup', s, t: c.created, uid: c.userId, who: personName(s, c.userId), text: 'signed up to bring', item: it.item })));
      if (ph === 'idea') {
        s.interested.filter(u => u !== me && s.interestAt[u]).forEach(u => add({ key: 'i:' + s.id + ':' + u, type: 'interest', s, t: s.interestAt[u], uid: u, who: personName(s, u), text: 'is interested in' }));
        s.dateOpts.filter(o => o.createdBy !== me && o.created).forEach(o => add({ key: 'd:' + o.id, type: 'vote', s, t: o.created, uid: o.createdBy, who: o.who, text: 'suggested', item: fmtDay(o.dayDate) + (o.dayTime ? ' ' + fmtTime(o.dayTime) : ''), joiner: ' for ' }));
        s.spotOpts.filter(o => o.createdBy !== me && o.created).forEach(o => add({ key: 'p:' + o.id, type: 'vote', s, t: o.created, uid: o.createdBy, who: o.who, text: 'suggested', item: o.name, joiner: ' for ' }));
        s.organizers.filter(u => u !== me && s.organizerAt[u]).forEach(u => add({ key: 'o:' + s.id + ':' + u, type: 'lead', s, t: s.organizerAt[u], uid: u, who: personName(s, u), text: 'offered to help organize' }));
      }
    });
    (state.notes || []).forEach(x => add({ key: 'n:' + x.id, type: 'note', s: null, t: x.created, uid: x.createdBy, who: nameOf(x.createdBy, 'The host'), body: x.body }));
    const topics = state.notif.topics || {};
    return out.filter(n => topics[N_TYPES[n.type].topic] !== false).sort((a, b) => b.t - a.t);
  };
  const isUnread = (n) => n.t > (state.notif.allReadAt || 0) && state.notif.read.indexOf(n.key) < 0;
  const unreadCount = () => notifList().filter(isUnread).length;

  // Saving read state and settings (one row per person)
  let notifSavedAt = 0;
  const saveNotif = (patch) => {
    notifSavedAt = Date.now();
    const n = Object.assign({}, state.notif, patch);
    setState({ notif: n });
    writeCache();
    sb.from('notif_state').upsert({ user_id: state.me, all_read_at: n.allReadAt ? new Date(n.allReadAt).toISOString() : null, read_keys: n.read.slice(-300), topics: n.topics, email: n.email, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(r => { if (r.error) throw r.error; }).catch(e => { console.error(e); toast(FAILED); });
  };
  const markRead = (n) => { if (isUnread(n)) saveNotif({ read: state.notif.read.concat([n.key]) }); };
  // Everything shown counts, even an item stamped a little ahead of this device's clock
  const markAllRead = () => saveNotif({ allReadAt: Math.max(Date.now(), ...notifList().map(n => n.t)), read: [] });
  const openNotif = (n) => { markRead(n); if (n.s) openSpark(n.s); };
  const rsvpFromFeed = (n, status) => (e) => { stop(e); markRead(n); setRsvp(n.s, status); };

  // ---- Web push: phone notifications (the service worker is /sw.js; the database decides who
  // hears about what and /api/push sends it). On iPhone it only works in the installed app.
  const PUSH_OK = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.error(e));
    // Tapping a notification while the app is open: the worker asks us to go to that event
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'open') return;
      try { const u = new URL(e.data.url); if (u.origin === location.origin) location.hash = u.hash || '#/'; } catch (err) { /* ignore */ }
    });
  }
  // on · off · denied (blocked in Settings) · install (iPhone Safari: add to Home Screen first) · none
  const pushStatus = () => !PUSH_OK ? (IS_IOS && !STANDALONE ? 'install' : 'none') : Notification.permission === 'denied' ? 'denied' : state.pushOn ? 'on' : 'off';
  const vapidKey = (k) => { const b = atob((k + '='.repeat((4 - k.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  const saveSub = async (sub) => { const j = sub.toJSON(); must(await sb.rpc('save_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })); };
  const turnOnPush = async () => {
    if (!PUSH_OK || state.busy || state.viewAs) return;
    try {
      const perm = await Notification.requestPermission();   // first, so it's still inside the tap
      if (perm !== 'granted') { setState({}); toast(perm === 'denied' ? 'Notifications are blocked. Allow them for Spark Hub in your phone’s Settings.' : 'Notifications stay off for now'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(CFG.vapidPublicKey) });
      await saveSub(sub);
      setState({ pushOn: true });
      toast('Notifications are on for this phone', true);
    } catch (e) { console.error(e); toast(FAILED); }
  };
  const forgetPush = async () => {
    if (!PUSH_OK || !navigator.serviceWorker.controller) return;
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    } catch (e) { /* signing out still works */ }
    state.pushOn = false;
  };
  const turnOffPush = async () => {
    if (state.busy || state.viewAs) return;
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) { must(await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)); await sub.unsubscribe().catch(() => {}); }
      setState({ pushOn: false });
      toast('Notifications are off for this phone', true);
    } catch (e) { console.error(e); toast(FAILED); }
  };
  // After each sign-in load: if this phone already allowed notifications, keep it tied to this account
  let pushSynced = false;
  const syncPush = async () => {
    if (pushSynced || !PUSH_OK || Notification.permission !== 'granted') return;
    pushSynced = true;
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) await saveSub(sub);
      setState({ pushOn: !!sub });
    } catch (e) { console.error(e); }
  };
  // The Home Screen icon's badge = the bell's unread count (installed app, notifications allowed).
  // The service worker bumps it when a push arrives while the app is closed; the count it keeps
  // lives in the 'spark-hub-badge' cache, which we reset to the real number here.
  let badgeShown = -1;
  const syncBadge = () => {
    if (!('setAppBadge' in navigator) || !state.loaded || state.viewAs) return;
    const n = state.email ? unreadCount() : 0;
    if (n === badgeShown) return;
    badgeShown = n;
    (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
    if ('caches' in window) caches.open('spark-hub-badge').then(c => c.put('/badge-count', new Response(String(n)))).catch(() => {});
  };

  // The card at the top of Notifications until it's on (or put away)
  const pushCard = () => {
    const ps = pushStatus();
    if (state.pushCardHidden || (ps !== 'off' && ps !== 'install')) return '';
    const hide = () => { try { localStorage.setItem('spark-hub-push-card', 'hidden'); } catch (e) { /* fine */ } setState({ pushCardHidden: true }); };
    return '<div data-push-card style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px">' +
      '<div style="display:flex;align-items:flex-start;gap:12px"><span aria-hidden="true" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#f3f1fe;display:flex;align-items:center;justify-content:center">' + svg(18, stroke('#5b4ae8', 2.2), '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>') + '</span>' +
        '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;color:#0d1117">' + (ps === 'install' ? 'Get these on your iPhone' : 'Get these on your phone') + '</div>' +
          '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:600;color:#6b7280">' + (ps === 'install'
            ? 'Add Spark Hub to your Home Screen first: tap Share, then Add to Home Screen. Open it from there and turn them on.'
            : 'We’ll buzz you when a plan changes, something new goes up, or the day before you’re going.') + '</div></div>' +
        '<span ' + on(hide) + ' aria-label="Not now" style="flex:0 0 28px;width:28px;height:28px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(11, '#6b7280', 2.6) + '</span></div>' +
      (ps === 'off' ? '<button type="button" class="hov-primary" ' + on(turnOnPush) + ' style="align-self:flex-start;min-height:42px;padding:0 18px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Turn on notifications</button>' : '') +
    '</div>';
  };

  // ---- Add to Home Screen (not designed; HANDOFF §2): a pop-up on Welcome (once a visit) and once after signing in,
  // while the app isn't installed. Android Chrome hands us its install prompt (beforeinstallprompt), so our button
  // opens Chrome's dialog; iPhone has no prompt, so the pop-up shows the Share → Add to Home Screen steps.
  // iPhone browsers that can add to the Home Screen from their Share button: Safari and Chrome
  const IOS_BROWSER = !IS_IOS ? '' : /CriOS\//.test(navigator.userAgent) ? 'Chrome'
    : /Safari\//.test(navigator.userAgent) && !/FxiOS|EdgiOS|OPiOS|GSA\//.test(navigator.userAgent) ? 'Safari' : '';
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; setState({ canInstall: true }); });
  window.addEventListener('appinstalled', () => { installEvt = null; setState({ canInstall: false, installPop: false }); toast('Spark Hub is on your Home Screen', true); });
  // prompt (Android: our button opens Chrome's dialog) · ios (show the Share steps) · '' (installed, or this browser can't)
  const installMode = () => STANDALONE || IN_APP ? '' : state.canInstall && installEvt ? 'prompt' : IOS_BROWSER ? 'ios' : '';
  const startInstall = async () => {
    const mode = installMode();
    if (mode === 'ios') return setState({ installPop: true, profSheet: false });
    if (mode !== 'prompt') return;
    const e = installEvt;
    installEvt = null;   // Chrome's prompt works once; it offers a fresh one on a later visit
    setState({ installPop: false });
    try { await e.prompt(); await e.userChoice; } catch (err) { console.error(err); }
    setState({ canInstall: false });
  };
  // When to pop it up by itself: on Welcome once a visit, and once on this device after signing in. Called after each
  // render; waits for other pop-ups (sign-in, name, confirm…) to close first.
  const POP_WELCOME = 'spark-hub-install-welcome', POP_SIGNED_IN = 'spark-hub-install-pop';
  const popSeen = (store, k) => { try { return store.getItem(k) === 'shown'; } catch (e) { return true; } };
  const markPopSeen = (store, k) => { try { store.setItem(k, 'shown'); } catch (e) { /* fine */ } };
  let popTimer = null;
  const maybeInstallPop = () => {
    const st = state;
    if (popTimer || st.installPop || !installMode() || st.viewAs || st.screen === 'compose' || st.inv) return;   // never over the invite screens
    if (st.loginStep || st.nameAsk || st.confirm || st.guestOpen || st.joinOpen || st.pe || st.invite || st.profSheet || st.notifSheet) return;
    const which = welcomeShown() ? [sessionStorage, POP_WELCOME] : st.email && st.loaded ? [localStorage, POP_SIGNED_IN] : null;
    if (!which || popSeen(which[0], which[1])) return;
    popTimer = setTimeout(() => {
      popTimer = null;
      if (!installMode() || popSeen(which[0], which[1])) return;
      if (state.inv) return;
      markPopSeen(which[0], which[1]);
      setState({ installPop: true, invA2hs: false });
    }, st.invA2hs ? 1200 : 700);   // after an invite's Welcome: 1.2s into the group page
  };
  function viewInstallPop() {
    const mode = installMode();
    if (!mode) return '';
    const close = () => setState({ installPop: false });
    // Invite flow handoff, screen 5: bottom-anchored; iPhone shows the Share steps, Android Chrome its own prompt
    const step = (n, html) => '<li style="display:flex;align-items:center;gap:10px"><span aria-hidden="true" style="flex:0 0 26px;width:26px;height:26px;border-radius:999px;background:#11131f;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center">' + n + '</span>' +
      '<span style="flex:1;min-width:0">' + html + '</span></li>';
    const steps = mode === 'prompt' ? '' : '<ol style="margin:16px 0 0;padding:14px 16px;list-style:none;display:flex;flex-direction:column;gap:10px;border-radius:18px;background:#f0f1f5;font-size:15px;line-height:1.35;color:#11131f">' +
        step(1, IOS_BROWSER === 'Chrome' ? 'Tap <b style="font-weight:800">Share</b> at the top right' : 'Tap <b style="font-weight:800">Share</b> in Safari’s toolbar') +
        step(2, 'Choose <b style="font-weight:800">Add to Home Screen</b>') + '</ol>';
    return '<div class="modal-scrim" data-scrim="' + reg(close) + '" style="z-index:36;display:block;padding:0;background:rgba(17,19,31,.55)">' +
      '<div data-install-pop role="dialog" aria-modal="true" aria-label="Add to Home Screen" style="position:absolute;left:18px;right:18px;bottom:calc(28px + env(safe-area-inset-bottom, 0px));max-width:420px;margin:0 auto;background:#fff;border-radius:32px;padding:24px 22px;box-shadow:0 24px 60px rgba(17,19,31,.3);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
        '<div style="margin-bottom:8px;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#5b4ae8">Strongly recommended</div>' +
        '<h3 style="margin:0;font-size:26px;line-height:1.1;font-weight:900;letter-spacing:-.02em;color:#11131f">Put Spark Hub on<br>your Home Screen</h3>' +
        '<p style="margin:8px 0 0;font-size:16px;line-height:1.4;color:#5f6475">It becomes an app icon on your phone. No App Store, nothing to download.</p>' +
        steps +
        '<button type="button" ' + on(mode === 'prompt' ? startInstall : close) + ' style="margin-top:18px;width:100%;min-height:56px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:17px;font-weight:800;cursor:pointer">' + (mode === 'prompt' ? 'Add to Home Screen' : 'Got it') + '</button>' +
        '<button type="button" ' + on(close) + ' style="display:block;width:100%;margin-top:10px;min-height:36px;border:0;background:transparent;font-family:inherit;font-size:15px;font-weight:700;color:#6b7080;cursor:pointer">Maybe later</button>' +
      '</div></div>';
  }

  // v6: a slide-up sheet (from the bell), gear and Close beside the title
  function viewNotifSheet() {
    const st = state, all = notifList(), f = st.nFilter, shown = all.filter(n => f === 'all' || N_TYPES[n.type].cat === f), unread = all.filter(isUnread).length;
    const todayStart = midnight(todayISO());
    const secs = [['New', shown.filter(n => n.t >= todayStart)], ['Earlier this week', shown.filter(n => n.t < todayStart)]].filter(x => x[1].length);
    const chip = (k, label) => '<span ' + on(() => setState({ nFilter: k }), 'radio') + ' aria-checked="' + (f === k) + '" style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;font-size:13.5px;font-weight:800;white-space:nowrap;cursor:pointer;' +
      (f === k ? 'background:#0d1117;color:#fff' : 'background:#f2f3f6;color:#454b55') + '">' + label + '</span>';
    const row = (n, k) => {
      const T = N_TYPES[n.type], g = n.s && groupById(n.s.groupId), unr = isUnread(n), face = n.uid ? avatarOf(n.uid) : null;
      const initial = initialOf(n.type === 'reminder' ? n.s.text : n.who) || '?';
      const what = n.s ? '<b style="font-weight:800;color:#0d1117">' + esc(n.s.text) + '</b>' : '';
      const line = n.type === 'note' ? '<b style="font-weight:800;color:#0d1117">' + esc(n.body) + '</b>'
        : n.type === 'update' ? what + ' · ' + esc(n.quote)   // Round 65a
        : n.type === 'reminder'
        ? '<b style="font-weight:800;color:#0d1117">' + esc(n.who) + '</b> ' + what + esc(n.after)
        : '<b style="font-weight:800;color:#0d1117">' + esc(n.who) + '</b> ' + esc(n.text) + ' ' +
          (n.item ? '<b style="font-weight:800;color:#0d1117">' + esc(n.item) + '</b>' + (n.joiner ? esc(n.joiner) + what : ' on ' + what) : what);
      return '<div ' + on(() => openNotif(n)) + ' data-notif="' + esc(n.type) + '" style="display:flex;align-items:flex-start;gap:12px;padding:14px;border-top:' + (k ? '1px solid #f2f3f6' : '0') + ';background:' + (unr ? '#faf9ff' : '#fff') + ';cursor:pointer">' +
        '<span aria-hidden="true" style="position:relative;flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:' + (face ? bg(face) : FACE_SET[(n.who || '').length % FACE_SET.length]) + ';color:#fff;font-size:17px;font-weight:900;display:flex;align-items:center;justify-content:center">' + (face ? '' : esc(initial)) +
          '<span style="position:absolute;right:-3px;bottom:-3px;width:20px;height:20px;border-radius:999px;border:2px solid #fff;background:' + T.bg + ';color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1">' + T.glyph + '</span></span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:15px;line-height:1.35;font-weight:500;color:#2b303a">' + line + '</div>' +
          (n.quote && n.type !== 'update' ? '<div style="margin-top:8px;padding:10px 12px;border-radius:12px;background:#f2f3f6;font-size:14px;line-height:1.4;font-weight:500;color:#2b303a">' + esc(n.quote) + '</div>' : '') +
          '<div style="margin-top:4px;font-size:12.5px;font-weight:600;color:#9aa0ac">' + esc((n.type === 'update' ? 'From ' + firstName(n.who) + ' · ' : '') + ago(n.t) + (g ? ' · ' + g.name : '')) + '</div>' +
          (n.rsvp && !myRsvp(n.s)
            ? '<div style="margin-top:10px;display:flex;gap:8px">' +
                '<span ' + on(rsvpFromFeed(n, 'going')) + ' style="display:flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background:#149a4b;color:#fff;font-size:13.5px;font-weight:800;cursor:pointer">I’m going</span>' +
                '<span ' + on(rsvpFromFeed(n, 'maybe')) + ' style="display:flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background:#fff;color:#0d1117;box-shadow:inset 0 0 0 1.5px #dcdfe6;font-size:13.5px;font-weight:800;cursor:pointer">Maybe</span>' +
              '</div>'
            : '') +
        '</div>' +
        (unr ? '<span aria-label="Unread" style="flex:0 0 9px;width:9px;height:9px;margin-top:6px;border-radius:999px;background:#5b4ae8"></span>' : '') +
      '</div>';
    };
    const round = (label, icon, fn) => '<span ' + on(fn) + ' aria-label="' + label + '" style="width:40px;height:40px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + icon + '</span>';
    const close = () => setState({ notifSheet: false });
    const gear = round('Notification settings', svg(18, stroke('#0d1117', 2), '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'), () => setState({ nSettings: true }));
    return sheet6('Notifications', close,
      '<div style="display:flex;align-items:center;gap:10px">' + H1('Notifications', 'flex:1;min-width:0') + gear + closeX(close) + '</div>' +
        '<div class="no-scrollbar" role="radiogroup" aria-label="Show" style="margin-top:14px;display:flex;gap:8px;overflow-x:auto">' + chip('all', 'All') + chip('invites', 'Invites') + chip('updates', 'Updates') + chip('hosting', 'Hosting') + '</div>',
      '<div style="padding:16px 14px 30px;display:flex;flex-direction:column;gap:16px">' + pushCard() +
        (!st.loaded ? skeleton(4, 76)
          : secs.length
          ? secs.map(([label, items], i) => '<div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 4px 6px;min-height:32px"><span style="' + EYEBROW + '">' + label + (!i && unread ? ' · ' + unread : '') + '</span>' +
              (!i && unread ? '<span ' + on(markAllRead) + ' style="font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Mark all read</span>' : '') + '</div><div style="' + CARD + ';overflow:hidden">' + items.map(row).join('') + '</div></div>').join('')
          : '<div style="' + CARD + ';padding:18px;font-size:14.5px;line-height:1.45;font-weight:500;color:#6b7280">' + (f === 'all' ? 'You’re all caught up. New plans, updates and replies from the last week show up here.' : 'Nothing here this week.') + '</div>') +
      '</div>', 48);
  }

  function viewNotifSettings() {
    const n = state.notif, topics = n.topics || {}, close = () => setState({ nSettings: false });
    const toggle = (k) => () => saveNotif({ topics: Object.assign({}, topics, { [k]: topics[k] === false }) });
    return sheet('Notification settings', close, 'max-height:88%;overflow:auto;padding:10px 18px 26px',
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
        '<h3 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-.5px;color:#0d1117">Notifications</h3>' +
        '<div ' + on(close) + ' aria-label="Close" style="width:32px;height:32px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(15, '#0d1117', 2.4) + '</div>' +
      '</div>' +
      '<div style="font-size:14px;line-height:1.4;font-weight:500;color:#6b7280">What shows up in the app, and on your phone when that’s on.</div>' +
      phoneRow() +
      '<div style="margin-top:10px">' + N_TOPICS.map(([k, label, sub], i) => {
        const v = topics[k] !== false;
        return '<div ' + on(toggle(k), 'switch') + ' aria-checked="' + v + '" aria-label="' + esc(label) + '" style="display:flex;align-items:center;gap:12px;min-height:64px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + ';cursor:pointer">' +
          '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#0d1117">' + esc(label) + '</div><div style="font-size:13px;font-weight:500;color:#6b7280">' + esc(sub) + '</div></div>' +
          '<span aria-hidden="true" style="flex:0 0 46px;width:46px;height:28px;border-radius:999px;position:relative;transition:background 160ms;background:' + (v ? '#149a4b' : '#dcdfe6') + '"><span style="position:absolute;top:3px;left:' + (v ? 21 : 3) + 'px;width:22px;height:22px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left 160ms"></span></span>' +
        '</div>';
      }).join('') + '</div>' +
      '<div style="margin-top:14px;padding-top:14px;border-top:1px solid #f2f3f6;font-size:13px;line-height:1.4;font-weight:500;color:#6b7280">A topic that’s off is off in the app and on your phone.</div>', 45);
  }
  // Phone notifications on this device (Notification settings)
  const phoneRow = () => {
    const ps = pushStatus(), v = ps === 'on';
    const sub = { on: 'On for this phone', off: 'Off for this phone', denied: 'Blocked. Allow them for Spark Hub in your phone’s Settings.', install: 'On iPhone, add Spark Hub to your Home Screen first, then turn them on there.', none: 'This browser can’t show them.' }[ps];
    const canToggle = ps === 'on' || ps === 'off';
    return '<div ' + (canToggle ? on(v ? turnOffPush : turnOnPush, 'switch') + ' aria-checked="' + v + '" ' : '') + 'aria-label="Phone notifications" style="margin-top:12px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#f4f5f7;' + (canToggle ? 'cursor:pointer' : '') + '">' +
      '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#0d1117">Phone notifications</div><div style="font-size:13px;line-height:1.35;font-weight:500;color:#6b7280">' + esc(sub) + '</div></div>' +
      (canToggle ? '<span aria-hidden="true" style="flex:0 0 46px;width:46px;height:28px;border-radius:999px;position:relative;transition:background 160ms;background:' + (v ? '#149a4b' : '#dcdfe6') + '"><span style="position:absolute;top:3px;left:' + (v ? 21 : 3) + 'px;width:22px;height:22px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left 160ms"></span></span>' : '') +
    '</div>';
  };

  // Signed in but in no group yet (not designed; README → Open "first-run view")
  const noGroupCard = () =>
    '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:12px">' +
      '<div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">You’re not in a group yet.</div>' +
      '<div style="font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Join one with a code from its organizer.</div>' +
      '<button type="button" class="hov-primary" ' + on(() => openJoin()) + ' style="' + primary(true) + '">Join with a code</button>' +
    '</div>';

  // ---------------------------------------------------------------------------
  // 3. All ideas (per group)
  // ---------------------------------------------------------------------------

  // ---- v6 Update 2: reactions on past events (❤️ 🙌 🎉, 🙏 thanks, "Let's do it again!") ---------
  const RX6 = [['heart', '❤️', -4], ['praise', '🙌', 3], ['party', '🎉', -2]];
  const myReact = (s, k) => s.reactions.some(r => r.userId === state.me && r.kind === k);
  const countReact = (s, k) => s.reactions.filter(r => r.kind === k).length;
  const toggleReact = (s, k, opts) => needSignIn(() => {
    const on_ = myReact(s, k), o = opts || {};
    if (on_ && o.once) return;
    run(async () => {
      if (on_) must(await sb.from('reactions').delete().eq('spark_id', s.id).eq('user_id', state.me).eq('kind', k));
      else must(await sb.from('reactions').insert({ spark_id: s.id, user_id: state.me, kind: k }));
    }).then(ok => { if (ok && !on_ && o.note) toast(o.note, true); });
  }, 'default');
  const reactChip = (s, k, em, rot) => { const onIt = myReact(s, k), n = countReact(s, k);
    return '<span ' + on((e) => { stop(e); toggleReact(s, k); }, 'button') + ' aria-pressed="' + onIt + '" aria-label="' + esc({ heart: 'Love it', praise: 'Hands up', party: 'Party', thanks: 'Say thanks' }[k]) + ', ' + n + '" style="display:flex;align-items:center;gap:3px;height:30px;padding:0 9px 0 6px;border-radius:999px;font-size:15px;line-height:1;cursor:pointer;' +
      (onIt ? 'background:#f3f1fe;box-shadow:inset 0 0 0 1.5px #9d93f7' : 'background:#fff;box-shadow:0 1px 4px rgba(13,17,23,.18)') + '"><span>' + em + '</span><span style="font-size:12px;font-weight:900;color:#454b55">' + n + '</span></span>'; };
  // The It happened page: reactions and public thank-yous
  const reactionsCard = (s) => {
    const thanked = s.reactions.filter(r => r.kind === 'thanks').map(r => nameOf(r.userId, 'Someone'));
    return '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px">' +
      eyebrowRow('Reactions', '') +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + RX6.map(([k, em, rot]) => reactChip(s, k, em, rot)).join('') + reactChip(s, 'thanks', '🙏', 2) + '</div>' +
      // Round 64d: tap the thanks line for the list of who thanked
      (thanked.length ? '<div ' + on(() => setState({ thanksList: true })) + ' style="font-size:13.5px;line-height:1.4;font-weight:600;color:#6b7280;cursor:pointer">Thanks from ' + esc(thanked.slice(0, 3).map(firstName).join(', ') + (thanked.length > 3 ? ' and ' + (thanked.length - 3) + ' more' : '')) + '.</div>'
        : (isLead(s) ? '' : '<div style="font-size:13.5px;line-height:1.4;font-weight:600;color:#6b7280">🙏 sends ' + esc(firstName(nameOf(s.leadId, s.leadName))) + ' a public thank-you.</div>')) +
    '</div>';
  };

  // ---- Group pages (v6 Update 2): world switcher, Plans with Sort · Filter, the Ideas board, the Past scrapbook
  const helpersOf = (s) => { const set = {}; s.signups.forEach(it => it.claims.forEach(c => { if (c.userId !== s.leadId) set[c.userId] = 1; })); return Object.keys(set).length; };
  const picsOf = (s) => s.photoPaths.concat(s.album.map(a => a.path)).filter((p, i, a) => a.indexOf(p) === i).map(photoUrl);
  const ROT6 = [-2, 1.5, 1, -1.5, 2, -1];
  // A tilted card on the graph-paper board: photo, title, interested count, the four checkpoints as tiles
  const ideaCard6 = (s, k) => {
    const n = s.interested.length;
    return '<div ' + on(() => openSpark(s)) + ' data-card="' + esc(s.text) + '" data-rank="' + k + '" aria-label="' + esc(s.text) + '" style="background:#fff;border-radius:8px;padding:6px 6px 8px;box-shadow:0 3px 10px rgba(13,17,23,.14);transform:rotate(' + ROT6[k % 6] + 'deg);cursor:pointer;' + (k === 1 ? 'margin-top:22px' : '') + '">' +
      '<div style="position:relative;height:112px;border-radius:5px;overflow:hidden;background:' + photoBg(s) + '">' +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.9) 0%, rgba(13,17,23,.6) 28%, rgba(13,17,23,0) 55%)"></div>' +
        '<span aria-label="' + n + ' interested" style="position:absolute;top:6px;right:6px;display:flex;align-items:center;gap:3px;height:24px;padding:0 8px 0 6px;border-radius:999px;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(13,17,23,.2);font-size:12.5px;font-weight:900;color:#8f6405">' + svg(12, stroke('currentColor', 3), '<path d="M12 19V6M6 11.5 12 5.5l6 6"/>') + n + '</span>' +
        '<span aria-hidden="true" style="position:absolute;right:4px;top:0;bottom:0;display:flex;align-items:center;opacity:.9;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))">' + I.chevR(20, '#fff', 2.6) + '</span>' +
        '<div style="position:absolute;left:9px;right:26px;bottom:8px;font-size:14.5px;line-height:1.15;font-weight:900;color:#fff;text-wrap:balance">' + esc(s.text) + '</div></div>' +
      '<span style="display:flex;align-items:center;padding:8px 0 0">' + ideaSteps6(s).map((st, i) => '<span aria-label="' + st.label + ': ' + (st.p >= 1 ? st.done : st.todo) + '" style="flex:1;height:22px;display:flex;align-items:center;justify-content:center;' + (i ? 'border-left:1px solid #dcdfe4' : '') + '">' + ic6(st.icon, 15, st.p >= 1 ? '#149a4b' : '#b07a0a', 2.3) + '</span>').join('') + '</span></div>';
  };
  const ideaBoard6 = (ideas) => {
    const col = (list, off) => '<div style="display:flex;flex-direction:column;gap:14px">' + list.map((s, i) => ideaCard6(s, i * 2 + off)).join('') + '</div>';
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;padding:6px 2px 20px">' + col(ideas.filter((_, i) => i % 2 === 0), 0) + col(ideas.filter((_, i) => i % 2 === 1), 1) + '</div>';
  };
  // The Ideas board's quiet sort row: Most interest (default) · Newest · Almost there (most checkpoints done)
  const ISORTS6 = [['interest', 'Most interest'], ['new', 'Newest'], ['almost', 'Almost there']];
  const stepsDone6 = (s) => ideaSteps6(s).filter(st => st.p >= 1).length;
  const sortIdeas6 = (list, k) => list.slice().sort(
    k === 'new' ? (a, b) => b.created - a.created
      : k === 'almost' ? (a, b) => stepsDone6(b) - stepsDone6(a) || b.interested.length - a.interested.length
      : (a, b) => b.interested.length - a.interested.length || b.created - a.created);
  const ideaSortRow6 = (cur) => '<div role="group" aria-label="Sort ideas" style="display:flex;align-items:center;gap:14px;padding:0 4px;min-height:32px">' +
    '<span style="font-size:13px;font-weight:600;color:#8a909b">Sort</span>' +
    ISORTS6.map(([k, label]) => { const onIt = (cur || 'interest') === k;
      return '<span ' + on(() => setState({ iSort: k }), 'button') + ' aria-pressed="' + onIt + '" style="display:flex;align-items:center;min-height:32px;font-size:13px;cursor:pointer;' +
        (onIt ? 'font-weight:800;color:#0d1117;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px' : 'font-weight:600;color:#8a909b') + '">' + label + '</span>'; }).join('') + '</div>';
  // "{GROUP} · SO FAR": events · showed up · photos, with confetti
  const recap6 = (g, done) => {
    const went = done.reduce((a, s) => a + going(s).length, 0), photos = done.reduce((a, s) => a + picsOf(s).length, 0);
    const COL = ['#e8a71c', '#5b4ae8', '#149a4b', '#e2556b', '#1f7ab8'];
    const confetti = Array.from({ length: 16 }, (_, i) => '<span aria-hidden="true" style="position:absolute;left:' + ((i * 37) % 100) + '%;top:' + ((i * 53) % 120) + 'px;width:' + (i % 3 ? 6 : 8) + 'px;height:' + (i % 2 ? 3 : 8) + 'px;border-radius:' + (i % 2 ? '1px' : '999px') + ';background:' + COL[i % 5] + ';transform:rotate(' + (i * 40) + 'deg);opacity:.85"></span>').join('');
    const big = (n, label) => '<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:40px;line-height:1;font-weight:900;letter-spacing:-1.5px">' + n + '</span><span style="font-size:12px;font-weight:800;color:#c3c7d0">' + label + '</span></div>';
    const hide = g ? '<span ' + on(() => setState({ pastStatsHidden: Object.assign({}, state.pastStatsHidden, { [g.id]: true }) })) + ' aria-label="Hide this" style="position:absolute;top:4px;right:4px;z-index:1;width:36px;height:36px;display:flex;align-items:center;justify-content:center;opacity:.45;cursor:pointer">' + I.x(12, '#fff', 2.6) + '</span>' : '';
    return '<div data-screen-label="So far" style="position:relative;border-radius:18px;padding:16px;background:#1f2433;color:#fff;overflow:hidden;box-shadow:0 3px 12px rgba(60,40,10,.14)">' + confetti + hide +
      '<div style="position:relative;font-size:11px;font-weight:900;letter-spacing:1px;color:#ffd98a">' + esc((g ? g.name : 'This group').toUpperCase()) + ' · SO FAR</div>' +
      '<div style="position:relative;margin-top:10px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' + big(done.length, done.length === 1 ? 'event' : 'events') + big(went, 'showed up') + big(photos, photos === 1 ? 'photo' : 'photos') + '</div></div>';
  };
  // A memory card: the photo (a mosaic with four or more), "N went!", add a photo, who made it happen, reactions
  const WENT6 = ['#ffb347,#ff6f91', '#7b6ef0,#e05fc4', '#1fb86a,#1f9ec8', '#ff8a3d,#e2336b', '#3d8bff,#8a5cf0'];
  const pastCard6 = (s, i) => {
    const pics = picsOf(s), mosaic = pics.length >= 4, n = going(s).length, lead = nameOf(s.leadId, s.leadName), h = helpersOf(s);
    const thanks = countReact(s, 'thanks'), again = countReact(s, 'again'), mineAgain = myReact(s, 'again');
    const tile = (src, extra) => '<span style="background:' + bg(src) + ';' + (extra || '') + '"></span>';
    // A date sticker and a dashed rule above each memory
    return '<div style="margin-top:10px;display:flex;flex-direction:column;gap:10px">' +
      '<div style="display:flex;align-items:center;gap:10px"><span data-sticker style="flex:0 0 auto;display:flex;align-items:center;height:30px;padding:0 12px;border-radius:8px;background:#1f2433;color:#fff;font-size:13px;font-weight:900;letter-spacing:1px;box-shadow:0 2px 6px rgba(13,17,23,.2)">' + esc(monthDay(s.dayDate).toUpperCase()) + '</span><span aria-hidden="true" style="flex:1;border-top:2.5px dashed #b9bdc6"></span></div>' +
      '<div data-card="' + esc(s.text) + '" style="position:relative;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 3px 12px rgba(60,40,10,.16)">' +
      '<div ' + on(() => openSpark(s)) + ' aria-label="' + esc(s.text) + '" style="position:relative;height:190px;overflow:hidden;cursor:pointer;background:' + (mosaic ? '#fff' : photoBg(s)) + '">' +
        (mosaic ? '<div aria-hidden="true" style="position:absolute;inset:0;display:grid;grid-template-columns:1.3fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:3px">' + tile(pics[0], 'grid-row:1 / 3') + tile(pics[1], 'grid-column:2 / 4') + tile(pics[2]) + tile(pics[3]) + '</div>' : '') +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.88) 0%, rgba(13,17,23,0) 50%)"></div>' +
        '<label ' + on(stop) + ' aria-label="Add photos" style="position:absolute;bottom:10px;right:10px;z-index:2;width:34px;height:34px;border-radius:999px;background:rgba(255,255,255,.8);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;cursor:pointer">' +
          '<span style="position:relative;display:flex">' + I.photo(22, '#5b4ae8', 2.1) + '<span style="position:absolute;right:-6px;bottom:-5px;width:14px;height:14px;border-radius:999px;background:#5b4ae8;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center">' + I.plus(8, '#fff', 4.5) + '</span></span>' +
          '<input type="file" accept="image/*" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; if (f) addAlbumPhoto(s, f); }) + ' style="display:none"></label>' +
        '<span style="position:absolute;top:10px;right:10px;display:flex;align-items:center;gap:5px;height:34px;padding:0 13px 0 10px;border-radius:999px;background:linear-gradient(135deg,' + WENT6[(i || 0) % 5] + ');color:#fff;font-size:14.5px;font-weight:900;transform:rotate(4deg);box-shadow:0 3px 8px rgba(0,0,0,.25)"><span style="font-size:17px">🎉</span>' + n + ' went!</span>' +
        '<div style="position:absolute;left:12px;bottom:10px;right:56px;color:#fff"><div style="font-size:24px;line-height:1.1;font-weight:900;letter-spacing:-.5px;text-wrap:balance">' + esc(s.text) + '</div></div>' +
      '</div>' +
      '<div style="padding:10px 12px 12px;display:flex;flex-direction:column;gap:10px">' +
        '<div ' + on(() => openSpark(s)) + ' aria-label="Made it happen: ' + esc(lead) + ', ' + thanks + ' thanks" style="position:relative;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg,#f1edff,#e0d8ff);overflow:hidden;cursor:pointer">' +
          '<span aria-hidden="true" style="position:absolute;left:52%;top:5px;font-size:9px;color:#9d93f7">✦</span><span aria-hidden="true" style="position:absolute;left:64%;bottom:5px;font-size:7px;color:#7b6ef0">✦</span><span aria-hidden="true" style="position:absolute;left:44%;bottom:8px;font-size:10px;color:#fff">✧</span>' +
          '<span style="position:relative;flex:0 0 36px">' + face(s.leadId, lead, 36, '#7b6ef0', 'box-shadow:0 0 0 2.5px #7b6ef0') +
            '<span aria-hidden="true" style="position:absolute;top:-9px;left:-7px;font-size:11px;line-height:1;color:#9d93f7">✦</span><span aria-hidden="true" style="position:absolute;top:-6px;right:-8px;font-size:9px;line-height:1;color:#b8aefc">✦</span><span aria-hidden="true" style="position:absolute;bottom:-5px;right:-9px;font-size:12px;line-height:1;color:#7b6ef0">✧</span></span>' +
          '<div style="flex:1;min-width:0"><div style="font-size:10.5px;font-weight:900;letter-spacing:.8px;color:#6b5ce7">MADE IT HAPPEN</div><div style="font-size:14.5px;font-weight:900;color:#2a1f8f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(lead + (h ? ', with ' + h + (h === 1 ? ' helper' : ' helpers') : '')) + '</div></div>' +
          '<span style="display:flex;align-items:center;gap:3px;font-size:12px;font-weight:900;color:#4a3ad4">🙏 ' + thanks + I.chevR(14, '#4a3ad4', 2.8) + '</span></div>' +
        '<div style="display:flex;align-items:center;gap:6px">' + RX6.map(([k, em, rot]) => reactChip(s, k, em, rot)).join('') +
          '<span ' + on((e) => { stop(e); toggleReact(s, 'again', { once: true, note: 'Counted! ' + firstName(lead) + ' will see you want it again.' }); }, 'button') + ' aria-pressed="' + mineAgain + '" aria-label="Let’s do it again, ' + again + '" style="margin-left:auto;display:flex;align-items:center;gap:5px;height:34px;padding:0 10px 0 12px;border-radius:999px;background:#149a4b;color:#fff;font-size:12.5px;font-weight:900;white-space:nowrap;box-shadow:0 2px 8px rgba(20,154,75,.3);cursor:pointer">Let’s do it again!<span style="min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:rgba(255,255,255,.25);display:inline-flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:900">' + again + '</span></span></div>' +
      '</div></div></div>';
  };

  // Ideas · Plans · Past: tap a tab, swipe the page, or tap the quiet edge arrows. The new tab slides in
  // from the side you're heading to.
  const WORLDS = ['idea', 'plan', 'done'];
  const tabsTop = (sc) => {   // the scroll position that brings the Ideas · Plans · Past bar just into view
    const tabsEl = document.querySelector('[data-screen-label=Browse] [role=tablist]');
    return tabsEl ? Math.max(0, tabsEl.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 10) : sc.scrollTop;
  };
  const switchTab = (k, dir, dragged) => {
    const from = WORLDS.indexOf(state.phaseTab), to = WORLDS.indexOf(k);
    if (to < 0 || to === from) return;
    const sc = scroller(), top = sc ? Math.min(sc.scrollTop, tabsTop(sc)) : 0;
    setState({ phaseTab: k, menu: null });
    if (sc) sc.scrollTop = top;
    const pane = document.querySelector('[data-tabpane]');
    if (pane && !dragged && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      pane.style.animation = 'none'; void pane.offsetWidth;
      pane.style.animation = ((dir || (to > from ? 1 : -1)) > 0 ? 'paneFromRight' : 'paneFromLeft') + ' 240ms cubic-bezier(.2,.8,.2,1) both';
    }
  };
  const stepTab = (d) => { const i = WORLDS.indexOf(state.phaseTab) + d; if (i >= 0 && i < WORLDS.length) switchTab(WORLDS[i], d); };
  // Quiet chevrons on the screen's edges, nudging now and then toward the next tab
  const swipeHints = () => {
    const i = WORLDS.indexOf(state.phaseTab), names = { idea: 'Ideas', plan: 'Plans', done: 'Past' };
    const arrow = (d) => '<span ' + on(() => stepTab(d)) + ' aria-label="Go to ' + names[WORLDS[i + d]] + '" class="swipe-hint swipe-hint-' + (d < 0 ? 'l' : 'r') + '">' + (d < 0 ? I.chevL(16, '#454b55', 2.6) : I.chevR(16, '#454b55', 2.6)) + '</span>';
    return (i > 0 ? arrow(-1) : '') + (i < WORLDS.length - 1 ? arrow(1) : '');
  };

  function viewBrowse() {
    const st = state, g = currentGroup(), tab = st.phaseTab;
    const loading = !st.loaded;
    const gPhoto = groupPhoto(g), size = g ? st.sizes[g.id] : null;

    const header = '<header style="position:relative;height:calc(190px + var(--pt));background:#2b303a;overflow:hidden">' +
      (gPhoto ? '<div style="position:absolute;inset:0;overflow:hidden">' + photoLayer(gPhoto, g.photoPos, GROUP_POS) + '</div>' : '<div aria-hidden="true" style="position:absolute;inset:0;background:#e8a71c"></div>') +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.9) 0%, rgba(13,17,23,.45) 55%, rgba(13,17,23,.3) 100%)"></div>' +
      '<span ' + on(() => go('groups')) + ' aria-label="Back to groups" style="position:absolute;top:calc(14px + var(--pt));left:14px;z-index:3;width:44px;height:44px;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(13,17,23,.25);display:flex;align-items:center;justify-content:center;cursor:pointer" class="hov-fill-grey">' + I.chevL(18, '#0d1117', 2.6) + '</span>' +
      '<div style="position:absolute;top:calc(14px + var(--pt));right:16px;z-index:3;display:flex;gap:8px">' +
        (g ? '<span ' + on(openGroupSearch) + ' aria-label="Search this group" style="width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer">' + ic6('search', 19, '#fff', 2.4) + '</span>' : '') + bellBtn(true) + '</div>' +
      '<div style="position:absolute;left:18px;right:90px;bottom:16px;z-index:2;color:#fff">' +
        (size ? '<div style="font-size:13px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#cfc9ff">' + size + (size === 1 ? ' member' : ' members') + '</div>' : '') +
        '<h1 style="margin:2px 0 0;font-size:34px;line-height:1.02;font-weight:900;letter-spacing:-1.1px;color:#fff;text-wrap:balance;text-shadow:0 1px 8px rgba(0,0,0,.3)">' + esc(g ? g.name : 'Spark Hub') +
          (runs(g) ? '<span ' + on((e) => { stop(e); openGroupPage(g.id, false, 'browse'); }) + ' aria-label="Edit group" style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;margin-left:6px;vertical-align:4px;border-radius:999px;color:rgba(255,255,255,.6);cursor:pointer">' + svg(16, stroke('currentColor', 2.2), '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>') + '</span>' : '') +
        '</h1></div>' +
      (g ? '<button type="button" class="hov-primary" ' + on(() => goCompose()) + ' aria-label="I have an idea" style="position:absolute;right:16px;bottom:16px;z-index:3;width:52px;height:52px;border:0;border-radius:999px;background:#5b4ae8;box-shadow:0 6px 16px rgba(13,17,23,.35);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.plus(22, '#fff', 2.8) + '</button>' : '') +
    '</header>';

    const offline = st.error === 'load'
      ? '<div role="status" style="margin:14px 14px 0;display:flex;align-items:flex-start;gap:12px;background:#fdeef0;border:1.5px solid #f5c2cb;border-radius:14px;padding:13px 14px">' +
          '<span style="flex:0 0 30px;width:30px;height:30px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center">' + I.offline + '</span>' +
          '<div style="flex:1 1 auto;min-width:0"><div style="font-size:14.5px;font-weight:800;color:#9b1c31">Couldn’t load ideas</div>' +
          '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:600;color:#9b1c31;text-wrap:pretty">Check your connection. We’ll keep trying, and this goes away once you’re back.</div></div>' +
          '<span ' + on(retryNow) + ' style="flex:0 0 auto;min-height:30px;display:flex;align-items:center;font-size:13.5px;font-weight:800;color:#9b1c31;text-decoration:underline;text-underline-offset:3px;cursor:pointer">Try now</span>' +
        '</div>'
      : '';

    // The world switcher: Ideas N · Plans N · Past N on a gray track, a white thumb sliding to the one that's on
    const counts = { idea: visible('idea').length, plan: visible('plan').length, done: visible('done').length };
    const thumbPos = { idea: 'left:4px;width:calc(100% / 3.4 - 6px)', plan: 'left:calc(100% / 3.4 + 2px);width:calc(100% * 1.4 / 3.4 - 4px)', done: 'left:calc(100% * 2.4 / 3.4 + 2px);width:calc(100% / 3.4 - 6px)' }[tab] || '';
    const tabs = g ? '<div style="position:relative;padding:14px 14px 0;z-index:3"><div role="tablist" aria-label="Ideas, plans and past events" style="position:relative;height:44px;border-radius:999px;background:#dfe2e7;display:grid;grid-template-columns:1fr 1.4fr 1fr;align-items:center">' +
      '<span aria-hidden="true" style="position:absolute;top:4px;bottom:4px;border-radius:999px;background:#fff;box-shadow:0 1px 4px rgba(13,17,23,.15);transition:left 220ms cubic-bezier(.2,.8,.2,1),width 220ms cubic-bezier(.2,.8,.2,1);' + thumbPos + '"></span>' +
      [['idea', 'Ideas'], ['plan', 'Plans'], ['done', 'Past']].map(([k, label]) => {
        const onIt = tab === k;
        return '<span ' + on((e) => { stop(e); switchTab(k); }, 'tab') + ' aria-selected="' + onIt + '" style="position:relative;display:flex;align-items:baseline;justify-content:center;gap:5px;height:100%;line-height:44px;font-size:' + (k === 'plan' ? 14.5 : 13) + 'px;font-weight:900;cursor:pointer;white-space:nowrap;transition:color 180ms ease;color:' + (onIt ? '#0d1117' : '#6b7280') + '">' +
          label + '<span style="font-size:11.5px;font-weight:800;color:' + (onIt ? '#6b7280' : '#9aa0aa') + '">' + counts[k] + '</span></span>';
      }).join('') + '</div></div>' : '';

    const { body, pageStyle } = browseBody(tab, g);

    return '<div data-screen-label="Browse" style="' + pageStyle + '">' + header + offline + tabs +
      '<div data-tabpane style="padding:10px 14px 22px;display:flex;flex-direction:column;gap:22px">' +
        (loading ? '<div style="padding:0 4px;font-size:14px;font-weight:700;color:#6b7280">Loading ideas…</div>' : '') + body +
      '</div>' +
      '<div style="height:var(--nav-h)"></div></div>';
  }

  // One tab's content on a group page (also drawn beside the page while it's being swiped)
  const IDEA_PAPER = 'background:#fbfaf6;background-image:linear-gradient(#eeeae0 1px, transparent 1px), linear-gradient(90deg, #eeeae0 1px, transparent 1px);background-size:18px 18px';
  function browseBody(tab, g) {
    const st = state, gv = st.view === 'list' ? 'list' : 'tiles';
    let body, pageStyle = '';
    if (!st.loaded) {
      body = [0, 1, 2].map(() => '<div aria-hidden="true" style="height:180px;border-radius:20px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);animation:skPulse 1.4s ease-in-out infinite"></div>').join('');
    } else if (!g) {
      body = noGroupCard();
    } else if (tab === 'idea') {
      // The Ideas board: graph paper, two tilted columns (no sort, filter or view here)
      pageStyle = 'min-height:100%;' + IDEA_PAPER;
      const ideas = sortIdeas6(visible('idea'), st.iSort);
      body = ideas.length ? '<div style="display:flex;flex-direction:column;gap:6px">' + ideaSortRow6(st.iSort) + ideaBoard6(ideas) + '</div>' : '<div style="padding:24px 8px;text-align:center;font-size:15px;font-weight:700;color:#8a909b">No ideas yet. Toss one on the board!</div>';
    } else if (tab === 'done') {
      // The Past scrapbook: the recap, then a memory card per event (newest first)
      const done = visible('done').slice().sort((a, b) => byWhen(b, a));
      body = '<div style="display:flex;flex-direction:column;gap:14px;padding-bottom:20px">' + (st.pastStatsHidden[g.id] ? '' : recap6(g, done)) +
        (done.length ? done.map((s, i) => pastCard6(s, i)).join('') : '<div style="background:#fff;border-radius:16px;padding:18px;text-align:center;font-size:15px;font-weight:700;color:#8a909b">Nothing here yet. Your first memory is one event away.</div>') + '</div>';
    } else {
      // Plans: Your schedule's cards and controls (Sort · Filter · Tiles / List), the strips expanding in place
      const all = visible('plan'), plans = applySort(applyFilters(all, st.gFilt), st.gSort), clear = () => setState({ gFilt: [], menu: null });
      const controls = '<div style="display:flex;align-items:center;gap:6px">' +
        sortPill('gSort', st.gSort, (k) => setState({ gSort: k, menu: null })) +
        filterPill('gFilt', filterOpts(['lead', 'help', 'going', 'open', 'needs', 'week'], all, st.gFilt), st.gFilt,
          (k) => setState({ gFilt: st.gFilt.indexOf(k) > -1 ? st.gFilt.filter(x => x !== k) : st.gFilt.concat([k]) }), clear, plans.length) +
        viewPicker('gview', gv, (k) => setState({ view: k, menu: null }), SCHED_VIEWS) + '</div>';
      if (!all.length) body = '<div style="' + CARD + ';padding:18px"><div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">No plans yet.</div><div style="margin-top:4px;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">When a lead locks in a date and time, it shows up here.</div></div>';
      else if (!plans.length) body = '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(st.gSort === 'soon' ? 'Coming up' : sortName6(st.gSort), controls) + filterEmpty(clear) + '</div>';
      else body = sections6(plans, st.gSort, 'Date to be decided').map((z, i) => '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(z.label, i ? '' : controls) +
        '<div style="display:flex;flex-direction:column;gap:' + (gv === 'list' ? 10 : 14) + 'px">' + z.items.map(s => gv === 'list' ? listCard6(s, partOf(s, true)) : tile6(s, partOf(s, true), 180)).join('') + '</div></div>').join('');
    }
    return { body, pageStyle };
  }

  // Search inside one group: Browse chips, "Or something unexpected", live results
  const openGroupSearch = () => { setState({ gSearch: true, menu: null }); setTimeout(() => { const f = document.querySelector('[data-csearch]'); if (f) f.focus(); }, 30); };
  function viewGroupSearch() {
    const st = state, g = currentGroup(), gname = g ? g.name : 'this group', q = st.gq.trim(), t = st.gTry;
    const close = () => setState({ gSearch: false, gq: '', gTry: null });
    const inG = st.sparks.filter(s => g && inGroup(s, g.id));
    const BROWSE = { plan: ['Plans', (s) => phaseOf(s) === 'plan'], idea: ['Ideas', (s) => phaseOf(s) === 'idea'], done: ['Past events', (s) => phaseOf(s) === 'done'], needs: ['Needs helpers', (s) => phaseOf(s) === 'plan' && signupFill(s).open > 0] };
    const results = !q && !t ? [] : inG.filter(s => matchQ(s, q) && (!t || BROWSE[t][1](s))).slice(0, 30);
    const pick = (fn) => () => { const s = fn(); if (!s) { toast('Nothing like that here yet'); return; } close(); openSpark(s); };
    const up = inG.filter(s => phaseOf(s) === 'plan').sort(byWhen), ideas = inG.filter(s => phaseOf(s) === 'idea'), done = inG.filter(s => phaseOf(s) === 'done');
    const magic = [
      { icon: 'cards', title: 'Wildcard', sub: 'A random ' + esc(gname) + ' event', bg: '#f3f1fe', ink: '#5b4ae8', pick: pick(() => rnd6(up)) },
      { icon: 'moon', title: 'Next up here', sub: 'The very next thing on', bg: '#1f2433', ink: '#cfc9ff', pick: pick(() => up[0]) },
      { icon: 'people', title: 'They need you', sub: 'Most open helper spots', bg: '#fdf1d6', ink: '#8f6405', pick: pick(() => up.filter(s => signupFill(s).open > 0).sort((a, b) => signupFill(b).open - signupFill(a).open)[0]) },
      { icon: 'compass', title: 'Hidden gem', sub: 'An idea few have spotted yet', bg: '#e7f6ec', ink: '#149a4b', pick: pick(() => ideas.slice().sort((a, b) => a.interested.length - b.interested.length)[0]) },
      { icon: 'cup', title: 'Throwback', sub: 'Relive a past ' + esc(gname) + ' moment', bg: '#fde8ec', ink: '#c2415a', pick: pick(() => rnd6(done)) },
      { icon: 'sun', title: 'Fresh off the press', sub: 'The newest thing posted here', bg: '#e6f3fb', ink: '#1f7ab8', pick: pick(() => inG.slice().sort((a, b) => b.created - a.created)[0]) }
    ];
    const hint = '<div style="display:flex;flex-direction:column;gap:4px;padding:0 4px">' +
      '<span style="font-size:11.5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#8a909b">Browse</span>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:4px">' + Object.keys(BROWSE).map(k => tryChip(BROWSE[k][0], () => setState({ gTry: k }))).join('') + '</div>' +
      magicGrid(magic) + '</div>';
    const sub = (s) => [phaseOf(s) === 'idea' ? 'Idea' : phaseOf(s) === 'done' ? 'Past' : '', s.dayDate ? fmtDay(s.dayDate) : '', s.spot || ''].filter(Boolean).join(' · ');
    return sheet6('Group search', close,
      searchHead('Search this group', st.gq, 'Search ' + gname, (v) => setState({ gq: v }), () => setState({ gq: '' }), close),
      '<div style="padding:14px 14px 28px;display:flex;flex-direction:column;gap:8px">' +
        (!q && !t ? hint : '') +
        (t ? tryOn(BROWSE[t][0], () => setState({ gTry: null })) : '') +
        ((q || t) && !results.length ? '<div style="background:#fff;border-radius:16px;padding:16px;font-size:15px;font-weight:600;color:#6b7280">Nothing in this group matches “' + esc(q || BROWSE[t][0]) + '”.</div>' : '') +
        results.map(s => searchRow(s, sub(s))).join('') +
      '</div>', 64, '8px 14px 12px');
  }

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
      '<header style="position:relative;background:#fff;padding:10.5px 16px 10px;min-height:64px">' + logo(false) + (myGroups().length ? switcher(false) : '') + '</header>' +
      '<div style="height:1px;background:#e6e7eb"></div>' +
      '<section style="padding:20px 20px 26px">' +
        '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#0f7a3c">How this works</div>' +
        '<h2 style="margin:8px 0 0;font-size:28px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">Ideas come to life when we build them together</h2>' +
        '<p style="margin:12px 0 0;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">Spark Hub is where your groups plan things. Anyone can start something, and everyone can help make it happen.</p>' +
        '<div style="margin-top:20px;display:flex;flex-direction:column;gap:16px">' +
          step(1, '#efedfd', '#4a3ad4', 'Create an event', 'Add a title and whatever you know. Date, place and details can wait. Let the group vote on them.') +
          step(2, '#fdf4e2', '#8f6405', 'RSVP &amp; pitch in', 'Neighbors RSVP, vote on dates and spots, and sign up to bring things or help out.') +
          step(3, '#e7f6ec', '#0f7a3c', 'Make it happen', 'Everyone going gets a reminder the day before. Afterwards, add photos and thank whoever helped.') +
        '</div>' +
        '<div style="height:1px;background:#eceef2;margin:22px 0"></div>' +
        '<div style="' + EYEBROW + '">Good to know</div>' +
        '<div style="margin-top:12px;display:flex;flex-direction:column;gap:12px">' +
          note(ic('<path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6l-7-2.8Z"/><path d="M9.2 12.1l2.1 2.1 3.6-3.9"/>'), 'Groups are private.', 'Only members see a group’s events, and you join with a code or a link.') +
          note(ic('<path d="M16.6 3.8l3.6 3.6L8.4 19.2 4 20.5l1.3-4.4L16.6 3.8Z"/>'), 'Hosts stay in charge.', 'People can suggest dates and spots. The host decides what the event becomes.') +
          note(ic('<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.2 2"/>'), 'Your tasks keeps track.', 'Anything you’re hosting or signed up for shows up there with what’s left to do.') +
        '</div>' +
        ideaButton('margin-top:26px') +
      '</section>' +
      '<div style="height:92px"></div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // 4. Idea page
  // ---------------------------------------------------------------------------

  // The idea / plan / happened page, by phase
  function viewDetail(s) {
    const ph = phaseOf(s);
    return ph === 'plan' ? viewPlan(s) : ph === 'done' ? viewDone(s) : viewIdea(s);
  }

  // Suggestions waiting on the lead ("Waiting on you"): on ideas, and on plans since v6 (Your tasks' Review)
  const pendingCard = (s) => {
    const st = state, pending = isLead(s) ? s.pending : [], d = dayOf(s);
    return (pending.length
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
          : '');
  };

  function viewIdea(s) {
    const st = state, lead = isLead(s), g = groupById(s.groupId);
    const cover = s.photoPaths[0] ? photoUrl(s.photoPaths[0]) : null;
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

    const myWaiting = lead ? [] : s.pending.filter(p => p.userId === st.me);
    const pitching = s.offers.map(o => ({ who: nameOf(o.userId, o.who), line: OFFER_LINES[o.kind] + offerText(o), waiting: false }))
      .concat(myWaiting.map(p => ({ who: nameOf(p.userId, p.who), line: OFFER_LINES[p.kind] + offerText(p), waiting: true })));

    const mood = s.mood.slice(0, 3);
    const showMood = mood.length > 0 || lead;

    return '<div data-screen-label="Idea page">' +
      '<div style="position:relative;height:calc(210px + var(--pt));overflow:hidden;background:#2b2413">' +
        (cover ? photoLayer(cover, s.coverPos, IDEA_POS) : '<div aria-hidden="true" style="position:absolute;inset:0;background:' + groupBg(g, '#2b2413') + '"></div>') +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(13,17,23,.68) 0%, rgba(13,17,23,.18) 40%, rgba(13,17,23,.18) 70%, rgba(13,17,23,.45) 100%)"></div>' +
        '<div style="position:absolute;top:calc(12px + var(--pt));left:12px;right:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;z-index:1">' +
          backBtn(s) +
          '<span style="flex:1"></span>' +
          '<span style="flex:0 0 40px;width:40px"></span>' +
        '</div>' +
        // The lead frames the cover (or adds one): the Photo positioner
        (lead
          ? (cover
              ? '<span ' + on(() => openPositioner({ kind: 'idea', id: s.id, url: cover, pos: s.coverPos })) + ' style="' + PHOTO_PILL + '">' + I.camera2 + 'Photo</span>'
              : '<label style="' + PHOTO_PILL + '">' + I.camera2 + 'Add a photo<input type="file" accept="image/*" aria-label="Add a cover photo" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; pickForPositioner(f, { kind: 'idea', id: s.id }); }) + ' style="display:none"></label>')
          : '') +
        (st.tag ? '<div style="position:absolute;right:16px;bottom:44px;z-index:1;transform:rotate(5deg);background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:800;color:#0d1117;box-shadow:0 8px 20px rgba(15,18,25,.18);animation:popIn 320ms cubic-bezier(.22,.9,.28,1) both">' + esc(st.tag) + '</div>' : '') +
      '</div>' +

      '<div style="position:relative;margin-top:-28px;background:#fff;border-radius:26px 26px 0 0;padding:22px 20px 20px;display:flex;flex-direction:column;gap:12px">' +
        ideaBanner(s) +
        (canEdit(s)
          ? '<h1 ' + on(() => openSec(s, 'title')) + ' aria-label="' + esc(s.text) + ', edit the title" style="margin:0;font-size:30px;line-height:1.08;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty;cursor:pointer">' + esc(s.text) + svg(18, stroke('#6b7280', 2.4) + ' style="display:inline-block;margin-left:8px;vertical-align:2px"', PENCIL) + '</h1>'
          : '<h1 style="margin:0;font-size:30px;line-height:1.08;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">' + esc(s.text) + '</h1>') +
        '<div id="sec-people" style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#454b55">' +
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
        pendingCard(s) +

        (lead ? makePlanCard(s) : '') +
        datesBoard(s) + spotsBoard(s) + signupsCard(s) +
        (lead ? '' : organizerCard(s)) +

        '<div style="' + CARD + ';padding:18px 16px;display:flex;flex-direction:column;gap:10px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
            '<span style="' + EYEBROW + '">Basic details</span>' +
            (canEdit(s) && basicsOf(s).length ? '<span ' + on(() => openSec(s, 'details')) + ' style="font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span>' : '') +
          '</div>' +
          (basicsOf(s).length
            ? '<div style="display:flex;flex-direction:column;gap:9px">' + basicsOf(s).slice(0, 3).map(h =>
                '<div style="display:flex;align-items:center;gap:11px"><span style="flex:0 0 8px;width:8px;height:8px;border-radius:999px;background:#e8a71c"></span><span style="font-size:16.5px;line-height:1.35;font-weight:700;letter-spacing:-.2px;color:#0d1117">' + esc(h) + '</span></div>').join('') + '</div>'
            : lead
              ? '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">Up to three quick notes on what to expect or the vibe.</p>' +
                '<span ' + on(() => openSec(s, 'details')) + ' class="hov-outline" style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:40px;padding:0 15px;border:1.5px solid #dcdfe6;border-radius:999px;font-size:14.5px;font-weight:800;color:#0d1117;cursor:pointer">+ Add basic details</span>'
              : '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#9aa0ac">' + esc(leadName) + ' hasn’t added basic details yet.</p>') +
        '</div>' +

        (s.vision && s.hopes.length
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
                '<span style="' + EYEBROW + '">Inspo</span>' +
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
        deleteLink(s) +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  // ---------------------------------------------------------------------------
  // 4b. V5: idea boards, the plan page and "it happened"
  // ---------------------------------------------------------------------------

  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.round(h / 24);
    return d === 1 ? 'Yesterday' : d + ' days ago';
  };
  const DOWS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dateParts = (iso) => { if (!iso) return { dow: '', md: '', mon: '', day: '–' }; const d = new Date(iso + 'T12:00:00'); return { dow: DOWS[d.getDay()], md: MONTHS[d.getMonth()].toUpperCase() + ' ' + d.getDate(), mon: MONTHS[d.getMonth()].toUpperCase(), day: d.getDate() }; };
  const eyebrowRow = (label, right) => '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span style="' + EYEBROW + '">' + label + '</span>' + (right || '') + '</div>';
  const peopleFaces = (ids, size, ring) => ids.map((u, i) => {
    const url = avatarOf(u);
    return '<span aria-hidden="true" style="flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:999px;border:2.5px solid ' + (ring || '#fff') + ';margin-left:' + (i ? '-10px' : '0') + ';background:' + (url ? bg(url) : FACE_COLORS[i % 3]) + ';color:#fff;font-size:' + Math.round(size * .34) + 'px;font-weight:900;display:flex;align-items:center;justify-content:center">' + (url ? '' : esc(initialOf(nameOf(u)) || '?')) + '</span>';
  }).join('');

  // Date → Location → Details → Plan, in the idea's gold strip
  const ideaBanner = (s) => {
    const steps = [['Date', !!s.dayDate], ['Location', !!s.spot], ['Basic details', basicsOf(s).length > 0]]
      .map((x, i) => x.concat(i)).sort((a, b) => (b[1] - a[1]) || (a[2] - b[2]));
    const line = '<span style="flex:1;height:3px;margin-top:7.5px;border-radius:999px;background:rgba(61,42,0,.2)"></span>';
    const step = ([label, met]) => '<div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:3px;width:52px">' +
      (met ? '<span style="width:18px;height:18px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:#3d2a00;color:#fff;font-size:9.5px;font-weight:900">✓</span>'
           : '<span style="width:18px;height:18px;border-radius:999px;box-shadow:inset 0 0 0 2px rgba(61,42,0,.4)"></span>') +
      '<span style="font-size:10.5px;line-height:1.1;font-weight:800;color:' + (met ? '#0d1117' : '#6b4d00') + ';text-align:center">' + label + '</span></div>';
    return '<div aria-label="Steps to a plan" style="margin:-22px -20px 2px;padding:8px 16px 7px;border-radius:26px 26px 0 0;background:#f3c55a;display:flex;align-items:flex-start">' +
      steps.map((x, k) => (k ? line : '') + step(x)).join('') + line +
      '<div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:3px;width:52px">' +
        '<span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center">' + svg(16, stroke('#0f7a3c', 2.2), '<path d="M5 21V4"/><path d="M5 4.5c2.5-1.5 5-1.5 7 0s4.5 1.5 7 0v9c-2.5 1.5-5 1.5-7 0s-4.5-1.5-7 0"/>') + '</span>' +
        '<span style="font-size:10.5px;line-height:1.1;font-weight:800;color:#0f7a3c;text-align:center">Plan</span></div>' +
    '</div>';
  };

  // DATES: the lead's date first (picked), then everyone's suggestions by votes. Tap to vote; the lead taps to pick.
  const datesBoard = (s) => {
    const lead = isLead(s);
    const opts = s.dateOpts.filter(o => !(o.dayDate === s.dayDate && (o.dayTime || null) === (s.dayTime || null)))
      .sort((a, b) => b.votes.length - a.votes.length || a.dayDate.localeCompare(b.dayDate));
    const tile = (dp, time, votes, onIt, picked, fn, label) => '<div ' + on(fn) + ' aria-label="' + esc(label) + '" style="flex:0 0 138px;scroll-snap-align:start;border-radius:18px;background:' + (onIt ? '#5b4ae8' : '#fff') + ';color:' + (onIt ? '#fff' : '#0d1117') + ';padding:12px 12px 10px;display:flex;flex-direction:column;gap:2px;min-height:104px;box-shadow:' + (onIt ? '0 6px 16px rgba(91,74,232,.3)' : picked ? '0 0 0 2px #149a4b, 0 1px 3px rgba(15,18,25,.08)' : '0 1px 3px rgba(15,18,25,.08)') + ';cursor:pointer">' +
      '<span style="display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:900;letter-spacing:.8px;color:' + (onIt ? '#d9d4ff' : '#6b7280') + '">' + dp.dow + (picked ? '<span style="border-radius:999px;padding:1px 6px;background:#e7f6ec;color:#0f7a3c;font-size:9.5px">PICKED</span>' : '') + '</span>' +
      '<span style="font-size:20px;line-height:1.15;font-weight:800;white-space:nowrap">' + dp.md + '</span>' +
      '<span style="font-size:12px;font-weight:700;color:' + (onIt ? '#d9d4ff' : '#6b7280') + '">' + esc(time ? fmtTime(time) : 'Time TBD') + '</span>' +
      (votes == null ? '' : '<span style="margin-top:auto;align-self:flex-end;display:flex;align-items:center;gap:3px;min-height:23px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:900;' + (onIt ? 'background:rgba(255,255,255,.2);color:#fff' : 'box-shadow:inset 0 0 0 1.5px #e6e7eb;color:#5c6270') + '">' + svg(10, 'fill="currentColor"', '<path d="M12 5l7 9H5z"/>') + votes + '</span>') +
    '</div>';
    return '<div id="sec-dates" style="display:flex;flex-direction:column;gap:8px;margin:2px -14px 0">' +
      '<div style="padding:0 18px"><span style="' + EYEBROW + '">Dates</span></div>' +
      '<div class="no-scrollbar" style="display:flex;gap:8px;padding:0 14px 4px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 14px">' +
        (s.dayDate ? tile(dateParts(s.dayDate), s.dayTime, null, false, true, () => { if (lead) openOffer(s, 'day'); }, 'Picked: ' + fmtDay(s.dayDate)) : '') +
        opts.map(o => {
          const mine = o.votes.indexOf(state.me) > -1;
          return tile(dateParts(o.dayDate), o.dayTime, o.votes.length, mine, false, () => { if (state.busy) return; if (lead) pickDate(s, o); else vote('date_votes', s, o); },
            fmtDay(o.dayDate) + (o.dayTime ? ' ' + fmtTime(o.dayTime) : '') + ', ' + o.votes.length + ' votes, suggested by ' + o.who);
        }).join('') +
        '<div ' + on(() => openOffer(s, 'day')) + ' style="flex:0 0 118px;scroll-snap-align:start;border-radius:18px;border:1.5px dashed #b9b2f5;background:#f3f1fe;min-height:104px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#5b4ae8;cursor:pointer"><span style="font-size:22px;line-height:1;font-weight:700">+</span><span style="font-size:13.5px;font-weight:800">' + (lead ? (s.dayDate ? 'Change date' : 'Add a date') : 'Suggest a date') + '</span></div>' +
      '</div>' +
      (lead && opts.length ? '<div style="padding:0 18px;font-size:12.5px;font-weight:600;color:#8a909b">Tap a suggestion to use it.</div>' : '') +
    '</div>';
  };

  // LOCATION: the picked spot, then suggestions with votes. The lead taps a suggestion to use it.
  const spotsBoard = (s) => {
    const lead = isLead(s);
    const opts = s.spotOpts.filter(o => o.name !== s.spot).sort((a, b) => b.votes.length - a.votes.length);
    const directions = s.spotPoint ? '<a href="https://www.google.com/maps/dir/?api=1&amp;destination=' + s.spotPoint[0] + ',' + s.spotPoint[1] + '" target="_blank" rel="noopener noreferrer" style="flex:0 0 auto;font-size:13px;font-weight:800;color:#5b4ae8">Directions</a>' : '';
    const row = (name, noteHtml, right, i, fn) => '<div ' + (fn ? on(fn) + ' ' : '') + 'style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:' + (i ? '1px solid #f2f3f6' : '0') + (fn ? ';cursor:pointer' : '') + '">' +
      '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#0d1117">' + esc(name) + '</div>' + noteHtml + '</div>' + right + '</div>';
    const note = (t, extra) => '<div style="display:flex;align-items:baseline;gap:6px;min-width:0;font-size:13px;font-weight:500;color:#6b7280"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t) + '</span>' + (extra || '') + '</div>';
    let i = 0;
    return '<div id="sec-loc" style="display:flex;flex-direction:column;gap:8px">' +
      '<div style="padding:0 4px"><span style="' + EYEBROW + '">Location</span></div>' +
      '<div style="' + CARD + ';padding:6px 16px;display:flex;flex-direction:column">' +
        (s.spot ? row(s.spot, note([nameOf(s.leadId, s.leadName), s.spotAddress].filter(Boolean).join(' · '), directions ? '<span style="flex:0 0 auto">· ' + directions + '</span>' : ''),
          '<span style="border-radius:999px;padding:3px 8px;background:#e7f6ec;font-size:11px;font-weight:900;color:#0f7a3c">PICKED</span>', i++) : '') +
        opts.map(o => {
          const mine = o.votes.indexOf(state.me) > -1;
          const voteBtn = '<span ' + on((e) => { stop(e); if (!state.busy) vote('spot_votes', s, o); }) + ' aria-label="' + (mine ? 'Remove your vote for ' : 'Vote for ') + esc(o.name) + '" aria-pressed="' + mine + '" style="flex:0 0 44px;height:52px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;background:' + (mine ? '#5b4ae8' : '#fff') + ';color:' + (mine ? '#fff' : '#6b7280') + ';box-shadow:' + (mine ? 'none' : 'inset 0 0 0 1.5px #e6e7eb') + '">' + svg(14, 'fill="currentColor"', '<path d="M12 5l7 9H5z"/>') + '<span style="font-size:14px;font-weight:900">' + o.votes.length + '</span></span>';
          return row(o.name, note(['Suggested by ' + o.who, o.address].filter(Boolean).join(' · ')), voteBtn, i++, lead ? () => { if (!state.busy) pickSpot(s, o); } : null);
        }).join('') +
        '<div ' + on(() => openOffer(s, 'spot')) + ' style="display:flex;align-items:center;gap:12px;min-height:52px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + ';font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer"><span style="font-size:20px;line-height:1">+</span>' + (lead ? (s.spot ? 'Change location' : 'Add a location') : 'Suggest a location') + '</div>' +
      '</div>' +
      (lead && opts.length ? '<div style="padding:0 4px;font-size:12.5px;font-weight:600;color:#8a909b">Tap a suggestion to use it.</div>' : '') +
    '</div>';
  };

  const makePlanCard = (s) => {
    const ready = !!(s.dayDate && s.dayTime), n = s.interested.length;
    return ready
      ? '<div style="' + CARD + ';padding:18px;box-shadow:0 0 0 2px #bfe9cf, 0 1px 3px rgba(15,18,25,.08);display:flex;flex-direction:column;gap:6px">' +
          '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#0f7a3c">Ready when you are</div>' +
          '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">It has a date and a time. Make it a plan, and ' + (n ? (n === 1 ? 'the 1 person who’s interested shows as going' : 'the ' + n + ' people who are interested show as going') : 'anyone who joins sees it’s happening') + '.</p>' +
          '<button type="button" ' + on(() => { if (!state.busy) makePlan(s); }) + ' style="margin-top:8px;min-height:50px;border:0;border-radius:999px;background:#0f7a3c;color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 10px 24px rgba(15,122,60,.25)">Make it a plan</button>' +
        '</div>'
      : '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:6px">' +
          '<div style="' + EYEBROW + '">Make it a plan</div>' +
          '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">Set a date and a time first. Then you can lock it in.</p>' +
          '<button type="button" aria-disabled="true" style="margin-top:8px;min-height:50px;border:0;border-radius:999px;background:#b9bcc4;color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:not-allowed">Make it a plan</button>' +
        '</div>';
  };

  const organizerCard = (s) => {
    const on_ = s.organizers.indexOf(state.me) > -1;
    return '<div style="' + CARD + ';padding:16px;display:flex;align-items:center;gap:12px">' +
      '<span aria-hidden="true" style="flex:0 0 auto;font-size:22px;line-height:1">🙋</span>' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><strong style="font-size:15px;line-height:1.3;font-weight:800;color:#0d1117">Offer to help organize</strong>' +
        '<span style="font-size:12.5px;line-height:1.4;font-weight:600;color:#6b7280">' + esc(nameOf(s.leadId, s.leadName)) + ' has the final say. You help get it over the line.</span></div>' +
      '<span ' + on(() => { if (!state.busy) toggleOrganizer(s); }) + ' aria-pressed="' + on_ + '" style="flex:0 0 auto;display:flex;align-items:center;min-height:40px;padding:0 15px;border-radius:999px;font-size:14px;font-weight:800;cursor:pointer;' + (on_ ? 'background:#f3f1fe;color:#5b4ae8' : 'box-shadow:inset 0 0 0 1.5px #dcdfe6;color:#0d1117') + '">' + (on_ ? '✓ Helping' : 'I’ll help') + '</span>' +
    '</div>';
  };

  // A photo header shared by the plan and "happened" pages
  const phaseHeader = (s, height, scrim, inner, share) => {
    const g = groupById(s.groupId), cover = s.photoPaths[0] ? photoUrl(s.photoPaths[0]) : null;
    return '<div style="position:relative;height:calc(' + height + 'px + var(--pt));overflow:hidden;background:#0b2a17">' +
      (cover ? photoLayer(cover, s.coverPos, IDEA_POS) : '<div aria-hidden="true" style="position:absolute;inset:0;background:' + groupBg(g, '#0b2a17') + '"></div>') +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:' + scrim + '"></div>' +
      '<div style="position:absolute;top:calc(12px + var(--pt));left:12px;right:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;z-index:1">' +
        backBtn(s) +
        '<span style="flex:1"></span>' +
        (isLead(s)   // v6 Update 6: the old Edit button is gone; the host changes the photo here
          ? '<label style="' + EDIT_PILL + '">' + svg(15, stroke('#0d1117', 2.2), CAMERA) + 'Change photo' + coverInput(s) + '</label>'
          : share ? '' : '<span style="flex:0 0 40px;width:40px"></span>') +
        (share ? '<span ' + on(() => setState({ invite: { id: s.id } })) + ' aria-label="Share" style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 2px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;cursor:pointer">' + svg(18, stroke('#0d1117', 2.4), P5.share) + '</span>' : '') +
      '</div>' + inner +
      (state.tag ? '<div style="position:absolute;right:16px;bottom:44px;z-index:2;transform:rotate(5deg);background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:800;color:#0d1117;box-shadow:0 8px 20px rgba(15,18,25,.18);animation:popIn 320ms cubic-bezier(.22,.9,.28,1) both">' + esc(state.tag) + '</div>' : '') +
    '</div>';
  };

  // Sign-ups (plans) and roles (ideas): the lead adds items, anyone signs up
  function signupsCard(s) {
    const st = state, lead = isLead(s);
    const needOpen = s.signups.filter(i => i.need).reduce((a, i) => a + Math.max(0, i.need - i.claims.length), 0);
    const sigReady = st.sigDraft.trim().length > 0;
    return '<div id="sec-tasks" data-screen-label="Sign-ups" style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:4px">' +
          eyebrowRow('Sign-ups', '<span style="font-size:13px;font-weight:800;color:#6b7280">' + (needOpen ? needOpen + ' spots open' : s.signups.length ? 'All covered' : '') + '</span>') +
          (s.signups.length ? '' : '<p style="margin:8px 0 4px;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">' + (lead ? (s.planned ? 'Need people to bring things? Add what you need and neighbors can grab a spot.' : 'What roles does this need? Add them now and people can grab one before there’s a date.') : 'Nothing on the list yet. Bringing something? Add it below.') + '</p>') +
          s.signups.map((it, i) => {
            const mine = it.claims.find(c => c.userId === st.me), cnt = it.claims.length, full = !!it.need && cnt >= it.need && !mine;
            const countLine = it.need ? (cnt >= it.need ? (it.need === 1 ? 'Covered' : cnt + ' of ' + it.need + ' · all set') : (it.need === 1 ? 'Still needed' : cnt + ' of ' + it.need + ' · ' + (it.need - cnt) + ' still needed')) : (cnt ? cnt + ' signed up' : 'Nobody yet');
            return '<div data-signup="' + esc(it.item) + '" style="display:flex;flex-direction:column;gap:9px;padding:12px 0;border-top:' + (i ? '1px solid #f2f3f6' : '0') + '">' +
              '<div style="display:flex;align-items:center;gap:10px">' +
                '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#0d1117;text-wrap:pretty">' + esc(it.item) + (it.time ? ' <span style="display:inline-block;vertical-align:1px;margin-left:4px;padding:1px 8px;border-radius:999px;background:#fdf1d6;font-size:12px;font-weight:800;color:#8f6405">' + fmtTime(it.time) + '</span>' : '') + '</div><div style="margin-top:1px;font-size:13px;font-weight:600;color:#6b7280">' + countLine + '</div></div>' +
                (lead || it.createdBy === st.me ? '<span ' + on(() => removeSignup(s, it)) + ' aria-label="Remove ' + esc(it.item) + '" style="flex:0 0 28px;width:28px;height:28px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(11, '#5c6270', 2.6) + '</span>' : '') +
                '<span ' + on(() => { if (!full && !st.busy) toggleClaim(s, it); }) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:38px;padding:0 14px;border-radius:999px;font-size:13.5px;font-weight:800;white-space:nowrap;cursor:' + (full ? 'default' : 'pointer') + ';background:' + (mine ? '#e7f6ec' : full ? '#f2f3f6' : '#0d1117') + ';color:' + (mine ? '#0f7a3c' : full ? '#9aa0ac' : '#fff') + '">' + (mine ? '✓ You’re on it' : full ? 'All set' : 'Sign up') + '</span>' +
              '</div>' +
              (it.need && it.need > 1 ? '<div style="height:6px;border-radius:999px;background:#f2f3f6;overflow:hidden"><div style="width:' + Math.min(100, cnt / it.need * 100) + '%;height:100%;border-radius:999px;background:' + (cnt >= it.need ? '#149a4b' : '#e8a71c') + '"></div></div>' : '') +
              (cnt ? '<div style="display:flex;flex-wrap:wrap;gap:6px">' + it.claims.map(c => '<span style="display:flex;align-items:center;gap:6px;border-radius:999px;background:#f2f3f6;padding:3px 10px 3px 3px;font-size:13px;font-weight:700;color:#2b303a">' + face(c.userId, nameOf(c.userId), 24) + esc(nameOf(c.userId) + (c.note ? ' · ' + c.note : '')) + '</span>').join('') + '</div>' : '') +
              (mine ? '<input class="fld" type="text" maxlength="60" aria-label="Note for ' + esc(it.item) + '" placeholder="Add a note, if you want" value="' + esc(mine.note) + '" ' + onInput(e => { if (e.type === 'change') saveClaimNote(it, e.target.value.trim()); }) + ' style="width:100%;min-height:40px;border:1.5px solid #dcdfe6;border-radius:14px;padding:10px 14px;font-family:inherit;font-size:14px;font-weight:600;color:#0d1117;background:#fff;outline:none">' : '') +
            '</div>';
          }).join('') +
          '<div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid #f2f3f6">' +
            '<input class="fld" type="text" maxlength="60" aria-label="' + (lead ? 'Add a sign-up' : 'Bringing something else?') + '" placeholder="' + (lead ? 'Add a thing, e.g. A dozen filled eggs' : 'Bringing something else?') + '" value="' + esc(st.sigDraft) + '" ' + onInput(e => { if (e.type === 'input') setState({ sigDraft: e.target.value.slice(0, 60) }); }) + ' style="flex:1 1 auto;min-width:0;min-height:46px;border:1.5px solid #dcdfe6;border-radius:14px;padding:10px 14px;font-family:inherit;font-size:15px;font-weight:600;color:#0d1117;background:#fff;outline:none">' +
            (lead ? '<input class="fld" type="text" inputmode="numeric" maxlength="3" aria-label="How many needed" placeholder="How many" value="' + esc(st.sigNeed) + '" ' + onInput(e => { if (e.type === 'input') setState({ sigNeed: e.target.value.replace(/\D/g, '').slice(0, 3) }); }) + ' style="flex:0 0 74px;width:74px;min-height:46px;border:1.5px solid #dcdfe6;border-radius:14px;padding:10px 8px;text-align:center;font-family:inherit;font-size:13.5px;font-weight:600;color:#0d1117;background:#fff;outline:none">' : '') +
            '<button type="button" ' + on(() => addSignup(s)) + ' aria-disabled="' + !sigReady + '" style="flex:0 0 auto;min-height:46px;padding:0 16px;border:0;border-radius:999px;font-family:inherit;font-size:15px;font-weight:800;cursor:' + (sigReady ? 'pointer' : 'default') + ';background:' + (sigReady ? '#5b4ae8' : '#e2e4e9') + ';color:' + (sigReady ? '#fff' : '#9aa0ac') + '">Add</button>' +
          '</div>' +
          (lead && st.sigDraft
            ? '<label style="display:flex;align-items:center;gap:8px;padding-top:8px;font-size:13px;font-weight:700;color:#6b7280">Time (optional)' +
                '<select class="fld" aria-label="Sign-up time" ' + onInput(e => setState({ sigTime: e.target.value })) + ' style="min-height:38px;padding:0 10px;border:1.5px solid #dcdfe6;border-radius:12px;font-family:inherit;font-size:13.5px;font-weight:700;color:#0d1117;background:#fff;outline:none;color-scheme:light">' +
                  '<option value="">No time</option>' + TIME_OPTS.map(([v, l]) => '<option value="' + v + '"' + (v === st.sigTime ? ' selected' : '') + '>' + l + '</option>').join('') +
                '</select></label>'
            : '') +
        '</div>';
  }

  // v6 Update 5 (Plan phase): a section title sits on the gray page above its white card
  const secTitle = (t, right, big) => '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 4px;margin-bottom:8px">' +
    '<h2 style="margin:0;font-size:' + (big ? '24px;line-height:1.1;letter-spacing:-.6px' : '17px;line-height:1.2;letter-spacing:-.3px') + ';font-weight:900;color:#0d1117">' + t + '</h2>' + (right || '') + '</div>';
  const P5 = {
    calPlus: '<rect x="3.5" y="5" width="14" height="13.5" rx="2.5"/><path d="M3.5 9.5h14M7.5 3v3.5M13.5 3v3.5M19.5 15v6M16.5 18h6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    share: '<path d="M12 3.5v11M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>'
  };
  const mapUrl = (pt) => 'https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=360&height=150&scaleFactor=2&center=lonlat:' + pt[1] + ',' + pt[0] +
    '&zoom=15&marker=lonlat:' + pt[1] + ',' + pt[0] + ';type:awesome;color:%235b4ae8;size:large&apiKey=' + encodeURIComponent((CFG.places && CFG.places.key) || '');
  const directionsUrl = (s) => 'https://www.google.com/maps/dir/?api=1&destination=' + (s.spotPoint ? s.spotPoint[0] + ',' + s.spotPoint[1] : encodeURIComponent(s.spotAddress || s.spot));

  // Help out: one white card per job. Sign up is one tap (a shift job opens Pick a shift).
  function helpOut(s) {
    const st = state, lead = isLead(s), jobs = s.jobs || s.signups, sigReady = st.sigDraft.trim().length > 0;
    const card = (j) => {
      const shifts = !!j.shifts, mine = shifts ? myShiftIds(j).length > 0 : j.claims.some(c => c.userId === st.me);
      const cnt = j.claims.length, need = j.need, full = !mine && !!need && (shifts ? j.shifts.every(u => u.need && u.claims.length >= u.need) : cnt >= need);
      // Round 64b: one gray line (time · n of need · k still needed, or "N in" with no limit), a segmented bar under the row
      const when = jobTime(j);
      const count = need ? Math.min(cnt, need) + ' of ' + need + (cnt < need ? ' · ' + (need - cnt) + ' still needed' : '') : cnt ? cnt + ' in' : '';
      const subline = [when, !lead && j.createdBy === st.me ? 'You added this' : '', count].filter(Boolean).join(' · ');
      const bar = need && need <= 12 ? '<div aria-hidden="true" style="display:flex;gap:4px">' + Array.from({ length: need }, (_, i) => '<span style="flex:1 1 0;height:4px;border-radius:999px;background:' + (i < cnt ? '#5b4ae8' : '#e3e5ea') + '"></span>').join('') + '</div>' : '';
      const act = () => { if (st.busy) return; if (shifts) openShifts(s, j); else toggleClaim(s, j); };
      const btn = mine
        ? '<span ' + on(act) + ' aria-label="You’re in. Tap to take yourself off" style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:4px;min-width:84px;min-height:36px;padding:0 14px;border-radius:999px;background:#fdf1d6;color:#8f6405;font-size:13.5px;font-weight:800;white-space:nowrap;cursor:pointer">' + svg(12, stroke('#8f6405', 3.2), P6.check) + 'You’re in</span>'
        : full ? '<span aria-disabled="true" style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;min-width:84px;min-height:36px;padding:0 14px;border-radius:999px;box-shadow:inset 0 0 0 1.5px #d5d8df;color:#9aa0ac;font-size:13.5px;font-weight:800">Full</span>'
        : '<span ' + on(act) + ' style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;min-width:84px;min-height:36px;padding:0 14px;border-radius:999px;box-shadow:inset 0 0 0 1.5px #5b4ae8;color:#5b4ae8;font-size:13.5px;font-weight:800;white-space:nowrap;cursor:pointer">Sign up</span>';
      const long = j.desc.length > 90, open = !!st.descOpen[j.id];
      const more = (label, up) => '<span ' + on(() => setState({ descOpen: Object.assign({}, st.descOpen, { [j.id]: !open }) })) + ' aria-expanded="' + open + '" style="flex:0 0 auto;display:inline-flex;align-items:center;gap:2px;font-size:13px;font-weight:800;color:#5b4ae8;cursor:pointer;white-space:nowrap">' + label + '<span style="display:flex;transform:' + (up ? 'rotate(180deg)' : 'none') + '">' + I.chevD(12, '#5b4ae8', 3) + '</span></span>';
      const desc = !j.desc ? '' : !long ? '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">' + esc(j.desc) + '</p>'
        : open ? '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">' + esc(j.desc) + ' ' + more('Less', true) + '</p>'
        : '<div style="display:flex;align-items:flex-end;gap:8px"><p style="flex:1;min-width:0;margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(j.desc) + '</p>' + more('More', false) + '</div>';
      return '<div data-signup="' + esc(j.item) + '" style="' + CARD + ';padding:14px 16px;display:flex;flex-direction:column;gap:10px">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div style="flex:1;min-width:0"><div style="font-size:16px;line-height:1.3;font-weight:800;color:#0d1117;text-wrap:pretty">' + esc(j.item) + '</div>' +
            (subline ? '<div style="margin-top:2px;font-size:13px;font-weight:700;color:#6b7280">' + esc(subline) + '</div>' : '') + '</div>' +
          (lead || (j.createdBy === st.me && !shifts) ? '<span ' + on(() => removeSignup(s, j)) + ' aria-label="Remove ' + esc(j.item) + '" style="flex:0 0 28px;width:28px;height:28px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(11, '#6b7280', 2.6) + '</span>' : '') +
          btn + '</div>' + bar + desc + '</div>';
    };
    const addLabel = lead ? 'Add a job or item' : 'Add something else';
    const adder = !st.sigAdding
      ? '<div ' + on(() => setState({ sigAdding: true })) + ' data-add-signup style="display:flex;align-items:center;gap:8px;min-height:52px;padding:0 16px;border-radius:18px;border:1.5px dashed #e3c979;background:#fef7dd;font-size:14px;font-weight:800;color:#8f6405;cursor:pointer">' + I.plus(16, '#8f6405', 2.6) + addLabel + '</div>'
      : '<div style="' + CARD + ';padding:14px 16px;display:flex;flex-direction:column;gap:10px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:15px;font-weight:800;color:#0d1117">' + addLabel + '</span>' +
            '<span ' + on(() => setState({ sigAdding: false, sigDraft: '', sigNeed: '', sigTime: '' })) + ' aria-label="Cancel" style="width:28px;height:28px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(11, '#5c6270', 2.6) + '</span></div>' +
          '<div style="display:flex;gap:8px">' +
            '<input class="fld" type="text" maxlength="60" data-autofocus aria-label="' + (lead ? 'Add a sign-up' : 'Bringing something else?') + '" placeholder="' + (lead ? 'Add a thing, e.g. A dozen filled eggs' : 'Bringing something else?') + '" value="' + esc(st.sigDraft) + '" ' + onInput(e => { if (e.type === 'input') setState({ sigDraft: e.target.value.slice(0, 60) }); }) + ' style="flex:1 1 auto;min-width:0;min-height:46px;border:1.5px solid #dcdfe6;border-radius:14px;padding:10px 14px;font-family:inherit;font-size:15px;font-weight:600;color:#0d1117;background:#fff;outline:none">' +
            (lead ? '<input class="fld" type="text" inputmode="numeric" maxlength="3" aria-label="How many needed" placeholder="How many" value="' + esc(st.sigNeed) + '" ' + onInput(e => { if (e.type === 'input') setState({ sigNeed: e.target.value.replace(/\D/g, '').slice(0, 3) }); }) + ' style="flex:0 0 74px;width:74px;min-height:46px;border:1.5px solid #dcdfe6;border-radius:14px;padding:10px 8px;text-align:center;font-family:inherit;font-size:13.5px;font-weight:600;color:#0d1117;background:#fff;outline:none">' : '') +
            '<button type="button" ' + on(() => addSignup(s)) + ' aria-disabled="' + !sigReady + '" style="flex:0 0 auto;min-height:46px;padding:0 16px;border:0;border-radius:999px;font-family:inherit;font-size:15px;font-weight:800;cursor:' + (sigReady ? 'pointer' : 'default') + ';background:' + (sigReady ? '#5b4ae8' : '#e2e4e9') + ';color:' + (sigReady ? '#fff' : '#9aa0ac') + '">Add</button>' +
          '</div>' +
          (lead && st.sigDraft
            ? '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#6b7280">Time (optional)' +
                '<select class="fld" aria-label="Sign-up time" ' + onInput(e => setState({ sigTime: e.target.value })) + ' style="min-height:38px;padding:0 10px;border:1.5px solid #dcdfe6;border-radius:12px;font-family:inherit;font-size:13.5px;font-weight:700;color:#0d1117;background:#fff;outline:none;color-scheme:light">' +
                  '<option value="">No time</option>' + TIME_OPTS.map(([v, l]) => '<option value="' + v + '"' + (v === st.sigTime ? ' selected' : '') + '>' + l + '</option>').join('') +
                '</select></label>'
            : '') +
        '</div>';
    const editBtn = lead ? '<span ' + on(() => openNeeds(s)) + ' aria-label="Edit what you need" style="flex:0 0 auto;display:flex;align-items:center;gap:5px;min-height:36px;padding:0 2px;color:#6b7280;font-size:14px;font-weight:700;cursor:pointer">' + svg(13, stroke('currentColor', 2.4), PENCIL) + 'Edit</span>' : '';
    return '<section id="sec-tasks" data-screen-label="Help out">' + secTitle('Help out', editBtn, true) +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        (jobs.length ? jobs.map(card).join('') : '<div ' + (lead ? on(() => openNeeds(s)) + ' ' : '') + 'style="' + CARD + ';padding:16px;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270' + (lead ? ';cursor:pointer' : '') + '">' + (lead ? 'Need people to bring things? Add what you need and neighbors can grab a spot.' : 'Nothing on the list yet. Bringing something? Add it below.') + '</div>') +
        (lead ? '' : adder) + '</div></section>';
  }

  // ---- v6 Update 6: the host edits one section at a time in a small sheet (the full-screen editor is retired)
  const openSec = (s, kind) => {
    const bits = basicsOf(s).slice(0, 3).map(b => b.slice(0, 40));
    while (bits.length < 3) bits.push('');
    setState({ sec: { id: s.id, kind, title: s.text, photo: null, d: s.dayDate || '', t: s.dayTime || '', e: s.dayEnd || '', bits, priv: s.visibility === 'invite', groups: gIds(s).slice() },
      offerText: kind === 'when' ? s.spot || '' : '', offerPlace: s.spot && s.spotPoint ? { name: s.spot, address: s.spotAddress, lat: s.spotPoint[0], lon: s.spotPoint[1] } : null, offerSuggest: [], timeOpen: null, menu: null });
  };
  // Round 65a: what an edit tells people. A new date, time or place always goes out; a new title or
  // Basic details only when the host turns on Tell everyone going; Who can see it tells no one.
  const secMessage = (s, ss) => {
    if (ss.kind === 'title') { const t = cleanTitle(ss.title).slice(0, 40); return t && t !== s.text ? 'Renamed: ' + s.text + ' → ' + t : ''; }
    if (ss.kind === 'details') {
      const was = s.hopes || [], hopes = ss.bits.map(b => b.trim().slice(0, 40)).filter(Boolean);
      if (hopes.join('\n') === was.join('\n')) return '';
      const line = hopes.find(h => was.indexOf(h) < 0) || hopes[0];
      return line ? 'Details updated: ' + line : '';
    }
    if (ss.kind !== 'when') return '';
    const lines = [], d = ss.d || null, t = d && ss.t ? ss.t : null, e = t && ss.e && ss.e > t ? ss.e : null;
    if (d && d !== s.dayDate) lines.push('New date: ' + dayLabel(d, t, e));
    else if (d && (t !== s.dayTime || e !== s.dayEnd)) lines.push('New time: ' + dayLabel(d, t, e) + (s.dayTime ? ' (was ' + (s.dayEnd ? spanTime({ time: s.dayTime, endTime: s.dayEnd }) : fmtTime(s.dayTime)) + ')' : ''));
    const p = cleanTitle(state.offerText).slice(0, 80);
    if (p && p !== (s.spot || '')) lines.push('New location: ' + p);
    return lines.join(' · ');
  };
  // Who an update reaches (audience "all"): everyone who replied or signed up, but you
  const updateReach = (s) => {
    const ids = new Set();
    s.rsvps.forEach(r => ids.add(r.userId)); s.signups.forEach(it => it.claims.forEach(c => ids.add(c.userId)));
    ids.delete(state.me);
    const g = s.rsvps.filter(r => r.status === 'going' && r.userId !== state.me).length, m = s.rsvps.filter(r => r.status === 'maybe' && r.userId !== state.me).length;
    const text = !ids.size ? '' : ids.size === g + m
      ? 'Goes to ' + [g ? (g === 1 ? 'the 1 person going' : 'the ' + g + ' people going') : '', m ? (m === 1 ? 'the 1 maybe' : 'the ' + m + ' maybes') : ''].filter(Boolean).join(' and ') + '.'
      : 'Goes to the ' + ids.size + (ids.size === 1 ? ' person who replied or signed up.' : ' people who replied or signed up.');
    return { n: ids.size, text };
  };
  const secSends = (s, ss) => isLead(s) && s.planned && !!secMessage(s, ss) && updateReach(s).n > 0 && (ss.kind === 'when' || !!ss.tell);
  const sendUpdate = async (s, body) => must(await sb.from('plan_updates').insert({ spark_id: s.id, body: body.slice(0, 320), audience: 'all' }));

  const saveSec = (s) => {
    const ss = state.sec, lead = isLead(s), msg = secMessage(s, ss), send = secSends(s, ss);
    if (!ss || state.busy) return;
    let note = 'Saved';
    if (ss.kind === 'title') {
      const text = cleanTitle(ss.title).slice(0, 40);
      if (!text) return;
      let path = null, old = null;
      run(async () => {
        if (lead) { if (text !== s.text) must(await sb.from('sparks').update({ text }).eq('id', s.id)); }
        else must(await sb.rpc('admin_edit_spark', { p_spark: s.id, p_text: text, p_hopes: s.hopes }));
        if (ss.photo && lead) {
          path = await uploadBlob(ss.photo.blob);
          try { old = must(await sb.rpc('set_idea_cover', { p_spark: s.id, p_photo: path, p_pos: null })).data; } catch (e) { deletePhotos([path]); throw e; }
        }
        if (send) await sendUpdate(s, msg);
      }, { sec: null }).then(ok => { if (!ok) return; if (old) deletePhotos([old]); toast(send ? 'Saved. Everyone going gets an update.' : note, true); });
      return;
    }
    if (ss.kind === 'details') {
      const hopes = ss.bits.map(b => b.trim().slice(0, 40)).filter(Boolean);
      run(async () => {
        if (lead) must(await sb.from('sparks').update({ hopes, vision: null }).eq('id', s.id));
        else must(await sb.rpc('admin_edit_spark', { p_spark: s.id, p_text: s.text, p_hopes: hopes }));
        if (send) await sendUpdate(s, msg);
      }, { sec: null }).then(ok => { if (ok) toast(send ? 'Saved. Everyone going gets an update.' : note, true); });
      return;
    }
    if (ss.kind === 'vis') {
      // Add new groups first, then move the home (set_home_group needs it posted there), then take groups off
      const old = s.groupId, home = ss.home || old, had = gIds(s).slice(1), priv = ss.priv ? 'invite' : 'group';
      const add = ss.groups.filter(id => id !== old && had.indexOf(id) < 0);
      const extras = had.concat(add).filter(id => id !== home).concat(home !== old ? [old] : []);
      const drop = extras.filter(id => ss.groups.indexOf(id) < 0);
      run(async () => {
        if (priv !== s.visibility) must(await sb.from('sparks').update({ visibility: priv }).eq('id', s.id));
        if (add.length) must(await sb.from('spark_groups').insert(add.map(g => ({ spark_id: s.id, group_id: g }))));
        if (home !== old) must(await sb.rpc('set_home_group', { p_spark: s.id, p_group: home }));
        if (drop.length) must(await sb.from('spark_groups').delete().eq('spark_id', s.id).in('group_id', drop));
      }, { sec: null }).then(ok => { if (ok) toast(note, true); });
      return;
    }
    // Date, time & location: a date or place set here closes its poll. Everyone in it gets an update.
    const patch = {}, d = ss.d || null, t = d && ss.t ? ss.t : null, e = t && ss.e && ss.e > t ? ss.e : null;
    if (d !== s.dayDate || t !== s.dayTime || e !== s.dayEnd) Object.assign(patch, { day_date: d, day_time: t, day_end: e });
    const p = cleanTitle(state.offerText).slice(0, 80), pl = state.offerPlace && state.offerPlace.name === p ? state.offerPlace : null;
    if (p !== (s.spot || '')) {
      Object.assign(patch, { spot: p || null, spot_open: !p, spot_address: pl ? pl.address : null, spot_lat: pl ? pl.lat : null, spot_lon: pl ? pl.lon : null });
    }
    if (!Object.keys(patch).length) { setState({ sec: null }); return; }
    const tell = send;
    run(async () => {
      must(await sb.from('sparks').update(patch).eq('id', s.id));
      if (patch.day_date && s.dateOpts.length) must(await sb.from('date_options').delete().eq('spark_id', s.id));
      if (patch.spot && s.spotOpts.length) must(await sb.from('spot_options').delete().eq('spark_id', s.id));
      if (tell) await sendUpdate(s, msg);
    }, { sec: null, offerText: '', offerPlace: null, offerSuggest: [] }).then(ok => { if (ok) toast(tell ? 'Saved. Everyone going gets an update.' : note, true); });
  };
  // Change photo on the event's header: the new cover goes up straight away
  const changeCover = async (s, file) => {
    if (!file) return;
    let blob, path = null, old = null;
    try { blob = await shrinkImage(file); } catch (e) { toast(BAD_PHOTO); return; }
    const ok = await run(async () => {
      path = await uploadBlob(blob);
      try { old = must(await sb.rpc('set_idea_cover', { p_spark: s.id, p_photo: path, p_pos: null })).data; } catch (e) { deletePhotos([path]); throw e; }
    });
    if (!ok) return;
    if (old) deletePhotos([old]);
    toast('Photo saved', true);
  };
  const coverInput = (s) => '<input type="file" accept="image/*" aria-label="Change the cover photo" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; changeCover(s, f); }) + ' style="display:none">';
  // The host picks a poll's winner: it becomes the date (or place) and the poll closes
  const pickOpt = (s, kind, o) => run(async () => {
    if (kind === 'day') {
      must(await sb.from('sparks').update({ day_date: o.dayDate, day_time: o.dayTime, day_end: null }).eq('id', s.id));
      must(await sb.from('date_options').delete().eq('spark_id', s.id));
    } else {
      must(await sb.from('sparks').update({ spot: o.name, spot_open: false, spot_address: o.address || null, spot_lat: o.lat, spot_lon: o.lon }).eq('id', s.id));
      must(await sb.from('spot_options').delete().eq('spark_id', s.id));
    }
  }).then(ok => { if (ok) toast('Picked ' + (kind === 'day' ? dayLabel(o.dayDate, o.dayTime) : o.name), true); });

  // Edit what you need: every job editable in place (nothing opens on top)
  const openNeeds = (s) => setState({ needEd: { id: s.id, rows: (s.jobs || []).map(j => j.shifts
    ? { id: j.id, item: j.item, desc: j.desc, n: j.claims.length, shifts: j.shifts.map(u => ({ id: u.id, time: u.time || '', end: u.endTime || '', need: u.need || null })) }
    : { id: j.id, item: j.item, desc: j.desc, n: j.claims.length, time: j.time || '', end: j.endTime || '', need: j.need || null, shifts: null }) } });
  const saveNeeds = (s) => {
    const ed = state.needEd;
    if (!ed || state.busy) return;
    run(async () => {
      const orig = s.jobs || [], keep = ed.rows.filter(r => r.id).map(r => r.id), gone = orig.filter(j => keep.indexOf(j.id) < 0).map(j => j.id);
      for (const id of gone) must(await sb.rpc('remove_signup', { p_item: id }));   // tells the people signed up
      for (const r of ed.rows) {
        const item = cleanTitle(r.item).slice(0, 60), descr = (r.desc || '').trim().slice(0, 400) || null;
        if (!item) continue;
        if (!r.id) { await insertJob(s.id, r); continue; }
        const o = orig.find(j => j.id === r.id) || {}, shifts = (r.shifts || []).filter(q => q.time), oldShifts = (o.shifts || []).map(u => u.id);
        if (!shifts.length) {
          must(await sb.from('signup_items').update({ item, descr, time: r.time || null, end_time: r.time && r.end && r.end > r.time ? r.end : null, need: r.need || null }).eq('id', r.id));
          if (oldShifts.length) must(await sb.from('signup_items').delete().in('id', oldShifts));
          continue;
        }
        must(await sb.from('signup_items').update({ item, descr, time: null, end_time: null, need: null }).eq('id', r.id));
        const kept = shifts.filter(q => q.id).map(q => q.id), dropped = oldShifts.filter(id => kept.indexOf(id) < 0);
        if (dropped.length) must(await sb.from('signup_items').delete().in('id', dropped));
        for (const q of shifts) {
          const row = { item, time: q.time, end_time: q.end && q.end > q.time ? q.end : null, need: q.need || null };
          if (q.id) must(await sb.from('signup_items').update(row).eq('id', q.id));
          else must(await sb.from('signup_items').insert(Object.assign({ spark_id: s.id, shift_of: r.id }, row)));
        }
      }
    }, { needEd: null }).then(ok => { if (ok) toast('Saved', true); });
  };

  // The switch (title and Basic details) and the exact message people get (Round 65a)
  const secTell = (s, ss) => {
    if (!isLead(s) || !s.planned || ss.kind === 'vis') return '';
    const reach = updateReach(s), msg = secMessage(s, ss), quiet = ss.kind === 'title' || ss.kind === 'details', v = !!ss.tell;
    const sw = quiet && reach.n ? '<div ' + on(() => setState({ sec: Object.assign({}, state.sec, { tell: !v }) }), 'switch') + ' aria-checked="' + v + '" aria-label="Tell everyone going" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#f4f5f7;cursor:pointer">' +
      '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">Tell everyone going</div><div style="font-size:12.5px;font-weight:600;color:#6b7280">' + (v ? 'On: they get an update when you save' : 'Off: it saves quietly') + '</div></div>' +
      '<span aria-hidden="true" style="flex:0 0 46px;width:46px;height:28px;border-radius:999px;position:relative;transition:background 160ms;background:' + (v ? '#149a4b' : '#dcdfe6') + '"><span style="position:absolute;top:3px;left:' + (v ? 21 : 3) + 'px;width:22px;height:22px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left 160ms"></span></span></div>' : '';
    const preview = secSends(s, ss) ? '<div data-update-preview style="display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:16px;background:#f7f6ff;box-shadow:inset 0 0 0 1.5px #dcd6fb">' +
      '<span style="font-size:11px;font-weight:900;letter-spacing:1px;color:#4a3ad4">WHAT THEY GET</span>' +
      '<span style="font-size:14.5px;line-height:1.4;font-weight:700;color:#2a1f8f">' + esc(msg) + '</span>' +
      '<span style="font-size:13px;line-height:1.4;font-weight:600;color:#6b7280">' + esc(reach.text) + '</span></div>' : '';
    return sw + preview;
  };

  function viewSecSheet() {
    const ss = state.sec, s = state.sparks.find(x => x.id === ss.id);
    if (!s) return '';
    const close = () => setState({ sec: null, offerText: '', offerPlace: null, offerSuggest: [], timeOpen: null });
    const set = (patch) => setState({ sec: Object.assign({}, state.sec, patch) });
    const label = (t) => '<span style="font-size:12px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#6b7280">' + t + '</span>';
    const title = { title: 'Title & photo', when: 'Date, time & location', details: 'Basic details', vis: 'Who can see it' }[ss.kind];
    let body = '', ok = true;
    if (ss.kind === 'title') {
      const cur = ss.photo ? ss.photo.url : s.photoPaths[0] ? photoUrl(s.photoPaths[0]) : null;
      ok = !!cleanTitle(ss.title);
      body = '<div style="display:flex;flex-direction:column;gap:8px">' + label('Event title') +
        '<input class="fld big-fld" type="text" maxlength="40" aria-label="Event title" placeholder="Name your event" value="' + esc(ss.title) + '" ' + onInput(e => { if (e.type === 'input') set({ title: e.target.value.slice(0, 40) }); }) + ' style="' + BIG + '"></div>' +
        (isLead(s) ? '<div style="display:flex;align-items:center;gap:12px;padding:8px 14px 8px 8px;border-radius:16px;background:#f4f5f7"><span aria-hidden="true" style="flex:0 0 56px;width:56px;height:42px;border-radius:10px;background:' + (cur ? bg(cur) : EV_GRAD) + '"></span>' +
          '<span style="flex:1;font-size:15px;font-weight:800;color:#0d1117">Cover photo</span><label style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">' + svg(16, stroke('currentColor', 2.2), CAMERA) + (cur ? 'Change' : 'Add') +
          '<input type="file" accept="image/*" aria-label="Cover photo" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; if (!f) return; shrinkImage(f).then(blob => { if (state.sec && state.sec.photo) URL.revokeObjectURL(state.sec.photo.url); set({ photo: { blob, url: URL.createObjectURL(blob) } }); }, () => toast(BAD_PHOTO)); }) + ' style="display:none"></label></div>' : '');
    } else if (ss.kind === 'when') {
      body = '<div style="display:flex;flex-direction:column;gap:8px">' + label('Date &amp; time') +
        '<div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:8px">' + dateField(ss.d, 'Date', 'Pick a date', (v) => set({ d: v })) +
          timeField('secT', ss.t, EV_TIMES, 'Time', (v) => setState({ sec: Object.assign({}, state.sec, { t: v, e: ss.e && ss.e <= v ? '' : ss.e }), timeOpen: null })) + '</div>' +
        (ss.t ? timeField('secE', ss.e, EV_TIMES.filter(v => v > ss.t), 'End time (optional)', (v) => setState({ sec: Object.assign({}, state.sec, { e: v }), timeOpen: null })) : '') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' + label('Location') + placeField('offer', { placeholder: 'Search a place or address', style: BIG }) + '</div>';
    } else if (ss.kind === 'details') {
      body = '<div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:14px;line-height:1.4;font-weight:500;color:#5c6270">Up to three quick notes on what to expect or the vibe.</span>' +
        bitRows(ss.bits, (k, v) => { const b = state.sec.bits.slice(); b[k] = v; set({ bits: b }); }) + '</div>';
    } else {
      const tile = (priv, name, sub) => { const onIt = ss.priv === priv;
        return '<div ' + on(() => set({ priv }), 'radio') + ' aria-checked="' + onIt + '" style="flex:1 1 0;display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:14px;cursor:pointer;' + (onIt ? 'background:#f3f1fe;box-shadow:inset 0 0 0 2px #5b4ae8' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6') + '">' +
          '<span style="font-size:15px;font-weight:900;color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + name + '</span><span style="font-size:12.5px;line-height:1.35;font-weight:600;color:#6b7280">' + sub + '</span></div>'; };
      const mine = groupsInOrder();
      body = '<div style="display:flex;gap:8px">' + tile(false, 'Public', 'Everyone in your groups') + tile(true, 'Private', 'Only people you invite') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px">' + label('Post to') +
          // Round 65c: the home group stays ticked; another ticked group can be made home, then the old one unticked
          mine.map(g => {
            const home = ss.home || s.groupId, onIt = ss.groups.indexOf(g.id) > -1;
            if (g.id === home) return groupCheck(g, true, () => toast(home === s.groupId ? 'It stays posted in ' + g.name + ', where it started' : g.name + ' is its home now'), '',
              '<span style="font-size:12.5px;font-weight:700;color:' + (home === s.groupId ? '#8a909b' : '#4a3ad4') + '">' + (home === s.groupId ? 'Posted here first' : 'Home') + '</span>');
            return groupCheck(g, onIt, () => set({ groups: onIt ? ss.groups.filter(x => x !== g.id) : ss.groups.concat(g.id) }), '',
              onIt && isLead(s) ? '<span ' + on((e) => { stop(e); set({ home: g.id }); }) + ' style="display:flex;align-items:center;min-height:32px;font-size:13px;font-weight:800;color:#5b4ae8;cursor:pointer">Make home</span>' : '');
          }).join('') +
          (ss.groups.length > 1 ? '<span style="padding-top:4px;font-size:13px;line-height:1.4;font-weight:600;color:#6b7280">' +
            ((ss.home || s.groupId) !== s.groupId && ss.groups.indexOf(s.groupId) > -1 ? esc((groupById(s.groupId) || {}).name || 'The first group') + ' can now be unticked.' : 'The home group’s admins can edit or delete it.') + '</span>' : '') + '</div>';
    }
    return sheet(title, close, SHEET_PAD,
      '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.4px;color:#0d1117">' + esc(title) + '</div>' + closeX(close, 'flex:0 0 36px;width:36px;height:36px') + '</div>' +
      body + secTell(s, ss) +
      saveBtn(ok && !state.busy, () => saveSec(s), state.busy === 'save' ? 'Saving…' : secSends(s, ss) ? 'Save and send' : 'Save'), 36);
  }

  function viewNeedsSheet() {
    const ed = state.needEd, s = state.sparks.find(x => x.id === ed.id);
    if (!s) return '';
    const close = () => setState({ needEd: null });
    const setRow = (k, patch) => setState({ needEd: Object.assign({}, state.needEd, { rows: state.needEd.rows.map((r, j) => j === k ? Object.assign({}, r, patch) : r) }) });
    return '<div class="sheet-scrim" data-scrim="' + reg(close) + '" style="z-index:36">' +
      '<div role="dialog" aria-modal="true" aria-label="Edit what you need" data-screen-label="Edit what you need" class="sheet" style="height:calc(100% - 56px);display:flex;flex-direction:column">' +
        '<div style="padding:10px 18px 12px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid #f2f3f6"><span aria-hidden="true" style="align-self:center;width:38px;height:5px;border-radius:999px;background:#dcdfe6"></span>' +
          '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0;font-size:22px;font-weight:900;letter-spacing:-.4px;color:#0d1117">Edit what you need</div>' + closeX(close, 'flex:0 0 36px;width:36px;height:36px') + '</div></div>' +
        '<div style="flex:1 1 auto;min-height:0;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:14px">' +
          ed.rows.map((r, k) => '<div data-need-row style="background:#f4f5f7;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:10px">' +
            '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:11.5px;font-weight:900;letter-spacing:1.2px;color:#6b7280">JOB ' + (k + 1) + (r.shifts ? ' · SHIFTS' : '') + '</span>' +
              (r.n ? '<span style="font-size:12.5px;font-weight:800;color:#0f7a3c">' + r.n + ' signed up</span>' : '') + '<span style="flex:1"></span>' +
              '<span ' + on(() => setState({ needEd: Object.assign({}, ed, { rows: ed.rows.filter((_, j) => j !== k) }) })) + ' aria-label="Remove job ' + (k + 1) + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer">' + svg(16, stroke('#9b1c31', 2.2), TRASH_IC) + '</span></div>' +
            jobFields(r, (patch) => setRow(k, patch), k) + '</div>').join('') +
          '<div ' + on(() => setState({ needEd: Object.assign({}, ed, { rows: ed.rows.concat([blankJob('')]) }) })) + ' style="display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;border-radius:18px;border:1.5px dashed #c9ccd3;font-size:14.5px;font-weight:800;color:#454b55;cursor:pointer">' + I.plus(16, 'currentColor', 2.6) + 'Add a job or item</div>' +
        '</div>' +
        '<div style="padding:12px 18px calc(24px + env(safe-area-inset-bottom, 0px));border-top:1px solid #f2f3f6;display:flex;gap:10px">' +
          '<button type="button" ' + on(close) + ' style="flex:0 0 auto;min-height:52px;padding:0 22px;background:#fff;border:1.5px solid #dcdfe6;border-radius:999px;font-family:inherit;font-size:15.5px;font-weight:800;color:#0d1117;cursor:pointer">Cancel</button>' +
          '<button type="button" ' + on(() => saveNeeds(s)) + ' style="flex:1 1 auto;min-height:52px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer">' + (state.busy === 'save' ? 'Saving…' : 'Save changes') + '</button>' +
        '</div></div></div>';
  }

  // Share link: copy it, or hand it to Messages, Mail, WhatsApp or the phone's share sheet
  function viewShareSheet() {
    const sh = state.share, s = state.sparks.find(x => x.id === sh.id);
    if (!s) return '';
    const close = () => setState({ share: null }), link = location.origin + '/i/' + s.id;
    const msg = s.text + (s.dayDate ? ' · ' + dayLabel(s.dayDate, s.dayTime, s.dayEnd) : '') + '. RSVP here: ' + link;
    const btn = (label, href, icon) => '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + label + '" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border-radius:16px;background:#f7f8fa;text-decoration:none">' +
      '<span style="width:46px;height:46px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.1);display:flex;align-items:center;justify-content:center">' + svg(22, stroke('#5b4ae8', 2.1), icon) + '</span></a>';
    const more = () => { if (navigator.share) navigator.share({ title: s.text, text: msg, url: link }).catch(() => {}); else copy(msg, 'Invite copied. Paste it anywhere.'); };
    return sheet('Share link', close, SHEET_PAD,
      '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.4px;color:#0d1117">Share link</div>' +
        '<div style="margin-top:3px;font-size:13.5px;font-weight:600;color:#6b7280">' + esc([s.text, s.dayDate ? dayLabel(s.dayDate, s.dayTime, s.dayEnd) : ''].filter(Boolean).join(' · ')) + '</div></div>' + closeX(close, 'flex:0 0 36px;width:36px;height:36px') + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;border-radius:16px;background:#f2f3f6;padding:6px 6px 6px 14px"><span style="flex:1;min-width:0;font-size:14.5px;font-weight:700;color:#454b55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(link.replace(/^https?:\/\//, '')) + '</span>' +
        '<span ' + on(() => { copy(link, 'Link copied'); setState({ share: Object.assign({}, sh, { copied: true }) }); }) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:42px;padding:0 16px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:14px;font-weight:800;cursor:pointer">' + (sh.copied ? '✓ Copied' : 'Copy') + '</span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">' +
        btn('Text message', 'sms:?&body=' + encodeURIComponent(msg), '<path d="M4 5.5h16v10H9l-5 4v-14Z"/>') +
        btn('Email', 'mailto:?subject=' + encodeURIComponent(s.text) + '&body=' + encodeURIComponent(msg), '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>') +
        btn('WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(msg), '<path d="M4.5 19.5l1.2-3.6A7.5 7.5 0 1 1 8.4 18.5L4.5 19.5Z"/><path d="M9.5 9.5c.3 2 2 3.8 4 4.2"/>') +
        '<div ' + on(more) + ' aria-label="More" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border-radius:16px;background:#f7f8fa;cursor:pointer"><span style="width:46px;height:46px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.1);display:flex;align-items:center;justify-content:center">' +
          svg(22, stroke('#5b4ae8', 2.1), '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>') + '</span></div></div>' +
      '<span style="font-size:13px;line-height:1.4;font-weight:500;color:#6b7280">Anyone with the link can see the event and RSVP.</span>', 36);
  }

  // Date and location in one card: a value, "to be decided" (amber), or a poll (guests vote, the host picks)
  const whenWhereCard = (s) => {
    const lead = isLead(s), P = '#5b4ae8';
    const pollRows = (opts, kind) => opts.slice().sort((a, b) => b.votes.length - a.votes.length).map(o => {
      const mine = o.votes.indexOf(state.me) > -1, n = o.votes.length, label = kind === 'day' ? dayLabel(o.dayDate, o.dayTime) : o.name;
      const act = () => { if (state.busy) return; if (lead) pickOpt(s, kind, o); else vote(kind === 'day' ? 'date_votes' : 'spot_votes', s, o); };
      return '<div data-poll-opt="' + esc(label) + '" style="display:flex;align-items:center;gap:10px;min-height:46px;padding:0 6px 0 12px;border-radius:12px;background:#f4f5f7"><span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:#0d1117">' + esc(label) + '</span>' +
        '<span style="font-size:12.5px;font-weight:700;color:#6b7280;white-space:nowrap">' + n + (n === 1 ? ' vote' : ' votes') + '</span>' +
        '<span ' + on(act) + ' aria-pressed="' + (!lead && mine) + '" style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;min-width:70px;min-height:34px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;' +
          (lead ? 'background:' + P + ';color:#fff' : mine ? 'background:#e7f5ec;color:#0f7a3c' : 'background:#fff;color:' + P + ';box-shadow:inset 0 0 0 1.5px ' + P) + '">' + (lead ? 'Pick' : mine ? '✓ Voted' : 'Vote') + '</span></div>';
    }).join('');
    const tbd = (t) => '<div style="display:flex;align-items:center;gap:10px"><span style="flex:1;font-size:17px;line-height:1.25;font-weight:800;color:' + AMBER_INK + '">' + t + '</span>' +
      (lead ? '<span ' + on(() => openSec(s, 'when')) + ' style="font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">Add</span>' : '') + '</div>';
    const voting = (t, rows) => '<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:12px;font-weight:800;letter-spacing:1.1px;color:' + AMBER_INK + '">' + t + '</span>' + rows + '</div>';
    const whenTxt = s.dayDate ? new Date(s.dayDate + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '';
    const time = s.dayTime ? (s.dayEnd ? spanTime({ time: s.dayTime, endTime: s.dayEnd }) : fmtTime(s.dayTime)) : '';
    const dayPart = s.dayDate ? '<div style="font-size:17px;line-height:1.25;font-weight:900;letter-spacing:-.3px;color:#0d1117;text-wrap:pretty">' + esc(whenTxt) + (time ? ' · <span style="color:#0f7a3c">' + esc(time) + '</span>' : '') + '</div>'
      : s.dateOpts.length ? voting('VOTING ON A DATE', pollRows(s.dateOpts, 'day')) : tbd('Date to be decided');
    const spotPart = s.spot ? '<div style="font-size:17px;line-height:1.25;font-weight:900;letter-spacing:-.3px;color:#0d1117;text-wrap:pretty">' + esc(s.spot) + '</div>' +
        (s.spotAddress ? '<div style="margin-top:2px;font-size:14.5px;line-height:1.35;font-weight:500;color:#6b7280;text-wrap:pretty">' + esc(s.spotAddress) + '</div>' : '')
      : s.spotOpts.length ? voting('VOTING ON A SPOT', pollRows(s.spotOpts, 'spot')) : tbd('Location to be decided');
    const pill = 'flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;border-radius:999px;background:#f3f1fe;color:#5b4ae8;font-size:14.5px;font-weight:800;text-decoration:none;cursor:pointer';
    return '<div id="sec-when" data-when-card style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:14px">' +
      '<div style="display:flex;gap:12px">' + svg(20, stroke('#0f7a3c', 2.2) + ' style="flex:0 0 20px;margin-top:1px"', P6.cal) + '<div style="flex:1;min-width:0">' + dayPart + '</div>' +
        (lead ? '<span ' + on(() => openSec(s, 'when')) + ' aria-label="Edit date, time and location" style="flex:0 0 auto;align-self:flex-start;display:flex;align-items:center;gap:5px;padding-top:2px;color:#6b7280;font-size:14px;font-weight:700;cursor:pointer">' + svg(13, stroke('currentColor', 2.4), PENCIL) + 'Edit</span>' : '') + '</div>' +
      '<div style="display:flex;gap:12px">' + svg(20, stroke('#0f7a3c', 2.2) + ' style="flex:0 0 20px;margin-top:1px"', P6.pin) + '<div style="flex:1;min-width:0">' + spotPart + '</div></div>' +
      (s.dayDate || s.spot ? '<div style="display:flex;gap:8px">' +
        (s.dayDate ? '<span ' + on(() => addToCalendar(s)) + ' style="' + pill + '">' + svg(18, stroke('#5b4ae8', 2.2), '<path d="M20 12V8a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 8v9.5A2.5 2.5 0 0 0 6.5 20H12"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M18 15v6M15 18h6"/>') + 'Add to calendar</span>' : '') +
        (s.spot ? '<a href="' + esc(directionsUrl(s)) + '" target="_blank" rel="noopener noreferrer" style="' + pill + '">' + svg(18, stroke('#5b4ae8', 2.2), '<path d="M12 2.8 21.2 12 12 21.2 2.8 12Z"/><path d="M9 14.5V12a1.5 1.5 0 0 1 1.5-1.5H15"/><path d="m13 8.5 2 2-2 2"/>') + 'Directions</a>' : '') + '</div>' : '') +
    '</div>';
  };
  const basicDetailsSec = (s) => {
    const bits = basicsOf(s), edit = canEdit(s);
    if (!bits.length && !edit) return '';
    return '<section data-basics><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 4px;margin-bottom:8px"><h2 style="margin:0;font-size:24px;line-height:1.1;font-weight:900;letter-spacing:-.6px;color:#0d1117">Basic details</h2>' +
        (edit ? '<span ' + on(() => openSec(s, 'details')) + ' aria-label="Edit basic details" style="display:flex;align-items:center;gap:5px;min-height:36px;padding:0 2px;color:#6b7280;font-size:14px;font-weight:700;cursor:pointer">' + svg(13, stroke('currentColor', 2.4), PENCIL) + 'Edit</span>' : '') + '</div>' +
      (bits.length
        ? '<div style="' + CARD + ';padding:4px 16px">' + bits.map((t, k) => '<div style="display:flex;align-items:baseline;gap:10px;padding:10px 0;border-top:' + (k ? '1px solid #f2f3f6' : '0') + '"><span style="flex:0 0 6px;width:6px;height:6px;border-radius:999px;background:#0f7a3c;transform:translateY(-3px)"></span><span style="font-size:16px;line-height:1.4;font-weight:700;color:#0d1117;text-wrap:pretty">' + esc(t) + '</span></div>').join('') + '</div>'
        : '<div ' + on(() => openSec(s, 'details')) + ' style="padding:14px 16px;border-radius:18px;border:1.5px dashed #c9ccd3;font-size:14.5px;font-weight:700;color:#6b7280;cursor:pointer">Add up to three quick notes on what to expect.</div>') +
    '</section>';
  };
  const deleteLink = (s) => canEdit(s) ? '<span ' + on(() => askDelete(s)) + ' style="align-self:center;display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:0 12px;font-size:14.5px;font-weight:800;color:#9b1c31;cursor:pointer">' + I.trash(15, '#9b1c31') + (s.planned ? 'Delete this event' : 'Delete this idea') + '</span>' : '';

  function viewPlan(s) {
    const st = state, lead = isLead(s), edit = canEdit(s), leadName = nameOf(s.leadId, s.leadName), my = myRsvp(s), dp = dateParts(s.dayDate);
    const goingIds = going(s).map(r => r.userId), maybeN = s.rsvps.filter(r => r.status === 'maybe').length, noN = s.rsvps.filter(r => r.status === 'no').length;
    const stat = (num, label, bgc, ink) => '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 4px;border-radius:14px;background:' + bgc + ';color:' + ink + '"><span style="font-size:24px;line-height:1;font-weight:900;letter-spacing:-.5px">' + num + '</span><span style="font-size:11.5px;font-weight:800">' + label + '</span></div>';
    const sheetCard = (inner, extra) => '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px;' + (extra || '') + '">' + inner + '</div>';

    // Under the photo: the host's "Your tasks" (purple), or a helper's "You're helping" (gold). Collapsed by default.
    const myJobs = (s.jobs || s.signups).filter(j => j.shifts ? myShiftIds(j).length : j.claims.some(c => c.userId === st.me));
    const myTime = (j) => j.shifts ? j.shifts.filter(u => u.claims.some(c => c.userId === st.me)).map(spanTime).filter(Boolean).join(', ') : spanTime(j);
    const f = signupFill(s);
    const tasks = !lead ? myJobs.map(j => ({ item: j.item, meta: myTime(j) })) : [].concat(
      !s.dayDate ? [{ item: s.dateOpts.length ? 'Pick the winning date' : 'Pick a date', act: () => openSec(s, 'when') }] : [],
      !s.spot ? [{ item: s.spotOpts.length ? 'Pick the winning spot' : 'Pick a location', act: () => openSec(s, 'when') }] : [],
      !basicsOf(s).length ? [{ item: 'Add basic details', act: () => openSec(s, 'details') }] : [],
      f.open > 0 ? [{ item: 'Fill open spots', meta: f.open + ' open', act: () => openToSection(s, 'sec-tasks') }] : [],
      myJobs.map(j => ({ item: j.item, meta: myTime(j) })));
    const tKey = (lead ? 'h:' : '') + s.id, tOpen = !!st.jobsOpen[tKey];
    const T = lead ? { bar: '#f5f3fe', ink: '#4a3ad4', dot: '#7b6ef0', line: '#e6e1fc', word: 'Your tasks' } : { bar: '#fefaef', ink: '#8f6405', dot: '#e8a71c', line: '#f3e2ad', word: 'You’re helping' };
    const tab = !tasks.length ? '' :
      '<div data-screen-label="' + T.word + '" style="border-radius:0 0 24px 24px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
        (tOpen ? tasks.map((t, i) => '<div ' + (t.act ? on(t.act) + ' ' : '') + 'data-task-row style="display:flex;align-items:center;gap:12px;min-height:52px;padding:10px 18px;background:#fff;border-top:' + (i ? '1px solid #f2f3f6' : '0') + (t.act ? ';cursor:pointer' : '') + '">' +
            '<span style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:' + T.dot + '"></span>' +
            '<span style="flex:1;min-width:0;font-size:16px;font-weight:700;color:#2a2f38;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.item) + '</span>' +
            (t.meta ? '<span style="flex:0 0 auto;font-size:14.5px;font-weight:800;color:' + T.ink + '">' + esc(t.meta) + '</span>' : '') + '</div>').join('') : '') +
        '<div ' + on(() => setState({ jobsOpen: Object.assign({}, st.jobsOpen, { [tKey]: !tOpen }) })) + ' aria-expanded="' + tOpen + '" data-' + (lead ? 'host-tasks' : 'helping') + '-bar style="display:flex;align-items:center;gap:8px;min-height:48px;padding:0 18px;background:' + T.bar + ';color:' + T.ink + ';font-size:15.5px;font-weight:800;cursor:pointer' + (tOpen ? ';border-top:1px solid ' + T.line : '') + '">' +
          ic6('clip', 18, T.ink, 2.2) + '<span style="flex:1">' + T.word + '</span>' +
          (tOpen ? '' : '<span style="font-size:14.5px;font-weight:800">' + tasks.length + (tasks.length === 1 ? ' task' : ' tasks') + '</span>') +
          '<span style="display:flex;transition:transform .15s;transform:' + (tOpen ? 'rotate(180deg)' : 'none') + '">' + I.chevD(14, T.ink, 2.8) + '</span></div>' +
      '</div>';

    // RSVP: three buttons, no checkmarks; tapping your pick again clears it
    const RC = { going: '#149a4b', maybe: '#e8a71c', no: '#6b7280' };
    const rsvpBtn = (k, label, n) => {
      const onIt = my === k;
      return '<button type="button" ' + on(() => { if (!st.busy) setRsvp(s, k); }) + ' aria-pressed="' + onIt + '" style="min-height:60px;border:0;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-family:inherit;cursor:pointer;' +
        (onIt ? 'background:' + RC[k] + ';color:#fff' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;color:#0d1117') + '">' +
        '<span style="font-size:17px;font-weight:800">' + label + '</span><span style="font-size:13px;font-weight:700;color:' + (onIt ? 'rgba(255,255,255,.85)' : '#6b7280') + '">' + n + '</span></button>';
    };
    const rsvpBlock = lead ? '' : '<div data-rsvp style="' + CARD + ';padding:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      rsvpBtn('going', 'Going', goingIds.length) + rsvpBtn('maybe', 'Maybe', maybeN) + rsvpBtn('no', 'Can’t', noN) + '</div>';

    // The host's guest list, with no title. Invites are a share link, so there's no Invited count (HANDOFF §1).
    const guests = !lead ? '' : '<div data-screen-label="Guest list" style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:14px">' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">' + stat(goingIds.length, 'Going', '#e7f6ec', '#0f7a3c') + stat(maybeN, 'Maybe', '#fdf1d6', '#8f6405') + stat(noN, 'Can’t', '#f2f3f6', '#454b55') + '</div>' +
      '<span ' + on(() => setState({ blast: { id: s.id, to: 'all', text: '' } })) + ' style="align-self:center;display:flex;align-items:center;gap:7px;min-height:36px;font-size:14.5px;font-weight:800;color:#6b7280;cursor:pointer">' + ic6('bell', 15, 'currentColor', 2.2) + 'Send everyone an update</span>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<button type="button" class="hov-primary" ' + on(() => setState({ invite: { id: s.id } })) + ' style="min-height:50px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:15.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;box-shadow:0 8px 20px rgba(91,74,232,.28)">' + I.plus(16, '#fff', 2.5) + 'Invite people</button>' +
        '<button type="button" class="hov-outline" ' + on(() => setState({ share: { id: s.id, copied: false } })) + ' style="min-height:50px;border:1.5px solid #dcdfe6;border-radius:999px;background:#fff;color:#0d1117;font-family:inherit;font-size:15.5px;font-weight:800;cursor:pointer">Share link</button>' +
      '</div></div>';
    const missing = (s.dayDate ? 0 : 1) + (s.spot ? 0 : 1);
    const tbdBanner = lead && missing ? '<div ' + on(() => openSec(s, 'when')) + ' data-tbd style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;background:#fef7dd;box-shadow:inset 0 0 0 1.5px #e3c979">' +
      svg(16, stroke(AMBER_INK, 2.2) + ' style="flex:0 0 16px"', P5.clock) + '<span style="flex:1;font-size:14px;line-height:1.35;font-weight:700;color:' + AMBER_INK + '">' +
      (missing === 1 ? '1 thing left to decide. Add it whenever you’re ready.' : missing + ' things left to decide. Add them whenever you’re ready.') + '</span>' + I.chevR(14, AMBER_INK, 2.6) + '</div>' : '';
    const visRow = !lead ? '' : '<div data-vis style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:18px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
      '<span style="flex:0 0 36px;width:36px;height:36px;border-radius:11px;background:#f3f1fe;color:#5b4ae8;display:flex;align-items:center;justify-content:center">' + svg(18, stroke('currentColor', 2.2), s.visibility === 'invite' ? LOCK_IC : PEOPLE_IC) + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">' + (s.visibility === 'invite' ? 'Private' : 'Public') + '</div><div style="font-size:13px;font-weight:600;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(namesList(gIds(s).map(id => (groupById(id) || {}).name).filter(Boolean))) + '</div></div>' +
      '<span ' + on(() => openSec(s, 'vis')) + ' aria-label="Edit who can see it" style="font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span></div>';

    // "Hosted by" (not shown to the host)
    const host = lead ? '' :
      '<div style="position:relative;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,#f1edff,#e0d8ff);box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
        '<span aria-hidden="true" style="position:absolute;left:52%;top:6px;font-size:9px;color:#9d93f7">✦</span><span aria-hidden="true" style="position:absolute;left:64%;bottom:6px;font-size:7px;color:#7b6ef0">✦</span>' +
        '<span style="position:relative;flex:0 0 56px;width:56px;height:56px;border-radius:999px;border:3px solid #fff;box-shadow:0 0 0 2.5px #7b6ef0, 0 6px 16px rgba(13,17,23,.25);display:flex">' + face(s.leadId, leadName, 50, '#7b6ef0') +
          '<span aria-hidden="true" style="position:absolute;top:-10px;left:-8px;font-size:13px;color:#9d93f7">✦</span><span aria-hidden="true" style="position:absolute;top:-4px;right:-10px;font-size:10px;color:#b8aefc">✦</span><span aria-hidden="true" style="position:absolute;bottom:-4px;right:-10px;font-size:13px;color:#7b6ef0">✧</span></span>' +
        '<div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:900;letter-spacing:.9px;color:#6b5ce7">HOSTED BY</div><div style="font-size:20px;font-weight:900;letter-spacing:-.3px;color:#2a1f8f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(leadName) + '</div></div>' +
        '<span ' + on(() => toast('Messages are coming soon. For now, say hi to ' + firstName(leadName) + ' at the event!')) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:40px;padding:0 14px;border-radius:999px;background:#fff;font-size:13.5px;font-weight:800;color:#4a3ad4;cursor:pointer">Say hi</span></div>';

    return '<div data-screen-label="Plan page">' +
      phaseHeader(s, 340, 'linear-gradient(to bottom, rgba(13,17,23,.5) 0%, rgba(13,17,23,0) 30%, rgba(8,40,22,.55) 62%, rgba(8,40,22,.96) 100%)',
        '<div style="position:absolute;left:20px;right:20px;bottom:20px;color:#fff;display:flex;align-items:flex-end;gap:14px"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap"><span data-chip style="display:flex;align-items:center;gap:6px;border-radius:999px;padding:5px 11px;background:' + (lead ? '#5b4ae8' : '#149a4b') + ';font-size:12px;font-weight:900;letter-spacing:.9px">' + (lead ? 'YOU’RE LEADING' : 'HAPPENING') + '</span>' +
            (s.visibility === 'invite' ? '<span style="display:flex;align-items:center;gap:5px;border-radius:999px;padding:5px 11px;background:rgba(255,255,255,.22);font-size:12px;font-weight:900;letter-spacing:.9px">' + svg(11, stroke('#fff', 2.6), '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>') + 'PRIVATE</span>' : '') + '</div>' +
          (edit
            ? '<h1 ' + on(() => openSec(s, 'title'), 'button') + ' aria-label="' + esc(s.text) + ', edit the title" style="margin:0;font-size:40px;line-height:.98;font-weight:900;letter-spacing:-1.3px;text-wrap:pretty;cursor:pointer">' + esc(s.text) + svg(20, stroke('#fff', 2.4) + ' style="display:inline-block;margin-left:8px;vertical-align:4px;opacity:.85"', PENCIL) + '</h1>'
            : '<h1 style="margin:0;font-size:40px;line-height:.98;font-weight:900;letter-spacing:-1.3px;text-wrap:pretty">' + esc(s.text) + '</h1>') + '</div>' +
          (s.dayDate ? '<span aria-label="' + esc(fmtDay(s.dayDate)) + '" style="flex:0 0 70px;width:70px;border-radius:14px;overflow:hidden;text-align:center;background:#fff;box-shadow:0 8px 20px rgba(0,0,0,.3);transform:rotate(4deg)"><span style="display:block;background:#149a4b;color:#fff;font-size:11.5px;font-weight:900;letter-spacing:1px;padding:3px 0">' + dp.mon + '</span><span style="display:block;font-size:32px;line-height:1.15;font-weight:900;color:#0d1117">' + dp.day + '</span><span style="display:block;padding-bottom:5px;font-size:11px;font-weight:800;color:#6b7280">' + dp.dow + '</span></span>' : '') +
        '</div>', true) +
      tab +
      '<div style="padding:16px 14px 26px;display:flex;flex-direction:column;gap:18px">' +
        guests +
        pendingCard(s) +
        rsvpBlock +
        tbdBanner +
        whenWhereCard(s) +
        basicDetailsSec(s) +
        (s.updates.length ? '<section>' + secTitle('Updates') + sheetCard(
          s.updates.map(u => '<div style="display:flex;gap:10px">' + face(s.leadId, leadName, 30) + '<div style="flex:1;border-radius:4px 14px 14px 14px;background:#f2f3f6;padding:10px 12px;font-size:14.5px;line-height:1.4;font-weight:500;color:#2b303a;white-space:pre-line">' + esc(u.body) +
            '<div style="margin-top:4px;font-size:12px;font-weight:700;color:#8a909b">' + esc(ago(u.created)) + '</div></div></div>').join('')) + '</section>' : '') +
        helpOut(s) +
        visRow +
        host +
        '<section>' + secTitle('Who’s going', '<span style="font-size:13.5px;font-weight:800;color:#0f7a3c">' + goingIds.length + ' going</span>') + sheetCard(
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<span style="display:flex">' + (goingIds.length ? peopleFaces(goingIds.slice(0, 5), 40) + (goingIds.length > 5 ? '<span style="width:40px;height:40px;border-radius:999px;border:2.5px solid #fff;margin-left:-10px;background:#e7f6ec;color:#0f7a3c;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center">+' + (goingIds.length - 5) + '</span>' : '') : '<span style="font-size:14px;font-weight:600;color:#6b7280">Nobody yet. Be the first.</span>') + '</span>' +
          '</div>') + '</section>' +
        (s.mood.length ? '<section>' + secTitle('Inspo') + sheetCard('<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
          s.mood.slice(0, 3).map((p, i) => '<div ' + on(() => setState({ zoom: { photos: s.mood.map(photoUrl), i } })) + ' aria-label="View mood photo ' + (i + 1) + '" style="aspect-ratio:1;border-radius:12px;cursor:zoom-in;background:' + bg(photoUrl(p)) + '"></div>').join('') + '</div>') + '</section>' : '') +
        deleteLink(s) +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  function viewDone(s) {
    const st = state, dp = dateParts(s.dayDate), n = going(s).length;
    const album = s.album.map(a => photoUrl(a.path));
    const tileAt = (src, extra) => '<span style="position:relative;border-radius:12px;background:' + (src ? bg(src) : '#e4e7ec') + ';' + (extra || '') + '"></span>';
    return '<div data-screen-label="It happened">' +
      phaseHeader(s, 300, 'linear-gradient(to bottom, rgba(13,17,23,.4), rgba(13,17,23,0) 30%, rgba(34,25,110,.92) 100%)',
        '<span aria-hidden="true" style="position:absolute;top:calc(66px + var(--pt));right:18px;display:flex;align-items:center;min-height:36px;padding:0 14px 0 44px;border-radius:999px;background:#5b4ae8;transform:rotate(-8deg);font-size:15px;font-weight:900;color:#fff;box-shadow:0 6px 16px rgba(15,18,25,.3)"><span style="position:absolute;left:-10px;top:50%;transform:translateY(-55%) rotate(-10deg);font-size:46px;line-height:1">🥳</span>It happened!</span>' +
        '<div style="position:absolute;left:20px;right:20px;bottom:18px;color:#fff"><div style="font-size:13px;font-weight:900;letter-spacing:1.2px;color:#cfc9ff">' + dp.dow + ', ' + dp.md + ' · ' + n + ' WENT</div>' +
          '<h1 style="margin:6px 0 0;font-size:32px;line-height:1.02;font-weight:900;letter-spacing:-1px;text-wrap:pretty">' + esc(s.text) + '</h1></div>') +
      '<div style="padding:14px 14px 26px;display:flex;flex-direction:column;gap:12px">' +
        '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px">' +
          eyebrowRow('The album' + (album.length ? ' · ' + album.length : ''),
            '<label style="font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">+ Add yours<input type="file" accept="image/*" aria-label="Add a photo to the album" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; addAlbumPhoto(s, f); }) + ' style="display:none"></label>') +
          (album.length
            ? '<div ' + on(() => setState({ zoom: { photos: album, i: 0 } })) + ' aria-label="Open the album" style="display:grid;grid-template-columns:' + (album.length === 1 ? '1fr' : album.length === 2 ? '1fr 1fr' : '2fr 1fr') + ';grid-template-rows:' + (album.length < 3 ? '186px' : '90px 90px') + ';gap:6px;cursor:zoom-in">' +
                (album.length < 3 ? album.map(src => tileAt(src)).join('') :
                tileAt(album[0], 'grid-row:span 2') + tileAt(album[1]) +
                '<span style="position:relative;border-radius:12px;background:' + bg(album[2]) + '">' + (album.length > 3 ? '<span style="position:absolute;inset:0;border-radius:12px;background:rgba(13,17,23,.5);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff">+' + (album.length - 3) + '</span>' : '') + '</span>') +
              '</div>'
            : '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">No photos yet. Anyone who went can add theirs.</p>') +
        '</div>' +
        reactionsCard(s) +
        '<div style="border-radius:18px;background:#fdf1d6;padding:16px;display:flex;align-items:center;gap:12px">' +
          '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900;color:#3d2a00">Do it again?</div><div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:600;color:#6b5418">Starts a new event with the place and details filled in.</div></div>' +
          '<span ' + on(() => needSignIn(() => doItAgain(s), 'post')) + ' style="flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:42px;padding:0 16px;border-radius:999px;background:#e8a71c;font-size:14.5px;font-weight:800;color:#fff;cursor:pointer">' + svg(13, 'fill="#fff"', '<path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z"/>') + 'Do it again</span>' +
        '</div>' +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  function viewStartGroup() {
    const st = state, ok = (st.startName || '').trim().length > 1 && !st.busy;
    return modal('Start a group', () => setState({ startName: null }),
      h3('Start a group') + para('You’ll own it, and get a code to invite others.') +
      '<input class="fld" type="text" maxlength="40" aria-label="Group name" placeholder="E.g. Mueller Neighbors" value="' + esc(st.startName || '') + '" ' + onInput(e => { if (e.type === 'input') setState({ startName: e.target.value.slice(0, 40) }); }) + ' style="' + FIELD + '">' +
      '<button type="button" ' + on(submitStartGroup) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">' + (st.busy === 'save' ? 'Creating…' : 'Create group') + '</button>',
      { z: 32 });
  }

  // Invite people / share it (email invites come with the email phase)
  function viewInvite() {
    const s = state.sparks.find(x => x.id === state.invite.id), close = () => setState({ invite: null });
    if (!s) return '';
    const link = location.origin + '/i/' + s.id, lead = isLead(s), ask = state.invite.msg;   // ask: "Find a replacement"
    const msg = ask ? ask + ' ' + link : 'Hey! ' + (lead ? 'I’m hosting ' : 'Come to ') + s.text + (s.dayDate ? ' on ' + whenLong(s) : '') + (s.spot ? ' at ' + s.spot : '') + '. RSVP here: ' + link;
    const title = state.invite.title || (lead ? 'Invite people' : 'Share this plan');
    if (ask) return modal(title, close,   // Round 64c
      h3(title) + '<div style="margin-top:-6px;font-size:14px;font-weight:700;color:#6b7280">' + esc(state.invite.sub || s.text) + '</div>' +
      '<div style="padding:14px 16px;border-radius:16px;background:#f4f5f7;font-size:15px;line-height:1.45;font-weight:600;color:#2b303a;overflow-wrap:anywhere">“' + esc(ask + ' ' + link.replace(/^https?:\/\//, '')) + '”</div>' +
      '<button type="button" class="hov-primary" ' + on(() => { if (navigator.share) navigator.share({ title: s.text, text: msg, url: link }).catch(() => {}); else copy(msg, 'Message copied. Paste it anywhere.'); }) + ' style="' + primary(true) + '">Send the message</button>' +
      '<span ' + on(() => copy(msg, 'Message copied. Paste it anywhere.')) + ' style="align-self:center;display:flex;align-items:center;min-height:36px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Copy it instead</span>',
      { z: 32 });
    return modal(title, close,
      h3(title) + (ask ? para('“' + esc(ask) + '”') : '') +
      para(esc([s.text, whenLong(s)].filter(Boolean).join(' · '))) +
      '<div style="display:flex;gap:8px"><span style="' + WELL + ';flex:1;min-width:0;font-size:14px;font-weight:600;color:#5c6270;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(link.replace(/^https?:\/\//, '')) + '</span>' +
        '<button type="button" class="hov-outline" ' + on(() => copy(link, 'Link copied')) + ' style="' + COPY_BTN + '">Copy</button></div>' +
      '<button type="button" class="hov-primary" ' + on(() => { if (navigator.share) navigator.share({ title: s.text, text: msg, url: link }).catch(() => {}); else copy(msg, ask ? 'Message copied. Paste it anywhere.' : 'Invite copied. Paste it anywhere.'); }) + ' style="' + primary(true) + '">' + (ask ? 'Send the message' : 'Share the invite') + '</button>' +
      '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Anyone with the link can see it and RSVP, even without an account. Email invites are coming.</p>',
      { z: 32 });
  }

  // "Send an update" to people on the plan (posted on the plan now; delivery comes with notifications)
  function viewBlast() {
    const b = state.blast, s = state.sparks.find(x => x.id === b.id), close = () => setState({ blast: null });
    if (!s) return '';
    const g = going(s).length, m = s.rsvps.filter(r => r.status === 'maybe').length;
    const aud = [['all', 'Everyone', s.rsvps.length], ['going', 'Going', g], ['maybe', 'Maybe', m]];
    const tpl = [['Reminder', 'Reminder: ' + s.text + ' is ' + whenLong(s) + (s.spot ? ' at ' + s.spot : '') + '. See you there!'], ['Change of plans', 'Heads up, small change for ' + s.text + ': '], ['Last call', 'Still room at ' + s.text + '! RSVP if you can make it.']];
    const ok = b.text.trim().length > 0 && !state.busy;
    return modal('Send an update', close,
      h3('Send an update') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + aud.map(([k, label, n]) => '<span ' + on(() => setState({ blast: Object.assign({}, b, { to: k }) })) + ' style="display:flex;align-items:center;min-height:38px;padding:0 13px;border-radius:999px;font-size:14px;font-weight:800;cursor:pointer;' + (b.to === k ? 'background:#0d1117;color:#fff' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;color:#0d1117') + '">' + label + ' · ' + n + '</span>').join('') + '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + tpl.map(([label, text]) => '<span ' + on(() => setState({ blast: Object.assign({}, b, { text }) })) + ' style="display:flex;align-items:center;min-height:32px;padding:0 11px;border-radius:999px;background:#f3f1fe;font-size:13px;font-weight:800;color:#4a3ad4;cursor:pointer">' + label + '</span>').join('') + '</div>' +
      '<textarea class="fld" rows="4" maxlength="320" aria-label="Your update" placeholder="What should people know?" ' + onInput(e => { if (e.type === 'input') setState({ blast: Object.assign({}, state.blast, { text: e.target.value.slice(0, 320) }) }); }) + ' style="' + FIELD + ';resize:none;line-height:1.4">' + esc(b.text) + '</textarea>' +
      '<button type="button" ' + on(() => { if (ok) postUpdate(s); }) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">' + (state.busy === 'save' ? 'Posting…' : 'Post update') + '</button>' +
      '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">It shows on the plan for everyone who can see it.</p>',
      { z: 32 });
  }

  // ---------------------------------------------------------------------------
  // 7. Profile (signed in only)
  // ---------------------------------------------------------------------------

  const diagCard = () => {
    const log = diagRead(), clock = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
    return '<div data-screen-label="Freeze log" style="' + CARD + ';padding:14px 16px;display:flex;flex-direction:column;gap:8px">' +
      '<div><div style="font-size:15.5px;font-weight:800;color:#0d1117">Freeze log</div>' +
      '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:500;color:#6b7280">Temporary, only you see this. Times the app stopped responding on this device.</div></div>' +
      (log.length
        ? log.slice(0, 15).map(e => '<div style="font-size:12.5px;line-height:1.4;font-weight:600;color:#454b55;border-top:1px solid #f2f3f6;padding-top:6px">' +
            '<b style="color:' + (e.kind === 'stall' ? '#9b1c31' : '#0d1117') + '">' + esc(e.kind) + ' ' + (e.ms / 1000).toFixed(1) + 's</b> · ' + esc(e.screen || '') + ' · ' + esc(clock(e.at)) +
            (e.note ? '<br>' + esc(e.note) : '') + '</div>').join('') +
          '<button type="button" ' + on(() => { try { localStorage.removeItem(DIAG_KEY); } catch (e) { /* blocked */ } render(); }) + ' style="align-self:flex-start;min-height:36px;padding:0 14px;border:1.5px solid #dcdfe6;border-radius:999px;background:#fff;color:#0d1117;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer">Clear</button>'
        : '<div style="font-size:13.5px;font-weight:600;color:#8a909b">Nothing logged yet.</div>') +
    '</div>';
  };

  // v6 Update 2: a compact Profile sheet (photo, name, a pencil to edit); Help & info tiles, then Settings
  function viewProfileSheet() {
    const close = () => setState({ profSheet: false });
    const st = state, avatar = st.myAvatar ? photoUrl(st.myAvatar) : null;
    const ROW = 'display:flex;align-items:center;gap:12px;min-height:60px;padding:10px 16px;cursor:pointer;text-decoration:none';
    const line = (title, sub) => '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#0d1117">' + title + '</div><div style="font-size:13px;font-weight:500;color:#6b7280">' + sub + '</div></div>';
    const section = (label, inner) => '<div style="display:flex;flex-direction:column;gap:8px"><span style="padding:0 4px;' + EYEBROW + '">' + label + '</span><div style="' + CARD + ';overflow:hidden">' + inner + '</div></div>';
    const tile = (icon, title, sub, fn) => '<div ' + on(fn) + ' aria-label="' + esc(title) + '" class="hov-row" style="display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<span style="width:40px;height:40px;border-radius:12px;background:#f3f1fe;color:#4a3ad4;display:flex;align-items:center;justify-content:center">' + icon + '</span>' +
      '<div><div style="font-size:15.5px;line-height:1.2;font-weight:900;color:#0d1117;text-wrap:balance">' + title + '</div><div style="margin-top:3px;font-size:12.5px;line-height:1.35;font-weight:600;color:#6b7280">' + sub + '</div></div></div>';
    return sheet6('Profile', close,
      '<div style="display:flex;align-items:center;gap:14px;padding:2px 2px 4px">' +
        '<span ' + on(openProfileEdit) + ' aria-label="Change photo" style="flex:0 0 56px;width:56px;height:56px;border-radius:999px;background:' + (avatar ? bg(avatar) : '#e8a71c') + ';color:#fff;font-size:22px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer">' + (avatar ? '' : esc(initialOf(st.myName) || '?')) + '</span>' +
        '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px">' +
          '<span style="min-width:0;font-size:20px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(st.myName || 'No name yet') + '</span>' +
          '<span ' + on(openProfileEdit) + ' aria-label="Edit profile" style="flex:0 0 32px;width:32px;height:32px;border-radius:999px;color:#9aa0ac;display:flex;align-items:center;justify-content:center;cursor:pointer">' + svg(15, stroke('currentColor', 2.2), '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>') + '</span></div>' +
        closeX(close) + '</div>',
      '<div style="padding:18px 14px 30px;display:flex;flex-direction:column;gap:20px">' +
        '<div style="display:flex;flex-direction:column;gap:10px"><h2 style="margin:0;padding:0 4px;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117">Help &amp; info</h2>' +
          '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' +
            tile('<span style="font-size:17px;font-weight:900">?</span>', 'How Spark Hub works', 'Events, ideas, and pitching in', () => go('how')) +
            tile(svg(18, stroke('currentColor', 2), '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'), 'Notification settings', 'What you hear about and how', () => setState({ nSettings: true })) +
          '</div></div>' +
        section('Settings',
          '<div ' + on(() => setState({ nSettings: true })) + ' class="hov-row" style="' + ROW + '">' + line('Notifications', 'In the app and on your phone') + I.chevR(16, '#9aa0ac', 2.4) + '</div>' +
          (installMode() ? '<div ' + on(startInstall) + ' class="hov-row" style="' + ROW + ';border-top:1px solid #f2f3f6">' + line('Add to Home Screen', installMode() === 'prompt' ? 'Install Spark Hub on this phone' : 'A few taps in ' + IOS_BROWSER + '’s Share menu') + I.chevR(16, '#9aa0ac', 2.4) + '</div>' : '') +
          '<a href="/privacy.html" target="_blank" rel="noopener" class="hov-row" style="' + ROW + ';border-top:1px solid #f2f3f6">' + line('Privacy', 'Who sees your profile and plans') + I.chevR(16, '#9aa0ac', 2.4) + '</a>') +
        '<div style="display:flex;flex-direction:column;gap:14px">' +
          (st.demoAdmin && st.sparks.some(s => s.demo)
            ? '<div style="' + CARD + ';padding:14px 16px;display:flex;flex-direction:column;gap:10px">' +
                '<div><div style="font-size:15.5px;font-weight:800;color:#0d1117">Demo content</div>' +
                '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:500;color:#6b7280">' + st.sparks.filter(s => s.demo).length + ' ideas and plans in your groups are demo content. Only you can see this.</div></div>' +
                '<button type="button" ' + on(wipeDemo) + ' style="align-self:flex-start;min-height:40px;padding:0 16px;border:1.5px solid #f5c2cb;border-radius:999px;background:#fff;color:#9b1c31;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer">Remove all demo content</button>' +
              '</div>'
            : '') +
          testerCard() +
          (st.demoAdmin ? diagCard() : '') +
          '<div ' + on(signOut) + ' style="' + CARD + ';padding:0 16px;min-height:52px;display:flex;align-items:center;cursor:pointer"><span style="font-size:15.5px;font-weight:800;color:#9b1c31">Sign out</span></div>' +
          '<a href="/privacy.html" target="_blank" rel="noopener" style="align-self:center;display:flex;align-items:center;min-height:36px;padding:0 10px;font-size:13.5px;font-weight:700;color:#6b7280">Privacy</a>' +
        '</div>' +
      '</div>', 48);
  }

  // ---------------------------------------------------------------------------
  // 8. Edit group (owners and admins)
  // ---------------------------------------------------------------------------

  const FACE_SET = ['#e8a71c', '#5b4ae8', '#0f7a3c', '#e2556b', '#2b8fd6', '#8f6405'];
  const memberFace = (m, size, extra) => {
    const url = m.user_id === state.me ? avatarOf(state.me) : (PHOTO_PATH.test(m.avatar_path || '') ? photoUrl(m.avatar_path) : null);
    return '<span aria-hidden="true" style="flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:' +
      (url ? bg(url) : FACE_SET[(m.name || '').length % FACE_SET.length]) + ';color:#fff;font-size:' + Math.round(size * 0.4) + 'px;font-weight:800;display:flex;align-items:center;justify-content:center;' + (extra || '') + '">' +
      (url ? '' : esc(initialOf(m.name) || '?')) + '</span>';
  };
  const WELL = 'display:flex;align-items:center;min-height:50px;border-radius:12px;background:#f7f7f9;padding:0 14px';
  const COPY_BTN = 'display:flex;align-items:center;min-height:50px;padding:0 16px;border:1.5px solid #dcdfe6;border-radius:12px;background:#fff;font-family:inherit;font-size:15px;font-weight:800;color:#0d1117;cursor:pointer';
  const LABEL = 'font-size:14px;font-weight:700;color:#2b303a';
  const COVER_BTN = 'position:absolute;right:12px;bottom:12px;display:flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:10px;background:#fff;box-shadow:0 2px 8px rgba(15,18,25,.2);font-size:14px;font-weight:800;color:#0d1117;cursor:pointer';

  function viewGroupPage() {
    const st = state, g = groupById(st.gpId);
    if (!runs(g)) return viewCalendar();
    const owner = g.role === 'owner', link = st.gpCode ? inviteLink(st.gpCode) : '';
    const photo = groupPhoto(g), list = st.membersList || [];
    const me = list.find(m => m.user_id === st.me), others = list.filter(m => m.user_id !== st.me);
    const stack = (me ? [me] : []).concat(others).slice(0, 4);
    const renaming = owner && st.gpRename != null;
    const renameOk = renaming && st.gpRename.trim().length > 1 && st.gpRename.trim() !== g.name && !st.busy;

    return '<div data-screen-label="Edit group" style="background:#fff;min-height:100%">' +
      '<div style="border-bottom:1px solid #e6e7eb;padding:10px 8px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center">' +
        '<span ' + on(closeGroupPage) + ' style="justify-self:start;display:flex;align-items:center;gap:2px;min-height:44px;padding:0 8px;font-size:16px;font-weight:600;color:#5b4ae8;cursor:pointer">' + I.chevL(20, '#5b4ae8', 2.4) + 'Back</span>' +
        '<span style="font-size:17px;font-weight:800;color:#0d1117">Edit group</span><span></span>' +
      '</div>' +
      '<div style="position:relative;height:196px;background:#e8a71c;overflow:hidden">' +
        (photo
          ? photoLayer(photo, g.photoPos, GROUP_POS) +
            '<span ' + on(() => openPositioner({ kind: 'group', id: g.id, url: photo, pos: g.photoPos })) + ' style="' + COVER_BTN + '">' + I.camera(15) + 'Change cover</span>'
          : '<label style="' + COVER_BTN + '">' + I.camera(15) + 'Add a cover<input type="file" accept="image/*" aria-label="Add a cover" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; pickForPositioner(f, { kind: 'group', id: g.id }); }) + ' style="display:none"></label>') +
      '</div>' +
      '<div style="padding:20px 20px 26px;display:flex;flex-direction:column;gap:20px">' +
        '<div style="display:flex;flex-direction:column;gap:7px">' +
          '<span style="' + LABEL + '">Group name</span>' +
          (renaming
            ? '<div style="display:flex;align-items:center;gap:6px;min-height:50px;border:2px solid #5b4ae8;border-radius:12px;padding:0 6px 0 14px">' +
                '<input class="fld" type="text" maxlength="40" data-rename aria-label="Group name" value="' + esc(st.gpRename) + '" ' + onInput(e => { if (e.type === 'input') setState({ gpRename: e.target.value.slice(0, 40) }); }) + ' style="flex:1;min-width:0;border:0;outline:none;background:transparent;font-family:inherit;font-size:16px;font-weight:700;color:#0d1117">' +
                '<span ' + on(() => setState({ gpRename: null })) + ' style="display:flex;align-items:center;min-height:36px;padding:0 10px;font-size:14px;font-weight:700;color:#6b7280;cursor:pointer">Cancel</span>' +
                '<span ' + on(() => saveRename(g)) + ' aria-disabled="' + !renameOk + '" style="display:flex;align-items:center;min-height:36px;padding:0 14px;border-radius:9px;background:' + (renameOk ? '#5b4ae8' : '#b9bcc4') + ';font-size:14px;font-weight:800;color:#fff;cursor:' + (renameOk ? 'pointer' : 'not-allowed') + '">' + (st.busy === 'save' ? 'Saving…' : 'Save') + '</span>' +
              '</div>'
            : '<div ' + (owner ? on(() => { setState({ gpRename: g.name }); setTimeout(() => { const f = document.querySelector('[data-rename]'); if (f) { f.focus(); f.select(); } }, 0); }) + ' aria-label="Rename group"' : 'aria-label="Group name, only the owner can change it"') + ' style="display:flex;align-items:center;gap:12px;min-height:50px;border-radius:12px;background:#f7f7f9;padding:0 14px;cursor:' + (owner ? 'pointer' : 'default') + '">' +
                '<span style="flex:1;min-width:0;font-size:16px;font-weight:700;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(g.name) + '</span>' +
                (owner ? svg(14, stroke('#9aa0ac', 2.6) + ' style="flex:0 0 14px"', '<path d="M9 6l6 6-6 6"/>') : svg(15, stroke('#9aa0ac', 2.4), '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')) +
              '</div>') +
          '<span style="font-size:13px;font-weight:500;color:#8a909b">' + (owner ? 'Everyone in the group sees it.' : 'Only owners can change the name.') + '</span>' +
        '</div>' +
        '<div ' + on(openMembers) + ' class="hov-tint2" aria-label="See all members" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:16px;background:#f3f1fe;cursor:pointer">' +
          '<div style="display:flex">' +
            stack.map((m, k) => memberFace(m, 34, 'border:2px solid #f3f1fe;' + (k ? 'margin-left:-10px;' : ''))).join('') +
            (list.length > 4 ? '<span style="width:34px;height:34px;border-radius:999px;border:2px solid #f3f1fe;margin-left:-10px;background:#5b4ae8;color:#fff;font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center">+' + (list.length - 4) + '</span>' : '') +
          '</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:900;color:#0d1117">' + (st.gpMembers == null ? '…' : st.gpMembers + (st.gpMembers === 1 ? ' member' : ' members')) + '</div>' +
            '<div style="font-size:13px;font-weight:600;color:#5c6270">' + (owner ? 'You’re the owner' : 'You’re an admin') + '</div></div>' +
          '<span style="font-size:15px;font-weight:800;color:#5b4ae8">See all</span>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:7px">' +
          '<span style="' + LABEL + '">Invite code</span>' +
          '<div style="display:flex;gap:8px"><span style="' + WELL + ';flex:1;font-size:18px;font-weight:900;letter-spacing:4px;color:#0d1117">' + esc(st.gpCode || '······') + '</span>' +
            '<button type="button" class="hov-outline" ' + on(() => { if (st.gpCode) copy(st.gpCode, 'Code copied'); }) + ' aria-label="Copy code" style="' + COPY_BTN + '">Copy</button></div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:7px">' +
          '<span style="' + LABEL + '">Invite link</span>' +
          '<div style="display:flex;gap:8px"><span style="' + WELL + ';flex:1;min-width:0;font-size:14.5px;font-weight:600;color:#5c6270;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(link.replace(/^https?:\/\//, '')) + '</span>' +
            '<button type="button" class="hov-outline" ' + on(() => { if (link) copy(link, 'Invite link copied'); }) + ' aria-label="Copy invite link" style="' + COPY_BTN + '">Copy</button></div>' +
        '</div>' +
        (owner
          ? '<div style="height:1px;background:#eceef2"></div>' +
            '<div style="display:flex;flex-direction:column;gap:6px">' +
              '<button type="button" class="hov-danger" ' + on(() => askDeleteGroup(g)) + ' style="display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;background:#fff;border:1.5px solid #f5c2cb;border-radius:999px;font-family:inherit;font-size:15.5px;font-weight:800;color:#9b1c31;cursor:pointer">' + svg(17, stroke('#9b1c31', 2), '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>') + 'Delete group</button>' +
              '<span style="text-align:center;font-size:12.5px;font-weight:500;color:#8a909b">Only owners can delete the group.</span>' +
            '</div>'
          : '') +
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
        ? '<div style="display:flex;align-items:flex-start;gap:7px;padding:2px 4px 0;font-size:13.5px;line-height:1.4;font-weight:600;color:#6b7280">' +
            '<span aria-hidden="true" style="flex:0 0 auto;margin-top:1px;color:#9aa0ac">' + I.pin(13) + '</span><span>' + esc(picked.address) + '</span></div>'
        : '') +
      (!picked && sugg.length
        ? '<div role="group" aria-label="Suggested places" style="background:#fff;border:1px solid #eceef2;border-radius:16px;overflow:hidden;box-shadow:0 12px 28px rgba(15,18,25,.08)">' +
            sugg.slice(0, 4).map((p, i) =>
              '<div ' + on(() => pick(p)) + ' class="hov-row" style="display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer' + (i ? ';border-top:1px solid #f2f3f6' : '') + '">' +
                '<span aria-hidden="true" style="flex:0 0 32px;width:32px;height:32px;border-radius:10px;background:#f3f1fe;color:#5b4ae8;display:flex;align-items:center;justify-content:center">' + I.pin(15) + '</span>' +
                '<span style="min-width:0"><span style="display:block;font-size:15.5px;line-height:1.3;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.name) + '</span>' +
                (p.sub ? '<span style="display:block;margin-top:1px;font-size:13px;line-height:1.35;font-weight:500;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.sub) + '</span>' : '') +
                '</span></div>').join('') +
            '<div style="padding:8px 16px 10px;border-top:1px solid #f2f3f6;font-size:11.5px;font-weight:500;color:#9aa0ac">' +
              'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" style="color:inherit">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style="color:inherit">OpenStreetMap</a> contributors</div>' +
          '</div>'
        : '') +
    '</div>';
  };

  // ---------------------------------------------------------------------------
  // 5. Create event (v6 Update 6): Event title → Date & time → Location → Basic details →
  //    How people can help → Review. Only the title is required; any other step can be
  //    decided later, or (date, location) put to a poll.
  // ---------------------------------------------------------------------------

  const TIME_OPTS = Array.from({ length: 48 }, (_, i) => {
    const hh = Math.floor(i / 2), mm = i % 2 ? '30' : '00';
    return [pad2(hh) + ':' + mm, (hh % 12 || 12) + ':' + mm + (hh < 12 ? ' am' : ' pm')];
  });
  const clock = (v) => { if (!v) return ''; const [h, m] = v.split(':').map(Number); return (h % 12 || 12) + ':' + pad2(m) + (h < 12 ? 'am' : 'pm'); };
  const EV_TIMES = TIME_OPTS.map(o => o[0]).filter(v => v >= '06:00');   // every 30 min, 6:00am–11:30pm
  const EV_STEPS = ['title', 'when', 'where', 'details', 'help'];
  const EV_NAMES = { title: 'Event title', when: 'Date & time', where: 'Location', details: 'Basic details', help: 'How people can help', review: 'Review' };
  const BIT_PH = ['e.g. Let’s all catch up!', 'e.g. Coffee and donuts at 9:30', 'e.g. Kids and dogs welcome'];
  const EV_GRAD = 'linear-gradient(135deg,#5b4ae8,#8a6ff0 55%,#e8a71c)';
  const AMBER_INK = '#8f6405';
  const BIG = 'display:block;box-sizing:border-box;width:100%;min-width:0;min-height:58px;margin:0;border:2px solid #dcdfe6;border-radius:16px;padding:0 16px;font-family:inherit;font-size:17px;font-weight:800;color:#0d1117;background:#fff;outline:none';
  const HINT = 'position:absolute;left:18px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:16.5px;font-weight:400;font-style:italic;color:#b9bcc4;white-space:nowrap';
  const DARK_X = svg(14, stroke('#fff', 2.6), '<path d="M6 6l12 12M18 6 6 18"/>');
  const PENCIL = '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>';
  const CAMERA = '<path d="M4 8.5A2 2 0 0 1 6 6.5h1.8l1.4-2h5.6l1.4 2H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.4"/>';
  const POLL_IC = '<path d="M5 20V11M12 20V5M19 20v-6"/>';
  const HAND_IC = '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-6.5 6.5A5.5 5.5 0 0 1 5.6 17L4 13.8a1.5 1.5 0 0 1 2.6-1.5L8 14"/>';
  const LINES_IC = '<path d="M5 7h14M5 12h14M5 17h9"/>';
  const TRASH_IC = '<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>';
  const PEOPLE_IC = '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16 14.2a4.5 4.5 0 0 1 5 4.8"/>';
  const LOCK_IC = '<rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>';

  // Older events kept several sentences in one line (or in `vision`): one bullet per sentence
  const splitBits = (arr) => [].concat(...(arr || []).map(b => String(b || '').split(/(?<=[.!?])\s+/))).map(x => x.trim()).filter(Boolean);
  const basicsOf = (s) => s.hopes.length ? splitBits(s.hopes) : splitBits([s.vision]);
  const evPhotoUrl = (st) => st.photos[0] ? st.photos[0].url : (PHOTO_PATH.test(st.evPhotoPath || '') ? photoUrl(st.evPhotoPath) : null);
  const evFilled = (st) => ({ title: !!cleanTitle(st.activity), when: !!st.evDate || !!st.evDatePoll, where: !!cleanTitle(st.locText) || !!st.evSpotPoll,
    details: st.evBits.some(b => b.trim()), help: st.evNeeds.length > 0 });
  // "Sat, Oct 24 · 10am", "Sat, Oct 24 · 10am – 12pm"
  const dayLabel = (d, t, e) => d ? fmtDay(d) + (t ? ' · ' + (e ? spanTime({ time: t, endTime: e }) : fmtTime(t)) : '') : '';
  const jobMeta = (j) => j.shifts ? j.shifts.length + (j.shifts.length === 1 ? ' shift' : ' shifts')
    : (j.need ? j.need + (j.need === 1 ? ' person' : ' people') : 'Anyone') + (j.time ? ' · ' + fmtTime(j.time) : '');
  const evGroupIds = (st) => {
    const mine = myGroups().map(g => g.id), list = (st.evGroups || []).filter(id => mine.indexOf(id) > -1), g = currentGroup();
    return list.length ? list : g ? [g.id] : [];
  };
  const namesList = (names) => names.length > 2 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names.join(' and ');

  const composeReset = () => {
    state.photos.forEach(p => URL.revokeObjectURL(p.url));
    return blankCompose();
  };
  const goCompose = (extra) => {
    setState({ menu: null });
    if (state.email && !currentGroup()) { if (state.loaded) openJoin(); return; }   // groups still loading: wait
    const pre = extra && !extra.type ? extra : {};   // on(goCompose) passes the click event
    go('compose', Object.assign(composeReset(), pre));
  };
  const evGo = (k, extra) => setState(Object.assign({ evStep: k, menu: null, timeOpen: null }, extra || {}));
  const evExit = () => go('calendar', composeReset());

  const pickEvPhoto = async (file) => {
    if (!file) return;
    try {
      const blob = await shrinkImage(file);
      state.photos.forEach(p => URL.revokeObjectURL(p.url));
      setState({ photos: [{ blob, url: URL.createObjectURL(blob) }], coverPos: null });
    } catch (e) { toast(BAD_PHOTO); }
  };
  const photoInput = (label) => '<input type="file" accept="image/*" aria-label="' + label + '" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; pickEvPhoto(f); }) + ' style="display:none">';

  // Leads need an account: sign in first, then carry on with the same event
  const createEvent = () => needSignIn(() => {
    if (!currentGroup()) { openJoin(); return; }
    needName(postEvent);
  }, 'post');

  // The cover: a new photo is uploaded; a draft's saved one is reused as it is
  const evCover = async (st) => {
    if (st.photos[0]) return { path: await uploadBlob(st.photos[0].blob), fresh: true };
    return PHOTO_PATH.test(st.evPhotoPath || '') ? { path: st.evPhotoPath, fresh: false } : null;
  };
  // Jobs from the flow, or from Edit what you need, as signup_items rows (a shift job, then its shifts)
  const insertJob = async (sparkId, j) => {
    const item = cleanTitle(j.item).slice(0, 60), descr = (j.desc || '').trim().slice(0, 400) || null;
    if (!item) return;
    const shifts = (j.shifts || []).filter(q => q.time);
    if (!shifts.length) {
      must(await sb.from('signup_items').insert({ spark_id: sparkId, item, descr, need: j.need || null, time: j.time || null }));
      return;
    }
    const job = must(await sb.from('signup_items').insert({ spark_id: sparkId, item, descr }).select('id').single()).data;
    must(await sb.from('signup_items').insert(shifts.map(q => ({ spark_id: sparkId, item, shift_of: job.id, time: q.time, end_time: q.end && q.end > q.time ? q.end : null, need: q.need || null }))));
  };

  const postEvent = () => {
    const st = state, groups = evGroupIds(st);
    if (!groups.length || st.busy || !cleanTitle(st.activity)) return;
    const place = st.locPlace && cleanTitle(st.locText) ? st.locPlace : null, spot = cleanTitle(st.locText).slice(0, 80) || null;
    const who = (st.myName || 'Someone').slice(0, 40);
    let id = null, cover = null;
    setState({ busy: 'post' });
    (async () => {
      try {
        await ensureSession();
        cover = await evCover(st);
        const row = {
          group_id: groups[0], author_name: st.myName, text: cleanTitle(st.activity).slice(0, 40),
          hopes: st.evBits.map(b => b.trim().slice(0, 40)).filter(Boolean), vision: null,
          photos: cover ? [cover.path] : [], cat: 'events', answers: {}, lead_id: st.me, lead_name: st.myName, created_by: st.me,
          spot, spot_open: !spot, spot_address: place ? place.address : null, spot_lat: place ? place.lat : null, spot_lon: place ? place.lon : null,
          day_date: st.evDate || null, day_time: st.evDate && st.evTime ? st.evTime : null, day_end: st.evDate && st.evTime && st.evEnd ? st.evEnd : null,
          planned: true, visibility: st.evPriv ? 'invite' : 'group',
          cover_pos: cover && st.coverPos ? posOf(st.coverPos, IDEA_POS) : null
        };
        try {
          id = must(await sb.from('sparks').insert(row).select('id').single()).data.id;
        } catch (e) { if (cover && cover.fresh) deletePhotos([cover.path]); throw e; }
        try {
          if (groups.length > 1) must(await sb.from('spark_groups').insert(groups.slice(1).map(g => ({ spark_id: id, group_id: g }))));
          if (st.evDatePoll) must(await sb.from('date_options').insert(st.evDatePoll.map(o => ({ spark_id: id, day_date: o.d, day_time: o.t || null, who }))));
          if (st.evSpotPoll) must(await sb.from('spot_options').insert(st.evSpotPoll.map(o => ({ spark_id: id, name: cleanTitle(o.v).slice(0, 80), who }))));
          for (const j of st.evNeeds) await insertJob(id, j);
        } catch (e) {   // don't leave half an event up
          await sb.from('sparks').delete().eq('id', id);
          if (cover && cover.fresh) deletePhotos([cover.path]);
          throw e;
        }
        if (st.evDraftId) {
          await sb.from('event_drafts').delete().eq('id', st.evDraftId);
          if (cover && cover.fresh && st.evPhotoPath) deletePhotos([st.evPhotoPath]);   // the draft's old cover
        }
        await loadFresh();
        setState(Object.assign(composeReset(), { busy: null, phaseTab: 'plan' }));
        go('detail', { subjectId: id, tag: 'It’s on the books' });
      } catch (e) {
        console.error(e);
        setState({ busy: null });
        toast(FAILED);
      }
    })();
  };

  // Drafts: the flow's own fields, saved to your account (only you see them)
  const DRAFT_FIELDS = ['activity', 'evStep', 'evDate', 'evTime', 'evEnd', 'evEndOn', 'locText', 'locPlace', 'evBits', 'evNeeds', 'evDatePoll', 'evSpotPoll', 'evLater', 'evPriv', 'evGroups', 'coverPos'];
  const saveDraft = () => {
    const st = state;
    if (st.busy) return;
    if (!cleanTitle(st.activity)) { setState({ evLeave: false }); evGo('title'); toast('Add a title first so you can find it later'); return; }
    setState({ busy: 'draft' });
    (async () => {
      let cover = null;
      try {
        await ensureSession();
        cover = await evCover(st);
        const data = {};
        DRAFT_FIELDS.forEach(k => { data[k] = st[k]; });
        data.evPhoto = cover ? cover.path : null;
        if (st.evDraftId) must(await sb.from('event_drafts').update({ data, updated_at: new Date().toISOString() }).eq('id', st.evDraftId));
        else must(await sb.from('event_drafts').insert({ data }));
        if (cover && cover.fresh && st.evPhotoPath) deletePhotos([st.evPhotoPath]);
        await loadFresh();
        setState(Object.assign(composeReset(), { busy: null }));
        go('home');
        toast('Saved as a draft', true);
      } catch (e) {
        console.error(e);
        if (cover && cover.fresh) deletePhotos([cover.path]);
        setState({ busy: null });
        toast(/too many drafts/.test(e.message || '') ? 'That’s a lot of drafts. Post or delete one first.' : FAILED);
      }
    })();
  };
  const draftState = (d) => {
    const x = d.data || {}, out = {}, arr = (v) => Array.isArray(v) ? v : null, str = (v) => typeof v === 'string' ? v : '';
    Object.assign(out, {
      activity: str(x.activity).slice(0, 40), evStep: EV_STEPS.concat('review').indexOf(x.evStep) > -1 ? x.evStep : 'title',
      evDate: /^\d{4}-\d{2}-\d{2}$/.test(x.evDate || '') ? x.evDate : '', evTime: str(x.evTime), evEnd: str(x.evEnd), evEndOn: !!x.evEndOn,
      locText: str(x.locText).slice(0, 80), locPlace: x.locPlace && typeof x.locPlace === 'object' ? x.locPlace : null,
      evBits: [0, 1, 2].map(i => str((x.evBits || [])[i]).slice(0, 40)), evNeeds: arr(x.evNeeds) || [],
      evDatePoll: arr(x.evDatePoll), evSpotPoll: arr(x.evSpotPoll), evLater: x.evLater && typeof x.evLater === 'object' ? x.evLater : {},
      evPriv: !!x.evPriv, evGroups: arr(x.evGroups), coverPos: x.coverPos || null,
      evPhotoPath: PHOTO_PATH.test(x.evPhoto || '') ? x.evPhoto : null, evDraftId: d.id
    });
    return out;
  };
  const resumeDraft = (d) => goCompose(draftState(d));
  const deleteDraft = (d) => run(async () => {
    must(await sb.from('event_drafts').delete().eq('id', d.id));
  }).then(ok => { if (ok) { if (PHOTO_PATH.test((d.data || {}).evPhoto || '')) deletePhotos([d.data.evPhoto]); toast('Draft deleted', true); } });
  const agoSaved = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'Saved just now' : m < 60 ? 'Saved ' + m + ' min ago' : m < 1440 ? 'Saved ' + Math.round(m / 60) + 'h ago' : 'Saved ' + Math.round(m / 1440) + 'd ago'; };
  const draftsSection = () => !state.drafts.length ? '' :
    '<section aria-label="Your drafts" style="display:flex;flex-direction:column;gap:8px"><h2 style="margin:0;padding:0 4px;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117">Your drafts</h2>' +
    state.drafts.map(d => {
      const x = draftState(d), j = x.evStep === 'review' ? 5 : Math.max(0, EV_STEPS.indexOf(x.evStep)), url = x.evPhotoPath ? photoUrl(x.evPhotoPath) : null;
      return '<div data-draft="' + esc(x.activity) + '" style="background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08);overflow:hidden;display:flex">' +
        '<span aria-hidden="true" style="flex:0 0 76px;background:' + (url ? '#2b303a ' + bg(url) : EV_GRAD) + '"></span>' +
        '<div style="flex:1;min-width:0;padding:12px 14px;display:flex;flex-direction:column;gap:7px">' +
          '<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;background:#eef0f3;color:#454b55;font-size:11px;font-weight:900;letter-spacing:.6px">DRAFT</span>' +
            '<span style="flex:1;font-size:12.5px;font-weight:600;color:#6b7280">' + agoSaved(d.saved) + '</span>' +
            '<span ' + on(() => { if (!state.busy) deleteDraft(d); }) + ' aria-label="Delete draft" style="width:30px;height:30px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer">' + svg(15, stroke('#9aa0ac', 2.2), TRASH_IC) + '</span></div>' +
          '<div style="font-size:17px;line-height:1.2;font-weight:900;letter-spacing:-.3px;color:#0d1117">' + esc(cleanTitle(x.activity) || 'Untitled event') + '</div>' +
          '<div aria-hidden="true" style="display:flex;gap:3px">' + EV_STEPS.map((_, k) => '<span style="flex:1 1 0;height:4px;border-radius:999px;background:' + (k < j ? '#5b4ae8' : '#d5d8df') + '"></span>').join('') + '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span style="font-size:13px;font-weight:700;color:#454b55">Up next: ' + esc(EV_NAMES[x.evStep] || 'Event title') + '</span>' +
            '<span ' + on(() => resumeDraft(d)) + ' style="display:flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:13.5px;font-weight:800;cursor:pointer">Continue</span></div>' +
        '</div></div>';
    }).join('') + '</section>';

  // A 30-minute time list that opens under its field (not a sheet), scrolled to the current value
  const timeField = (key, value, opts, hint, pick) => {
    const open = state.timeOpen === key;
    const toggle = () => { setState({ timeOpen: open ? null : key }); if (!open) setTimeout(() => { const el = document.querySelector('[data-time-list] [data-cur]'); if (el) el.parentNode.scrollTop = el.offsetTop - 96; }, 0); };
    return '<div style="position:relative;min-width:0">' +
      '<div ' + on(toggle) + ' aria-label="' + esc(hint) + '" aria-expanded="' + open + '" style="display:flex;align-items:center;gap:10px;min-height:58px;padding:0 14px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 2px ' + (open ? '#5b4ae8' : '#dcdfe6') + ';cursor:pointer">' +
        '<span style="display:flex;color:' + (value ? '#5b4ae8' : '#9aa0ac') + '">' + svg(18, stroke('currentColor', 2.2), P5.clock) + '</span>' +
        '<span style="flex:1;min-width:0;' + (value ? 'font-size:17px;font-weight:800;color:#0d1117' : 'font-size:16.5px;font-weight:400;font-style:italic;color:#b9bcc4') + '">' + esc(value ? clock(value) : hint) + '</span>' +
        I.chevD(14, '#9aa0ac', 2.6) + '</div>' +
      (open ? '<div ' + on(() => setState({ timeOpen: null })) + ' aria-hidden="true" style="position:fixed;inset:0;z-index:19"></div>' +
        '<div data-time-list role="listbox" style="position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:20;max-height:236px;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 14px 34px rgba(15,18,25,.2), 0 0 0 1px #e6e7eb;padding:6px;display:flex;flex-direction:column;gap:2px">' +
          opts.map(v => '<div ' + on(() => pick(v), 'option') + ' aria-selected="' + (v === value) + '"' + (v === value ? ' data-cur' : '') + ' style="display:flex;align-items:center;justify-content:space-between;min-height:44px;padding:0 12px;border-radius:10px;flex:0 0 auto;font-size:16px;cursor:pointer;' +
            (v === value ? 'background:#f3f1fe;color:#5b4ae8;font-weight:900' : 'color:#0d1117;font-weight:700') + '"><span>' + clock(v) + '</span>' + (v === value ? I.check(16, '#5b4ae8', 3) : '') + '</div>').join('') + '</div>' : '') +
    '</div>';
  };
  const dateField = (value, label, hint, set, extra) => '<div style="position:relative;min-width:0;' + (extra || '') + '">' +
    '<input class="fld date-fld" type="date" aria-label="' + label + '" min="' + todayISO() + '" value="' + esc(value) + '"' + (value ? '' : ' data-empty') + ' ' + onInput(e => set(e.target.value)) +
      ' style="' + BIG + ';-webkit-appearance:none;appearance:none;height:58px;color-scheme:light;text-align:left">' +
    (value ? '' : '<span aria-hidden="true" style="' + HINT + '">' + hint + '</span>') + '</div>';
  const orLine = () => '<div style="padding:14px 4px 0;display:flex;align-items:center;gap:10px"><span style="flex:1;height:1px;background:#d5d8df"></span><span style="font-size:12px;font-weight:800;letter-spacing:1px;color:#8a909b">OR</span><span style="flex:1;height:1px;background:#d5d8df"></span></div>';
  const pollRow = (fn) => '<div style="padding-top:10px"><div ' + on(fn) + ' class="hov-fill" style="display:flex;align-items:center;gap:12px;min-height:52px;padding:0 14px;border-radius:14px;box-shadow:inset 0 0 0 1.5px #c9ccd3;color:#454b55;cursor:pointer">' +
    svg(16, stroke('currentColor', 2.2), POLL_IC) + '<span style="flex:1;font-size:15px;font-weight:800">Poll the group</span>' + I.chevR(14, '#b9bcc4', 2.6) + '</div></div>';
  const pollCard = (labels, edit, remove) => '<div data-poll style="background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08);padding:14px;display:flex;flex-direction:column;gap:8px">' +
    '<div style="display:flex;align-items:center;gap:10px">' + svg(16, stroke('#5b4ae8', 2.2), POLL_IC) + '<span style="flex:1;font-size:12px;font-weight:800;letter-spacing:1.1px;color:#5b4ae8">POLL · ' + labels.length + ' OPTIONS</span>' +
      '<span ' + on(edit) + ' style="font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span><span ' + on(remove) + ' style="font-size:13.5px;font-weight:800;color:#9b1c31;cursor:pointer">Remove</span></div>' +
    labels.map(l => '<div style="display:flex;align-items:center;min-height:40px;padding:0 12px;border-radius:12px;background:#f4f5f7;font-size:15px;font-weight:800;color:#0d1117">' + esc(l) + '</div>').join('') +
    '<span style="font-size:13px;line-height:1.4;font-weight:500;color:#6b7280">Neighbors vote once it’s posted. You pick the winner.</span></div>';
  const openPoll = (kind) => {
    const st = state, rows = kind === 'when'
      ? (st.evDatePoll ? st.evDatePoll.map(r => Object.assign({}, r)) : [{ d: st.evDate || '', t: st.evTime || '' }, { d: '', t: '' }])
      : (st.evSpotPoll ? st.evSpotPoll.map(r => Object.assign({}, r)) : [{ v: cleanTitle(st.locText) }, { v: '' }]);
    setState({ pollSheet: { kind, rows }, timeOpen: null });
  };
  const bitRows = (bits, set) => bits.map((v, k) => '<label style="display:flex;align-items:center;gap:10px;min-height:58px;padding:0 16px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 2px #dcdfe6;cursor:text">' +
    '<span aria-hidden="true" style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:' + (v.trim() ? '#0f7a3c' : '#c9ccd3') + '"></span>' +
    '<input class="bit-fld" type="text" maxlength="40" aria-label="Basic details, line ' + (k + 1) + '" placeholder="' + esc(BIT_PH[k]) + '" value="' + esc(v) + '" ' + onInput(e => { if (e.type === 'input') set(k, e.target.value.slice(0, 40)); }) +
      ' style="flex:1 1 auto;min-width:0;border:0;padding:0;background:transparent;font-family:inherit;font-size:17px;font-weight:800;color:#0d1117;outline:none">' +
    (v.length ? '<span style="font-size:11.5px;font-weight:700;color:#9aa0ac">' + v.length + '/40</span>' : '') + '</label>').join('');
  const blankJob = (item) => ({ item: item || '', desc: '', time: '', need: 1, shifts: null });
  const openJob = (i, row) => {
    setState({ needSheet: { i, row } });
    setTimeout(() => { const f = document.querySelector('[data-job-name]'); if (f) { f.focus(); const n = f.value.length; try { f.setSelectionRange(n, n); } catch (e) { /* ignore */ } } }, 60);
  };

  function viewCompose() {
    const st = state, cur = st.evStep, i = EV_STEPS.indexOf(cur), filled = evFilled(st), url = evPhotoUrl(st), title = cleanTitle(st.activity);
    const CLEAR = { when: { evDate: '', evTime: '', evEnd: '', evEndOn: false, evDatePoll: null }, where: { locText: '', locPlace: null, locSuggest: [], evSpotPoll: null }, details: { evBits: ['', '', ''] }, help: { evNeeds: [] } };
    const nextOf = (k) => EV_STEPS[EV_STEPS.indexOf(k) + 1] || 'review';
    const close = () => { if (title) setState({ evLeave: true, timeOpen: null }); else evExit(); };
    const later = (k) => Object.assign({}, st.evLater, { [k]: false });

    if (cur === 'review') {
      const card = (icon, label, has, act, step, inner) => '<div style="background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08);padding:14px 16px;display:flex;flex-direction:column;gap:10px">' +
        '<div style="display:flex;align-items:center;gap:10px"><span style="flex:0 0 20px;display:flex;color:' + (has ? '#0f7a3c' : '#b07a0a') + '">' + svg(18, stroke('currentColor', 2.2), icon) + '</span>' +
          '<span style="flex:1;font-size:12px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#6b7280">' + label + '</span>' +
          '<span ' + on(() => evGo(step)) + ' aria-label="' + (has ? 'Edit ' : 'Add ') + label.toLowerCase() + '" style="font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">' + (has ? 'Edit' : 'Add') + '</span></div>' +
        '<div style="padding-left:28px">' + inner + '</div></div>';
      const main = (t, has, sub) => '<div style="font-size:15px;line-height:1.3;font-weight:800;color:' + (has ? '#0d1117' : AMBER_INK) + ';text-wrap:pretty">' + esc(t) + '</div>' +
        (sub ? '<div style="margin-top:2px;font-size:13.5px;line-height:1.35;font-weight:500;color:#6b7280">' + esc(sub) + '</div>' : '');
      const list = (rows) => rows.map((r, k) => '<div style="display:flex;align-items:baseline;gap:10px;padding:8px 0;border-top:' + (k ? '1px solid #f2f3f6' : '0') + '">' + r + '</div>').join('');
      const bits = st.evBits.map(b => b.trim()).filter(Boolean), place = cleanTitle(st.locText);
      const groups = evGroupIds(st), names = groups.map(id => (groupById(id) || {}).name).filter(Boolean), gOpen = st.menu === 'evGroups', g0 = groupById(groups[0]);
      const tile = (priv, label, sub, icon) => { const onIt = !!st.evPriv === priv;
        return '<div ' + on(() => setState({ evPriv: priv }), 'radio') + ' aria-checked="' + onIt + '" style="flex:1 1 0;display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:14px;cursor:pointer;' + (onIt ? 'background:#f3f1fe;box-shadow:inset 0 0 0 2px #5b4ae8' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6') + '">' +
          '<span style="display:flex;color:' + (onIt ? '#5b4ae8' : '#454b55') + '">' + svg(22, stroke('currentColor', 2.2), icon) + '</span>' +
          '<span style="font-size:15px;font-weight:900;color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + label + '</span><span style="font-size:12.5px;line-height:1.35;font-weight:600;color:#6b7280">' + sub + '</span></div>'; };
      const busy = st.busy === 'post';
      return '<div class="overlay-screen" data-screen-label="New spark"><div style="min-height:100%;display:flex;flex-direction:column">' +
        '<div style="position:relative;flex:0 0 auto;height:210px;background:' + (url ? '#2b303a ' + bg(url) : EV_GRAD) + '">' +
          '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.9) 0%, rgba(13,17,23,.2) 60%, rgba(13,17,23,.3) 100%)"></div>' +
          '<span ' + on(() => evGo('help')) + ' aria-label="Back" style="position:absolute;top:14px;left:14px;width:40px;height:40px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.12);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.chevL(14, '#0d1117', 2.6) + '</span>' +
          '<label style="position:absolute;top:16px;right:14px;z-index:2;display:flex;align-items:center;gap:6px;min-height:38px;padding:0 13px;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(13,17,23,.25);font-size:13px;font-weight:800;color:#0d1117;cursor:pointer">' +
            svg(15, stroke('currentColor', 2.2), CAMERA) + (url ? 'Change photo' : 'Add a cover photo') + photoInput('Cover photo') + '</label>' +
          '<div style="position:absolute;left:18px;right:18px;bottom:14px;color:#fff"><div style="font-size:12px;font-weight:900;letter-spacing:1px;color:#e4dfff">LOOKS GOOD</div>' +
            '<div ' + on(() => evGo('title')) + ' aria-label="Edit the title" style="margin-top:2px;display:flex;align-items:flex-end;gap:10px;cursor:pointer"><span style="font-size:30px;line-height:1.05;font-weight:900;letter-spacing:-.8px;text-wrap:balance;overflow-wrap:anywhere">' + esc(title) + '</span>' +
              svg(18, stroke('#fff', 2.3) + ' style="flex:0 0 18px;margin-bottom:6px;opacity:.85"', PENCIL) + '</div></div>' +
        '</div>' +
        '<div style="padding:16px 14px 0;display:flex;flex-direction:column;gap:18px"><div style="display:flex;flex-direction:column;gap:10px">' +
          card(P6.cal, 'Date &amp; time', filled.when, '', 'when', st.evDatePoll ? main('Poll: ' + st.evDatePoll.length + ' dates', true, 'Neighbors vote, you pick') : st.evDate ? main(dayLabel(st.evDate, st.evTime, st.evEnd), true) : main('Date to be decided', false)) +
          card(P6.pin, 'Location', filled.where, '', 'where', st.evSpotPoll ? main('Poll: ' + st.evSpotPoll.length + ' spots', true, 'Neighbors vote, you pick') : place ? main(place, true, st.locPlace ? st.locPlace.address : '') : main('Location to be decided', false)) +
          card(LINES_IC, 'Basic details', filled.details, '', 'details', bits.length ? list(bits.map(t => '<span style="flex:0 0 6px;width:6px;height:6px;border-radius:999px;background:#0f7a3c;transform:translateY(-2px)"></span><span style="font-size:15.5px;line-height:1.35;font-weight:800;color:#0d1117;text-wrap:pretty">' + esc(t) + '</span>')) : main('Basic details to be decided', false)) +
          card(HAND_IC, 'How people can help', filled.help, '', 'help', st.evNeeds.length ? list(st.evNeeds.map(j => '<span style="flex:1;min-width:0;font-size:15.5px;line-height:1.35;font-weight:800;color:#0d1117;text-wrap:pretty">' + esc(cleanTitle(j.item)) + '</span><span style="flex:0 0 auto;font-size:13px;font-weight:700;color:#6b7280">' + esc(jobMeta(j)) + '</span>')) : main('Help to be decided', false)) +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px"><div style="padding:0 4px;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117">Who can see it</div>' +
          '<div style="background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08)"><div data-menu style="position:relative">' +
            '<div ' + on((e) => { stop(e); setState({ menu: gOpen ? null : 'evGroups' }); }) + ' aria-label="Post to" aria-expanded="' + gOpen + '" style="display:flex;align-items:center;gap:12px;min-height:58px;padding:10px 14px;cursor:pointer">' +
              '<span aria-hidden="true" style="flex:0 0 36px;width:36px;height:36px;border-radius:11px;background:' + groupBg(g0, '#f3f1fe') + '"></span>' +
              '<div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:#8a909b">Post to</div><div style="font-size:15px;font-weight:800;color:#0d1117">' + esc(namesList(names)) + '</div></div>' +
              (myGroups().length > 1 ? '<span style="font-size:13px;font-weight:800;color:#5b4ae8">Choose</span>' : '') + '</div>' +
            (gOpen && myGroups().length > 1 ? '<div style="position:absolute;left:12px;right:12px;top:60px;z-index:20;background:#fff;border-radius:16px;box-shadow:0 12px 32px rgba(15,18,25,.18), 0 0 0 1px #e6e7eb;padding:6px">' +
              groupsInOrder().map(g => groupCheck(g, groups.indexOf(g.id) > -1, (e) => { stop(e); const nx = groups.indexOf(g.id) > -1 ? groups.filter(x => x !== g.id) : groups.concat(g.id); setState({ evGroups: nx.length ? nx : groups }); })).join('') + '</div>' : '') +
          '</div><div style="padding:12px 14px 14px;border-top:1px solid #f2f3f6;display:flex;gap:8px">' +
            tile(false, 'Public', 'Everyone in your groups', PEOPLE_IC) + tile(true, 'Private', 'Only people you invite', LOCK_IC) + '</div></div></div>' +
        '</div>' +
        '<div style="position:sticky;bottom:0;margin-top:auto;padding:16px 14px;background:linear-gradient(to top,#e8eaee 70%,rgba(232,234,238,0))">' +
          '<button type="button" ' + on(() => { if (!busy) createEvent(); }) + ' aria-disabled="' + busy + '" style="position:relative;overflow:hidden;width:100%;min-height:56px;border:0;border-radius:999px;background:#149a4b;color:#fff;font-family:inherit;font-size:17px;font-weight:900;cursor:pointer;box-shadow:0 10px 24px rgba(20,154,75,.32)' + (busy ? ';opacity:.72;cursor:wait' : '') + '">' +
            ['#ffd98a:6%:18%', '#cfc9ff:22%:68%', '#fff:78%:28%', '#ffb3c1:88%:64%', '#b8f0cd:62%:74%', '#ffd98a:40%:20%'].map(c => { const [col, x, y] = c.split(':'); return '<span aria-hidden="true" style="position:absolute;left:' + x + ';top:' + y + ';width:6px;height:6px;border-radius:2px;background:' + col + ';transform:rotate(30deg);opacity:.9"></span>'; }).join('') +
            '<span style="position:relative">' + (busy ? 'Posting…' : 'Post it') + '</span></button>' +
          '<button type="button" ' + on(saveDraft) + ' style="margin-top:12px;width:100%;min-height:50px;background:transparent;border:2px solid #c9ccd3;border-radius:999px;font-family:inherit;font-size:15.5px;font-weight:800;color:#0d1117;cursor:pointer">' + (st.busy === 'draft' ? 'Saving…' : 'Save as draft') + '</button>' +
        '</div></div></div>';
    }

    const head = (t, sub) => '<div style="padding:26px 18px 0"><h2 style="margin:0;font-size:24px;line-height:1.05;font-weight:900;letter-spacing:-.8px;color:#0d1117">' + t + '</h2>' +
      (sub ? '<p style="margin:8px 0 0;font-size:14.5px;line-height:1.4;font-weight:500;color:#5c6270;text-wrap:pretty">' + sub + '</p>' : '') + '</div>';
    const pad = (inner) => '<div style="padding:12px 16px 0;display:flex;flex-direction:column;gap:10px">' + inner + '</div>';
    let body = '';
    if (cur === 'title') {
      body = head('Event title') + pad(
        '<input class="fld big-fld" type="text" maxlength="40" aria-label="Event title" placeholder="e.g. Fall yard cleanup" value="' + esc(st.activity) + '" ' + onInput(e => { if (e.type === 'input') setState({ activity: e.target.value.slice(0, 40) }); }) + ' style="' + BIG + '">' +
        (url
          ? '<div style="display:flex;align-items:center;gap:12px;padding:8px 14px 8px 8px;border-radius:16px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08)"><span aria-hidden="true" style="flex:0 0 56px;width:56px;height:42px;border-radius:10px;background:' + bg(url) + '"></span>' +
              '<span style="flex:1;font-size:15px;font-weight:800;color:#0d1117">Cover photo added</span><label style="font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Change' + photoInput('Change the cover photo') + '</label></div>'
          : '<label class="hov-drop" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:118px;border-radius:16px;border:2px dashed #b9bcc4;background:#f4f5f7;cursor:pointer">' +
              svg(30, stroke('#5b4ae8', 2), '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5"/><path d="M12 12v8M9 15l3-3 3 3"/>') +
              '<span style="font-size:15px;font-weight:800;color:#0d1117">Upload a cover photo</span><span style="font-size:12.5px;font-weight:600;color:#6b7280">JPG or PNG · Optional</span>' + photoInput('Upload a cover photo') + '</label>'));
    } else if (cur === 'when') {
      const setD = (v) => setState({ evDate: v });
      body = head('Date &amp; time') + (st.evDatePoll
        ? pad(pollCard(st.evDatePoll.map(r => dayLabel(r.d, r.t) || 'Date'), () => openPoll('when'), () => setState({ evDatePoll: null })))
        : pad(dateField(st.evDate, 'Date', 'Pick a date', setD) +
            timeField('start', st.evTime, EV_TIMES, 'Add a start time (optional)', (v) => setState({ evTime: v, evEnd: st.evEnd && st.evEnd <= v ? '' : st.evEnd, timeOpen: null })) +
            (st.evTime && st.evEndOn
              ? '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0">' + timeField('end', st.evEnd, EV_TIMES.filter(v => v > st.evTime), 'Add an end time', (v) => setState({ evEnd: v, timeOpen: null })) + '</div>' +
                  '<span ' + on(() => setState({ evEndOn: false, evEnd: '', timeOpen: null })) + ' aria-label="Remove end time" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.1);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(12, '#6b7280', 2.8) + '</span></div>'
              : st.evTime ? '<span ' + on(() => setState({ evEndOn: true, timeOpen: 'end' })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:40px;padding:0 4px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(14, 'currentColor', 2.6) + 'Add end time</span>' : '')) +
          '<div style="padding:0 16px">' + orLine() + pollRow(() => openPoll('when')) + '</div>');
    } else if (cur === 'where') {
      body = head('Location') + (st.evSpotPoll
        ? pad(pollCard(st.evSpotPoll.map(r => r.v), () => openPoll('where'), () => setState({ evSpotPoll: null })))
        : pad(placeField('loc', { placeholder: 'Search a place or address', style: BIG, cls: 'fld big-fld' })) +
          '<div style="padding:0 16px">' + orLine() + pollRow(() => openPoll('where')) + '</div>');
    } else if (cur === 'details') {
      body = head('Basic details', 'Up to three quick notes on what to expect or the vibe.') +
        '<div style="padding:12px 16px 0;display:flex;flex-direction:column;gap:8px">' + bitRows(st.evBits, (k, v) => { const b = state.evBits.slice(); b[k] = v; setState({ evBits: b }); }) + '</div>';
    } else if (cur === 'help') {
      const chip = (label, fn, dashed) => '<span ' + on(fn) + ' style="display:flex;align-items:center;gap:5px;min-height:38px;padding:0 13px;border-radius:999px;font-size:14px;font-weight:800;cursor:pointer;' +
        (dashed ? 'border:1.5px dashed #b9bcc4;color:#454b55' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;color:#0d1117') + '"><span style="color:#5b4ae8;font-size:16px;line-height:1">+</span>' + label + '</span>';
      const eg = (t) => '<span style="display:flex;align-items:center;gap:9px;font-size:14.5px;font-weight:600;font-style:italic;color:#6b7280"><span style="flex:0 0 5px;width:5px;height:5px;border-radius:999px;background:#b9bcc4"></span>' + t + '</span>';
      body = head('How people can help', 'Jobs to do or things to bring.') +
        '<div style="padding:12px 16px 0;display:flex;flex-wrap:wrap;gap:6px">' +
          [['Bring', 'Bring '], ['Set up', 'Set up '], ['Help with', 'Help with '], ['Clean up', 'Clean up ']].map(([l, p]) => chip(l, () => openJob(null, blankJob(p)))).join('') +
          chip('Something else', () => openJob(null, blankJob('')), true) + '</div>' +
        (st.evNeeds.length ? '' : '<div style="margin:14px 16px 0;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.55);display:flex;flex-direction:column;gap:6px"><span style="font-size:11.5px;font-weight:800;letter-spacing:1.1px;color:#8a909b">FOR EXAMPLE</span>' +
          eg('Bring a folding table') + eg('Set up the grill') + eg('Help with parking') + eg('Clean up the yard') + '</div>') +
        '<div style="padding:12px 14px 0;display:flex;flex-direction:column;gap:8px">' + st.evNeeds.map((j, k) => {
          const edit = () => openJob(k, JSON.parse(JSON.stringify(j)));
          return '<div data-job="' + esc(cleanTitle(j.item)) + '" style="background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08);padding:12px 8px 12px 14px;display:flex;align-items:center;gap:8px">' +
            '<div ' + on(edit) + ' style="flex:1;min-width:0;cursor:pointer"><div style="font-size:15.5px;font-weight:800;color:#0d1117;text-wrap:pretty">' + esc(cleanTitle(j.item)) + '</div>' +
              '<div style="margin-top:2px;font-size:13px;font-weight:700;color:#454b55">' + esc(jobMeta(j)) + '</div>' +
              (j.desc ? '<div style="margin-top:3px;font-size:13px;line-height:1.4;font-weight:500;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(j.desc) + '</div>' : '') + '</div>' +
            '<span ' + on(edit) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 10px;font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span>' +
            '<span ' + on(() => setState({ evNeeds: state.evNeeds.filter((_, x) => x !== k) })) + ' aria-label="Remove ' + esc(cleanTitle(j.item)) + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#f4f5f7;display:flex;align-items:center;justify-content:center;cursor:pointer">' + svg(15, stroke('#9b1c31', 2.2), TRASH_IC) + '</span></div>';
        }).join('') + '</div>';
    }

    const ok = filled[cur];
    const next = () => { if (!ok) return; evGo(nextOf(cur), { evLater: later(cur) }); };
    const skip = () => evGo(nextOf(cur), Object.assign({}, CLEAR[cur] || {}, { evLater: Object.assign({}, st.evLater, { [cur]: true }) }));
    return '<div class="overlay-screen" data-screen-label="New spark"><div style="display:flex;flex-direction:column;min-height:100%">' +
      '<div style="position:relative;flex:0 0 auto;height:' + (cur === 'title' ? 270 : 200) + 'px;transition:height 240ms ease;background:' + (url ? '#2b303a ' + bg(url) : EV_GRAD) + '">' +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top,rgba(13,17,23,.88),rgba(13,17,23,.12) 55%,rgba(13,17,23,.4))"></div>' +
        '<div style="position:absolute;left:0;right:0;top:0;z-index:2"><div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;padding:12px 16px">' +
          '<div style="display:flex"><span ' + on(close) + ' aria-label="Close" style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;cursor:pointer">' + DARK_X + '</span></div>' +
          '<span style="font-size:14.5px;font-weight:800;color:#fff">' + (i + 1) + ' of ' + EV_STEPS.length + '</span><div></div></div>' +
          '<div aria-hidden="true" style="height:4px;background:rgba(255,255,255,.22)"><div style="width:' + ((i + 1) / EV_STEPS.length * 100) + '%;height:100%;background:#fff;border-radius:0 999px 999px 0;transition:width 240ms ease"></div></div></div>' +
        '<div style="position:absolute;left:18px;right:18px;bottom:30px;z-index:1;color:#fff"><div style="font-size:11.5px;font-weight:900;letter-spacing:1.2px;color:#ffe7b3">CREATE EVENT</div>' +
          '<div style="margin-top:2px;font-size:' + (cur === 'title' ? 30 : 24) + 'px;line-height:1.05;font-weight:900;letter-spacing:-.7px;color:' + (title ? '#fff' : 'rgba(255,255,255,.55)') + ';overflow-wrap:anywhere;text-wrap:balance">' + esc(title || 'Your event') + '</div></div>' +
      '</div>' +
      '<div style="margin-top:-16px;position:relative;z-index:1;flex:1 1 auto;display:flex;flex-direction:column;background:#e8eaee;border-radius:20px 20px 0 0">' + body +
        '<div style="margin-top:auto;padding:14px 16px 20px;display:flex;flex-direction:column;gap:4px">' +
          (i > 0 ? '<div style="display:flex;justify-content:center;padding-bottom:4px"><span ' + on(skip) + ' data-later style="display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:999px;color:#6b7280;font-size:14.5px;font-weight:700;cursor:pointer">Decide later' + I.chevR(13, 'currentColor', 2.8) + '</span></div>' : '') +
          '<div style="display:flex;gap:8px">' +
            (i > 0 ? '<button type="button" ' + on(() => evGo(EV_STEPS[i - 1])) + ' style="flex:0 0 auto;min-height:54px;padding:0 22px;background:transparent;border:2px solid #c9ccd3;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;color:#0d1117;cursor:pointer">Back</button>' : '') +
            '<button type="button" ' + on(next) + ' aria-disabled="' + !ok + '" style="flex:1 1 auto;min-width:0;min-height:54px;border:0;border-radius:999px;background:' + (ok ? '#5b4ae8' : '#d5d8df') + ';color:#fff;font-family:inherit;font-size:16.5px;font-weight:800;cursor:' + (ok ? 'pointer' : 'default') + '">' + (cur === 'help' ? 'Review' : 'Next') + '</button>' +
          '</div></div>' +
      '</div></div></div>';
  }

  // A group row with a checkbox (Post to, Who can see it)
  const groupCheck = (g, onIt, pick, note, noteHtml) => '<div ' + on(pick, 'checkbox') + ' aria-checked="' + onIt + '" style="display:flex;align-items:center;gap:10px;min-height:46px;padding:9px 12px;border-radius:12px;background:' + (onIt ? '#f3f1fe' : 'transparent') + ';cursor:pointer">' +
    '<span aria-hidden="true" style="flex:0 0 20px;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;' + (onIt ? 'background:#5b4ae8' : 'background:#fff;box-shadow:inset 0 0 0 2px #c9ccd3') + '">' + (onIt ? I.check(12, '#fff', 3.4) : '') + '</span>' +
    '<span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + esc(g.name) + '</span>' + (note ? '<span style="font-size:12.5px;font-weight:700;color:#8a909b">' + note + '</span>' : '') + (noteHtml || '') + '</div>';

  // The flow's sheets: Poll the group, Add a job, Save this as a draft? (one at a time, never stacked)
  const stepper = (n, set, label) => '<div style="flex:0 0 auto;display:flex;align-items:center;gap:8px">' +
    '<span ' + on(() => set(Math.max(1, (n || 1) - 1))) + ' aria-label="Fewer' + (label ? ' for ' + label : '') + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#0d1117;font-size:18px;font-weight:800;line-height:1">−</span>' +
    '<span style="min-width:22px;text-align:center;font-size:16px;font-weight:900;color:#0d1117">' + (n || 'Any') + '</span>' +
    '<span ' + on(() => set(Math.min(99, (n || 0) + 1))) + ' aria-label="More' + (label ? ' for ' + label : '') + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#0d1117;font-size:18px;font-weight:800;line-height:1">+</span></div>';
  const timeSelect = (value, opts, hint, set, label) => '<div style="position:relative;flex:1 1 0;min-width:0"><select class="fld" aria-label="' + label + '" ' + onInput(e => set(e.target.value)) +
    ' style="' + BIG + ';min-height:52px;height:52px;padding:0 10px;font-size:15px;-webkit-appearance:none;appearance:none;color-scheme:light;' + (value ? '' : 'color:#b9bcc4;font-weight:400;font-style:italic') + '">' +
    '<option value="">' + hint + '</option>' + opts.map(v => '<option value="' + v + '"' + (v === value ? ' selected' : '') + '>' + clock(v) + '</option>').join('') + '</select></div>';
  const SHEET_PAD = 'padding:10px 18px calc(24px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:14px;max-height:88%;overflow-y:auto';
  const sheetHead = (eyebrow, title, sub, close) => '<div style="display:flex;align-items:flex-start;gap:10px"><div style="flex:1;min-width:0">' +
    (eyebrow ? '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280">' + eyebrow + '</div>' : '') +
    '<div style="margin-top:' + (eyebrow ? 2 : 0) + 'px;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.4px;color:#0d1117">' + title + '</div>' +
    (sub ? '<div style="margin-top:4px;font-size:14px;line-height:1.4;font-weight:500;color:#5c6270">' + sub + '</div>' : '') + '</div>' + closeX(close, 'flex:0 0 36px;width:36px;height:36px') + '</div>';
  const saveBtn = (ok, fn, label) => '<button type="button" ' + on(() => { if (ok) fn(); }) + ' aria-disabled="' + !ok + '" style="min-height:52px;border:0;border-radius:999px;background:' + (ok ? '#5b4ae8' : '#d5d8df') + ';color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:' + (ok ? 'pointer' : 'default') + '">' + (label || 'Save') + '</button>';

  function viewComposeSheets() {
    const st = state;
    if (st.pollSheet) {
      const p = st.pollSheet, when = p.kind === 'when', close = () => setState({ pollSheet: null });
      const setRow = (k, patch) => setState({ pollSheet: Object.assign({}, state.pollSheet, { rows: state.pollSheet.rows.map((r, j) => j === k ? Object.assign({}, r, patch) : r) }) });
      const valid = when ? p.rows.filter(r => r.d) : p.rows.filter(r => cleanTitle(r.v || ''));
      const rm = (k) => () => { if (p.rows.length <= 2) setRow(k, when ? { d: '', t: '' } : { v: '' }); else setState({ pollSheet: Object.assign({}, p, { rows: p.rows.filter((_, j) => j !== k) }) }); };
      const rmBtn = (k) => '<span ' + on(rm(k)) + ' aria-label="Remove option ' + (k + 1) + '" style="flex:0 0 32px;width:32px;height:32px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(12, '#6b7280', 2.8) + '</span>';
      const save = () => {
        if (valid.length < 2) { toast('Add at least two options'); return; }
        if (when) setState({ pollSheet: null, evDatePoll: valid.map(r => ({ d: r.d, t: r.t || '' })), evDate: '', evTime: '', evEnd: '', evEndOn: false, evLater: Object.assign({}, st.evLater, { when: false }) });
        else setState({ pollSheet: null, evSpotPoll: valid.map(r => ({ v: cleanTitle(r.v).slice(0, 80) })), locText: '', locPlace: null, locSuggest: [], evLater: Object.assign({}, st.evLater, { where: false }) });
      };
      return sheet('Poll the group', close, SHEET_PAD,
        sheetHead(when ? 'Date &amp; time' : 'Location', 'Create a poll', when ? 'Add a few options. Everyone votes, and you pick the winner.' : 'Add a few spots. Everyone votes, and you pick the winner.', close) +
        '<div style="display:flex;flex-direction:column;gap:8px">' + p.rows.map((r, k) => '<div style="display:flex;align-items:center;gap:8px">' +
          (when ? dateField(r.d, 'Date option ' + (k + 1), 'Date', (v) => setRow(k, { d: v }), 'flex:1.4 1 0') + timeSelect(r.t, EV_TIMES, 'Time', (v) => setRow(k, { t: v }), 'Time option ' + (k + 1))
            : '<input class="fld" type="text" maxlength="80" aria-label="Place option ' + (k + 1) + '" placeholder="Add a place" value="' + esc(r.v || '') + '" ' + onInput(e => { if (e.type === 'input') setRow(k, { v: e.target.value.slice(0, 80) }); }) + ' style="' + BIG + ';min-height:54px;flex:1 1 auto">') +
          rmBtn(k) + '</div>').join('') + '</div>' +
        (p.rows.length < 5 ? '<span ' + on(() => setState({ pollSheet: Object.assign({}, p, { rows: p.rows.concat([when ? { d: '', t: '' } : { v: '' }]) }) })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:36px;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(14, 'currentColor', 2.6) + (when ? 'Add another option' : 'Add another spot') + '</span>' : '') +
        saveBtn(valid.length >= 2, save), 36);
    }
    if (st.needSheet) {
      const ns = st.needSheet, r = ns.row, close = () => setState({ needSheet: null });
      const set = (patch) => setState({ needSheet: Object.assign({}, state.needSheet, { row: Object.assign({}, state.needSheet.row, patch) }) });
      const save = () => {
        const row = Object.assign({}, r, { item: cleanTitle(r.item).slice(0, 60), desc: (r.desc || '').trim().slice(0, 400) });
        if (row.shifts) { row.shifts = row.shifts.filter(q => q.time); if (!row.shifts.length) row.shifts = null; }
        const list = state.evNeeds.slice();
        if (ns.i != null) list[ns.i] = row; else list.push(row);
        setState({ evNeeds: list, needSheet: null });
      };
      return sheet('Add a job', close, SHEET_PAD,
        sheetHead('How people can help', ns.i != null ? 'Edit job' : 'Add a job', '', close) + jobFields(r, set) + saveBtn(!!cleanTitle(r.item), save), 36);
    }
    if (st.evLeave) {
      const close = () => setState({ evLeave: false });
      return sheet('Save as draft', close, SHEET_PAD,
        sheetHead('', 'Save this as a draft?', 'Pick up right where you left off. Only you can see drafts.', close) +
        '<button type="button" ' + on(saveDraft) + ' style="min-height:52px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer">' + (st.busy === 'draft' ? 'Saving…' : 'Save draft') + '</button>' +
        '<button type="button" ' + on(close) + ' style="min-height:48px;background:#fff;border:1.5px solid #dcdfe6;border-radius:999px;font-family:inherit;font-size:15.5px;font-weight:800;color:#0d1117;cursor:pointer">Keep going</button>' +
        '<button type="button" ' + on(() => { setState({ evLeave: false }); evExit(); }) + ' style="min-height:44px;background:transparent;border:0;font-family:inherit;font-size:15px;font-weight:800;color:#9b1c31;cursor:pointer">Discard</button>', 36);
    }
    return '';
  }

  // A job's fields (Add a job, Edit what you need): name, details, then one time with a head count, or shifts
  const jobFields = (r, set, idx) => {
    const tag = idx == null ? '' : ' ' + (idx + 1);
    const setShift = (k, patch) => set({ shifts: r.shifts.map((q, j) => j === k ? Object.assign({}, q, patch) : q) });
    return '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<input class="fld" type="text" maxlength="60"' + (idx == null ? ' data-job-name' : '') + ' aria-label="Job name' + tag + '" placeholder="What you need, e.g. Bring a case of water" value="' + esc(r.item) + '" ' + onInput(e => { if (e.type === 'input') set({ item: e.target.value.slice(0, 60) }); }) + ' style="' + BIG + ';min-height:52px;font-size:16px">' +
      '<textarea class="fld" rows="2" maxlength="400" aria-label="Details' + tag + '" placeholder="Details (optional)" ' + onInput(e => { if (e.type === 'input') set({ desc: e.target.value.slice(0, 400) }); }) + ' style="' + BIG + ';min-height:52px;padding:12px 16px;font-size:16px;font-weight:500;line-height:1.4;resize:none">' + esc(r.desc || '') + '</textarea>' +
      (r.shifts
        ? r.shifts.map((q, k) => '<div data-shift-row style="display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:14px;background:#fff;box-shadow:inset 0 0 0 1.5px #eef0f3">' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              timeSelect(q.time, EV_TIMES, 'Start', (v) => setShift(k, { time: v, end: q.end && q.end <= v ? '' : q.end }), 'Shift ' + (k + 1) + ' start') +
              '<span aria-hidden="true" style="font-weight:800;color:#9aa0ac">–</span>' +
              timeSelect(q.end, EV_TIMES.filter(v => !q.time || v > q.time), 'End', (v) => setShift(k, { end: v }), 'Shift ' + (k + 1) + ' end') +
              '<span ' + on(() => set({ shifts: r.shifts.length > 1 ? r.shifts.filter((_, j) => j !== k) : null, time: r.shifts.length > 1 ? r.time : q.time, need: r.shifts.length > 1 ? r.need : q.need })) + ' aria-label="Remove shift ' + (k + 1) + '" style="flex:0 0 28px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(13, '#6b7280', 2.8) + '</span></div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span style="font-size:13px;font-weight:800;color:#6b7280">People needed</span>' + stepper(q.need, (n) => setShift(k, { need: n }), 'shift ' + (k + 1)) + '</div></div>').join('') +
          '<span ' + on(() => set({ shifts: r.shifts.concat([{ time: '', end: '', need: 1 }]) })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:36px;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(14, 'currentColor', 2.6) + 'Add a shift</span>' +
          '<span ' + on(() => set({ shifts: null, time: r.shifts[0].time, need: r.shifts[0].need || 1 })) + ' style="align-self:flex-start;display:flex;align-items:center;min-height:32px;font-size:13.5px;font-weight:700;color:#6b7280;cursor:pointer">Use one time instead</span>'
        : '<div style="display:flex;align-items:center;gap:10px">' + timeSelect(r.time, EV_TIMES, 'Time (optional)', (v) => set({ time: v }), 'Time' + tag) + stepper(r.need, (n) => set({ need: n }), 'how many people') + '</div>' +
          '<span ' + on(() => set({ shifts: [{ time: r.time || '', end: '', need: r.need || 1 }, { time: '', end: '', need: r.need || 1 }] })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:32px;font-size:13.5px;font-weight:700;color:#6b7280;cursor:pointer">' + svg(14, stroke('currentColor', 2.4), P5.clock) + 'Add a shift</span>') +
    '</div>';
  };

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
      const emailOk = EMAIL_OK.test(st.loginEmail.trim()), withGoogle = GOOGLE_ON;
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
          ? { title: 'Set the date', hint: 'Pick a day and time.', cta: 'Set date' }
          : { title: 'Set the location', hint: 'Start typing and pick a place, or just write it in.', ph: 'Enter the location', cta: 'Set location' })
        : (kind === 'day'
          ? { title: 'Suggest a date', hint: 'Pick a day and time. It goes on the idea for everyone to vote on, and the lead picks.', cta: 'Suggest this date' }
          : { title: 'Suggest a location', hint: 'Somewhere this could actually happen. Everyone can vote on it, and the lead picks.', ph: 'e.g. the loop trail at the lake', cta: 'Suggest this location' });
    const ready = st.offerText.trim().length > 0 && !st.busy;
    const close = () => setState({ offerKind: null, offerText: '', offerPlace: null, offerSuggest: [] });
    let field;
    if (kind === 'day') {
      field = '<input class="fld" type="datetime-local" aria-label="Date and time" min="' + todayISO() + 'T00:00" value="' + esc(st.offerText) + '" ' + onInput(e => setState({ offerText: e.target.value })) +
        ' style="width:100%;min-height:52px;' + FIELD.replace('padding:13px 16px', 'padding:12px 14px') + ';color-scheme:light">';
    } else if (kind === 'spot') {
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
      h3('Join a group') + para('Got a code from an organizer? Enter it here.') +
      '<input class="fld" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Group code" placeholder="ABC123" value="' + esc(st.joinCode) + '" ' +
        onInput(e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); if (e.target.value !== v) e.target.value = v; setState({ joinCode: v, joinBad: false }); }) +
        ' style="' + FIELD + ';padding:14px 16px;font-size:24px;font-weight:800;letter-spacing:8px;text-align:center;text-transform:uppercase">' +
      (st.joinBad ? '<div role="alert" style="font-size:14px;line-height:1.4;font-weight:700;color:#9b1c31">That code didn’t match a group. Check it with your organizer.</div>' : '') +
      '<button type="button" ' + on(submitJoin) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">' + (st.busy === 'join' ? 'Joining…' : 'Join') + '</button>' +
      '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Organizers find their group’s code in its settings, and can share it as a link too.</p>',
      { z: 31, max: 330 });
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
        '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Until you confirm, you keep signing in with ' + esc(st.email) + '.</p>', { z: 45 });
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
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:800;color:#454b55">Place</span>' +
        '<input class="fld" type="text" maxlength="40" placeholder="e.g. East Austin" value="' + esc(pe.place || '') + '" ' + onInput(e => setPe({ place: e.target.value.slice(0, 40) })) + ' style="' + FIELD + '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:800;color:#454b55">About you</span>' +
        '<textarea class="fld" rows="3" maxlength="160" placeholder="A line or two: what you’re up for, what you bring" ' + onInput(e => setPe({ bio: e.target.value.slice(0, 160) })) + ' style="' + FIELD + ';resize:none;line-height:1.4">' + esc(pe.bio || '') + '</textarea></label>' +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:800;color:#454b55">Email</span>' +
        (st.isGoogle
          ? '<div style="' + FIELD + ';background:#f7f7f9;border-color:#f2f3f6;color:#6b7280;overflow-wrap:anywhere">' + esc(st.email) + '</div><span style="font-size:13px;line-height:1.4;font-weight:500;color:#6b7280">From your Google account.</span>'
          : '<input class="fld" type="email" inputmode="email" autocomplete="email" maxlength="80" value="' + esc(pe.email) + '" ' + onInput(e => setPe({ email: e.target.value.slice(0, 80) })) + ' style="' + FIELD + '">' +
            '<span style="font-size:13px;line-height:1.4;font-weight:500;color:#6b7280">Change it and we’ll send a code to the new address.</span>') +
      '</label>' +
      '<button type="button" ' + on(() => { if (ok) savePe(); }) + ' aria-disabled="' + !ok + '" style="' + btn(ok) + '">' + (busy ? 'Saving…' : changed ? 'Save and send code' : 'Save') + '</button>', { z: 45 });
  }

  function viewConfirm() {
    const c = state.confirm;
    return modal(c.title, null,
      '<h3 style="margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + esc(c.title) + '</h3>' +
      '<p style="margin:0;font-size:15px;line-height:1.45;font-weight:500;color:#454b55">' + esc(c.body) + '</p>' +
      '<div style="margin-top:4px;display:flex;flex-direction:column;gap:8px">' +
        '<button type="button" ' + on(() => { if (!state.busy) c.run(); }) + ' style="' + primary(true) + ';background:' + (c.danger ? '#9b1c31' : c.green ? '#0f7a3c' : '#5b4ae8') + '">' + esc(c.cta) + '</button>' +
        '<button type="button" ' + on(() => setState({ confirm: null })) + ' style="' + SECONDARY + '">' + esc(c.keep) + '</button>' +
      '</div>',
      { z: 34, role: 'alertdialog', max: 330 });
  }

  // A bottom sheet (Your groups, Members): slides up over a fading scrim; tapping the scrim closes it
  const sheet = (label, close, style, inner, z) => '<div class="sheet-scrim" data-scrim="' + reg(close) + '"' + (z ? ' style="z-index:' + z + '"' : '') + '>' +
    '<div role="dialog" aria-modal="true" aria-label="' + esc(label) + '" data-screen-label="' + esc(label) + '" class="sheet" style="' + style + '">' +
      '<div style="width:40px;height:5px;border-radius:999px;background:#dcdfe6;margin:0 auto 12px"></div>' + inner +
    '</div></div>';

  // Members of a group you run. Owners (up to two) set roles; admins see them
  function viewMembers() {
    const st = state, g = groupById(st.membersOpen), close = () => setState({ membersOpen: null, membersQ: '' });
    if (!runs(g)) return '';
    const owner = g.role === 'owner', list = st.membersList || [], owners = list.filter(m => m.role === 'owner').length;
    const q = st.membersQ.trim().toLowerCase();
    const rows = list.filter(m => m.user_id === st.me).concat(list.filter(m => m.user_id !== st.me)).filter(m => !q || m.name.toLowerCase().includes(q));
    const chip = (role) => role === 'member' ? '' : roleBadge(role, 'padding:3px 9px');
    const textBtn = (label, fn) => '<span ' + on(fn) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 4px;font-size:13.5px;font-weight:700;color:#6b7280;cursor:pointer">' + label + '</span>';
    const pill = (label, fn) => '<span ' + on(fn) + ' class="hov-outline" style="flex:0 0 auto;display:flex;align-items:center;min-height:34px;padding:0 12px;border:1.5px solid #dcdfe6;border-radius:999px;font-size:13.5px;font-weight:800;color:#0d1117;cursor:pointer">' + label + '</span>';
    const actions = (m) => {
      if (!owner) return '';
      const mine = m.user_id === st.me;
      if (m.role === 'member') return pill('Make admin', () => setRole(g, m, 'admin'));
      if (m.role === 'admin') return (owners < 2 ? pill('Make owner', () => setRole(g, m, 'owner')) : '') + textBtn('Remove', () => setRole(g, m, 'member'));
      if (m.role === 'owner' && owners > 1) return textBtn(mine ? 'Step down' : 'Remove', () => setRole(g, m, 'admin'));
      return '';
    };
    return sheet('Members', close, 'height:84%;display:flex;flex-direction:column;padding:10px 0 0',
      '<div style="padding:0 14px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 6px 12px">' +
          '<div style="display:flex;align-items:baseline;gap:8px"><h3 style="margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Members</h3>' +
            '<span style="font-size:15px;font-weight:700;color:#8a909b">' + (st.membersList ? list.length : '') + '</span></div>' +
          '<div ' + on(close) + ' aria-label="Close" style="width:32px;height:32px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(15, '#0d1117', 2.4) + '</div>' +
        '</div>' +
        '<div style="position:relative;margin:0 2px 8px">' +
          svg(16, stroke('#9aa0ac', 2.4) + ' style="position:absolute;left:14px;top:50%;transform:translateY(-50%)"', '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>') +
          '<input class="fld" type="search" aria-label="Search members" placeholder="Search members" value="' + esc(st.membersQ) + '" ' + onInput(e => { if (e.type === 'input') setState({ membersQ: e.target.value.slice(0, 40) }); }) + ' style="width:100%;min-height:44px;background:#f2f3f6;border:0;border-radius:12px;padding:0 14px 0 38px;font-family:inherit;font-size:16px;font-weight:600;color:#0d1117;outline:none">' +
        '</div>' +
      '</div>' +
      '<div style="flex:1;overflow:auto;padding:0 14px 22px">' +
        (st.membersList == null
          ? '<div style="padding:28px 8px;text-align:center;font-size:15px;font-weight:600;color:#8a909b">Loading…</div>'
          : rows.map(m => '<div data-member="' + esc(m.name) + '" style="display:flex;align-items:center;gap:12px;min-height:58px;padding:6px;border-bottom:1px solid #f2f3f6">' +
              memberFace(m, 40) +
              '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px"><span style="font-size:16px;font-weight:700;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(m.name) + '</span>' +
                (m.user_id === st.me ? '<span style="font-size:14px;font-weight:600;color:#8a909b">(you)</span>' : '') + '</div>' +
              chip(m.role) + actions(m) +
            '</div>').join('') +
            (rows.length ? '' : '<div style="padding:28px 8px;text-align:center;font-size:15px;font-weight:600;color:#8a909b">No one by that name.</div>')) +
      '</div>');
  }

  // Delete {Name}?: type DELETE to confirm (owners)
  function viewDeleteGroup() {
    const st = state, g = groupById(st.gpId), close = () => setState({ gpDel: null });
    if (!g || g.role !== 'owner') return '';
    const ok = st.gpDel.trim() === 'DELETE' && !st.busy;
    return modal('Delete group', close,
      h3('Delete ' + esc(g.name) + '?') +
      para('This removes the group and every idea in it, for all ' + (st.gpMembers || 0) + ' members. It can’t be undone.') +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="' + LABEL + '">Type <strong style="font-weight:900;color:#9b1c31">DELETE</strong> to confirm</span>' +
        '<input class="fld fld-danger" type="text" autocomplete="off" autocapitalize="characters" aria-label="Type DELETE to confirm" placeholder="DELETE" value="' + esc(st.gpDel) + '" ' +
          onInput(e => { const v = e.target.value.toUpperCase().slice(0, 12); if (e.target.value !== v) e.target.value = v; setState({ gpDel: v }); }) + ' style="' + FIELD + ';font-weight:800;letter-spacing:1px"></label>' +
      '<button type="button" ' + on(() => deleteGroup(g)) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + ';box-shadow:none;background:' + (ok ? '#9b1c31' : '#b9bcc4') + '">' + (st.busy === 'save' ? 'Deleting…' : 'Delete group') + '</button>' +
      '<button type="button" class="hov-outline" ' + on(close) + ' style="' + SECONDARY + ';padding:14px;font-size:15.5px">Keep it</button>',
      { z: 31 });
  }

  // The Photo positioner: full screen, the true-size frame with only the real scrim on top
  function viewPositioner() {
    const ph = state.ph, group = ph.kind === 'group', q = ph.pos;
    const scrim = group
      ? 'linear-gradient(to bottom, rgba(13,17,23,.85) 0%, rgba(13,17,23,.56) 30%, rgba(13,17,23,.52) 45%, rgba(13,17,23,.72) 62%, rgba(13,17,23,.96) 100%)'
      : 'linear-gradient(to bottom, rgba(13,17,23,.68) 0%, rgba(13,17,23,.18) 40%, rgba(13,17,23,.18) 70%, rgba(13,17,23,.45) 100%)';
    return '<div role="dialog" aria-modal="true" aria-label="Position photo" data-screen-label="Position photo" style="position:absolute;inset:0;z-index:36;background:#0d1117;display:flex;flex-direction:column;overflow:auto;animation:fadeIn 200ms ease-out both">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(12px + var(--sat)) 14px 12px">' +
        '<span ' + on(closePositioner) + ' style="display:flex;align-items:center;min-height:44px;padding:0 4px;font-size:15px;font-weight:700;color:#dfe2e8;cursor:pointer">Cancel</span>' +
        '<span style="font-size:16px;font-weight:800;color:#fff">' + (group ? 'Header photo' : 'Cover photo') + '</span>' +
        '<button type="button" class="hov-primary" ' + on(savePositioner) + ' style="min-height:36px;padding:0 16px;border:0;border-radius:999px;background:#5b4ae8;font-family:inherit;font-size:14.5px;font-weight:800;color:#fff;cursor:' + (state.busy ? 'wait' : 'pointer') + '">' + (state.busy === 'save' ? 'Saving…' : 'Save') + '</button>' +
      '</div>' +
      '<div data-ph aria-label="Drag to reposition the photo" style="position:relative;margin-top:8px;height:' + (group ? 236 : 210) + 'px;overflow:hidden;background:#2b2413;touch-action:none;cursor:grab;user-select:none">' +
        '<div aria-hidden="true" data-ph-img style="position:absolute;inset:0;pointer-events:none;background:' + bg(ph.url, q.x + '% ' + q.y + '%') + ';transform:scale(' + q.zoom + ');transform-origin:' + q.x + '% ' + q.y + '%"></div>' +
        '<div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:' + scrim + '"></div>' +
        '<div aria-hidden="true" class="ph-grid"></div>' +
      '</div>' +
      '<div style="padding:18px 20px 26px;display:flex;flex-direction:column;gap:16px">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;color:#aab0bb">' +
          svg(16, stroke('#aab0bb', 2.2), '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>') + 'Drag the photo. This is exactly how it’ll show.</div>' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          svg(16, stroke('#aab0bb', 2.2), '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8 11h6"/>') +
          '<input type="range" min="1" max="2.5" step="0.01" aria-label="Zoom" value="' + q.zoom + '" ' + onInput(e => setState({ ph: Object.assign({}, state.ph, { pos: Object.assign({}, state.ph.pos, { zoom: Math.min(2.5, Math.max(1, +e.target.value || 1)) }) }) })) + ' style="flex:1;accent-color:#9d93f7">' +
          svg(18, stroke('#aab0bb', 2.2), '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8 11h6M11 8v6"/>') +
        '</div>' +
        '<label class="hov-white-line" style="min-height:50px;display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px solid rgba(255,255,255,.3);border-radius:999px;font-size:15.5px;font-weight:800;color:#fff;cursor:pointer">Choose a different photo' +
          '<input type="file" accept="image/*" aria-label="Choose a different photo" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; const t = state.ph; pickForPositioner(f, { kind: t.kind, id: t.id }); }) + ' style="display:none"></label>' +
      '</div>' +
    '</div>';
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

  // Who thanked the host (Round 64d): everyone can see it, as thank-yous are public
  function viewThanksList(s) {
    const close = () => setState({ thanksList: false });
    const who = s.reactions.filter(r => r.kind === 'thanks').map(r => r.userId);
    return modal('Thanks for ' + firstName(nameOf(s.leadId, s.leadName)), close,
      h3('Thanks for ' + esc(firstName(nameOf(s.leadId, s.leadName)))) +
      '<div style="display:flex;flex-direction:column">' +
        who.map((u, i) => '<div style="display:flex;align-items:center;gap:12px;min-height:52px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + '">' +
          face(u, nameOf(u), 36, '#7b6ef0') +
          '<span style="flex:1 1 auto;min-width:0;font-size:15.5px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(u === state.me ? 'You' : nameOf(u)) + '</span>' +
          '<span aria-hidden="true" style="font-size:18px">🙏</span></div>').join('') +
      '</div>');
  }

  function viewToast() {
    const t = state.toast;
    if (t.big) return '<div role="status" style="position:absolute;left:16px;right:16px;bottom:calc(var(--nav-h) + 16px);z-index:50;pointer-events:none">' +
      '<div style="display:flex;align-items:center;gap:12px;background:#11131f;border-radius:20px;padding:14px 16px;box-shadow:0 12px 30px rgba(17,19,31,.3);animation:popIn 240ms cubic-bezier(.22,.9,.28,1) both">' +
        '<span aria-hidden="true" style="flex:0 0 30px;width:30px;height:30px;border-radius:999px;background:#1f8a4c;display:flex;align-items:center;justify-content:center">' + I.check(16, '#fff', 3) + '</span>' +
        '<span style="font-size:16px;line-height:1.3;font-weight:600;color:#fff">' + esc(t.text) + '</span></div></div>';
    return '<div role="status" style="position:absolute;left:14px;right:14px;bottom:calc(var(--nav-h) + 12px);z-index:50;display:flex;justify-content:center;pointer-events:none">' +
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

  // v6 tab bar: Your tasks · Your schedule · Calendar (centre, in a ring) · Groups · Profile (a sheet)
  function viewNav() {
    const s = state.screen, prof = state.profSheet, n = tasksBadge();
    const tab = (active, label, icon, fn) => '<div ' + on(fn) + ' aria-label="' + label + '"' + (active ? ' aria-current="page"' : '') +
      ' style="padding:9px 0;min-height:44px;display:flex;align-items:center;justify-content:center;width:100%;color:' + (active ? '#5b4ae8' : '#6b7280') + ';cursor:pointer">' + icon + '</div>';
    const calOn = s === 'calendar' && !prof;
    return '<nav class="tabbar" aria-label="Main">' +
      tab(s === 'home' && !prof, n ? 'Your tasks, ' + n : 'Your tasks', '<span style="position:relative;display:flex">' + svg(23, stroke('currentColor', 1.9), P6.tasks) +
        (n ? '<span aria-hidden="true" style="position:absolute;top:-6px;right:-9px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;border:2px solid #fff;background:#5b4ae8;color:#fff;font-size:10.5px;font-weight:900;display:flex;align-items:center;justify-content:center;box-sizing:border-box">' + (n > 9 ? '9+' : n) + '</span>' : '') + '</span>', () => go('home')) +
      tab(s === 'sched' && !prof, 'Your schedule', I.tabTicket, () => go('sched')) +
      '<div ' + on(() => go('calendar')) + ' aria-label="Calendar"' + (calOn ? ' aria-current="page"' : '') + ' style="display:flex;align-items:center;justify-content:center;width:100%;cursor:pointer">' +
        '<span style="width:48px;height:48px;border-radius:999px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 ' + (calOn ? '2px #5b4ae8' : '1.9px #c3c7d0') + ';color:' + (calOn ? '#5b4ae8' : '#6b7280') + '">' +
          svg(23, stroke('currentColor', 2.1), '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>') + '</span></div>' +
      tab(s === 'groups' && !prof, 'Groups', I.tabSquares, () => go('groups')) +
      tab(prof, 'Profile', svg(23, stroke('currentColor', 1.9), P6.person), openProfileSheet) +
    '</nav>';
  }

  // Full-screen photo (the vibe photos): tap anywhere or ✕ to close, arrows between them
  function viewZoom() {
    const z = state.zoom, n = z.photos.length, close = () => setState({ zoom: null });
    const step = (d) => (e) => { stop(e); setState({ zoom: { photos: z.photos, i: (z.i + d + n) % n } }); };
    const arrow = (d, label, path) => '<span ' + on(step(d)) + ' aria-label="' + label + '" style="position:absolute;top:50%;' + (d < 0 ? 'left' : 'right') + ':12px;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;cursor:pointer">' + path + '</span>';
    return '<div role="dialog" aria-modal="true" aria-label="Photo" data-scrim="' + reg(close) + '" style="position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;animation:fadeIn 160ms ease both;cursor:zoom-out">' +
      '<img src="' + esc(z.photos[z.i]) + '" alt="Mood photo ' + (z.i + 1) + ' of ' + n + '" style="max-width:100%;max-height:100%;object-fit:contain;display:block">' +
      '<span ' + on(close) + ' aria-label="Close" style="position:absolute;top:max(14px, env(safe-area-inset-top));right:14px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(16, '#fff', 2.6) + '</span>' +
      (n > 1
        ? arrow(-1, 'Previous photo', I.chevL(18, '#fff', 2.4)) + arrow(1, 'Next photo', I.chevR(18, '#fff', 2.4)) +
          '<span style="position:absolute;bottom:max(18px, env(safe-area-inset-bottom));left:0;right:0;text-align:center;font-size:13px;font-weight:700;color:rgba(255,255,255,.75)">' + (z.i + 1) + ' / ' + n + '</span>'
        : '') +
    '</div>';
  }

  // Welcome is what signed-out visitors see for Home (and Profile / a group page, which need an account)
  const welcomeShown = () => !state.email && ['home', 'sched', 'groupPage', 'calendar', 'own', 'groups'].indexOf(state.screen) > -1;

  function view() {
    const st = state, s = st.screen, subj = subject();
    const home = () => st.email ? viewTasks() : viewWelcome();
    let main;
    if (s === 'browse') main = viewBrowse();
    else if (s === 'how') main = viewHow();
    else if (s === 'sched') main = st.email ? viewSched() : home();
    else if (s === 'groupPage') main = st.email ? viewGroupPage() : home();
    else if (s === 'calendar') main = st.email ? viewCalendar() : home();
    else if (s === 'own') main = st.email ? viewOwn() : home();
    else if (s === 'groups') main = st.email ? viewGroups() : home();
    else if ((s === 'detail' || s === 'edit') && subj) main = viewDetail(subj);
    else if (s === 'detail' && !st.loaded) main = '<div style="padding:40px 20px;font-size:15px;font-weight:600;color:#6b7280">Loading…</div>';
    else if (s === 'compose') main = st.email ? '' : viewWelcome();   // the post flow covers the screen
    else main = home();
    // An invite link's full-screen steps take the place of the screen
    if (invFull()) {
      const k = st.inv.step;
      main = k === 'land' ? viewInvLanding() : k === 'welcome' ? viewInvWelcome() : k === 'bad' ? viewInvBad() : viewInvJoining();
    }

    return '<div class="ptr" aria-hidden="true"><span class="ptr-spin"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/></svg></span></div>' +
      '<div class="scroller">' + main + '</div>' +
      (st.viewAs ? previewBar() : '') +
      // v6 sheets sit under the pop-ups they open (Edit profile, Notification settings, sign-in, guest info)
      (st.email && st.profSheet ? viewProfileSheet() : '') +
      (st.email && st.notifSheet ? viewNotifSheet() : '') +
      (st.email && st.dashAll ? viewDashAll() : '') +
      (st.email && st.cHandSheet ? viewHandSheet() : '') +
      (st.email && st.cSearch ? viewSearch() : '') +
      (s === 'browse' && st.loaded && currentGroup() && !st.gSearch ? swipeHints() : '') +
      (st.email && st.gSearch && s === 'browse' ? viewGroupSearch() : '') +
      (st.shiftPick ? viewShiftSheet() : '') +
      (st.banner ? viewBanner() : '') +
      (s === 'compose' ? viewCompose() : '') +
      (s === 'compose' && st.email ? viewComposeSheets() : '') +
      (st.offerKind && subj ? viewOffer(subj) : '') +
      (st.interestList && subj ? viewInterestList(subj) : '') +
      (st.thanksList && subj ? viewThanksList(subj) : '') +
      (st.guestOpen ? viewGuest() : '') +
      (st.nameAsk ? viewName() : '') +
      (st.pe ? viewProfileEdit() : '') +
      (st.joinOpen ? viewJoin() : '') +
      (st.nSettings && st.email ? viewNotifSettings() : '') +
      (st.membersOpen ? viewMembers() : '') +
      (st.gpDel != null && s === 'groupPage' ? viewDeleteGroup() : '') +
      (st.ph ? viewPositioner() : '') +
      (st.invite ? viewInvite() : '') +
      (st.sec && subj ? viewSecSheet() : '') +
      (st.needEd && subj ? viewNeedsSheet() : '') +
      (st.share ? viewShareSheet() : '') +
      (st.startName != null ? viewStartGroup() : '') +
      (st.blast ? viewBlast() : '') +
      (st.loginStep ? (st.inv && st.inv.step === 'land' && st.loginStep === 'code' ? viewInvCode() : viewLogin()) : '') +
      (st.inv && st.inv.step === 'confirm' && st.email ? viewInvConfirm() : '') +
      (st.confirm ? viewConfirm() : '') +
      (st.zoom ? viewZoom() : '') +
      (st.installPop ? viewInstallPop() : '') +
      (st.toast ? viewToast() : '') +
      (welcomeShown() || invFull() ? '' : viewNav());   // no tab bar on Welcome or the invite screens
  }

  // ---------------------------------------------------------------------------
  // Render + DOM morph
  // ---------------------------------------------------------------------------

  const root = document.getElementById('app');

  // Installed iPhone app (iOS 26): on first launch WebKit sizes the page short by the status
  // bar's height, leaving a band at the bottom until something scrolls. CSS uses 100lvh for the
  // installed app (see sparks.css); a one-pixel scroll nudge after launch triggers the re-layout
  // that a hand scroll does.
  const STANDALONE = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const nudgeLayout = () => {
    if (!STANDALONE) return;
    requestAnimationFrame(() => {
      window.scrollTo(0, 1); window.scrollTo(0, 0);
      const sc = document.querySelector('.scroller');
      if (sc) { const y = sc.scrollTop; sc.scrollTop = y + 1; sc.scrollTop = y; }
    });
  };
  window.addEventListener('load', () => { nudgeLayout(); setTimeout(nudgeLayout, 300); });
  window.addEventListener('pageshow', nudgeLayout);
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

  // Freeze log (temporary, owner only; shown on Profile): notes when the page stops responding for over a
  // second, plus slow redraws and loads, to trace the freezes on the installed iPhone app. Stays on this device.
  const DIAG_KEY = 'spark-hub-diag';
  let diagTick = Date.now(), diagAway = false, diagWork = '';
  const diagRead = () => { try { return JSON.parse(localStorage.getItem(DIAG_KEY)) || []; } catch (e) { return []; } };
  const diag = (kind, ms, note) => {
    const log = diagRead();
    log.unshift({ at: Date.now(), kind, ms: Math.round(ms), screen: state.screen, note: note || '' });
    try { localStorage.setItem(DIAG_KEY, JSON.stringify(log.slice(0, 40))); } catch (e) { /* storage blocked */ }
  };
  const diagNote = (what) => { diagWork = what + ' at ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) diagAway = true; });
  setInterval(() => {
    const now = Date.now(), gap = now - diagTick;
    diagTick = now;
    if (diagAway || document.hidden) { diagAway = document.hidden; return; }   // timers pause in the background: not a freeze
    if (gap > 1250) diag('stall', gap - 250, 'last: ' + (diagWork || 'nothing') + ' · ' + document.images.length + ' images');
  }, 250);

  function render() {
    const t0 = performance.now();
    if (swipe && swipe.on && !swipe.settling) { swipe = null; swipeClear(); }
    H = [];
    GEN++;
    const html = view();
    handlers = H;
    tpl.innerHTML = html;
    morphChildren(root, tpl.content);
    root.classList.toggle('no-nav', welcomeShown() || invFull());
    // Screens that start with a photo run it up under the iPhone status bar
    const sc = state.screen, photoTop = sc === 'browse' || (sc === 'detail' && !!subject()) || sc === 'calendar' || sc === 'groups' || welcomeShown() || (!state.email && sc === 'compose') ||
      (invFull() && (state.inv.step === 'land' || state.inv.step === 'welcome'));
    root.classList.toggle('photo-top', photoTop);
    syncBadge();
    maybeInstallPop();
    placeInvPop();
    const took = performance.now() - t0;
    diagNote('redraw (' + Math.round(took) + 'ms)');
    if (took > 150) diag('slow redraw', took);
  }

  // ---------------------------------------------------------------------------
  // Events (delegated)
  // ---------------------------------------------------------------------------

  root.addEventListener('click', (e) => {
    // Resolve the handler before any re-render can change indexes
    const scrim = e.target.closest('[data-scrim]');
    const el = e.target.closest('[data-on]');
    const fn = scrim && e.target === scrim
      ? handlerFor(scrim.getAttribute('data-scrim'))
      : el ? handlerFor(el.getAttribute('data-on')) : null;
    // Clicking outside a menu closes it
    if (state.menu && !e.target.closest('[data-menu]')) setState({ menu: null });
    if (fn) fn(e);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.zoom) return setState({ zoom: null });
      if (state.installPop) return setState({ installPop: false });
      if (state.inv && state.loginStep === 'code') { closeLogin(); return setState({ invCodeBad: false }); }
      if (state.inv && state.inv.step === 'confirm' && !state.inv.busy) return closeInvite();
      if (state.confirm) return setState({ confirm: null });
      if (state.ph) return closePositioner();
      if (state.invite) return setState({ invite: null });
      if (state.timeOpen) return setState({ timeOpen: null });
      if (state.sec) return setState({ sec: null });
      if (state.needEd) return setState({ needEd: null });
      if (state.share) return setState({ share: null });
      if (state.pollSheet) return setState({ pollSheet: null });
      if (state.needSheet) return setState({ needSheet: null });
      if (state.evLeave) return setState({ evLeave: false });
      if (state.shiftPick) return setState({ shiftPick: null });
      if (state.startName != null) return setState({ startName: null });
      if (state.blast) return setState({ blast: null });
      if (state.gpDel != null) return setState({ gpDel: null });
      if (state.gpRename != null) return setState({ gpRename: null });
      if (state.nSettings) return setState({ nSettings: false });
      if (state.loginStep) return closeLogin();
      if (state.joinOpen) return setState({ joinOpen: false });
      if (state.membersOpen) return setState({ membersOpen: null, membersQ: '' });
      if (state.pe) return setState({ pe: null });
      if (state.nameAsk) return setState({ nameAsk: null, nameText: '' });
      if (state.guestOpen) return setState({ guestOpen: false, guestThen: null });
      if (state.offerKind) return setState({ offerKind: null, offerText: '' });
      if (state.interestList) return setState({ interestList: false });
      if (state.thanksList) return setState({ thanksList: false });
      if (state.menu) return setState({ menu: null });
      if (state.cSearch) return setState(Object.assign({ cSearch: false, cq: '' }, state.cTry ? TRY_UNDO : {}));
      if (state.gSearch) return setState({ gSearch: false, gq: '', gTry: null });
      if (state.cHandSheet) return setState({ cHandSheet: false });
      if (state.dashAll) return setState({ dashAll: null });
      if (state.notifSheet) return setState({ notifSheet: false });
      if (state.profSheet) return setState({ profSheet: false });
    }
    if (state.zoom && state.zoom.photos.length > 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const z = state.zoom, n = z.photos.length;
      return setState({ zoom: { photos: z.photos, i: (z.i + (e.key === 'ArrowLeft' ? -1 : 1) + n) % n } });
    }
    if (e.key === 'Enter' && e.target.matches('[data-rename]')) {
      e.preventDefault();
      const g = groupById(state.gpId);
      if (g) saveRename(g);
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-on][role]') && !isField(e.target)) {
      e.preventDefault();
      const fn = handlerFor(e.target.getAttribute('data-on'));
      if (fn) fn(e);
    }
  });

  // 'change' as well: some native date/time pickers only fire change
  const onField = (e) => {
    const el = e.target.closest('[data-input]');
    if (!el) return;
    const fn = handlerFor(el.getAttribute('data-input'));
    if (fn) fn(e);
  };
  root.addEventListener('pointerdown', phDown);
  root.addEventListener('pointermove', phMove);
  root.addEventListener('pointerup', phUp);
  root.addEventListener('pointercancel', phUp);
  root.addEventListener('input', onField);
  root.addEventListener('change', onField);

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  // An invite link (/join/CODE): the invite flow (startInvite)
  const takeInvite = (code) => {
    if (!code) return;
    if (JOIN_PATH.test(location.pathname) || /^#\/join\//.test(location.hash)) history.replaceState(null, '', '/');
    startInvite(code);
  };

  // Back/forward buttons fire popstate; a link opened or pasted in the same tab only fires hashchange
  const followUrl = () => {
    const target = fromUrl();
    if (target.inviteCode) { takeInvite(target.inviteCode); return; }
    if (target.screen === state.screen && target.subjectId === state.subjectId && target.gpId === state.gpId) return;
    setState(Object.assign({ menu: null, offerKind: null, nameAsk: null, confirm: null, loginStep: null, loginThen: null, interestList: false, thanksList: false, back: null,
      profSheet: false, notifSheet: false, dashAll: null, cHandSheet: false, cSearch: false, cq: '', gSearch: false, gq: '', gTry: null }, target));
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

  // Pull to refresh: drag down from the top of a screen and let go to reload the data. The feed under
  // the header follows the finger (with resistance) while the header stays put; a spinner in the gap
  // turns as you pull and spins while loading. Screens without a header slide as a whole.
  const PTR_GO = 64, PTR_REST = 52;
  let ptr = null, ptrBusy = false, ptrBackTimer = null;
  const ptrShow = (d, cls) => {
    root.style.setProperty('--ptr', d + 'px');
    root.style.setProperty('--ptr-turn', (d * 4) + 'deg');
    root.classList.toggle('ptr-drag', cls === 'drag');
    root.classList.toggle('ptr-busy', cls === 'busy');
    root.classList.toggle('ptr-ready', d >= PTR_GO);
    // The feed keeps its transform only while pulled or sliding back, so nothing stays transformed at rest
    clearTimeout(ptrBackTimer);
    root.classList.add('ptr-on');
    if (!cls) ptrBackTimer = setTimeout(() => root.classList.remove('ptr-on'), 300);
  };
  // Where the gap opens: under the screen's header, or at the top of the scroller
  const ptrPlace = (sc) => {
    const head = sc.querySelector(':scope > div > header'), top = root.getBoundingClientRect().top;
    root.style.setProperty('--ptr-top', ((head || sc).getBoundingClientRect()[head ? 'bottom' : 'top'] - top) + 'px');
    root.classList.toggle('ptr-head', !!head);
  };
  root.addEventListener('touchstart', (e) => {
    const sc = e.target.closest('.scroller');
    ptr = null;
    if (!sc || ptrBusy || e.touches.length > 1 || sc.scrollTop > 0 || !state.me) return;
    ptr = { sc, x0: e.touches[0].clientX, y0: e.touches[0].clientY, d: 0, on: false };
  }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    if (!ptr) return;
    const dx = e.touches[0].clientX - ptr.x0, dy = e.touches[0].clientY - ptr.y0;
    if (!ptr.on) {
      // Only a downward, mostly-vertical drag from the very top counts (not scrolling up or swiping a carousel)
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      if (dy <= 0 || Math.abs(dx) > dy || ptr.sc.scrollTop > 0) { ptr = null; return; }
      ptr.on = true;
      ptrPlace(ptr.sc);
    }
    e.preventDefault();
    ptr.d = Math.max(0, Math.min(110, dy * 0.5));
    ptrShow(ptr.d, 'drag');
  }, { passive: false });
  const ptrEnd = () => {
    if (!ptr) return;
    const on = ptr.on, go = on && ptr.d >= PTR_GO;
    ptr = null;
    if (!on) return;
    if (!go) return ptrShow(0);
    ptrBusy = true;
    ptrShow(PTR_REST, 'busy');
    const started = Date.now();
    loadFresh()
      .then(() => { if (state.error === 'load') setState({ error: null }); })
      .catch(e => { console.error(e); toast('Couldn’t refresh. Check your connection.'); })
      .then(() => new Promise(r => setTimeout(r, Math.max(0, 600 - (Date.now() - started)))))   // don't flash the spinner
      .then(() => { ptrBusy = false; ptrShow(0); });
  };
  root.addEventListener('touchend', ptrEnd);
  // Swipe left / right on a group page to move between Ideas, Plans and Past (not on the header,
  // a sideways carousel, an open menu or a field). The page follows the thumb from the first few pixels,
  // with the neighbouring tab drawn beside it; let go past 40% of the way, or with a flick, and it
  // carries on to that tab, otherwise it springs back. Past the first or last tab it only gives a little.
  let swipe = null;
  const swipeEls = () => ({ page: document.querySelector('[data-screen-label=Browse]'), pane: document.querySelector('[data-tabpane]') });
  const swipeClear = () => {   // put the page back as it was drawn
    const { page, pane } = swipeEls();
    root.classList.remove('swiping');
    if (pane) { pane.querySelectorAll('[data-peek]').forEach(n => n.remove()); ['transform', 'transition', 'animation', 'position', 'background', 'backgroundImage', 'backgroundSize', 'minHeight'].forEach(k => { pane.style[k] = ''; }); }
    if (page) page.style.overflowX = '';
  };
  // Start the drag: draw each neighbouring tab beside the page, lined up with where it'll sit once it's the tab
  const swipeBegin = () => {
    const { page, pane } = swipeEls(), sc = scroller(), g = currentGroup();
    if (!page || !pane || !sc || !g) return false;
    const i = WORLDS.indexOf(state.phaseTab), off = Math.max(0, sc.scrollTop - tabsTop(sc)), fill = sc.clientHeight + 'px';
    root.classList.add('swiping');
    page.style.overflowX = 'clip';
    pane.style.animation = 'none';   // a tab tap's slide-in would otherwise hold the page in place
    pane.style.position = 'relative';
    pane.style.minHeight = fill;
    pane.style.cssText += ';' + (state.phaseTab === 'idea' ? IDEA_PAPER : 'background:#e8eaee');
    [-1, 1].forEach(d => {
      const k = WORLDS[i + d];
      if (!k) return;
      const peek = document.createElement('div');
      peek.setAttribute('data-peek', k);
      peek.setAttribute('aria-hidden', 'true');
      peek.style.cssText = 'position:absolute;top:' + off + 'px;' + (d < 0 ? 'right' : 'left') + ':100%;width:100%;min-height:' + fill + ';box-sizing:border-box;padding:10px 14px 22px;display:flex;flex-direction:column;gap:22px;pointer-events:none;' +
        (k === 'idea' ? IDEA_PAPER : 'background:#e8eaee');
      peek.innerHTML = browseBody(k, g).body;
      pane.appendChild(peek);
    });
    swipe.w = pane.getBoundingClientRect().width;
    return true;
  };
  root.addEventListener('touchstart', (e) => {
    if (swipe && swipe.settling) return;
    swipe = null;
    if (state.screen !== 'browse' || e.touches.length > 1 || state.menu || state.gSearch || !state.loaded) return;
    const t = e.target;
    if (!t.closest('[data-screen-label=Browse]') || t.closest('header, .snap-row, [data-menu], input, textarea, select')) return;
    swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false, dx: 0, v: 0, t: Date.now() };
  }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    if (!swipe || swipe.settling) return;
    const x = e.touches[0].clientX, dx = x - swipe.x, dy = e.touches[0].clientY - swipe.y;
    if (!swipe.on) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Mostly sideways takes the page; anything else is a scroll (or pull to refresh)
      if (Math.abs(dx) < Math.abs(dy) * 1.2 || !swipeBegin()) { swipe = null; return; }
      swipe.on = true;
      swipe.x0 = x;   // start moving from here, so the page doesn't jump by the 8px it took to decide
    }
    e.preventDefault();
    const now = Date.now(), i = WORLDS.indexOf(state.phaseTab);
    let d = x - swipe.x0;
    if ((d > 0 && i === 0) || (d < 0 && i === WORLDS.length - 1)) d *= 0.3;   // nothing that way: resist
    swipe.v = (d - swipe.dx) / Math.max(1, now - swipe.t);
    swipe.dx = d; swipe.t = now;
    const { pane } = swipeEls();
    if (pane) pane.style.transform = 'translateX(' + d + 'px)';
  }, { passive: false });
  const swipeEnd = () => {
    if (!swipe) return;
    if (!swipe.on) { swipe = null; return; }
    const { pane } = swipeEls(), dir = swipe.dx < 0 ? 1 : -1, next = WORLDS[WORLDS.indexOf(state.phaseTab) + dir];
    const v = Date.now() - swipe.t > 80 ? 0 : swipe.v;   // held still before letting go: not a flick
    const go = next && (Math.abs(swipe.dx) > swipe.w * 0.4 || (Math.abs(v) > 0.5 && Math.sign(v) === -dir && Math.abs(swipe.dx) > 24));
    if (!pane) { swipeClear(); swipe = null; return; }
    swipe.settling = true;
    const ms = Math.round(Math.min(260, Math.max(140, (go ? swipe.w - Math.abs(swipe.dx) : Math.abs(swipe.dx)) * 0.8)));
    pane.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.8,.2,1)';
    pane.style.transform = 'translateX(' + (go ? -dir * swipe.w : 0) + 'px)';
    setTimeout(() => {
      swipe = null;
      if (go) switchTab(next, dir, true);   // the neighbour is already where it belongs, so no slide-in
      swipeClear();
    }, ms + 20);
  };
  root.addEventListener('touchend', swipeEnd);
  root.addEventListener('touchcancel', swipeEnd);
  root.addEventListener('touchcancel', () => { if (ptr) { ptr = null; ptrShow(0); } });
  setInterval(refresh, 30000);   // picks up other people's posts; also retries after "Couldn't load"

  async function init() {
    if (!sb) { setState({ error: 'load', loaded: true }); return; }
    // Supabase signs the session out when a token refresh fails; replace it right away
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !reauthing) {
        clearCache();
        setTimeout(() => { ensureSession().then(() => loadAll()).catch(e => console.error(e)); }, 0);
      }
    });
    const invite = fromUrl().inviteCode;
    try {
      await ensureSession();
      if (await finishGoogle().catch(e => { console.error(e); return false; })) return;
      await loadForRoute();
      if (invite) takeInvite(invite);
      if (state.inv && state.inv.step === 'confirm' && !state.email) setInv({ step: 'land' });   // the saved session had ended
      if (state.profSheet && !state.email) { setState({ profSheet: false }); openLogin('profile', () => go('calendar', { profSheet: true })); }
    } catch (e) {
      console.error(e);
      setState({ error: 'load', loaded: true });
    }
  }

  Object.assign(state, fromUrl());
  const bootInvite = state.inviteCode;
  delete state.inviteCode;
  // Back from Google in the middle of an invite: the Joining screen straight away
  const inviteTrip = sb && AUTH_RETURN.any && readResume();
  if (inviteTrip && inviteTrip.from === 'invite' && inviteTrip.joinCode) {
    state.inv = { code: inviteTrip.joinCode, group: undefined, step: 'joining' };
    loadInviteGroup(inviteTrip.joinCode);
  }
  if (IDEA_PATH.test(location.pathname)) history.replaceState(null, '', '/#/idea/' + location.pathname.match(IDEA_PATH)[1]);
  // Signed in last time? Show their app (from the cache, or loading placeholders), not Welcome
  const bootUser = sb && signedInUser();
  if (bootUser) {
    const c = readCache(bootUser.id);
    Object.assign(state, { me: bootUser.id, email: bootUser.email, memberSince: bootUser.created_at ? new Date(bootUser.created_at).getFullYear() : null }, c
      ? { isGoogle: c.isGoogle, myName: c.myName || '', myAvatar: c.myAvatar, myPlace: c.myPlace || '', myBio: c.myBio || '', memberSince: c.memberSince || null, groups: c.groups || [], sparks: c.sparks || [], profiles: c.profiles || {},
          sizes: c.sizes || {}, notif: c.notif || state.notif, demoAdmin: !!c.demoAdmin, loaded: true, fromCache: true }
      : {});
  }
  // An invite link: its landing (or, signed in already, the confirm) from the first frame
  if (bootInvite && sb && !state.inv) {
    history.replaceState(null, '', '/');
    setPending(bootInvite);
    state.inv = { code: bootInvite, group: undefined, step: bootUser ? 'confirm' : 'land' };
    loadInviteGroup(bootInvite);
  }
  render();
  init();
})();
