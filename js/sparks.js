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
  const VIEWS = ['tiles', 'list', 'month'];
  const GROUP_VIEWS = ['next', 'tiles', 'month'];  // v7 Update 15: group pages, Up next first and the default (List is gone)
  const HOME_VIEWS = ['next', 'tiles', 'month'];   // v6 Update 9: Your schedule (List is gone; a saved List opens Up next)
  const CVIEWS = ['list', 'tiles', 'month'];       // v6 Calendar
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // ---------------------------------------------------------------------------
  // Supabase client + per-device prefs
  // ---------------------------------------------------------------------------

  const CFG = window.SPARKS_CONFIG || {};
  // Read before the client starts: coming back from Google adds ?code=… or ?error=…
  const AUTH_RETURN = (() => {
    try {
      const q = new URLSearchParams(location.search);
      return { any: q.has('code') || q.has('error'), error: q.get('error') };
    } catch (e) { return {}; }
  })();
  // PKCE keeps the Google round trip in the query string, clear of our #/ routes
  // "View as a user" (demo admin only) is look-only: while it's on, nothing but reads leaves the app
  let previewing = false;
  const READ_RPCS = /\/rest\/v1\/rpc\/(load_all|my_group_sizes|demo_testers|new_accounts|group_people|group_blocked|event_invited)(\?|$)/;
  // Auth calls allowed while previewing: keeping the owner's own session fresh, and signing out. Not
  // /auth/v1/user (that changes the account: name, email) or anything else.
  const AUTH_KEEP = /\/auth\/v1\/(token|logout)(\?|$)/;
  const guardedFetch = (url, opts) => {
    const m = String((opts && opts.method) || 'GET').toUpperCase(), u = String((url && url.url) || url);
    if (previewing && m !== 'GET' && m !== 'HEAD' && !(m === 'POST' && AUTH_KEEP.test(u)) && !READ_RPCS.test(u))
      return Promise.resolve(new Response(JSON.stringify({ message: 'Viewing as someone else: changes are off' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
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
        groups: state.groups, sparks, profiles: state.profiles, sizes: state.sizes, notif: state.notif, demoAdmin: state.demoAdmin, fr: state.fr, at: Date.now() }));
    } catch (e) { /* storage full or blocked: the app just loads as before */ }
  };
  const clearCache = () => { try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* blocked */ } };

  // Only conveniences live in the browser: current group, view, sort, and a guest's name + number
  const PREFS_KEY = 'spark-hub-prefs';
  const loadPrefs = () => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
  };
  let lastPrefs = '';
  const keepGrps = (v) => Array.isArray(v) && v.length ? v : null;
  const savePrefs = () => {
    const next = JSON.stringify({ groupId: state.groupId, view: state.view, gView: state.gView, homeView: state.homeView, cView: state.cView, cGrps: keepGrps(state.cGrps), tGrps: keepGrps(state.tGrps), sGrps: keepGrps(state.sGrps), sort: state.sort, guestName: state.guestName, pastStatsHidden: state.pastStatsHidden, jobsOpen: state.jobsOpen });
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
    plus: (size, color, w) => svg(size, stroke(color, w), '<path d="M12 5v14M5 12h14"/>'),
    x: (size, color, w) => svg(size, stroke(color, w), '<path d="M6 6l12 12M18 6 6 18"/>'),
    chevL: (size, color, w) => svg(size, stroke(color, w), '<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
    chevR: (size, color, w) => svg(size, stroke(color, w), '<path d="M9 6l6 6-6 6"/>'),
    chevD: (size, color, w) => svg(size, stroke(color, w), '<path d="m6 9 6 6 6-6"/>'),
    check: (size, color, w) => svg(size, stroke(color, w), '<path d="M5 12.5l4.5 4.5L19 7"/>'),
    pin: (size, w) => svg(size, stroke('currentColor', w || 2.2) + ' style="flex:0 0 ' + size + 'px"', '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>'),
    person: (size, w) => svg(size, stroke('currentColor', w || 2.4), '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5c.6-3.8 3.6-5.8 7.2-5.8s6.6 2 7.2 5.8"/>'),
    trash: (size, color) => svg(size, stroke(color, 2.1), '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2l.9-12.2"/>'),
    photo: (size, color, w) => svg(size, stroke(color, w), '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="M20.5 15.5l-4.5-4.5-7.5 7.5"/>'),
    camera: (size) => svg(size, stroke('#0d1117', 2.2), '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10H4Z"/><circle cx="12" cy="13" r="3.2"/>'),
    offline: svg(16, stroke('#9b1c31', 2.2), '<path d="M4.5 9.5a11 11 0 0 1 15 0M7.5 13a6.5 6.5 0 0 1 9 0"/><circle cx="12" cy="17" r="1.2" fill="#9b1c31"/><path d="M4 4l16 16"/>'),
    tabTicket: svg(23, stroke('currentColor', 1.9), '<path d="M4 8.5V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v2.5a2.5 2.5 0 0 0 0 5V16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16v-2.5a2.5 2.5 0 0 0 0-5Z" transform="translate(0 1)"/><path d="m9.2 12.2 2 2 3.8-4"/>'),
    tabPeople: svg(23, stroke('currentColor', 1.9), '<circle cx="9" cy="8.5" r="3.4"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M15.5 5.3a3.3 3.3 0 0 1 0 6.4M17.5 13.8a5.6 5.6 0 0 1 3.5 5.7"/>'),
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
    evDate: '', evTime: '', evEnd: '', evEndOn: false, timeOpen: null, dateOpen: null, calMonth: null,
    locText: '', locPlace: null, locSuggest: [],
    evBits: ['', '', ''], evNeed: null, evTags: [], evNeeds: [], evDatePoll: null, evSpotPoll: null, evLater: {}, evHelpNone: false,
    evPriv: false, evNoGuestInv: true, evTest: null, evKindAsk: false, evFloat: false, evPop: null, evGroups: null, evDraftId: null, evLeave: false, evLeaveTo: null, evFrom: null, pollSheet: null, needSheet: null, evFromReview: false
  });
  const state = Object.assign({
    screen: 'sched', menu: null, subjectId: null, gpId: null, zoom: null, membersOpen: null, membersList: null,
    sort: SORTS.some(s => s[0] === prefs.sort) ? prefs.sort : 'popular',
    view: VIEWS.indexOf(prefs.view) > -1 ? prefs.view : 'tiles',                 // a group's page (before v7)
    gView: GROUP_VIEWS.indexOf(prefs.gView) > -1 ? prefs.gView : prefs.view === 'month' ? 'month' : 'next',   // v7: an old List or Tiles opens Up next
    homeView: HOME_VIEWS.indexOf(prefs.homeView) > -1 ? prefs.homeView : 'next',   // Your schedule
    groupId: prefs.groupId || null,

    me: null, email: '', isGoogle: false, myName: '', myAvatar: null,
    loaded: false, fromCache: false, error: null, busy: null, toast: null, goneOpen: false,

    groups: [], sparks: [], profiles: {},

    drafts: [], notes: [], pushOn: false, pushCardHidden: (() => { try { return localStorage.getItem('spark-hub-push-card') === 'hidden'; } catch (e) { return false; } })(),
    canInstall: false, installPop: false, fb: null, sec: null, needEd: null, share: null,

    loginStep: null, loginFrom: 'default', loginThen: null, loginMode: 'link', loginEmail: '', loginCode: '',
    resent: false, mergeToken: null, googleFailed: false,
    nameAsk: null, nameText: '',
    guestOpen: false, guestThen: null, guest: null,
    guestName: prefs.guestName || '',
    offerKind: null, offerText: '', offerPlace: null, offerSuggest: [],
    joinOpen: false, joinCode: '', joinBad: false,
    notif: { allReadAt: 0, read: [], topics: {}, email: true, loaded: false }, nFilter: 'all', nSettings: false, demoAdmin: false, back: null, myPlace: '', myBio: '', memberSince: null, ownGrp: null, sizes: {}, membersQ: '', gpRename: null, gpDel: null, ph: null,
    startName: null, phaseTab: 'plan', sigDraft: '', sigNeed: '', sigTime: '', blast: null, invite: null,
    pe: null, confirm: null, interestList: false, thanksList: false, guestList: null, cohostPick: null, leadAsk: null, leadsSheet: null, takeDown: null, albumEdit: null,
    gpCode: '', gpMembers: null, gpFail: false, acctDel: null, voteAll: null, justAdded: null, offerVote: true,
    // v6 Update 13: Your people (Groups · Friends), friend requests, the friend link, inviting friends
    fr: { friends: [], incoming: [], outgoing: [], invites: [], loaded: false }, pplTab: 'groups', pplSearch: false, pplQ: '', pplAdd: false, frSel: [], frInvite: false,
    frAdd: null, myFriendCode: null, person: null,
    // v6: Profile / Notifications are sheets; Your tasks' "View all", expansions, the RSVP ask
    profSheet: false, notifSheet: false, dashAll: null, dashOpen: {}, schedOpen: {}, shiftPick: null, banner: null, sigAdding: false,
    // v6 Calendar: search, filters, sort, view, month, discovery cards
    cq: '', cSearch: false, cGrps: keepGrps(prefs.cGrps), tGrps: keepGrps(prefs.tGrps), sGrps: keepGrps(prefs.sGrps), cTypes: [], cSort: 'soon', cView: CVIEWS.indexOf(prefs.cView) > -1 ? prefs.cView : 'list',
    cMon: null, cDay: null, cWildHidden: false, cNeedsHidden: false, cHandSheet: false, hMon: null, hDay: null, gMon: null, gDay: null,
    // v6 Update 2: search's Try chips; Your schedule and group pages' Sort · Filter; a group's search
    cTry: null, cWhen: 'any', cHelp: false, sSort: 'soon', sFilt: [], gSort: 'soon', gFilt: [], iSort: 'interest', pastStatsHidden: prefs.pastStatsHidden || {}, jobsOpen: prefs.jobsOpen || {}, descOpen: {}, viewAs: null, testers: null, gSearch: false, gq: '', gTry: null
  }, blankCompose());

  // ---- URL <-> screen, so ideas and invites can be shared and the back button works

  const hashFor = () => {
    const s = state.screen;
    if (s === 'detail' && state.subjectId) return '#/idea/' + state.subjectId;
    if (s === 'groupPage' && state.gpId) return '#/group/' + state.gpId;
    if (s === 'compose') return '#/new';   // its own history entry, so the phone's Back stays in the flow (followUrl)
    // Your calendar is the home screen (v7 Update 16, owner 2026-10-03; the Calendar, now Explore, was until then)
    const plain = { calendar: '#/explore', home: '#/tasks', sched: '', browse: '#/ideas', how: '#/how', own: '#/own', groups: '#/groups' };
    return plain[s] != null ? plain[s] : null;
  };
  const syncHash = (prevScreen) => {
    const h = hashFor();
    if (h === null || (location.hash || '') === h) return;
    // Leaving the post flow replaces its #/new entry, so Back from the new event doesn't reopen the flow
    history[prevScreen === 'compose' && location.hash === '#/new' ? 'replaceState' : 'pushState'](null, '', h || location.pathname + location.search);
  };
  const JOIN_PATH = /^\/join\/([A-Za-z0-9]{6})\/?$/;
  const IDEA_PATH = /^\/i\/([0-9a-f-]{36})\/?$/;   // shared idea links (a real path so chat apps can preview them)
  const ADD_PATH = /^\/add\/([A-Za-z0-9]{6})\/?$/;   // friend links (v6 Update 13)
  const fromUrl = () => {
    const h = location.hash;
    let m = h.match(/^#\/idea\/([0-9a-f-]{36})$/) || (!h && location.pathname.match(IDEA_PATH));
    if (m) return { screen: 'detail', subjectId: m[1] };
    m = h.match(/^#\/group\/([0-9a-f-]{36})$/);
    if (m) return { screen: 'groupPage', gpId: m[1] };
    m = h.match(/^#\/join\/([A-Za-z0-9]{6})$/) || location.pathname.match(JOIN_PATH);
    if (m) return { screen: 'sched', inviteCode: m[1].toUpperCase() };
    m = h.match(/^#\/add\/([A-Za-z0-9]{6})$/) || location.pathname.match(ADD_PATH);
    if (m) return { screen: 'sched', friendCode: m[1].toUpperCase() };
    if (h === '#/ideas') return { screen: 'browse' };
    if (h === '#/how') return { screen: 'how' };
    if (h === '#/calendar' || h === '#/explore') return { screen: 'calendar' };
    if (h === '#/schedule') return { screen: 'sched' };
    if (h === '#/tasks') return { screen: 'home' };
    if (h === '#/own') return { screen: 'own' };
    if (h === '#/groups') return { screen: 'groups' };
    if (h === '#/new') { history.replaceState(null, '', location.pathname + location.search); return { screen: 'sched' }; }   // a post flow left behind by a reload
    // v6: Profile and Notifications are sheets over the opening screen
    if (h === '#/notifications') return { screen: 'sched', notifSheet: true };
    if (h === '#/me') return { screen: 'sched', profSheet: true };
    return { screen: 'sched' };   // the app opens on Your calendar (v7 Update 16, owner 2026-10-03; it was the Calendar, now Explore)
  };

  const setState = (patch) => {
    const prevStep = state.evStep, prevScreen = state.screen, prevSubj = state.subjectId, prevGp = state.gpId;
    Object.assign(state, patch);
    savePrefs();
    if (state.screen === 'compose') keepCompose();
    render();
    if (state.evStep !== prevStep) {
      const ov = document.querySelector('.overlay-screen');
      if (ov) ov.scrollTop = 0;
    }
    if (state.screen !== prevScreen || state.subjectId !== prevSubj || state.gpId !== prevGp) syncHash(prevScreen);
    if (state.screen === 'browse' && prevScreen !== 'browse') hintVisit();   // the swipe arrows' first visits
  };

  const scroller = () => document.querySelector('.scroller');
  // Screens an event page can come back to, with their scroll position; anywhere else falls back to the group's page
  const ORIGINS = ['home', 'sched', 'own', 'calendar', 'groups', 'browse'];
  const go = (screen, extra) => {
    const sc = scroller();
    if (screen === 'detail' && state.screen !== 'detail') {
      state.back = ORIGINS.indexOf(state.screen) > -1 ? { screen: state.screen, groupId: state.groupId, phaseTab: state.phaseTab, scroll: sc ? sc.scrollTop : 0 } : null;
    }
    // Going anywhere closes the v6 sheets (Profile, Notifications, View all, Could use a hand, Search)
    setState(Object.assign({ screen, menu: null, zoom: null, sec: null, needEd: null, share: null, cohostPick: null, leadAsk: null, leadsSheet: null, pollSheet: null, profSheet: false, notifSheet: false, dashAll: null, cHandSheet: false, cSearch: false, cq: '', gSearch: false, gq: '', gTry: null, pplAdd: false, frInvite: false, person: null, fbNudge: null, peek: null, gMenu: null, jobAsk: null, handOff: null }, extra || {}));
    if (sc) sc.scrollTop = 0;
  };

  let toastTimer = null;
  // act: { label, fn } puts a button on the toast (Undo), and keeps it up a little longer
  const toast = (text, ok, act) => {
    setState({ toast: { text, ok: !!ok, act: act || null } });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setState({ toast: null }), act ? 5000 : 3500);
  };
  // The invite flow's larger toast ("You’re already in {group}"), 3s
  const toastIn = (text) => {
    setState({ toast: { text, ok: true, big: true } });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setState({ toast: null }), 3000);
  };
  const FAILED = 'That didn’t go through. Try again in a moment.';
  // What to say when a save fails: the database's rate limits (PT429) and taken group names get their own words
  const SLOW = 'You’re going a bit fast. Try again in a little while.';
  // Every failed save's message comes through here, so it's also kept for feedback (noteError)
  const failed = (e) => { noteError(e); return failedMsg(e); };
  const failedMsg = (e) => !e ? FAILED
    : e.code === 'PT429' || e.status === 429 ? SLOW
    : e.code === '23505' && /name is taken/.test(e.message || '') ? 'That name is taken. Try another.'
    : FAILED;
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
  const roleBadge = (role, extra) => '<span aria-label="' + (role === 'owner' ? 'Owner' : 'Admin') + '" style="flex:0 0 auto;border-radius:999px;padding:2px 7px;' +
    (role === 'owner' ? 'background:#ece9fd;color:#4a3ad4' : 'background:#fdf1d6;color:#8f6405') + ';font-size:11px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;' + (extra || '') + '">' + ROLE_WORD[role] + '</span>';
  // isLead: anyone hosting it (the lead or a co-host, 20261101130000_cohosts.sql). isTheLead: only the lead, for what
  // co-hosts can't do (delete or cancel, look for a host) and where the lead is shown apart
  const isTheLead = (s) => !!s && !!state.me && s.leadId === state.me;
  const isCohost = (s) => !!s && !!state.me && (s.cohosts || []).indexOf(state.me) > -1;
  const isLead = (s) => isTheLead(s) || isCohost(s);
  const hostIds = (s) => [s.leadId].concat(s.cohosts || []);
  // The lead, or an admin of the idea's group, can edit or delete it
  const isGroupAdmin = (s) => { const g = s && groupById(s.groupId); return runs(g); };
  const canEdit = (s) => isLead(s) || isGroupAdmin(s);
  const canTakeDown = (s) => isTheLead(s) || isGroupAdmin(s);   // delete or cancel: not co-hosts
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

  // Plan data grouped by idea (RSVPs, votes, sign-ups, updates, co-hosts, album, the hosts' prep)
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
    coverPos: row.cover_pos || null, cancelledAt: row.cancelled_at ? Date.parse(row.cancelled_at) : null, tags: Array.isArray(row.tags) ? row.tags : [], cancelReason: row.cancel_reason || '',
    mood: (row.mood || []).filter(p => PHOTO_PATH.test(p)),
    offers: offers.filter(o => o.spark_id === row.id && o.status === 'accepted')
      .map(o => ({ userId: o.user_id, who: o.who, kind: o.kind, body: o.body })),
    pending: offers.filter(o => o.spark_id === row.id && o.status === 'pending')
      .map(o => ({ id: o.id, userId: o.user_id, who: o.who, kind: o.kind, body: o.body })),
    interested: interests.filter(i => i.spark_id === row.id).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(i => i.user_id),
    canHelp: interests.filter(i => i.spark_id === row.id && i.can_help).map(i => i.user_id),   // "I could help make it happen"
    wantsHost: !!row.wants_host && !row.planned,   // the floater is looking for someone else to host (20261101090000)
    interestAt: interests.filter(i => i.spark_id === row.id).reduce((m, i) => { m[i.user_id] = Date.parse(i.created_at); return m; }, {}),
    contacts: contacts.filter(c => c.spark_id === row.id),
    demo: !!row.demo,   // seeded demo content: a DEMO pill before its title (demoTag), and counted for the owner's wipe
    test: !!row.test,   // a member's test event (chosen when posting): the same DEMO pill, never wiped with the demo content
    planned: !!row.planned, visibility: row.visibility || 'group', guestInvites: row.guest_invites !== false, autoRemind: row.auto_remind !== false, minPeople: row.min_people || null,
    rsvps: (x.rsvps[row.id] || []).map(r => ({ userId: r.user_id, status: r.status, created: Date.parse(r.created_at), attended: r.attended == null ? null : !!r.attended })),
    dateOpts: (x.dateOpts[row.id] || []).map(o => ({ id: o.id, dayDate: o.day_date, dayTime: o.day_time ? String(o.day_time).slice(0, 5) : null, who: o.who, createdBy: o.created_by, created: Date.parse(o.created_at), votes: (x.dateVotes[o.id] || []).map(v => v.user_id) })),
    spotOpts: (x.spotOpts[row.id] || []).map(o => ({ id: o.id, name: o.name, address: o.address || '', lat: o.lat, lon: o.lon, who: o.who, createdBy: o.created_by, created: Date.parse(o.created_at), votes: (x.spotVotes[o.id] || []).map(v => v.user_id) })),
    ...toSignups(x.signups[row.id] || [], x.claims),
    updates: (x.updates[row.id] || []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(u => ({ id: u.id, body: u.body, audience: u.audience, createdBy: u.created_by || null, created: Date.parse(u.created_at) })),
    cohosts: (x.cohosts[row.id] || []).map(o => o.user_id),
    leadAsks: (x.leadAsks[row.id] || []).map(a => ({ userId: a.user_id, by: a.asked_by, at: Date.parse(a.created_at), message: a.message || '' })),   // asked to lead (20261102020000_float_and_ask.sql)
    // Who was invited: the hosts see every invite, anyone else only their own (20261102040000_invited_and_nudge.sql)
    invites: (x.invites[row.id] || []).map(i => ({ userId: i.user_id, by: i.invited_by, at: Date.parse(i.created_at), nudgedAt: i.nudged_at ? Date.parse(i.nudged_at) : 0 })),
    // Asked to take a job, and the lead offered to someone (20261102070000_job_asks_and_handoff.sql)
    jobAsks: (x.jobAsks[row.id] || []).map(a => ({ itemId: a.item_id, userId: a.user_id, by: a.asked_by, message: a.message || '', answer: a.answer || null, at: Date.parse(a.created_at) })),
    leadOffer: (x.leadOffers[row.id] || []).map(o => ({ userId: o.user_id, by: o.offered_by, message: o.message || '', at: Date.parse(o.created_at) }))[0] || null,
    album: (x.album[row.id] || []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).filter(a => PHOTO_PATH.test(a.path)).map(a => ({ id: a.id, path: a.path, createdBy: a.created_by })),
    prep: (x.prep[row.id] || [])[0] ? x.prep[row.id][0].answers || {} : {},
    reactions: (x.reactions[row.id] || []).map(r => ({ userId: r.user_id, kind: r.kind }))
  });

  const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

  // The rows the app is built from, in one request: load_all() (20261101220000_load_all.sql) reads every
  // table as the caller. A database without that function still loads, table by table (about 24 requests),
  // the way the app did until 2026-10-02. A table the app starts reading belongs in both.
  let oneLoad = true;
  async function loadRows() {
    if (oneLoad) {
      const r = await sb.rpc('load_all');
      if (!r.error) return r.data;
      if (r.error.code !== 'PGRST202') throw r.error;   // anything but "no such function" is a real failure
      oneLoad = false;
    }
    // v6 Update 13: friends, requests and the invites you've had (a database without them still loads)
    const frP = state.email && !state.viewAs ? sb.rpc('friend_state').then(r => r, () => ({ error: true })) : Promise.resolve({ data: null });
    const [mem, grp, sp, of, it, gc, rs, dop, dvo, sop, svo, sui, scl, upd, org, alb, prp, rct, sgr, drf, nts, las, inv, jas, lof] = await Promise.all([
      sb.from('memberships').select('group_id,role,last_seen_at,pinned'),
      sb.from('groups').select('id,name,photo,photo_pos,demo'),
      sb.from('sparks').select('*').order('created_at', { ascending: false }),
      sb.from('offers').select('*').order('created_at'),
      sb.from('interests').select('spark_id,user_id,created_at,can_help'),
      sb.from('guest_contacts').select('spark_id,user_id,name,phone'),
      sb.from('rsvps').select('spark_id,user_id,status,created_at,attended'),
      sb.from('date_options').select('id,spark_id,day_date,day_time,who,created_by,created_at'),
      sb.from('date_votes').select('option_id,user_id'),
      sb.from('spot_options').select('id,spark_id,name,address,lat,lon,who,created_by,created_at'),
      sb.from('spot_votes').select('option_id,user_id'),
      // Descriptions, end times and shifts came with v6 Update 5; a database without them still loads
      sb.from('signup_items').select('id,spark_id,item,need,time,end_time,descr,shift_of,created_by,created_at')
        .then(r => r.error && r.error.code === '42703' ? sb.from('signup_items').select('id,spark_id,item,need,time,created_by,created_at') : r),
      sb.from('signup_claims').select('item_id,user_id,note,created_at'),
      sb.from('plan_updates').select('id,spark_id,body,audience,created_by,created_at'),
      // Co-hosts (20261101130000_cohosts.sql; the old organizers slot, retired 2026-09-30). A database without them still loads
      sb.from('cohosts').select('spark_id,user_id,created_at').order('created_at').then(r => r.error ? { data: [] } : r),
      sb.from('album_photos').select('id,spark_id,path,created_by,created_at'),
      sb.from('plan_prep').select('spark_id,answers'),
      sb.from('reactions').select('spark_id,user_id,kind'),
      // v6 Update 6: extra groups an event is posted to, and your drafts (a database without them still loads)
      sb.from('spark_groups').select('spark_id,group_id'),
      state.email ? sb.from('event_drafts').select('id,data,updated_at').order('updated_at', { ascending: false }) : Promise.resolve({ data: [] }),
      // v6 Update 7: notes about events and jobs that were taken down (a database without them still loads)
      state.email ? sb.from('notes').select('id,body,created_by,created_at').order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      // Asked to lead (20261102020000_float_and_ask.sql; a database without them still loads)
      state.email ? sb.from('lead_asks').select('spark_id,user_id,asked_by,created_at,message').order('created_at')
        .then(r => r.error && r.error.code === '42703' ? sb.from('lead_asks').select('spark_id,user_id,asked_by,created_at').order('created_at') : r) : Promise.resolve({ data: [] }),
      // Invites (20261030000000_friends.sql; nudged_at since 20261102040000_invited_and_nudge.sql)
      state.email ? sb.from('event_invites').select('spark_id,user_id,invited_by,created_at,nudged_at').order('created_at')
        .then(r => r.error && r.error.code === '42703' ? sb.from('event_invites').select('spark_id,user_id,invited_by,created_at').order('created_at') : r) : Promise.resolve({ data: [] }),
      // Job asks and lead offers (20261102070000_job_asks_and_handoff.sql; a database without them still loads)
      state.email ? sb.from('job_asks').select('item_id,spark_id,user_id,asked_by,message,answer,created_at,answered_at').then(r => r.error ? { data: [] } : r) : Promise.resolve({ data: [] }),
      state.email ? sb.from('lead_offers').select('spark_id,user_id,offered_by,message,created_at').then(r => r.error ? { data: [] } : r) : Promise.resolve({ data: [] })
    ]);
    [mem, grp, sp, of, it, gc, rs, dop, dvo, sop, svo, sui, scl, upd, org, alb, prp].forEach(must);
    const rows = (r) => r.error ? [] : r.data || [];
    const d = {
      memberships: mem.data, groups: grp.data, sparks: sp.data, offers: of.data, interests: it.data, guest_contacts: gc.data, rsvps: rs.data,
      date_options: dop.data, date_votes: dvo.data, spot_options: sop.data, spot_votes: svo.data, signup_items: sui.data, signup_claims: scl.data,
      plan_updates: upd.data, cohosts: org.data, album_photos: alb.data, plan_prep: prp.data,
      reactions: rows(rct), spark_groups: rows(sgr), event_drafts: rows(drf), notes: rows(nts), lead_asks: rows(las), event_invites: rows(inv), job_asks: rows(jas), lead_offers: rows(lof), profiles: []
    };
    // Names and photos of everyone on screen
    const ids = new Set([state.me]);
    d.sparks.forEach(s => ids.add(s.lead_id));
    [d.offers, d.interests, d.rsvps, d.cohosts, d.signup_claims, d.reactions].forEach(t => t.forEach(r => ids.add(r.user_id)));
    d.notes.forEach(n => ids.add(n.created_by));
    d.lead_asks.forEach(a => { ids.add(a.user_id); ids.add(a.asked_by); });
    d.event_invites.forEach(i => ids.add(i.user_id));
    d.job_asks.forEach(a => { ids.add(a.user_id); ids.add(a.asked_by); });
    d.lead_offers.forEach(o => ids.add(o.user_id));
    ids.delete(null); ids.delete(undefined);
    for (const part of chunks(Array.from(ids), 80)) {
      d.profiles.push(...must(await sb.from('profiles').select('id,name,avatar_path,place,bio').in('id', part)).data);
    }
    const frs = await frP;
    d.friend_state = frs.error ? null : frs.data;
    return d;
  }

  let loadSeq = 0, loadWritten = 0;   // loads overlap (30s refresh, a write's reload); older data never lands over newer
  let tapSeq = 0;                     // taps that show at once (quick, setRsvp), counted by saving(1)
  let extrasFor = null, extrasAt = 0, notifAt = 0;
  async function loadAll() {
    if (!sb) return;
    const seq = ++loadSeq, t0 = performance.now(), taps = tapSeq, midSave = savingN > 0;
    diagNote('load started');
    const d = await loadRows();
    const x = {
      rsvps: byKey(d.rsvps, 'spark_id'), dateOpts: byKey(d.date_options, 'spark_id'), dateVotes: byKey(d.date_votes, 'option_id'),
      spotOpts: byKey(d.spot_options, 'spark_id'), spotVotes: byKey(d.spot_votes, 'option_id'), signups: byKey(d.signup_items, 'spark_id'),
      claims: byKey(d.signup_claims, 'item_id'), updates: byKey(d.plan_updates, 'spark_id'), cohosts: byKey(d.cohosts, 'spark_id'),
      album: byKey(d.album_photos, 'spark_id'), prep: byKey(d.plan_prep, 'spark_id'),
      reactions: byKey(d.reactions, 'spark_id'),   // v6 Update 2 (reactions on past events)
      groups: byKey(d.spark_groups, 'spark_id'),
      leadAsks: byKey(d.lead_asks || [], 'spark_id'),   // a database without them still loads
      invites: byKey(d.event_invites || [], 'spark_id'),
      jobAsks: byKey(d.job_asks || [], 'spark_id'), leadOffers: byKey(d.lead_offers || [], 'spark_id')
    };

    const roles = {};
    d.memberships.forEach(m => { roles[m.group_id] = { role: m.role, lastSeen: Date.parse(m.last_seen_at), pinned: !!m.pinned }; });
    const va = state.viewAs;
    const drafts = va ? [] : d.event_drafts.map(d => ({ id: d.id, data: d.data || {}, saved: Date.parse(d.updated_at) }));
    const notes = va ? [] : d.notes.map(n => ({ id: n.id, body: n.body, createdBy: n.created_by, created: Date.parse(n.created_at) }));
    const groups = d.groups.map(g => Object.assign({ id: g.id, name: g.name, photo: g.photo, photoPos: g.photo_pos || null, demo: !!g.demo, role: null, lastSeen: 0, pinned: false }, (va ? va.roles : roles)[g.id] || {}))
      .filter(g => !va || va.roles[g.id])
      .sort((a, b) => runs(b) - runs(a) || a.name.localeCompare(b.name));

    // Previewing as someone else: only what they'd see (the rule in can_see_spark_row, minus shared links)
    const sparks = d.sparks.map(r => toSpark(r, d.offers, d.interests, d.guest_contacts, x)).filter(s => {
      const m = va && va.roles[s.groupId];
      const m2 = va && s.groupIds.map(id => va.roles[id]).find(Boolean);
      return !va || ((m || m2) && (s.visibility === 'group' || s.leadId === va.id || [m, m2].some(x => x && (x.role === 'owner' || x.role === 'admin')) || s.rsvps.some(r => r.userId === va.id)));
    });

    // Previewing as someone who isn't on any event on screen: their own name and photo aren't in the answer
    if (va && !d.profiles.some(p => p.id === va.id)) {
      d.profiles.push(...must(await sb.from('profiles').select('id,name,avatar_path,place,bio').eq('id', va.id)).data);
    }
    const profiles = {};
    d.profiles.forEach(p => { profiles[p.id] = { name: p.name || '', avatar: PHOTO_PATH.test(p.avatar_path || '') ? p.avatar_path : null, place: p.place || '', bio: p.bio || '' }; });
    const fd = !va && d.friend_state;
    const fr = fd ? {
      friends: (fd.friends || []).map(f => ({ id: f.id, name: f.name || '', avatar: PHOTO_PATH.test(f.avatar || '') ? f.avatar : null, since: Date.parse(f.since) || 0, groups: f.groups || [] })),
      incoming: (fd.incoming || []).map(f => ({ id: f.id, name: f.name || '', avatar: PHOTO_PATH.test(f.avatar || '') ? f.avatar : null, group: f.group || '', at: Date.parse(f.at) || 0 })),
      outgoing: fd.outgoing || [], invites: (fd.invites || []).map(i => ({ spark: i.spark, by: i.by, at: Date.parse(i.at) || 0, note: i.note || '' })), loaded: true
    } : state.viewAs ? { friends: [], incoming: [], outgoing: [], invites: [], loaded: true } : state.fr;
    fr.friends.concat(fr.incoming).forEach(f => { if (!profiles[f.id]) profiles[f.id] = { name: f.name, avatar: f.avatar, place: '', bio: '' }; });
    if (seq < loadWritten) return;   // a newer load already wrote fresher data
    // A tap that shows at once was made while this load ran, or its save was (or still is) on its way: this data can be
    // from before the save, and landing it undid the tap on screen until the next refresh (Going, then Maybe twice left
    // Maybe on; the You're helping bar blinked out, 2026-10-02). The refresh that follows the last save lands instead.
    if (state.loaded && (midSave || savingN > 0 || taps !== tapSeq)) return;
    loadWritten = seq;
    const mine = profiles[state.me] || {};
    if (performance.now() - t0 > 3000) diag('slow load', performance.now() - t0, 'waiting on the network');
    document.documentElement.setAttribute('data-loaded', 'true');   // tests wait for this
    setState({
      groups, sparks, profiles, drafts, notes, fr, loaded: true, fromCache: false, error: null,
      myName: mine.name || state.myName, myAvatar: mine.avatar || null, myPlace: mine.place || '', myBio: mine.bio || ''
    });
    writeCache();
    if (state.email && !va) syncPush();
    // The extras below change rarely: once per sign-in, then at most every 10 minutes (the 30-second refresh
    // used to repeat them every time, against the Supabase quota). Read state and settings: every 2 minutes.
    const who = state.me + ':' + (state.email || ''), now = Date.now(), extras = extrasFor !== who || now - extrasAt > 600000, notifDue = extras || now - notifAt > 120000;
    if (extras) { extrasFor = who; extrasAt = now; }   // signing in (same id, now with an email) counts as new
    if (notifDue) notifAt = now;
    // Whether you're the account that can wipe the demo content (Profile)
    if (extras && state.email && !va) {
      sb.from('demo_admins').select('user_id').eq('user_id', state.me).maybeSingle()
        .then(r => { if (!r.error) { setState({ demoAdmin: !!r.data }); writeCache(); if (r.data) { loadFeedback(); loadAccounts(); } } }, () => {});
    }
    // Notification read state and settings (signed-in people only)
    if (notifDue && state.email && !va) {
      const asked = Date.now();
      sb.from('notif_state').select('all_read_at,read_keys,topics,email').maybeSingle().then(r => {
        if (r.error || asked < notifSavedAt) return;   // a read/setting saved since then is newer than this answer
        const d = r.data || {};
        setState({ notif: { allReadAt: d.all_read_at ? Date.parse(d.all_read_at) : 0, read: d.read_keys || [], topics: d.topics || {}, email: d.email !== false, loaded: true } });
        writeCache();
      }, () => {});
    }
    // Member counts for the Groups page (a nicety: the page works without them)
    if (extras) sb.rpc('my_group_sizes').then(r => {
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
      if (state.viewAs) return;   // previewing as someone else: stay them until Exit (which reloads)
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
      toast(failed(e));
      return false;
    }
  };

  // Opening a shared idea link grants this session access to that one idea. An event you already see
  // (as a member of its group) isn't recorded: that access would outlast leaving or being removed from the group.
  const opened = new Set();
  const openLink = async (id) => {
    if (!id || opened.has(id) || previewing) return true;
    const seen = await sb.from('sparks').select('id').eq('id', id);
    if (!seen.error && seen.data && seen.data.length) { opened.add(id); return true; }
    const res = must(await sb.rpc('open_idea', { p_spark: id }));
    if (res.data) opened.add(id);
    return !!res.data;
  };

  // Load, and make sure a linked idea is reachable; an unknown one shows "That idea isn't up anymore"
  let routeLoading = 0;   // while a link is being opened, the background refresh doesn't call its event gone
  const loadForRoute = async () => {
    routeLoading++;
    try {
      if (state.screen === 'detail' && state.subjectId) {
        const ok = await openLink(state.subjectId);
        if (!ok) setState({ screen: 'sched', subjectId: null, goneOpen: true });
      }
      await loadFresh();
    } finally { routeLoading--; }
    if (state.screen === 'detail' && !subject()) setState({ screen: 'sched', subjectId: null, goneOpen: true });
    if (state.screen === 'groupPage') openGroupPage(state.gpId, true);
  };

  // ---------------------------------------------------------------------------
  // Gates: sign-in, name, guest info
  // ---------------------------------------------------------------------------

  const openLogin = (from, then, tap) => setState({
    loginStep: 'email', loginFrom: from || 'default', loginThen: then || null, loginTap: tap || null, loginMode: 'link',
    loginCode: '', resent: false, googleFailed: false, loginEmailOnly: false, nameAsk: null, guestOpen: false, menu: null
  });
  const closeLogin = () => setState({ loginStep: null, loginCode: '', loginThen: null, googleFailed: false, busy: null });

  const needSignIn = (fn, from) => { if (state.email) fn(); else openLogin(from, fn); };
  const needName = (fn) => { if (state.myName) fn(); else setState({ nameAsk: fn, nameText: '' }); };
  // Guests (not signed in) can only RSVP, with a name (owner, 2026-10-01). They give it once; it's kept on their
  // profile, so the next RSVP on this device doesn't ask again. The database refuses a guest's RSVP without it.
  const needGuest = (fn) => {
    if (state.email) { needName(fn); return; }
    if (state.guest) { fn(); return; }
    if (state.myName) { setState({ guest: { name: state.myName } }); fn(); return; }
    setState({ guestOpen: true, guestThen: fn, guestName: state.guestName || '' });
  };
  // Everything else (interest, suggestions, votes, jobs, photos) needs an account: sign-in, then the action
  // noteTap() just before needAccount() says what the tap was, in a form that survives the page reloading at Google
  // (owner, 2026-10-02: the email code finished the tap, Google dropped it). replayTap() does it on the way back.
  let tapNoted = null;
  const noteTap = (t) => { tapNoted = t; };
  const needAccount = (fn) => { const t = tapNoted; tapNoted = null; if (state.email) needName(fn); else openLogin('account', () => needName(fn), t); };
  const saveGuestContact = async (sparkId) => {
    if (state.email || !state.guest || !sparkId) return;
    must(await sb.from('guest_contacts').upsert({ spark_id: sparkId, user_id: state.me, name: state.guest.name, phone: null }, { onConflict: 'spark_id,user_id' }));
  };
  // After a guest's first Going or Maybe on an event (this visit): what an account adds
  const guestAsked = new Set();
  const askGuestToJoin = (s) => {
    if (state.email || guestAsked.has(s.id)) return;
    guestAsked.add(s.id);
    setTimeout(() => { if (!state.email && !state.confirm && !state.loginStep) setState({ confirm: {
      title: 'You’re on the list', body: 'Make a free account to get a reminder the day before, hear about changes, and sign up to help. Your RSVP comes with you.',
      cta: 'Create an account', keep: 'Not now', green: true, run: () => { setState({ confirm: null }); openLogin('account'); } } }); }, 900);
  };

  const saveName = async (name, stampEverywhere) => {
    if (state.viewAs) return;   // previewing as someone else: their name isn't ours to change
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
  // Opening a group always lands on its Plans tab (owner, 2026-10-03; it used to keep the last tab you were on)
  const openGroup = (g) => { if (!g) return; markSeen(g); go('browse', { groupId: g.id, phaseTab: 'plan' }); };
  const togglePin = (g) => {
    const pinned = !g.pinned;
    g.pinned = pinned;
    toast(pinned ? 'Pinned' : 'Unpinned', true);
    sb.from('memberships').update({ pinned }).eq('group_id', g.id).eq('user_id', state.me)
      .then(r => { if (r.error) throw r.error; }).catch(e => { console.error(e); g.pinned = !pinned; toast(failed(e)); });
  };

  // "View as a user" (demo admin): pick anyone with an account, and the app draws itself as them (look only)
  const openTesters = () => {
    if (state.testers) return setState({ testers: null });
    sb.rpc('demo_testers').then(r => {
      if (r.error) { console.error(r.error); toast(failed(r.error)); return; }
      setState({ testers: r.data || [] });
    }, () => toast(FAILED));
  };
  // Who they are in your groups (owner, 2026-10-01: view as any type of user): "Owner · Torrez Fitness, Member · Hub on Hunters"
  const testerLine = (t) => (/@example\.com$/.test(t.email || '') ? 'Demo person · ' : '') +
    ((t.memberships || []).map(m => ({ owner: 'Owner', admin: 'Admin' }[m.role] || 'Member') + ' · ' + ((groupById(m.group_id) || {}).name || 'a group')).join(', ') || t.email || '');
  const viewAsTester = (t) => {
    const roles = {};
    (t.memberships || []).forEach(m => { roles[m.group_id] = { role: m.role, pinned: !!m.pinned, lastSeen: Date.parse(m.last_seen_at) || 0 }; });
    previewing = true;
    setState({ viewAs: { id: t.user_id, name: t.name || 'User', roles }, me: t.user_id, email: t.email || 'user', myName: t.name || '', myAvatar: null, myPlace: '', myBio: '',
      testers: null, profSheet: false, notif: { allReadAt: 0, read: [], topics: {}, email: true, loaded: true }, demoAdmin: false, loaded: false });
    go('sched');
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
    return '<div data-screen-label="View as a user" style="display:flex;flex-direction:column;gap:12px"><div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;align-items:flex-start;gap:10px">' +
        '<div style="font-size:17px;font-weight:900;color:#0d1117">View as a user</div>' +
        '<div style="font-size:13.5px;line-height:1.4;font-weight:600;color:#5c6270">See the app the way anyone with an account sees it. Look only. Only you can see this.</div>' +
        '<button type="button" ' + on(openTesters) + ' aria-expanded="' + !!list + '" style="min-height:42px;padding:0 16px;border:1.5px solid #dcdfe6;border-radius:999px;background:#fff;color:#0d1117;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">' + (list ? 'Close' : 'Pick one') + '</button></div>' +
      (list ? '<div style="' + CARD + ';padding:4px 16px;display:flex;flex-direction:column">' + (list.length ? list.map((t, i) => '<div ' + on(() => viewAsTester(t)) + ' class="hov-row" data-tester="' + esc(t.email) + '" style="display:flex;align-items:center;gap:12px;min-height:54px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + ';cursor:pointer">' +
          face(t.user_id, t.name, 36, '#7b6ef0') + '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">' + esc(t.name) + '</div><div style="font-size:12.5px;font-weight:600;color:#8a909b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(testerLine(t)) + '</div></div></div>').join('')
        : '<div style="padding:14px 0;font-size:14px;font-weight:600;color:#6b7280">No one else has an account yet.</div>') + '</div>' : '') +
    '</div>';
  };

  const inviteLink = (code) => location.origin + '/join/' + code;
  // Copies with the clipboard API, then the older way (in-app browsers and pages without clipboard permission refuse
  // the first); only says "copied" when one of them worked
  const copy = (text, note) => {
    const done = () => toast(note, true), no = () => toast(IN_APP ? 'Couldn’t copy. Tap ··· then Open in browser.' : 'Couldn’t copy. Try again.');
    const older = () => {
      let ok = false;
      try {
        const t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(t); t.select();
        ok = document.execCommand('copy');
        document.body.removeChild(t);
      } catch (e) { ok = false; }
      if (ok) done(); else no();
    };
    try { navigator.clipboard.writeText(text).then(done, older); } catch (e) { older(); }
  };

  // Edit group (owners and admins): from a group's page or the Groups gear
  // People removed and blocked from rejoining (admins see and lift them; group_blocked() checks)
  const loadBlocked = (id) => sb.rpc('group_blocked', { p_group: id })
    .then(r => { if (r.error) throw r.error; if (state.membersOpen === id) setState({ blockedList: r.data || [] }); })
    .catch(e => console.error(e));
  const unblock = (g, b) => run(async () => {
    must(await sb.rpc('unblock_member', { p_group: g.id, p_user: b.user_id }));
    await loadBlocked(g.id);
  }).then(ok => { if (ok) toast((firstName(b.name) || b.name) + ' can rejoin with the link', true); });
  // Owners: a new code and link; the old ones stop working (rotate_group_code())
  const askNewCode = (g) => setState({ confirm: { title: 'Get a new invite link?', body: 'The current link and code stop working. Everyone already in ' + g.name + ' stays.', cta: 'Get a new link', keep: 'Not now',
    run: () => run(async () => {
      const code = must(await sb.rpc('rotate_group_code', { p_group: g.id })).data;
      groupCodes[g.id] = code || null;
      setState({ gpCode: code || '' });
    }, { confirm: null }).then(ok => { if (ok) toast('New invite link ready', true); }) } });
  const loadMembers = async (id) => {
    const res = must(await sb.rpc('group_members', { p_group: id }));
    const list = res.data || [];
    setState({ membersList: list, gpMembers: list.length });
  };
  const openGroupPage = async (id, quiet, from) => {
    if (!quiet) go('groupPage', { gpId: id, gpCode: '', gpMembers: null, membersList: null, gpRename: null, gpFail: false, gpFrom: from || 'groups' });
    try {
      const code = must(await sb.rpc('group_code', { p_group: id }));
      setState({ gpCode: code.data || '', gpFail: false });
      await loadMembers(id);
    } catch (e) { console.error(e); if (state.gpId === id) setState({ gpFail: true }); }
  };
  const closeGroupPage = () => {
    const g = groupById(state.gpId);
    if (state.gpFrom === 'browse' && g) go('browse', { groupId: g.id }); else go('groups');
  };
  const openMembers = () => { setState({ membersOpen: state.gpId, membersQ: '', blockedList: null }); const g = groupById(state.gpId); if (g && runs(g)) loadBlocked(g.id); };
  // v6 Update 13: every member can open the list (to add friends); admins also get emails and role actions
  const openMembersOf = (g) => {
    setState({ membersOpen: g.id, membersQ: '', memberOpen: null, membersList: null, blockedList: null });
    if (runs(g)) loadBlocked(g.id);
    sb.rpc(runs(g) ? 'group_members' : 'group_people', { p_group: g.id })
      .then(r => { if (r.error) throw r.error; if (state.membersOpen === g.id) setState({ membersList: r.data || [] }); })
      .catch(e => { console.error(e); setState({ membersOpen: null }); toast(failed(e)); });
  };

  // Owners set roles (five owners at most, never none); admins see the list
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
      setState({ confirm: { title: 'Make ' + first + ' an owner?', body: 'Owners can do everything admins can, and choose who the admins and owners are. They could also take the owner role away from you. A group can have up to five owners.', cta: 'Make them an owner', keep: 'Not now', run: apply } });
    } else if (m.role === 'owner') {
      setState({ confirm: { title: me ? 'Step down as owner?' : 'Remove ' + first + ' as owner?', body: me ? 'You’ll be an admin and can’t change roles any more.' : first + ' will be an admin.', cta: me ? 'Step down' : 'Remove as owner', keep: 'Not now', danger: true, run: apply } });
    } else apply();
  };

  // Admins remove members; owners also remove admins and other owners (remove_member() checks).
  // Remove and block: they also can't rejoin with the link, even a new one, until an admin unblocks them.
  const removeMember = (g, m, block) => {
    const first = firstName(m.name) || m.name;
    setState({ confirm: { title: (block ? 'Remove and block ' : 'Remove ') + first + (block ? '?' : ' from ' + g.name + '?'),
      body: block
        ? 'They won’t see the group’s events any more and can’t rejoin, even with a new link. The events they posted and their RSVPs stay. You can unblock them from Members.'
        : 'They won’t see the group’s events any more. The events they posted and their RSVPs stay. They can rejoin with the group’s link.',
      cta: block ? 'Remove and block' : 'Remove', keep: 'Keep them', danger: true,
      run: () => run(async () => {
        must(await sb.rpc('remove_member', { p_group: g.id, p_user: m.user_id, p_block: !!block }));
        await loadMembers(g.id);
        if (block) await loadBlocked(g.id);
      }, { confirm: null, memberOpen: null }).then(ok => { if (ok) toast(first + (block ? ' was removed and blocked' : ' was removed'), true); }) } });
  };

  const saveRename = async (g) => {
    const name = (state.gpRename || '').trim();
    if (name.length < 2 || name === g.name || state.busy) return;
    const ok = await run(async () => { must(await sb.rpc('rename_group', { p_group: g.id, p_name: name })); }, { gpRename: null });
    if (ok) toast('Group renamed', true);
  };
  const askDeleteGroup = (g) => setState({ gpDel: '' });
  const deleteGroup = async (g) => {
    if ((state.gpDel || '').trim() !== 'DELETE' || state.busy) return;
    const ok = await run(async () => { must(await sb.rpc('delete_group', { p_group: g.id })); }, { gpDel: null });
    if (!ok) return;
    if (state.groupId === g.id) setState({ groupId: null });
    go('sched');
    toast(g.name + ' was deleted', true);
  };

  // Leave a group (owner, 2026-09-30): a quiet link at the bottom of its page. The last owner can't (leave_group()
  // refuses too): they make someone else an owner first, or delete the group.
  const leaveGroup = (g) => {
    setState({ confirm: { title: 'Leave ' + g.name + '?', body: 'You won’t see its events any more. The events you posted and your RSVPs stay. You can rejoin with the group’s link.', cta: 'Leave', keep: 'Stay', danger: true,
      run: async () => {
        if (state.viewAs || state.busy) return;
        setState({ busy: 'save' });
        try {
          await ensureSession();
          must(await sb.rpc('leave_group', { p_group: g.id }));
          await loadFresh();
          setState({ busy: null, confirm: null, groupId: state.groupId === g.id ? null : state.groupId });
          go('groups');
          toast('You left ' + g.name, true);
        } catch (e) {
          console.error(e);
          setState({ busy: null, confirm: null });
          toast(/owner first/.test(e.message || '') ? 'You’re its only owner. Make someone else an owner first (Edit group → Members), or delete the group.' : FAILED);
        }
      } } });
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
      toast(name + ' is ready. Share the link to invite people.', true);
    } catch (e) {
      console.error(e);
      setState({ busy: null });
      toast(/lot of new groups/.test(e.message || '') ? 'That’s a lot of new groups at once. Try again in a bit.' : failed(e));
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
      const before = myGroups().map(g => g.id);
      const res = must(await sb.rpc('join_group', { p_code: code }));
      if (!res.data) { setState({ busy: null, joinBad: true }); return; }
      await loadFresh();
      if (before.indexOf(res.data) < 0) calAfterJoin(res.data, before, false);
      const g = groupById(res.data);
      setState({ busy: null, joinOpen: false, joinCode: '' });
      openGroup(g);
    } catch (e) {
      console.error(e);
      setState({ busy: null });
      toast(failed(e));
    }
  };

  // ---- Friend links (/add/CODE; v6 Update 13) ----------------------------------------------------
  // Opening someone's link asks "Add {name} as a friend?"; yes makes you friends straight away (sharing
  // the link was their yes). Signed out: sign in first; the code waits in sessionStorage (Google reloads the page).
  // state.frAdd = { code, who (undefined while loading, null if the code matches nothing), busy, self }
  const PENDING_FRIEND = 'pendingFriend';
  const pendingFriend = () => { try { return sessionStorage.getItem(PENDING_FRIEND) || ''; } catch (e) { return ''; } };
  const setPendingFriend = (code) => { try { if (code) sessionStorage.setItem(PENDING_FRIEND, code); else sessionStorage.removeItem(PENDING_FRIEND); } catch (e) { /* fine */ } };
  const startFriendAdd = (code) => {
    setPendingFriend(code);
    setState({ frAdd: { code, who: undefined, busy: false }, installPop: false, menu: null });
    sb.rpc('friend_link_preview', { p_code: code }).then(r => {
      if (r.error) throw r.error;
      const w = (r.data || [])[0];
      if (state.frAdd && state.frAdd.code === code) setState({ frAdd: Object.assign({}, state.frAdd, { self: !!(w && w.is_you), who: w ? { name: w.name, avatar: PHOTO_PATH.test(w.avatar_path || '') ? w.avatar_path : null } : null }) });
    }).catch(e => { console.error(e); if (state.frAdd && state.frAdd.code === code) setState({ frAdd: Object.assign({}, state.frAdd, { who: { name: '', avatar: null } }) }); });
  };
  const takeFriendLink = (code) => { if (ADD_PATH.test(location.pathname) || /^#\/add\//.test(location.hash)) history.replaceState(null, '', '/'); startFriendAdd(code); };
  const closeFrAdd = () => { setPendingFriend(''); setState({ frAdd: null }); };
  const confirmFrAdd = () => {
    const fa = state.frAdd;
    if (!fa || fa.busy) return;
    if (!state.email) { setState({ frAdd: null }); return openLogin('friend', () => startFriendAdd(fa.code)); }   // the code stays pending (Google reloads the page)
    setState({ frAdd: Object.assign({}, fa, { busy: true }) });
    (async () => {
      try {
        await ensureSession();
        const r = (must(await sb.rpc('add_friend_by_code', { p_code: fa.code })).data || [])[0] || {};
        const first = firstName((fa.who && fa.who.name) || '') || 'them';
        if (r.result === 'self') return setState({ frAdd: Object.assign({}, fa, { busy: false, self: true }) });
        if (r.result === 'bad') return setState({ frAdd: Object.assign({}, fa, { busy: false, who: null }) });
        setPendingFriend('');
        setState({ frAdd: null });
        await loadFresh();
        go('groups', { pplTab: 'friends', pplSearch: false, pplQ: '' });
        toast(r.result === 'already' ? 'You and ' + first + ' are already friends' : 'You and ' + first + ' are friends', true);
      } catch (e) {
        console.error(e);
        setState({ frAdd: Object.assign({}, fa, { busy: false }) });
        toast(failed(e));
      }
    })();
  };
  function viewFrAdd() {
    const fa = state.frAdd, w = fa.who, close = fa.busy ? null : closeFrAdd;
    const ok = (label) => '<button type="button" ' + on(closeFrAdd) + ' style="' + primary(true) + '">' + label + '</button>';
    if (w === undefined) return modal('Friend link', close, '<div role="status" style="padding:18px 0;text-align:center;font-size:15px;font-weight:600;color:#8a909b">Loading…</div>', { z: 46 });
    if (w === null) return modal('Friend link', close, h3Html('That friend link doesn’t work anymore') + paraHtml('Ask them to send you a new one.') + ok('OK'), { z: 46 });
    if (fa.self) return modal('Friend link', close, h3Html('That’s your link') + paraHtml('Send it to people you want to be friends with on Spark Hub.') + ok('OK'), { z: 46 });
    const first = firstName(w.name) || 'them', url = w.avatar ? photoUrl(w.avatar) : null;
    return modal('Add a friend', close,
      avatarSpan(w.name, w.name, url, 72, 'align-self:center') +
      '<h3 style="margin:0;text-align:center;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117;text-wrap:balance">' + (state.email ? 'Add ' + esc(w.name || 'them') + ' as a friend?' : esc(w.name || 'Someone') + ' wants to be friends on Spark Hub') + '</h3>' +
      '<p style="margin:0;text-align:center;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270;text-wrap:pretty">Friends can invite each other to events, even across groups.</p>' +
      '<div style="margin-top:4px;display:flex;flex-direction:column;gap:8px">' +
        '<button type="button" ' + on(confirmFrAdd) + ' aria-disabled="' + !!fa.busy + '" style="' + primary(!fa.busy) + '">' + (fa.busy ? 'Adding…' : state.email ? 'Add friend' : 'Sign in to add ' + esc(first)) + '</button>' +
        '<button type="button" ' + on(() => { if (!fa.busy) closeFrAdd(); }) + ' style="' + SECONDARY + '">Not now</button></div>', { z: 46, max: 340 });
  }

  // ---- Invite links (/join/CODE; design handoff "Invite flow", 2026-09-29) ------------------------
  // The group's name and photo lead every screen; the code itself is never shown. Signed out: the invite
  // landing (Google, or a 6-digit email code in a pop-up), then the join runs by itself. Signed in before
  // the tap: one confirm (it may be the wrong account). Then Welcome to {group} (once per group) → its
  // Plans tab. state.inv = { code, group (undefined while loading, null if the code matches nothing),
  // step: land · confirm · joining · neterr · welcome · bad, busy, gid, copied }.
  const PENDING_INVITE = 'pendingInvite', WELCOMED = 'spark-hub-welcomed-groups';
  const IN_APP = /Instagram|FBAN|FBAV|Messenger|Line\/|TikTok|Snapchat/i.test(navigator.userAgent);
  const DEVICE = /iPhone|iPod|Android/i.test(navigator.userAgent) ? 'phone' : 'device';   // "this phone" reads wrong on a computer or tablet
  const pendingInvite = () => { try { const c = sessionStorage.getItem(PENDING_INVITE) || ''; return /^[A-Za-z0-9]{6}$/.test(c) ? c : ''; } catch (e) { return ''; } };
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
      // Out of tries: show it without the group's name and photo, so Join still works (it doesn't need the preview)
      else if (state.inv && state.inv.code === code && state.inv.group === undefined) setInv({ group: { name: '', photo: null } });
    }
  };
  // Opening the link: signed in already → the confirm pop-up over their Calendar; otherwise the landing
  const startInvite = (code, step) => {
    setPending(code);
    setState({ inv: { code, group: undefined, step: step || (state.email ? 'confirm' : 'land') }, screen: 'sched', joinOpen: false, loginStep: null, installPop: false, menu: null });
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
      if (before.indexOf(id) < 0 || isNew) calAfterJoin(id, before, isNew);
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
      setState({ inv: { code, gid: id, group, step: 'welcome' }, screen: 'sched' });
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
    if (g) { markSeen(g); go('browse', { groupId: g.id, phaseTab: tab }); } else go('sched');
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

  const UPD_TO = { going: 'To people going', maybe: 'To maybes', noreply: 'To people who haven’t RSVP’d' };
  const askRemoveUpdate = (s, u) => setState({ confirm: { title: 'Remove this update?', body: 'It comes off the event page and people’s notifications. Anyone who already saw it on their phone keeps that.', cta: 'Remove it', keep: 'Keep it', danger: true,
    run: () => run(async () => { must(await sb.from('plan_updates').delete().eq('id', u.id)); }, { confirm: null }).then(ok => { if (ok) toast('Update removed', true); }) } });
  const peopleIn = (s) => (s.planned ? s.rsvps.filter(r => r.status !== 'no').map(r => r.userId).concat(...s.signups.map(it => it.claims.map(c => c.userId))) : s.interested.slice())
    .filter((u, i, a) => a.indexOf(u) === i);
  // Cancel or delete (owner, 2026-09-30): Cancel tells everyone in it (going, maybe, helpers; an idea: the people
  // interested) with an optional reason; Delete takes it down quietly. With nobody in it, it's just Delete.
  // Cancel: marks it cancelled and tells everyone; it stays up (owner, 2026-09-30)
  const cancelEvent = (s, reason) => run(async () => {
    must(await sb.rpc('cancel_event', { p_spark: s.id, p_reason: (reason || '').trim().slice(0, 160) || null }));
  }, { takeDown: null }).then(ok => { if (ok) toast('Cancelled. Everyone in it got a note.', true); });
  const takeDown = (s, quiet, reason) => {
    const photos = s.photoPaths.concat(s.mood);
    run(async () => {
      must(await sb.rpc('delete_event', { p_spark: s.id, p_quiet: !!quiet, p_reason: (reason || '').trim().slice(0, 160) || null }));
    }, () => {   // land where the Back button would have: where you came from, else the group's page, else the Calendar
      const b = state.back, g = groupById(s.groupId), member = !!(g && g.role);
      return { confirm: null, takeDown: null, screen: b ? b.screen : member ? 'browse' : 'calendar', groupId: b ? (b.groupId || state.groupId) : member ? g.id : state.groupId, subjectId: null, back: null };
    }).then(ok => { if (!ok) return; deletePhotos(photos); toast(quiet ? 'Deleted' : 'Cancelled. Everyone in it got a note.', true); });
  };
  // A past event is only deleted (owner, 2026-10-01: nothing left to cancel), quietly
  const askDelete = (s, past) => {
    const n = peopleIn(s).filter(u => u !== state.me).length;
    if (past) return setState({ confirm: { title: 'Delete this event?', body: 'It already happened, so no one is told. Its album and replies go too. This can’t be undone.',
      cta: 'Delete it', keep: 'Keep it', danger: true, run: () => takeDown(s, true) } });
    if (n && !s.cancelledAt) return setState({ takeDown: { id: s.id, reason: '' } });
    setState({ confirm: { title: 'Delete this ' + (s.planned ? 'event' : 'idea') + '?', body: (s.cancelledAt ? 'Everyone already got the cancellation note; deleting tells no one.' : 'Nobody has RSVP’d yet, so no one needs telling.') + ' This can’t be undone.',
      cta: 'Delete it', keep: 'Keep it', danger: true, run: () => takeDown(s, true) } });
  };
  function viewTakeDown() {
    const td = state.takeDown, s = state.sparks.find(x => x.id === td.id);
    if (!s) return '';
    const close = () => setState({ takeDown: null }), n = peopleIn(s).filter(u => u !== state.me).length, word = s.planned ? 'event' : 'idea';
    return modal('Cancel or delete', close,
      h3Html('Cancel or delete?') +
      '<div data-cancel-opt style="display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;background:#fdeef0">' +
        '<div><div style="font-size:16px;font-weight:900;color:#9b1c31">Cancel it</div>' +
          '<div style="margin-top:2px;font-size:14px;line-height:1.4;font-weight:600;color:#7a1626">' + (n === 1 ? 'The 1 person in it gets' : 'The ' + n + ' people in it get') + ' a note that it’s off. It stays up, marked Cancelled, until you delete it.</div></div>' +
        '<textarea class="fld" rows="2" maxlength="160" aria-label="Reason (optional)" placeholder="Add a reason (optional), e.g. Rained out, back next week!" ' + onInput(e => { if (e.type === 'input') setState({ takeDown: Object.assign({}, state.takeDown, { reason: e.target.value.slice(0, 160) }) }); }) +
          ' style="width:100%;display:block;background:#fff;border:1.5px solid #f5c2cb;border-radius:12px;padding:10px 12px;font-family:inherit;font-size:16px;line-height:1.4;font-weight:600;color:#0d1117;resize:none;outline:none">' + esc(td.reason) + '</textarea>' +
        '<button type="button" ' + on(() => { if (!state.busy) cancelEvent(s, td.reason); }) + ' style="' + primary(true) + ';background:#9b1c31">' + (state.busy ? 'Cancelling…' : 'Cancel and tell ' + (n === 1 ? '1 person' : n + ' people')) + '</button>' +
      '</div>' +
      '<div data-delete-opt style="display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:16px;background:#f4f5f7">' +
        '<div><div style="font-size:16px;font-weight:900;color:#0d1117">Delete quietly</div>' +
          '<div style="margin-top:2px;font-size:14px;line-height:1.4;font-weight:600;color:#5c6270">No one is told. The ' + word + ' just disappears.</div></div>' +
        '<button type="button" ' + on(() => { if (!state.busy) takeDown(s, true); }) + ' style="' + SECONDARY + '">Delete without telling anyone</button>' +
      '</div>' +
      '<button type="button" class="hov-outline" ' + on(close) + ' style="' + SECONDARY + '">Keep it</button>',
      { z: 34, max: 380 });
  }

  // ---------------------------------------------------------------------------
  // Taking part: interest, suggestions, the lead's calls, mood board
  // ---------------------------------------------------------------------------

  // Taking interest back needs nothing; showing interest asks a guest for their info
  const toggleInterest = (s) => {
    if (s.interested.indexOf(state.me) > -1) {
      quick(s, { interested: s.interested.filter(u => u !== state.me), canHelp: s.canHelp.filter(u => u !== state.me) },
        async () => { must(await sb.from('interests').delete().eq('spark_id', s.id).eq('user_id', state.me)); });
      return;
    }
    noteTap({ k: 'interest', id: s.id });
    needAccount(() => quick(s, { interested: [state.me].concat(s.interested.filter(u => u !== state.me)) },
      async () => { must(await sb.from('interests').insert({ spark_id: s.id, user_id: state.me })); }));
  };

  // Looking for a host (social-science review, 2026-10-01): floating an idea and hosting it are separate jobs
  const setWantsHost = (s, on_) => run(async () => { must(await sb.rpc('set_wants_host', { p_spark: s.id, p_on: on_ })); });
  const takeTheLead = (s) => (noteTap({ k: 'lead', id: s.id }), needAccount(() => setState({ confirm: { title: 'Lead ' + s.text + '?', green: true, cta: 'I’ll lead it', keep: 'Not now',
    body: 'You’ll lead it: pick a date and place, then make it a plan. ' + firstName(nameOf(s.leadId, s.leadName)) + ' stays interested and gets a note.',
    run: () => run(async () => { must(await sb.rpc('take_the_lead', { p_spark: s.id })); }, { confirm: null }) } })));
  // Only someone in one of the event's groups can take the lead (20261102020000_float_and_ask.sql): a link holder
  // from outside, or a guest, sees that it needs a lead but gets no I'll lead
  const inItsGroups = (s) => s.groupIds.some(id => { const g = groupById(id); return !!(g && g.role); });
  // Ask someone to lead (owner, 2026-10-02): the floater, a co-lead or a group admin picks a person from the event's
  // groups. They get one push and a row in the bell, and the idea's lead row tells them who asked
  const openLeadAsk = (s) => {
    setState({ leadAsk: { id: s.id, people: null, q: '' } });
    Promise.all(s.groupIds.map(g => sb.rpc('group_people', { p_group: g }).then(r => r, () => ({ error: true }))))
      .then(rs => { const got = rs.filter(r => !r.error);   // an admin may not be in every group it's posted to
        if (!got.length) throw (rs[0] && rs[0].error) || new Error('no groups');
        const seen = {}, people = [].concat(...got.map(r => r.data || [])).filter(p => { const id = p.user_id || p.id; if (seen[id]) return false; seen[id] = 1; return true; });
        if (state.leadAsk && state.leadAsk.id === s.id) setState({ leadAsk: Object.assign({}, state.leadAsk, { people }) }); })
      .catch(e => { console.error(e); setState({ leadAsk: null }); toast(failed(e)); });
  };
  // ---- Asking someone to take a job, and handing the lead on (owner, 2026-10-02; 20261102070000_job_asks_and_handoff.sql).
  // A job ask is personal: the lead finishes "I thought of you because…", asks one person at a time, two open at most
  // per job; the person answers I'm in (signed up, Going) or Can't this time. Jobs with shifts can't be asked for yet.
  const JOB_ASK_LEAD = 'I thought of you because ';
  // The people a lead can pick: the event's groups' members and your friends
  const peopleFor = (s) => Promise.all(s.groupIds.map(g => sb.rpc('group_people', { p_group: g }).then(r => r.error ? [] : r.data || [], () => [])))
    .then(rs => { const seen = {}, out = [];
      [].concat(...rs).concat(state.fr.friends || []).forEach(p => { const id = p.user_id || p.id; if (id && !seen[id]) { seen[id] = 1; out.push({ id, name: p.name || 'Someone', avatar: p.avatar_path || p.avatar || null }); } });
      return out.sort((a, b) => a.name.localeCompare(b.name)); });
  const openAsks = (s, itemId) => s.jobAsks.filter(a => a.itemId === itemId && !a.answer && !onJob(s, itemId, a.userId));
  const onJob = (s, itemId, u) => s.signups.some(it => it.id === itemId && it.claims.some(c => c.userId === u));
  const openJobAsk = (s, j) => {
    setState({ jobAsk: { id: s.id, item: j.id, people: null, q: '', why: '' } });
    peopleFor(s).then(people => { if (state.jobAsk && state.jobAsk.item === j.id) setState({ jobAsk: Object.assign({}, state.jobAsk, { people }) }); });
  };
  const askForJob = (s, itemId, u) => {
    const why = (state.jobAsk.why || '').trim();
    if (!why) return toast('Finish the line first: I thought of you because…');
    if (openAsks(s, itemId).length >= 2) return;
    const msg = JOB_ASK_LEAD + why.replace(/^because\s+/i, '');
    quick(s, { jobAsks: s.jobAsks.concat({ itemId, userId: u, by: state.me, message: msg, answer: null, at: Date.now() }) },
      async () => { must(await sb.rpc('ask_for_job', { p_item: itemId, p_user: u, p_message: msg })); });
  };
  const withdrawJobAsk = (s, a) => quick(s, { jobAsks: s.jobAsks.filter(x => !(x.itemId === a.itemId && x.userId === a.userId)) },
    async () => { must(await sb.rpc('withdraw_job_ask', { p_item: a.itemId, p_user: a.userId })); });
  const answerJobAsk = (s, a, yes) => run(async () => { must(await sb.rpc('answer_job_ask', { p_item: a.itemId, p_in: yes })); })
    .then(ok => { if (ok) toast(yes ? 'You’re on it. ' + firstName(nameOf(a.by)) + ' will see you’re in.' : 'Thanks for letting ' + firstName(nameOf(a.by)) + ' know.', true); });
  function viewJobAsk() {
    const ja = state.jobAsk, s = state.sparks.find(x => x.id === ja.id), j = s && s.signups.find(it => it.id === ja.item);
    if (!s || !j) return '';
    const close = () => setState({ jobAsk: null }), q = (ja.q || '').trim().toLowerCase(), open = openAsks(s, j.id), two = open.length >= 2, ready = !!(ja.why || '').trim();
    const list = (ja.people || []).filter(p => p.id !== state.me && hostIds(s).indexOf(p.id) < 0 && !onJob(s, j.id, p.id) && (!q || p.name.toLowerCase().indexOf(q) > -1));
    const btn = (p) => { const a = s.jobAsks.find(x => x.itemId === j.id && x.userId === p.id);
      if (a) return '<span data-asked style="flex:0 0 auto;font-size:14px;font-weight:800;color:' + (a.answer === 'cant' ? '#6b7280' : '#0f7a3c') + '">' + (a.answer === 'cant' ? 'Can’t this time' : '✓ Asked') + '</span>';
      const ok = ready && !two;
      return '<button type="button" ' + on(() => askForJob(s, j.id, p.id)) + ' aria-label="Ask ' + esc(p.name) + '" aria-disabled="' + !ok + '" style="flex:0 0 auto;min-height:38px;padding:0 18px;border:0;border-radius:999px;background:' + (ok ? '#5b4ae8' : '#d5d8df') + ';color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;cursor:' + (ok ? 'pointer' : 'default') + '">Ask</button>'; };
    return modal('Ask someone to take it', close,
      h3Html('Ask someone to take “' + esc(j.item) + '”') +
      paraHtml('A personal ask lands better than a post to everyone. Ask one or two people at a time; they can say I’m in or Can’t this time.') +
      '<label data-job-why style="display:flex;flex-direction:column;gap:6px"><span style="font-size:15px;font-weight:800;color:#0d1117">I thought of you because…</span>' +
        '<input class="fld" type="text" maxlength="170" aria-label="I thought of you because" placeholder="you were great on barricades last year" value="' + esc(ja.why || '') + '" ' + onInput(e => { if (e.type === 'input') setState({ jobAsk: Object.assign({}, state.jobAsk, { why: e.target.value.slice(0, 170) }) }); }) +
          ' style="' + FIELD + '"></label>' +
      '<div data-job-ask-count role="status" style="font-size:13.5px;font-weight:800;color:' + (two ? '#b07a0a' : '#6b7280') + '">' + (two ? 'That’s two waiting. Wait for an answer, or withdraw one.' : open.length + ' of 2 asked') + '</div>' +
      ((ja.people || []).length > 7 ? '<input class="fld" type="search" aria-label="Search people" placeholder="Search" value="' + esc(ja.q || '') + '" ' + onInput(e => { if (e.type === 'input') setState({ jobAsk: Object.assign({}, state.jobAsk, { q: e.target.value.slice(0, 40) }) }); }) + ' style="' + FIELD + '">' : '') +
      (ja.people === null ? paraHtml('Loading…') : !list.length ? paraHtml(q ? 'Nobody by that name.' : 'No one else to ask yet.') :
        '<div style="display:flex;flex-direction:column;max-height:42vh;overflow:auto">' + list.map((p, i) =>
          '<div data-job-ask-row="' + esc(p.name) + '" style="display:flex;align-items:center;gap:12px;min-height:54px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + '">' +
            face(p.id, p.name, 34) + '<span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.name) + '</span>' + btn(p) + '</div>').join('') + '</div>'));
  }
  // Under a job, for the lead: who's been asked and how it went
  const jobAskLine = (s, j) => {
    const asks = s.jobAsks.filter(a => a.itemId === j.id && !onJob(s, j.id, a.userId)), open = openAsks(s, j.id);
    const full = j.need && j.claims.length >= j.need;
    const rows = asks.map(a => '<div data-job-asked="' + esc(firstName(nameOf(a.userId))) + '" style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#5c6270">' + face(a.userId, nameOf(a.userId), 22) +
      '<span style="flex:1;min-width:0">' + (a.answer === 'cant' ? esc(firstName(nameOf(a.userId))) + ' can’t this time' : 'Asked ' + esc(firstName(nameOf(a.userId))) + ' · waiting') + '</span>' +
      (a.answer ? '' : '<span ' + on(() => withdrawJobAsk(s, a)) + ' style="font-size:13.5px;font-weight:800;color:#9b1c31;cursor:pointer">Withdraw</span>') + '</div>').join('');
    const ask = full ? '' : open.length >= 2 ? '<span style="font-size:13.5px;font-weight:700;color:#8a909b">Two asked. Wait for an answer, or withdraw one.</span>'
      : '<span ' + on(() => openJobAsk(s, j)) + ' data-ask-job role="button" style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:36px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(14, '#5b4ae8', 2.8) + 'Ask someone</span>';
    return !rows && !ask ? '' : '<div data-job-asks style="display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1px solid #f2f3f6">' + rows + ask + '</div>';
  };

  // Hand the lead to someone: they lead it once they say yes; you stay on as a co-lead. One open offer at a time
  const openHandOff = (s) => {
    setState({ handOff: { id: s.id, people: null, q: '', note: '' }, leadsSheet: null });
    peopleFor(s).then(people => { if (state.handOff && state.handOff.id === s.id) setState({ handOff: Object.assign({}, state.handOff, { people }) }); });
  };
  const offerLead = (s, u) => {
    const note = (state.handOff.note || '').trim();
    quick(s, { leadOffer: { userId: u, by: state.me, message: note, at: Date.now() } },
      async () => { must(await sb.rpc('offer_lead', { p_spark: s.id, p_user: u, p_message: note || null })); },
      (ok) => { if (ok) { setState({ handOff: null }); toast('Asked ' + firstName(nameOf(u)) + ' to take it over. You lead it until they say yes.', true); } });
  };
  const withdrawLeadOffer = (s) => quick(s, { leadOffer: null }, async () => { must(await sb.rpc('withdraw_lead_offer', { p_spark: s.id })); });
  const answerLeadOffer = (s, yes) => run(async () => { must(await sb.rpc('answer_lead_offer', { p_spark: s.id, p_yes: yes })); })
    .then(ok => { if (ok) toast(yes ? 'You’re leading it now. ' + firstName(nameOf(s.leadId, s.leadName)) + ' stays on as a co-lead.' : 'Thanks for letting ' + firstName(nameOf(s.leadId, s.leadName)) + ' know.', true); });
  function viewHandOff() {
    const ho = state.handOff, s = state.sparks.find(x => x.id === ho.id);
    if (!s) return '';
    const close = () => setState({ handOff: null }), q = (ho.q || '').trim().toLowerCase();
    const list = (ho.people || []).filter(p => p.id !== state.me && (!q || p.name.toLowerCase().indexOf(q) > -1));
    return modal('Hand it to someone', close,
      h3Html('Hand it to someone') +
      paraHtml('They lead <b style="font-weight:800;color:#0d1117">' + esc(s.text) + '</b> once they say yes. Until then it’s yours, and after, you stay on as a co-lead.') +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:15px;font-weight:800;color:#0d1117">A note <span style="font-weight:600;color:#8a909b">(optional)</span></span>' +
        '<input class="fld" type="text" maxlength="200" aria-label="A note" placeholder="e.g. You know this crowd better than I do" value="' + esc(ho.note || '') + '" ' + onInput(e => { if (e.type === 'input') setState({ handOff: Object.assign({}, state.handOff, { note: e.target.value.slice(0, 200) }) }); }) + ' style="' + FIELD + '"></label>' +
      ((ho.people || []).length > 7 ? '<input class="fld" type="search" aria-label="Search people" placeholder="Search" value="' + esc(ho.q || '') + '" ' + onInput(e => { if (e.type === 'input') setState({ handOff: Object.assign({}, state.handOff, { q: e.target.value.slice(0, 40) }) }); }) + ' style="' + FIELD + '">' : '') +
      (ho.people === null ? paraHtml('Loading…') : !list.length ? paraHtml(q ? 'Nobody by that name.' : 'No one else to hand it to yet.') :
        '<div style="display:flex;flex-direction:column;max-height:42vh;overflow:auto">' + list.map((p, i) =>
          '<div data-hand-row="' + esc(p.name) + '" style="display:flex;align-items:center;gap:12px;min-height:54px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + '">' +
            face(p.id, p.name, 34) + '<span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.name) + '</span>' +
            '<button type="button" ' + on(() => offerLead(s, p.id)) + ' aria-label="Hand it to ' + esc(p.name) + '" style="flex:0 0 auto;min-height:38px;padding:0 16px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Ask</button></div>').join('') + '</div>'));
  }
  // On the event page, for the person asked: a job ask or a lead offer, with its note and the two answers
  const askCards = (s) => {
    if (!state.me || s.cancelledAt || phaseOf(s) === 'done') return '';
    const card = (attr, uid, head, quote, yes, no, onYes, onNo) => '<div ' + attr + ' style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:inset 0 0 0 2px #f3d58a,0 1px 3px rgba(15,18,25,.08);background:#fffaf0">' +
      '<div style="display:flex;align-items:center;gap:12px">' + face(uid, nameOf(uid), 40) + '<div style="flex:1;min-width:0;font-size:16px;line-height:1.35;font-weight:800;color:#0d1117">' + head + '</div></div>' +
      (quote ? '<div style="padding:10px 12px;border-radius:12px;background:#fff;font-size:14.5px;line-height:1.4;font-weight:500;color:#2b303a">“' + esc(quote) + '”</div>' : '') +
      '<div style="display:flex;gap:8px"><button type="button" ' + on(onYes) + ' style="flex:1 1 0;min-height:48px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:15.5px;font-weight:800;cursor:pointer">' + yes + '</button>' +
        '<button type="button" ' + on(onNo) + ' style="flex:1 1 0;min-height:48px;border:0;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;color:#0d1117;font-family:inherit;font-size:15.5px;font-weight:800;cursor:pointer">' + no + '</button></div></div>';
    const jobs = s.jobAsks.filter(a => a.userId === state.me && !a.answer && !onJob(s, a.itemId, state.me)).map(a => {
      const it = s.signups.find(x => x.id === a.itemId);
      return !it ? '' : card('data-job-ask-card', a.by, esc(firstName(nameOf(a.by))) + ' asked if you’d take <span style="color:#8f6405">' + esc(it.item) + '</span>', a.message, 'I’m in', 'Can’t this time', () => answerJobAsk(s, a, true), () => answerJobAsk(s, a, false));
    }).join('');
    const o = s.leadOffer, lead = o && o.userId === state.me
      ? card('data-lead-offer-card', o.by, esc(firstName(nameOf(o.by))) + ' asked if you’d take over leading this', o.message, 'I’ll take it', 'Not this time', () => answerLeadOffer(s, true), () => answerLeadOffer(s, false)) : '';
    return jobs + lead;
  };

  const askToLead = (s, u) => {
    if (s.leadAsks.some(a => a.userId === u)) return;
    quick(s, { leadAsks: s.leadAsks.concat({ userId: u, by: state.me, at: Date.now() }) },
      async () => { must(await sb.rpc('ask_to_lead', { p_spark: s.id, p_user: u })); });
  };

  // Non-leads suggest (waits for the lead); the lead sets it straight away
  const openOffer = (s, kind) => {
    const open = () => setState({ offerKind: kind, offerText: '', offerPlace: null, offerSuggest: [] });
    noteTap({ k: 'offer', id: s.id, kind });
    needAccount(open);
  };
  const commitOffer = (s) => {
    const kind = state.offerKind, text = state.offerText.trim(), place = state.offerPlace;
    if (!text || state.busy) return;
    // A date or location goes on the vote, where anyone can tick it and the lead picks; my vote goes on it too unless unticked
    const withVote = state.offerVote !== false, table = kind === 'day' ? 'date_options' : 'spot_options';
    let id = null;
    run(async () => {
      await saveGuestContact(s.id);
      const who = (state.myName || (state.guest && state.guest.name) || 'Someone').slice(0, 40);
      id = must(await sb.from(table).insert(kind === 'day'
        ? { spark_id: s.id, day_date: text.slice(0, 10), day_time: text.length > 10 ? text.slice(11, 16) : null, who }
        : { spark_id: s.id, name: cleanTitle(text).slice(0, 80), address: place ? place.address : null, lat: place ? place.lat : null, lon: place ? place.lon : null, who }).select('id').single()).data.id;
      if (withVote) must(await sb.from(kind === 'day' ? 'date_votes' : 'spot_votes').insert({ option_id: id, user_id: state.me }));
    }, { offerKind: null, offerText: '', offerPlace: null, offerVote: true, timeOpen: null, dateOpen: null }).then(ok => {
      if (!ok) return;
      setState({ justAdded: id });
      toast((kind === 'day' ? 'Date added. ' : 'Location added. ') + (isLead(s) ? 'Everyone can vote on it.' : firstName(nameOf(s.leadId, s.leadName)) + ' will see it.'), true,
        { label: 'Undo', fn: () => run(async () => { must(await sb.from(table).delete().eq('id', id)); }) });
    });
  };
  // ---- V5 plans ----------------------------------------------------------------------
  // An idea is a plan once the lead locks in a day and a time; the day after, it "happened"
  const phaseOf = (s) => !s.planned ? 'idea' : (s.dayDate && s.dayDate < todayISO() ? 'done' : 'plan');
  const myRsvp = (s) => { const r = s.rsvps.find(x => x.userId === state.me); return r ? r.status : null; };
  const going = (s) => s.rsvps.filter(r => r.status === 'going');
  // Who came (20261101090000): once the host has checked anyone in, the count is who came, not who said yes
  const checkedIn = (s) => s.rsvps.some(r => r.attended !== null);
  const cameCount = (s) => checkedIn(s) ? s.rsvps.filter(r => r.attended).length : going(s).length;
  const whenLong = (s) => s.dayDate ? fmtDay(s.dayDate) + (s.dayTime ? ' at ' + fmtTime(s.dayTime) : '') : '';

  // Change one event in place (for instant feedback before the next load replaces it)
  let rsvpChain = Promise.resolve(), rsvpQueued = 0;
  const patchSpark = (id, patch) => setState({ sparks: state.sparks.map(x => x.id === id ? Object.assign({}, x, patch) : x) });
  // A one-tap change that shows at once (owner, 2026-10-02: Interested, sign-ups and reactions waited for the save and a
  // reload, like RSVP used to): the event changes on screen, the save runs behind it in order, one refresh follows the
  // last of them, and a save that fails puts things back and says so. done(ok) runs after the save.
  let quickChain = Promise.resolve(), quickQueued = 0, savingN = 0;
  const saving = (d) => { if (d > 0) tapSeq++; savingN = Math.max(0, savingN + d); if (savingN) document.documentElement.setAttribute('data-saving', ''); else document.documentElement.removeAttribute('data-saving'); };
  const quick = (s, patch, work, done) => {
    if (state.viewAs) return run(async () => {});   // previewing: run() says nothing changes
    const cur = state.sparks.find(x => x.id === s.id) || s, undo = {};
    Object.keys(patch).forEach(k => { undo[k] = cur[k]; });
    patchSpark(s.id, patch);
    const mine = ++quickQueued;
    saving(1);
    quickChain = quickChain.then(async () => {
      let ok = true;
      try { await ensureSession(); await work(); }
      catch (e) { ok = false; console.error(e); patchSpark(s.id, undo); toast(failed(e)); }
      saving(-1);
      if (mine === quickQueued) await loadFresh().catch(e => console.error(e));
      if (done) done(ok);
    });
    return quickChain;
  };
  // The event with my claim on one sign-up added or taken off, in both shapes it's kept in (signups: every unit;
  // jobs: each job with its shifts)
  const withClaim = (s, ids, add, note) => {
    const unit = (u) => ids.indexOf(u.id) < 0 ? u : Object.assign({}, u, { claims: u.claims.filter(c => c.userId !== state.me).concat(add ? [{ userId: state.me, note: note || '', created: Date.now() }] : []) });
    return { signups: s.signups.map(unit), jobs: (s.jobs || []).map(j => { if (!j.shifts) return unit(j); const shifts = j.shifts.map(unit); return Object.assign({}, j, { shifts, claims: [].concat(...shifts.map(u => u.claims)) }); }) };
  };
  // Taking a job on a plan marks you Going (goingWithJob does it in the database)
  const goingToo = (s) => !s.planned || isLead(s) || myRsvp(s) === 'going' ? {} : { rsvps: s.rsvps.filter(r => r.userId !== state.me).concat([{ userId: state.me, status: 'going', created: Date.now(), attended: null }]) };
  const setRsvp = (s, status) => {
    const cur = myRsvp(s), next = cur === status ? null : status, lead = nameOf(s.leadId, s.leadName);
    const note = { going: 'You’re going. See you there!', maybe: 'Marked as maybe', no: isLead(s) ? 'Marked as can’t make it' : 'Thanks for letting ' + lead + ' know' }[next];
    const jobs = next === 'no' ? myClaims(s) : [];
    // The button changes as soon as it's tapped (owner, 2026-10-01: it took a second or two). Saves queue in order without
    // blocking the next tap; one refresh follows the last of them, and a save that fails puts that answer back
    const save = (dropJobs) => { if (state.confirm) setState({ confirm: null }); needGuest(() => {
      if (state.viewAs) return run(async () => {});   // previewing: run() says nothing changes
      const before = (state.sparks.find(x => x.id === s.id) || s).rsvps;
      patchSpark(s.id, { rsvps: before.filter(r => r.userId !== state.me).concat(next ? [{ userId: state.me, status: next, created: Date.now() }] : []) });
      // Going to a dated event: the toast becomes a banner with Add to calendar, so the reminder is set while they're committing
      if (next === 'going' && s.dayDate && !s.cancelledAt) showBanner({ kind: 'going', id: s.id }, 5000);
      else if (note) toast(dropJobs ? 'Thanks for letting ' + lead + ' know. You’re off the list too.' : note, true);
      const mine = ++rsvpQueued;
      saving(1);
      rsvpChain = rsvpChain.then(async () => {
        try {
          await ensureSession();
          await saveGuestContact(s.id);
          if (!next) must(await sb.from('rsvps').delete().eq('spark_id', s.id).eq('user_id', state.me));
          else must(await sb.from('rsvps').upsert({ spark_id: s.id, user_id: state.me, status: next }, { onConflict: 'spark_id,user_id' }));
          if (dropJobs) must(await sb.from('signup_claims').delete().in('item_id', jobs.map(it => it.id)).eq('user_id', state.me));
          if (next === 'going' || next === 'maybe') askGuestToJoin(s);   // only once it's saved (it used to say "You're on the list" over a failed save)
        } catch (e) {
          console.error(e);
          patchSpark(s.id, { rsvps: before });
          if (state.banner && state.banner.kind === 'going' && state.banner.id === s.id) setState({ banner: null });
          toast(failed(e));
        }
        saving(-1);
        if (mine === rsvpQueued) loadFresh().catch(e => console.error(e));
      });
    }); };
    // Can't, while signed up for a job: free the spot too? (owner, 2026-09-30)
    if (jobs.length) {
      const names = jobs.map(it => it.item).filter((x, k, a) => a.indexOf(x) === k);
      return setState({ confirm: { title: 'Take you off ' + (names.length === 1 ? '“' + names[0] + '”' : 'your ' + names.length + ' jobs') + ' too?',
        body: firstName(lead) + ' is counting on you for ' + namesList(names) + '. If you can’t make it, free the spot so someone else can grab it.',
        cta: 'Take me off', keep: 'Keep my spot', run: () => save(true), alt: () => save(false) } });
    }
    save(false);
  };

  // A vote on a suggested date or place changes as soon as it's tapped, like RSVP (owner, 2026-10-01: it lagged the same way).
  // Saves queue in order; one refresh follows the last of them, and a save that fails puts that option's votes back
  let voteChain = Promise.resolve(), voteQueued = 0;
  const vote = (table, s, o, said) => (noteTap({ k: 'vote', id: s.id, table, opt: o.id }), needAccount(() => {
    if (state.viewAs) return run(async () => {});   // previewing: run() says nothing changes
    const key = table === 'date_votes' ? 'dateOpts' : 'spotOpts';
    const opts = () => (state.sparks.find(x => x.id === s.id) || s)[key];
    const before = (opts().find(x => x.id === o.id) || o).votes, had = before.indexOf(state.me) > -1;
    const setVotes = (votes) => patchSpark(s.id, { [key]: opts().map(x => x.id === o.id ? Object.assign({}, x, { votes }) : x) });
    setVotes(had ? before.filter(u => u !== state.me) : before.concat(state.me));
    if (said) toast(had ? 'Vote taken back' : 'Vote saved. ' + firstName(nameOf(s.leadId, s.leadName)) + ' will see it.', true, { label: 'Undo', fn: () => vote(table, (state.sparks.find(x => x.id === s.id) || s), (opts().find(x => x.id === o.id) || o)) });
    const mine = ++voteQueued;
    saving(1);
    voteChain = voteChain.then(async () => {
      try {
        await ensureSession();
        await saveGuestContact(s.id);
        if (had) must(await sb.from(table).delete().eq('option_id', o.id).eq('user_id', state.me));
        else must(await sb.from(table).insert({ option_id: o.id, user_id: state.me }));
      } catch (e) {
        console.error(e);
        setVotes(before);
        toast(failed(e));
      }
      saving(-1);
      if (mine === voteQueued) loadFresh().catch(e => console.error(e));
    });
  }));
  const makePlan = (s) => {
    const n = s.interested.length;
    setState({ confirm: { title: 'Make it a plan?', green: true, cta: 'Make it a plan', keep: 'Not yet',
      body: 'It’s on for ' + whenLong(s) + '. ' + (n ? (n === 1 ? 'The 1 person who’s interested shows as going.' : 'The ' + n + ' people who are interested show as going.') : 'Anyone who joins shows as going.') + ' It goes on the calendar.',
      run: () => run(async () => { must(await sb.rpc('make_plan', { p_spark: s.id })); }, { confirm: null }) } });
  };
  const clearPlan = (s) => {
    const n = s.rsvps.filter(r => r.status !== 'no' && r.userId !== s.leadId && s.cohosts.indexOf(r.userId) < 0).length;
    setState({ confirm: { title: 'Turn it back into an idea?', danger: true, cta: 'Back to an idea', keep: 'Keep the plan',
      body: 'The date comes off and it goes back to being an idea.' + (n ? (n === 1 ? ' The 1 person who said Going or Maybe shows as interested again and gets a note.' : ' The ' + n + ' people who said Going or Maybe show as interested again and get a note.') : ''),
      run: () => run(async () => { must(await sb.rpc('clear_plan', { p_spark: s.id })); }, { confirm: null, sec: null }) } });
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
  // back: the claims just removed, so Undo can put them back (with their note)
  const offIt = (s, job, back) => isLead(s) ? toast('Removed you from ' + job.item.toLowerCase(), true) : showBanner({ kind: 'off', id: s.id, job: job.item, back }, 7000);
  const redoClaim = (b) => {
    clearTimeout(bannerTimer);
    run(async () => {
      await quickChain;   // the change being undone may still be saving
      must(await sb.from('signup_claims').insert(b.back.items.map(id => ({ item_id: id, user_id: state.me, note: b.back.note || null }))));
    }, { banner: null }).then(ok => { if (ok) toast('You’re back on it', true); else setState({ banner: null }); });
  };
  const undoClaim = (b) => {
    clearTimeout(bannerTimer);
    run(async () => {
      await quickChain;   // the sign-up being undone may still be saving
      if (b.undo.del) must(await sb.from('signup_items').delete().eq('id', b.undo.del));
      else must(await sb.from('signup_claims').delete().in('item_id', b.undo.items).eq('user_id', state.me));
      if (b.undo.back && b.undo.back.length) must(await sb.from('signup_claims').insert(b.undo.back.map(id => ({ item_id: id, user_id: state.me, note: b.undo.note || null }))));
      if ('was' in b.undo && b.undo.was !== 'going') {   // the sign-up made them Going: put their old answer back
        if (b.undo.was) must(await sb.from('rsvps').upsert({ spark_id: b.id, user_id: state.me, status: b.undo.was }, { onConflict: 'spark_id,user_id' }));
        else must(await sb.from('rsvps').delete().eq('spark_id', b.id).eq('user_id', state.me));
      }
    }, { banner: null }).then(ok => { if (ok) toast('Okay, you’re off it', true); else setState({ banner: null }); });
  };
  const jobOf = (s, it) => (s.jobs || s.signups).find(j => j.id === (it.jobId || it.id)) || it;
  const myShiftIds = (job) => (job.shifts || []).filter(u => u.claims.some(c => c.userId === state.me)).map(u => u.id);

  // Sign-ups: the lead adds items (with an optional "how many"); others add what they're bringing
  const addSignup = (s) => {
    const item = cleanTitle(state.sigDraft).slice(0, 60), need = isLead(s) ? (parseInt(state.sigNeed, 10) || null) : null, time = isLead(s) ? (state.sigTime || null) : null;
    if (!item || state.busy) return;
    let row = null;
    const was = myRsvp(s);
    const add = () => run(async () => {
      await saveGuestContact(s.id);
      row = must(await sb.from('signup_items').insert({ spark_id: s.id, item, need, time }).select('id').single()).data;
      if (!isLead(s)) { must(await sb.from('signup_claims').insert({ item_id: row.id, user_id: state.me })); await goingWithJob(s); }
    }, { sigDraft: '', sigNeed: '', sigTime: '', sigAdding: false }).then(ok => { if (ok) { if (isLead(s)) toast('Added to sign-ups', true); else onItBanner(s, { del: row.id, was }); } });
    if (isLead(s)) add(); else needAccount(add);
  };
  // Taking a job means you're coming (owner, 2026-09-30): it marks you Going on a plan, whatever you'd said.
  // Undo puts your old answer back (`was`).
  const goingWithJob = async (s) => {
    if (!s.planned || isLead(s) || myRsvp(s) === 'going') return;
    must(await sb.from('rsvps').upsert({ spark_id: s.id, user_id: state.me, status: 'going' }, { onConflict: 'spark_id,user_id' }));
  };
  const toggleClaim = (s, it) => {
    const mine = it.claims.some(c => c.userId === state.me), was = myRsvp(s), myNote = (it.claims.find(c => c.userId === state.me) || {}).note || null;
    noteTap({ k: 'claim', id: s.id, item: it.id });
    needAccount(() => {
      // The button and the banner change with the tap; the save follows
      if (!state.viewAs) { if (mine) offIt(s, jobOf(s, it), { items: [it.id], note: myNote }); else onItBanner(s, { items: [it.id], was }); }
      quick(s, Object.assign(withClaim(s, [it.id], !mine), mine ? {} : goingToo(s)), async () => {
        await saveGuestContact(s.id);
        if (mine) must(await sb.from('signup_claims').delete().eq('item_id', it.id).eq('user_id', state.me));
        else { must(await sb.from('signup_claims').insert({ item_id: it.id, user_id: state.me })); await goingWithJob(s); }
      }, (ok) => { if (!ok) { clearTimeout(bannerTimer); setState({ banner: null }); } });
    });
  };
  // Pick a shift: tick any shifts (more than one is fine), an optional note, Done
  const openShifts = (s, job) => (noteTap({ k: 'shifts', id: s.id, item: job.id }), needAccount(() => {
    const mine = myShiftIds(job), c = job.shifts.map(u => u.claims.find(x => x.userId === state.me)).find(Boolean);
    setState({ shiftPick: { id: s.id, job: job.id, sel: mine, note: c ? c.note : '' } });
  }));
  const saveShifts = (s, job) => {
    const p = state.shiftPick, had = myShiftIds(job), sel = p.sel, was = myRsvp(s), note = (p.note || '').trim().slice(0, 60) || null;
    const add = sel.filter(id => had.indexOf(id) < 0), drop = had.filter(id => sel.indexOf(id) < 0), keep = had.filter(id => sel.indexOf(id) > -1);
    const noteChanged = keep.some(id => { const u = job.shifts.find(x => x.id === id), c = u && u.claims.find(x => x.userId === state.me); return c && (c.note || null) !== note; });
    if (!add.length && !drop.length && !noteChanged) return setState({ shiftPick: null });
    if (state.viewAs) return run(async () => {});
    const oldNote = (job.shifts.map(u => u.claims.find(x => x.userId === state.me)).find(Boolean) || {}).note || null;
    setState({ shiftPick: null });
    if (add.length) onItBanner(s, { items: add, back: drop, note, was });   // Undo takes back only this change: the new shifts go, dropped ones return
    else if (drop.length) offIt(s, job, { items: drop, note: oldNote });
    const dropped = withClaim(s, drop, false), added = withClaim(Object.assign({}, s, dropped), add.concat(noteChanged ? keep : []), true, note);
    quick(s, Object.assign(added, add.length ? goingToo(s) : {}), async () => {
      await saveGuestContact(s.id);
      if (drop.length) must(await sb.from('signup_claims').delete().in('item_id', drop).eq('user_id', state.me));
      if (add.length) { must(await sb.from('signup_claims').insert(add.map(id => ({ item_id: id, user_id: state.me, note })))); await goingWithJob(s); }
      if (keep.length && noteChanged) must(await sb.from('signup_claims').update({ note }).in('item_id', keep).eq('user_id', state.me));
    }, (ok) => { if (!ok) { clearTimeout(bannerTimer); setState({ banner: null }); } });
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
      .then(ok => { if (ok) toast('Posted to the event', true); });
  };
  // The album, once it's happened
  // The person who added a photo, or the host, can take it out of the album (owner, 2026-09-30)
  const askRemovePhoto = (s, a) => setState({ confirm: { title: 'Remove this photo?', body: 'It comes out of the album for everyone.', cta: 'Remove it', keep: 'Keep it', danger: true,
    run: () => run(async () => { must(await sb.from('album_photos').delete().eq('id', a.id)); }, { confirm: null })
      .then(ok => { if (!ok) return; if (a.path.indexOf(state.me + '/') === 0) deletePhotos([a.path]); toast('Photo removed', true); }) } });
  const addAlbumPhoto = async (s, file) => {
    if (!file) return;
    let blob;
    try { blob = await shrinkImage(file); } catch (e) { toast(BAD_PHOTO); return; }
    let path = null;
    needAccount(() => run(async () => {
      path = await uploadBlob(blob);
      try { must(await sb.from('album_photos').insert({ spark_id: s.id, path })); } catch (e) { deletePhotos([path]); throw e; }
    }).then(ok => { if (ok) toast('Added to the album', true); }));
  };

  // "Add to calendar": an .ics event to its end time (an hour if it has none); no time = an all-day event
  const addToCalendar = (s) => {
    if (!s.dayDate) return;
    const d = s.dayDate.replace(/-/g, ''), p2 = (n) => String(n).padStart(2, '0');
    const stamp = (dt) => dt.getFullYear() + p2(dt.getMonth() + 1) + p2(dt.getDate()) + 'T' + p2(dt.getHours()) + p2(dt.getMinutes()) + '00';
    let startLine, endLine;
    if (s.dayTime) {
      const start = new Date(s.dayDate + 'T' + s.dayTime + ':00'), end = s.dayEnd && s.dayEnd > s.dayTime ? new Date(s.dayDate + 'T' + s.dayEnd + ':00') : new Date(start.getTime() + 3600000);
      startLine = 'DTSTART:' + stamp(start); endLine = 'DTEND:' + stamp(end);
    } else {
      const next = new Date(s.dayDate + 'T00:00:00'); next.setDate(next.getDate() + 1);
      startLine = 'DTSTART;VALUE=DATE:' + d; endLine = 'DTEND;VALUE=DATE:' + next.getFullYear() + p2(next.getMonth() + 1) + p2(next.getDate());
    }
    const escIcs = (v) => String(v || '').replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Spark Hub//EN', 'BEGIN:VEVENT', 'UID:' + s.id + '@sparkhub',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', startLine, endLine,
      'SUMMARY:' + escIcs(s.text), 'LOCATION:' + escIcs([s.spot, s.spotAddress].filter(Boolean).join(', ')),
      'DESCRIPTION:' + escIcs(location.origin + '/i/' + s.id), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = (s.text.replace(/[^\w ]+/g, '').trim() || 'plan') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // "Do it again": a new event with the place and details filled in
  const doItAgain = (s) => goCompose({ activity: s.text.slice(0, 40), evTags: (s.tags || []).slice(0, 2), evTest: !!(s.test || s.demo), locText: s.spot || '', locPlace: s.spotAddress ? { name: s.spot, address: s.spotAddress, lat: s.spotPoint && s.spotPoint[0], lon: s.spotPoint && s.spotPoint[1] } : null,
    evBits: [0, 1, 2].map(i => (basicsOf(s)[i] || '').slice(0, 60)) });

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
    if (again && st.resent && Date.now() - (st.resentAt || 0) < 60000) { toast('One code a minute. Wait a moment, then try again.'); return; }
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
      setState({ busy: null, loginMode: mode, loginStep: 'code', loginCode: again ? st.loginCode : '', resent: !!again, resentAt: again ? Date.now() : 0 });
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
    else if (state.screen === 'sched') go('sched');
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
      notif: { allReadAt: 0, read: [], topics: {}, email: true, loaded: false }, demoAdmin: false, back: null, subjectId: null, gpId: null, joinCode: '', myFriendCode: null,
      cq: '', cSearch: false, cGrps: null, tGrps: null, sGrps: null, cTypes: [], cSort: 'soon', cMon: null, cDay: null, hMon: null, hDay: null, cWildHidden: false, cNeedsHidden: false });
    go('sched');
    await ensureSession(true);
    await loadFresh().catch(() => {});
  };

  // ---------------------------------------------------------------------------
  // "Continue with Google" (Supabase OAuth, a full-page trip to Google)
  // ---------------------------------------------------------------------------
  // The page reloads on the way back, so anything in progress is parked in
  // sessionStorage first: the draft (photos as data URLs), a merge token, the
  // name, and where to pick up. Back signed in, the merge token moves the
  // guest's things (RSVPs, guest names, event links) to the account.

  const GOOGLE_ON = !!CFG.googleSignIn;
  const RESUME_KEY = 'spark-hub-google-resume';
  const DRAFT_KEYS = ['activity', 'evStep', 'evDate', 'evTime', 'evEnd', 'evEndOn', 'locText', 'locPlace', 'evBits', 'evNeed', 'evTags', 'evNeeds', 'evDatePoll', 'evSpotPoll', 'evLater', 'evPriv', 'evNoGuestInv', 'evTest', 'evFloat', 'evHelpNone', 'evGroups', 'coverPos', 'evPhotoPath', 'evDraftId'];
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
    if (st.busy || st.viewAs) return;
    setState({ busy: 'google', googleFailed: false });
    try {
      await ensureSession();
      const r = { at: Date.now(), stage: 'signin', from: st.loginFrom, anonId: st.me, name: st.myName,
        subjectId: st.subjectId, joinCode: st.joinCode, screen: st.screen, draft: null, tap: st.loginTap || null };
      if (st.loginFrom === 'post') {
        r.draft = {};
        DRAFT_KEYS.forEach(k => { r.draft[k] = st[k]; });
        r.draft.photos = [];
        for (const p of st.photos) r.draft.photos.push(await blobToDataUrl(p.blob));
      }
      r.mergeToken = must(await sb.rpc('prepare_merge')).data;
      writeResume(r);
      // Always a straight sign-in, one trip to Google (owner, 2026-10-01). Linking to the guest came back
      // identity_already_exists for every returning account and sent them to Google twice, flashing Welcome in
      // between; sometimes the second trip didn't finish. The merge token brings the guest's things across.
      must(await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: backHere() } }));
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
    if (r.from === 'post') return () => { if (cleanTitle(state.activity)) createEvent(); else if (state.screen !== 'compose') goCompose(); };
    if (r.from === 'join') return () => setState({ joinOpen: true, joinCode: r.joinCode || '', joinBad: false });
    if (r.from === 'invite') return () => { if (!state.inv) startInvite(r.joinCode, 'joining'); inviteJoin(); };
    if (r.from === 'profile') return () => go('sched', { profSheet: true });
    if (r.from === 'account' && r.tap) return () => replayTap(r.tap);
    if (r.from === 'account' || r.from === 'guest') return () => toast('You’re signed in. Tap it again to finish.', true);
    return null;
  };
  const replayTap = (t) => {
    const s = state.sparks.find(x => x.id === t.id);
    if (!s || s.cancelledAt) return;
    const rows = [].concat(...(s.jobs || s.signups).map(j => [j].concat(j.shifts || [])));
    const it = t.item ? rows.find(x => x.id === t.item) : null;
    if (t.k === 'interest') { if (s.interested.indexOf(state.me) < 0) toggleInterest(s); }
    else if (t.k === 'lead') { if (s.wantsHost) takeTheLead(s); }
    else if (t.k === 'offer') openOffer(s, t.kind);
    else if (t.k === 'vote') { const o = (t.table === 'date_votes' ? s.dateOpts : s.spotOpts).find(x => x.id === t.opt); if (o) vote(t.table, s, o); }
    else if (t.k === 'claim') { if (it && !it.claims.some(c => c.userId === state.me)) toggleClaim(s, it); }
    else if (t.k === 'role') { if (it && !it.claims.some(c => c.userId === state.me)) claimRole(s, it); }
    else if (t.k === 'shifts') { if (it && it.shifts) openShifts(s, it); }
  };

  // Runs once at start-up, after the session is ready. Returns true if the page is leaving again.
  const finishGoogle = async () => {
    const r = readResume();
    if (AUTH_RETURN.any) history.replaceState(null, '', backHere() + location.hash);
    if (!r) return false;
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
      // Best effort. A query builder has then() but no catch(), so it's awaited in a try (a .catch() here threw,
      // leaving invites stuck on Joining, 2026-09-30)
      try { await sb.rpc('complete_merge', { p_token: r.mergeToken }); } catch (e) { console.error(e); }
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
    if (state.viewAs) { toast('You’re viewing as ' + firstName(state.viewAs.name) + ', so nothing changes. Exit to make changes.'); return; }
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
      toast(tooSoon(e) ? 'One code a minute. Wait a moment, then try again.'
        : emailChanged && (e.code === 'email_exists' || /already|registered|exists|taken/i.test(e.message || '')) ? 'That email already has an account. Use a different one.' : FAILED);
    }
  };
  const resendPe = async () => {
    if (state.busy || !state.pe) return;
    setState({ busy: 'profile' });
    try { must(await sb.auth.updateUser({ email: state.pe.email })); setState({ busy: null }); toast('Sent again', true); }
    catch (e) { console.error(e); setState({ busy: null }); toast(tooSoon(e) ? 'One code a minute. Wait a moment, then try again.' : FAILED); }
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

  // One main button (audit, 2026-10-01): 52px purple pill, #d5d8df when it can't be used yet
  const primary = (ok) => css({ width: '100%', border: 0, borderRadius: '999px', padding: '16px', fontFamily: 'inherit', fontSize: '16px', fontWeight: 800, color: '#fff',
    background: ok ? '#5b4ae8' : '#d5d8df', cursor: ok ? 'pointer' : 'not-allowed' });
  const btn = (ok) => primary(ok) + ';margin-top:4px';
  const SECONDARY = 'width:100%;background:#fff;border:1.5px solid #dcdfe6;border-radius:999px;padding:15px;font-family:inherit;font-size:16px;font-weight:800;color:#0d1117;cursor:pointer';
  const CARD = 'background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08)';
  const EYEBROW = 'font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280';
  const FIELD = 'width:100%;background:#fff;border:2px solid #e6e7eb;border-radius:14px;padding:13px 16px;font-family:inherit;font-size:16px;font-weight:600;color:#0d1117;outline:none';
  const orDivider = () => '<div style="display:flex;align-items:center;gap:12px;margin:2px 0"><span style="flex:1 1 auto;height:1px;background:#dcdfe6"></span><span style="font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280">or</span><span style="flex:1 1 auto;height:1px;background:#dcdfe6"></span></div>';
  // A photo as a CSS background. Only our own photo addresses get in (photoUrl()'s storage URLs, the
  // site's /photos/, a just-picked photo's blob: or data: URL), and only a plain position; anything else
  // draws no photo rather than reaching a style attribute.
  const STORAGE_PHOTO = CFG.supabaseUrl + '/storage/v1/object/public/' + PHOTO_BUCKET + '/';
  const bgUrlOk = (u) => typeof u === 'string' && (
    (u.indexOf(STORAGE_PHOTO) === 0 && PHOTO_PATH.test(u.slice(STORAGE_PHOTO.length))) ||
    /^\/photos\/[a-z0-9-]+\.(jpg|png)$/.test(u) ||
    /^blob:https?:\/\/[^\s'"()\\]+$/.test(u) ||
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u));
  const BG_POS = /^(-?[0-9.]+% -?[0-9.]+%|center|(top|bottom|left|right|center) (top|bottom|left|right|center))$/;
  const bg = (url, pos) => {
    if (!url) return '';
    if (!bgUrlOk(url)) { console.warn('Not a photo address, left out:', String(url).slice(0, 60)); return ''; }
    return 'url(\'' + esc(url) + '\') ' + (BG_POS.test(pos || '') ? pos : 'center') + '/cover';
  };

  // A person's face: photo, or a coloured initial
  // One face for a person everywhere (audit, 2026-10-01): their photo, or two initials on a pastel picked from their
  // account id, so the same person keeps the same colour on every screen (it used to depend on list position or name length)
  const FACE_TINTS = [['#dcd7fb', '#4a3ad4'], ['#fde4cf', '#9a4a0c'], ['#d6f0e0', '#0f7a3c'], ['#dbeafe', '#1d4ed8'], ['#fde2e7', '#b4233c'], ['#fdf1d6', '#8f6405']];
  const tintOf = (key) => { const k = String(key || ''); let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return FACE_TINTS[h % FACE_TINTS.length]; };
  const twoInitials = (n) => (n || '').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
  const avatarSpan = (key, name, url, size, extra, inner) => { const t = tintOf(key || name);
    return '<span aria-hidden="true" style="flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:' + (url ? '#dcdfe6 ' + bg(url) : t[0]) + ';color:' + t[1] +
      ';font-size:' + Math.round(size * 0.36) + 'px;font-weight:900;display:flex;align-items:center;justify-content:center;' + (extra || '') + '">' + (url ? '' : esc(twoInitials(name))) + (inner || '') + '</span>'; };
  const face = (uid, name, size, color, extra) => avatarSpan(uid, name, avatarOf(uid), size, extra);   // (color is ignored now)

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
  const HEAD_GOLD = 'linear-gradient(135deg,#c98f16,#e8a71c 55%,#f3c55a)';   // a header with no group photo to show
  const groupBg = (g, fallback) => groupPhoto(g) ? bg(groupPhoto(g), posAt(g.photoPos, GROUP_POS)) : (fallback || '#e8a71c');

  const ideaButton = (extra) => '<button type="button" class="hov-primary" ' + on(goCompose) + ' style="width:100%;min-height:54px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 10px 24px rgba(91,74,232,.32);cursor:pointer;' + (extra || '') + '">' +
    I.plus(19, '#fff', 2.5) + 'Start an event</button>';

  // "That idea isn't up anymore": a dead or cut-short idea link
  const goneCard = () => state.goneOpen
    ? '<div role="status" style="position:relative;' + CARD + ';padding:18px 48px 18px 18px">' +
        '<span ' + on(() => setState({ goneOpen: false })) + ' aria-label="Dismiss" style="position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(14, '#0d1117', 2.4) + '</span>' +
        '<div data-gone style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">That event isn’t up anymore</div>' +
        '<div style="margin-top:4px;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Its lead may have taken it down, or the link got cut short.</div>' +
        (!state.email ? '' : '<span ' + on(() => { setState({ goneOpen: false }); go('calendar'); }) + ' style="display:inline-flex;margin-top:10px;min-height:32px;align-items:center;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">See what’s up now →</span>') +
      '</div>'
    : '';

  // ---------------------------------------------------------------------------
  // 1. Welcome (Home, signed out)
  // ---------------------------------------------------------------------------

  const STEPS = [['#e8a71c', '1', 'Start an event'], ['#5b4ae8', '2', 'RSVP &amp; pitch in'], ['#0f7a3c', '3', 'Make it happen']];

  function viewWelcome() {
    const st = state, from = st.joinCode ? 'join' : 'default', then = st.joinCode ? () => openJoin(st.joinCode) : null;
    // Google leaves for Google straight from here, the button reading "Opening Google…" (no sign-in pop-up flashing
    // first; owner, 2026-09-30). If Google is cancelled, the return opens the pop-up anyway. Email opens the pop-up.
    const google = () => { if (st.busy) return; setState({ loginFrom: from, loginThen: then, loginMode: 'link', googleFailed: false }); googleSignIn(); };
    const email = () => { openLogin(from, then); setState({ loginEmailOnly: true }); setTimeout(() => { const f = document.querySelector('[data-screen-label="Sign in"] input[type=email]'); if (f) f.focus(); }, 0); };
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
              I.google + (st.busy === 'google' ? 'Opening Google…' : 'Continue with Google') + '</button>'
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
    : g && g.photo ? '<div aria-hidden="true" style="height:' + h + ';background:' + bg(photoUrl(g.photo)) + '"></div>'
    : '<div aria-hidden="true" style="height:' + h + ';background:#e8a71c;display:flex;align-items:center;justify-content:center;font-size:' + initialSize + 'px;font-weight:900;color:#fff">' + esc(initialOf(g && g.name)) + '</div>';
  const invThumb = (g, size, ring) => '<span aria-hidden="true" style="flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:999px;overflow:hidden;display:block' + (ring ? ';box-shadow:' + ring : '') + '">' + invPhoto(g, size + 'px', Math.round(size * 0.45)) + '</span>';
  const invName = (g) => g && g.name ? esc(g.name) : g ? 'this group' : '';   // g with no name: the preview couldn't load
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
      '<button type="button" data-enter ' + on(invSendCode) + ' aria-disabled="' + !emailOk + '" style="margin-top:10px;' + invPrimary(emailOk) + '">' + (busy === 'send' ? 'Sending…' : 'Email me a code') + '</button>';
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
        '<button type="button" data-enter ' + on(() => { if (ok) verifyCode(); }) + ' aria-disabled="' + !ok + '" style="margin-top:18px;' + invPrimary(ok) + '">' + (st.busy === 'signin' ? 'Signing in…' : 'Sign in & join') + '</button>' +
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
            '<button type="button" ' + on(inviteJoin) + ' style="' + invPrimary(true) + ';width:auto;padding:0 28px">Try again</button>' +
            '<span ' + on(closeInvite) + ' style="display:flex;align-items:center;min-height:44px;font-size:15px;font-weight:700;color:#5f6475;text-decoration:underline;text-underline-offset:3px;cursor:pointer">Not now</span></div>'
        : '<div role="progressbar" aria-label="Joining" style="position:relative;width:140px;height:6px;border-radius:999px;background:#eceef2;overflow:hidden"><span style="position:absolute;top:0;bottom:0;width:40%;border-radius:999px;background:#5b4ae8;animation:invBar 1.1s ease-in-out infinite"></span></div>') +
    '</div>';
  }

  // 4: Welcome to {group}, once per group joined by link
  function viewInvWelcome() {
    const st = state, inv = st.inv, g = inv.group, gid = inv.gid;
    const next = state.sparks.filter(s => inGroup(s, gid) && phaseOf(s) === 'plan' && s.dayDate).sort(byWhen)[0];
    const rows = [['#e8a317', 'Plans', 'see what’s coming up and RSVP'], ['#5b4ae8', 'Ideas', 'float one, see who’s up for it'], ['#1f8a4c', 'Pitch in', 'bring something or lend a hand']];
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
        '<div style="flex:1;min-width:0;font-size:16px;line-height:1.35;font-weight:700;color:#11131f">Nothing planned yet. Start the first one?</div>' +
        '<button type="button" ' + on(() => { leaveWelcome('idea'); goCompose(); }) + ' style="flex:0 0 auto;border:0;border-radius:999px;background:#5b4ae8;color:#fff;padding:10px 18px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer">Start an event</button></div>';
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

  // E1: a mistyped, rotated or deleted link (one message for all three). v7 Update 15: a centred white card on gray,
  // a broken-link icon in a gray circle
  function viewInvBad() {
    const signedIn = !!state.email;
    const btn = 'align-self:stretch;min-height:52px;border:0;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer;';
    return '<div data-screen-label="Bad invite link" style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:calc(var(--pt) + 24px) 24px calc(24px + env(safe-area-inset-bottom, 0px));background:#e8eaee">' +
      '<div style="width:100%;max-width:340px;background:#fff;border-radius:22px;padding:26px 20px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
        '<span aria-hidden="true" style="width:56px;height:56px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center">' +
          svg(26, stroke('#6b7280', 2.2), '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/><path d="M4 4l16 16"/>') + '</span>' +
        '<h1 style="margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117;text-wrap:balance">This invite link isn’t working</h1>' +
        '<p style="margin:0;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270;text-wrap:pretty">It may be old, or the group got a new link. Ask the person who sent it for a fresh one.</p>' +
        '<div style="align-self:stretch;display:flex;flex-direction:column;gap:8px;margin-top:8px">' +
          (signedIn
            ? '<button type="button" ' + on(() => { closeInvite(); go('sched'); }) + ' style="' + btn + 'background:#5b4ae8;color:#fff">Go to my calendar</button>'
            : '<button type="button" ' + on(closeInvite) + ' style="' + btn + 'background:#5b4ae8;color:#fff">Go to Spark Hub</button>') +
          '<button type="button" ' + on(() => { closeInvite(); openJoin(); }) + ' style="' + btn + 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;color:#0d1117">I have a new link or code</button>' +
        '</div></div></div>';
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

  const PIN = (fill, strokeColor) => '<svg width="11" height="11" viewBox="0 0 24 24" fill="' + fill + '" stroke="' + strokeColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z"/><path d="M12 14v7"/></svg>';

  // ---- Dates and days ------------------------------------------------------
  const DAY_MS = 864e5;
  const midnight = (iso) => new Date(iso + 'T00:00').getTime();
  const dayDiff = (iso) => Math.round((midnight(iso) - midnight(todayISO())) / DAY_MS);
  const whenOf = (s) => s.dayDate ? s.dayDate + (s.dayTime || '') : '';
  const byWhen = (a, b) => whenOf(a).localeCompare(whenOf(b));
  // An event can be posted to several groups (v6 Update 6): its home group first, then the rest
  const gIds = (s) => s.groupIds || [s.groupId];
  const inGroup = (s, gid) => gIds(s).indexOf(gid) > -1;
  const invitedTo = (s) => state.fr.invites.some(i => i.spark === s.id);   // a friend invited you (v6 Update 13): it's yours like your groups' events
  const inMine = (s) => gIds(s).some(id => { const g = groupById(id); return !!(g && g.role); }) || invitedTo(s);
  const inScope = (s, gid) => inMine(s) && (!gid || inGroup(s, gid));
  const photoBg = (s) => s.photoPaths[0] ? bg(photoUrl(s.photoPaths[0]), posAt(s.coverPos, IDEA_POS)) : groupBg(groupById(s.groupId));
  const monthDay = (iso) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const monthLabel = (iso) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: iso.slice(0, 4) !== todayISO().slice(0, 4) ? 'numeric' : undefined });
  // v6 Update 6: an undecided date or place reads "… to be decided" (amber), or the poll's size
  const dateTbd = (s) => s.dateOpts.length ? 'Voting on ' + s.dateOpts.length + (s.dateOpts.length === 1 ? ' date' : ' dates') : 'Date TBD';
  const spotTbd = (s) => s.spotOpts.length ? 'Voting on ' + s.spotOpts.length + (s.spotOpts.length === 1 ? ' spot' : ' spots') : 'Location TBD';
  const TBD_ON_PHOTO = '#ffd98a', TBD_INK = '#8f6405';
  const tbdSpan = (t, color) => '<span style="color:' + (color || TBD_INK) + '">' + esc(t) + '</span>';
  // Events posted to several groups: "Torrez Fitness +1"
  const groupsLabel = (s) => { const n = (s.groupIds || [s.groupId]).map(id => groupById(id)).filter(g => g && g.role).map(g => g.name); return n.length ? n[0] + (n.length > 1 ? ' +' + (n.length - 1) : '') : ((groupById(s.groupId) || {}).name || ''); };
  const shortWhen = (s) => s.dayDate ? fmtDay(s.dayDate) + (s.dayTime ? ' · ' + fmtTime(s.dayTime) : '') : 'No date yet';
  const signupFill = (s) => {
    const counted = s.signups.filter(i => i.need);
    const needed = counted.reduce((n, i) => n + i.need, 0), filled = counted.reduce((n, i) => n + Math.min(i.claims.length, i.need), 0);
    return { rows: s.signups.length, counted: counted.length, needed, filled, open: needed - filled };
  };
  const myClaims = (s) => s.signups.filter(it => it.claims.some(c => c.userId === state.me));
  const maybes = (s) => s.rsvps.filter(r => r.status === 'maybe');
  const openSpark = (s) => go('detail', { subjectId: s.id, menu: null });
  const backLabel = (s) => {
    const b = state.back, g = groupById(s.groupId);
    if (!b) return g && g.role ? g.name : 'Your calendar';
    return { home: 'Your tasks', sched: 'Your calendar', own: 'Leading', calendar: 'Explore', groups: 'Groups', browse: (groupById(b.groupId) || g || {}).name || 'the group' }[b.screen];
  };
  const goBack = (s) => {
    const b = state.back, g = groupById(s.groupId);
    if (!b) { go(g && g.role ? 'browse' : 'sched', g && g.role ? { groupId: g.id } : {}); return; }
    setState({ screen: b.screen, groupId: b.groupId || state.groupId, phaseTab: b.phaseTab, back: null, menu: null, zoom: null });
    const sc = scroller();
    if (sc) sc.scrollTop = b.scroll;
  };
  // Photo headers (audit, 2026-10-01): one dark wash on the tab screens; one 44px white back button
  const HEAD_WASH = 'linear-gradient(to top, rgba(13,17,23,.9) 0%, rgba(13,17,23,.45) 55%, rgba(13,17,23,.25) 100%)';
  const backBtn = (s) => '<span ' + on(() => goBack(s)) + ' aria-label="Back to ' + esc(backLabel(s)) + '" class="hov-fill-grey" style="flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(13,17,23,.25);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.chevL(18, '#0d1117', 2.6) + '</span>';
  const EDIT_PILL = 'flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 2px 10px rgba(0,0,0,.25);font-size:14px;font-weight:800;color:#0d1117;cursor:pointer';

  // Loading placeholders (never the empty-state copy) until the first data arrives
  const skeleton = (n, h) => '<div role="status" aria-label="Loading" style="display:flex;flex-direction:column;gap:14px">' +
    Array.from({ length: n }, () => '<div aria-hidden="true" style="height:' + h + 'px;border-radius:20px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);animation:skPulse 1.4s ease-in-out infinite"></div>').join('') + '</div>';

  // An event link while it loads (owner, 2026-10-02: it was a bare "Loading…" on gray): the page's own shape, a photo
  // header in the post flow's colours with the pulsing bolt and the name, then the cards that are coming
  const eventLoading = () => {
    const bar = (w, h, extra) => '<span aria-hidden="true" style="display:block;width:' + w + ';height:' + h + 'px;border-radius:999px;background:#e8eaee;' + (extra || '') + '"></span>';
    const card = (inner, h) => '<div aria-hidden="true" style="' + CARD + ';padding:18px;min-height:' + h + 'px;display:flex;flex-direction:column;gap:12px;animation:skPulse 1.4s ease-in-out infinite">' + inner + '</div>';
    return '<div role="status" aria-label="Loading" data-event-loading>' +
      '<div style="position:relative;height:calc(300px + var(--pt));overflow:hidden;background:' + EV_GRAD + '">' +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(13,17,23,.25), rgba(13,17,23,0) 40%, rgba(13,17,23,.55))"></div>' +
        '<div aria-hidden="true" style="position:absolute;left:0;right:0;top:var(--pt);bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">' +
          '<svg class="splash-bolt" width="56" height="56" viewBox="0 0 24 24"><path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z" fill="#ffd166" stroke="#ffd166" stroke-width="1.7" stroke-linejoin="round"/></svg>' +
          '<span style="font-size:20px;font-weight:900;letter-spacing:-.4px;color:#fff">Spark Hub</span></div>' +
        '<div aria-hidden="true" style="position:absolute;left:20px;right:96px;bottom:22px;display:flex;flex-direction:column;gap:10px">' +
          bar('42%', 12, 'background:rgba(255,255,255,.35)') + bar('88%', 26, 'background:rgba(255,255,255,.28)') + '</div>' +
      '</div>' +
      '<div style="padding:16px 14px 26px;display:flex;flex-direction:column;gap:14px">' +
        card(bar('100%', 52, 'background:#efedfd'), 88) +
        card(bar('38%', 12) + bar('70%', 18) + bar('55%', 14), 130) +
        card(bar('30%', 12) + bar('90%', 14) + bar('75%', 14), 120) +
      '</div></div>';
  };
  const VIEW_ICONS = {
    next: '<rect x="4" y="3.5" width="16" height="9" rx="1.6"/><path d="M4 16.5h16M4 20.5h16"/>',
    tiles: '<rect x="4" y="4.5" width="16" height="6" rx="1.6"/><rect x="4" y="13.5" width="16" height="6" rx="1.6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="3"/>',
    month: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01" stroke-width="3"/>'
  };
  const VIEW_NAMES = { next: 'Up next', tiles: 'Tiles', list: 'List', month: 'Month' };
  // The current view's icon opens a menu (Your schedule and group pages); it sits on the first month row
  const viewPicker = (key, cur, set, views) => {
    const open = state.menu === key, icon = (k, c) => svg(17, 'fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round"', VIEW_ICONS[k]);
    return '<div data-menu style="position:relative;flex:0 0 auto">' +
      '<div ' + on((e) => { stop(e); setState({ menu: open ? null : key }); }) + ' aria-label="View: ' + VIEW_NAMES[cur] + '" aria-haspopup="menu" aria-expanded="' + open + '" style="display:flex;align-items:center;gap:4px;min-height:40px;padding:0 6px;color:#6b7280;cursor:pointer">' + icon(cur, 'currentColor') + I.chevD(12, 'currentColor', 2.8) + '</div>' +
      (open
        ? '<div role="menu" aria-label="View" style="position:absolute;top:calc(100% + 4px);right:0;z-index:25;min-width:160px;padding:6px;border-radius:16px;background:#fff;border:1px solid #eceef2;box-shadow:0 18px 44px rgba(15,18,25,.2);animation:popIn 160ms ease both">' +
            views.map(k => '<div ' + on((e) => { stop(e); set(k); }) + ' style="display:flex;align-items:center;gap:10px;min-height:42px;padding:0 10px;border-radius:10px;cursor:pointer">' + icon(k, '#6b7280') +
              '<span style="flex:1;font-size:15px;font-weight:' + (k === cur ? 900 : 700) + ';color:' + (k === cur ? '#5b4ae8' : '#0d1117') + '">' + VIEW_NAMES[k] + '</span>' + (k === cur ? I.check(16, '#5b4ae8', 2.6) : '') + '</div>').join('') + '</div>'
        : '') +
    '</div>';
  };

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
  // "Date TBD" reads amber (Round 65d), and the month grid's strip scrolls to it
  const monthHead = (label, right) => { const tbd = label === 'Date TBD';
    return '<div' + (tbd ? ' data-sec-tbd' : '') + ' style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 4px;scroll-margin-top:12px"><h3 style="margin:0;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:' + (tbd ? '#8f6405' : '#0d1117') + '">' + esc(label) + '</h3>' + (right || '') + '</div>'; };

  // Your tasks ⇄ Hosting (v6 Update 8, 73a): the title is a button that opens a two-row switcher, the only way into Hosting
  const hostCount = () => leadingList().length + state.drafts.length;
  const titleSwitch = (title) => {
    const open = state.menu === 'vm', onH = state.screen === 'own', n = hostCount();
    const row = (cur, label, sub, badge, pick) => '<div aria-selected="' + cur + '" ' + on(() => { setState({ menu: null }); if (!cur) pick(); }, 'option') +
      ' style="display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 12px;border-radius:12px;background:' + (cur ? '#f3f1fe' : 'transparent') + ';cursor:pointer;box-sizing:border-box">' +
      '<div style="flex:1 1 0;min-width:0"><div style="display:flex;align-items:center;gap:6px;font-size:16px;font-weight:800;color:#0d1117">' + label + (badge || '') + '</div>' +
        '<div style="font-size:13px;font-weight:600;color:#6b7280">' + sub + '</div></div>' + (cur ? I.check(18, '#5b4ae8', 2.6) : '') + '</div>';
    const badge = n ? '<span aria-label="' + n + ' leading" style="min-width:19px;height:19px;padding:0 6px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;box-sizing:border-box">' + (n > 9 ? '9+' : n) + '</span>' : '';
    return '<h1 data-menu ' + on(() => setState({ menu: open ? null : 'vm' })) + ' aria-haspopup="listbox" aria-expanded="' + open + '" aria-label="' + esc(title) + ', switch view" style="flex:1 1 0;min-width:0;margin:0;display:flex;align-items:center;gap:6px;font-size:30px;line-height:1;font-weight:900;letter-spacing:-1px;color:#0d1117;cursor:pointer">' +
        '<span>' + esc(title) + '</span><span style="display:flex;margin-top:4px;transition:transform .15s;transform:' + (open ? 'rotate(180deg)' : 'none') + '">' + I.chevD(18, '#0d1117', 3) + '</span></h1>' +
      (open
        ? '<div aria-hidden="true" style="position:fixed;inset:0;z-index:6;background:rgba(13,17,23,.35)"></div>' +
          '<div data-menu role="listbox" aria-label="Switch view" style="position:absolute;top:66px;left:12px;z-index:7;width:300px;max-width:calc(100% - 24px);padding:6px;border-radius:18px;background:#fff;box-shadow:0 18px 44px rgba(15,18,25,.25), 0 0 0 1px #e6e7eb;display:flex;flex-direction:column;gap:2px;animation:popIn 160ms ease both;box-sizing:border-box">' +
            row(!onH, 'Your tasks', 'What needs you, across everything', '', () => go('home')) +
            row(onH, 'Leading', 'Every event you’re leading, drafts too', badge, () => go('own')) + '</div>'
        : '');
  };

  // Hosting (v6 Update 8, 77a): compact rows in four sections — Drafts, Ideas, Planning, Past
  const IMG_IC = '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m4 17 5-5 4 4 2.5-2.5L20 17"/>';
  const MUTED = ';filter:saturate(.35);opacity:.85';
  const hostRow = (thumb, title, line, ink, fn, attr, s) => '<div ' + on(fn) + ' ' + attr + ' class="hov-host" style="display:flex;align-items:center;gap:10px;min-height:52px;padding:6px 14px 6px 10px;cursor:pointer;box-sizing:border-box">' + thumb +
    '<div style="flex:1 1 0;min-width:0"><div style="display:flex;align-items:center;min-width:0"><span style="min-width:0;font-size:15px;line-height:1.2;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(title) + '</span>' + demoTag(s, false, true) + '</div>' +
      '<div style="font-size:12.5px;font-weight:600;color:' + (ink || '#6b7280') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(line) + '</div></div>' +
    I.chevR(14, '#b9bcc4', 2.6) + '</div>';
  const hostThumb = (css, dim) => '<span aria-hidden="true" style="flex:0 0 40px;width:40px;height:40px;border-radius:10px;background:' + css + (dim ? MUTED : '') + '"></span>';
  // An idea's line: the top-voted date while none is picked ("Oct 23 leads", amber), else how many are in
  const ideaLine = (s) => {
    const top = s.dateOpts.filter(o => o.votes.length).sort((a, b) => b.votes.length - a.votes.length || (a.dayDate || '').localeCompare(b.dayDate || ''))[0];
    return !s.dayDate && top && top.dayDate ? [monthDay(top.dayDate) + ' leads', TBD_INK] : [s.interested.length + ' interested'];
  };
  const ideaSoon = (s) => { const d = s.dayDate || (ideaLine(s)[1] ? s.dateOpts.map(o => o.dayDate).filter(Boolean).sort()[0] : ''); return d || '9999'; };

  // Ideas you lead, your upcoming plans, and ones that happened in the last 3 days (the switcher's count)
  const leadingList = (gid) => state.sparks.filter(s => isLead(s) && inScope(s, gid) && (phaseOf(s) !== 'done' || (s.dayDate && dayDiff(s.dayDate) >= -3)));

  function viewOwn() {
    const st = state, gid = st.ownGrp && groupById(st.ownGrp) ? st.ownGrp : null;
    const head = head6('Leading', '', true);   // the same header as Your tasks, its twin behind the title switch (it had no bell)
    const wrap = (inner) => '<div data-screen-label="Leading">' + head +
      (gid ? '<div style="padding:12px 20px 0;font-size:13px;font-weight:700;color:#6b7280">' + esc(groupById(gid).name) + '</div>' : '') +
      '<div style="padding:12px 14px 26px;display:flex;flex-direction:column;gap:8px">' + inner + '</div><div style="height:var(--nav-h)"></div></div>';
    if (!st.loaded) return wrap(skeleton(3, 110));
    const mine = st.sparks.filter(s => isLead(s) && inScope(s, gid));
    const drafts = st.drafts.filter(d => !gid || (draftState(d).evGroups || []).indexOf(gid) > -1);
    const ideas = mine.filter(s => phaseOf(s) === 'idea').sort((a, b) => ideaSoon(a).localeCompare(ideaSoon(b)) || b.created - a.created);
    const plans = mine.filter(s => phaseOf(s) === 'plan').sort((a, b) => (!a.dayDate) - (!b.dayDate) || byWhen(a, b));
    const past = mine.filter(s => phaseOf(s) === 'done').sort((a, b) => byWhen(b, a));
    const sec = (label, rows) => rows.length ? '<section aria-label="' + label + '" style="display:flex;flex-direction:column;gap:8px"><h2 style="margin:0;padding:6px 6px 0;font-size:12px;font-weight:900;letter-spacing:.9px;text-transform:uppercase;color:#6b7280">' + label + ' · ' + rows.length + '</h2>' +
      '<div class="host-card" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(15,18,25,.06)">' + rows.join('') + '</div></section>' : '';
    const ev = (s, line, ink, dim) => hostRow(hostThumb(photoBg(s), dim), s.text, line, ink, () => openSpark(s), 'data-host="' + esc(s.text) + '" aria-label="' + esc(s.text) + '"', s);
    const body = sec('Drafts', drafts.map(d => {
        const x = draftState(d), j = x.evStep === 'review' ? EV_STEPS.length : Math.max(0, EV_STEPS.indexOf(x.evStep)), t = cleanTitle(x.activity) || 'Untitled event';
        const thumb = x.evPhotoPath ? hostThumb('#2b303a ' + bg(photoUrl(x.evPhotoPath)), true)
          : '<span aria-hidden="true" style="flex:0 0 40px;width:40px;height:40px;border-radius:10px;background:#f4f5f7;display:flex;align-items:center;justify-content:center">' + svg(16, stroke('#9aa0ac', 2.2), IMG_IC) + '</span>';
        return hostRow(thumb, t, j + ' of ' + EV_STEPS.length + ' steps', null, () => resumeDraft(d), 'data-host-draft="' + esc(t) + '" aria-label="Draft: ' + esc(t) + '"');
      })) +
      sec('Ideas', ideas.map(s => { const l = ideaLine(s); return ev(s, l[0], l[1]); })) +
      sec('Planning', plans.map(s => ev(s, s.dayDate ? fmtDay(s.dayDate) : 'Date to be decided'))) +
      sec('Past', past.map(s => ev(s, monthDay(s.dayDate), null, true)));
    // Empty: there's no + on this screen, so the card has its own button
    return wrap(body || '<div data-own-empty style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 1px 2px rgba(15,18,25,.06);display:flex;flex-direction:column;gap:14px">' +
      '<span style="font-size:15px;line-height:1.45;font-weight:600;color:#5c6270">Nothing you’re leading yet. Start an event, or float an idea and see who bites.</span>' + createBtn() + '</div>');
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

  // v6 Update 13: Groups becomes Your people: Groups · Friends under one photo header, Search, and a white Add button
  const frFace = (f, size) => avatarSpan(f.id, f.name, f.avatar ? photoUrl(f.avatar) : null, size);
  const isFriend = (uid) => state.fr.friends.some(f => f.id === uid);
  const friendById = (uid) => state.fr.friends.find(f => f.id === uid) || null;
  const pplQ = () => state.pplSearch ? state.pplQ.trim().toLowerCase() : '';
  const openPplSearch = () => { setState({ pplSearch: true, pplQ: '' }); setTimeout(() => { const el = document.querySelector('[data-csearch]'); if (el) el.focus(); }, 50); };
  const pplTab = (k) => setState({ pplTab: k, frSel: k === 'friends' ? state.frSel : [] });
  const toggleFriendSel = (id) => setState({ frSel: state.frSel.indexOf(id) > -1 ? state.frSel.filter(x => x !== id) : state.frSel.concat(id) });
  // "Darnell & Marisol", or "Darnell, Marisol + 2"
  const selNames = () => {
    const firsts = state.frSel.map(id => firstName((friendById(id) || {}).name || 'Someone'));
    return firsts.length <= 2 ? firsts.join(' & ') : firsts.slice(0, 2).join(', ') + ' + ' + (firsts.length - 2);
  };

  // Requests: Accept makes you friends; ✕ declines quietly
  const answerRequest = (f, yes) => {
    if (state.viewAs) return run(async () => {});
    const fr = state.fr;
    setState({ fr: Object.assign({}, fr, {
      incoming: fr.incoming.filter(x => x.id !== f.id),
      friends: yes ? fr.friends.concat({ id: f.id, name: f.name, avatar: f.avatar, since: Date.now(), groups: f.group ? [f.group] : [] }).sort((a, b) => a.name.localeCompare(b.name)) : fr.friends
    }) });
    if (yes) toast('You and ' + firstName(f.name) + ' are friends', true);
    ensureSession().then(() => sb.rpc('answer_friend_request', { p_from: f.id, p_accept: yes })).then(r => { if (r.error) throw r.error; if (yes) loadFresh().catch(e => console.error(e)); })
      .catch(e => { console.error(e); setState({ fr }); toast(failed(e)); });
  };
  // From a member profile: you share a group. Returns 'requested', or 'friends' when they'd already asked you
  const sendRequest = (uid, name) => {
    if (state.viewAs) return run(async () => {});
    const fr = state.fr;
    setState({ fr: Object.assign({}, fr, { outgoing: fr.outgoing.concat(uid) }) });   // the button reads Requested at once
    ensureSession().then(() => sb.rpc('send_friend_request', { p_to: uid })).then(r => {
      if (r.error) throw r.error;
      toast(r.data === 'friends' ? 'You and ' + firstName(name) + ' are friends' : 'Friend request sent to ' + firstName(name), true);
      if (r.data === 'friends') loadFresh().catch(e => console.error(e));
    }).catch(e => { console.error(e); setState({ fr }); toast(failed(e)); });
  };
  const removeFriend = (f) => setState({ confirm: { z: 60, title: 'Remove ' + firstName(f.name) + ' as a friend?', body: 'They won’t be told. You’ll still see each other in any groups you share.', cta: 'Remove friend', keep: 'Keep friend', danger: true,
    run: () => run(async () => {
      must(await sb.rpc('remove_friend', { p_other: f.id }));
      setState({ person: null, frSel: state.frSel.filter(x => x !== f.id), fr: Object.assign({}, state.fr, { friends: state.fr.friends.filter(x => x.id !== f.id), outgoing: state.fr.outgoing.filter(x => x !== f.id) }) });
      toast('Removed ' + firstName(f.name), true);
    }, { confirm: null }) } });

  // Your friend link (/add/CODE). Fetched when the Add sheet opens, so the share sheet can open straight from the tap
  const friendLink = (code) => location.origin + '/add/' + code;
  const loadFriendCode = (fresh) => sb.rpc('my_friend_code', { p_new: !!fresh }).then(r => { if (r.error) throw r.error; setState({ myFriendCode: r.data }); return r.data; });
  const openPplAdd = () => { setState({ pplAdd: true }); if (!state.myFriendCode) loadFriendCode().catch(e => console.error(e)); };
  const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const shareFriendLink = async () => {
    let code = state.myFriendCode;
    try { if (!code) code = await loadFriendCode(); } catch (e) { console.error(e); return toast(failed(e)); }
    const url = friendLink(code), text = 'Let’s be friends on Spark Hub, so we can invite each other to things.';
    setState({ pplAdd: false });
    // Phones: the share sheet (Messages, WhatsApp…); computers: copy it
    if (TOUCH && navigator.share) navigator.share({ title: 'Spark Hub', text, url }).catch(() => {});
    else copy(url, 'Friend link copied. Send it to someone you know.');
  };
  const newFriendLink = () => setState({ pplAdd: false, confirm: { title: 'Get a new friend link?', body: 'Your old link stops working. People who already used it stay your friends.', cta: 'Get a new link', keep: 'Keep this one',
    run: () => run(async () => { await loadFriendCode(true); toast('New friend link ready. The old one won’t work anymore.', true); }, { confirm: null }) } });

  // Long-press a friend (or right-click): their short profile, with Remove friend
  let frPress = null, frPressed = false;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-friend-id]');
    if (!el) return;
    const id = el.getAttribute('data-friend-id'), x = e.clientX, y = e.clientY;
    clearTimeout(frPress && frPress.t);
    frPressed = false;
    frPress = { x, y, t: setTimeout(() => { frPressed = true; frPress = null; if (navigator.vibrate) navigator.vibrate(10); openPerson(id); }, 500) };
  });
  const frPressEnd = () => { if (frPress) { clearTimeout(frPress.t); frPress = null; } };
  document.addEventListener('pointerup', frPressEnd);
  document.addEventListener('pointercancel', frPressEnd);
  document.addEventListener('pointermove', (e) => { if (frPress && Math.hypot(e.clientX - frPress.x, e.clientY - frPress.y) > 10) frPressEnd(); });
  document.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('[data-friend-id]');
    if (!el) return;
    e.preventDefault();
    frPressEnd(); frPressed = true;
    openPerson(el.getAttribute('data-friend-id'));   // the same profile pop-up as everywhere else
  });
  // The click after a long-press doesn't also select the friend
  document.addEventListener('click', (e) => { if (frPressed && e.target.closest('[data-friend-id]')) { e.stopPropagation(); e.preventDefault(); frPressed = false; } }, true);

  function viewGroups() {
    // Pinned groups get the big photo cards; everything else (all of them, when nothing is pinned) is a tile
    const st = state, q = pplQ(), friendsTab = st.pplTab === 'friends';
    const all = groupsInOrder(), groups = q ? all.filter(g => g.name.toLowerCase().includes(q)) : all, big = groups.filter(g => g.pinned);
    const rest = groups.filter(g => !g.pinned), hero = all.find(groupPhoto) || null;   // the header photo: the first of your groups with one
    const friends = st.fr.friends, nFr = friends.length;
    const newDot = (g) => newIn(g) ? '<span aria-label="New events" style="display:inline-block;width:9px;height:9px;border-radius:999px;background:#9d93f7;margin-right:6px;vertical-align:1px"></span>' : '';
    const members = (g, px) => { const size = st.sizes[g.id]; return size ? '<div style="margin-top:3px;font-size:' + px + 'px;font-weight:700;color:#dfe2e8">' + size + (size === 1 ? ' member' : ' members') + '</div>' : ''; };
    const bigCard = (g) => '<div ' + on(() => openGroup(g)) + ' aria-label="' + esc(g.name) + '" style="position:relative;height:170px;border-radius:22px;overflow:hidden;background:#e8a71c;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
        (groupPhoto(g) ? photoLayer(groupPhoto(g), g.photoPos, GROUP_POS) : '') + GRAD +
        '<div style="position:absolute;top:12px;left:12px">' + roleChip(g) + '</div>' +
        '<div style="position:absolute;top:10px;right:10px;display:flex;gap:8px">' + gearBtn(g) + pinBtn(g, 36) + '</div>' +
        '<div style="position:absolute;left:16px;right:16px;bottom:12px;color:#fff">' +
          groupTagAbove(g) + '<div style="font-size:26px;line-height:1.05;font-weight:900;letter-spacing:-.6px">' + newDot(g) + esc(g.name) + '</div>' + members(g, 13) +
        '</div>' +
      '</div>';
    const tile = (g) => '<div ' + on(() => openGroup(g)) + ' aria-label="' + esc(g.name) + '" style="position:relative;aspect-ratio:1 / 1;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.08);background:#e8a71c;cursor:pointer">' + (groupPhoto(g) ? photoLayer(groupPhoto(g), g.photoPos, GROUP_POS) : '') + GRAD +
      '<div style="position:absolute;top:10px;left:10px">' + roleChip(g) + '</div>' +
      '<div style="position:absolute;top:8px;right:8px">' + pinBtn(g, 32) + '</div>' +
      '<div style="position:absolute;left:12px;right:10px;bottom:10px;color:#fff;font-size:16px;line-height:1.15;font-weight:900">' +
        groupTagAbove(g) + newDot(g) + esc(g.name) + members(g, 12) + '</div>' +
    '</div>';
    const frosted = (label, icon, fn) => '<span ' + on(fn) + ' aria-label="' + label + '" style="width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer">' + icon + '</span>';
    const sub = st.loaded ? all.length + (all.length === 1 ? ' group' : ' groups') + (st.fr.loaded ? ' · ' + nFr + (nFr === 1 ? ' friend' : ' friends') : '') : '';
    const header = '<header style="position:relative;height:calc(180px + var(--pt));overflow:hidden;background:#2b303a">' +
      (hero ? '<div style="position:absolute;inset:0;overflow:hidden">' + photoLayer(groupPhoto(hero), hero.photoPos, GROUP_POS) + '</div>' : '<div aria-hidden="true" style="position:absolute;inset:0;background:' + HEAD_GOLD + '"></div>') +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:' + HEAD_WASH + '"></div>' +
      '<div style="position:absolute;top:calc(14px + var(--pt));right:16px;z-index:2;display:flex;gap:8px">' + frosted('Search your people', ic6('search', 19, '#fff', 2.4), openPplSearch) + bellBtn(true) + '</div>' +
      '<div style="position:absolute;left:18px;right:90px;bottom:16px;z-index:2;color:#fff">' +
        '<div style="font-size:13px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#cfc9ff">Groups &amp; friends</div>' +
        '<h1 style="margin:2px 0 0;font-size:40px;line-height:1;font-weight:900;letter-spacing:-1.4px;color:#fff">Your people</h1>' +
        '<div data-ppl-sub style="margin-top:6px;font-size:14px;font-weight:700;color:rgba(255,255,255,.88)">' + sub + '</div></div>' +
      '<span ' + on(openPplAdd) + ' aria-label="Add a group or friend" class="hov-fill-grey" style="position:absolute;right:16px;bottom:16px;z-index:3;width:52px;height:52px;border-radius:999px;background:#fff;box-shadow:0 6px 16px rgba(13,17,23,.35);display:flex;align-items:center;justify-content:center;cursor:pointer">' +
        svg(22, stroke('#0d1117', 2.4), '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>') + '</span>' +
    '</header>';
    // The Calendar's search field (audit, 2026-10-01)
    const search = st.pplSearch ? searchHead(friendsTab ? 'Search friends' : 'Search groups', st.pplQ, friendsTab ? 'Search friends' : 'Search groups',
      (v) => setState({ pplQ: v.slice(0, 40) }), () => setState({ pplQ: '' }), () => setState({ pplSearch: false, pplQ: '' })) : '';
    // The group page's switch (audit, 2026-10-01): a 44px gray track, a white thumb that slides to the side that's on
    const onFr = (st.pplTab || 'groups') === 'friends';
    const seg = (k, label) => { const onIt = (st.pplTab || 'groups') === k;
      return '<span ' + on(() => pplTab(k), 'tab') + ' aria-selected="' + onIt + '" style="position:relative;display:flex;align-items:center;justify-content:center;height:100%;font-size:14px;font-weight:900;white-space:nowrap;cursor:pointer;transition:color 180ms ease;color:' + (onIt ? '#0d1117' : '#6b7280') + '">' + label + '</span>'; };
    const tabs = '<div role="tablist" aria-label="Groups or friends" style="position:relative;height:44px;border-radius:999px;background:#dfe2e7;display:grid;grid-template-columns:1fr 1fr;align-items:center">' +
      '<span aria-hidden="true" style="position:absolute;top:4px;bottom:4px;width:calc(50% - 6px);left:' + (onFr ? 'calc(50% + 2px)' : '4px') + ';border-radius:999px;background:#fff;box-shadow:0 1px 4px rgba(13,17,23,.15);transition:left 220ms cubic-bezier(.2,.8,.2,1)"></span>' +
      seg('groups', 'Groups · ' + all.length) + seg('friends', 'Friends' + (st.fr.loaded ? ' · ' + nFr : '')) + '</div>';
    const none = (what) => '<div style="padding:8px;text-align:center;font-size:14.5px;font-weight:700;color:#6b7280">No ' + what + ' match “' + esc(st.pplQ.trim()) + '”</div>';
    const groupsBody = !st.loaded ? skeleton(2, 200)
      : !all.length ? noGroupCard()
      : !groups.length ? none('groups')
      : big.map(bigCard).join('') + (rest.length ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + rest.map(tile).join('') + '</div>' : '');
    return '<div data-screen-label="Groups">' + header +
      '<div style="padding:14px 14px 26px;display:flex;flex-direction:column;gap:12px">' + search + tabs +
        (friendsTab ? friendsBody(q, none) : groupsBody) +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  // Friends: requests on top, then the grid (tap for a friend's profile; the round tick picks people to invite together;
  // owner, 2026-10-02: the profile used to be behind a long-press nobody found, which still works)
  function friendsBody(q, none) {
    const st = state, fr = st.fr, sel = st.frSel;
    if (!fr.loaded) return skeleton(2, 120);
    const shown = q ? fr.friends.filter(f => f.name.toLowerCase().includes(q)) : fr.friends;
    const reqs = q ? [] : fr.incoming;
    const req = (f) => '<div data-friend-request="' + esc(f.name) + '" style="' + CARD + ';padding:12px 14px;display:flex;align-items:center;gap:12px">' +
      '<span ' + on(() => openPerson(f.id)) + ' aria-label="' + esc(f.name) + ', see profile" style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;cursor:pointer">' + frFace(f, 40) +
      '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:900;color:#0d1117">' + esc(f.name) + '</div><div style="font-size:12.5px;font-weight:700;color:#6b7280">Wants to be friends' + (f.group ? ' · ' + esc(f.group) : '') + '</div></div></span>' +
      '<span ' + on(() => answerRequest(f, false)) + ' aria-label="Decline ' + esc(f.name) + '" style="flex:0 0 34px;width:34px;height:34px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(13, '#0d1117', 2.6) + '</span>' +
      '<span ' + on(() => answerRequest(f, true)) + ' aria-label="Accept ' + esc(f.name) + '" class="hov-primary" style="display:flex;align-items:center;height:34px;padding:0 13px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:13.5px;font-weight:900;cursor:pointer">Accept</span></div>';
    const cell = (f, k) => {
      const onIt = sel.indexOf(f.id) > -1;
      return '<div ' + on(() => openPerson(f.id)) + ' data-friend-id="' + esc(f.id) + '" aria-label="' + esc(f.name) + '" style="display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;cursor:pointer;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none">' +
        '<span style="position:relative;display:flex;border-radius:999px;transition:box-shadow 160ms;box-shadow:' + (onIt ? '0 0 0 3px #fff, 0 0 0 5.5px #5b4ae8' : 'none') + '">' + frFace(f, 58, k) +
          '<span ' + on(() => toggleFriendSel(f.id), 'checkbox') + ' aria-checked="' + onIt + '" aria-label="Invite ' + esc(f.name) + '" style="position:absolute;right:-7px;bottom:-7px;width:30px;height:30px;border-radius:999px;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;cursor:pointer;' +
            (onIt ? 'background:#5b4ae8' : 'background:#fff;box-shadow:inset 0 0 0 2px #c3c7d0') + '">' + (onIt ? I.check(12, '#fff', 3.6) : '') + '</span></span>' +
        '<span style="font-size:13px;font-weight:900;color:#0d1117;line-height:1.1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(firstName(f.name)) + '</span>' +
        (f.groups.length ? '<span style="font-size:11px;font-weight:700;color:#6b7280;line-height:1.15">' + esc(f.groups[0]) + (f.groups.length > 1 ? ' +' + (f.groups.length - 1) : '') + '</span>' : '') + '</div>';
    };
    const grid = shown.length ? '<div style="background:#fff;border-radius:22px;box-shadow:0 1px 3px rgba(15,18,25,.08);padding:14px 16px">' +
        '<div style="font-size:13px;font-weight:700;color:#6b7280;padding:0 0 12px">Tap a friend to see their profile. Tick the circle to invite people together.</div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 6px">' + shown.map((f, k) => cell(f, fr.friends.indexOf(f))).join('') + '</div></div>'
      : q ? none('friends')
      : '<div data-friends-empty style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:14px">' +
          '<div><div style="font-size:17px;font-weight:900;color:#0d1117">No friends here yet</div>' +
          '<div style="margin-top:4px;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">Send your friend link to people you know, or add someone from a group’s Members list. Then you can invite them to things together.</div></div>' +
          '<button type="button" class="hov-primary" ' + on(shareFriendLink) + ' style="min-height:50px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:15.5px;font-weight:900;cursor:pointer">Add a friend</button></div>';
    const bar = sel.length ? '<div data-invite-bar style="position:sticky;bottom:calc(var(--nav-h) + 12px);z-index:4;display:flex;gap:8px;margin-top:4px">' +
        '<div ' + on(() => setState({ frInvite: true })) + ' class="hov-primary" style="flex:1;min-width:0;min-height:52px;padding:0 14px;border-radius:14px;background:#5b4ae8;color:#fff;font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;text-align:center;box-shadow:0 8px 20px rgba(91,74,232,.35);cursor:pointer">Invite ' + esc(selNames()) + ' to…</div>' +
        '<div ' + on(() => setState({ frSel: [] })) + ' aria-label="Clear selection" class="hov-fill-grey" style="flex:0 0 52px;height:52px;border-radius:14px;background:#fff;box-shadow:0 2px 8px rgba(13,17,23,.15);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(15, '#0d1117', 2.4) + '</div></div>' : '';
    return reqs.map(req).join('') + grid + bar;
  }

  // Add people (the round button): Add a friend · Join a group · Start a group
  function viewPplAdd() {
    const close = () => setState({ pplAdd: false });
    const row = (label, sub, icon, fn) => '<div ' + on(fn) + ' aria-label="' + label + '" class="hov-grey-fill" style="display:flex;align-items:center;gap:14px;padding:14px 6px;border-top:1px solid #eceef1;cursor:pointer">' +
      '<span style="flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center">' + icon + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900;color:#0d1117">' + label + '</div><div style="font-size:13px;font-weight:600;color:#5c6270">' + sub + '</div></div>' + I.chevR(16, '#9aa0aa', 2.4) + '</div>';
    return sheet('Add people', close, 'padding:10px 14px calc(22px + env(safe-area-inset-bottom, 0px))',
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 6px 8px"><h3 style="margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Add people</h3>' + closeX(close) + '</div>' +
      '<div style="display:flex;flex-direction:column">' +
        row('Add a friend', 'Send them your friend link', svg(19, stroke('#0d1117', 2.2), '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>'), shareFriendLink) +
        row('Join a group', 'Have a code or link?', svg(19, stroke('#0d1117', 2.2), '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h.01M11 12h.01M15 12h.01"/>'), () => { setState({ pplAdd: false }); openJoin(); }) +
        row('Start a group', 'For a team, a block, a crew', svg(19, stroke('#0d1117', 2.4), '<path d="M12 5v14M5 12h14"/>'), () => { setState({ pplAdd: false }); startGroup(); }) +
      '</div>' +
      '<span ' + on(newFriendLink) + ' data-new-friend-link style="align-self:center;display:flex;justify-content:center;min-height:40px;align-items:center;margin-top:6px;font-size:13px;font-weight:700;color:#8a909b;cursor:pointer">Get a new friend link</span>', 45);
  }

  // Invite the friends you picked to one of your upcoming events (leading or going; guests only where the lead allows it)
  const canInviteTo = (s) => isLead(s) || isGroupAdmin(s) || (s.guestInvites !== false && myRsvp(s) === 'going');
  const inviteList = () => state.sparks.filter(s => s.planned && !s.cancelledAt && phaseOf(s) === 'plan' && (isLead(s) || myRsvp(s) === 'going') && canInviteTo(s)).sort(byWhen);
  const inviteFriends = (s) => {
    const ids = state.frSel.slice();
    run(async () => {
      const r = must(await sb.rpc('invite_friends', { p_spark: s.id, p_people: ids })).data || {};
      const names = (list) => namesList((list || []).map(id => firstName((friendById(id) || {}).name || 'Someone')));
      const inv = r.invited || [], went = r.going || [], had = r.already || [];
      const parts = [];
      if (inv.length) parts.push('Invited ' + names(inv) + ' to ' + s.text + '.');
      if (went.length) parts.push(names(went) + (went.length === 1 ? '’s' : ' are') + ' already going.');
      if (had.length) parts.push(names(had) + (had.length === 1 ? ' was' : ' were') + ' already invited.');
      setState({ frInvite: false, frSel: [] });
      toast(parts.join(' ') || 'Invited', true);
    });
  };
  function viewFrInvite() {
    const close = () => setState({ frInvite: false }), list = inviteList();
    const row = (s) => '<div ' + on(() => inviteFriends(s)) + ' data-invite-event="' + esc(s.text) + '" class="hov-grey-fill" style="display:flex;align-items:center;gap:12px;padding:12px 6px;border-top:1px solid #eceef1;cursor:pointer">' +
      '<span aria-hidden="true" style="flex:0 0 40px;width:40px;height:40px;border-radius:10px;background:#2b303a ' + photoBg(s) + '"></span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(s.text) + '</div>' +
        '<div style="font-size:12.5px;font-weight:600;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc([s.dayDate ? dayLabel(s.dayDate, s.dayTime) : 'Date TBD', (groupById(s.groupId) || {}).name].filter(Boolean).join(' · ')) + '</div></div>' + I.chevR(14, '#b9bcc4', 2.6) + '</div>';
    return sheet('Invite friends', close, 'max-height:78%;overflow-y:auto;padding:10px 14px calc(22px + env(safe-area-inset-bottom, 0px))',
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 6px 4px"><h3 style="margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Invite ' + esc(selNames()) + '</h3>' + closeX(close) + '</div>' +
      '<div style="padding:0 6px 10px;font-size:14px;font-weight:600;color:#5c6270">Pick one of your upcoming events.</div>' +
      '<div style="display:flex;flex-direction:column">' + (list.length ? list.map(row).join('')
        : '<div style="padding:14px 6px;border-top:1px solid #eceef1;font-size:14.5px;line-height:1.45;font-weight:600;color:#5c6270">You don’t have anything coming up to invite them to. Events you’re leading or going to show up here.</div>' +
          '<button type="button" class="hov-primary" ' + on(() => { close(); goCompose(); }) + ' style="' + primary(true) + '">Start an event</button>') + '</div>', 45);
  }

  // Anyone's profile (owner, 2026-10-01): from Who's going / Who's interested, the Led by card, and Members.
  // Photo, name, place, bio, the groups you share (each of your groups' group_people) and the friend button.
  // Your own face opens your own profile sheet instead.
  const openPerson = (uid) => {
    if (!uid) return;
    if (uid === state.me) { openProfileSheet(); return; }
    const mine = myGroups();
    setState({ person: { id: uid, loading: true } });
    Promise.all([sb.from('profiles').select('name,avatar_path,place,bio').eq('id', uid).maybeSingle()]
      .concat(mine.map(g => sb.rpc('group_people', { p_group: g.id }))))
      .then(([p, ...lists]) => {
        if (!state.person || state.person.id !== uid) return;
        const rows = lists.map(r => (r.data || []).find(m => m.user_id === uid) || null);
        const pr = (p && p.data) || {}, any = rows.find(Boolean) || {}, path = pr.avatar_path || any.avatar_path || '';
        setState({ person: { id: uid, loading: false, name: pr.name || any.name || nameOf(uid),
          avatar: PHOTO_PATH.test(path) ? photoUrl(path) : avatarOf(uid), place: pr.place || '', bio: pr.bio || '',
          groups: mine.filter((g, i) => rows[i]).map(g => g.name) } });
      })
      .catch(e => { console.error(e); setState({ person: null }); toast(FAILED); });
  };
  function viewPerson() {
    const st = state, p = st.person, close = () => setState({ person: null });
    if (!p) return '';
    const name = p.name || nameOf(p.id), f = friendById(p.id), asked = st.fr.incoming.find(x => x.id === p.id);
    const since = f && f.since ? new Date(f.since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
    const btn = 'display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 18px;border-radius:999px;font-size:15px;font-weight:900';
    const friendRow = p.loading || !st.fr.loaded ? ''
      : f ? '<span data-person-friend style="' + btn + ';background:#e7f6ec;color:#0f7a3c">' + I.check(13, '#0f7a3c', 3) + 'Friends' + (since ? ' since ' + esc(since) : '') + '</span>' +
          '<span ' + on(() => removeFriend(f)) + ' class="hov-danger" style="' + btn + ';min-height:40px;background:#fff;box-shadow:inset 0 0 0 1.5px #f5c2cb;font-size:14px;font-weight:800;color:#9b1c31;cursor:pointer">Remove friend</span>'
      : asked ? '<span ' + on(() => answerRequest(asked, true)) + ' data-person-friend class="hov-primary" style="' + btn + ';background:#5b4ae8;color:#fff;cursor:pointer">Accept friend request</span>'
      : st.fr.outgoing.indexOf(p.id) > -1 ? '<span data-person-friend style="' + btn + ';background:#f2f3f6;color:#6b7280">Requested</span>'
      : p.groups.length ? '<span ' + on(() => sendRequest(p.id, name)) + ' data-person-friend class="hov-primary" style="' + btn + ';background:#5b4ae8;color:#fff;cursor:pointer">' +
          svg(15, stroke('#fff', 2.6), '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>') + 'Add friend</span>'
      : '';
    // A pop-up in the middle of the screen, not a slide-up (owner, 2026-10-01); above lists and sheets, under confirms
    return modal(name, close,
      '<div data-screen-label="Person" style="display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;padding-top:6px">' +
        avatarSpan(p.id, name, p.avatar || avatarOf(p.id) || (f && f.avatar ? photoUrl(f.avatar) : null), 84) +
        '<div style="max-width:100%"><div style="font-size:24px;line-height:1.1;font-weight:900;letter-spacing:-.4px;color:#0d1117;overflow-wrap:anywhere">' + esc(name) + '</div>' +
          (p.place ? '<div data-person-place style="margin-top:6px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:14px;font-weight:700;color:#6b7280">' +
            svg(14, stroke('#6b7280', 2.2), '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>') + esc(p.place) + '</div>' : '') + '</div>' +
        (p.loading ? '<div style="font-size:14px;font-weight:600;color:#9aa0ac">Loading…</div>'
          : (p.bio ? '<p data-person-bio style="margin:0;font-size:15.5px;line-height:1.45;font-weight:500;color:#2a2f38;white-space:pre-line">' + esc(p.bio) + '</p>' : '') +
            '<div data-person-groups style="align-self:stretch;padding:12px 14px;border-radius:14px;background:#f7f7f9;font-size:14px;line-height:1.45;font-weight:600;color:#454b55">' +
              (p.groups.length ? '<span style="font-size:12px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:#8a909b">Both in</span><br>' + esc(namesList(p.groups))
                : 'You’re not in a group together.') + '</div>' +
            (friendRow ? '<div style="align-self:stretch;display:flex;flex-direction:column;gap:8px">' + friendRow + '</div>' : '')) +
      '</div>', { z: 45, max: 360 });
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
    // Maybe reads lighter than Going (v7 Update 16)
    maybe: { dot: '#a9d6ba', strip: '#fbfcfb', pill: '#eef6f1', ink: '#3c7a55', kick: '#a9d6ba', sliver: '#fbfcfb', word: 'Maybe' },
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
    person: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4 7 8 6 8-6"/>'
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

  // What the lead should do next (the prototype's ownActs). Who hasn't replied, with Nudge, is in Who's coming
  // (v7 Update 15), not a to-do here.
  const ownActs = (s) => {
    const ph = phaseOf(s), out = [];
    // Each to-do's button does its job (owner, 2026-09-30); `go` runs it, the row itself still opens the event
    const onPage = (fn) => () => { openSpark(s); setTimeout(fn, 0); };
    if (ph === 'idea') {   // the next step, then the jobs still to fill
      const top = s.dateOpts.slice().sort((a, b) => b.votes.length - a.votes.length)[0];
      const next = s.wantsHost ? { act: 'Needs ' + missingText(s) + ' to make it a plan', cta: 'Find a lead', go: onPage(() => openLeadAsk(s)) }
        : !s.dayDate && top && top.votes.length ? { act: monthDay(top.dayDate) + ' has ' + top.votes.length + (top.votes.length === 1 ? ' vote' : ' votes'), cta: 'Pick', go: () => openToSection(s, 'sec-when') }
        : !s.dayDate ? { act: 'Needs a date to make it a plan', cta: 'Add date', go: () => openToSection(s, 'sec-when') }
        : s.dayDate < todayISO() ? { act: 'That date has passed', cta: 'New date', go: onPage(() => openSec(s, 'when')) }
        : { act: 'It’s all set', cta: 'Make it a plan', go: onPage(() => makePlan(s)) };
      return [next].concat(s.wantsHost ? [] : jobActs(s, onPage));
    }
    if (ph === 'done') {
      // Done once there's a photo in the album / an update went out on the day or after (the thank-you is one)
      const helpers = helperIds(s), thanked = s.updates.some(u => u.created >= Date.parse(s.dayDate + 'T00:00:00'));
      if (!s.album.length) out.push({ act: 'Add photos', cta: 'Add', go: () => openSpark(s) });
      if (helpers.length && !thanked) out.push({ act: 'Thank ' + (helpers.length === 1 ? firstName(personName(s, helpers[0])) : 'your ' + helpers.length + ' helpers'), cta: 'Thank', go: () => setState({ blast: { id: s.id, to: 'all', text: thanksText(s, helpers) } }) });
      return out;
    }
    const f = signupFill(s), sug = s.spotOpts.filter(o => o.createdBy !== state.me);
    if (!s.dayDate) out.push({ act: dateTbd(s), cta: s.dateOpts.length ? 'Pick' : 'Add it', go: s.dateOpts.length ? () => openToSection(s, 'sec-when') : onPage(() => openSec(s, 'when')) });
    if (!s.spot && sug.length) out.push({ act: firstName(sug[0].who || 'Someone') + ' suggested a location', cta: 'Review', go: () => openToSection(s, 'sec-when') });
    else if (!s.spot) out.push({ act: spotTbd(s), cta: s.spotOpts.length ? 'Pick' : 'Add it', go: s.spotOpts.length ? () => openToSection(s, 'sec-when') : onPage(() => openSec(s, 'when')) });
    return out.concat(jobActs(s, onPage));
  };
  // Jobs still to fill are a lead's task (owner, 2026-10-02): one row per job with spots left, and Ask opens the
  // personal ask for it (a job with shifts can't be asked for yet, so it shares the list)
  const jobActs = (s, onPage) => (s.jobs || s.signups).map(j => {
    const units = j.shifts || [j], left = units.reduce((a, u) => a + (u.need ? Math.max(0, u.need - u.claims.length) : 0), 0);
    if (!left) return null;
    const waiting = j.shifts ? 0 : openAsks(s, j.id).length;
    return { act: j.item + ': ' + left + (left === 1 ? ' spot' : ' spots') + ' to fill' + (waiting ? ' · ' + waiting + ' asked' : ''), cta: j.shifts ? 'Share' : 'Ask',
      go: j.shifts ? () => shareOpenJobs(s) : onPage(() => openJobAsk(s, j)) };
  }).filter(Boolean);
  // Everyone who took a job (not the host), for "Thank helpers"
  const helperIds = (s) => [].concat(...s.signups.map(it => it.claims.map(c => c.userId))).filter((u, i, a) => u !== s.leadId && s.cohosts.indexOf(u) < 0 && a.indexOf(u) === i);
  const thanksText = (s, ids) => 'Thank you ' + namesList(ids.map(u => firstName(personName(s, u)))) + ' for helping make ' + s.text + ' happen!';
  // The share sheet with a message naming the open jobs
  const shareOpenJobs = (s) => {
    const open = (s.jobs || s.signups).map(j => {
      const units = j.shifts || [j], left = units.reduce((a, u) => a + (u.need ? Math.max(0, u.need - u.claims.length) : 0), 0);
      return left ? j.item + (left > 1 ? ' (' + left + ')' : '') : '';
    }).filter(Boolean);
    setState({ share: { id: s.id, copied: false, msg: s.text + (s.dayDate ? ' · ' + dayLabel(s.dayDate, s.dayTime, s.dayEnd) : '') + ' still needs: ' + open.join(', ') + '. Can you grab one?' } });
  };
  // What someone going, maybe, or signed up for (not leading) should keep in mind
  const helpActs = (s) => {
    const my = myRsvp(s), out = [], dd = daysTo(s);
    // A date, time or place change in the last 3 days, in amber (its update is the record of it)
    const moved = s.updates.find(u => /^New (date|time|location):/.test(u.body) && Date.now() - u.created < 3 * DAY_MS);
    if (moved) out.push({ act: moved.body.split(' · ')[0].replace(/^New date: /, 'Moved to ').replace(/^New time: /, 'New time: ').replace(/^New location: /, 'Now at '), cta: 'See', warn: true, go: () => openToSection(s, 'sec-when') });
    // Taking a job marks you Going, so there's no "Confirm RSVP"; a Maybe gets a nudge only in the last 3 days
    if (my === 'maybe' && dd != null && dd <= 3) out.push({ act: 'You said Maybe', cta: 'Update RSVP', go: () => openSpark(s) });
    // Only what you signed up for (owner, 2026-09-29): no location or countdown rows
    myClaims(s).forEach(it => out.push({ act: it.item, cta: spanTime(it) || fmtTime(s.dayTime) || 'Any time', time: true }));
    return out;
  };
  // Your tasks: plans you lead (upcoming, or in the last 3 days) with something to do, what you're helping
  // with (most to-dos first), and the ideas you lead
  const tasksData = (sel) => {
    const mine = state.sparks.filter(s => inMine(s) && inPick(sel)(s));
    const leads = mine.filter(s => !s.cancelledAt && isLead(s) && (phaseOf(s) !== 'done' || dayDiff(s.dayDate) >= -3));
    const rank = (s) => phaseOf(s) === 'done' ? 1e6 : daysTo(s) == null ? 5e5 : daysTo(s);
    const plans = leads.filter(s => s.planned).map(s => ({ s, a: ownActs(s) })).filter(z => z.a.length)
      .sort((p, q) => rank(p.s) - rank(q.s) || byWhen(p.s, q.s));
    const ideas = leads.filter(s => !s.planned).sort((a, b) => b.created - a.created);
    const help = mine.filter(s => !s.cancelledAt && !isLead(s) && phaseOf(s) === 'plan' && (['going', 'maybe'].indexOf(myRsvp(s)) > -1 || helpsOn(s)))
      .map(s => ({ s, a: helpActs(s) })).filter(z => z.a.length)
      .sort((p, q) => q.a.length - p.a.length || byWhen(p.s, q.s));
    return { plans, ideas, help, leadsAny: leads.some(s => s.planned) };
  };
  const tasksBadge = () => { if (!state.email || !state.loaded) return 0; const d = tasksData(); return d.plans.length + d.help.length; };

  // Leading plans: Going · Maybe · Sign-ups · Invited (v7 Update 15, owner 2026-10-02; Invited replaced Reminder)
  const statsStrip = (s) => {
    const g = going(s).length, m = maybes(s).length, f = signupFill(s);
    const col = { ok: '#454b55', warn: '#b07a0a', off: '#9aa0ac' };
    const items = [['people', 'Going', String(g), 'ok'], ['maybe', 'Maybe', String(m), 'ok'],
      ['clip', 'Sign-ups', f.counted ? f.filled + '/' + f.needed : '—', !f.counted ? 'off' : f.open <= 0 ? 'ok' : 'warn'],
      ['mail', 'Invited', String((s.invites || []).length), 'ok']];
    return '<div style="display:flex;align-items:center;justify-content:space-between;height:40px;padding:0 30px;border-top:1px solid #f2f3f6;background:#fafafb">' +
      items.map(([k, label, v, c]) => '<span aria-label="' + label + ': ' + esc(v) + '" style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:800;color:' + col[c] + '">' + ic6(k, 14) + esc(v) + '</span>').join('') + '</div>';
  };

  // To-do rows: a role dot, the text, a pill (or a sign-up's time as plain text)
  const actRow = (a, R) => '<div style="display:flex;align-items:center;gap:10px;min-height:46px;padding:9px 12px;border-top:1px solid #f2f3f6">' +
    '<span style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:' + R.dot + '"></span>' +
    '<span style="flex:1 1 0;min-width:0;font-size:14.5px;line-height:1.3;font-weight:' + (a.warn ? 800 : 700) + ';color:' + (a.warn ? '#8f6405' : '#2a2f38') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(a.act) + '</span>' +
    (a.time ? '<span style="flex:0 0 auto;font-size:13.5px;font-weight:800;color:' + R.ink + '">' + esc(a.cta) + '</span>'
      : '<span ' + (a.go ? on((e) => { stop(e); a.go(); }) + ' ' : '') + 'data-todo-cta style="flex:0 0 auto;display:flex;align-items:center;min-height:28px;padding:0 11px;border-radius:999px;background:' + R.pill + ';color:' + R.ink + ';font-size:13px;font-weight:800;white-space:nowrap' + (a.go ? ';cursor:pointer' : '') + '">' + esc(a.cta) + '</span>') + '</div>';
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

  // Seeded demo content gets a small DEMO pill before its title (owner, 2026-09-30): pilot members joined to a demo
  // group shouldn't mistake it for real plans. Translucent white on photos, gray on white.
  // Demo groups (Hub on Hunters, Walnut Creek, Woodcliff) get the same chip after their name (owner, 2026-09-30)
  // Groups page cards and the group page's title: the DEMO chip sits on its own line above the name
  const groupTagAbove = (g) => g && g.demo ? '<div style="margin-bottom:6px;line-height:1">' + demoTag({ demo: true }, true) + '</div>' : '';
  const groupTag = (g, onPhoto) => g && g.demo ? demoTag({ demo: true }, onPhoto, true) : '';
  const cancelTag = (s, onPhoto, after) => !s || !s.cancelledAt ? '' : '<span data-cancel-tag style="display:inline-block;vertical-align:.15em;' + (after ? 'flex:0 0 auto;margin-left:7px' : 'margin-right:7px') + ';padding:2px 7px;border-radius:999px;font-size:10.5px;line-height:1.3;font-weight:900;letter-spacing:.8px;text-shadow:none;' +
    (onPhoto ? 'background:#d92d4a;color:#fff' : 'background:#fdeef0;color:#9b1c31') + '">CANCELLED</span>';
  // Seeded demo content and members' test events look the same to everyone
  const isDemo = (s) => !!s && (s.demo || s.test);
  const demoTag = (s, onPhoto, after) => cancelTag(s, onPhoto, after) + demoTagOnly(s, onPhoto, after);
  const demoTagOnly = (s, onPhoto, after) => !isDemo(s) ? '' : '<span data-demo-tag style="display:inline-block;vertical-align:.15em;' + (after ? 'flex:0 0 auto;margin-left:7px' : 'margin-right:7px') + ';padding:2px 7px;border-radius:999px;font-size:10.5px;line-height:1.3;font-weight:900;letter-spacing:.8px;text-shadow:none;' +
    (onPhoto ? 'background:rgba(255,255,255,.24);color:#fff;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)' : 'background:#eef0f3;color:#6b7280') + '">DEMO</span>';
  // A photo banner: title (up to two lines, growing upward) and the date line, with a chevron
  const banner6 = (s, R, h) => '<div style="position:relative;height:' + (h || 92) + 'px;background:' + photoBg(s) + '">' +
    '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.94) 0%, rgba(13,17,23,.55) 60%, rgba(13,17,23,.3) 100%)"></div>' +
    '<span aria-hidden="true" style="position:absolute;right:10px;top:0;bottom:0;display:flex;align-items:center;opacity:.85">' + I.chevR(22, '#fff', 2.6) + '</span>' +
    '<div style="position:absolute;left:14px;right:40px;bottom:11px;display:flex;flex-direction:column;gap:3px;color:#fff">' +
      '<div style="font-size:18px;line-height:1.15;font-weight:900;letter-spacing:-.3px;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(s.text) + demoTag(s, true, true) + '</div>' +
      '<div style="font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:' + (s.planned && !s.dayDate ? TBD_ON_PHOTO : R.kick) + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(when6(s)) + '</div>' +
    '</div></div>';

  // An idea's steps, the same everywhere (owner, 2026-09-30): Lead (first, owner 2026-10-01: done unless it's looking
  // for a lead) · Date · Location · Details, and People when the host set how many they need. Only the date is needed
  // to make it a plan.
  const ideaSteps6 = (s) => {
    const n = s.interested.length, top = s.dateOpts.reduce((m, o) => Math.max(m, o.votes.length), 0);
    return [
      { label: 'Lead', icon: 'person', p: s.wantsHost ? 0 : 1, todo: 'Find a lead', done: 'Has a lead', sec: 'sec-lead' },
      { label: 'Date', icon: 'cal', p: s.dayDate ? (s.dayDate >= todayISO() ? 1 : 0) : top ? .5 : 0, todo: 'Pick a date', done: 'Date set', sec: 'sec-when' },
      { label: 'Location', icon: 'pin', p: s.spot ? 1 : s.spotOpts.length ? .5 : 0, todo: 'Pick a location', done: 'Location set', sec: 'sec-when' },
      { label: 'Details', icon: 'roles', p: basicsOf(s).length ? 1 : 0, todo: 'Add details', done: 'Details added', sec: 'sec-details' }
    ].concat(MIN_PEOPLE && s.minPeople ? [{ label: 'People', icon: 'people', p: Math.min(1, n / s.minPeople), todo: n + ' of ' + s.minPeople + ' people in', done: 'Enough people in', sec: 'sec-people' }] : []);
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
  const openProfileSheet = () => needSignIn(() => setState({ profSheet: true, menu: null, fbNudge: null, fbHint: !!state.fbNudge || state.fbHint }), 'profile');
  // Search (the Calendar's search sheet: every upcoming event in your groups)
  const openSearch = () => { setState({ cSearch: true, menu: null }); setTimeout(() => { const f = document.querySelector('[data-csearch]'); if (f) f.focus(); }, 30); };
  const searchBtn = () => '<span ' + on(openSearch) + ' aria-label="Search events" style="flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#f2f3f6;color:#0d1117;display:flex;align-items:center;justify-content:center;cursor:pointer">' + ic6('search', 20, 'currentColor', 2.1) + '</span>';
  const backBtn6 = (fn, label) => '<span ' + on(fn) + ' aria-label="' + (label || 'Back') + '" style="flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.chevL(20, '#0d1117', 2.6) + '</span>';
  const head6 = (title, left, sw, grp) => {
    const h1 = sw ? titleSwitch(title) : '<h1 style="flex:1 1 0;min-width:0;margin:0;font-size:30px;line-height:1;font-weight:900;letter-spacing:-1px;color:#0d1117">' + esc(title) + '</h1>';
    return '<header style="position:relative;z-index:5;background:#fff;padding:' + (grp != null ? '22px 16px 16px' : '14px 16px') + ';display:flex;align-items:center;gap:12px">' + (left || '') +
    (grp ? '<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:1px">' + h1 + grp + '</div>' : h1) +
    '<div style="flex:0 0 auto;display:flex;gap:8px">' + (state.email ? searchBtn() : '') + bellBtn() + '</div></header>';
  };

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
    '<h2 style="margin:0;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + esc(title) + '</h2>' +
    (all ? '<span ' + on(all) + ' aria-label="View all ' + esc(title.toLowerCase()) + '" style="margin-left:auto;display:flex;align-items:center;gap:3px;min-height:32px;padding:0 2px 0 8px;font-size:14px;font-weight:800;color:#6b7280;cursor:pointer">View all' + I.chevR(12, 'currentColor', 3) + '</span>' : '') + '</div>';
  const inviteCard = (icon, title, sub, fn) => '<div ' + on(fn) + ' class="hov-grey-fill" style="display:flex;align-items:center;gap:12px;padding:14px 14px 14px 16px;border-radius:18px;background:#f4f5f7;box-shadow:inset 0 0 0 1.5px #dcdfe6;cursor:pointer">' +
    '<span style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;display:flex;align-items:center;justify-content:center">' + icon + '</span>' +
    '<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:15.5px;font-weight:800;color:#0d1117">' + esc(title) + '</span><span style="font-size:13.5px;line-height:1.35;font-weight:600;color:#6b7280">' + esc(sub) + '</span></div>' +
    I.chevR(16, '#b9bcc4', 2.6) + '</div>';
  // The Calendar with nothing coming up (owner, 2026-09-30): a next step, not just a sentence
  const calEmpty = () => {
    const ideas = state.sparks.filter(s => inMine(s) && phaseOf(s) === 'idea' && !s.cancelledAt), g = ideas.length ? groupById(ideas[0].groupId) : null;
    return '<div data-cal-empty style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:12px">' +
      '<div><div style="font-size:16.5px;font-weight:800;color:#0d1117">Nothing coming up in your groups yet.</div>' +
      '<div style="margin-top:3px;font-size:14.5px;line-height:1.45;font-weight:500;color:#5c6270">' + (ideas.length ? 'Start something, or see what ideas people are floating.' : 'Start something and it shows up here for your group.') + '</div></div>' +
      createBtn() +
      (ideas.length ? '<button type="button" class="hov-outline" ' + on(() => go('browse', { groupId: g ? g.id : state.groupId, phaseTab: 'idea' })) + ' style="' + SECONDARY + '">See ' + ideas.length + (ideas.length === 1 ? ' idea' : ' ideas') + '</button>' : '') +
    '</div>';
  };
  const note6 = (t) => '<div style="' + CARD + ';padding:16px 18px;font-size:15px;line-height:1.45;font-weight:600;color:#6b7280">' + esc(t) + '</div>';
  const CARD6 = 'align-self:flex-start;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer';

  const ideaStepGrid = (s) => '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;justify-items:center;padding:10px 14px 11px;border-top:1px solid #f2f3f6">' +
    ideaSteps6(s).map(st => '<span ' + on((e) => { stop(e); openToSection(s, st.sec); }) + ' aria-label="' + st.label + ': ' + (st.p >= 1 ? st.done : st.todo) + '" style="display:flex;flex-direction:column;align-items:center;gap:5px;min-width:56px;padding:2px 0;border-radius:12px;cursor:pointer">' +
      ring6(st, 40) + '<span style="font-size:11.5px;font-weight:800;color:' + (st.p >= 1 ? '#0f7a3c' : '#454b55') + '">' + st.label + '</span></span>').join('') + '</div>';

  function viewTasks() {
    const st = state;
    const wrap = (inner) => '<div data-screen-label="Your tasks">' + head6('Your tasks', '', true, grpLine('tGrps')) +
      '<div style="padding:14px 14px 22px;display:flex;flex-direction:column;gap:16px">' + inner + '</div><div style="height:var(--nav-h)"></div></div>';
    if (!st.loaded) return wrap(skeleton(2, 200));
    if (!myGroups().length) return wrap(goneCard() + noGroupCard());
    const d = tasksData(grpSel(st.tGrps));
    const row = (cards) => '<div class="snap-row" style="margin:0 -14px">' + cards + '</div>';
    const leadCard = (z) => '<div ' + on(() => openSpark(z.s)) + ' data-task="' + esc(z.s.text) + '" style="' + CARD6 + '">' + banner6(z.s, R6.lead) +
      (phaseOf(z.s) === 'plan' ? statsStrip(z.s) : '') + actBlock(z.s, z.a, R6.lead, 'dashOpen') + '</div>';
    const helpCard = (z) => '<div ' + on(() => openSpark(z.s)) + ' data-task="' + esc(z.s.text) + '" style="' + CARD6 + '">' + banner6(z.s, R6.go) + actBlock(z.s, z.a, R6.go, 'dashOpen') + '</div>';
    const ideaCard = (s) => '<div ' + on(() => openSpark(s)) + ' data-task="' + esc(s.text) + '" style="' + CARD6 + '">' + banner6(s, R6.help) + ideaStepGrid(s) + '</div>';
    // Drafts join the Leading row after the events with to-dos (owner, 2026-10-01; they were a Your drafts list above it)
    const drafts = st.drafts, nLead = d.plans.length + drafts.length;
    const lead = d.leadsAny || drafts.length
      ? '<section aria-label="Leading" style="display:flex;flex-direction:column;gap:8px">' + secHead6(nLead, '#5b4ae8', 'Leading', nLead ? () => setState({ dashAll: 'lead' }) : null) +
          (nLead ? row(d.plans.map(leadCard).join('') + drafts.map(draftCard6).join('')) : note6('Nothing needs you on the events you lead.')) + '</section>'
      : '';
    const help = '<section aria-label="Helping" style="display:flex;flex-direction:column;gap:8px">' + secHead6(d.help.length, '#149a4b', 'Helping', d.help.length ? () => setState({ dashAll: 'help' }) : null) +
      (d.help.length ? row(d.help.map(helpCard).join(''))
        : inviteCard(ic6('heart', 18, '#454b55', 2.4), 'Find something to help with', 'Leads in your groups need a hand. Sign up to bring something or pitch in.', () => handList().length ? setState({ cHandSheet: true }) : go('calendar'))) + '</section>';
    const invite = d.leadsAny || drafts.length ? '' : '<section aria-label="Leading" style="display:flex;flex-direction:column;gap:8px">' + secHead6(0, '#5b4ae8', 'Leading') +
      inviteCard(I.plus(18, '#454b55', 2.6), 'Start an event', 'You’re not leading anything yet. Got an idea for your group?', () => goCompose()) + '</section>';
    const ideas = d.ideas.length ? '<section aria-label="Ideas" style="display:flex;flex-direction:column;gap:8px">' + secHead6(d.ideas.length, '#e8a71c', 'Ideas', () => setState({ dashAll: 'idea' })) +
      row(d.ideas.map(ideaCard).join('')) + '</section>' : '';
    return wrap(goneCard() + lead + help + invite + ideas);
  }

  // "View all": one card per event with every to-do (ideas: the four checkpoints as rows)
  function viewDashAll() {
    const k = state.dashAll, d = tasksData(), close = () => setState({ dashAll: null });
    const title = { lead: 'Leading', help: 'Helping', idea: 'Ideas' }[k], R = k === 'lead' ? R6.lead : k === 'help' ? R6.go : R6.help;
    const list = k === 'lead' ? d.plans : k === 'help' ? d.help : d.ideas.map(s => ({ s, a: [] })), drafts = k === 'lead' ? state.drafts : [];
    const thumb = (s) => '<span aria-hidden="true" style="flex:0 0 40px;width:40px;height:40px;border-radius:10px;background:' + photoBg(s) + '"></span>';
    const stepRows = (s) => ideaSteps6(s).map(st => '<div ' + on((e) => { stop(e); openToSection(s, st.sec); }) + ' style="display:flex;align-items:center;gap:12px;min-height:50px;padding:8px 12px;border-top:1px solid #f2f3f6;cursor:pointer">' +
      ring6(st, 30) + '<span style="flex:1;min-width:0;font-size:14.5px;font-weight:700;color:' + (st.p >= 1 ? '#8a909b' : '#2a2f38') + '">' + (st.p >= 1 ? st.done : st.todo) + '</span>' + I.chevR(14, '#b9bcc4', 2.6) + '</div>').join('');
    const card = (z) => '<div ' + on(() => openSpark(z.s)) + ' data-task="' + esc(z.s.text) + '" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px">' + thumb(z.s) +
        '<div style="flex:1;min-width:0"><div style="font-size:15px;line-height:1.25;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(z.s.text) + '</div>' +
        '<div style="margin-top:2px;font-size:12.5px;font-weight:600;color:' + R.ink + '">' + esc(when6(z.s)) + '</div></div>' + I.chevR(14, '#b9bcc4', 2.6) + '</div>' +
      (k === 'lead' && phaseOf(z.s) === 'plan' ? statsStrip(z.s) : '') +
      (k === 'idea' ? stepRows(z.s) : z.a.map(a => actRow(a, R)).join('')) + '</div>';
    return sheet6(title, close,
      '<div style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:999px;background:' + R.dot + '"></span>' +
        '<h2 style="flex:1;margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + title + '</h2>' + closeX(close) + '</div>',
      '<div style="padding:14px 14px 30px;display:flex;flex-direction:column;gap:10px">' + (list.length || drafts.length ? list.map(card).join('') + drafts.map(draftRow6).join('') : '<div style="' + CARD + ';padding:26px 16px;text-align:center;font-size:15px;font-weight:700;color:#6b7280">Nothing here right now.</div>') + '</div>');
  }

  // ---- Screen 2: Your calendar (was Your schedule; the screen the app opens on since v7 Update 16) ----------
  // Upcoming plans you lead, said Going / Maybe to, or signed up to help with
  const schedList = () => state.sparks.filter(s => inMine(s) && phaseOf(s) === 'plan' && (isLead(s) || ['going', 'maybe'].indexOf(myRsvp(s)) > -1 || helpsOn(s))).sort(byWhen);
  // Your part in a plan: its colours, word, icon, what's left to do and the strip's right side
  const partOf = (s, cal) => {
    const my = myRsvp(s);
    if (s.cancelledAt) return { k: 'off', R: R6.open, word: 'Cancelled', rows: [], right: 'See' };
    if (isLead(s)) return { k: 'lead', R: R6.lead, word: 'Leading', icon: 'bolt', rows: ownActs(s) };
    if (helpsOn(s)) return { k: 'help', R: R6.help, word: 'Helping', icon: 'clip', rows: helpActs(s) };
    if (my === 'going' || my === 'maybe') return { k: 'go', R: my === 'maybe' ? R6.maybe : R6.go, word: my === 'maybe' ? 'Maybe' : 'Going', icon: 'check', rows: [], right: my === 'maybe' ? 'Update RSVP' : 'Change RSVP' };
    return cal ? { k: 'open', R: R6.open, word: '', rows: [], right: 'RSVP' } : null;
  };
  // The strip under a card: your role on the left; tasks (tap to expand in place), All set, or Change / Update RSVP
  const strip6 = (s, P, h, cal) => {
    const open = !!state.schedOpen[s.id] && P.rows.length > 0;
    const expands = P.rows.length > 0;   // the same on every list (audit, 2026-10-01: the Calendar said "Manage" and opened the event)
    const tap = (e) => { stop(e); if (!expands) openSpark(s); else setState({ schedOpen: Object.assign({}, state.schedOpen, { [s.id]: !open }) }); };
    const f = signupFill(s), n = going(s).length;
    let left, right;
    if (P.k === 'open') {
      left = f.open > 0 ? '<b style="font-weight:800">' + f.open + (f.open === 1 ? ' spot left' : ' spots left') + '</b><span style="font-weight:600;color:#8a909b"> · ' + n + ' going</span>' : '<b style="font-weight:800">' + n + ' going</b>';
      right = '<span style="color:#0d1117">RSVP</span>';
    } else {
      left = '<span style="display:flex;align-items:center;gap:6px">' + (h > 30 && P.icon ? ic6(P.icon, 14, P.R.ink, 2.4) : '') + P.word + '</span>';
      const word = P.right || (P.rows.length ? P.rows.length + (P.rows.length === 1 ? ' task' : ' tasks') : 'All set');
      right = '<span style="display:flex;align-items:center;gap:4px">' + (open ? '' : word) + (expands || P.k === 'go' ? chev6(11, P.R.ink, open) : '') + '</span>';
    }
    return '<div ' + on(tap) + ' aria-expanded="' + open + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;height:' + h + 'px;padding:0 14px;background:' + P.R.strip + ';border-top:1px solid ' + P.R.strip + ';font-size:' + (h > 30 ? 13.5 : 12) + 'px;font-weight:800;color:' + P.R.ink + ';cursor:pointer">' + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + left + '</span>' + right + '</div>' +
      (open ? '<div style="display:flex;flex-direction:column;background:#fff">' + P.rows.map(a => actRow(a, P.R)).join('') + '</div>' : '');
  };
  // Tiles: the photo with date, title and place; the strip under it
  // Event preview (v7 Update 15, 13a; owner said build it, 2026-10-02): on the Calendar a plan opens a slide-up first
  const peekOrOpen = (s) => s.planned ? setState({ peek: s.id, menu: null }) : openSpark(s);
  const tile6 = (s, P, h, cal) => {
    const g = groupById(s.groupId);
    return '<div ' + on(() => cal ? peekOrOpen(s) : openSpark(s)) + ' data-plan="' + esc(s.text) + '" aria-label="' + esc(s.text) + '" style="border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<div style="position:relative;height:' + h + 'px;background:' + photoBg(s) + '">' +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.95) 0%, rgba(13,17,23,.65) 45%, rgba(13,17,23,.3) 100%)"></div>' +
        (cal && g ? '<span style="position:absolute;top:10px;left:10px;display:flex;align-items:center;height:24px;padding:0 9px;border-radius:999px;background:rgba(13,17,23,.4);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-size:11.5px;font-weight:800;color:#fff">' + esc(groupsLabel(s)) + '</span>' : '') +
        '<div style="position:absolute;left:16px;right:16px;bottom:14px;color:#fff;display:flex;flex-direction:column;gap:3px">' +
          '<div style="font-size:13px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:' + (!s.dayDate ? TBD_ON_PHOTO : P.k === 'open' ? '#dfe2e8' : P.R.kick) + '">' + esc(when6(s)) + '</div>' +
          '<div style="font-size:25px;line-height:1.05;font-weight:900;letter-spacing:-.6px;text-wrap:balance">' + esc(s.text) + demoTag(s, true, true) + '</div>' +
          '<div style="display:flex;align-items:center;gap:5px;font-size:14.5px;font-weight:700;color:rgba(255,255,255,.9);min-width:0">' + ic6('pin', 14, 'currentColor', 2.3) + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (s.spot ? esc(s.spot) : tbdSpan(spotTbd(s), TBD_ON_PHOTO)) + '</span></div>' +
        '</div></div>' + strip6(s, P, 40, cal) + '</div>';
  };
  // List: date block, role bar, title, time · street, the photo on the right, over the strip (the same on every list since the audit, 2026-10-01)
  const listCard6 = (s, P, cal, thumb) => {
    const dp = s.dayDate ? dateParts(s.dayDate) : null;
    return '<div ' + on(() => cal ? peekOrOpen(s) : openSpark(s)) + ' data-plan="' + esc(s.text) + '" aria-label="' + esc(s.text) + '" style="border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px">' +
        '<div style="flex:0 0 40px;display:flex;flex-direction:column;align-items:center">' + (dp ? '<span style="font-size:10.5px;font-weight:900;letter-spacing:.6px;color:#6b7280">' + dp.dow + '</span><span style="font-size:20px;line-height:1.1;font-weight:900;color:#0d1117">' + dp.day + '</span>'
          : '<span style="font-size:10.5px;font-weight:900;letter-spacing:.6px;color:#8f6405">TBD</span><span style="font-size:20px;line-height:1.1;font-weight:900;color:#8f6405">?</span>') + '</div>' +
        '<span aria-hidden="true" style="flex:0 0 3px;align-self:stretch;border-radius:999px;background:' + P.R.dot + '"></span>' +
        '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;min-width:0"><span style="min-width:0;font-size:15px;line-height:1.3;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(s.text) + '</span>' + demoTag(s, false, true) + '</div>' +
          '<div style="font-size:12.5px;font-weight:600;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + [s.dayDate ? esc(fmtTime(s.dayTime)) : tbdSpan(dateTbd(s)), s.spot ? esc(street(s)) : tbdSpan(spotTbd(s))].filter(Boolean).join(' · ') + '</div></div>' +
        '<span aria-hidden="true" style="flex:0 0 44px;width:44px;height:44px;border-radius:10px;background:' + photoBg(s) + '"></span>' +
      '</div>' + strip6(s, P, 28, cal) + '</div>';
  };

  // Up next (v6 Update 9): the next plan as a big photo with a countdown; your role strip, then its to-dos listed open
  const nextCard6 = (s, P) => {
    const d = daysTo(s), when = d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days';
    return '<div ' + on(() => openSpark(s)) + ' data-plan="' + esc(s.text) + '" data-next aria-label="' + esc(s.text) + '" style="border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<div style="position:relative;height:170px;background:' + photoBg(s) + '">' +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.95) 0%, rgba(13,17,23,.6) 45%, rgba(13,17,23,.25) 100%)"></div>' +
        '<span style="position:absolute;top:12px;right:14px;display:flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;background:rgba(13,17,23,.4);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff;font-size:11.5px;font-weight:800">' + when + '</span>' +
        '<div style="position:absolute;left:16px;right:16px;bottom:14px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.3)">' +
          // the badge says Today / Tomorrow / In N days, so the date line gives the date itself (it said "Today" twice); its colour follows your role
          '<div style="font-size:13px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:' + P.R.kick + '">' + esc(s.dayDate ? fmtDay(s.dayDate) + (s.dayTime ? ' · ' + fmtTime(s.dayTime) : '') : when6(s)) + '</div>' +
          '<div style="margin-top:3px;font-size:25px;line-height:1.1;font-weight:900;letter-spacing:-.6px;text-wrap:balance">' + esc(s.text) + demoTag(s, true, true) + '</div>' +
          '<div style="margin-top:6px;display:flex;align-items:center;gap:6px;font-size:14.5px;font-weight:700;color:rgba(255,255,255,.9);min-width:0">' + ic6('pin', 13, 'currentColor', 2.6) + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (s.spot ? esc(s.spot) : tbdSpan(spotTbd(s), TBD_ON_PHOTO)) + '</span></div>' +
        '</div></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;height:40px;padding:0 14px;background:' + P.R.strip + ';font-size:13.5px;font-weight:800;color:' + P.R.ink + '"><span>' + P.word + '</span>' +
        (P.k === 'go' ? '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + P.right + '</span>' : '') + '</div>' +
      P.rows.map(a => actRow(a, P.R)).join('') + '</div>';
  };
  // Soonest in Up next: the hero, then This week / Next week / Later in {month} / Date TBD
  const nextSections = (list) => {
    const n = list.find(s => s.dayDate && daysTo(s) >= 0), out = n ? [{ label: 'Up next', hero: n, items: [] }] : [];
    list.filter(s => s !== n).forEach(s => {
      // v7 Update 15: Later in {this month}, then a later month by its name alone (November)
      const d = daysTo(s), mon = s.dayDate && new Date(s.dayDate + 'T12:00').toLocaleDateString('en-US', { month: 'long' });
      const label = d == null ? 'Date TBD' : d < 7 ? 'This week' : d < 14 ? 'Next week' : s.dayDate.slice(0, 7) === todayISO().slice(0, 7) ? 'Later in ' + mon : mon;
      let z = out.find(q => q.label === label); if (!z) { z = { label, items: [] }; out.push(z); } z.items.push(s);
    });
    return out;
  };

  // ---- v6 Update 2: Sort · Filter pills (Your schedule and group pages) ------------------------
  const SORTS6 = [['soon', 'Soonest'], ['lively', 'Most lively'], ['new', 'Newest'], ['help', 'Could use a hand']];
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
    needs: ['Could use a hand', (s) => signupFill(s).open > 0],
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
    const st = state, view = HOME_VIEWS.indexOf(st.homeView) > -1 ? st.homeView : 'next';
    const wrap = (inner) => '<div data-screen-label="Your calendar">' + head6('Your calendar', '', false, grpLine('sGrps')) + '<div style="padding:14px 14px 24px;display:flex;flex-direction:column;gap:22px">' + inner + '</div><div style="height:var(--nav-h)"></div></div>';
    if (!st.loaded) return wrap(skeleton(2, 220));
    if (!myGroups().length) return wrap(goneCard() + noGroupCard());
    const sel = grpSel(st.sGrps), every = schedList(), all = every.filter(inPick(sel));
    if (!every.length) return wrap(goneCard() + schedEmpty());
    if (!all.length) return wrap(goneCard() + filterEmpty(() => setState({ sGrps: null, menu: null }), sel.map(id => (groupById(id) || {}).name).filter(Boolean)));
    // Sort · Filter · view, on the first heading row
    const viewPick = () => viewPicker('hview', view, (k) => setState({ homeView: k, menu: null, hMon: null, hDay: null }), HOME_VIEWS);
    const plans = applySort(applyFilters(all, st.sFilt), st.sSort), clear = () => setState({ sFilt: [], menu: null });
    const filt = () => filterPill('sFilt', filterOpts(['lead', 'help', 'going', 'maybe', 'needs', 'week'], all, st.sFilt), st.sFilt,
      (k) => setState({ sFilt: st.sFilt.indexOf(k) > -1 ? st.sFilt.filter(x => x !== k) : st.sFilt.concat([k]) }), clear, plans.length);
    const controls = '<div style="display:flex;align-items:center;gap:6px">' +
      sortPill('sSort', st.sSort, (k) => setState({ sSort: k, menu: null })) + filt() + viewPick() + '</div>';
    if (!plans.length) return wrap(goneCard() + '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(st.sSort === 'soon' ? 'Coming up' : sortName6(st.sSort), controls) + filterEmpty(clear) + '</div>');
    // Month: the grid with the chosen day's plans; the view menu sits beside the month arrows
    if (view === 'month') return wrap(goneCard() +
      monthBody(plans, { mon: st.hMon, day: st.hDay, cal: false, menu: '<div style="display:flex;align-items:center;gap:6px">' + filt() + viewPick() + '</div>', card: (s) => listCard6(s, partOf(s), false, true),
        set: (hMon, hDay) => setState({ hMon, hDay }), toTbd: () => setState({ homeView: 'next', sSort: 'soon', menu: null, hMon: null, hDay: null }) }));
    // Up next (Soonest only): the hero card, then list cards by This week / Next week / Later in {month}
    const secs = view === 'next' && st.sSort === 'soon' ? nextSections(plans) : sections6(plans, st.sSort, 'Date TBD');
    const card = (s) => view === 'next' ? listCard6(s, partOf(s), false, true) : tile6(s, partOf(s), 180);
    return wrap(goneCard() + secs.map((z, i) => '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(z.label, i ? '' : controls) +
      '<div style="display:flex;flex-direction:column;gap:' + (view === 'next' ? 10 : 14) + 'px">' + (z.hero ? nextCard6(z.hero, partOf(z.hero)) : z.items.map(card).join('')) + '</div></div>').join(''));
  }

  // ---- Screen 3: Explore (the community Calendar until v7 Update 16) ---------------------------
  // Event types: the host picks up to two in Create event or the Details pop-up (owner, 2026-09-30; `sparks.tags`)
  const TYPES6 = [['active', 'Active'], ['outdoors', 'Outdoors'], ['food', 'Food'], ['family', 'Family'], ['social', 'Social']];
  const typesOf = (s) => s.tags || [];
  const typeName = (k) => (TYPES6.find(x => x[0] === k) || [])[1] || k;
  // Upcoming plans in your groups (invite-only ones only show if you can see them)
  const calBase = () => state.sparks.filter(s => inMine(s) && phaseOf(s) === 'plan');
  // A screen's group pick, kept between visits on the device (Joseph, 2026-10-03; v7 Update 16: Explore, Your tasks and
  // Your calendar each keep their own). A group you've left drops out; none left, or all, is everything
  const grpSel = (c) => {
    if (!c || !c.length) return c;
    const ids = myGroups().map(g => g.id), k = c.filter(id => ids.indexOf(id) > -1);
    return k.length && k.length < ids.length ? k : null;
  };
  const calSel = () => grpSel(state.cGrps);
  const inPick = (sel) => (s) => !sel || gIds(s).some(id => sel.indexOf(id) > -1);
  // Your tasks and Your calendar: the group line under the title (Update 16, option 1b). Gray *All groups ⌄*; purple once
  // narrowed, with the group's name or *2 groups*. It opens a checklist (All groups first) with a black Done
  const grpLine = (key) => {
    const groups = groupsInOrder();
    if (groups.length < 2) return '';
    const sel = grpSel(state[key]), open = state.menu === key;
    const label = !sel ? 'All groups' : sel.length === 1 ? (groupById(sel[0]) || {}).name || '1 group' : sel.length + ' groups';
    const set = (next) => setState({ [key]: next && next.length && next.length < groups.length ? next : null });
    const box = (on_) => '<span aria-hidden="true" style="flex:0 0 20px;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;' + (on_ ? 'background:#5b4ae8' : 'background:#fff;box-shadow:inset 0 0 0 2px #c9ccd3') + '">' + (on_ ? svg(12, stroke('#fff', 3.6), P6.check) : '') + '</span>';
    const row = (name, on_, fn) => '<div ' + on((e) => { stop(e); fn(); }, 'menuitemcheckbox') + ' aria-checked="' + on_ + '" class="hov-grey-fill" style="display:flex;align-items:center;gap:10px;min-height:42px;padding:0 12px;border-radius:10px;font-size:14.5px;font-weight:' + (on_ ? 900 : 700) + ';color:#0d1117;cursor:pointer">' +
      box(on_) + '<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(name) + '</span></div>';
    return '<div data-menu style="position:relative;align-self:flex-start;min-width:0;max-width:100%">' +
      '<span ' + on((e) => { stop(e); setState({ menu: open ? null : key }); }) + ' aria-label="Groups: ' + esc(label) + '" aria-expanded="' + open + '" style="display:flex;align-items:center;gap:5px;min-height:26px;max-width:100%;font-size:14.5px;font-weight:800;color:' + (sel ? '#4a3ad4' : '#6b7280') + ';cursor:pointer">' +
        svg(14, stroke('currentColor', 2.4), P6.people) + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(label) + '</span>' + I.chevD(11, 'currentColor', 3) + '</span>' +
      (open ? '<div role="menu" aria-label="Groups" style="position:absolute;top:30px;left:0;z-index:25;width:260px;padding:6px;border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(15,18,25,.18),0 0 0 1px #e6e7eb;animation:popIn 160ms ease both">' +
        row('All groups', !sel, () => set(null)) +
        groups.map(g => { const on_ = !!sel && sel.indexOf(g.id) > -1; return row(g.name, on_, () => set(on_ ? sel.filter(x => x !== g.id) : (sel || []).concat([g.id]))); }).join('') +
        '<div style="padding:6px 4px 2px"><button type="button" ' + on((e) => { stop(e); setState({ menu: null }); }) + ' style="width:100%;min-height:40px;border:0;border-radius:999px;background:#0d1117;color:#fff;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer">Done</button></div></div>' : '') +
    '</div>';
  };
  // After joining a group: a new member's Explore opens on it (join_also adds groups they didn't pick); a pick already made takes it in
  const calAfterJoin = (id, before, isNew) => {
    if (isNew || !before.filter(x => x !== id).length) return setState({ cGrps: [id] });
    const sel = calSel();
    if (sel && sel.indexOf(id) < 0) setState({ cGrps: sel.concat([id]) });
  };
  const inGroups6 = (s) => inPick(calSel())(s);
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
  // Follows the Calendar's group filter, like the list under it (Joseph's demo, 2026-10-02)
  const handList = () => {
    const cand = calBase().filter(s => inGroups6(s) && s.dayDate && !s.cancelledAt && !isLead(s) && signupFill(s).open > 0).sort(byWhen);
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
            '<span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.name) + '</span>' + (r.demo ? groupTag(r) : '') + '<span style="font-size:13px;font-weight:800;color:#8a909b">' + r.n + '</span></div>').join('') +
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
  const CSORTS = [['soon', 'Soonest'], ['lively', 'Most lively'], ['new', 'Newest'], ['help', 'Could use a hand']];
  const calViewMenu = () => {
    const icon = (k, c) => svg(17, 'fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"', VIEW_ICONS[k]);
    return miniMenu('cView', 'View: ' + VIEW_NAMES[state.cView], icon(state.cView, 'currentColor') + I.chevD(12, 'currentColor', 2.8),
      CVIEWS.map(k => [k, VIEW_NAMES[k], icon(k, '#6b7280')]), state.cView, (k) => setState({ cView: k, menu: null, cMon: null, cDay: null }));
  };

  // Month grid, then the chosen day's events (the Calendar, and Your schedule since v6 Update 9)
  const monthBody = (list, o) => {
    const first = list.find(s => s.dayDate) || null, cm = o.mon || (first ? first.dayDate.slice(0, 7) : todayISO().slice(0, 7));
    const [y, m] = cm.split('-').map(Number), start = new Date(y, m - 1, 1), nDays = new Date(y, m, 0).getDate(), today = todayISO();
    const inMonth = list.filter(s => s.dayDate && s.dayDate.slice(0, 7) === cm), undatedN = list.filter(s => !s.dayDate).length;
    const sel = o.day && o.day.slice(0, 7) === cm ? o.day : (today.slice(0, 7) === cm ? today : (inMonth[0] ? inMonth[0].dayDate : cm + '-01'));
    const shift = (d) => () => { const x = new Date(y, m - 1 + d, 1); o.set(x.getFullYear() + '-' + pad2(x.getMonth() + 1), null); };
    const navBtn = (fn, label, icon) => '<span ' + on(fn) + ' aria-label="' + label + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + icon + '</span>';
    const cells = [];
    for (let i = 0; i < start.getDay(); i++) cells.push('<span></span>');
    for (let d = 1; d <= nDays; d++) {
      const iso = cm + '-' + pad2(d), onIt = iso === sel, day = inMonth.filter(s => s.dayDate === iso);
      const dot = (s) => { const P = partOf(s, o.cal); return onIt ? '#fff' : P.k === 'open' ? '#9aa0ac' : P.R.dot; };
      cells.push('<span ' + on(() => o.set(cm, iso)) + ' aria-label="' + esc(fmtDay(iso) + (day.length ? ', ' + day.length + (day.length === 1 ? ' event' : ' events') : '')) + '" aria-pressed="' + onIt + '" style="height:46px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;background:' + (onIt ? '#0d1117' : 'transparent') + '">' +
        '<span style="font-size:15px;font-weight:' + (day.length || onIt ? 900 : 700) + ';color:' + (onIt ? '#fff' : iso === today ? '#5b4ae8' : day.length ? '#0d1117' : '#9aa0ac') + '">' + d + '</span>' +
        '<span style="display:flex;gap:3px;height:5px">' + day.slice(0, 3).map(s => '<span style="width:5px;height:5px;border-radius:999px;background:' + dot(s) + '"></span>').join('') + '</span></span>');
    }
    const dayList = list.filter(s => s.dayDate === sel);
    return '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<div style="display:flex;align-items:center;gap:8px;padding:0 4px"><h2 style="flex:1;margin:0;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + esc(start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })) + '</h2>' +
        navBtn(shift(-1), 'Previous month', I.chevL(15, '#0d1117', 2.6)) + navBtn(shift(1), 'Next month', I.chevR(15, '#0d1117', 2.6)) + o.menu + '</div>' +
      '<div style="' + CARD + ';padding:10px 8px">' +
        '<div aria-hidden="true" style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));padding-bottom:4px">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => '<span style="text-align:center;font-size:11px;font-weight:800;letter-spacing:.6px;color:#6b7280">' + x + '</span>').join('') + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px">' + cells.join('') + '</div></div>' +
      // Undated events stay out of the grid; the strip opens List at "Date TBD" (Round 65d)
      (undatedN ? '<div ' + on(() => { o.toTbd(); setTimeout(() => { const el = document.querySelector('[data-sec-tbd]'); if (el) el.scrollIntoView({ block: 'start' }); }, 0); }) + ' data-no-date style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:#fef7dd;box-shadow:inset 0 0 0 1.5px #e3c979;cursor:pointer">' +
        svg(18, stroke('#8f6405', 2.2), '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>') +
        '<span style="flex:1;font-size:14px;font-weight:800;color:#8f6405">' + undatedN + (undatedN === 1 ? ' event with no date yet' : ' events with no date yet') + '</span>' + I.chevR(14, '#8f6405', 2.6) + '</div>' : '') +
      '<div style="padding:6px 4px 0;font-size:16px;font-weight:900;color:#0d1117">' + esc(new Date(sel + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) + '</div>' +
      (dayList.length ? dayList.map(o.card).join('') : '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px"><span style="font-size:17px;font-weight:900;color:#0d1117">' + esc(fmtDay(sel)) + '</span><span style="font-size:13px;font-weight:700;color:#9aa0ac">0 events</span></div>' +
        '<div style="font-size:15px;font-weight:700;color:#6b7280">Nothing on this day.</div>' +
        (sel >= today ? '<span ' + on(() => goCompose({ evDate: sel })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:32px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(15, '#5b4ae8', 2.8) + 'Start an event on ' + esc(new Date(sel + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + '</span>' : '') + '</div>') + '</div>';
  };

  function viewCalendar() {
    const st = state, groups = groupsInOrder(), base = calBase(), list = calResults(), hand = handList();
    const calHero = currentGroup();   // the header shows the group last opened (owner, 2026-10-02: no pilot photo for everyone)
    const header = '<header style="position:relative;height:calc(180px + var(--pt));overflow:hidden;background:#2b303a">' +
      (calHero && groupPhoto(calHero) ? '<div style="position:absolute;inset:0;overflow:hidden">' + photoLayer(groupPhoto(calHero), calHero.photoPos, GROUP_POS) + '</div>' : '<div aria-hidden="true" style="position:absolute;inset:0;background:' + HEAD_GOLD + '"></div>') +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:' + HEAD_WASH + '"></div>' +
      '<div style="position:absolute;top:calc(14px + var(--pt));right:16px;display:flex;gap:8px;z-index:2">' +
        '<span ' + on(openSearch) + ' aria-label="Search events" style="width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer">' + ic6('search', 19, '#fff', 2.4) + '</span>' +
        bellBtn(true) + '</div>' +
      // The same spacing as Your people's header (owner, 2026-10-01)
      '<div style="position:absolute;left:18px;right:90px;bottom:16px;color:#fff">' +
        '<div style="font-size:13px;font-weight:900;letter-spacing:1px;color:#cfc9ff">ALL EVENTS</div>' +
        '<h1 style="margin:2px 0 0;font-size:40px;line-height:1;font-weight:900;letter-spacing:-1.4px;color:#fff">Explore</h1>' +
        '<div style="margin-top:6px;font-size:14px;font-weight:700;color:rgba(255,255,255,.88)">' + (groups.length ? 'Everything happening in your ' + groups.length + (groups.length === 1 ? ' group' : ' groups') : st.error === 'load' ? 'Couldn’t load your groups' : 'Join a group to see its events') + '</div></div>' +
      '<button type="button" class="hov-primary" ' + on(() => goCompose()) + ' data-new-event aria-label="Start an event" style="position:absolute;right:16px;bottom:16px;z-index:2;width:52px;height:52px;border:0;border-radius:999px;background:#5b4ae8;box-shadow:0 6px 16px rgba(13,17,23,.35);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.plus(22, '#fff', 2.8) + '</button>' +
    '</header>';

    // Filters: Groups · Type · Clear filters
    const gSel = calSel(), nG = gSel ? gSel.length : groups.length;
    const gLabel = !gSel ? 'All groups' : !nG ? 'No groups' : nG === 1 ? '1 group' : nG + ' groups';
    const toggleG = (id) => { const cur = gSel || groups.map(g => g.id), next = cur.indexOf(id) > -1 ? cur.filter(x => x !== id) : cur.concat([id]); setState({ cGrps: next.length === groups.length ? null : next }); };
    const shown = base.filter(s => inGroups6(s) && inTypes6(s)).length;
    const gMenu = checkMenu('cGrp', gLabel, 'people', 'Groups', groups.map(g => ({ name: g.name, demo: g.demo, n: base.filter(s => inGroup(s, g.id)).length, on: !gSel || gSel.indexOf(g.id) > -1, toggle: () => toggleG(g.id) })),
      !gSel, () => setState({ cGrps: null }), () => setState({ cGrps: [] }), 'Show ' + shown + (shown === 1 ? ' event' : ' events'));
    const filtered = !!gSel;   // no Type filter (owner, 2026-10-02: nothing sets an event's type since the picker went)
    // Narrowed: a lavender *Showing: Torrez Fitness ✕* (or *Showing: 2 of 3 groups ✕*) that goes back to all groups (Update 16)
    const showing = gSel && nG ? '<span ' + on(() => setState({ cGrps: null, menu: null })) + ' aria-label="Show all groups" style="flex:0 1 auto;min-width:0;display:flex;align-items:center;gap:6px;min-height:36px;padding:0 8px 0 12px;border-radius:999px;background:#f3f1fe;box-shadow:inset 0 0 0 1.5px #c9c2fb;color:#4a3ad4;font-size:13.5px;font-weight:800;cursor:pointer">' +
      '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Showing: ' + esc(nG === 1 ? (groupById(gSel[0]) || {}).name || '1 group' : nG + ' of ' + groups.length + ' groups') + '</span>' + I.x(12, '#4a3ad4', 3) + '</span>' : '';
    const filters = '<div style="position:relative;z-index:6;display:flex;align-items:center;gap:8px;padding:14px 14px 0">' + gMenu + showing +
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
    const wild = '';   // "Feeling wild?" is gone (owner, 2026-10-01): filler, like Search's old surprise cards
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
      return d == null ? 'Date TBD' : d === 0 ? 'Today' : d < 7 ? 'This week' : monthLabel(s.dayDate);
    };
    const secs = [];
    list.forEach(s => { const l = secOf(s); let z = secs.find(q => q.label === l); if (!z) { z = { label: l, items: [] }; secs.push(z); } z.items.push(s); });
    const card6 = (s) => st.cView === 'tiles' ? tile6(s, partOf(s, true), 170, true) : listCard6(s, partOf(s, true), true);
    let body;
    if (!st.loaded) body = skeleton(3, 90);
    else if (st.cView === 'month') body = monthBody(list, { mon: st.cMon, day: st.cDay, cal: true, menu: calViewMenu(), card: card6,
      set: (cMon, cDay) => setState({ cMon, cDay }), toTbd: () => setState({ cView: 'list', cSort: 'soon', menu: null, cMon: null, cDay: null }) });
    else if (!list.length) {
      body = st.loaded && !groups.length ? '' : '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(st.cSort === 'soon' ? 'Coming up' : (CSORTS.find(x => x[0] === st.cSort) || CSORTS[0])[1], '<div style="display:flex;align-items:center">' + sortMenu + calViewMenu() + '</div>') +
        (filtered ? filterEmpty(clearFilters, (gSel ? groups.filter(g => gSel.indexOf(g.id) > -1).map(g => g.name) : [])) : calEmpty())   // (tSel went with the Type filter; it froze this screen, 2026-10-02) + '</div>';
    } else {
      body = secs.map((z, i) => '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(z.label, i ? '' : '<div style="display:flex;align-items:center">' + sortMenu + calViewMenu() + '</div>') +
        z.items.map(card6).join('') + '</div>').join('');
    }
    return '<div data-screen-label="Explore">' + header + filters +
      '<div style="padding:10px 14px 0;display:flex;flex-direction:column;gap:10px">' + goneCard() + (st.loaded && !groups.length ? noGroupCard() : '') + wild + needs + '</div>' +
      '<div style="padding:16px 14px 26px;display:flex;flex-direction:column;gap:22px">' + body + '</div>' +
      '<div style="height:var(--nav-h)"></div></div>';
  }

  // "Could use a hand": each event's open roles, with Claim
  const claimRole = (s, it) => (noteTap({ k: 'role', id: s.id, item: it.id }), needAccount(() => { const was = myRsvp(s);
    if (!state.viewAs) onItBanner(s, { items: [it.id], was });
    quick(s, Object.assign(withClaim(s, [it.id], true), goingToo(s)), async () => {
      await saveGuestContact(s.id);
      must(await sb.from('signup_claims').insert({ item_id: it.id, user_id: state.me }));
      await goingWithJob(s);
    }, (ok) => { if (!ok) { clearTimeout(bannerTimer); setState({ banner: null }); } }); }));
  // The event preview slide-up (13a): photo, group, title, Led by, date and place, who's going, the RSVP buttons
  // (the lead sees You're leading this.) and See the full event
  function viewPeek() {
    const s = state.sparks.find(x => x.id === state.peek);
    if (!s) return '';
    const close = () => setState({ peek: null }), lead = isLead(s), my = myRsvp(s), ids = going(s).map(r => r.userId), n = ids.length;
    const C = { going: ['#149a4b', '#fff'], maybe: ['#e8a71c', '#2a1d00'], no: ['#0d1117', '#fff'] };
    const btn = (k, label) => { const sel = my === k; return '<button type="button" ' + on(() => setRsvp(s, k)) + ' aria-pressed="' + sel + '" style="flex:1 1 0;min-height:48px;border:0;border-radius:999px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;' +
      (sel ? 'background:' + C[k][0] + ';color:' + C[k][1] : 'background:#fff;color:#0d1117;box-shadow:inset 0 0 0 1.5px #dcdfe6') + '">' + label + '</button>'; };
    return '<div class="v6-scrim" data-scrim="' + reg(close) + '" style="display:flex;align-items:flex-end">' +
      '<div role="dialog" aria-modal="true" aria-label="Event preview" data-screen-label="Event preview" style="position:relative;width:100%;max-height:calc(100% - 48px - var(--sat));overflow-y:auto;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -10px 40px rgba(13,17,23,.25);display:flex;flex-direction:column;animation:sheetUp 260ms cubic-bezier(.2,.8,.2,1) both">' +
        '<div style="position:relative;flex:0 0 190px;height:190px;border-radius:24px 24px 0 0;background:' + photoBg(s) + '">' +
          '<div aria-hidden="true" style="position:absolute;top:8px;left:50%;transform:translateX(-50%);width:40px;height:5px;border-radius:999px;background:rgba(255,255,255,.85)"></div>' +
          '<span ' + on(close) + ' role="button" aria-label="Close" style="position:absolute;top:14px;right:14px;width:40px;height:40px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(14, '#0d1117', 2.8) + '</span></div>' +
        '<div style="padding:18px 18px calc(26px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:14px">' +
          '<div style="display:flex;flex-direction:column;gap:6px">' +
            '<span style="font-size:12px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#6b7280">' + esc(groupsLabel(s)) + '</span>' +
            '<span data-peek-title style="font-size:24px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117;text-wrap:balance">' + esc(s.text) + '</span>' +
            '<span style="font-size:14px;font-weight:700;color:#5c6270">Led by ' + esc(lead && isTheLead(s) ? 'you' : nameOf(s.leadId, s.leadName)) + '</span></div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:16px;background:#f7f7f9">' +
            '<div style="display:flex;align-items:center;gap:10px">' + svg(18, stroke('#5b4ae8', 2.2), '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>') +
              '<span style="font-size:15.5px;font-weight:800;color:#0d1117">' + esc(s.dayDate ? fmtDay(s.dayDate) : 'Date TBD') + '</span>' +
              (s.dayDate && s.dayTime ? '<span style="font-size:15px;font-weight:700;color:#5c6270">· ' + esc(fmtTime(s.dayTime)) + '</span>' : '') + '</div>' +
            '<div style="display:flex;align-items:center;gap:10px">' + svg(18, stroke('#5b4ae8', 2.2), '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>') +
              '<span style="font-size:15px;font-weight:700;color:#0d1117">' + esc(s.spot || 'Location TBD') + '</span></div></div>' +
          '<div style="display:flex;align-items:center;gap:10px"><span style="display:flex">' +
            ids.slice(0, 3).map((u, i) => '<span style="display:flex;border:2px solid #fff;border-radius:999px;margin-left:' + (i ? -8 : 0) + 'px">' + face(u, nameOf(u), 30) + '</span>').join('') + '</span>' +
            '<span data-peek-going style="font-size:14.5px;font-weight:800;color:#0f7a3c">' + (n ? n + ' going' : 'Be the first') + '</span></div>' +
          (lead ? '<span style="font-size:14px;font-weight:700;color:#5b4ae8">You’re leading this.</span>'
            : s.cancelledAt ? '' : '<div style="display:flex;gap:8px">' + btn('going', 'Going') + btn('maybe', 'Maybe') + btn('no', 'Can’t') + '</div>') +
          '<span ' + on(() => { setState({ peek: null }); openSpark(s); }) + ' role="button" style="align-self:center;display:flex;align-items:center;gap:4px;min-height:44px;font-size:15px;font-weight:800;color:#5b4ae8;cursor:pointer">See the full event' + I.chevR(14, 'currentColor', 2.8) + '</span>' +
        '</div></div></div>';
  }

  function viewHandSheet() {
    const list = handList(), close = () => setState({ cHandSheet: false });
    const card = (s) => {
      const dp = dateParts(s.dayDate), rows = s.signups.filter(it => it.need && (it.claims.length < it.need || it.claims.some(c => c.userId === state.me)));
      return '<div data-hand="' + esc(s.text) + '" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
        '<div ' + on(() => openSpark(s)) + ' style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer">' +
          '<div style="flex:0 0 40px;display:flex;flex-direction:column;align-items:center"><span style="font-size:10.5px;font-weight:900;letter-spacing:.6px;color:#6b7280">' + dp.dow + '</span><span style="font-size:20px;line-height:1.1;font-weight:900;color:#0d1117">' + dp.day + '</span></div>' +
          '<span aria-hidden="true" style="flex:0 0 3px;align-self:stretch;border-radius:999px;background:#e8a71c"></span>' +
          '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;min-width:0"><span style="min-width:0;font-size:15px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(s.text) + '</span>' + demoTag(s, false, true) + '</div>' +
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
      '<div style="display:flex;align-items:center;gap:10px"><h2 style="flex:1;margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Could use a hand</h2>' + closeX(close) + '</div>' +
        '<div style="margin-top:6px;font-size:14px;font-weight:600;color:#6b7280">' + list.length + (list.length === 1 ? ' event' : ' events') + ' coming up in the next 2 weeks</div>',
      '<div style="padding:14px 14px 30px;display:flex;flex-direction:column;gap:10px">' + (list.length ? list.map(card).join('') : '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px"><span style="font-size:11.5px;font-weight:900;letter-spacing:1px;color:#8f6405">COULD USE A HAND</span>' +
        '<div style="display:flex;gap:12px;align-items:center"><span aria-hidden="true" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#e7f6ec;display:flex;align-items:center;justify-content:center">' + svg(18, stroke('#149a4b', 2.8), P6.check) + '</span>' +
          '<div><div style="font-size:16px;font-weight:800;color:#0d1117">Everything’s covered for the next two weeks.</div><div style="margin-top:2px;font-size:13.5px;font-weight:600;color:#6b7280">New asks show up here.</div></div></div></div>') + '</div>');
  }

  // Search (v6 Update 2): before typing, Try chips and "Or something unexpected"; live results as you type
  const TRY6 = [['weekend', 'This weekend', { cWhen: 'weekend' }], ['help', 'Could use a hand', { cHelp: true }]];
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
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-top:4px">' + cards.map((m, i) => '<div ' + on(m.pick) + ' data-magic="' + esc(m.title) + '" style="' + (cards.length % 2 && i === cards.length - 1 ? 'grid-column:span 2;' : '') + 'display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:16px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<span style="width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:' + m.bg + ';color:' + m.ink + '">' + svg(20, stroke('currentColor', 2), MAGIC_ICON[m.icon]) + '</span>' +
      '<div><div style="font-size:14.5px;line-height:1.2;font-weight:900;color:#0d1117">' + m.title + '</div><div style="margin-top:2px;font-size:12px;line-height:1.35;font-weight:600;color:#6b7280">' + m.sub + '</div></div></div>').join('') + '</div>';
  const tryChip = (label, fn) => '<span ' + on(fn) + ' style="display:flex;align-items:center;min-height:34px;padding:0 13px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #e6e7eb;font-size:13.5px;font-weight:800;color:#454b55;cursor:pointer">' + label + '</span>';
  const tryOn = (label, clear) => '<div style="display:flex;padding:0 2px 4px"><span ' + on(clear) + ' aria-label="Clear ' + esc(label) + '" style="display:flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;background:#0d1117;color:#fff;font-size:13px;font-weight:800;cursor:pointer">' + esc(label) + I.x(10, '#fff', 3.4) + '</span></div>';
  const searchHead = (label, value, placeholder, onType, clearFn, close) => '<div style="display:flex;align-items:center;gap:10px">' +
    '<label style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;min-height:48px;padding:0 10px 0 14px;border-radius:14px;background:#fff;box-shadow:0 1px 3px rgba(13,17,23,.08),0 0 0 1px rgba(13,17,23,.06)">' + ic6('search', 18, '#6b7280', 2.4) +
      '<input class="fld" type="search" data-csearch aria-label="' + esc(label) + '" placeholder="' + esc(placeholder) + '" value="' + esc(value) + '" ' + onInput(e => { if (e.type === 'input') onType(e.target.value.slice(0, 60)); }) + ' style="flex:1;min-width:0;border:0;outline:none;background:transparent;font-family:inherit;font-size:16px;font-weight:600;color:#0d1117">' +
      (value ? '<span ' + on(() => { clearFn(); const f = document.querySelector('[data-csearch]'); if (f) f.focus(); }) + ' aria-label="Clear search" style="flex:0 0 24px;width:24px;height:24px;border-radius:999px;background:#c3c7d0;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(10, '#fff', 4) + '</span>' : '') +
    '</label>' +
    '<span ' + on(close) + ' style="flex:0 0 auto;font-size:14.5px;font-weight:800;color:#454b55;cursor:pointer">Cancel</span></div>';
  const searchRow = (s, sub) => '<div ' + on(() => openSpark(s)) + ' data-result="' + esc(s.text) + '" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
    '<span aria-hidden="true" style="flex:0 0 40px;width:40px;height:40px;border-radius:10px;background:' + photoBg(s) + '"></span>' +
    '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;min-width:0"><span style="min-width:0;font-size:15px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(s.text) + '</span>' + demoTag(s, false, true) + '</div>' +
      '<div style="font-size:12.5px;font-weight:600;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(sub) + '</div></div>' + I.chevR(14, '#b9bcc4', 2.6) + '</div>';
  const rnd6 = (a) => a.length ? a[Math.floor(Math.random() * a.length)] : null;
  function viewSearch() {
    const st = state, q = st.cq.trim(), tr = st.cTry ? TRY6.find(x => x[0] === st.cTry) : null;
    const undo = st.cTry ? TRY_UNDO : {};
    const close = () => setState(Object.assign({ cSearch: false, cq: '' }, undo));
    const pool = calBase(), list = pool.filter(s => matchQ(s, q) && inTypes6(s) && inWhen6(s) && (!st.cHelp || signupFill(s).open > 0)).sort(byWhen);
    const results = q || tr ? list.slice(0, 30) : [];
    const pick = (fn) => () => { const x = fn(); if (!x) { toast('Nothing like that yet'); return; } setState(Object.assign({ cSearch: false, cq: '' }, undo)); openSpark(x); };
    const notMine = pool.filter(s => !isLead(s) && !myRsvp(s) && !helpsOn(s) && !s.cancelledAt);
    // Three real ones (owner, 2026-09-30): the next thing you're not in, where people are going, where help is needed
    const magic = [
      { icon: 'moon', title: 'Soonest surprise', sub: 'The next thing happening that I’m not in', bg: '#1f2433', ink: '#cfc9ff', pick: pick(() => notMine.slice().sort(byWhen)[0]) },
      { icon: 'people', title: 'Tag along', sub: 'Where the most people are going', bg: '#fdf1d6', ink: '#8f6405', pick: pick(() => notMine.slice().sort((a, b) => going(b).length - going(a).length)[0]) },
      { icon: 'compass', title: 'Could use a hand', sub: 'The soonest event still looking for helpers', bg: '#e7f6ec', ink: '#149a4b', pick: pick(() => notMine.filter(s => signupFill(s).open > 0).sort(byWhen)[0]) }
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
      '<input class="fld" type="text" maxlength="60" aria-label="Add a note, if you want" placeholder="Add a note, if you want" value="' + esc(p.note) + '" ' + onInput(e => { if (e.type === 'input') state.shiftPick = Object.assign({}, state.shiftPick, { note: e.target.value.slice(0, 60) }); }) + ' style="width:100%;min-height:48px;border:1.5px solid #dcdfe6;border-radius:14px;padding:10px 14px;font-family:inherit;font-size:16px;font-weight:600;color:#0d1117;background:#fff;outline:none">' +
      '<button type="button" class="hov-primary" ' + on(() => { if (!state.busy) saveShifts(s, job); }) + ' style="min-height:52px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer">Done</button>', 36);
  }

  // "You're on it" (after any new sign-up, with Undo) and "You're off it" (after taking yourself off)
  function viewBanner() {
    const b = state.banner, s = state.sparks.find(x => x.id === b.id);
    if (!s) return '';
    const host = nameOf(s.leadId, s.leadName), hostFirst = firstName(host), wrap = (style, inner) =>
      '<div role="status" data-banner="' + b.kind + '" style="position:absolute;left:14px;right:14px;bottom:calc(var(--nav-h) + 12px);z-index:40;border-radius:18px;padding:14px;animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both;' + style + '">' + inner + '</div>';
    if (b.kind === 'going') return wrap('background:#0d1117;box-shadow:0 12px 30px rgba(15,18,25,.3);display:flex;align-items:center;gap:12px',
      '<span style="flex:0 0 18px;width:18px;height:18px;border-radius:999px;background:#149a4b;display:flex;align-items:center;justify-content:center">' + I.check(10, '#fff', 4) + '</span>' +
      '<span style="flex:1;min-width:0;font-size:14.5px;line-height:1.35;font-weight:700;color:#fff">You’re going. See you there!</span>' +
      '<button type="button" ' + on(() => { clearTimeout(bannerTimer); setState({ banner: null }); addToCalendar(s); }) + ' style="flex:0 0 auto;min-height:36px;padding:0 14px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer;white-space:nowrap">Add to calendar</button>');
    if (b.kind === 'on') return wrap('background:#0f7a3c;box-shadow:0 10px 28px rgba(15,122,60,.35);display:flex;align-items:center;gap:12px',
      '<span style="flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center">' + I.check(22, '#149a4b', 3.4) + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:900;color:#fff">You’re on it</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;font-size:12.5px;font-weight:800;color:rgba(255,255,255,.9)">' +
          (isLead(s) ? 'Added to your jobs' : face(s.leadId, host, 18) + '<span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(hostFirst) + ' is counting on you</span>') + '</div></div>' +
      '<button type="button" ' + on(() => { if (!state.busy) undoClaim(b); }) + ' style="flex:0 0 auto;min-height:36px;padding:0 14px;border:0;border-radius:999px;background:rgba(255,255,255,.18);color:#fff;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer">Undo</button>');
    const msg = 'Hey! I can’t make it to ' + b.job.toLowerCase() + ' for ' + s.text + ' anymore. Any chance you could take my spot?';
    return wrap('background:#fff6dc;box-shadow:0 10px 28px rgba(15,18,25,.18), inset 0 0 0 1.5px #f3d98b;display:flex;flex-direction:column;gap:12px',
      '<div style="display:flex;align-items:flex-start;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:900;color:#0d1117">You’re off it</div>' +
        '<p style="margin:4px 0 0;font-size:14px;line-height:1.4;font-weight:600;color:#5c4a12">' + (isDemo(s) ? 'A quick check-in with ' + esc(hostFirst) + ' helps, or find someone to take your spot.' : 'We’ll let ' + esc(hostFirst) + ' know. A quick check-in with them helps too, or find someone to take your spot.') + '</p></div>' +
        (b.back ? '<span ' + on(() => { if (!state.busy) redoClaim(b); }) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;background:rgba(13,17,23,.06);font-size:13.5px;font-weight:800;color:#0d1117;cursor:pointer">Undo</span>' : '') +
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
    note: { bg: '#e2556b', glyph: '!', cat: 'updates', topic: 'updates' },   // an event or job was taken down
    friendreq: { bg: '#5b4ae8', glyph: '+', cat: 'invites', topic: 'friends' },   // v6 Update 13
    invited: { bg: '#5b4ae8', glyph: '✉', cat: 'invites', topic: 'friends' },
    leadask: { bg: '#7b6ef0', glyph: '★', cat: 'invites', topic: 'friends' },   // someone asked you to lead an idea
    jobask: { bg: '#e8a71c', glyph: '✋', cat: 'invites', topic: 'friends' },   // someone asked you to take a job
    leadoffer: { bg: '#7b6ef0', glyph: '★', cat: 'invites', topic: 'friends' }   // the lead asked you to take over
  };
  const N_TOPICS = [
    ['newevents', 'New in your groups', 'New plans and ideas'],
    ['updates', 'Updates from leads', 'Changes on events you’re in'],
    ['reminders', 'Reminders', 'The day before and the morning of anything you’re going to or helping with'],
    ['hosting', 'Things you’re leading', 'RSVPs, interest, sign-ups and suggestions'],
    ['friends', 'Friends', 'Friend requests, friends inviting you to events, and someone asking you to lead']
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
      if (ph === 'plan' && s.autoRemind && !s.cancelledAt && (my === 'going' || my === 'maybe') && !lead) {
        const d = dayDiff(s.dayDate);
        // 8am on the day before (or the day). Before then it isn't due: stamping it "now" made it new on every redraw, so Mark all read never stuck
        const due = midnight(s.dayDate) - (d === 1 ? DAY_MS : 0) + 8 * 3600000;
        if ((d === 0 || d === 1) && due <= Date.now()) add({ key: 'r:' + s.id + ':' + s.dayDate, type: 'reminder', s, t: due,
          uid: s.leadId, who: d === 1 ? 'Tomorrow:' : 'Today:', text: '', after: (s.dayTime ? ' at ' + fmtTime(s.dayTime) : '') + (s.spot ? ' · ' + s.spot : '') });
      }
      // A new plan or idea in one of your groups (owner, 2026-09-30: ideas too); "New: {event}", the host under it
      // (not an idea that's looking for a lead: a floated idea is quieter than one someone leads, owner 2026-10-02)
      if (!lead && s.created && (ph === 'plan' || ph === 'idea') && !s.wantsHost)
        add({ key: 'e:' + s.id, type: 'newevent', s, t: s.created, uid: s.leadId, who: nameOf(s.leadId, s.leadName), idea: ph === 'idea',
          sub: firstName(nameOf(s.leadId, s.leadName)) + (ph === 'idea' ? ' is floating it' : ' is leading' + (s.dayDate ? ' · ' + dayLabel(s.dayDate, s.dayTime) : '')), rsvp: ph === 'plan' && !my });
      // Someone asked you to lead it, while it's still looking (20261102020000_float_and_ask.sql)
      if (s.wantsHost && !s.cancelledAt) s.leadAsks.filter(a => a.userId === me).forEach(a =>
        add({ key: 'la:' + s.id + ':' + a.at, type: 'leadask', s, t: a.at, uid: a.by, who: nameOf(a.by, 'Someone'), text: 'asked if you’d lead', quote: a.message || '' }));
      // Asked to take a job, or to take over leading it (20261102070000_job_asks_and_handoff.sql)
      if (!s.cancelledAt && phaseOf(s) !== 'done') {
        s.jobAsks.filter(a => a.userId === me && !a.answer).forEach(a => { const it = s.signups.find(x => x.id === a.itemId);
          if (it) add({ key: 'ja:' + a.itemId + ':' + a.at, type: 'jobask', s, t: a.at, uid: a.by, who: nameOf(a.by, 'Someone'), text: 'asked if you’d take', item: it.item, joiner: ' for ', quote: a.message }); });
        if (s.leadOffer && s.leadOffer.userId === me) add({ key: 'lo:' + s.id + ':' + s.leadOffer.at, type: 'leadoffer', s, t: s.leadOffer.at, uid: s.leadOffer.by, who: nameOf(s.leadOffer.by, 'Someone'), text: 'asked if you’d take over leading', quote: s.leadOffer.message });
      }
      if (!lead) return;
      // Things you're hosting
      // A job sign-up marks you Going: the sign-up's row covers it, so that automatic Going isn't its own row
      const claimAt = {};
      s.signups.forEach(it => it.claims.forEach(c => { if (c.created) claimAt[c.userId] = Math.max(claimAt[c.userId] || 0, c.created); }));
      s.rsvps.filter(r => r.userId !== me && !(r.status === 'going' && claimAt[r.userId] && Math.abs(r.created - claimAt[r.userId]) < 120000)).forEach(r => add({ key: 'rv:' + s.id + ':' + r.userId, type: 'rsvp', s, t: r.created, uid: r.userId, who: personName(s, r.userId),
        text: r.status === 'going' ? 'is going to' : r.status === 'maybe' ? 'might come to' : 'can’t make it to' }));
      s.signups.forEach(it => it.claims.filter(c => c.userId !== me && c.created).forEach(c => add({ key: 's:' + it.id + ':' + c.userId, type: 'signup', s, t: c.created, uid: c.userId, who: personName(s, c.userId), text: 'signed up to bring', item: it.item })));
      if (ph === 'idea') {
        s.interested.filter(u => u !== me && s.interestAt[u]).forEach(u => add({ key: 'i:' + s.id + ':' + u, type: 'interest', s, t: s.interestAt[u], uid: u, who: personName(s, u), text: 'is interested in' }));
        s.dateOpts.filter(o => o.createdBy !== me && o.created).forEach(o => add({ key: 'd:' + o.id, type: 'vote', s, t: o.created, uid: o.createdBy, who: o.who, text: 'suggested', item: fmtDay(o.dayDate) + (o.dayTime ? ' ' + fmtTime(o.dayTime) : ''), joiner: ' for ' }));
        s.spotOpts.filter(o => o.createdBy !== me && o.created).forEach(o => add({ key: 'p:' + o.id, type: 'vote', s, t: o.created, uid: o.createdBy, who: o.who, text: 'suggested', item: o.name, joiner: ' for ' }));
      }
    });
    (state.notes || []).forEach(x => add({ key: 'n:' + x.id, type: 'note', s: null, t: x.created, uid: x.createdBy, who: nameOf(x.createdBy, 'The lead'), body: x.body }));
    // v6 Update 13: friend requests (bell only, no push) and friends' invites (bell and push)
    state.fr.incoming.forEach(f => add({ key: 'fr:' + f.id + ':' + f.at, type: 'friendreq', s: null, t: f.at, uid: f.id, who: f.name, text: 'wants to be friends', sub: f.group ? 'You’re both in ' + f.group : '' }));
    state.fr.invites.forEach(i => {
      const s = state.sparks.find(x => x.id === i.spark);
      if (s && phaseOf(s) !== 'done') add({ key: 'fi:' + i.spark + ':' + i.by, type: 'invited', s, t: i.at, uid: i.by, who: nameOf(i.by), text: 'invited you to', sub: s.dayDate ? dayLabel(s.dayDate, s.dayTime) : '', rsvp: s.planned && !s.cancelledAt, quote: i.note || '' });
    });
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
      .then(r => { if (r.error) throw r.error; }).catch(e => { console.error(e); toast(failed(e)); });
  };
  const markRead = (n) => { if (isUnread(n)) saveNotif({ read: state.notif.read.concat([n.key]) }); };
  // Everything shown counts, even an item stamped a little ahead of this device's clock
  const markAllRead = () => saveNotif({ allReadAt: Math.max(Date.now(), ...notifList().map(n => n.t)), read: [] });
  const openNotif = (n) => { markRead(n); if (n.s) openSpark(n.s); else if (n.type === 'friendreq') go('groups', { pplTab: 'friends', pplSearch: false, pplQ: '' }); };
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
      toast('Notifications are on for this ' + DEVICE, true);
    } catch (e) { console.error(e); toast(failed(e)); }
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
      toast('Notifications are off for this ' + DEVICE, true);
    } catch (e) { console.error(e); toast(failed(e)); }
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
            : 'We’ll buzz you when an event changes, something new goes up, and the day before and morning of anything you’re going to.') + '</div></div>' +
        '<span ' + on(hide) + ' aria-label="Not now" style="flex:0 0 28px;width:28px;height:28px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(11, '#6b7280', 2.6) + '</span></div>' +
      (ps === 'off' ? '<button type="button" class="hov-primary" ' + on(turnOnPush) + ' style="align-self:flex-start;margin-left:48px;min-height:42px;padding:0 18px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Turn on notifications</button>' : '') +
    '</div>';
  };

  // ---- What feedback carries along (owner, 2026-10-02; 20261102030000_feedback_context.sql): the device and browser,
  // installed app or browser tab, screen size, app version, where they were, their last few taps and recent errors.
  // Taps are the label of what was tapped (never anything typed); all of it stays in this tab until feedback is sent
  const fbTaps = [], fbErrs = [];
  const noteTap6 = (el) => {
    const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
    if (!label) return;
    fbTaps.push({ at: Date.now(), screen: state.screen, tap: label });
    if (fbTaps.length > 12) fbTaps.shift();
  };
  function noteError(e) {
    if (!e) return;
    fbErrs.push({ at: Date.now(), screen: state.screen, error: String(e.code || e.status || '') + ' ' + String(e.message || e).slice(0, 160) });
    if (fbErrs.length > 8) fbErrs.shift();
  }
  window.addEventListener('error', (ev) => noteError({ message: (ev.message || 'error') + ' @' + String(ev.filename || '').split('/').pop() + ':' + (ev.lineno || '') }));
  window.addEventListener('unhandledrejection', (ev) => noteError(ev.reason || { message: 'unhandled rejection' }));
  const appVersion = () => { const sc = document.querySelector('script[src*="sparks.js"]'); const m = sc && /[?&]v=(\d+)/.exec(sc.src); return m ? 'v' + m[1] : ''; };
  // "iPhone · iOS 26 · Safari" from the browser's own description
  const deviceName = (ua) => {
    ua = ua || '';
    const ios = /(iPhone|iPad|iPod)[^)]*OS (\d+)/.exec(ua), and = /Android (\d+)/.exec(ua);
    const dev = ios ? ios[1] + ' · iOS ' + ios[2] : /Macintosh/.test(ua) ? 'Mac' : and ? 'Android ' + and[1] : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'Unknown device';
    const br = /EdgA?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
    return dev + (br ? ' · ' + br : '');
  };
  const SCREEN_NAMES = { calendar: 'Explore', home: 'Your tasks', sched: 'Your calendar', groups: 'Groups', groupPage: 'Group page', detail: 'Event page', compose: 'Create event', own: 'Your plans & ideas', how: 'How this works' };
  const fbWhere = () => { const s = state.screen === 'detail' ? subject() : null; return s ? (s.planned ? 'Plan page' : 'Idea page') : SCREEN_NAMES[state.screen] || state.screen || ''; };
  const fbContext = () => {
    const s = state.screen === 'detail' ? subject() : null, g = s ? groupById(s.groupId) : state.screen === 'groupPage' ? currentGroup() : null;
    let used = 0;
    try { used = Math.round(((JSON.parse(localStorage.getItem('spark-hub-fb-nudge-' + state.me) || '{}') || {}).used || 0) / 60000); } catch (e) { /* blocked */ }
    return {
      version: appVersion(), device: deviceName(navigator.userAgent), ua: navigator.userAgent.slice(0, 300),
      app: STANDALONE ? 'Home Screen app' : 'browser tab',
      size: innerWidth + '×' + innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x',
      dark: !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches),
      lang: navigator.language || '', tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
      online: navigator.onLine !== false, push: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
      where: fbWhere(), event: s ? { id: s.id, title: s.text } : null, group: g ? g.name : null,
      minutes: used, fromNudge: !!(state.fb && state.fb.nudge) || !!state.fbNudge,
      taps: fbTaps.slice(-12).map(t => ({ ago: Math.round((Date.now() - t.at) / 1000) + 's', screen: t.screen, tap: t.tap })),
      errors: fbErrs.slice(-8).map(x => ({ ago: Math.round((Date.now() - x.at) / 1000) + 's', screen: x.screen, error: x.error }))
    };
  };
  const SHOT_BUCKET = 'feedback-shots';
  const pickFbShot = async (file) => {
    if (!file) return;
    try {
      const blob = await shrinkImage(file, 1600);
      if (state.fb && state.fb.shot) URL.revokeObjectURL(state.fb.shot.url);
      setState({ fb: Object.assign({}, state.fb, { shot: { blob, url: URL.createObjectURL(blob) } }) });
    } catch (e) { toast(BAD_PHOTO); }
  };

  // ---- Give feedback (v6 Update 9, 50 · 51): a bottom sheet to Eric; the note goes to the feedback table
  // (only the owner reads it) and buzzes the owner's phone
  const ERIC_FACE = '/photos/faces/eric.jpg';
  const FB_QS = ['What’s your overall sense of it?', 'How useful does it feel?', 'What would make you excited to use it?', 'Any issues I should be considering?'];
  const sendFeedback = async () => {
    const f = state.fb;
    if (!f || f.sent || !f.text.trim() || state.busy) return;
    if (state.viewAs) { toast('You’re viewing as ' + firstName(state.viewAs.name) + ', so nothing is sent. Exit to send.'); return; }
    setState({ busy: 'feedback' });
    let shot = null;
    try {
      await ensureSession();
      if (f.shot) {
        shot = state.me + '/' + uuid() + '.jpg';
        must(await sb.storage.from(SHOT_BUCKET).upload(shot, f.shot.blob, { contentType: 'image/jpeg', upsert: false }));
      }
      const row = { body: f.text.trim().slice(0, 1000), screen: String(state.screen || '').slice(0, 60), context: fbContext() };
      if (shot) row.shot = shot;
      must(await sb.from('feedback').insert(row));
      if (f.shot) URL.revokeObjectURL(f.shot.url);
      setState({ busy: null, fb: { text: '', sent: true } });
      if (state.demoAdmin) loadFeedback();
    } catch (e) {   // what they typed (and the screenshot) stays
      console.error(e);
      if (shot) sb.storage.from(SHOT_BUCKET).remove([shot]).catch(() => {});
      setState({ busy: null }); toast(failed(e));
    }
  };
  const ericFace = (size, extra) => '<span aria-hidden="true" style="flex:0 0 ' + size + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:#dcdfe6 url(' + ERIC_FACE + ') center/cover;' + (extra || '') + '"></span>';
  function viewFeedback() {
    const f = state.fb, close = () => setState({ fb: null }), ok = f.text.trim().length > 0 && !state.busy;
    const inner = f.sent
      ? '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 4px 4px;text-align:center">' +
          '<span style="position:relative;display:flex">' + ericFace(64) + '<span style="position:absolute;right:-4px;bottom:-4px;width:26px;height:26px;border-radius:999px;background:#149a4b;box-shadow:0 0 0 3px #fff;display:flex;align-items:center;justify-content:center">' + I.check(14, '#fff', 3) + '</span></span>' +
          '<h3 style="margin:6px 0 0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Thank you!</h3>' +
          '<p style="margin:0;font-size:15px;line-height:1.45;font-weight:500;color:#5c6270;text-wrap:pretty">Got it. This really helps me figure out what to build next.</p>' +
          '<button type="button" ' + on(close) + ' style="margin-top:8px;width:100%;min-height:52px;border:0;border-radius:999px;background:#0d1117;color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer">Done</button></div>'
      : '<div style="display:flex;align-items:flex-start;gap:12px">' + ericFace(48) +
          '<h3 style="flex:1;min-width:0;margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117;text-wrap:balance">Tell Eric what you think about the app so far</h3>' +
          '<span ' + on(close) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:32px;font-size:15px;font-weight:700;color:#6b7280;cursor:pointer">Cancel</span></div>' +
        '<ul style="margin:0;padding:0 0 0 20px;display:flex;flex-direction:column;gap:6px;font-size:15.5px;line-height:1.4;font-weight:600;color:#2a2f38">' + FB_QS.map(q => '<li>' + q + '</li>').join('') + '</ul>' +
        '<textarea rows="5" maxlength="1000" aria-label="Your feedback" placeholder="Write as much or as little as you like." ' + onInput(e => { if (e.type === 'input') setState({ fb: Object.assign({}, state.fb, { text: e.target.value.slice(0, 1000) }) }); }) +
          ' style="width:100%;box-sizing:border-box;min-height:140px;padding:14px;border:2px solid #dcdfe6;border-radius:16px;font-family:inherit;font-size:16px;font-weight:500;line-height:1.4;color:#0d1117;resize:none;outline:none">' + esc(f.text) + '</textarea>' +
        // A screenshot they took with the phone's buttons (a web page can't take one itself)
        (f.shot
          ? '<div data-fb-shot style="display:flex;align-items:center;gap:12px;padding:8px 10px 8px 8px;border-radius:16px;background:#f4f5f7">' +
              '<span ' + on(() => setState({ zoom: { photos: [f.shot.url], i: 0 } })) + ' aria-label="See the screenshot" style="flex:0 0 44px;width:44px;height:64px;border-radius:8px;background:#dcdfe6 url(' + f.shot.url + ') center/cover;cursor:zoom-in"></span>' +
              '<span style="flex:1;min-width:0;font-size:14.5px;font-weight:800;color:#0d1117">Screenshot added</span>' +
              '<span ' + on(() => { URL.revokeObjectURL(f.shot.url); setState({ fb: Object.assign({}, state.fb, { shot: null }) }); }) + ' aria-label="Remove the screenshot" style="flex:0 0 32px;width:32px;height:32px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(12, '#6b7280', 2.8) + '</span></div>'
          : '<label data-fb-add-shot style="display:flex;align-items:center;gap:10px;min-height:48px;padding:0 14px;border-radius:14px;border:1.5px dashed #c9ccd3;color:#454b55;font-size:14.5px;font-weight:800;cursor:pointer">' +
              svg(17, stroke('currentColor', 2.2), CAMERA) + 'Add a screenshot<span style="font-weight:600;color:#8a909b">(optional)</span>' +
              '<input type="file" accept="image/*" aria-label="Add a screenshot" ' + onInput(e => { if (e.type !== 'change') return; const fl = (e.target.files || [])[0]; e.target.value = ''; pickFbShot(fl); }) + ' style="display:none"></label>') +
        // Said plainly: what comes along with it
        '<p data-fb-sent-with style="margin:0;font-size:12.5px;line-height:1.45;font-weight:600;color:#8a909b;text-wrap:pretty">Sent with: ' + esc(deviceName(navigator.userAgent) + ' · ' + (STANDALONE ? 'Home Screen app' : 'browser') + ' · ' + fbWhere()) + '. Your last few taps and any errors come along too, to help track down glitches.</p>' +
        '<button type="button" ' + on(sendFeedback) + ' aria-disabled="' + !ok + '" style="width:100%;min-height:52px;border:0;border-radius:999px;background:' + (ok ? '#5b4ae8' : '#dcdfe6') + ';color:' + (ok ? '#fff' : '#8a909b') + ';font-family:inherit;font-size:16px;font-weight:800;cursor:' + (ok ? 'pointer' : 'default') + '">' + (state.busy === 'feedback' ? 'Sending…' : 'Send to Eric') + '</button>';
    return '<div class="v6-scrim" data-scrim="' + reg(close) + '" style="z-index:50">' +
      '<div role="dialog" aria-modal="true" aria-label="Give feedback" data-screen-label="Give feedback" style="position:absolute;left:0;right:0;bottom:0;max-height:calc(100% - 24px - var(--sat));overflow:auto;background:#fff;border-radius:24px 24px 0 0;padding:8px 18px calc(22px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:16px;animation:sheetUp 320ms cubic-bezier(.2,.8,.2,1) both">' +
        '<div aria-hidden="true" style="width:40px;height:5px;border-radius:999px;background:#dcdfe6;margin:0 auto"></div>' + inner + '</div></div>';
  }

  // ---- Asking for feedback (owner, 2026-10-02): after about 10 minutes of using the app (counted only while it's on
  // screen, across visits, per account), a playful card once, with an arrow bouncing at the Profile tab where Give
  // feedback lives. Give feedback opens the sheet; Show me opens Profile with the tile marked RIGHT HERE
  const FB_NUDGE_MS = 10 * 60 * 1000, FB_NUDGE_KEY = 'spark-hub-fb-nudge-';
  let fbTickAt = Date.now();
  const fbNudgeRead = () => { try { return JSON.parse(localStorage.getItem(FB_NUDGE_KEY + state.me) || '{}') || {}; } catch (e) { return {}; } };
  const fbNudgeWrite = (o) => { try { localStorage.setItem(FB_NUDGE_KEY + state.me, JSON.stringify(o)); } catch (e) { /* blocked: it may ask again */ } };
  // Only over a main screen with nothing else open, so it never lands on someone mid-task
  const fbNudgeFits = () => ['calendar', 'home', 'sched', 'groups'].indexOf(state.screen) > -1 && state.loaded && !state.profSheet && !state.notifSheet &&
    !state.fb && !state.confirm && !state.share && !state.loginStep && !state.inv && !state.toast && !state.banner && !state.cSearch && !state.dashAll && !state.cHandSheet && !state.zoom && !state.installPop;
  function fbNudgeTick() {
    const now = Date.now(), gap = Math.min(now - fbTickAt, 60000);   // a sleeping phone doesn't count
    fbTickAt = now;
    if (!state.me || !state.email || state.viewAs || document.hidden || state.fbNudge) return;
    const o = fbNudgeRead();
    if (o.done) return;
    o.used = (o.used || 0) + gap;
    if (o.used >= FB_NUDGE_MS && fbNudgeFits()) { o.done = Date.now(); setState({ fbNudge: true }); }
    fbNudgeWrite(o);
  }
  // v7 Update 15 (1c): a sheet above the tab bar with a text box, Send to Eric and Not now; then one dark tip at Profile
  const fbTipLater = () => setTimeout(() => { if (state.fbTip) setState({ fbTip: null }); }, 5000);
  const fbAskLater = () => { setState({ fbNudge: null, fbAsk: '', fbTip: 'No problem.' }); fbTipLater(); };
  const fbAskSend = async () => {
    const text = (state.fbAsk || '').trim();
    if (!text || state.busy) return;
    if (state.viewAs) { toast('You’re viewing as ' + firstName(state.viewAs.name) + ', so nothing is sent. Exit to send.'); return; }
    setState({ busy: 'feedback' });
    try {
      await ensureSession();
      must(await sb.from('feedback').insert({ body: text.slice(0, 1000), screen: String(state.screen || '').slice(0, 60), context: fbContext() }));
      setState({ busy: null, fbNudge: null, fbAsk: '', fbTip: 'Thanks, Eric got it.' });
      fbTipLater();
      if (state.demoAdmin) loadFeedback();
    } catch (e) { console.error(e); setState({ busy: null }); toast(failed(e)); }   // what they typed stays
  };
  function viewFbNudge() {
    const ok = !!(state.fbAsk || '').trim() && !state.busy;
    return '<div class="fb-nudge-scrim" data-scrim="' + reg(fbAskLater) + '">' +
      '<div role="dialog" aria-modal="false" aria-label="Help Eric improve the app" data-fb-nudge data-screen-label="Feedback ask" class="fb-nudge">' +
        '<span aria-hidden="true" style="align-self:center;width:40px;height:5px;border-radius:999px;background:#dcdfe6"></span>' +
        '<div style="display:flex;align-items:center;gap:12px">' + ericFace(36) +
          '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font-size:12px;font-weight:900;letter-spacing:1.1px;text-transform:uppercase;color:#5b4ae8">Feedback needed</span>' +
            '<span style="font-size:19px;line-height:1.2;font-weight:900;letter-spacing:-.4px;color:#0d1117">Help Eric improve the app</span></div></div>' +
        '<textarea rows="3" maxlength="1000" aria-label="Your feedback" placeholder="What’s something we should fix or add? Any feedback helps, even “the calendar is confusing.”" ' + onInput(e => { if (e.type === 'input') setState({ fbAsk: e.target.value.slice(0, 1000) }); }) +
          ' style="min-height:96px;box-sizing:border-box;resize:none;border:0;border-radius:16px;box-shadow:inset 0 0 0 2px #dcdfe6;padding:12px 14px;font-family:inherit;font-size:15.5px;line-height:1.4;font-weight:500;color:#0d1117;outline:none">' + esc(state.fbAsk || '') + '</textarea>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<button type="button" ' + on(fbAskSend) + ' aria-disabled="' + !ok + '" style="flex:1 1 auto;min-height:50px;border:0;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;' + (ok ? 'background:#5b4ae8;color:#fff;cursor:pointer' : 'background:#dcdfe6;color:#8a909b;cursor:default') + '">' + (state.busy === 'feedback' ? 'Sending…' : 'Send to Eric') + '</button>' +
          '<button type="button" ' + on(fbAskLater) + ' style="flex:0 0 auto;min-height:50px;padding:0 18px;border:0;border-radius:999px;background:transparent;font-family:inherit;font-size:15.5px;font-weight:800;color:#6b7280;cursor:pointer">Not now</button></div>' +
      '</div></div>';
  }
  // The tip points at the Profile tab (the fifth of five); a tap or 5 seconds closes it
  const viewFbTip = () => '<div ' + on(() => setState({ fbTip: null })) + ' role="status" data-fb-tip class="fb-tip">' +
    '<span style="font-size:14.5px;font-weight:800">' + esc(state.fbTip) + '</span>' +
    '<span style="font-size:13.5px;line-height:1.4;font-weight:600;color:rgba(255,255,255,.8)">Add more anytime in your profile.</span>' +
    '<span aria-hidden="true" style="position:absolute;right:30px;bottom:-7px;width:14px;height:14px;background:#0d1117;transform:rotate(45deg);border-radius:2px"></span></div>';

  // ---- Feedback inbox (v6 Update 9, 49 · 52): only the owner (demo_admins) can read the feedback table.
  // "Unread" is newer than when the owner last closed the inbox on this device (no database field for it)
  const FB_SEEN_KEY = 'spark-hub-feedback-seen';
  const fbSeenAt = () => { try { return Number(localStorage.getItem(FB_SEEN_KEY)) || 0; } catch (e) { return 0; } };
  // With what it was sent with (20261102030000_feedback_context.sql; a database without those columns still loads) and
  // signed links, good for an hour, to the screenshots in their private bucket
  const loadFeedback = () => sb.from('feedback').select('id, user_id, name, body, created_at, screen, context, shot').order('created_at', { ascending: false }).limit(200)
    .then(r => r.error && r.error.code === '42703' ? sb.from('feedback').select('id, user_id, name, body, created_at').order('created_at', { ascending: false }).limit(200) : r)
    .then(async r => {
      if (r.error) return;
      const shots = r.data.map(x => x.shot).filter(Boolean), urls = {};
      if (shots.length) {
        const sg = await sb.storage.from(SHOT_BUCKET).createSignedUrls(shots, 3600).catch(() => ({ data: null }));
        (sg.data || []).forEach(u => { if (u.path && typeof u.signedUrl === 'string' && u.signedUrl.indexOf(CFG.supabaseUrl + '/storage/v1/object/sign/' + SHOT_BUCKET + '/') === 0) urls[u.path] = u.signedUrl; });   // only our own storage's links get drawn
      }
      setState({ fbInbox: r.data.map(x => ({ id: x.id, uid: x.user_id, name: x.name || 'Someone', text: x.body, at: Date.parse(x.created_at),
        ctx: x.context && typeof x.context === 'object' ? x.context : null, screen: x.screen || '', shot: x.shot ? urls[x.shot] || null : null, hasShot: !!x.shot })) });
    }, () => {});
  const fbUnread = () => (state.fbInbox || []).filter(x => x.at > fbSeenAt()).length;

  // ---- New accounts (owner only, beside the Feedback inbox): everyone with a confirmed, non-anonymous email,
  // newest first, from new_accounts() (20261022000000_accounts_list.sql; no rows for anyone else). Loaded tolerantly:
  // without the function the card stays hidden. "New" works like the inbox: joined since the sheet was last closed here.
  const ACCT_SEEN_KEY = 'spark-hub-accounts-seen';
  const acctSeenAt = () => { try { return Number(localStorage.getItem(ACCT_SEEN_KEY)) || 0; } catch (e) { return 0; } };
  const loadAccounts = () => sb.rpc('new_accounts')
    .then(r => { setState({ accts: r.error ? null : (r.data || []).map(x => ({ id: x.user_id, name: x.name || 'Someone', email: x.email || '', avatar: x.avatar_path,
      at: Date.parse(x.joined_at), google: x.method === 'google', groups: Array.isArray(x.groups) ? x.groups : [] })) }); }, () => {});
  const acctUnread = () => (state.accts || []).filter(x => x.at > acctSeenAt()).length;
  // Remove an account entirely (owner, 2026-09-30): remove_account() refuses admins; you take over any group they were the only owner of
  const askRemoveAccount = (x) => setState({ confirm: { z: 60, title: 'Remove ' + x.name + '?', danger: true, cta: 'Remove account', keep: 'Keep it',
    body: 'Deletes ' + (x.email || 'this account') + ' and everything tied to it: group memberships, RSVPs, sign-ups, photos they added, and any events they lead (quietly). If they’re a group’s only owner, you become its owner. They can sign up again later as someone new. This can’t be undone.',
    run: async () => {
      if (state.busy) return;
      setState({ busy: 'save' });
      try {
        const taken = must(await sb.rpc('remove_account', { p_user: x.id })).data;
        setState({ busy: null, confirm: null, accts: (state.accts || []).filter(a => a.id !== x.id) });
        toast(x.name + '’s account was removed' + (taken ? '. You’re now the owner of ' + taken + '.' : ''), true);
        loadFresh().catch(() => {});
      } catch (e) {
        console.error(e);
        setState({ busy: null });
        toast(failed(e));
      }
    } } });
  function viewAccounts() {
    const list = state.accts || [], seen = acctSeenAt();
    const close = () => { try { localStorage.setItem(ACCT_SEEN_KEY, String(Date.now())); } catch (e) { /* blocked */ } setState({ acctOpen: false }); };
    const face = (x) => avatarSpan(x.id, x.name, PHOTO_PATH.test(x.avatar || '') ? photoUrl(x.avatar) : null, 40);
    const joined = (t) => { const a = ago(t); return 'Joined ' + (a === 'Just now' || a === 'Yesterday' ? a.toLowerCase() : a); };
    const groupsLine = (x) => { const real = x.groups.filter(g => !g.demo).map(g => g.name), d = x.groups.length - real.length;
      return (real.length ? real.join(', ') : 'No groups yet') + (d ? ' · ' + d + (d === 1 ? ' demo group' : ' demo groups') : ''); };
    const row = (x) => '<div data-account style="background:#fff;border-radius:18px;padding:14px;display:flex;gap:12px;box-shadow:0 1px 3px rgba(15,18,25,.08)">' + face(x) +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">' +
        '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0;font-size:15.5px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(x.name) + '</div>' +
          (x.at > seen ? '<span style="flex:0 0 auto;height:22px;padding:0 8px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:11px;font-weight:900;letter-spacing:.6px;display:flex;align-items:center">NEW</span>' : '') + '</div>' +
        '<div style="font-size:13.5px;font-weight:600;color:#454b55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(x.email) + '</div>' +
        '<div style="font-size:12.5px;font-weight:600;color:#8a909b">' + esc(joined(x.at)) + ' · ' + (x.google ? 'Google' : 'Email') + '</div>' +
        '<div style="font-size:12.5px;line-height:1.4;font-weight:600;color:#6b7280;overflow-wrap:break-word">' + esc(groupsLine(x)) + '</div>' +
        (x.id === state.me ? '' : '<span ' + on(() => askRemoveAccount(x)) + ' aria-label="Remove ' + esc(x.name) + '’s account" style="align-self:flex-start;margin-top:4px;font-size:13px;font-weight:800;color:#9b1c31;cursor:pointer">Remove account</span>') +
      '</div></div>';
    return sheet6('New accounts', close,
      '<div style="display:flex;align-items:flex-end;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:900;letter-spacing:1px;color:#8f6405">SUPER ADMIN</div>' +
        '<h2 style="margin:2px 0 0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">New accounts</h2>' +
        '<div style="margin-top:4px;font-size:13px;font-weight:600;color:#6b7280">' + list.length + (list.length === 1 ? ' account' : ' accounts') + ', newest first</div></div>' + closeX(close) + '</div>',
      '<div style="padding:14px 14px 30px;display:flex;flex-direction:column;gap:10px">' + (list.length ? list.map(row).join('')
        : '<div style="background:#fff;border-radius:18px;padding:26px 16px;text-align:center;font-size:15px;font-weight:700;color:#6b7280">No accounts yet.</div>') + '</div>');
  }
  // What a piece of feedback was sent with: one summary line, and the taps and errors behind a Details toggle
  const fbCtxBox = (x) => {
    const c = x.ctx;
    if (!c) return x.screen ? '<div style="font-size:12.5px;font-weight:600;color:#8a909b">On ' + esc(SCREEN_NAMES[x.screen] || x.screen) + '</div>' : '';
    const open = (state.fbCtxOpen || {})[x.id];
    const line = (t) => '<div style="font-size:12.5px;line-height:1.4;font-weight:600;color:#6b7280;overflow-wrap:anywhere">' + t + '</div>';
    const where = [c.where, c.event && c.event.title ? '“' + c.event.title + '”' : '', c.group].filter(Boolean).join(' · ');
    const list = (rows, key) => rows.length ? rows.map(r => '<div style="display:flex;gap:8px;font-size:12.5px;line-height:1.35;font-weight:600;color:#454b55"><span style="flex:0 0 46px;color:#9aa0ac">' + esc(r.ago) + ' ago</span><span style="flex:1;min-width:0;overflow-wrap:anywhere">' + esc((SCREEN_NAMES[r.screen] || r.screen || '') + ' · ' + r[key]) + '</span></div>').join('')
      : '<div style="font-size:12.5px;font-weight:600;color:#9aa0ac">None</div>';
    return '<div data-fb-context style="display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:12px;background:#f4f5f7">' +
      line('<b style="font-weight:800;color:#2a2f38">' + esc(c.device || '') + '</b> · ' + esc(c.app || '') + ' · ' + esc(c.size || '') + (c.dark ? ' · dark mode' : '')) +
      line('On ' + esc(where || '?') + ' · ' + esc(c.version || '') + (c.minutes ? ' · ' + c.minutes + ' min in the app' : '') + (c.fromNudge ? ' · from the 10-minute card' : '')) +
      ((c.errors || []).length ? line('<b style="font-weight:800;color:#9b1c31">' + c.errors.length + (c.errors.length === 1 ? ' recent error' : ' recent errors') + '</b>') : '') +
      (!c.online ? line('Was offline') : '') + (c.push && c.push !== 'granted' ? line('Phone notifications: ' + esc(c.push === 'default' ? 'not turned on' : c.push)) : '') +
      '<span ' + on(() => setState({ fbCtxOpen: Object.assign({}, state.fbCtxOpen, { [x.id]: !open }) })) + ' aria-expanded="' + !!open + '" style="align-self:flex-start;margin-top:2px;font-size:13px;font-weight:800;color:#5b4ae8;cursor:pointer">' + (open ? 'Hide details' : 'Last taps and errors') + '</span>' +
      (open ? '<div style="display:flex;flex-direction:column;gap:4px;margin-top:4px"><div style="font-size:11px;font-weight:900;letter-spacing:.8px;color:#8a909b">LAST TAPS, OLDEST FIRST</div>' + list(c.taps || [], 'tap') +
        '<div style="margin-top:6px;font-size:11px;font-weight:900;letter-spacing:.8px;color:#8a909b">ERRORS</div>' + list(c.errors || [], 'error') +
        '<div style="margin-top:6px;font-size:11.5px;line-height:1.35;font-weight:500;color:#9aa0ac;overflow-wrap:anywhere">' + esc((c.lang || '') + ' · ' + (c.tz || '') + ' · ' + (c.ua || '')) + '</div></div>' : '') +
    '</div>';
  };
  function viewFbInbox() {
    const list = state.fbInbox || [], seen = fbSeenAt();
    const close = () => { try { localStorage.setItem(FB_SEEN_KEY, String(Date.now())); } catch (e) { /* blocked */ } setState({ fbOpen: false }); };
    const who = (x) => { const p = state.profiles[x.uid]; return avatarSpan(x.uid, x.name, p && p.avatar ? photoUrl(p.avatar) : null, 36); };
    const card = (x) => '<div data-feedback style="background:#fff;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
      '<div style="display:flex;align-items:center;gap:10px">' + who(x) + '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(x.name) + '</div>' +
        '<div style="font-size:12.5px;font-weight:600;color:#8a909b">' + esc(ago(x.at)) + '</div></div>' +
        (x.at > seen ? '<span style="flex:0 0 auto;height:22px;padding:0 8px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:11px;font-weight:900;letter-spacing:.6px;display:flex;align-items:center">NEW</span>' : '') + '</div>' +
      '<div style="font-size:15px;line-height:1.45;font-weight:500;color:#2a2f38;white-space:pre-wrap;overflow-wrap:break-word">' + esc(x.text) + '</div>' +
      (x.shot ? '<span ' + on(() => setState({ zoom: { photos: [x.shot], i: 0 } })) + ' data-fb-inbox-shot aria-label="See ' + esc(x.name) + '’s screenshot" style="align-self:flex-start;width:84px;height:120px;border-radius:10px;background:#dcdfe6 url(' + esc(x.shot) + ') center top/cover;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);cursor:zoom-in"></span>'
        : x.hasShot ? '<span style="font-size:12.5px;font-weight:700;color:#8a909b">Screenshot couldn’t load</span>' : '') +
      fbCtxBox(x) + '</div>';
    return sheet6('Feedback', close,
      '<div style="display:flex;align-items:flex-end;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:900;letter-spacing:1px;color:#8f6405">SUPER ADMIN</div>' +
        '<h2 style="margin:2px 0 0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Feedback</h2></div>' + closeX(close) + '</div>',
      '<div style="padding:14px 14px 30px;display:flex;flex-direction:column;gap:10px">' + (list.length ? list.map(card).join('')
        : '<div style="background:#fff;border-radius:18px;padding:26px 16px;text-align:center;font-size:15px;font-weight:700;color:#6b7280">No feedback yet.</div>') + '</div>');
  }

  // ---- Add to Home Screen (not designed; HANDOFF §2): a pop-up on Welcome (once a visit) and once after signing in,
  // while the app isn't installed. Android Chrome hands us its install prompt (beforeinstallprompt), so our button
  // opens Chrome's dialog; iPhone has no prompt, so the pop-up shows the Share → Add to Home Screen steps.
  // iPhone browsers that can add to the Home Screen from their Share button (Update 12): Safari gets the ••• steps;
  // Chrome, Firefox, Edge and Opera the Chrome ones. The Google app (GSA) is an in-app browser, so none.
  const UA = navigator.userAgent;
  const IOS_BROWSER = !IS_IOS || /GSA\//.test(UA) ? '' : /Safari\//.test(UA) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|Android/.test(UA) ? 'Safari'
    : /CriOS|FxiOS|EdgiOS|OPiOS/.test(UA) ? 'Chrome' : '';
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
  // When to pop it up by itself: at most once a visit, and it keeps coming back now and then until the app is
  // installed (owner, 2026-09-30; Update 11 had Got it = never again). Got it hides it for 48 hours; Maybe later, ✕,
  // the scrim or Escape for 24. localStorage holds the time it may show again. Never in the installed app
  // (installMode() is '' there). Called after each render; waits for other pop-ups (sign-in, name, confirm…).
  const A2HS = 'sparkhub-a2hs', A2HS_DAY = 864e5;
  const a2hsSeen = () => { try { return (+localStorage.getItem(A2HS) || 0) > Date.now() || sessionStorage.getItem(A2HS) === 'later'; } catch (e) { return true; } };
  const a2hsMark = (store, v) => { try { store.setItem(A2HS, v); } catch (e) { /* fine */ } };
  const a2hsHide = (days) => { a2hsMark(localStorage, String(Date.now() + days * A2HS_DAY)); setState({ installPop: false }); };
  const a2hsLater = () => { a2hsMark(sessionStorage, 'later'); a2hsHide(1); };
  const a2hsDone = () => a2hsHide(2);
  let popTimer = null;
  const maybeInstallPop = () => {
    const st = state;
    if (popTimer || st.installPop || !installMode() || st.viewAs || st.screen === 'compose' || st.inv) return;   // never over the invite screens
    if (st.loginStep || st.nameAsk || st.confirm || st.guestOpen || st.joinOpen || st.pe || st.invite || st.profSheet || st.notifSheet) return;
    if (!(welcomeShown() || (st.email && st.loaded)) || a2hsSeen()) return;
    popTimer = setTimeout(() => {
      popTimer = null;
      if (!installMode() || a2hsSeen() || state.inv) return;
      a2hsMark(sessionStorage, 'later');   // once a visit, whatever they tap
      setState({ installPop: true, invA2hs: false });
    }, st.invA2hs ? 1200 : 700);   // after an invite's Welcome: 1.2s into the group page
  };
  // Round 41d: RECOMMENDED · Make this an app (kinda) · two icon steps (iPhone) · Got it / Maybe later.
  // Android Chrome has its own install dialog, so there the button opens it and the steps are left out.
  const A2HS_SHARE = '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10.5H6.5A1.5 1.5 0 0 0 5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5H16"/>';
  const A2HS_ADD = '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>';
  const A2HS_DOTS = '<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>';
  function viewInstallPop() {
    const mode = installMode();
    if (!mode) return '';
    const step = (icon, html) => '<div style="flex:0 0 130px;width:130px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">' +
      '<span aria-hidden="true" style="width:64px;height:64px;border-radius:999px;background:#eceef1;display:flex;align-items:center;justify-content:center">' + svg(28, stroke('#0d1117', 2), icon) + '</span>' +
      '<span style="font-size:14px;line-height:1.3;font-weight:500;color:#0d1117">' + html + '</span></div>';
    // Safari (Update 12, Round 42b): Share sits behind ••• by the address bar, so three stacked rows
    const row = (icon, html) => '<div style="display:flex;align-items:center;gap:14px"><span aria-hidden="true" style="flex:0 0 50px;width:50px;height:50px;border-radius:999px;background:#eceef1;color:#0d1117;display:flex;align-items:center;justify-content:center">' + svg(22, stroke('#0d1117', 2), icon) + '</span>' +
      '<span style="font-size:16px;line-height:1.3;font-weight:500;color:#0d1117">' + html + '</span></div>';
    const link = '<span aria-hidden="true" style="display:block;width:2px;height:10px;margin-left:24px;border-radius:1px;background:#dcdfe6"></span>';
    const steps = mode === 'prompt' ? '' : IOS_BROWSER === 'Safari'
      ? '<div data-a2hs-steps="safari" style="display:flex;flex-direction:column;gap:6px">' + row(A2HS_DOTS, 'Tap <b style="font-weight:900">•••</b> in this browser') + link +
          row(A2HS_SHARE, 'Choose <b style="font-weight:900">Share</b>') + link + row(A2HS_ADD, 'Choose <b style="font-weight:900">Add to Home Screen</b>') + '</div>'
      : '<div data-a2hs-steps="chrome" style="display:flex;align-items:flex-start;justify-content:center;gap:4px">' +
      step(A2HS_SHARE, 'Tap <b style="font-weight:900">Share</b> in this browser') +
      '<span aria-hidden="true" style="flex:0 0 30px;height:64px;display:flex;align-items:center">' + '<svg width="30" height="14" viewBox="0 0 30 14" fill="none" stroke="#b9bcc4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h25M21 2l6 5-6 5"/></svg>' + '</span>' +
      step(A2HS_ADD, 'Choose <b style="font-weight:900">Add to Home Screen</b>') + '</div>';
    return '<div class="modal-scrim" data-scrim="' + reg(a2hsLater) + '" style="z-index:36;display:block;padding:0;background:rgba(13,17,23,.55)">' +
      '<div data-install-pop role="dialog" aria-modal="true" aria-label="Add to Home Screen" style="position:absolute;left:16px;right:16px;bottom:calc(24px + env(safe-area-inset-bottom, 0px));max-width:420px;margin:0 auto;background:#fff;border-radius:28px;padding:26px 22px 18px;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);animation:popIn 260ms cubic-bezier(.22,.9,.28,1) both">' +
        closeX(a2hsLater, 'position:absolute;top:12px;right:12px;width:34px;height:34px') +
        '<div style="font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#5b4ae8">Recommended</div>' +
        '<h3 style="margin:0;font-size:28px;line-height:1.05;font-weight:900;letter-spacing:-.8px;color:#0d1117">Make this an app (kinda)</h3>' +
        '<p style="margin:0;font-size:19px;line-height:1.35;font-weight:500;color:#5c6270">Add a shortcut icon on your home screen, no App Store needed.</p>' +
        steps +
        '<button type="button" class="hov-primary" ' + on(mode === 'prompt' ? () => { a2hsDone(); startInstall(); } : a2hsDone) + ' style="width:100%;min-height:54px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:17px;font-weight:900;cursor:pointer">' + (mode === 'prompt' ? 'Add to Home Screen' : 'Got it') + '</button>' +
        '<button type="button" ' + on(a2hsLater) + ' style="display:block;width:100%;margin-top:-6px;min-height:44px;border:0;background:transparent;font-family:inherit;font-size:15px;font-weight:800;color:#6b7280;cursor:pointer">Maybe later</button>' +
      '</div></div>';
  }

  // v6: a slide-up sheet (from the bell), gear and Close beside the title
  function viewNotifSheet() {
    const st = state, all = notifList(), f = st.nFilter, shown = all.filter(n => f === 'all' || N_TYPES[n.type].cat === f), unread = all.filter(isUnread).length;
    const todayStart = midnight(todayISO());
    const secs = [['Today', shown.filter(n => n.t >= todayStart)], ['Earlier this week', shown.filter(n => n.t < todayStart)]].filter(x => x[1].length);
    const chip = (k, label) => '<span ' + on(() => setState({ nFilter: k }), 'radio') + ' aria-checked="' + (f === k) + '" style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;font-size:13.5px;font-weight:800;white-space:nowrap;cursor:pointer;' +
      (f === k ? 'background:#0d1117;color:#fff' : 'background:#f2f3f6;color:#454b55') + '">' + label + '</span>';
    const row = (n, k) => {
      const T = N_TYPES[n.type], g = n.s && groupById(n.s.groupId), unr = isUnread(n), face = n.uid ? avatarOf(n.uid) : null;
      const what = n.s ? '<b style="font-weight:800;color:#0d1117">' + esc(n.s.text) + '</b>' : '';
      const line = n.type === 'note' ? '<b style="font-weight:800;color:#0d1117">' + esc(n.body) + '</b>'
        : n.type === 'update' ? what + ' · ' + esc(n.quote)   // Round 65a
        : n.type === 'newevent' ? (n.idea ? 'New idea: ' : 'New: ') + what
        : n.type === 'reminder'
        ? '<b style="font-weight:800;color:#0d1117">' + esc(n.who) + '</b> ' + what + esc(n.after)
        : '<b style="font-weight:800;color:#0d1117">' + esc(n.who) + '</b> ' + esc(n.text) + ' ' +
          (n.item ? '<b style="font-weight:800;color:#0d1117">' + esc(n.item) + '</b>' + (n.joiner ? esc(n.joiner) + what : ' on ' + what) : what);
      return '<div ' + on(() => openNotif(n)) + ' data-notif="' + esc(n.type) + '" style="display:flex;align-items:flex-start;gap:12px;padding:14px;border-top:' + (k ? '1px solid #f2f3f6' : '0') + ';background:' + (unr ? '#faf9ff' : '#fff') + ';cursor:pointer">' +
        avatarSpan(n.type === 'reminder' ? n.s.id : n.uid, n.type === 'reminder' ? n.s.text : n.who, face, 44, 'position:relative',
          '<span style="position:absolute;right:-3px;bottom:-3px;width:20px;height:20px;border-radius:999px;border:2px solid #fff;background:' + T.bg + ';color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1">' + T.glyph + '</span>') +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:15px;line-height:1.35;font-weight:500;color:#2b303a">' + line + '</div>' +
          (n.sub ? '<div style="margin-top:2px;font-size:14px;line-height:1.35;font-weight:600;color:#5c6270">' + esc(n.sub) + '</div>' : '') +
          (n.quote && n.type !== 'update' ? '<div style="margin-top:8px;padding:10px 12px;border-radius:12px;background:#f2f3f6;font-size:14px;line-height:1.4;font-weight:500;color:#2b303a">' + esc(n.quote) + '</div>' : '') +
          '<div style="margin-top:4px;font-size:12.5px;font-weight:600;color:#9aa0ac">' + esc((n.type === 'update' ? 'From ' + firstName(n.who) + ' · ' : '') + ago(n.t) + (g ? ' · ' + g.name : '')) + '</div>' +
          (n.rsvp && !myRsvp(n.s) && !n.s.cancelledAt && phaseOf(n.s) === 'plan'
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
      '<div style="display:flex;align-items:center;gap:10px">' + '<h2 style="flex:1;min-width:0;margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Notifications</h2>' + gear + closeX(close) + '</div>' +
        '<div class="no-scrollbar" role="radiogroup" aria-label="Show" style="margin-top:14px;display:flex;gap:8px;overflow-x:auto">' + chip('all', 'All') + chip('invites', 'New') + chip('updates', 'Updates') + chip('hosting', 'Leading') + '</div>',
      '<div style="padding:16px 14px 30px;display:flex;flex-direction:column;gap:16px">' + pushCard() +
        (!st.loaded ? skeleton(4, 76)
          : secs.length
          ? secs.map(([label, items], i) => '<div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 4px 6px;min-height:32px"><span style="' + EYEBROW + '">' + label + (!i && unread ? ' · ' + unread + ' unread' : '') + '</span>' +
              (!i && unread ? '<span ' + on(markAllRead) + ' style="font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Mark all read</span>' : '') + '</div><div style="' + CARD + ';overflow:hidden">' + items.map(row).join('') + '</div></div>').join('')
          : '<div style="' + CARD + ';padding:18px;font-size:14.5px;line-height:1.45;font-weight:500;color:#6b7280">' + (f === 'all' ? 'You’re all caught up. New events, updates and RSVPs from the last week show up here.' : 'Nothing here this week.') + '</div>') +
      '</div>', 48);
  }

  function viewNotifSettings() {
    const n = state.notif, topics = n.topics || {}, close = () => setState({ nSettings: false });
    const toggle = (k) => () => saveNotif({ topics: Object.assign({}, topics, { [k]: topics[k] === false }) });
    return sheet('Notification settings', close, 'max-height:88%;overflow:auto;padding:10px 18px 26px',
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
        '<h3 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-.5px;color:#0d1117">Notifications</h3>' +
        closeX(close) +
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
    const sub = { on: 'On for this ' + DEVICE, off: 'Off for this ' + DEVICE, denied: 'Blocked. Allow them for Spark Hub in your phone’s Settings.', install: 'On iPhone, add Spark Hub to your Home Screen first, then turn them on there.', none: 'This browser can’t show them.' }[ps];
    const canToggle = ps === 'on' || ps === 'off';
    return '<div ' + (canToggle ? on(v ? turnOffPush : turnOnPush, 'switch') + ' aria-checked="' + v + '" ' : '') + 'aria-label="Phone notifications" style="margin-top:12px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#f4f5f7;' + (canToggle ? 'cursor:pointer' : '') + '">' +
      '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#0d1117">Phone notifications</div><div style="font-size:13px;line-height:1.35;font-weight:500;color:#6b7280">' + esc(sub) + '</div></div>' +
      (canToggle ? '<span aria-hidden="true" style="flex:0 0 46px;width:46px;height:28px;border-radius:999px;position:relative;transition:background 160ms;background:' + (v ? '#149a4b' : '#dcdfe6') + '"><span style="position:absolute;top:3px;left:' + (v ? 21 : 3) + 'px;width:22px;height:22px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left 160ms"></span></span>' : '') +
    '</div>';
  };

  // Signed in but in no group yet (not designed; README → Open "first-run view")
  // The first load failed (offline, or the database didn't answer): say so, never "You're not in a group yet"
  const loadFailCard = (extra) =>
    '<div role="status" data-load-failed style="' + (extra ? extra + ';' : '') + 'display:flex;align-items:flex-start;gap:12px;background:#fdeef0;border:1.5px solid #f5c2cb;border-radius:14px;padding:13px 14px">' +
      '<span style="flex:0 0 30px;width:30px;height:30px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center">' + I.offline + '</span>' +
      '<div style="flex:1 1 auto;min-width:0"><div style="font-size:14.5px;font-weight:800;color:#9b1c31">Couldn’t load your groups and events</div>' +
      '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:600;color:#9b1c31;text-wrap:pretty">Check your connection. We’ll keep trying, and this goes away once you’re back.</div></div>' +
      '<span ' + on(retryNow) + ' style="flex:0 0 auto;min-height:30px;display:flex;align-items:center;font-size:13.5px;font-weight:800;color:#9b1c31;text-decoration:underline;text-underline-offset:3px;cursor:pointer">Try now</span>' +
    '</div>';
  const noGroupCard = () => state.error === 'load' ? loadFailCard() :
    '<div style="' + CARD + ';padding:18px;display:flex;flex-direction:column;gap:12px">' +
      '<div style="font-size:16.5px;font-weight:800;letter-spacing:-.2px;color:#0d1117">You’re not in a group yet.</div>' +
      '<div style="font-size:15px;line-height:1.45;font-weight:500;color:#5c6270">Join one with a code from someone in it, or start your own.</div>' +
      '<button type="button" class="hov-primary" ' + on(() => openJoin()) + ' style="' + primary(true) + '">Join with a code</button>' +
      '<button type="button" ' + on(() => startGroup()) + ' style="' + SECONDARY + '">Start a group</button>' +
    '</div>';

  // ---- v6 Update 2: reactions on past events (❤️ 🙌 🎉, 🙏 thanks, "Let's do it again!") ---------
  const RX6 = [['heart', '❤️', -4], ['praise', '🙌', 3], ['party', '🎉', -2]];
  const myReact = (s, k) => s.reactions.some(r => r.userId === state.me && r.kind === k);
  const countReact = (s, k) => s.reactions.filter(r => r.kind === k).length;
  const toggleReact = (s, k, opts) => needSignIn(() => {
    const on_ = myReact(s, k), o = opts || {};
    if (on_ && o.once) return;
    if (!on_ && o.note && !state.viewAs) toast(o.note, true);
    quick(s, { reactions: on_ ? s.reactions.filter(r => !(r.userId === state.me && r.kind === k)) : s.reactions.concat([{ userId: state.me, kind: k }]) }, async () => {
      if (on_) must(await sb.from('reactions').delete().eq('spark_id', s.id).eq('user_id', state.me).eq('kind', k));
      else must(await sb.from('reactions').insert({ spark_id: s.id, user_id: state.me, kind: k }));
    });
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
  const helpersOf = (s) => { const set = {}; s.signups.forEach(it => it.claims.forEach(c => { if (c.userId !== s.leadId && s.cohosts.indexOf(c.userId) < 0) set[c.userId] = 1; })); return Object.keys(set).length; };
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
        (s.wantsHost ? '<span data-needs-host style="position:absolute;top:6px;left:6px;display:flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;background:#e8a71c;font-size:10.5px;font-weight:900;letter-spacing:.6px;color:#fff">NEEDS A LEAD</span>' : '') +
        '<div style="position:absolute;left:9px;right:26px;bottom:8px;font-size:14.5px;line-height:1.15;font-weight:900;color:#fff;text-wrap:balance">' + (isDemo(s) ? '<div style="margin-bottom:5px">' + demoTagOnly(s, true) + '</div>' : '') + esc(s.text) + '</div></div>' +   // DEMO above the title (owner, 2026-10-01)
      '<span style="display:flex;align-items:center;padding:8px 0 0">' + ideaSteps6(s).map((st, i) => '<span aria-label="' + st.label + ': ' + (st.p >= 1 ? st.done : st.todo) + '" style="flex:1;height:22px;display:flex;align-items:center;justify-content:center;' + (i ? 'border-left:1px solid #dcdfe4' : '') + '">' + ic6(st.icon, 15, st.p >= 1 ? '#149a4b' : '#b07a0a', 2.3) + '</span>').join('') + '</span></div>';
  };
  // `last`: a card after the ideas (the Post an idea prompt), at the foot of the shorter column
  const ideaBoard6 = (ideas, last) => {
    const col = (list, off, end) => '<div style="display:flex;flex-direction:column;gap:14px">' + list.map((s, i) => ideaCard6(s, i * 2 + off)).join('') + (end || '') + '</div>';
    const odd = ideas.length % 2 === 1;
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;padding:6px 2px 20px">' + col(ideas.filter((_, i) => i % 2 === 0), 0, odd ? '' : last) + col(ideas.filter((_, i) => i % 2 === 1), 1, odd ? last : '') + '</div>';
  };
  // Owner's mocks, 2026-10-01: the Ideas tab's empty state, and the same prompt as a dashed card at the end of the board.
  // Both open Create event with this group picked (an event without a date posts as an idea)
  const WE_SHOULD = 'Got a “we should…”?';
  const ideaBulb6 = (size, ring) => '<span aria-hidden="true" style="flex:0 0 auto;width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:#efc95a;display:flex;align-items:center;justify-content:center;box-shadow:' + ring + '">' + svg(Math.round(size * .42), stroke('#3d2a00', 2.2), BULB_IC) + '</span>';
  const ideasEmpty6 = (g) => '<div data-ideas-empty style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding:34px 4px 24px">' +
    ideaBulb6(64, '0 0 0 14px rgba(239,201,90,.28), 0 0 0 28px rgba(239,201,90,.13)') +
    '<h2 style="margin:18px 0 0;font-size:26px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117;text-wrap:balance">' + WE_SHOULD + '</h2>' +
    '<p style="margin:0;max-width:330px;font-size:15px;line-height:1.45;font-weight:500;color:#4b5160">An idea is an event without a date. Post it, people vote on when and where, and it turns into a plan once someone leads it.</p>' +
    '<button type="button" ' + on(() => goCompose({ evGroups: [g.id] })) + ' style="margin-top:6px;width:100%;min-height:56px;border:0;border-radius:999px;background:#efc95a;box-shadow:0 6px 16px rgba(201,143,22,.25);display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;font-size:17px;font-weight:800;color:#3d2a00;cursor:pointer">' +
      'Start an event</button></div>';
  const ideaPrompt6 = (g) => '<div ' + on(() => goCompose({ evGroups: [g.id] }), 'button') + ' data-idea-prompt aria-label="Start an event" style="min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px 10px;border-radius:18px;border:2px dashed #ecc85a;background:#fdf8ec;text-align:center;cursor:pointer">' +
    ideaBulb6(54, '0 0 0 8px rgba(239,201,90,.25)') +
    '<span style="margin-top:4px;font-size:16.5px;line-height:1.15;font-weight:900;color:#3d2a00;text-wrap:balance">' + WE_SHOULD + '</span>' +
    '<span style="font-size:14.5px;font-weight:800;color:#8a6510">Start an event ›</span></div>';
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
  // "{GROUP} · SO FAR": events · said yes · photos, with confetti. Going RSVPs, not attendance, so not "showed up" (research review, 2026-10-01)
  const recap6 = (g, done) => {
    const went = done.reduce((a, s) => a + cameCount(s), 0), allIn = done.length && done.every(checkedIn), photos = done.reduce((a, s) => a + picsOf(s).length, 0);
    const COL = ['#e8a71c', '#5b4ae8', '#149a4b', '#e2556b', '#1f7ab8'];
    const confetti = Array.from({ length: 16 }, (_, i) => '<span aria-hidden="true" style="position:absolute;left:' + ((i * 37) % 100) + '%;top:' + ((i * 53) % 120) + 'px;width:' + (i % 3 ? 6 : 8) + 'px;height:' + (i % 2 ? 3 : 8) + 'px;border-radius:' + (i % 2 ? '1px' : '999px') + ';background:' + COL[i % 5] + ';transform:rotate(' + (i * 40) + 'deg);opacity:.85"></span>').join('');
    const big = (n, label) => '<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:40px;line-height:1;font-weight:900;letter-spacing:-1.5px">' + n + '</span><span style="font-size:12px;font-weight:800;color:#c3c7d0">' + label + '</span></div>';
    const hide = g ? '<span ' + on(() => setState({ pastStatsHidden: Object.assign({}, state.pastStatsHidden, { [g.id]: true }) })) + ' aria-label="Hide this" style="position:absolute;top:4px;right:4px;z-index:1;width:36px;height:36px;display:flex;align-items:center;justify-content:center;opacity:.45;cursor:pointer">' + I.x(12, '#fff', 2.6) + '</span>' : '';
    return '<div data-screen-label="So far" style="position:relative;border-radius:18px;padding:16px;background:#1f2433;color:#fff;overflow:hidden;box-shadow:0 3px 12px rgba(60,40,10,.14)">' + confetti + hide +
      '<div style="position:relative;font-size:11px;font-weight:900;letter-spacing:1px;color:#ffd98a">' + esc((g ? g.name : 'This group').toUpperCase()) + ' · SO FAR</div>' +
      '<div style="position:relative;margin-top:10px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' + big(done.length, done.length === 1 ? 'event' : 'events') + big(went, allIn ? 'came' : 'said yes') + big(photos, photos === 1 ? 'photo' : 'photos') + '</div></div>';
  };
  // A memory card: the photo (a mosaic with four or more), "N said yes!" (Going RSVPs, not a head count), add a photo, who made it happen, reactions
  const WENT6 = ['#ffb347,#ff6f91', '#7b6ef0,#e05fc4', '#1fb86a,#1f9ec8', '#ff8a3d,#e2336b', '#3d8bff,#8a5cf0'];
  const pastCard6 = (s, i) => {
    const pics = picsOf(s), mosaic = pics.length >= 4, n = cameCount(s), lead = nameOf(s.leadId, s.leadName), h = helpersOf(s);
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
        '<span style="position:absolute;top:10px;right:10px;display:flex;align-items:center;gap:5px;height:34px;padding:0 13px 0 10px;border-radius:999px;background:linear-gradient(135deg,' + WENT6[(i || 0) % 5] + ');color:#fff;font-size:14.5px;font-weight:900;transform:rotate(4deg);box-shadow:0 3px 8px rgba(0,0,0,.25)"><span style="font-size:17px">🎉</span>' + n + (checkedIn(s) ? ' came!' : ' said yes!') + '</span>' +
        '<div style="position:absolute;left:12px;bottom:10px;right:56px;color:#fff"><div style="font-size:24px;line-height:1.1;font-weight:900;letter-spacing:-.5px;text-wrap:balance">' + esc(s.text) + demoTag(s, true, true) + '</div></div>' +
      '</div>' +
      '<div style="padding:10px 12px 12px;display:flex;flex-direction:column;gap:10px">' +
        '<div ' + on(() => openSpark(s)) + ' aria-label="Made it happen: ' + esc(lead) + ', ' + thanks + ' thanks" style="position:relative;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg,#f1edff,#e0d8ff);overflow:hidden;cursor:pointer">' +
          '<span aria-hidden="true" style="position:absolute;left:52%;top:5px;font-size:9px;color:#9d93f7">✦</span><span aria-hidden="true" style="position:absolute;left:64%;bottom:5px;font-size:7px;color:#7b6ef0">✦</span><span aria-hidden="true" style="position:absolute;left:44%;bottom:8px;font-size:10px;color:#fff">✧</span>' +
          '<span style="position:relative;flex:0 0 36px">' + face(s.leadId, lead, 36, '#7b6ef0', 'box-shadow:0 0 0 2.5px #7b6ef0') +
            '<span aria-hidden="true" style="position:absolute;top:-9px;left:-7px;font-size:11px;line-height:1;color:#9d93f7">✦</span><span aria-hidden="true" style="position:absolute;top:-6px;right:-8px;font-size:9px;line-height:1;color:#b8aefc">✦</span><span aria-hidden="true" style="position:absolute;bottom:-5px;right:-9px;font-size:12px;line-height:1;color:#7b6ef0">✧</span></span>' +
          '<div style="flex:1;min-width:0"><div style="font-size:10.5px;font-weight:900;letter-spacing:.8px;color:#6b5ce7">MADE IT HAPPEN</div><div style="font-size:14.5px;font-weight:900;color:#2a1f8f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(lead + (s.cohosts.length ? ' & ' + s.cohosts.map(u => firstName(nameOf(u))).join(' & ') : '') + (h ? ', with ' + h + (h === 1 ? ' helper' : ' helpers') : '')) + '</div></div>' +
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
  const stepTab = (d) => { hintLearned(); const i = WORLDS.indexOf(state.phaseTab) + d; if (i >= 0 && i < WORLDS.length) switchTab(WORLDS[i], d); };
  // The edge arrows teach swiping (owner, 2026-10-01): only on someone's first 3 group-page visits on this device,
  // and never again once they've swiped or used an arrow
  const HINT_KEY = 'spark-hub-swipe-hint';
  const hintCount = () => { try { return Number(localStorage.getItem(HINT_KEY)) || 0; } catch (e) { return 99; } };
  const hintVisit = () => { try { localStorage.setItem(HINT_KEY, String(hintCount() + 1)); } catch (e) { /* blocked */ } };
  const hintLearned = () => { try { localStorage.setItem(HINT_KEY, '99'); } catch (e) { /* blocked */ } };
  // Quiet chevrons on the screen's edges, nudging now and then toward the next tab
  const swipeHints = () => {
    if (hintCount() > 3) return '';
    const i = WORLDS.indexOf(state.phaseTab), names = { idea: 'Ideas', plan: 'Plans', done: 'Past' };
    // v7 Update 15 (1d): a faint gray ‹ › in the side margins, no shape behind it
    const arrow = (d) => '<span ' + on(() => stepTab(d)) + ' aria-label="Go to ' + names[WORLDS[i + d]] + '" class="swipe-hint swipe-hint-' + (d < 0 ? 'l' : 'r') + '">' + (d < 0 ? I.chevL(18, '#6b7280', 2.8) : I.chevR(18, '#6b7280', 2.8)) + '</span>';
    return (i > 0 ? arrow(-1) : '') + (i < WORLDS.length - 1 ? arrow(1) : '');
  };

  // v7 Update 15 (6c / 3b): the group's Invite (owners and admins hold the link) and its ⋯ menu
  const GROUP_INV_ICON = '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>';
  // The link is fetched when an admin opens the group, so a tap can open the phone's share sheet straight away
  // (Safari only allows that from the tap itself, not after waiting on the database)
  const groupCodes = {};
  const groupLink = async (g) => { if (!groupCodes[g.id]) groupCodes[g.id] = must(await sb.rpc('group_code', { p_group: g.id })).data; if (!groupCodes[g.id]) throw new Error('no code'); return inviteLink(groupCodes[g.id]); };
  const primeGroupLink = (g) => { if (g && runs(g) && !groupCodes[g.id] && !state.viewAs && sb) groupLink(g).catch(() => {}); };
  // Phones: the share sheet; computers: copy the link
  const groupInvite = (g, copyOnly) => {
    const send = (url) => {
      setState({ gMenu: null });
      if (!copyOnly && TOUCH && navigator.share) navigator.share({ title: g.name, text: 'You’re invited to ' + g.name + '. Make plans with your people and show up together.', url }).catch(() => {});
      else copy(url, 'Invite link copied');
    };
    if (groupCodes[g.id]) return send(inviteLink(groupCodes[g.id]));
    groupLink(g).then(send, e => { console.error(e); toast(failed(e)); });
  };
  const openGroupMenu = (g) => {
    setState({ gMenu: g.id, gMenuPeople: null, gMenuBlocked: 0, menu: null });
    sb.rpc('group_people', { p_group: g.id }).then(r => { if (!r.error && state.gMenu === g.id) setState({ gMenuPeople: r.data || [] }); });
    if (runs(g)) sb.rpc('group_blocked', { p_group: g.id }).then(r => { if (!r.error && state.gMenu === g.id) setState({ gMenuBlocked: (r.data || []).length }); });
  };
  function viewGroupMenu() {
    const g = groupById(state.gMenu);
    if (!g) return '';
    const close = () => setState({ gMenu: null }), admin = runs(g), people = state.gMenuPeople || [], n = state.sizes[g.id] || people.length;
    const round = (label, icon, fn, main) => '<div ' + on(fn) + ' role="button" aria-label="' + label + '" style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer">' +
      '<span style="width:52px;height:52px;border-radius:999px;background:' + (main ? '#5b4ae8' : '#f3f1fe') + ';display:flex;align-items:center;justify-content:center">' + svg(20, stroke(main ? '#fff' : '#4a3ad4', 2.3), icon) + '</span>' +
      '<span style="font-size:13px;font-weight:800;color:#0d1117">' + label + '</span></div>';
    const row = (label, fn, right, first) => '<div ' + on(fn) + ' role="button" style="min-height:48px;padding:0 14px;' + (first ? '' : 'border-top:1px solid #eceef2;') + 'display:flex;align-items:center;gap:12px;font-size:15.5px;font-weight:800;color:#0d1117;cursor:pointer">' +
      '<span style="flex:1">' + label + '</span>' + (right ? '<span style="font-size:14px;font-weight:700;color:#8a909b">' + right + '</span>' : '') + I.chevR(13, '#b9bcc4', 3) + '</div>';
    const then = (fn) => () => { close(); fn(); };
    // Invite and Copy link need the group's link, which owners and admins hold (group_code()); everyone gets Search and Alerts
    const actions = (admin ? [round('Invite', GROUP_INV_ICON, () => groupInvite(g), true),
      round('Copy link', '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>', () => groupInvite(g, true))] : [])
      .concat([round('Search', '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', then(openGroupSearch), !admin),
        round('Alerts', '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.6 2H4.4L6 16.5Z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>', then(() => setState({ notifSheet: true, nSettings: true })))]);
    return '<div class="v6-scrim" data-scrim="' + reg(close) + '" style="z-index:38">' +
      '<div role="dialog" aria-modal="true" aria-label="Group options" data-screen-label="Group options" style="position:absolute;left:0;right:0;bottom:0;max-height:88%;overflow:auto;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -10px 30px rgba(13,17,23,.2);display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 18px calc(22px + env(safe-area-inset-bottom, 0px));animation:sheetUp 260ms cubic-bezier(.2,.8,.2,1) both">' +
        '<span aria-hidden="true" style="width:40px;height:5px;border-radius:999px;background:#dcdfe6"></span>' +
        '<div style="align-self:stretch;display:flex;align-items:center;gap:12px"><span aria-hidden="true" style="flex:0 0 44px;width:44px;height:44px;border-radius:12px;background:' + groupBg(g, HEAD_GOLD) + '"></span>' +
          '<span style="flex:1;min-width:0;font-size:20px;font-weight:900;letter-spacing:-.4px;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(g.name) + '</span>' +
          '<span ' + on(close) + ' role="button" aria-label="Close" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(13, '#0d1117', 2.8) + '</span></div>' +
        '<div style="align-self:stretch;display:grid;grid-template-columns:repeat(' + actions.length + ',minmax(0,1fr));gap:8px">' + actions.join('') + '</div>' +
        '<div ' + on(then(() => openMembersOf(g))) + ' role="button" aria-label="Members, see all" style="align-self:stretch;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#f7f7f9;cursor:pointer">' +
          '<span style="display:flex">' + people.slice(0, 3).map((m, i) => memberFace(m, 30, 'border:2px solid #f7f7f9;' + (i ? 'margin-left:-8px;' : ''))).join('') + '</span>' +
          '<span style="flex:1;font-size:15px;font-weight:800;color:#0d1117">Members</span><span style="font-size:14px;font-weight:800;color:#5b4ae8">' + (n ? 'See all ' + n : 'See all') + '</span></div>' +
        (admin ? '<div style="align-self:stretch;display:flex;flex-direction:column;gap:6px;padding-top:12px;border-top:1px solid #f2f3f6"><span style="padding:0 4px;font-size:12px;font-weight:900;letter-spacing:1px;color:#6b7280">ADMINS ONLY</span>' +
          '<div style="border-radius:16px;background:#f7f7f9;display:flex;flex-direction:column">' +
            row('Edit group', then(() => openGroupPage(g.id, false, 'browse')), '', true) +
            row('Invite link &amp; code', then(() => openGroupPage(g.id, false, 'browse'))) +
            (state.gMenuBlocked ? row('Blocked', then(() => openMembersOf(g)), String(state.gMenuBlocked)) : '') +
          '</div></div>' : '') +
        (g.role ? '<span ' + on(then(() => leaveGroup(g))) + ' role="button" data-leave-group style="min-height:44px;display:flex;align-items:center;font-size:15px;font-weight:800;color:#9b1c31;cursor:pointer">Leave group</span>' : '') +
      '</div></div>';
  }

  function viewBrowse() {
    const st = state, g = currentGroup(), tab = st.phaseTab;
    const loading = !st.loaded;
    if (g && runs(g) && !groupCodes[g.id]) setTimeout(() => primeGroupLink(g), 0);
    const gPhoto = groupPhoto(g), size = g ? st.sizes[g.id] : null;

    // v7 Update 15 (6c): a 112px photo; one row: quiet ‹ Back, YOUR GROUP over the name and members, Invite (admins) and ⋯
    const glass = 'flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.2);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer';
    const header = '<header style="position:relative;z-index:5">' +
      '<div style="position:relative;min-height:calc(112px + var(--pt));background:#2b303a;overflow:hidden;display:flex;align-items:flex-end">' +
      (gPhoto ? '<div aria-hidden="true" style="position:absolute;inset:0;overflow:hidden">' + photoLayer(gPhoto, g.photoPos, GROUP_POS) + '</div>' : '<div aria-hidden="true" style="position:absolute;inset:0;background:' + HEAD_GOLD + '"></div>') +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.9) 0%, rgba(13,17,23,.55) 60%, rgba(13,17,23,.4) 100%)"></div>' +
      '<div style="position:relative;flex:1;min-width:0;padding:calc(22px + var(--pt)) 14px 14px;z-index:3;display:flex;align-items:center;gap:10px">' +
        '<span ' + on(() => go('groups')) + ' role="button" aria-label="Back to groups" style="flex:0 0 28px;width:28px;height:44px;margin-left:-6px;margin-right:-4px;display:flex;align-items:center;justify-content:center;opacity:.85;cursor:pointer">' + I.chevL(20, '#fff', 2.6) + '</span>' +
        '<div style="flex:1;min-width:0;color:#fff;display:flex;flex-direction:column;gap:3px">' + groupTagAbove(g) +
          '<span style="font-size:12px;line-height:1;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:#cfc9ff">Your group</span>' +
          '<h1 style="margin:0;font-size:28px;line-height:1.05;font-weight:900;letter-spacing:-.8px;color:#fff;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(g ? g.name : 'Spark Hub') + '</h1>' +
          (size ? '<span ' + on(() => openMembersOf(g)) + ' role="button" aria-label="See members" style="align-self:flex-start;font-size:13px;font-weight:700;color:rgba(255,255,255,.78);cursor:pointer">' + size + (size === 1 ? ' member' : ' members') + '</span>' : '') +
        '</div>' +
        (g && runs(g) ? '<span ' + on(() => groupInvite(g)) + ' role="button" aria-label="Invite people" style="' + glass + '">' + svg(18, stroke('#fff', 2.4), GROUP_INV_ICON) + '</span>' : '') +
        (g ? '<span ' + on(() => openGroupMenu(g)) + ' role="button" aria-label="Group options" style="' + glass + '">' + svg(20, 'fill="#fff"', '<circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/>') + '</span>' : '') +
      '</div></div>' +
    '</header>';

    const offline = st.error === 'load' ? loadFailCard('margin:14px 14px 0') : '';

    // The world switcher: Ideas N · Plans N · Past N on a gray track, a white thumb sliding to the one that's on
    const counts = { idea: visible('idea').length, plan: visible('plan').length, done: visible('done').length };
    const thumbPos = { idea: 'left:4px;width:calc(100% / 3.4 - 6px)', plan: 'left:calc(100% / 3.4 + 2px);width:calc(100% * 1.4 / 3.4 - 4px)', done: 'left:calc(100% * 2.4 / 3.4 + 2px);width:calc(100% / 3.4 - 6px)' }[tab] || '';
    // v7 Update 15: a ‹ › at each end of the bar (one tab a step; faded at the ends) and the + beside it
    const ti = WORLDS.indexOf(tab), tch = (d) => { const en = ti + d >= 0 && ti + d < WORLDS.length;
      return '<span ' + on((e) => { stop(e); if (en) stepTab(d); }) + ' role="button" aria-label="' + (d < 0 ? 'Previous tab' : 'Next tab') + '"' + (en ? '' : ' aria-disabled="true"') + ' style="flex:0 0 28px;width:28px;height:44px;display:flex;align-items:center;justify-content:center;opacity:' + (en ? 1 : .3) + ';cursor:' + (en ? 'pointer' : 'default') + '">' + (d < 0 ? I.chevL(16, '#6b7280', 2.8) : I.chevR(16, '#6b7280', 2.8)) + '</span>'; };
    const tabs = g ? '<div style="position:relative;padding:14px 14px 0;z-index:3;display:flex;gap:8px;align-items:center"><div style="flex:1 1 auto;min-width:0;height:44px;border-radius:999px;background:#dfe2e7;display:flex;align-items:center">' + tch(-1) +
      '<div role="tablist" aria-label="Ideas, plans and past events" style="flex:1 1 auto;min-width:0;position:relative;height:44px;display:grid;grid-template-columns:1fr 1.4fr 1fr;align-items:center">' +
      '<span aria-hidden="true" style="position:absolute;top:4px;bottom:4px;border-radius:999px;background:#fff;box-shadow:0 1px 4px rgba(13,17,23,.15);transition:left 220ms cubic-bezier(.2,.8,.2,1),width 220ms cubic-bezier(.2,.8,.2,1);' + thumbPos + '"></span>' +
      [['idea', 'Ideas'], ['plan', 'Plans'], ['done', 'Past']].map(([k, label]) => {
        const onIt = tab === k;
        return '<span ' + on((e) => { stop(e); switchTab(k); }, 'tab') + ' aria-selected="' + onIt + '" style="position:relative;display:flex;align-items:baseline;justify-content:center;gap:5px;height:100%;line-height:44px;font-size:' + (k === 'plan' ? 14.5 : 13) + 'px;font-weight:900;cursor:pointer;white-space:nowrap;transition:color 180ms ease;color:' + (onIt ? '#0d1117' : '#6b7280') + '">' +
          label + '<span style="font-size:11.5px;font-weight:800;color:' + (onIt ? '#6b7280' : '#9aa0aa') + '">' + counts[k] + '</span></span>';
      }).join('') + '</div>' + tch(1) + '</div>' +
      '<button type="button" class="hov-primary" ' + on(() => goCompose()) + ' data-new-event aria-label="Start an event" style="flex:0 0 44px;width:44px;height:44px;border:0;border-radius:999px;background:#5b4ae8;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.plus(20, '#fff', 2.8) + '</button></div>' : '';

    const { body, pageStyle } = browseBody(tab, g);

    return '<div data-screen-label="Browse" style="' + pageStyle + '">' + header + offline + tabs +
      '<div data-tabpane style="padding:10px 14px 22px;display:flex;flex-direction:column;gap:22px">' +
        (loading ? '<div style="padding:0 4px;font-size:14px;font-weight:700;color:#6b7280">Loading events…</div>' : '') + body +
        // Leave group is in the ⋯ menu now (v7 Update 15)
      '</div>' +
      '<div style="height:var(--nav-h)"></div></div>';
  }

  // One tab's content on a group page (also drawn beside the page while it's being swiped)
  const IDEA_PAPER = 'background:#fbfaf6;background-image:linear-gradient(#eeeae0 1px, transparent 1px), linear-gradient(90deg, #eeeae0 1px, transparent 1px);background-size:18px 18px';
  function browseBody(tab, g) {
    const st = state, gv = GROUP_VIEWS.indexOf(st.gView) > -1 ? st.gView : 'next';
    let body, pageStyle = '';
    if (!st.loaded) {
      body = [0, 1, 2].map(() => '<div aria-hidden="true" style="height:180px;border-radius:20px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);animation:skPulse 1.4s ease-in-out infinite"></div>').join('');
    } else if (!g) {
      body = noGroupCard();
    } else if (tab === 'idea') {
      // The Ideas board: graph paper, two tilted columns (no sort, filter or view here)
      pageStyle = 'min-height:100%;' + IDEA_PAPER;
      const ideas = sortIdeas6(visible('idea'), st.iSort);
      body = ideas.length ? '<div style="display:flex;flex-direction:column;gap:6px">' + ideaSortRow6(st.iSort) + ideaBoard6(ideas, ideaPrompt6(g)) + '</div>' : ideasEmpty6(g);
    } else if (tab === 'done') {
      // The Past scrapbook: the recap, then a memory card per event (newest first)
      const done = visible('done').slice().sort((a, b) => byWhen(b, a));
      body = '<div style="display:flex;flex-direction:column;gap:14px;padding-bottom:20px">' + (st.pastStatsHidden[g.id] || !done.length ? '' : recap6(g, done)) +
        (done.length ? done.map((s, i) => pastCard6(s, i)).join('') : '<div style="background:#fff;border-radius:16px;padding:18px;text-align:center;font-size:15px;font-weight:700;color:#8a909b">Events show up here after they happen.</div>') + '</div>';
    } else {
      // Plans: Your schedule's cards and controls (Sort · Filter · Tiles / List), the strips expanding in place
      const all = visible('plan'), plans = applySort(applyFilters(all, st.gFilt), st.gSort), clear = () => setState({ gFilt: [], menu: null });
      const controls = '<div style="display:flex;align-items:center;gap:6px">' +
        sortPill('gSort', st.gSort, (k) => setState({ gSort: k, menu: null })) +
        filterPill('gFilt', filterOpts(['lead', 'help', 'going', 'open', 'needs', 'week'], all, st.gFilt), st.gFilt,
          (k) => setState({ gFilt: st.gFilt.indexOf(k) > -1 ? st.gFilt.filter(x => x !== k) : st.gFilt.concat([k]) }), clear, plans.length) +
        viewPicker('gview', gv, (k) => setState({ gView: k, menu: null, gMon: null, gDay: null }), GROUP_VIEWS) + '</div>';
      if (!all.length) body = plansEmpty();
      // Month (owner, 2026-09-30): the group's plans on a month grid, the chosen day's below; the filter and view menu beside the arrows
      else if (gv === 'month') body = monthBody(plans, { mon: st.gMon, day: st.gDay, cal: true, card: (s) => listCard6(s, partOf(s, true), false, true),
        menu: '<div style="display:flex;align-items:center;gap:6px">' + filterPill('gFilt', filterOpts(['lead', 'help', 'going', 'open', 'needs', 'week'], all, st.gFilt), st.gFilt,
          (k) => setState({ gFilt: st.gFilt.indexOf(k) > -1 ? st.gFilt.filter(x => x !== k) : st.gFilt.concat([k]) }), clear, plans.length) +
          viewPicker('gview', gv, (k) => setState({ gView: k, menu: null, gMon: null, gDay: null }), GROUP_VIEWS) + '</div>',
        set: (gMon, gDay) => setState({ gMon, gDay }), toTbd: () => setState({ gView: 'next', gSort: 'soon', menu: null, gMon: null, gDay: null }) });
      else if (!plans.length) body = '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(st.gSort === 'soon' ? 'Coming up' : sortName6(st.gSort), controls) + filterEmpty(clear) + '</div>';
      // Up next (Soonest): the soonest as one big tile with its countdown, the rest as list rows by This week · Next week · …
      // (Your schedule's Up next); another sort keeps its own grouping, as tiles
      else {
        const next = gv === 'next' && st.gSort === 'soon', rows = gv === 'next' && next;
        body = (next ? nextSections(plans) : sections6(plans, st.gSort, 'Date TBD')).map((z, i) => '<div style="display:flex;flex-direction:column;gap:10px">' + monthHead(z.label, i ? '' : controls) +
          '<div style="display:flex;flex-direction:column;gap:' + (rows ? 10 : 14) + 'px">' + (z.hero ? nextCard6(z.hero, partOf(z.hero, true)) : z.items.map(s => rows ? listCard6(s, partOf(s, true), false, true) : tile6(s, partOf(s, true), 180)).join('')) + '</div></div>').join('');
      }
      if (all.length) body += plansMore();
    }
    return { body, pageStyle };
  }

  // Plans tab (v6 Update 9, 80a): an empty state with a calendar fan, and "What else could happen?" under the list
  const createBtn = () => '<button type="button" class="hov-primary" ' + on(() => goCompose()) + ' style="width:100%;min-height:52px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 16px rgba(91,74,232,.3);cursor:pointer">' + I.plus(18, '#fff', 2.8) + 'Start an event</button>';
  const fanPage = (w, rot, x, y, z) => '<span style="position:absolute;left:' + x + 'px;top:' + y + 'px;z-index:' + z + ';width:' + w + 'px;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 8px 22px rgba(15,18,25,.14);transform:rotate(' + rot + 'deg)">' +
    '<span style="display:flex;align-items:center;justify-content:center;height:' + Math.round(w * .26) + 'px;background:#e2556b;color:#fff;font-size:' + Math.round(w * .12) + 'px;font-weight:900;letter-spacing:1.5px">SAT</span>' +
    '<span style="display:flex;align-items:center;justify-content:center;height:' + Math.round(w * .74) + 'px;color:#0d1117;font-size:' + Math.round(w * .5) + 'px;line-height:1;font-weight:900">?</span></span>';
  // Also Your schedule's empty state (Update 10), with its own line and buttons
  const plansEmpty = (sub, btns, attr, title) => '<div ' + (attr || 'data-plans-empty') + ' style="min-height:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:0 12px;text-align:center">' +
    '<div aria-hidden="true" style="position:relative;width:200px;height:150px">' + fanPage(96, -12, 4, 26, 1) + fanPage(96, 9, 100, 26, 1) + fanPage(118, -2, 41, 4, 2) + '</div>' +
    '<div><div style="font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + esc(title || 'No plans yet') + '</div>' +
      '<div style="margin-top:6px;font-size:15px;font-weight:500;color:#5c6270;text-wrap:pretty">' + (sub || 'Start one, or turn an idea into a plan.') + '</div></div>' + (btns || createBtn()) + '</div>';
  const schedEmpty = () => plansEmpty('Anything you say yes or maybe to lands here. See what’s happening in your groups and pick something.',
    '<div style="width:100%;display:flex;flex-direction:column;gap:10px">' +
      '<button type="button" class="hov-primary" ' + on(() => go('calendar')) + ' style="width:100%;min-height:52px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 16px rgba(91,74,232,.3);cursor:pointer">' + svg(18, stroke('#fff', 2.2), '<circle cx="12" cy="12" r="8.75"/><path d="m15.6 8.4-2.2 5-5 2.2 2.2-5 5-2.2Z"/>') + 'Explore events</button>' +
      '<button type="button" class="hov-sec" ' + on(() => goCompose()) + ' style="width:100%;min-height:52px;border:0;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;color:#0d1117;font-family:inherit;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer">' + I.plus(18, '#0d1117', 2.8) + 'Start an event</button></div>',
    'data-sched-empty', 'Nothing on your calendar yet');
  // Under a group's plans: just Create an event, on the page (owner, 2026-10-01: no Do it again? chips, no white card)
  const plansMore = () => '<div data-plans-more style="display:flex;flex-direction:column">' + createBtn() + '</div>';

  // Search inside one group: Browse chips, "Or something unexpected", live results
  const openGroupSearch = () => { setState({ gSearch: true, menu: null }); setTimeout(() => { const f = document.querySelector('[data-csearch]'); if (f) f.focus(); }, 30); };
  function viewGroupSearch() {
    const st = state, g = currentGroup(), gname = g ? g.name : 'this group', q = st.gq.trim(), t = st.gTry;
    const close = () => setState({ gSearch: false, gq: '', gTry: null });
    const inG = st.sparks.filter(s => g && inGroup(s, g.id));
    const BROWSE = { plan: ['Plans', (s) => phaseOf(s) === 'plan'], idea: ['Ideas', (s) => phaseOf(s) === 'idea'], done: ['Past events', (s) => phaseOf(s) === 'done'], needs: ['Could use a hand', (s) => phaseOf(s) === 'plan' && signupFill(s).open > 0] };
    const results = !q && !t ? [] : inG.filter(s => matchQ(s, q) && (!t || BROWSE[t][1](s))).slice(0, 30);
    const pick = (fn) => () => { const s = fn(); if (!s) { toast('Nothing like that here yet'); return; } close(); openSpark(s); };
    const up = inG.filter(s => phaseOf(s) === 'plan').sort(byWhen), ideas = inG.filter(s => phaseOf(s) === 'idea'), done = inG.filter(s => phaseOf(s) === 'done');
    const magic = [
      { icon: 'moon', title: 'Next up here', sub: 'The very next thing on', bg: '#1f2433', ink: '#cfc9ff', pick: pick(() => up[0]) },
      { icon: 'people', title: 'Could use a hand', sub: 'Most open helper spots', bg: '#fdf1d6', ink: '#8f6405', pick: pick(() => up.filter(s => signupFill(s).open > 0).sort((a, b) => signupFill(b).open - signupFill(a).open)[0]) },
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
      head6('How this works', backBtn6(() => go(state.howFrom || 'calendar', state.howFrom && state.email ? { profSheet: true } : {}))) +
      '<section style="padding:20px 20px 26px">' +
        '<h2 style="margin:0;font-size:28px;line-height:1.06;font-weight:900;letter-spacing:-.8px;color:#0d1117;text-wrap:pretty">Ideas come to life when we build them together</h2>' +
        '<p style="margin:12px 0 0;font-size:15.5px;line-height:1.45;font-weight:500;color:#454b55">Spark Hub is where your groups plan things. Anyone can start something, and everyone can help make it happen.</p>' +
        '<div style="margin-top:20px;display:flex;flex-direction:column;gap:16px">' +
          step(1, '#efedfd', '#4a3ad4', 'Start an event', 'Add a title and whatever you know. Date, place and details can wait. Let the group vote on them.') +
          step(2, '#fdf4e2', '#8f6405', 'RSVP &amp; pitch in', 'People RSVP, vote on dates and locations, and sign up to bring things or help out.') +
          step(3, '#e7f6ec', '#0f7a3c', 'Make it happen', 'Everyone going gets a reminder the day before. Afterwards, add photos and thank whoever helped.') +
        '</div>' +
        '<div style="height:1px;background:#eceef2;margin:22px 0"></div>' +
        '<div style="' + EYEBROW + '">Good to know</div>' +
        '<div style="margin-top:12px;display:flex;flex-direction:column;gap:12px">' +
          note(ic('<path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6l-7-2.8Z"/><path d="M9.2 12.1l2.1 2.1 3.6-3.9"/>'), 'Groups are private.', 'A group’s events are for its members and the people they invite. You join with a link or a code.') +
          note(ic('<path d="M16.6 3.8l3.6 3.6L8.4 19.2 4 20.5l1.3-4.4L16.6 3.8Z"/>'), 'Leads stay in charge.', 'People can suggest dates and locations. The lead decides what the event becomes.') +
          note(ic('<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.2 2"/>'), 'Your tasks keeps track.', 'Anything you’re leading or signed up for shows up there with what’s left to do.') +
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
  // A cancelled event stays up so people see it (owner, 2026-09-30): what happened, and for the host, Delete
  const cancelledCard = (s) => !s.cancelledAt ? '' :
    '<div data-cancelled-card style="border-radius:18px;background:#fdeef0;box-shadow:inset 0 0 0 1.5px #f5c2cb;padding:16px;display:flex;flex-direction:column;gap:6px">' +
      '<div style="font-size:17px;font-weight:900;color:#9b1c31">This ' + (s.planned ? 'event' : 'idea') + ' is cancelled</div>' +
      '<div style="font-size:14.5px;line-height:1.45;font-weight:600;color:#7a1626">' +
        (s.cancelReason ? '“' + esc(s.cancelReason) + '”' : 'It was called off.') +
        ' <span style="font-weight:600;color:#9b1c31">' + esc(ago(s.cancelledAt)) + '</span></div>' +
      (canTakeDown(s) ? '<div style="font-size:13.5px;line-height:1.4;font-weight:600;color:#7a1626">It stays up so everyone sees it. Delete it whenever you like (that tells no one).</div>' : '') +
    '</div>';
  function viewDetail(s) {
    const ph = phaseOf(s);
    const page = s.cancelledAt ? (s.planned ? viewPlan(s) : viewIdea(s))   // it didn't happen: no album or reactions
      : ph === 'plan' ? viewPlan(s) : ph === 'done' ? viewDone(s) : viewIdea(s);
    return isDemo(s) ? '<div>' + testTab() + page + '</div>' : page;
  }
  // Demo and test events: a striped yellow tab hanging from the top edge between the back and share
  // buttons, pinned while scrolling, so nobody mistakes them for real and signs up (owner's design,
  // 2026-10-01). Zero height, so it overlays and moves nothing; it reaches up behind the status bar.
  const testTab = () => '<div data-test-tab style="position:sticky;top:0;z-index:6;height:0;display:flex;justify-content:center;pointer-events:none">' +
    '<div role="note" style="display:flex;align-items:center;gap:7px;box-sizing:border-box;height:calc(38px + var(--pt));padding:var(--pt) 18px 0;border-radius:0 0 18px 18px;background:repeating-linear-gradient(135deg,#f5b729 0 9px,#f8c74e 9px 18px);color:#2a1d00;font-size:16px;font-weight:800;white-space:nowrap;box-shadow:0 6px 16px -8px rgba(13,17,23,.45)">' +
      svg(17, stroke('currentColor', 2.2), '<path d="M9 3h6M10 3v6L4.5 18.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"/><path d="M7.2 15h9.6"/>') + 'Test event</div></div>';

  // Audit 2026-10-01: the idea page uses the plan page's parts (photo header with the title on it, the
  // date & place card, Details, Help out, section titles on the gray page); only what ideas need differs:
  // "I'm interested" instead of RSVP, polls with Suggest, Who's interested, Make it a plan, the steps strip.
  function viewIdea(s) {
    const st = state, lead = isLead(s), edit = canEdit(s), off = !!s.cancelledAt, dp = dateParts(s.dayDate);
    const meIn = s.interested.indexOf(st.me) > -1, n = s.interested.length;
    const sheetCard = (inner) => '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px">' + inner + '</div>';
    const chip = (label, bgc, ink, extra) => '<span ' + (extra || '') + ' style="display:flex;align-items:center;gap:6px;border-radius:999px;padding:5px 11px;background:' + bgc + ';color:' + (ink || '#fff') + ';font-size:12px;font-weight:900;letter-spacing:.9px">' + label + '</span>';

    // I'm interested (members): the idea's version of the RSVP card
    const interest = lead || off ? '' : '<div data-interest style="' + CARD + ';padding:16px">' +
      '<button type="button" ' + on(() => { if (!st.busy) toggleInterest(s); }) + ' aria-pressed="' + meIn + '" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer;' +
        (meIn ? 'border:2px solid #e8a71c;background:#fdf1d6;color:#8f6405' : 'border:2px solid #5b4ae8;background:#5b4ae8;color:#fff') + '">' +
        I.person(16, 2.3) + (meIn ? 'You’re interested' : 'I’m interested') + '</button>' +
      // No "I could help make it happen" checkbox any more (owner, 2026-10-02); Can help chips from before still show
      '</div>';

    // Who's interested: like Who's going (the lead taps it for the list)
    const ids = (meIn ? [st.me] : []).concat(s.interested.filter(u => u !== st.me));
    const interested = '<section id="sec-people">' + secTitle('Who’s in') + sheetCard(
      '<div ' + (n ? on(() => setState({ interestList: true })) + ' aria-label="See who’s interested" ' : '') + 'style="display:flex;align-items:center;gap:10px' + (n ? ';cursor:pointer' : '') + '">' +
        '<span style="display:flex">' + (n ? peopleFaces(ids.slice(0, 5), 40, null, true) + (n > 5 ? '<span style="width:40px;height:40px;border-radius:999px;border:2.5px solid #fff;margin-left:-10px;background:#fdf1d6;color:#8f6405;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center">+' + (n - 5) + '</span>' : '')
          : lead && !off ? '<span style="font-size:14px;font-weight:600;color:#6b7280">No one yet. <span ' + on(() => setState({ share: { id: s.id, copied: false } })) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Send invites</span></span>'
          : off ? '<span style="font-size:14px;font-weight:600;color:#6b7280">Nobody was in yet.</span>'
          : '<span style="font-size:14px;font-weight:600;color:#6b7280">Nobody yet. Be the first.</span>') + '</span>' +
        (n ? '<span style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:14.5px;font-weight:800;color:#8f6405;white-space:nowrap">' + n + ' interested' + I.chevR(14, '#9aa0ac', 2.6) + '</span>' : '') + '</div>' + groupRow(s)) + '</section>';



    return '<div data-screen-label="Idea page">' +
      phaseHeader(s, 300, 'linear-gradient(to bottom, rgba(13,17,23,.5) 0%, rgba(13,17,23,0) 30%, rgba(43,36,19,.55) 62%, rgba(43,36,19,.96) 100%)',
        '<div style="position:absolute;left:20px;right:20px;bottom:20px;color:#fff;display:flex;align-items:flex-end;gap:14px"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' + (off ? chip('CANCELLED', '#d92d4a', '#fff', 'data-cancelled') : '') +
            (isDemo(s) ? chip('DEMO', 'rgba(255,255,255,.24);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)', '#fff', 'data-chip data-demo-tag') : lead && !(isTheLead(s) && s.wantsHost) ? chip(isTheLead(s) ? 'YOU’RE LEADING' : 'YOU’RE CO-LEADING', '#5b4ae8', '#fff', 'data-chip') : chip('IDEA', '#f3c55a', '#3d2a00', 'data-chip')) +
            (s.visibility === 'invite' ? chip(svg(11, stroke('#fff', 2.6), '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>') + 'PRIVATE', 'rgba(255,255,255,.22)') : '') + '</div>' +
          (edit && !off
            ? '<h1 ' + on(() => openSec(s, 'title'), 'button') + ' aria-label="' + esc(s.text) + ', edit the title" style="margin:0;font-size:36px;line-height:1;font-weight:900;letter-spacing:-1.2px;text-wrap:pretty;cursor:pointer">' + esc(s.text) + '</h1>'
            : '<h1 style="margin:0;font-size:36px;line-height:1;font-weight:900;letter-spacing:-1.2px;text-wrap:pretty">' + esc(s.text) + '</h1>') + '</div>' +
          (s.dayDate ? '<span aria-label="' + esc(fmtDay(s.dayDate)) + '" style="flex:0 0 70px;width:70px;border-radius:14px;overflow:hidden;text-align:center;background:#fff;box-shadow:0 8px 20px rgba(0,0,0,.3);transform:rotate(4deg)"><span style="display:block;background:#e8a71c;color:#fff;font-size:11.5px;font-weight:900;letter-spacing:1px;padding:3px 0">' + dp.mon + '</span><span style="display:block;font-size:32px;line-height:1.15;font-weight:900;color:#0d1117">' + dp.day + '</span><span style="display:block;padding-bottom:5px;font-size:11px;font-weight:800;color:#6b7280">' + dp.dow + '</span></span>' : '') +
        '</div>', true) +
      (off ? '' : ideaBanner(s)) +
      '<div style="padding:16px 14px 26px;display:flex;flex-direction:column;gap:18px">' +
        cancelledCard(s) +
        interest +
        // No Looking for a lead card or Just floating it? row (owner, 2026-10-01): the purple card shows what's missing,
        // to the lead, and to everyone else while it needs a lead (I'll lead)
        (off ? '' : lead ? makePlanCard(s) : s.wantsHost ? planToGo(s) : '') +
        whenWhereCard(s) +
        basicDetailsSec(s) +
        askCards(s) + helpOut(s) +
        interested +
        ledByCard(s) +
        inspoSec(s) +
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
  // tap: each face opens that person's profile (the row around it still opens the full list)
  const peopleFaces = (ids, size, ring, tap) => ids.map((u, i) => {
    const f = avatarSpan(u, nameOf(u), avatarOf(u), size, 'border:2.5px solid ' + (ring || '#fff') + ';margin-left:' + (i ? '-10px' : '0'));
    return tap ? '<span ' + on(() => openPerson(u)) + ' data-person-face aria-label="' + esc(u === state.me ? 'You' : nameOf(u)) + ', see profile" style="display:flex;cursor:pointer">' + f + '</span>' : f;
  }).join('');

  // The idea's gold strip (owner's mock, 2026-10-01): Lead · Location · Details · Date in that order, a dark check or an
  // empty ring each, joined by bars (dark once both ends are done); no Plan flag. Once it can be a plan (a lead and a
  // date), the host gets Make it a plan! in the strip itself
  const FLAG = '<path d="M5 21V4"/><path d="M5 4.5c2.5-1.5 5-1.5 7 0s4.5 1.5 7 0v9c-2.5 1.5-5 1.5-7 0s-4.5-1.5-7 0"/>';
  const ideaBanner = (s) => {
    const steps = [['Lead', !s.wantsHost], ['Location', !!s.spot], ['Details', basicsOf(s).length > 0], ['Date', dateAhead(s)]]
      .concat(MIN_PEOPLE && s.minPeople ? [['People', s.interested.length >= s.minPeople]] : []);
    const bar = (on_) => '<span aria-hidden="true" style="flex:1 1 0;max-width:42px;height:3px;margin:10px 6px 0;border-radius:999px;background:' + (on_ ? '#3d2a00' : 'rgba(61,42,0,.22)') + '"></span>';
    const step = ([label, met]) => '<div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:5px">' +
      (met ? '<span style="width:22px;height:22px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:#3d2a00">' + svg(11, stroke('#fff', 3.4), P6.check) + '</span>'
           : '<span style="width:22px;height:22px;border-radius:999px;box-shadow:inset 0 0 0 2.5px rgba(61,42,0,.4)"></span>') +
      '<span style="font-size:13px;line-height:1.1;font-weight:900;color:' + (met ? '#2a1d00' : '#8a6a1c') + ';text-align:center">' + label + '</span></div>';
    const ready = isLead(s) && !s.cancelledAt && !planMissing(s).length;
    const spark = (l, t, size, col) => '<span aria-hidden="true" style="position:absolute;left:' + l + ';top:' + t + ';font-size:' + size + 'px;line-height:1;color:' + col + '">✦</span>';
    return '<div aria-label="Steps to a plan" style="padding:14px 16px 16px;border-radius:0 0 26px 26px;background:#efc95a;box-shadow:0 6px 16px rgba(160,110,10,.18)">' +
      '<div style="display:flex;align-items:flex-start;justify-content:center">' + steps.map((x, k) => (k ? bar(x[1] && steps[k - 1][1]) : '') + step(x)).join('') + '</div>' +
      (ready ? '<button type="button" data-make-plan ' + on(() => { if (!state.busy) makePlan(s); }) + ' style="position:relative;overflow:hidden;margin-top:14px;width:100%;min-height:56px;border:0;border-radius:999px;background:#2f9a4f;box-shadow:0 8px 18px rgba(20,110,50,.28);color:#fff;font-family:inherit;font-size:18px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px">' +
        spark('7%', '22%', 12, '#ffe7a3') + spark('63%', '12%', 9, '#fff') + spark('86%', '58%', 11, '#fff') +
        svg(18, stroke('#fff', 2.3), FLAG) + 'Make it a plan!</button>' : '') +
    '</div>';
  };

  // What an idea still needs before Make it a plan! shows: all four steps (owner, 2026-10-01: it waits for all 4;
  // make_plan() itself only checks a lead and a date)
  // What an idea needs before Make it a plan!: a lead and a date (owner, 2026-10-02; from 2026-10-02 06:41 it also waited
  // for a location and details, a misreading of the strip mock). Location and Details stay in the strip as progress
  const planMissing = (s) => (s.wantsHost ? ['lead'] : []).concat(dateAhead(s) ? [] : ['date']);
  const dateAhead = (s) => !!s.dayDate && s.dayDate >= todayISO();   // an idea's date that hasn't passed
  const MISS_WORD = { lead: 'a lead', location: 'a location', details: 'details', date: 'a date' };
  const missingText = (s) => namesList(planMissing(s).map(m => MISS_WORD[m]));
  const makePlanCard = (s) => {
    return planMissing(s).length ? planToGo(s) : '';   // ready: Make it a plan! is in the gold strip (owner's mock, 2026-10-01)
  };
  // Not ready yet (owner's mock, 2026-10-01): a purple card, "N things to go", a row for each missing piece with its own
  // button (Someone to lead · I'll lead; A date · Add), and Make it a plan locked until both are done
  const planToGo = (s) => {
    const miss = planMissing(s), n = miss.length;
    const row = (icon, title, sub, cta, fn, key) => '<div data-plan-row="' + key + '" style="display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;border-radius:18px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.28)">' +
      '<span style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center">' + svg(18, stroke('#fff', 2.1), icon) + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:900;color:#fff">' + title + '</div><div style="margin-top:1px;font-size:13.5px;font-weight:600;color:rgba(255,255,255,.75)">' + sub + '</div></div>' +
      (cta ? '<button type="button" ' + on(() => { if (!state.busy) fn(); }) + ' style="flex:0 0 auto;min-height:42px;padding:0 18px;border:0;border-radius:999px;background:#fff;color:#4a3ad4;font-family:inherit;font-size:15px;font-weight:900;cursor:pointer">' + cta + '</button>' : '') + '</div>';
    // The lead row (owner, 2026-10-02): whoever was asked sees who asked; the floater, co-leads and admins see who's been
    // asked and can ask someone; someone outside the event's groups sees it needs a lead, with no button
    const askedMe = s.leadAsks.find(a => a.userId === state.me), mayAsk = canEdit(s) && !s.cancelledAt, mayLead = isTheLead(s) || inItsGroups(s);
    const homeName = (groupById(s.groupId) || {}).name;
    const leadSub = askedMe ? esc(firstName(nameOf(askedMe.by, 'Someone'))) + ' asked you'
      : mayAsk && s.leadAsks.length ? 'Asked ' + (s.leadAsks.length === 1 ? esc(firstName(nameOf(s.leadAsks[0].userId, 'someone'))) : s.leadAsks.length + ' people')
      : mayLead ? 'Could be you' : 'Open to people in ' + (homeName ? esc(homeName) : 'its group');
    const leadRow = row(P6.person, 'Someone to lead', leadSub, mayLead ? 'I’ll lead' : '', () => isTheLead(s) ? setWantsHost(s, false) : takeTheLead(s), 'lead') +
      (mayAsk ? '<span ' + on(() => openLeadAsk(s)) + ' data-ask-lead style="align-self:flex-start;margin-top:-4px;display:flex;align-items:center;gap:7px;min-height:40px;padding:0 6px;font-size:14.5px;font-weight:800;color:#fff;cursor:pointer">' + I.plus(14, '#ffd166', 2.8) + 'Ask someone to lead</span>' : '');
    return '<div data-plan-needs style="position:relative;overflow:hidden;padding:20px 16px 16px;border-radius:24px;background:linear-gradient(160deg,#4433cc,#6a5cf0);box-shadow:0 10px 26px rgba(74,58,212,.3);display:flex;flex-direction:column;gap:12px">' +
      '<span aria-hidden="true" style="position:absolute;right:28px;top:22px;font-size:20px;color:#ffd166">✦</span><span aria-hidden="true" style="position:absolute;right:120px;top:78px;font-size:9px;color:#fff;opacity:.8">✦</span><span aria-hidden="true" style="position:absolute;right:14px;top:120px;font-size:10px;color:#fff;opacity:.8">✦</span>' +
      '<div><div style="font-size:12.5px;font-weight:900;letter-spacing:1.2px;color:#ffd166">THIS COULD REALLY HAPPEN</div>' +
        '<div style="margin-top:2px;font-size:28px;line-height:1.1;font-weight:900;letter-spacing:-.6px;color:#fff">' + (n === 1 ? '1 thing to go' : n + ' things to go') + '</div></div>' +
      (miss.indexOf('lead') > -1 ? leadRow : '') +
      (miss.indexOf('location') > -1 ? (isLead(s) ? row(P6.pin, 'A location', s.spotOpts.length ? 'Pick from the votes' : 'Where it happens', s.spotOpts.length ? 'Pick' : 'Add', () => s.spotOpts.length ? openToSection(s, 'sec-when') : openSec(s, 'when'), 'location')
        : row(P6.pin, 'A location', 'Suggest one', 'Suggest', () => openOffer(s, 'spot'), 'location')) : '') +
      (miss.indexOf('details') > -1 && isLead(s) ? row(P6.roles, 'Details', 'A line on what to expect', 'Add', () => openSec(s, 'details'), 'details') : '') +
      (miss.indexOf('date') > -1 ? (isLead(s) ? row(P6.cal, s.dayDate ? 'A new date' : 'A date', s.dayDate ? monthDay(s.dayDate) + ' has passed' : s.dateOpts.length ? 'Pick from the votes' : 'Pick one or run a poll', s.dateOpts.length ? 'Pick' : s.dayDate ? 'Change' : 'Add', () => s.dateOpts.length ? openToSection(s, 'sec-when') : openSec(s, 'when'), 'date')
        : row(P6.cal, 'A date', s.dateOpts.length ? 'Vote, or suggest another' : 'Suggest one', 'Suggest', () => openOffer(s, 'day'), 'date')) : '') +
      '<button type="button" aria-disabled="true" style="margin-top:4px;min-height:56px;border:0;border-radius:999px;background:rgba(255,255,255,.16);color:rgba(255,255,255,.62);font-family:inherit;font-size:17px;font-weight:900;cursor:not-allowed;display:flex;align-items:center;justify-content:center;gap:10px">' +
        svg(18, stroke('rgba(255,255,255,.62)', 2.2), FLAG) + 'Make it a plan</button>' +
      '<div style="text-align:center;font-size:13.5px;font-weight:700;color:rgba(255,255,255,.75)">' + (n === 1 ? 'Unlocks when that’s done' : n === 2 ? 'Unlocks when both are done' : 'Unlocks when all ' + n + ' are done') + '</div></div>';
  };

  // A photo header shared by the plan and "happened" pages
  const ROUND_BTN = 'flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(13,17,23,.25);display:flex;align-items:center;justify-content:center;cursor:pointer';
  const phaseHeader = (s, height, scrim, inner, share) => {
    const g = groupById(s.groupId), cover = s.photoPaths[0] ? photoUrl(s.photoPaths[0]) : null;
    return '<div style="position:relative;height:calc(' + height + 'px + var(--pt));overflow:hidden;background:#0b2a17">' +
      (cover ? photoLayer(cover, s.coverPos, IDEA_POS) : '<div aria-hidden="true" style="position:absolute;inset:0;background:' + groupBg(g, '#0b2a17') + '"></div>') +
      '<div aria-hidden="true" style="position:absolute;inset:0;background:' + scrim + '"></div>' +
      '<div style="position:absolute;top:calc(12px + var(--pt));left:12px;right:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;z-index:1">' +
        backBtn(s) +
        '<span style="flex:1"></span>' +
        // Owner, 2026-10-01: one round pencil (matching Share) opens Edit event: the title, and the cover photo for the host.
        // Round, so the Test event tab between the buttons stays clear on demo/test events
        (canEdit(s) && !s.cancelledAt ? '<span ' + on(() => openSec(s, 'title')) + ' aria-label="' + (s.planned ? 'Edit event' : 'Edit idea') + '" class="hov-fill-grey" style="' + ROUND_BTN + '">' + svg(18, stroke('#0d1117', 2.4), PENCIL) + '</span>'
          : share ? '' : '<span style="flex:0 0 44px;width:44px"></span>') +
        (share && !s.cancelledAt ? '<span ' + on(() => setState({ share: { id: s.id, copied: false } })) + ' aria-label="Share" class="hov-fill-grey" style="' + ROUND_BTN + '">' + svg(18, stroke('#0d1117', 2.4), P5.share) + '</span>' : '') +
      '</div>' + inner +
      // (No chip over the photo after an action, owner 2026-10-01: the page already shows what changed)
    '</div>';
  };

  // v6 Update 5 (Plan phase): a section title sits on the gray page above its white card
  const secTitle = (t, right, big) => '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 4px;margin-bottom:8px">' +
    '<h2 style="margin:0;font-size:' + (big ? '24px;line-height:1.1;letter-spacing:-.6px' : '17px;line-height:1.2;letter-spacing:-.3px') + ';font-weight:900;color:#0d1117">' + t + '</h2>' + (right || '') + '</div>';
  const P5 = {
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    share: '<path d="M12 3.5v11M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>'
  };
  const directionsUrl = (s) => 'https://www.google.com/maps/dir/?api=1&destination=' + (s.spotPoint ? s.spotPoint[0] + ',' + s.spotPoint[1] : encodeURIComponent(s.spotAddress || s.spot));

  // Help out: one white card per job. Sign up is one tap (a shift job opens Pick a shift).
  function helpOut(s) {
    const st = state, lead = isLead(s), jobs = s.jobs || s.signups, sigReady = st.sigDraft.trim().length > 0;
    const card = (j) => {
      const shifts = !!j.shifts, mine = shifts ? myShiftIds(j).length > 0 : j.claims.some(c => c.userId === st.me);
      const cnt = j.claims.length, need = j.need, full = !mine && !!need && (shifts ? j.shifts.every(u => u.need && u.claims.length >= u.need) : cnt >= need);
      // The owner's mock (2026-10-01): title with an ⓘ for the description and the button on the right; one gray line
      // (the time, or "N shifts"); then the faces, the bar and n/need
      const when = shifts ? j.shifts.length + ' shifts' : jobTime(j);
      const added = !lead && j.createdBy === st.me && !shifts;
      const subline = [when, added ? 'You added this' : '', !need && cnt ? cnt + ' in' : ''].filter(Boolean).join(' · ');
      // The bar: lavender while empty, gold once you're in, green when others have signed up, gray when it's full
      const [fill, track] = mine ? ['#e3b84e', '#f8efd5'] : full ? ['#9aa0ac', '#9aa0ac'] : cnt ? ['#5a9c6e', '#dff0e4'] : ['#5b4ae8', '#ebe8fd'];
      const act = () => { if (st.busy) return; if (shifts) openShifts(s, j); else toggleClaim(s, j); };
      const pill = 'flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:0 18px;border-radius:999px;font-size:15px;font-weight:800;white-space:nowrap;';
      const btn = s.cancelledAt ? '' : mine
        ? '<span ' + on(act) + ' aria-label="You’re in. Tap to take yourself off" style="' + pill + 'background:#e3b84e;color:#3d2a00;cursor:pointer">' + svg(14, stroke('#3d2a00', 3), P6.check) + 'You’re in</span>'
        : full ? '<span aria-disabled="true" style="' + pill + 'box-shadow:inset 0 0 0 2px #d5d8df;color:#9aa0ac">Full</span>'
        : '<span ' + on(act) + ' style="' + pill + 'box-shadow:inset 0 0 0 2px #5b4ae8;color:#5b4ae8;cursor:pointer">Sign up</span>';
      // ⓘ opens the job's description
      const open = !!st.descOpen[j.id];
      const info = !j.desc ? '' : '<span ' + on(() => setState({ descOpen: Object.assign({}, st.descOpen, { [j.id]: !open }) })) + ' aria-label="Details" aria-expanded="' + open + '" style="flex:0 0 26px;width:26px;height:26px;margin-left:8px;border-radius:999px;box-shadow:inset 0 0 0 2px ' + (open ? '#5b4ae8' : '#c9ccd3') + ';color:' + (open ? '#5b4ae8' : '#9aa0ac') + ';display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-style:italic;font-size:15px;font-weight:700;cursor:pointer;vertical-align:3px">i</span>';
      const desc = j.desc && open ? '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">' + esc(j.desc) + '</p>' : '';
      // Who's in: two faces then +N (yours first, ringed in gold); the host also sees each person with their shift and note
      const ppl = shifts ? [].concat(...j.shifts.map(u => u.claims.map(c => Object.assign({ at: spanTime(u) }, c)))) : j.claims;
      const uniq = ppl.map(c => c.userId).filter((u, i, a) => a.indexOf(u) === i).sort((a, b) => (b === st.me) - (a === st.me));
      const names = uniq.map(u => u === st.me ? 'You' : firstName(personName(s, u)));
      const shown = uniq.length > 3 ? uniq.slice(0, 2) : uniq;
      const faces = !uniq.length ? '' : '<span' + (lead ? '' : ' data-who') + ' style="flex:0 0 auto;display:flex;align-items:center">' +
        shown.map((u, k) => '<span style="display:flex;border-radius:999px;' + (k ? 'margin-left:-8px;' : '') + 'box-shadow:0 0 0 2.5px ' + (u === st.me ? '#e3b84e' : '#fff') + '">' + face(u, personName(s, u), 32) + '</span>').join('') +
        (uniq.length > shown.length ? '<span style="margin-left:-8px;flex:0 0 32px;width:32px;height:32px;border-radius:999px;background:#eceef1;box-shadow:0 0 0 2.5px #fff;color:#454b55;font-size:12.5px;font-weight:900;display:flex;align-items:center;justify-content:center">+' + (uniq.length - shown.length) + '</span>' : '') +
        '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">' + esc(namesList(names)) + '</span></span>';
      const bar = !need && !faces ? '' : '<div style="display:flex;align-items:center;gap:14px">' + faces +
        (need ? '<div aria-hidden="true" style="flex:1;min-width:0;height:8px;border-radius:999px;background:' + track + ';overflow:hidden"><span style="display:block;height:100%;width:' + Math.round(Math.min(cnt, need) / need * 100) + '%;border-radius:999px;background:' + fill + '"></span></div>' +
          '<span style="flex:0 0 auto;font-size:15px;font-weight:900;color:#0d1117">' + Math.min(cnt, need) + '/' + need + '</span>' : '') + '</div>';
      const hostList = !ppl.length || !lead ? '' : '<div data-who style="display:flex;flex-direction:column;gap:8px">' + ppl.map(c =>
        '<div style="display:flex;align-items:flex-start;gap:10px">' + face(c.userId, personName(s, c.userId), 26, null, 'margin-top:1px') +
          '<div style="flex:1;min-width:0"><div style="font-size:14.5px;line-height:1.35;font-weight:800;color:#0d1117">' + esc(c.userId === st.me ? 'You' : personName(s, c.userId)) +
            (c.at ? '<span style="font-weight:700;color:#6b7280"> · ' + esc(c.at) + '</span>' : '') + '</div>' +
            (c.note ? '<div style="margin-top:1px;font-size:13.5px;line-height:1.4;font-weight:500;color:#5c6270">“' + esc(c.note) + '”</div>' : '') + '</div></div>').join('') + '</div>';
      return '<div data-signup="' + esc(j.item) + '" style="' + CARD + ';border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:14px">' +
        '<div style="display:flex;align-items:flex-start;gap:12px">' +
          '<div style="flex:1;min-width:0"><div style="font-size:18px;line-height:1.3;font-weight:900;letter-spacing:-.3px;color:#0d1117;text-wrap:pretty">' + esc(j.item) + info + '</div>' +
            (subline ? '<div style="margin-top:3px;font-size:14.5px;font-weight:700;color:#6b7280">' + esc(subline) +
              (added ? ' · <span ' + on(() => removeSignup(s, j)) + ' aria-label="Remove ' + esc(j.item) + '" style="color:#9b1c31;cursor:pointer">Remove</span>' : '') + '</div>' : '') + '</div>' +
          btn + '</div>' + bar + desc + hostList + (lead && !shifts && !s.cancelledAt && phaseOf(s) !== 'done' ? jobAskLine(s, j) : '') + '</div>';
    };
    const addLabel = lead ? 'Add a job or item' : 'Add something else';
    const adder = !st.sigAdding
      ? '<div ' + on(() => setState({ sigAdding: true })) + ' data-add-signup style="display:flex;align-items:center;justify-content:center;gap:8px;min-height:60px;padding:0 16px;border-radius:20px;border:2px dashed #e3c06a;background:#fdf8ea;font-size:15.5px;font-weight:800;color:#8f6405;cursor:pointer">' + I.plus(16, '#8f6405', 2.8) + addLabel + '</div>'
      : '<div style="' + CARD + ';padding:14px 16px;display:flex;flex-direction:column;gap:10px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:15px;font-weight:800;color:#0d1117">' + addLabel + '</span>' +
            '<span ' + on(() => setState({ sigAdding: false, sigDraft: '', sigNeed: '', sigTime: '' })) + ' aria-label="Cancel" style="width:28px;height:28px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(11, '#5c6270', 2.6) + '</span></div>' +
          '<div style="display:flex;gap:8px">' +
            '<input class="fld" type="text" maxlength="60" data-autofocus aria-label="' + (lead ? 'Add a sign-up' : 'Bringing something else?') + '" placeholder="' + (lead ? 'Add a thing, e.g. A dozen filled eggs' : 'Bringing something else?') + '" value="' + esc(st.sigDraft) + '" ' + onInput(e => { if (e.type === 'input') setState({ sigDraft: e.target.value.slice(0, 60) }); }) + ' style="flex:1 1 auto;min-width:0;min-height:46px;border:1.5px solid #dcdfe6;border-radius:14px;padding:10px 14px;font-family:inherit;font-size:16px;font-weight:600;color:#0d1117;background:#fff;outline:none">' +
            (lead ? '<input class="fld" type="text" inputmode="numeric" maxlength="3" aria-label="How many needed" placeholder="How many" value="' + esc(st.sigNeed) + '" ' + onInput(e => { if (e.type === 'input') setState({ sigNeed: e.target.value.replace(/\D/g, '').slice(0, 3) }); }) + ' style="flex:0 0 74px;width:74px;min-height:46px;border:1.5px solid #dcdfe6;border-radius:14px;padding:10px 8px;text-align:center;font-family:inherit;font-size:16px;font-weight:600;color:#0d1117;background:#fff;outline:none">' : '') +
            '<button type="button" ' + on(() => addSignup(s)) + ' aria-disabled="' + !sigReady + '" style="flex:0 0 auto;min-height:46px;padding:0 16px;border:0;border-radius:999px;font-family:inherit;font-size:15px;font-weight:800;cursor:' + (sigReady ? 'pointer' : 'default') + ';background:' + (sigReady ? '#5b4ae8' : '#e2e4e9') + ';color:' + (sigReady ? '#fff' : '#9aa0ac') + '">Add</button>' +
          '</div>' +
          (lead && st.sigDraft
            ? '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#6b7280">Time (optional)' +
                '<select class="fld" aria-label="Sign-up time" ' + onInput(e => setState({ sigTime: e.target.value })) + ' style="min-height:38px;padding:0 10px;border:1.5px solid #dcdfe6;border-radius:12px;font-family:inherit;font-size:16px;font-weight:700;color:#0d1117;background:#fff;outline:none;color-scheme:light">' +
                  '<option value="">No time</option>' + TIME_OPTS.map(([v, l]) => '<option value="' + v + '"' + (v === st.sigTime ? ' selected' : '') + '>' + l + '</option>').join('') +
                '</select></label>'
            : '') +
        '</div>';
    const editBtn = lead && !s.cancelledAt ? '<span ' + on(() => openNeeds(s)) + ' aria-label="Edit what you need" style="flex:0 0 auto;display:flex;align-items:center;gap:5px;min-height:36px;padding:0 2px;color:#6b7280;font-size:14px;font-weight:700;cursor:pointer">' + svg(13, stroke('currentColor', 2.4), PENCIL) + 'Edit</span>' : '';
    return '<section id="sec-tasks" data-screen-label="Help out">' + secTitle('Help out', editBtn, true) +
      '<div style="display:flex;flex-direction:column;gap:12px">' +
        // Empty, for the lead: the same dashed box as an empty Details (owner, 2026-10-01)
        (jobs.length ? jobs.map(card).join('') : s.cancelledAt
          ? '<div style="' + CARD + ';padding:16px;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">Nothing was on the list.</div>'
          : lead
          ? '<div ' + on(() => openNeeds(s)) + ' data-help-empty style="padding:14px 16px;border-radius:18px;border:1.5px dashed #c9ccd3;font-size:14.5px;font-weight:700;color:#6b7280;cursor:pointer">Add ways people can help.</div>'
          : '<div style="' + CARD + ';padding:16px;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">Nothing on the list yet. Bringing something? Add it below.</div>') +
        (lead || s.cancelledAt ? '' : adder) + '</div></section>';
  }

  // ---- v6 Update 6: the host edits one section at a time in a small sheet (the full-screen editor is retired)
  const openSec = (s, kind) => {
    const bits = basicsOf(s).slice(0, 3).map(b => b.slice(0, 60));
    while (bits.length < 3) bits.push('');
    setState({ sec: { id: s.id, kind, title: s.text, d: s.dayDate || '', t: s.dayTime || '', e: s.dayEnd || '', bits, need: s.minPeople || null, tags: (s.tags || []).slice(), priv: s.visibility === 'invite', guestInv: s.guestInvites !== false, groups: gIds(s).slice() },
      offerText: kind === 'when' ? s.spot || '' : '', offerPlace: s.spot && s.spotPoint ? { name: s.spot, address: s.spotAddress, lat: s.spotPoint[0], lon: s.spotPoint[1] } : null, offerSuggest: [], timeOpen: null, menu: null });
  };
  // Round 65a: what an edit tells people. A new date, time or place always goes out; a new title never does
  // (owner, 2026-10-01: Edit event has no Tell everyone going switch); new
  // Basic details only when the host turns on Tell everyone going; Who can see it tells no one.
  const secMessage = (s, ss) => {
    if (ss.kind === 'title') return '';   // renaming saves quietly
    if (ss.kind === 'details') {
      const was = s.hopes || [], hopes = ss.bits.map(b => b.trim().slice(0, 60)).filter(Boolean);
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
  // Who an update reaches (audience "all"): everyone who RSVP’d or signed up, but you
  const updateReach = (s) => {
    const ids = new Set();
    s.rsvps.forEach(r => ids.add(r.userId)); s.signups.forEach(it => it.claims.forEach(c => ids.add(c.userId)));
    ids.delete(state.me);
    const g = s.rsvps.filter(r => r.status === 'going' && r.userId !== state.me).length, m = s.rsvps.filter(r => r.status === 'maybe' && r.userId !== state.me).length;
    const text = !ids.size ? '' : ids.size === g + m
      ? 'Goes to ' + [g ? (g === 1 ? 'the 1 person going' : 'the ' + g + ' people going') : '', m ? (m === 1 ? 'the 1 maybe' : 'the ' + m + ' maybes') : ''].filter(Boolean).join(' and ') + '.'
      : 'Goes to the ' + ids.size + (ids.size === 1 ? ' person who RSVP’d or signed up.' : ' people who RSVP’d or signed up.');
    return { n: ids.size, text };
  };
  const secSends = (s, ss) => isLead(s) && s.planned && !!secMessage(s, ss) && updateReach(s).n > 0 && (ss.kind === 'when' || !!ss.tell);
  const sendUpdate = async (s, body) => must(await sb.from('plan_updates').insert({ spark_id: s.id, body: body.slice(0, 320), audience: 'all' }));

  const sentNote = (s) => isDemo(s) ? 'Saved. Test events don’t send phone notifications.' : 'Saved. Everyone going gets an update.';
  const saveSec = (s) => {
    const ss = state.sec, lead = isLead(s), msg = secMessage(s, ss), send = secSends(s, ss);
    if (!ss || state.busy) return;
    let note = 'Saved';
    if (ss.kind === 'title') {
      const text = cleanTitle(ss.title).slice(0, 40);
      if (!text) return;
      run(async () => {
        if (lead) { if (text !== s.text) must(await sb.from('sparks').update({ text }).eq('id', s.id)); }
        else must(await sb.rpc('admin_edit_spark', { p_spark: s.id, p_text: text, p_hopes: s.hopes }));
        if (send) await sendUpdate(s, msg);
      }, { sec: null }).then(ok => { if (ok) toast(send ? sentNote(s) : note, true); });
      return;
    }
    if (ss.kind === 'details') {
      const hopes = ss.bits.map(b => b.trim().slice(0, 60)).filter(Boolean);
      run(async () => {
        if (lead) must(await sb.from('sparks').update(Object.assign({ hopes, vision: null, tags: (ss.tags || []).slice(0, 2) }, s.planned ? {} : { min_people: ss.need || null })).eq('id', s.id));
        else must(await sb.rpc('admin_edit_spark', { p_spark: s.id, p_text: s.text, p_hopes: hopes }));
        if (send) await sendUpdate(s, msg);
      }, { sec: null }).then(ok => { if (ok) toast(send ? sentNote(s) : note, true); });
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
        if (isLead(s) && (ss.guestInv !== false) !== (s.guestInvites !== false)) must(await sb.from('sparks').update({ guest_invites: ss.guestInv !== false }).eq('id', s.id));
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
    }, { sec: null, offerText: '', offerPlace: null, offerSuggest: [] }).then(ok => { if (ok) toast(tell ? sentNote(s) : note, true); });
  };
  // Change photo on the event's header: the new cover goes up straight away
  // The host picks a poll's winner: it becomes the date (or place) and the poll closes
  // The host picks a poll's winner: confirm first (it closes the poll), then tell everyone, like a new date or place from the sheet
  const pickOpt = (s, kind, o) => {
    if (kind === 'day' && o.dayDate < todayISO()) { toast('That date has passed. Pick another, or set a new date.'); return; }
    const day = kind === 'day', label = day ? dayLabel(o.dayDate, o.dayTime) : o.name, reach = updateReach(s), send = s.planned && reach.n > 0;
    const msg = day ? 'New date: ' + label : 'New location: ' + label;
    setState({ confirm: { title: 'Pick ' + label + '?', cta: day ? 'Use this date' : 'Use this location', keep: 'Not yet',
      body: 'This closes the poll and clears its votes.' + (send ? ' ' + reach.text.replace(/^Goes to/, 'An update goes to') : ''),
      run: () => run(async () => {
        if (day) {
          must(await sb.from('sparks').update({ day_date: o.dayDate, day_time: o.dayTime, day_end: null }).eq('id', s.id));
          must(await sb.from('date_options').delete().eq('spark_id', s.id));
        } else {
          must(await sb.from('sparks').update({ spot: o.name, spot_open: false, spot_address: o.address || null, spot_lat: o.lat, spot_lon: o.lon }).eq('id', s.id));
          must(await sb.from('spot_options').delete().eq('spark_id', s.id));
        }
        if (send) await sendUpdate(s, msg);
      }, { confirm: null }).then(ok => { if (ok) toast(send ? (isDemo(s) ? 'Picked. Test events don’t send phone notifications.' : 'Picked. Everyone gets an update.') : 'Picked ' + label, true); }) } });
  };

  // Edit what you need: every job editable in place (nothing opens on top)
  // `known`: the jobs and shifts on screen when it opened. Save only removes those, so a job or shift that
  // arrived later (the sheet opened on cached data, or someone added one meanwhile) is never taken down.
  const openNeeds = (s) => setState({ needEd: { id: s.id, known: [].concat(...(s.jobs || []).map(j => [j.id].concat((j.shifts || []).map(u => u.id)))), rows: (s.jobs || []).map(j => j.shifts
    ? { id: j.id, item: j.item, desc: j.desc, n: j.claims.length, shifts: j.shifts.map(u => ({ id: u.id, time: u.time || '', end: u.endTime || '', need: u.need || null, n: u.claims.length })) }
    : { id: j.id, item: j.item, desc: j.desc, n: j.claims.length, time: j.time || '', end: j.endTime || '', need: j.need || null, shifts: null }) } });
  const saveNeeds = (s) => {
    const ed = state.needEd;
    if (!ed || state.busy) return;
    const orig = s.jobs || [], known = (id) => (ed.known || []).indexOf(id) > -1;
    // Someone signed up since it opened: switching that job between one time and shifts would drop them
    const flips = ed.rows.filter(r => r.id).filter(r => { const o = orig.find(j => j.id === r.id); return o && o.claims.length && !!o.shifts !== (r.shifts || []).some(q => q.time); });
    if (flips.length) { toast('Someone just signed up for “' + cleanTitle(flips[0].item) + '”, so it can’t switch between one time and shifts. Close and open it again.'); return; }
    const kept0 = ed.rows.filter(r => r.id).map(r => r.id), goneJobs = orig.filter(j => kept0.indexOf(j.id) < 0 && known(j.id));
    const off = new Set([].concat(...goneJobs.map(j => [].concat(...(j.shifts || [j]).map(u => u.claims.map(c => c.userId))))).filter(u => u !== state.me)).size;
    if (off && !ed.sure) {
      setState({ confirm: { title: goneJobs.length === 1 ? 'Remove “' + goneJobs[0].item + '”?' : 'Remove ' + goneJobs.length + ' jobs?', danger: true, cta: 'Remove and save', keep: 'Go back',
        body: (off === 1 ? 'The 1 person signed up gets' : 'The ' + off + ' people signed up get') + ' a note that it’s off the list.',
        run: () => { setState({ confirm: null, needEd: Object.assign({}, state.needEd, { sure: true }) }); saveNeeds(s); } } });
      return;
    }
    run(async () => {
      const keep = ed.rows.filter(r => r.id).map(r => r.id), gone = orig.filter(j => keep.indexOf(j.id) < 0 && known(j.id)).map(j => j.id);
      for (const id of gone) must(await sb.rpc('remove_signup', { p_item: id }));   // tells the people signed up
      for (const r of ed.rows) {
        const item = cleanTitle(r.item).slice(0, 60), descr = (r.desc || '').trim().slice(0, 400) || null;
        if (!item) continue;
        if (!r.id) { await insertJob(s.id, r); continue; }
        const o = orig.find(j => j.id === r.id);
        if (!o) continue;   // taken down since the sheet opened
        const shifts = (r.shifts || []).filter(q => q.time), oldShifts = (o.shifts || []).map(u => u.id).filter(known);
        if (!shifts.length) {
          must(await sb.from('signup_items').update({ item, descr, time: r.time || null, end_time: r.time && r.end && r.end > r.time ? r.end : null, need: r.need || null }).eq('id', r.id));
          for (const id of oldShifts) must(await sb.rpc('remove_signup', { p_item: id }));   // tells anyone signed up
          continue;
        }
        must(await sb.from('signup_items').update({ item, descr, time: null, end_time: null, need: null }).eq('id', r.id));
        const kept = shifts.filter(q => q.id).map(q => q.id), dropped = oldShifts.filter(id => kept.indexOf(id) < 0);
        for (const id of dropped) must(await sb.rpc('remove_signup', { p_item: id }));   // tells the people on that shift
        for (const q of shifts) {
          const row = { item, time: q.time, end_time: q.end && q.end > q.time ? q.end : null, need: q.need || null };
          if (q.id) must(await sb.from('signup_items').update(row).eq('id', q.id));
          else must(await sb.from('signup_items').insert(Object.assign({ spark_id: s.id, shift_of: r.id }, row)));
        }
      }
    }, { needEd: null }).then(ok => { if (ok) toast('Saved', true); });
  };

  // The switch (Basic details) and the exact message people get (Round 65a)
  // v6 Update 13: the lead decides whether guests can invite their friends (Who can see it, Create event)
  const guestInvSwitch = (v, fn) => '<div ' + on(fn, 'switch') + ' aria-checked="' + v + '" aria-label="People going can invite friends" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#f4f5f7;cursor:pointer">' +
    '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">People going can invite friends</div><div style="font-size:12.5px;font-weight:600;color:#6b7280">' + (v ? 'On: they can pick friends and group members to invite' : 'Off: only leads and admins pick who to invite. Anyone can still share the link.') + '</div></div>' +
    '<span aria-hidden="true" style="flex:0 0 46px;width:46px;height:28px;border-radius:999px;position:relative;transition:background 160ms;background:' + (v ? '#149a4b' : '#dcdfe6') + '"><span style="position:absolute;top:3px;left:' + (v ? 21 : 3) + 'px;width:22px;height:22px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left 160ms"></span></span></div>';
  const secTell = (s, ss) => {
    if (!isLead(s) || !s.planned || ss.kind === 'vis' || ss.kind === 'title') return '';
    const reach = updateReach(s), msg = secMessage(s, ss), quiet = ss.kind === 'details', v = !!ss.tell;
    const sw = quiet && reach.n ? '<div ' + on(() => setState({ sec: Object.assign({}, state.sec, { tell: !v }) }), 'switch') + ' aria-checked="' + v + '" aria-label="Tell everyone going" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#f4f5f7;cursor:pointer">' +
      '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">Tell everyone going</div><div style="font-size:12.5px;font-weight:600;color:#6b7280">' + (v ? 'On: they get an update when you save' : 'Off: it saves quietly') + '</div></div>' +
      '<span aria-hidden="true" style="flex:0 0 46px;width:46px;height:28px;border-radius:999px;position:relative;transition:background 160ms;background:' + (v ? '#149a4b' : '#dcdfe6') + '"><span style="position:absolute;top:3px;left:' + (v ? 21 : 3) + 'px;width:22px;height:22px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left 160ms"></span></span></div>' : '';
    const preview = secSends(s, ss) ? '<div data-update-preview style="display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:16px;background:#f7f6ff;box-shadow:inset 0 0 0 1.5px #dcd6fb">' +
      '<span style="font-size:11px;font-weight:900;letter-spacing:1px;color:#4a3ad4">WHAT THEY GET</span>' +
      '<span style="font-size:14.5px;line-height:1.4;font-weight:700;color:#2a1f8f">' + esc(msg) + '</span>' +
      '<span style="font-size:13px;line-height:1.4;font-weight:600;color:#6b7280">' + esc(reach.text) + '</span></div>' : '';
    return sw + preview;
  };

  // The photo comes off; the event shows its group's photo again. The file goes too when it's in your own folder
  const removeCover = (s) => run(async () => {
    const old = must(await sb.rpc('remove_idea_cover', { p_spark: s.id })).data;
    if (old) deletePhotos([old]);
  }).then(ok => { if (ok) toast('Photo removed', true); });
  const PHOTO_BTN = 'flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;border-radius:999px;background:#f1effe;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer';
  function viewSecSheet() {
    const ss = state.sec, s = state.sparks.find(x => x.id === ss.id);
    if (!s) return '';
    const close = () => setState({ sec: null, offerText: '', offerPlace: null, offerSuggest: [], timeOpen: null });
    const set = (patch) => setState({ sec: Object.assign({}, state.sec, patch) });
    const label = (t) => '<span style="font-size:12px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#6b7280">' + esc(t) + '</span>';
    const what = s.planned ? 'event' : 'idea';   // an idea's pop-ups say idea (owner, 2026-10-02)
    const title = { title: 'Edit ' + what, when: 'Date, time & location', details: 'Details', vis: 'Who can see it' }[ss.kind];
    let body = '', ok = true;
    if (ss.kind === 'title') {
      const cur = s.photoPaths[0] ? photoUrl(s.photoPaths[0]) : null;
      ok = !!cleanTitle(ss.title);
      body = '<div style="display:flex;flex-direction:column;gap:8px">' + label(s.planned ? 'Event title' : 'Idea title') +
        '<input class="fld big-fld" type="text" maxlength="40" aria-label="' + (s.planned ? 'Event title' : 'Idea title') + '" placeholder="Name your ' + what + '" value="' + esc(ss.title) + '" ' + onInput(e => { if (e.type === 'input') set({ title: e.target.value.slice(0, 40) }); }) + ' style="' + BIG + '"></div>' +
        // The photo (host only): Adjust re-frames the current one, Replace / Add a photo pick a new one. Both open the
        // positioner on top of this pop-up and save straight away, so a title being edited here stays as typed
        (isLead(s) ? '<div data-edit-photo style="display:flex;flex-direction:column;gap:8px">' + label('Photo') +
          '<div aria-hidden="true" style="position:relative;height:150px;border-radius:16px;overflow:hidden;background:' + (cur ? '#2b303a' : EV_GRAD) + '">' +
            (cur ? photoLayer(cur, s.coverPos, IDEA_POS) : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:rgba(255,255,255,.8)">No photo yet</div>') + '</div>' +
          '<div style="display:flex;gap:8px">' +
            (cur ? '<span ' + on(() => openPositioner({ kind: 'idea', id: s.id, url: cur, pos: s.coverPos })) + ' style="' + PHOTO_BTN + '">' + svg(16, stroke('currentColor', 2.2), '<path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"/>') + 'Adjust</span>' : '') +
            '<label style="' + PHOTO_BTN + '">' + svg(16, stroke('currentColor', 2.2), CAMERA) + (cur ? 'Replace' : 'Add a photo') +
              '<input type="file" accept="image/*" aria-label="' + (cur ? 'Replace the cover photo' : 'Add a cover photo') + '" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; pickForPositioner(f, { kind: 'idea', id: s.id }); }) + ' style="display:none"></label>' +
            (cur ? '<span ' + on(() => { if (!state.busy) removeCover(s); }) + ' aria-label="Remove the cover photo" style="' + PHOTO_BTN + ';flex:0 0 auto;padding:0 16px;background:#fdecee;color:#9b1c31">Remove</span>' : '') +
          '</div></div>' : '');
    } else if (ss.kind === 'when') {
      body = '<div style="display:flex;flex-direction:column;gap:8px">' + label('Date & time') +
        '<div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:8px">' + dateField(ss.d, 'Date', 'Pick a date', (v) => set({ d: v }), '', phaseOf(s) === 'done') +
          timeField('secT', ss.t, EV_TIMES, 'Time', (v) => setState({ sec: Object.assign({}, state.sec, { t: v, e: ss.e && ss.e <= v ? '' : ss.e }), timeOpen: null })) + '</div>' +
        // The end time is a small "+ Add end time" link until it's asked for, as on Create event (owner, 2026-10-02)
        (ss.t && (ss.e || ss.eOn)
          ? '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0">' + timeField('secE', ss.e, EV_TIMES.filter(v => v > ss.t), 'Add an end time', (v) => setState({ sec: Object.assign({}, state.sec, { e: v }), timeOpen: null })) + '</div>' +
              '<span ' + on(() => setState({ sec: Object.assign({}, state.sec, { e: '', eOn: false }), timeOpen: null })) + ' aria-label="Remove end time" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#f1f2f5;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(12, '#6b7280', 2.8) + '</span></div>'
          : ss.t ? '<span ' + on(() => setState({ sec: Object.assign({}, state.sec, { eOn: true }), timeOpen: 'secE' })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:40px;padding:0 4px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(14, 'currentColor', 2.6) + 'Add end time</span>' : '') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' + label('Location') + placeField('offer', { placeholder: 'Search a place or address', style: BIG }) + '</div>' +
        // A plan keeps its date; taking it off turns the plan back into an idea (the host's call, with a confirm)
        (s.planned && isLead(s) ? (ss.d ? '' : '<span data-needs-date style="font-size:13.5px;line-height:1.4;font-weight:600;color:' + AMBER_INK + '">A plan needs a date. To take it off, turn it back into an idea.</span>') +
          (phaseOf(s) === 'done' ? '' : '<span ' + on(() => { close(); clearPlan(s); }) + ' data-back-to-idea style="align-self:center;display:flex;align-items:center;min-height:44px;padding:0 12px;font-size:14.5px;font-weight:800;color:#9b1c31;cursor:pointer">Turn it back into an idea</span>') : '');
      ok = !(s.planned && !ss.d);
    } else if (ss.kind === 'details') {
      body = '<div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:14px;line-height:1.4;font-weight:500;color:#5c6270">Up to three quick notes on what to expect or the vibe.</span>' +
        bitRows(ss.bits, (k, v) => { const b = state.sec.bits.slice(); b[k] = v; set({ bits: b }); }) +
        (!s.planned && isLead(s) ? needRow(ss.need, (n) => set({ need: n })) : '') + '</div>';
    } else {
      const tile = (priv, name, sub) => { const onIt = ss.priv === priv;
        return '<div ' + on(() => set({ priv }), 'radio') + ' aria-checked="' + onIt + '" style="flex:1 1 0;display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:14px;cursor:pointer;' + (onIt ? 'background:#f3f1fe;box-shadow:inset 0 0 0 2px #5b4ae8' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6') + '">' +
          '<span style="font-size:15px;font-weight:900;color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + name + '</span><span style="font-size:12.5px;line-height:1.35;font-weight:600;color:#6b7280">' + sub + '</span></div>'; };
      const mine = groupsInOrder();
      body = '<div style="display:flex;gap:8px">' + tile(false, 'Public', 'Everyone in your groups') + tile(true, 'Private', 'Only people you invite') + '</div>' +
        (isLead(s) ? guestInvSwitch(ss.guestInv !== false, () => set({ guestInv: ss.guestInv === false })) : '') +
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
      '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.4px;color:#0d1117">' + esc(title) + '</div>' + closeX(close) + '</div>' +
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
          '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0;font-size:22px;font-weight:900;letter-spacing:-.4px;color:#0d1117">Edit what you need</div>' + closeX(close) + '</div></div>' +
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
  // The ready message (owner, 2026-09-30): warm and short; an idea asks who's interested
  const inviteText = (s) => {
    const when = s.dayDate ? fmtDay(s.dayDate) + (s.dayTime ? ' at ' + fmtTime(s.dayTime) : '') : '', where = s.spot ? ' at ' + s.spot : '';
    if (phaseOf(s) === 'done') return s.text + ': here’s how it went.';
    if (!s.planned) return isLead(s) ? 'I’m floating an idea: ' + s.text + '. Interested?' : firstName(nameOf(s.leadId, s.leadName)) + ' is floating an idea: ' + s.text + '. Interested?';
    return (isLead(s) ? 'I’m putting together ' + s.text + (when ? ', ' + when : '') : s.text + (when ? ' is ' + when : ' is coming up')) + where + '. Want to come?';
  };
  // Invite people (owner's mock, 2026-10-01): your friends and the people in the event's groups, each with Invite /
  // ✓ Invited (invite_friends, event_invited: 20261101170000_invite_people.sql), then "or share a link" with Copy and
  // Messages, Email, WhatsApp, More. Only someone who can invite (canInviteTo) gets the list.
  const loadInvitees = (s) => {
    const sh = state.share;
    setState({ share: Object.assign({}, sh, { people: [], invited: [], loading: true }) });
    const mine = s.groupIds.filter(g => myGroups().some(x => x.id === g));
    Promise.all([sb.rpc('event_invited', { p_spark: s.id })].concat(mine.map(g => sb.rpc('group_people', { p_group: g }))))
      .then(([inv, ...gs]) => {
        const leads = [s.leadId].concat(s.cohosts), seen = {}, people = [];
        const add = (id, name, avatar, sub, friend) => { if (!id || id === state.me || leads.indexOf(id) > -1 || seen[id]) return; seen[id] = 1; people.push({ id, name: name || 'Someone', avatar: PHOTO_PATH.test(avatar || '') ? avatar : null, sub, friend }); };
        state.fr.friends.forEach(f => add(f.id, f.name, f.avatar, 'Friend', true));
        gs.forEach((r, k) => (r.data || []).forEach(p => add(p.user_id, p.name, p.avatar_path, (groupById(mine[k]) || {}).name || 'Group', false)));
        people.sort((a, b) => (b.friend - a.friend) || a.name.localeCompare(b.name));
        if (state.share && state.share.id === s.id) setState({ share: Object.assign({}, state.share, { people, invited: (inv.data || []).map(x => typeof x === 'string' ? x : x.event_invited || Object.values(x)[0]), loading: false }) });
      })
      .catch(e => { console.error(e); if (state.share && state.share.id === s.id) setState({ share: Object.assign({}, state.share, { loading: false }) }); });
  };
  const invitePerson = (s, p) => {
    if (state.viewAs) { toast('You’re viewing as ' + firstName(state.viewAs.name) + ', so nothing changes. Exit to make changes.'); return; }
    const was = state.share.invited || [];
    setState({ share: Object.assign({}, state.share, { invited: was.concat(p.id) }) });
    // The Invited count and Who's coming show it at once; the refresh after the save settles it
    const cur = state.sparks.find(x => x.id === s.id) || s;
    if (!(cur.invites || []).some(i => i.userId === p.id)) patchSpark(s.id, { invites: (cur.invites || []).concat({ userId: p.id, by: state.me, at: Date.now(), nudgedAt: 0 }) });
    sb.rpc('invite_friends', { p_spark: s.id, p_people: [p.id] }).then(r => { if (r.error) throw r.error; return loadFresh().catch(e => console.error(e)); })
      .catch(e => { console.error(e); if (state.share) setState({ share: Object.assign({}, state.share, { invited: (state.share.invited || []).filter(x => x !== p.id) }) }); toast(failed(e)); });
  };
  function viewShareSheet() {
    const sh = state.share, s = state.sparks.find(x => x.id === sh.id);
    if (!s) return '';
    const close = () => setState({ share: null }), link = location.origin + '/i/' + s.id;
    const msg = (sh.msg || inviteText(s)) + ' ' + link, past = phaseOf(s) === 'done', title = sh.ask ? 'Ask two people first' : isLead(s) && !past ? 'Invite people' : s.planned ? 'Share this event' : 'Share this idea';
    const canList = !!state.email && !s.cancelledAt && !past && canInviteTo(s);
    if (canList && !sh.people && !sh.loading) setTimeout(() => { if (state.share && state.share.id === s.id && !state.share.people && !state.share.loading) loadInvitees(s); }, 0);
    const btn = (label, href, icon, fn) => '<' + (fn ? 'div ' + on(fn) : 'a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"') + ' aria-label="' + label + '" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;cursor:pointer">' +
      '<span style="width:52px;height:52px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center">' + svg(22, stroke('#5b4ae8', 2.1), icon) + '</span>' +
      '<span style="font-size:13.5px;font-weight:600;color:#6b7280">' + label + '</span></' + (fn ? 'div' : 'a') + '>';
    const more = () => { if (navigator.share) navigator.share({ title: s.text, text: msg, url: link }).catch(() => {}); else copy(msg, 'Invite copied. Paste it anywhere.'); };
    const q = (sh.q || '').trim().toLowerCase(), invited = sh.invited || [];
    const going = (id) => s.rsvps.some(r => r.userId === id && r.status === 'going');
    const people = (sh.people || []).filter(p => !q || p.name.toLowerCase().indexOf(q) > -1 || p.sub.toLowerCase().indexOf(q) > -1);
    const row = (p) => '<div data-invitee="' + esc(p.name) + '" style="display:flex;align-items:center;gap:12px;min-height:58px">' + avatarSpan(p.id, p.name, p.avatar ? photoUrl(p.avatar) : null, 44) +
      '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) + '</div>' +
        '<div style="font-size:13.5px;font-weight:500;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.sub) + '</div></div>' +
      (going(p.id) ? '<span style="flex:0 0 auto;font-size:14px;font-weight:800;color:#0f7a3c">Going</span>'
        : invited.indexOf(p.id) > -1 ? '<span aria-label="' + esc(p.name) + ' is invited" style="flex:0 0 auto;display:flex;align-items:center;gap:5px;min-height:40px;padding:0 16px;border-radius:999px;background:#ece9fd;color:#5b4ae8;font-size:14.5px;font-weight:800">' + svg(13, stroke('#5b4ae8', 2.8), '<path d="m5 12.5 4.5 4.5L19 7.5"/>') + 'Invited</span>'
        : '<button type="button" ' + on(() => invitePerson(s, p)) + ' aria-label="Invite ' + esc(p.name) + '" style="flex:0 0 auto;min-height:40px;padding:0 20px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Invite</button>') + '</div>';
    const list = !canList ? '' :
      '<label style="display:flex;align-items:center;gap:10px;min-height:48px;padding:0 16px;border-radius:999px;background:#f2f3f6">' + svg(18, stroke('#6b7280', 2.2), '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>') +
        '<input type="search" aria-label="Search friends and groups" placeholder="Search friends and groups" value="' + esc(sh.q || '') + '" ' + onInput(e => { if (e.type === 'input') setState({ share: Object.assign({}, state.share, { q: e.target.value.slice(0, 40) }) }); }) +
          ' style="flex:1;min-width:0;border:0;background:transparent;outline:none;font-family:inherit;font-size:16px;font-weight:500;color:#0d1117"></label>' +
      '<div data-invitees style="display:flex;flex-direction:column;max-height:42vh;overflow-y:auto">' +
        (sh.loading || !sh.people ? paraHtml('Loading…') : people.length ? people.map(row).join('') : paraHtml(q ? 'Nobody by that name.' : 'No friends or group members to invite yet.')) + '</div>' +
      '<div style="display:flex;align-items:center;gap:12px"><span style="flex:1;height:1px;background:#e3e5e9"></span><span style="font-size:14px;font-weight:700;color:#6b7280">or share a link</span><span style="flex:1;height:1px;background:#e3e5e9"></span></div>';
    return sheet(title, close, SHEET_PAD,
      '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:26px;line-height:1.1;font-weight:900;letter-spacing:-.6px;color:#0d1117">' + title + '</div>' +
        (sh.ask ? '<p data-ask-first style="margin:6px 0 0;font-size:14px;line-height:1.4;font-weight:600;color:#454b55">Events that start with a friend or two already in are far more likely to happen. Invite two people you think would come.</p>' : '') +
        '</div>' + closeX(close) + '</div>' +
      list +
      '<div style="display:flex;align-items:center;gap:10px;border-radius:18px;background:#f2f3f6;padding:7px 7px 7px 16px">' + svg(18, stroke('#6b7280', 2.2) + ' style="flex:0 0 18px"', '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>') +
        '<span style="flex:1;min-width:0;font-size:15px;font-weight:700;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(link.replace(/^https?:\/\//, '')) + '</span>' +
        '<span ' + on(() => { copy(link, 'Link copied'); setState({ share: Object.assign({}, sh, { copied: true }) }); }) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:46px;padding:0 20px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:15px;font-weight:800;cursor:pointer">' + (sh.copied ? '✓ Copied' : 'Copy') + '</span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">' +
        btn('Messages', 'sms:?&body=' + encodeURIComponent(msg), '<path d="M4 5.5h16v10H9l-5 4v-14Z"/>') +
        btn('Email', 'mailto:?subject=' + encodeURIComponent(s.text) + '&body=' + encodeURIComponent(msg), '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>') +
        btn('WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(msg), '<path d="M4.5 19.5l1.2-3.6A7.5 7.5 0 1 1 8.4 18.5L4.5 19.5Z"/><path d="M9.5 9.5c.3 2 2 3.8 4 4.2"/>') +
        btn('More', null, '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>', more) + '</div>', 36);
  }

  // Date and location in one card: a value (bold, with the time or address in gray under it), "TBD" (gray, owner 2026-10-01), or a poll (guests vote, the host picks)
  // Ideas use it too (audit, 2026-10-01): members also get Suggest a date / location, and a set date or place keeps any other suggestions under it
  // Help pick when and where (owner's mocks, 2026-10-02): while a date or a location is still being voted on, ideas and plans
  // show the vote in one card: a gold box per vote (date tiles, location rows, a tick on each, "View all (N)", "+ Add"),
  // a green box for whichever is already set, and a line on what you voted for. Members tick every one that works; the
  // lead taps one to lock it in.
  const VG = { box: '#fdf6dc', edge: '#e6d08c', ink: '#8a6510', on: '#ecc56a', dark: '#3d2a00', tick: '#e2cd8a' };
  const voteTick = (onIt) => '<span aria-hidden="true" style="flex:0 0 auto;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;' +
    (onIt ? 'background:' + VG.dark : 'background:#fff;border:2.5px solid ' + VG.tick) + '">' + (onIt ? I.check(13, '#fff', 3.4) : '') + '</span>';
  const votesN = (n) => n + (n === 1 ? ' vote' : ' votes');
  // What a screen reader hears on an option (and what tests find): "Vote for Sat, Nov 14 · 6:30pm (1 vote, suggested by Gus)"
  const optLabel = (s, o, label) => (isLead(s) ? 'Pick ' : o.votes.indexOf(state.me) > -1 ? 'Remove your vote for ' : 'Vote for ') + label + ' (' + votesN(o.votes.length) + (o.who ? ', suggested by ' + o.who : '') + ')';
  const voteTap = (s, kind, o) => () => { if (state.busy) return; if (isLead(s)) pickOpt(s, kind, o); else vote(kind === 'day' ? 'date_votes' : 'spot_votes', s, o, true); };
  // The ones shown in the card: the most-voted (dates then in date order); the rest are under View all
  const topOpts = (opts, n, kind) => {
    const top = opts.slice().sort((a, b) => b.votes.length - a.votes.length || a.created - b.created).slice(0, n);
    return kind === 'day' ? top.sort((a, b) => (a.dayDate + (a.dayTime || '')).localeCompare(b.dayDate + (b.dayTime || ''))) : top;
  };
  const voteBox = (s, kind) => {
    const day = kind === 'day', opts = day ? s.dateOpts : s.spotOpts, lead = isLead(s);
    const shown = topOpts(opts, day ? 3 : 2, kind);
    const head = '<div style="display:flex;align-items:center;gap:10px">' + svg(19, stroke(VG.ink, 2.1), day ? P6.cal : P6.pin) +
      '<span style="flex:1;min-width:0;font-size:13px;font-weight:900;letter-spacing:1.4px;color:' + VG.ink + '">' + (day ? 'VOTE ON A DATE' : 'VOTE ON A LOCATION') + '</span>' +
      (opts.length > shown.length || opts.length > 1 ? '<span ' + on(() => setState({ voteAll: { id: s.id, kind } })) + ' data-view-all-' + kind + ' style="display:flex;align-items:center;gap:4px;font-size:15px;font-weight:800;color:' + VG.ink + ';cursor:pointer;white-space:nowrap">View all (' + opts.length + ')' + I.chevR(12, VG.ink, 2.8) + '</span>' : '') + '</div>';
    const newTag = (o) => state.justAdded === o.id ? '<span style="position:absolute;top:8px;right:10px;font-size:11.5px;font-weight:800;color:' + VG.dark + ';opacity:.75">New</span>' : '';
    const tile = (o) => {
      const mine = o.votes.indexOf(state.me) > -1, n = o.votes.length, dp = dateParts(o.dayDate), on_ = mine && !lead;
      return '<div ' + on(voteTap(s, 'day', o)) + ' data-poll-opt="' + esc(dayLabel(o.dayDate, o.dayTime)) + '" aria-pressed="' + on_ + '" aria-label="' + esc(optLabel(s, o, dayLabel(o.dayDate, o.dayTime))) + '" style="position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:14px 4px 12px;border-radius:18px;text-align:center;cursor:pointer;background:' + (on_ ? VG.on : '#fff') + '">' +
        newTag(o) + (lead ? '' : voteTick(on_)) +
        '<span style="margin-top:' + (lead ? 2 : 8) + 'px;font-size:12.5px;font-weight:900;letter-spacing:1.3px;color:' + (on_ ? VG.dark : VG.ink) + '">' + esc(dp.dow) + '</span>' +
        '<span style="font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117;white-space:nowrap">' + esc(monthDay(o.dayDate)) + '</span>' +
        '<span style="font-size:15px;font-weight:600;color:' + (on_ ? VG.dark : '#6b7280') + '">' + esc(o.dayTime ? fmtTime(o.dayTime) : 'Any time') + '</span>' +
        '<span style="margin-top:6px;font-size:14.5px;font-weight:800;color:' + (on_ ? VG.dark : VG.ink) + '">' + votesN(n) + '</span>' +
        (lead ? '<span style="margin-top:6px;font-size:13px;font-weight:900;color:#5b4ae8">Pick</span>' : '') + '</div>';
    };
    const row = (o) => {
      const mine = o.votes.indexOf(state.me) > -1, n = o.votes.length, on_ = mine && !lead;
      return '<div ' + on(voteTap(s, 'spot', o)) + ' data-poll-opt="' + esc(o.name) + '" aria-pressed="' + on_ + '" aria-label="' + esc(optLabel(s, o, o.name)) + '" style="position:relative;display:flex;align-items:center;gap:14px;min-height:58px;padding:8px 18px 8px 16px;border-radius:18px;cursor:pointer;background:' + (on_ ? VG.on : '#fff') + '">' +
        (lead ? '' : voteTick(on_)) + '<span style="flex:1;min-width:0;font-size:17px;line-height:1.2;font-weight:800;color:#0d1117;overflow-wrap:anywhere">' + esc(o.name) + '</span>' +
        '<span style="flex:0 0 auto;font-size:14.5px;font-weight:800;color:' + (on_ ? VG.dark : VG.ink) + '">' + votesN(n) + '</span>' +
        (lead ? '<span style="flex:0 0 auto;font-size:13px;font-weight:900;color:#5b4ae8">Pick</span>' : '') + (state.justAdded === o.id ? '<span style="position:absolute;top:4px;right:12px;font-size:11px;font-weight:800;color:' + VG.dark + ';opacity:.75">New</span>' : '') + '</div>';
    };
    const add = '<span ' + on(() => openOffer(s, kind)) + ' data-add-' + kind + ' style="align-self:flex-start;display:flex;align-items:center;gap:8px;min-height:40px;font-size:16px;font-weight:800;color:' + VG.ink + ';cursor:pointer">' + I.plus(15, VG.ink, 2.8) + (day ? 'Add date' : 'Add location') + '</span>';
    const none = '<div style="padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.6);font-size:15px;font-weight:600;color:' + VG.ink + '">' + (day ? 'No dates suggested yet.' : 'No locations suggested yet.') + '</div>';
    return '<div data-vote-box="' + kind + '" style="display:flex;flex-direction:column;gap:14px">' + head +
      (!shown.length ? none : day ? '<div style="display:flex;gap:8px">' + shown.map(tile).join('') + '</div>' : '<div style="display:flex;flex-direction:column;gap:10px">' + shown.map(row).join('') + '</div>') + add + '</div>';
  };
  const setBox = (s, kind) => {
    const day = kind === 'day', G = '#2f8a4c', o = day ? s.dateOpts.find(x => x.dayDate === s.dayDate && (x.dayTime || null) === (s.dayTime || null)) : s.spotOpts.find(x => x.name === s.spot);
    const mine = o && o.votes.indexOf(state.me) > -1, by = firstName(nameOf(s.leadId, s.leadName));
    const what = day ? fmtDay(s.dayDate) + (s.dayTime ? ' · ' + fmtTime(s.dayTime) : '') : s.spot;
    const sub = o ? by + ' picked it · ' + votesN(o.votes.length) + (mine ? ', incl. yours' : '') : day ? (s.dayTime ? '' : 'Time to be decided') : (s.spotAddress || '');
    const btn = 'display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 2px #a9d8b6;color:' + G + ';font-size:16px;font-weight:800;text-decoration:none;cursor:pointer';
    return '<div data-set-box="' + kind + '" style="display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:20px;background:#ebf6ee;box-shadow:inset 0 0 0 2px #b9dfc4">' +
      '<div style="display:flex;align-items:center;gap:10px">' + svg(19, stroke(G, 2.1), day ? P6.cal : P6.pin) + '<span style="font-size:13px;font-weight:900;letter-spacing:1.4px;color:' + G + '">' + (day ? 'DATE IS SET' : 'LOCATION IS SET') + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:12px"><span aria-hidden="true" style="flex:0 0 34px;width:34px;height:34px;border-radius:999px;background:#3c9a5a;display:flex;align-items:center;justify-content:center">' + I.check(15, '#fff', 3.2) + '</span>' +
        '<div style="flex:1;min-width:0"><div style="font-size:18px;line-height:1.2;font-weight:900;color:#0d1117;overflow-wrap:anywhere">' + esc(what) + '</div>' + (sub ? '<div style="margin-top:2px;font-size:14px;font-weight:700;color:' + G + '">' + esc(sub) + '</div>' : '') + '</div></div>' +
      (day ? '<span ' + on(() => addToCalendar(s)) + ' style="' + btn + '">Add to calendar</span>' : '<a href="' + esc(directionsUrl(s)) + '" target="_blank" rel="noopener noreferrer" style="' + btn + '">Directions</a>') + '</div>';
  };
  const pickingCard = (s) => {
    const dayOpen = !s.dayDate, spotOpen = !s.spot, lead = isLead(s), by = firstName(nameOf(s.leadId, s.leadName));
    const title = dayOpen && spotOpen ? 'Help pick when and where' : dayOpen ? 'Help pick when' : 'Help pick where';
    const sub = lead ? 'People tick every one that works. Tap one to lock it in.'
      : dayOpen && spotOpen ? 'Tick every one that works for you. ' + by + ' locks in the final pick.'
      : dayOpen ? (s.spot ? 'The location is set. Still voting on a date.' : 'Tick every one that works for you. ' + by + ' locks in the final pick.')
      : (s.dayDate ? 'The date is set. Still voting on a location.' : 'Tick every one that works for you. ' + by + ' locks in the final pick.');
    const gold = (inner) => '<div style="display:flex;flex-direction:column;gap:16px;padding:18px 16px;border-radius:22px;background:' + VG.box + ';box-shadow:inset 0 0 0 2px ' + VG.edge + '">' + inner + '</div>';
    const myD = s.dateOpts.filter(o => o.votes.indexOf(state.me) > -1).length, myS = s.spotOpts.filter(o => o.votes.indexOf(state.me) > -1).length;
    const voters = new Set([].concat(...s.dateOpts.map(o => o.votes), ...s.spotOpts.map(o => o.votes))).size;
    const foot = lead ? (voters ? voters + (voters === 1 ? ' person has' : ' people have') + ' voted' : 'No votes yet. Share it so people can vote.')
      : !myD && !myS ? 'You haven’t voted yet'
      : 'You voted for ' + [myD && (dayOpen ? myD + (myD === 1 ? ' date' : ' dates') : ''), myS && (spotOpen ? myS + (myS === 1 ? ' location' : ' locations') : '')].filter(Boolean).join(' and ');
    return '<div id="sec-when" data-when-card data-picking style="' + CARD + ';border-radius:24px;padding:20px 18px 16px;display:flex;flex-direction:column;gap:14px">' +
      '<div><h2 style="margin:0;font-size:24px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">' + title + '</h2>' +
        '<p style="margin:4px 0 0;font-size:15.5px;line-height:1.4;font-weight:500;color:#5c6270">' + esc(sub) + '</p></div>' +
      (s.dayDate && !dayOpen ? setBox(s, 'day') : '') + (s.spot && !spotOpen ? setBox(s, 'spot') : '') +
      (dayOpen || spotOpen ? gold((dayOpen ? voteBox(s, 'day') : '') + (dayOpen && spotOpen ? '<div style="height:2px;background:' + VG.edge + ';opacity:.7"></div>' : '') + (spotOpen ? voteBox(s, 'spot') : '')) : '') +
      '<div data-vote-foot style="text-align:center;font-size:15px;font-weight:600;color:#6b7280">' + esc(foot) + '</div>' +
      (lead ? '<span ' + on(() => openSec(s, 'when')) + ' style="align-self:center;display:flex;align-items:center;gap:6px;min-height:36px;font-size:14px;font-weight:700;color:#6b7280;cursor:pointer">' + svg(13, stroke('currentColor', 2.4), PENCIL) + 'Set it yourself instead</span>' : '') +
    '</div>';
  };
  // View all: every option, most votes first, with who suggested it
  function viewVoteAll() {
    const va = state.voteAll, s = state.sparks.find(x => x.id === va.id);
    if (!s) return '';
    const day = va.kind === 'day', lead = isLead(s), close = () => setState({ voteAll: null });
    const opts = (day ? s.dateOpts : s.spotOpts).slice().sort((a, b) => b.votes.length - a.votes.length || a.created - b.created);
    const row = (o) => {
      const mine = o.votes.indexOf(state.me) > -1, on_ = mine && !lead, label = day ? dayLabel(o.dayDate, o.dayTime) : o.name;
      return '<div ' + on(voteTap(s, va.kind, o)) + ' data-vote-all="' + esc(label) + '" aria-pressed="' + on_ + '" aria-label="' + esc(optLabel(s, o, label)) + '" style="display:flex;align-items:center;gap:14px;min-height:66px;padding:10px 18px 10px 16px;border-radius:18px;cursor:pointer;' + (on_ ? 'background:' + VG.on : 'background:' + VG.box + ';box-shadow:inset 0 0 0 2px ' + VG.edge) + '">' +
        (lead ? '' : voteTick(on_)) + '<div style="flex:1;min-width:0"><div style="font-size:17px;line-height:1.2;font-weight:900;color:#0d1117;overflow-wrap:anywhere">' + esc(label) + '</div>' +
          (o.who ? '<div style="margin-top:2px;font-size:14.5px;font-weight:600;color:' + (on_ ? VG.dark : VG.ink) + '">Suggested by ' + esc(firstName(o.who)) + '</div>' : '') + '</div>' +
        '<span style="flex:0 0 auto;font-size:14.5px;font-weight:800;color:' + (on_ ? VG.dark : VG.ink) + '">' + votesN(o.votes.length) + '</span>' +
        (lead ? '<span style="flex:0 0 auto;font-size:13px;font-weight:900;color:#5b4ae8">Pick</span>' : '') + '</div>';
    };
    return sheet(day ? 'Vote on a date' : 'Vote on a location', close, SHEET_PAD,
      sheetHead('', day ? 'Vote on a date' : 'Vote on a location', lead ? 'Tap one to lock it in. Most votes first.' : 'Tick every one that works. Most votes first.', close) +
      '<div style="display:flex;flex-direction:column;gap:10px">' + opts.map(row).join('') + '</div>' +
      '<span ' + on(() => { close(); openOffer(s, va.kind); }) + ' style="display:flex;align-items:center;justify-content:center;gap:8px;min-height:56px;border-radius:18px;border:2px dashed ' + VG.tick + ';font-size:16px;font-weight:800;color:' + VG.ink + ';cursor:pointer">' + I.plus(15, VG.ink, 2.8) + (day ? 'Add date' : 'Add location') + '</span>' +
      '<button type="button" ' + on(close) + ' style="min-height:56px;border:0;border-radius:999px;background:' + VG.on + ';color:' + VG.dark + ';font-family:inherit;font-size:17px;font-weight:900;cursor:pointer">Done</button>', 36);
  }
  const whenWhereCard = (s) => {
    if (!s.cancelledAt && phaseOf(s) !== 'done' && ((!s.dayDate && s.dateOpts.length) || (!s.spot && s.spotOpts.length))) return pickingCard(s);
    const lead = isLead(s) && !s.cancelledAt, P = '#5b4ae8', off = !!s.cancelledAt, suggest = !s.planned && !isLead(s) && !off;
    const pollRows = (opts, kind) => opts.slice().sort((a, b) => b.votes.length - a.votes.length).map(o => {
      const mine = o.votes.indexOf(state.me) > -1, n = o.votes.length, label = kind === 'day' ? dayLabel(o.dayDate, o.dayTime) : o.name;
      const act = () => { if (state.busy || off) return; if (lead) pickOpt(s, kind, o); else vote(kind === 'day' ? 'date_votes' : 'spot_votes', s, o); };
      const tip = label + ' (' + n + (n === 1 ? ' vote' : ' votes') + (o.who ? ', suggested by ' + o.who : '') + ')';
      return '<div data-poll-opt="' + esc(label) + '" style="display:flex;align-items:center;gap:10px;min-height:46px;padding:6px 6px 6px 12px;border-radius:12px;background:#f4f5f7"><span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:800;color:#0d1117">' + esc(label) + '</span>' +
        (o.who ? '<span style="display:block;font-size:12.5px;font-weight:600;color:#6b7280">Suggested by ' + esc(o.who) + '</span>' : '') + '</span>' +
        '<span style="font-size:12.5px;font-weight:700;color:#6b7280;white-space:nowrap">' + n + (n === 1 ? ' vote' : ' votes') + '</span>' +
        (off ? '' : '<span ' + on(act) + ' aria-label="' + esc((lead ? 'Pick ' : mine ? 'Remove your vote for ' : 'Vote for ') + tip) + '" aria-pressed="' + (!lead && mine) + '" style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;min-width:70px;min-height:34px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;' +
          (lead ? 'background:' + P + ';color:#fff' : mine ? 'background:#e7f5ec;color:#0f7a3c' : 'background:#fff;color:' + P + ';box-shadow:inset 0 0 0 1.5px ' + P) + '">' + (lead ? 'Pick' : mine ? '✓ Voted' : 'Vote') + '</span>') + '</div>';
    }).join('');
    const tbd = (t) => '<div style="display:flex;align-items:center;gap:10px"><span style="flex:1;font-size:17px;line-height:1.25;font-weight:800;color:#6b7280">' + t + '</span>' +
      (lead ? '<span ' + on(() => openSec(s, 'when')) + ' style="font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">Add</span>' : '') + '</div>';
    const voting = (t, rows) => '<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:12px;font-weight:800;letter-spacing:1.1px;color:' + AMBER_INK + '">' + t + '</span>' + rows + '</div>';
    const whenTxt = s.dayDate ? new Date(s.dayDate + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '';
    const time = s.dayTime ? (s.dayEnd ? spanTime({ time: s.dayTime, endTime: s.dayEnd }) : fmtTime(s.dayTime)) : '';
    const otherDays = s.dateOpts.filter(o => !(o.dayDate === s.dayDate && (o.dayTime || null) === (s.dayTime || null))), otherSpots = s.spotOpts.filter(o => o.name !== s.spot);
    const sugg = (kind) => suggest ? '<span ' + on(() => openOffer(s, kind)) + ' data-suggest-' + kind + ' style="margin-top:6px;display:inline-flex;align-items:center;gap:6px;min-height:34px;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(14, '#5b4ae8', 2.6) + (kind === 'day' ? 'Add a date' : 'Add a location') + '</span>' : '';
    const dayPart = (s.dayDate ? '<div style="font-size:17px;line-height:1.25;font-weight:900;letter-spacing:-.3px;color:#0d1117;text-wrap:pretty">' + esc(whenTxt) + '</div>' +
          (time ? '<div style="margin-top:2px;font-size:15px;line-height:1.35;font-weight:500;color:#6b7280">' + esc(time) + '</div>' : '') +
          (otherDays.length ? '<div style="margin-top:10px">' + voting('OTHER SUGGESTIONS', pollRows(otherDays, 'day')) + '</div>' : '')
        : s.dateOpts.length ? voting('VOTING ON A DATE', pollRows(s.dateOpts, 'day')) : tbd('Date TBD')) + sugg('day');
    const spotPart = (s.spot ? '<div style="font-size:17px;line-height:1.25;font-weight:900;letter-spacing:-.3px;color:#0d1117;text-wrap:pretty">' + esc(s.spot) + '</div>' +
          (s.spotAddress ? '<div style="margin-top:2px;font-size:14.5px;line-height:1.35;font-weight:500;color:#6b7280;text-wrap:pretty">' + esc(s.spotAddress) + '</div>' : '') +
          (otherSpots.length ? '<div style="margin-top:10px">' + voting('OTHER SUGGESTIONS', pollRows(otherSpots, 'spot')) + '</div>' : '')
        : s.spotOpts.length ? voting('VOTING ON A LOCATION', pollRows(s.spotOpts, 'spot')) : tbd('Location TBD')) + sugg('spot');
    const empty = (kind) => { const day = kind === 'day';
      return '<div data-empty-' + (day ? 'date' : 'spot') + ' style="display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:18px;border:2px dashed #d6d0fb;background:#f8f7ff">' +
        '<div style="display:flex;gap:12px">' + svg(22, stroke('#5b4ae8', 2.1) + ' style="flex:0 0 22px;margin-top:1px"', day ? P6.cal : P6.pin) +
          '<div><div style="font-size:17px;font-weight:900;color:#0d1117">' + (day ? 'No date yet' : 'No location yet') + '</div><div style="margin-top:2px;font-size:14px;font-weight:500;color:#6b7280">Set one, or let people vote.</div></div></div>' +
        '<div style="display:flex;gap:10px">' +
          '<button type="button" ' + on(() => openSec(s, 'when')) + ' style="flex:1 1 0;min-height:46px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer">' + (day ? 'Set a date' : 'Set a location') + '</button>' +
          '<button type="button" ' + on(() => setState({ pollSheet: { kind: day ? 'when' : 'where', rows: day ? [{ d: '', t: '' }, { d: '', t: '' }] : [{ v: '' }, { v: '' }], sparkId: s.id } })) + ' style="flex:1 1 0;min-height:46px;border:0;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 2px #5b4ae8;color:#5b4ae8;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px">' + svg(16, stroke('#5b4ae8', 2.4), POLL_IC) + 'Run a poll</button>' +
        '</div></div>'; };
    const noDay = lead && !s.dayDate && !s.dateOpts.length, noSpot = lead && !s.spot && !s.spotOpts.length;
    const editLink = '<span ' + on(() => openSec(s, 'when')) + ' aria-label="Edit date, time and location" style="flex:0 0 auto;align-self:flex-start;display:flex;align-items:center;gap:5px;padding-top:2px;color:#6b7280;font-size:14px;font-weight:700;cursor:pointer">' + svg(13, stroke('currentColor', 2.4), PENCIL) + 'Edit</span>';
    const pill = 'flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;border-radius:999px;background:#f3f1fe;color:#5b4ae8;font-size:14.5px;font-weight:800;text-decoration:none;cursor:pointer';
    return '<div id="sec-when" data-when-card style="' + CARD + ';border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:16px">' +
      (noDay ? empty('day') : '<div style="display:flex;gap:14px">' + svg(20, stroke('#6b7280', 2.1) + ' style="flex:0 0 20px;margin-top:1px"', P6.cal) + '<div style="flex:1;min-width:0">' + dayPart + '</div>' + (lead ? editLink : '') + '</div>') +
      (noSpot ? empty('spot') : '<div style="display:flex;gap:14px">' + svg(20, stroke('#6b7280', 2.1) + ' style="flex:0 0 20px;margin-top:1px"', P6.pin) + '<div style="flex:1;min-width:0">' + spotPart + '</div>' + (lead && noDay ? editLink : '') + '</div>') +
      (!off && (s.dayDate || s.spot) ? '<div style="display:flex;gap:8px">' +
        (s.dayDate ? '<span ' + on(() => addToCalendar(s)) + ' style="' + pill + '">' + svg(18, stroke('#5b4ae8', 2.2), '<path d="M20 12V8a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 8v9.5A2.5 2.5 0 0 0 6.5 20H12"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M18 15v6M15 18h6"/>') + 'Add to calendar</span>' : '') +
        (s.spot ? '<a href="' + esc(directionsUrl(s)) + '" target="_blank" rel="noopener noreferrer" style="' + pill + '">' + svg(18, stroke('#5b4ae8', 2.2), '<path d="M12 2.8 21.2 12 12 21.2 2.8 12Z"/><path d="M9 14.5V12a1.5 1.5 0 0 1 1.5-1.5H15"/><path d="m13 8.5 2 2-2 2"/>') + 'Directions</a>' : '') + '</div>' : '') +
    '</div>';
  };
  const basicDetailsSec = (s) => {
    const bits = basicsOf(s), edit = canEdit(s) && !s.cancelledAt;
    if (!bits.length && !edit) return '';
    return '<section id="sec-details" data-basics><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 4px;margin-bottom:8px"><h2 style="margin:0;font-size:24px;line-height:1.1;font-weight:900;letter-spacing:-.6px;color:#0d1117">Details</h2>' +
        (edit ? '<span ' + on(() => openSec(s, 'details')) + ' aria-label="Edit details" style="display:flex;align-items:center;gap:5px;min-height:36px;padding:0 2px;color:#6b7280;font-size:14px;font-weight:700;cursor:pointer">' + svg(13, stroke('currentColor', 2.4), PENCIL) + 'Edit</span>' : '') + '</div>' +
      (bits.length
        ? '<div style="' + CARD + ';padding:4px 16px">' + bits.map((t, k) => '<div style="display:flex;align-items:baseline;gap:10px;padding:10px 0;border-top:' + (k ? '1px solid #f2f3f6' : '0') + '"><span style="flex:0 0 6px;width:6px;height:6px;border-radius:999px;background:#0f7a3c;transform:translateY(-3px)"></span><span style="font-size:16px;line-height:1.4;font-weight:700;color:#0d1117;text-wrap:pretty">' + esc(t) + '</span></div>').join('') + '</div>'
        : '<div ' + on(() => openSec(s, 'details')) + ' style="padding:14px 16px;border-radius:18px;border:1.5px dashed #c9ccd3;font-size:14.5px;font-weight:700;color:#6b7280;cursor:pointer">Add up to three quick notes on what to expect.</div>') +
    '</section>';
  };
  const deleteLink = (s, past) => canTakeDown(s) ? '<span ' + on(() => askDelete(s, past)) + ' style="align-self:center;display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:0 12px;font-size:14.5px;font-weight:800;color:#9b1c31;cursor:pointer">' + I.trash(15, '#9b1c31') + (!past && !s.cancelledAt && peopleIn(s).some(u => u !== state.me) ? 'Cancel or delete this ' + (s.planned ? 'event' : 'idea') : 'Delete this ' + (s.planned ? 'event' : 'idea')) + '</span>' : '';

  // Who's in: the group(s) it's posted to and Public / Private, under the people (owner, 2026-10-01: easy to see and change).
  // The lead's Edit opens Who can see it; anyone in a group can tap its name to open it.
  const groupRow = (s) => {
    const ids = gIds(s), known = ids.map(groupById).filter(Boolean), more = ids.length - known.length, priv = s.visibility === 'invite';
    const name = (g) => g.role ? '<span ' + on((e) => { stop(e); openGroup(g); }) + ' data-group-link style="font-weight:800;color:#0d1117;cursor:pointer">' + esc(g.name) + '</span>' : '<span style="font-weight:800;color:#0d1117">' + esc(g.name) + '</span>';
    return '<div data-vis style="display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px solid #f2f3f6">' +
      '<span aria-hidden="true" style="flex:0 0 32px;width:32px;height:32px;border-radius:10px;background:#f3f1fe;color:#5b4ae8;display:flex;align-items:center;justify-content:center">' + svg(16, stroke('currentColor', 2.2), priv ? LOCK_IC : PEOPLE_IC) + '</span>' +
      '<div style="flex:1;min-width:0;font-size:14px;line-height:1.35;font-weight:600;color:#6b7280">' +
        '<div style="font-size:14.5px;color:#0d1117">' + (known.length ? known.map(name).join(', ') : '') + (more ? (known.length ? ' + ' + more : more + (more === 1 ? ' group' : ' groups')) : '') + '</div>' +
        '<div>' + (priv ? 'Private · only people invited' : 'Public · everyone in ' + (ids.length > 1 ? 'these groups' : 'the group')) + '</div></div>' +
      (isLead(s) && !s.cancelledAt ? '<span ' + on(() => openSec(s, 'vis')) + ' aria-label="Edit who can see it" style="flex:0 0 auto;display:flex;align-items:center;gap:5px;color:#6b7280;font-size:14px;font-weight:700;cursor:pointer">' + svg(13, stroke('currentColor', 2.4), PENCIL) + 'Edit</span>' : '') +
    '</div>';
  };
  // "Led by" with its co-leads in one card (owner's mock, 2026-10-01; the separate Hosts section is gone). The lead's face
  // comes first with the ring, then up to two co-leads (a "+N" after that). Leads and group admins also get, with no
  // co-lead yet, the prompt to bring one in; with co-leads, "Manage co-leads", which opens the Leads sheet.
  const COLEAD_WHY = 'Someone to plan it with you, and keep it going if you can’t make it.';
  const leadNames = (s) => {
    const lead = nameOf(s.leadId, s.leadName), co = s.cohosts.map(u => firstName(nameOf(u)));
    if (!co.length) return esc(lead);
    const amp = '<span style="color:#7b6ef0"> &amp; </span>', all = [firstName(lead)].concat(co);
    return all.length <= 3 ? all.slice(0, -1).map(esc).join(', ') + amp + esc(all[all.length - 1])
      : all.slice(0, 2).map(esc).join(', ') + amp + (all.length - 2) + ' more';
  };
  const ledByCard = (s) => {
    const leadName = nameOf(s.leadId, s.leadName), lbl = s.wantsHost ? 'FLOATED BY' : 'LED BY', co = s.cohosts;
    const manage = canEdit(s) && !s.cancelledAt, ask = manage && !co.length && !s.wantsHost;
    const ring = (u, name, size, edge) => '<span style="position:relative;flex:0 0 ' + (size + 6) + 'px;width:' + (size + 6) + 'px;height:' + (size + 6) + 'px;border-radius:999px;border:3px solid #fff;box-shadow:0 0 0 2.5px ' + edge + ', 0 6px 16px rgba(13,17,23,.2);display:flex;box-sizing:border-box;background:#fff">' + face(u, name, size) + '</span>';
    const faces = '<span style="flex:0 0 auto;display:flex;align-items:center">' + ring(s.leadId, leadName, 50, '#7b6ef0') +
      co.slice(0, co.length > 2 ? 1 : 2).map(u => '<span style="margin-left:-16px;display:flex">' + ring(u, nameOf(u), 40, '#b8aefc') + '</span>').join('') +
      (co.length > 2 ? '<span style="position:relative;margin-left:-16px;flex:0 0 46px;width:46px;height:46px;border-radius:999px;border:3px solid #fff;box-shadow:0 0 0 2.5px #b8aefc;background:#fff;color:#4a3ad4;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;box-sizing:border-box">+' + (co.length - 1) + '</span>' : '') + '</span>';
    const tap = co.length ? () => setState({ leadsSheet: s.id }) : () => openPerson(s.leadId);
    return '<div id="sec-lead" data-led-by style="position:relative;display:flex;flex-direction:column;gap:12px;padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,#f1edff,#e0d8ff);box-shadow:0 1px 3px rgba(15,18,25,.08)">' +
        '<span aria-hidden="true" style="position:absolute;left:52%;top:6px;font-size:9px;color:#9d93f7">✦</span><span aria-hidden="true" style="position:absolute;right:16px;top:10px;font-size:11px;color:#b8aefc">✦</span><span aria-hidden="true" style="position:absolute;right:10px;bottom:6px;font-size:8px;color:#7b6ef0">✦</span>' +
        '<div ' + on(tap) + ' aria-label="' + (s.wantsHost ? 'Floated by ' : 'Led by ') + esc(leadName) + (co.length ? ' and ' + co.length + ' co-lead' + (co.length > 1 ? 's' : '') + ', see who' : ', see profile') + '" style="display:flex;align-items:center;gap:14px;cursor:pointer' + (manage ? ';padding-right:52px' : '') + '">' + faces +
          '<div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:900;letter-spacing:.9px;color:#6b5ce7">' + lbl + '</div><div data-lead-names style="font-size:20px;line-height:1.15;font-weight:900;letter-spacing:-.3px;color:#2a1f8f;overflow-wrap:anywhere">' + leadNames(s) + '</div></div></div>' +
        (ask ? '<div data-colead-ask style="display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;border-radius:16px;background:rgba(255,255,255,.72)">' +
            '<div style="flex:1;min-width:0;font-size:13.5px;line-height:1.4;font-weight:600;color:#4a3ad4"><b style="font-weight:900">Bring in a co-lead.</b> ' + COLEAD_WHY + '</div>' +
            '<button type="button" class="hov-primary" ' + on(() => openCohostPicker(s)) + ' style="flex:0 0 auto;min-height:44px;padding:0 16px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;display:flex;align-items:center;gap:6px;cursor:pointer">' + I.plus(14, '#fff', 2.8) + 'Co-lead</button></div>' : '') +
        // Manage co-leads is a small Edit in the card's top right, like the page's other Edit links, in dark purple (owner, 2026-10-01)
        (manage ? '<span ' + on(() => setState({ leadsSheet: s.id })) + ' data-manage-coleads aria-label="Manage co-leads" style="position:absolute;top:12px;right:14px;z-index:1;display:flex;align-items:center;gap:5px;min-height:36px;padding:0 2px;color:#4a3ad4;font-size:14px;font-weight:700;cursor:pointer">' + svg(13, stroke('currentColor', 2.4), PENCIL) + 'Edit</span>' : '') +
      '</div>';   // (Say hi is hidden until there's messaging, owner 2026-10-01)
  };
  // The Leads sheet (20261101130000_cohosts.sql): everyone sees who leads it; leads and group admins add co-leads from
  // the event's groups (up to 5); the lead and admins remove them, and a co-lead can step down
  // Step back as lead (20261101210000_step_back.sql): a co-lead takes over, or it goes back to an idea looking for a lead
  const askStepBack = (s) => {
    const co = s.cohosts[0], going = s.rsvps.filter(r => r.status !== 'no' && r.userId !== state.me).length;
    setState({ confirm: { title: 'Step back as lead?', danger: true, cta: 'Step back', keep: 'Stay on',
      body: co ? firstName(nameOf(co)) + ' becomes the lead. Nothing else changes.'
        : (s.planned ? 'It goes back to being an idea, looking for a lead. The date and place stay.' + (going ? ' ' + (going === 1 ? 'The 1 person who said Going or Maybe gets a note and shows' : 'The ' + going + ' people who said Going or Maybe get a note and show') + ' as interested.' : '') : 'It stays up as an idea, looking for a lead.') + ' Anyone who can see it can take it on.',
      run: () => run(async () => { must(await sb.rpc('step_back', { p_spark: s.id })); }, { confirm: null })
        .then(ok => { if (ok) toast(co ? firstName(nameOf(co)) + ' is leading it now' : s.planned ? 'It’s an idea again, looking for a lead' : 'It’s looking for a lead now', true); }) } });
  };
  function viewLeadsSheet() {
    const s = state.sparks.find(x => x.id === state.leadsSheet);
    if (!s) return '';
    const close = () => setState({ leadsSheet: null }), manage = canEdit(s) && !s.cancelledAt, mayRemove = canTakeDown(s);
    const tag = (t) => '<span style="flex:0 0 auto;font-size:12.5px;font-weight:800;color:#6b7280">' + t + '</span>';
    const act = (label, fn) => '<span ' + on(fn) + ' style="flex:0 0 auto;font-size:13.5px;font-weight:800;color:#9b1c31;cursor:pointer">' + label + '</span>';
    const row = (u, name, tail, i) => '<div data-lead-row="' + esc(name) + '" style="display:flex;align-items:center;gap:12px;min-height:52px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + '">' +
      '<span ' + on(() => { close(); openPerson(u); }) + ' style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;cursor:pointer">' + face(u, name, 34) +
        '<span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(u === state.me ? 'You' : name) + '</span></span>' + tail + '</div>';
    return modal('Leads', close,
      h3Html('Leads') +
      '<div style="display:flex;flex-direction:column">' + row(s.leadId, nameOf(s.leadId, s.leadName), tag(s.wantsHost ? 'Floated it' : 'Lead') + (manage && s.leadId === state.me && !s.wantsHost ? '<span style="color:#c9ccd3">·</span>' + act('Step back', () => { close(); askStepBack(s); }) : ''), 0) +
        s.cohosts.map((u, i) => row(u, nameOf(u), !manage ? tag('Co-lead') : u === state.me ? act('Step down', () => { close(); askRemoveCohost(s, u, true); }) : mayRemove ? act('Remove', () => { close(); askRemoveCohost(s, u, false); }) : tag('Co-lead'), i + 1)).join('') + '</div>' +
      (manage && s.cohosts.length < 5 ? '<span ' + on(() => { close(); openCohostPicker(s); }) + ' style="display:flex;align-items:center;gap:7px;min-height:44px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(15, '#5b4ae8', 2.6) + 'Add a co-lead</span>' : '') +
      // Hand it to someone (owner, 2026-10-02): the lead only; the plan stays as it is until they say yes
      (s.leadId === state.me && !s.wantsHost && !s.cancelledAt && phaseOf(s) !== 'done'
        ? (s.leadOffer
          ? '<div data-lead-offered style="display:flex;align-items:center;gap:8px;min-height:44px;font-size:14.5px;font-weight:700;color:#5c6270">' + face(s.leadOffer.userId, nameOf(s.leadOffer.userId), 24) +
              '<span style="flex:1;min-width:0">Asked ' + esc(firstName(nameOf(s.leadOffer.userId))) + ' to take over · waiting</span>' +
              '<span ' + on(() => withdrawLeadOffer(s)) + ' style="font-size:13.5px;font-weight:800;color:#9b1c31;cursor:pointer">Withdraw</span></div>'
          : '<span ' + on(() => openHandOff(s)) + ' data-hand-off role="button" style="display:flex;align-items:center;gap:7px;min-height:44px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' +
              svg(15, stroke('#5b4ae8', 2.4), '<path d="M5 12h14M13 6l6 6-6 6"/>') + 'Hand it to someone</span>')
        : '') +
      paraHtml('Co-leads plan it with the lead and keep it going if the lead can’t make it. They can do everything except cancel or delete it.'));
  }
  const openCohostPicker = (s) => {
    setState({ cohostPick: { id: s.id, people: null, q: '' } });
    Promise.all(s.groupIds.map(g => sb.rpc('group_people', { p_group: g })))
      .then(rs => { rs.forEach(r => { if (r.error) throw r.error; });
        const seen = {}, people = [].concat(...rs.map(r => r.data || [])).filter(p => { const id = p.user_id || p.id; if (seen[id]) return false; seen[id] = 1; return true; });
        if (state.cohostPick && state.cohostPick.id === s.id) setState({ cohostPick: Object.assign({}, state.cohostPick, { people }) }); })
      .catch(e => { console.error(e); setState({ cohostPick: null }); toast(failed(e)); });
  };
  const addCohost = (s, u, name) => run(async () => { must(await sb.rpc('add_cohost', { p_spark: s.id, p_user: u })); }, { cohostPick: null })
    .then(ok => { if (ok) toast(firstName(name) + ' is a co-lead now', true); });
  const askRemoveCohost = (s, u, self) => setState({ confirm: self
    ? { title: 'Step down as co-lead?', body: firstName(nameOf(s.leadId, s.leadName)) + ' keeps leading it. Your RSVP stays.', cta: 'Step down', keep: 'Stay on', danger: true,
        run: () => run(async () => { must(await sb.rpc('remove_cohost', { p_spark: s.id, p_user: u })); }, { confirm: null }) }
    : { title: 'Remove ' + firstName(nameOf(u)) + ' as co-lead?', body: 'They won’t be able to edit it or see everyone’s replies any more.', cta: 'Remove', keep: 'Keep them', danger: true,
        run: () => run(async () => { must(await sb.rpc('remove_cohost', { p_spark: s.id, p_user: u })); }, { confirm: null }) } });
  function viewCohostPicker() {
    const cp = state.cohostPick, s = state.sparks.find(x => x.id === cp.id);
    if (!s) return '';
    const close = () => setState({ cohostPick: null }), q = (cp.q || '').trim().toLowerCase();
    const list = (cp.people || []).map(p => ({ id: p.user_id || p.id, name: p.name || 'Someone' }))
      .filter(p => p.id && p.id !== s.leadId && s.cohosts.indexOf(p.id) < 0 && (!q || p.name.toLowerCase().indexOf(q) > -1));
    return modal('Add a co-lead', close,
      h3Html('Add a co-lead') + paraHtml('Someone from ' + esc(s.groupIds.length > 1 ? 'its groups' : 'the group') + ' to plan it with you. They can do everything you can except cancel or delete it, and they’ll get a note.') +
      '<input class="fld" type="search" aria-label="Search people" placeholder="Search" value="' + esc(cp.q || '') + '" ' + onInput(e => { if (e.type === 'input') setState({ cohostPick: Object.assign({}, state.cohostPick, { q: e.target.value.slice(0, 40) }) }); }) + ' style="' + FIELD + '">' +
      (cp.people === null ? paraHtml('Loading…') : !list.length ? paraHtml(q ? 'Nobody by that name.' : 'Everyone’s already leading it.') :
        '<div style="display:flex;flex-direction:column;max-height:50vh;overflow:auto">' + list.map((p, i) =>
          '<div ' + on(() => { if (!state.busy) addCohost(s, p.id, p.name); }) + ' data-pick-cohost="' + esc(p.name) + '" aria-label="Make ' + esc(p.name) + ' a co-lead" style="display:flex;align-items:center;gap:12px;min-height:52px;cursor:pointer;border-top:' + (i ? '1px solid #f2f3f6' : '0') + '">' +
            face(p.id, p.name, 32, null) + '<span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:#0d1117">' + esc(p.name) + '</span>' + I.plus(15, '#5b4ae8', 2.6) + '</div>').join('') + '</div>'));
  }

  // Ask someone to lead (owner, 2026-10-02): the people in the idea's groups, the ones who said they could help first,
  // then the interested, then everyone else; Ask becomes ✓ Asked and stays that way while the idea needs a lead
  function viewLeadAsk() {
    const la = state.leadAsk, s = state.sparks.find(x => x.id === la.id);
    if (!s || !s.wantsHost || s.cancelledAt) return '';
    const close = () => setState({ leadAsk: null }), q = (la.q || '').trim().toLowerCase();
    const rank = (u) => s.canHelp.indexOf(u) > -1 ? 0 : s.interested.indexOf(u) > -1 ? 1 : 2;
    const all = (la.people || []).map(p => ({ id: p.user_id || p.id, name: p.name || 'Someone' })).filter(p => p.id && p.id !== state.me && p.id !== s.leadId);
    const list = all.filter(p => !q || p.name.toLowerCase().indexOf(q) > -1).sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
    const tagOf = (u) => { const r = rank(u); return r === 2 ? '' : '<span style="display:block;margin-top:1px;font-size:12.5px;font-weight:800;color:' + (r ? '#6b7280' : '#0f7a3c') + '">' + (r ? 'Interested' : 'Can help') + '</span>'; };
    const btn = (p) => s.leadAsks.some(a => a.userId === p.id)
      ? '<span data-asked style="flex:0 0 auto;display:flex;align-items:center;gap:5px;min-height:38px;padding:0 6px;font-size:14px;font-weight:800;color:#0f7a3c">' + svg(13, stroke('currentColor', 3), P6.check) + 'Asked</span>'
      : '<button type="button" class="hov-primary" ' + on(() => askToLead(s, p.id)) + ' aria-label="Ask ' + esc(p.name) + ' to lead" style="flex:0 0 auto;min-height:38px;padding:0 18px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Ask</button>';
    return modal('Ask someone to lead', close,
      h3Html('Ask someone to lead') + paraHtml('Know who’d be great at this? They get a note asking if they’d lead <b style="font-weight:800;color:#0d1117">' + esc(s.text) + '</b>. It’s theirs once they tap I’ll lead.') +
      (all.length > 7 ? '<input class="fld" type="search" aria-label="Search people" placeholder="Search" value="' + esc(la.q || '') + '" ' + onInput(e => { if (e.type === 'input') setState({ leadAsk: Object.assign({}, state.leadAsk, { q: e.target.value.slice(0, 40) }) }); }) + ' style="' + FIELD + '">' : '') +
      (la.people === null ? paraHtml('Loading…') : !list.length ? paraHtml(q ? 'Nobody by that name.' : 'No one else is in ' + esc(s.groupIds.length > 1 ? 'its groups' : 'the group') + ' yet.') :
        '<div style="display:flex;flex-direction:column;max-height:46vh;overflow:auto">' + list.map((p, i) =>
          '<div data-ask-row="' + esc(p.name) + '" data-ask-uid="' + esc(p.id) + '" style="display:flex;align-items:center;gap:12px;min-height:56px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + '">' +
            face(p.id, p.name, 34, null) + '<span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.name) + '</span>' + tagOf(p.id) + '</span>' + btn(p) + '</div>').join('') + '</div>') +
      '<span ' + on(() => setState({ leadAsk: null, share: { id: s.id, copied: false } })) + ' style="align-self:flex-start;display:flex;align-items:center;min-height:40px;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">Or share the idea</span>');
  }

  // Inspo: up to three mood photos; the lead adds and removes them (ideas and plans alike), everyone else sees them when there are some
  const inspoSec = (s) => {
    const lead = isLead(s) && !s.cancelledAt, mood = s.mood.slice(0, 3);
    if (!mood.length && !lead) return '';
    return '<section data-inspo>' + secTitle('Inspo', lead ? '<span style="font-size:13px;font-weight:700;color:#9aa0ac">' + mood.length + ' / 3</span>' : '') +
      '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px">' +
        (lead && !mood.length ? '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">Add up to three photos that set the mood: the place, past years, the feel you’re going for.</p>' : '') +
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
          mood.map((p, i) => '<div ' + on(() => setState({ zoom: { photos: mood.map(photoUrl), i } })) + ' aria-label="View mood photo ' + (i + 1) + '" style="position:relative;aspect-ratio:1;border-radius:12px;cursor:zoom-in;background:' + bg(photoUrl(p)) + '">' +
            (lead ? '<span ' + on((e) => { stop(e); if (!state.busy) removeMood(s, p); }) + ' aria-label="Remove photo" style="position:absolute;top:5px;right:5px;width:24px;height:24px;border-radius:999px;background:rgba(13,17,23,.6);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(11, '#fff', 3) + '</span>' : '') +
            '</div>').join('') +
          (lead && mood.length < 3
            ? '<label class="hov-dash" style="aspect-ratio:1;border-radius:12px;border:1.5px dashed #cfd3db;background:#f7f7f9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer">' +
                I.plus(20, '#5b4ae8', 2.4) + '<span style="font-size:12.5px;font-weight:800;color:#5b4ae8">Add photo</span>' +
                '<input type="file" accept="image/*" aria-label="Add a mood photo" ' + onInput(e => { if (e.type !== 'change') return; const f = Array.from(e.target.files || []); e.target.value = ''; addMood(s, f); }) + ' style="display:none">' +
              '</label>'
            : '') +
        '</div></div></section>';
  };

  function viewPlan(s) {
    const st = state, lead = isLead(s), edit = canEdit(s), leadName = nameOf(s.leadId, s.leadName), my = myRsvp(s), dp = dateParts(s.dayDate);
    const goingIds = going(s).map(r => r.userId), maybeN = s.rsvps.filter(r => r.status === 'maybe').length, noN = s.rsvps.filter(r => r.status === 'no').length;
    const sheetCard = (inner, extra) => '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px;' + (extra || '') + '">' + inner + '</div>';

    // Under the photo: the host's "Your tasks" (purple), or a helper's "You're helping" (gold). Collapsed by default.
    const myJobs = (s.jobs || s.signups).filter(j => j.shifts ? myShiftIds(j).length : j.claims.some(c => c.userId === st.me));
    const myTime = (j) => j.shifts ? j.shifts.filter(u => u.claims.some(c => c.userId === st.me)).map(spanTime).filter(Boolean).join(', ') : spanTime(j);
    const f = signupFill(s);
    const tasks = !lead ? myJobs.map(j => ({ item: j.item, meta: myTime(j) })) : [].concat(
      // With a poll running, go to its votes and Pick buttons (the pop-up's plain field would throw the poll away)
      !s.dayDate ? [{ item: s.dateOpts.length ? 'Pick the winning date' : 'Pick a date', act: () => s.dateOpts.length ? openToSection(s, 'sec-when') : openSec(s, 'when') }] : [],
      !s.spot ? [{ item: s.spotOpts.length ? 'Pick the winning location' : 'Pick a location', act: () => s.spotOpts.length ? openToSection(s, 'sec-when') : openSec(s, 'when') }] : [],
      // Details are optional, so no task for them; each job still to fill is one, and opens its personal ask (owner, 2026-10-02)
      jobActs(s, (fn) => fn).map(a => ({ item: a.act.split(':')[0], meta: a.act.split(': ')[1], act: a.go })),
      myJobs.map(j => ({ item: j.item, meta: myTime(j) })));
    const tKey = (lead ? 'h:' : '') + s.id, tOpen = !!st.jobsOpen[tKey];
    const T = lead ? { bar: '#f5f3fe', ink: '#4a3ad4', dot: '#7b6ef0', line: '#e6e1fc', word: 'Your tasks' } : { bar: '#fefaef', ink: '#8f6405', dot: '#e8a71c', line: '#f3e2ad', word: 'You’re helping' };
    const tab = !tasks.length || s.cancelledAt ? '' :
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
      return '<button type="button" ' + on(() => setRsvp(s, k)) + ' aria-pressed="' + onIt + '" style="min-height:60px;border:0;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-family:inherit;cursor:pointer;' +
        (onIt ? 'background:' + RC[k] + ';color:#fff' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;color:#0d1117') + '">' +
        '<span style="font-size:17px;font-weight:800">' + label + '</span><span style="font-size:13px;font-weight:700;color:' + (onIt ? 'rgba(255,255,255,.85)' : '#6b7280') + '">' + n + '</span></button>';
    };
    // An update sent to Going, Maybe or people who haven't replied shows only to them; the host sees all, labelled
    const shownUpdates = lead ? s.updates : s.updates.filter(u => { const a = u.audience || 'all'; return a === 'all' || a === my || (a === 'noreply' && !my); });
    // A guest who RSVP'd or took a job gets no reminders or updates without an account: offer them (owner, 2026-10-01)
    const guestNudge = st.email || lead || s.cancelledAt || !(my === 'going' || my === 'maybe' || s.signups.some(it => it.claims.some(c => c.userId === st.me))) ? '' :
      '<div data-guest-nudge style="' + CARD + ';padding:16px;display:flex;align-items:center;gap:12px;background:#f7f6ff;box-shadow:inset 0 0 0 1.5px #dcd6fb">' +
        '<span style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center">' + ic6('bell', 18, '#5b4ae8', 2.2) + '</span>' +
        '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#0d1117">Want a reminder?</div>' +
          '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:600;color:#5c6270">Make a free account and we’ll remind you the day before and that morning, and tell you if anything changes.</div></div>' +
        '<span ' + on(() => openLogin('account', () => {})) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:40px;padding:0 16px;border-radius:999px;background:#5b4ae8;color:#fff;font-size:14px;font-weight:800;cursor:pointer">Create account</span>' +
      '</div>';
    // Leads answer with the same buttons as everyone (owner, 2026-10-01; the lead is Going to their own plan, 20261101160000)
    const rsvpBlock = s.cancelledAt ? '' : '<div data-rsvp style="' + CARD + ';padding:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      rsvpBtn('going', 'Going', goingIds.length) + rsvpBtn('maybe', 'Maybe', maybeN) + rsvpBtn('no', 'Can’t', noN) + '</div>';

    // The host's guest list, with no title. Invites are a share link, so there's no Invited count (HANDOFF §1).
    const guests = !lead ? '' : '<div data-screen-label="Guest list" style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:14px">' +
      '<span ' + on(() => setState({ blast: { id: s.id, to: 'all', text: '' } })) + ' style="align-self:center;display:flex;align-items:center;gap:7px;min-height:36px;font-size:14.5px;font-weight:800;color:#6b7280;cursor:pointer">' + ic6('bell', 15, 'currentColor', 2.2) + 'Send everyone an update</span>' +
      '<div style="display:grid;grid-template-columns:1fr;gap:8px">' +
        '<button type="button" class="hov-primary" ' + on(() => setState({ share: { id: s.id, copied: false } })) + ' style="min-height:50px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:15.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;box-shadow:0 8px 20px rgba(91,74,232,.28)">' + I.plus(16, '#fff', 2.5) + 'Invite people</button>' +
      '</div></div>';
    // (The gold "N things left to decide" banner is gone: the host's tasks bar lists them, owner 2026-09-30)

    const host = ledByCard(s);

    return '<div data-screen-label="Plan page">' +
      phaseHeader(s, 340, 'linear-gradient(to bottom, rgba(13,17,23,.5) 0%, rgba(13,17,23,0) 30%, rgba(8,40,22,.55) 62%, rgba(8,40,22,.96) 100%)',
        '<div style="position:absolute;left:20px;right:20px;bottom:20px;color:#fff;display:flex;align-items:flex-end;gap:14px"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' + (s.cancelledAt ? '<span data-cancelled style="display:flex;align-items:center;border-radius:999px;padding:5px 11px;background:#d92d4a;font-size:12px;font-weight:900;letter-spacing:.9px">CANCELLED</span>' : '') + '<span data-chip' + (isDemo(s) ? ' data-demo-tag' : '') + ' style="display:flex;align-items:center;gap:6px;border-radius:999px;padding:5px 11px;background:' + (isDemo(s) ? 'rgba(255,255,255,.24);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)' : lead ? '#5b4ae8' : '#149a4b') + ';font-size:12px;font-weight:900;letter-spacing:.9px">' + (isDemo(s) ? 'DEMO' : lead ? (isTheLead(s) ? 'YOU’RE LEADING' : 'YOU’RE CO-LEADING') : 'HAPPENING') + '</span>' +
            (s.visibility === 'invite' ? '<span style="display:flex;align-items:center;gap:5px;border-radius:999px;padding:5px 11px;background:rgba(255,255,255,.22);font-size:12px;font-weight:900;letter-spacing:.9px">' + svg(11, stroke('#fff', 2.6), '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>') + 'PRIVATE</span>' : '') + '</div>' +
          (edit
            ? '<h1 ' + on(() => openSec(s, 'title'), 'button') + ' aria-label="' + esc(s.text) + ', edit the title" style="margin:0;font-size:40px;line-height:.98;font-weight:900;letter-spacing:-1.3px;text-wrap:pretty;cursor:pointer">' + esc(s.text) + '</h1>'
            : '<h1 style="margin:0;font-size:40px;line-height:.98;font-weight:900;letter-spacing:-1.3px;text-wrap:pretty">' + esc(s.text) + '</h1>') + '</div>' +
          (s.dayDate ? '<span aria-label="' + esc(fmtDay(s.dayDate)) + '" style="flex:0 0 70px;width:70px;border-radius:14px;overflow:hidden;text-align:center;background:#fff;box-shadow:0 8px 20px rgba(0,0,0,.3);transform:rotate(4deg)"><span style="display:block;background:#149a4b;color:#fff;font-size:11.5px;font-weight:900;letter-spacing:1px;padding:3px 0">' + dp.mon + '</span><span style="display:block;font-size:32px;line-height:1.15;font-weight:900;color:#0d1117">' + dp.day + '</span><span style="display:block;padding-bottom:5px;font-size:11px;font-weight:800;color:#6b7280">' + dp.dow + '</span></span>' : '') +
        '</div>', true) +
      tab +
      '<div style="padding:16px 14px 26px;display:flex;flex-direction:column;gap:18px">' +
        cancelledCard(s) +
        rsvpBlock +
        (s.cancelledAt ? '' : guests) +
        guestNudge +
        whenWhereCard(s) +
        basicDetailsSec(s) +
        (shownUpdates.length ? '<section>' + secTitle('Updates') + sheetCard(
          shownUpdates.map(u => '<div data-update style="display:flex;gap:10px">' + (u.createdBy && u.createdBy !== s.leadId ? face(u.createdBy, nameOf(u.createdBy), 30) : face(s.leadId, leadName, 30)) + '<div style="flex:1;min-width:0;border-radius:4px 14px 14px 14px;background:#f2f3f6;padding:10px 12px;font-size:14.5px;line-height:1.4;font-weight:500;color:#2b303a;white-space:pre-line">' + esc(u.body) +
            '<div style="margin-top:4px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#8a909b"><span style="flex:1">' + esc(ago(u.created) + (lead && UPD_TO[u.audience] ? ' · ' + UPD_TO[u.audience] : '')) + '</span>' +
              (lead && (!u.createdBy || u.createdBy === st.me) ? '<span ' + on(() => askRemoveUpdate(s, u)) + ' aria-label="Remove this update" style="color:#9b1c31;font-weight:800;cursor:pointer">Remove</span>' : '') + '</div></div></div>').join('')) + '</section>' : '') +
        askCards(s) + helpOut(s) +
        host +
        '<section>' + secTitle('Who’s in') + sheetCard(
          // the count sits inside the card, and the card opens the full list (owner, 2026-10-01)
          '<div ' + (goingIds.length ? on(() => setState({ guestList: s.id })) + ' data-going aria-label="See everyone going (' + goingIds.length + ')" ' : '') + 'style="display:flex;align-items:center;gap:10px' + (goingIds.length ? ';cursor:pointer' : '') + '">' +
            '<span style="display:flex">' + (goingIds.length ? peopleFaces(goingIds.slice(0, 5), 40, null, true) + (goingIds.length > 5 ? '<span style="width:40px;height:40px;border-radius:999px;border:2.5px solid #fff;margin-left:-10px;background:#e7f6ec;color:#0f7a3c;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center">+' + (goingIds.length - 5) + '</span>' : '') : lead && s.rsvps.length ? '<span data-going-empty style="font-size:14px;font-weight:600;color:#6b7280">Nobody’s going yet. <span ' + on(() => setState({ guestList: s.id })) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">See ' + s.rsvps.length + (s.rsvps.length === 1 ? ' reply' : ' replies') + '</span></span>'
              : lead ? '<span data-going-empty style="font-size:14px;font-weight:600;color:#6b7280">Nobody’s RSVP’d yet.' + (s.cancelledAt ? '' : ' <span ' + on(() => setState({ share: { id: s.id, copied: false } })) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Send invites</span>') + '</span>' : '<span style="font-size:14px;font-weight:600;color:#6b7280">Nobody yet. Be the first.</span>') + '</span>' +
            // Only the leads going (the lead is Going to their own plan, 20261101160000): the lead still gets the nudge to share
            (lead && goingIds.length && goingIds.every(u => u === s.leadId || s.cohosts.indexOf(u) > -1)
              ? '<span data-going-empty style="flex:1;min-width:0;font-size:14px;font-weight:600;color:#6b7280">' + (goingIds.length === 1 && goingIds[0] === st.me ? 'Just you so far.' : 'Just the leads so far.') + ' <span ' + on((e) => { stop(e); setState({ share: { id: s.id, copied: false } }); }) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Send invites</span></span>' +
                // invited and not answered yet: the row still opens Who's coming, where they're listed with Nudge
                (pendingInv(s) ? '<span data-invited-count style="flex:0 0 auto;display:flex;align-items:center;gap:6px;font-size:14.5px;font-weight:800;color:#4a3ad4;white-space:nowrap">' + pendingInv(s) + ' invited' + I.chevR(14, '#9aa0ac', 2.6) + '</span>' : '')
              : goingIds.length ? '<span style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:14.5px;font-weight:800;color:#0f7a3c;white-space:nowrap">' + goingIds.length + ' going' + I.chevR(14, '#9aa0ac', 2.6) + '</span>' : '') +
          '</div>' + groupRow(s)) + '</section>' +
        inspoSec(s) +
        deleteLink(s) +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  // Once the date has passed, the host can still move it (a wrong date, or it got pushed) or take it down
  const doneFixCard = (s) => !canEdit(s) ? '' :
    '<div data-done-fix style="display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:4px">' +
      (isLead(s) ? '<span ' + on(() => openSec(s, 'when')) + ' style="display:flex;align-items:center;gap:7px;min-height:44px;padding:0 12px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">' +
        svg(15, stroke('currentColor', 2.2), PENCIL) + 'Wrong date? Change it</span>' : '') +
      deleteLink(s, true) + '</div>';
  function viewDone(s) {
    const st = state, dp = dateParts(s.dayDate), n = cameCount(s);
    const album = s.album.map(a => photoUrl(a.path));
    const removable = s.album.filter(a => a.createdBy === st.me || isLead(s)), editing = st.albumEdit === s.id && removable.length > 0;
    const tileAt = (src, extra) => '<span style="position:relative;border-radius:12px;background:' + (src ? bg(src) : '#e4e7ec') + ';' + (extra || '') + '"></span>';
    return '<div data-screen-label="It happened">' +
      phaseHeader(s, 300, 'linear-gradient(to bottom, rgba(13,17,23,.4), rgba(13,17,23,0) 30%, rgba(34,25,110,.92) 100%)',
        '<span aria-hidden="true" style="position:absolute;top:calc(66px + var(--pt));right:18px;display:flex;align-items:center;min-height:36px;padding:0 14px 0 44px;border-radius:999px;background:#5b4ae8;transform:rotate(-8deg);font-size:15px;font-weight:900;color:#fff;box-shadow:0 6px 16px rgba(15,18,25,.3)"><span style="position:absolute;left:-10px;top:50%;transform:translateY(-55%) rotate(-10deg);font-size:46px;line-height:1">🥳</span>It happened!</span>' +
        '<div style="position:absolute;left:20px;right:20px;bottom:18px;color:#fff"><div style="font-size:13px;font-weight:900;letter-spacing:1.2px;color:#cfc9ff">' + dp.dow + ', ' + dp.md + ' · ' + n + (checkedIn(s) ? ' CAME' : ' SAID YES') + '</div>' +
          '<h1 style="margin:6px 0 0;font-size:32px;line-height:1.02;font-weight:900;letter-spacing:-1px;text-wrap:pretty">' + esc(s.text) + demoTag(s, false, true) + '</h1></div>', true) +
      '<div style="padding:14px 14px 26px;display:flex;flex-direction:column;gap:12px">' +
        '<div style="' + CARD + ';padding:16px;display:flex;flex-direction:column;gap:10px">' +
          eyebrowRow('The album' + (album.length ? ' · ' + album.length : ''),
            '<span style="display:flex;align-items:center;gap:14px">' +
              (removable.length ? '<span ' + on(() => setState({ albumEdit: editing ? null : s.id })) + ' style="font-size:13.5px;font-weight:800;color:' + (editing ? '#0d1117' : '#9b1c31') + ';cursor:pointer">' + (editing ? 'Done' : 'Remove') + '</span>' : '') +
              '<label style="font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">+ Add yours<input type="file" accept="image/*" aria-label="Add a photo to the album" ' + onInput(e => { if (e.type !== 'change') return; const f = (e.target.files || [])[0]; e.target.value = ''; addAlbumPhoto(s, f); }) + ' style="display:none"></label></span>') +
          // Remove mode: every photo as a square; ✕ on the ones you added (the host: all of them)
          (editing ? '<div data-album-edit style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">' + s.album.map(a =>
              '<span style="position:relative;aspect-ratio:1;border-radius:12px;background:' + bg(photoUrl(a.path)) + '">' +
                (removable.indexOf(a) > -1 ? '<span ' + on(() => askRemovePhoto(s, a)) + ' aria-label="Remove this photo" style="position:absolute;top:5px;right:5px;width:28px;height:28px;border-radius:999px;background:rgba(13,17,23,.7);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(11, '#fff', 3) + '</span>' : '') +
              '</span>').join('') + '</div>' :
          album.length
            ? '<div ' + on(() => setState({ zoom: { photos: album, i: 0 } })) + ' aria-label="Open the album" style="display:grid;grid-template-columns:' + (album.length === 1 ? '1fr' : album.length === 2 ? '1fr 1fr' : '2fr 1fr') + ';grid-template-rows:' + (album.length < 3 ? '186px' : '90px 90px') + ';gap:6px;cursor:zoom-in">' +
                (album.length < 3 ? album.map(src => tileAt(src)).join('') :
                tileAt(album[0], 'grid-row:span 2') + tileAt(album[1]) +
                '<span style="position:relative;border-radius:12px;background:' + bg(album[2]) + '">' + (album.length > 3 ? '<span style="position:absolute;inset:0;border-radius:12px;background:rgba(13,17,23,.5);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff">+' + (album.length - 3) + '</span>' : '') + '</span>') +
              '</div>'
            : '<p style="margin:0;font-size:14px;line-height:1.45;font-weight:500;color:#5c6270">No photos yet. Anyone who went can add theirs.</p>') +
        '</div>' +
        reactionsCard(s) +
        // Do it again? above Wrong date and Delete (owner, 2026-10-01)
        '<div style="border-radius:18px;background:#fdf1d6;padding:16px;display:flex;align-items:center;gap:12px">' +
          '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900;color:#3d2a00">Do it again?</div><div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:600;color:#6b5418">Starts a new event with the place and details filled in.</div></div>' +
          '<span ' + on(() => needSignIn(() => doItAgain(s), 'post')) + ' style="flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:42px;padding:0 16px;border-radius:999px;background:#e8a71c;font-size:14.5px;font-weight:800;color:#fff;cursor:pointer">' + svg(13, 'fill="#fff"', '<path d="M13.2 2.2 7.2 13.1l3.9-.35-.9 8.8 6.9-11.2-4.1.4z"/>') + 'Do it again</span>' +
        '</div>' +
        doneFixCard(s) +
      '</div>' +
      '<div style="height:var(--nav-h)"></div>' +
    '</div>';
  }

  function viewStartGroup() {
    const st = state, ok = (st.startName || '').trim().length > 1 && !st.busy;
    return modal('Start a group', () => setState({ startName: null }),
      h3Html('Start a group') + paraHtml('You’ll own it, and get a link to invite others.') +
      '<input class="fld" type="text" maxlength="40" aria-label="Group name" placeholder="E.g. Mueller Neighbors" value="' + esc(st.startName || '') + '" ' + onInput(e => { if (e.type === 'input') setState({ startName: e.target.value.slice(0, 40) }); }) + ' style="' + FIELD + '">' +
      '<button type="button" data-enter ' + on(submitStartGroup) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">' + (st.busy === 'save' ? 'Creating…' : 'Create group') + '</button>',
      { z: 32 });
  }

  // Invite people / share it (email invites come with the email phase)
  function viewInvite() {
    const s = state.sparks.find(x => x.id === state.invite.id), close = () => setState({ invite: null });
    if (!s) return '';
    const link = location.origin + '/i/' + s.id, ask = state.invite.msg;   // only opened as "Find a replacement"
    const msg = ask + ' ' + link;
    const title = state.invite.title || 'Find a replacement';
    if (ask) return modal(title, close,   // Round 64c
      h3Html(title) + '<div style="margin-top:-6px;font-size:14px;font-weight:700;color:#6b7280">' + esc(state.invite.sub || s.text) + '</div>' +
      '<div style="padding:14px 16px;border-radius:16px;background:#f4f5f7;font-size:15px;line-height:1.45;font-weight:600;color:#2b303a;overflow-wrap:anywhere">“' + esc(ask + ' ' + link.replace(/^https?:\/\//, '')) + '”</div>' +
      '<button type="button" class="hov-primary" ' + on(() => { if (navigator.share) navigator.share({ title: s.text, text: msg, url: link }).catch(() => {}); else copy(msg, 'Message copied. Paste it anywhere.'); }) + ' style="' + primary(true) + '">Send the message</button>' +
      '<span ' + on(() => copy(msg, 'Message copied. Paste it anywhere.')) + ' style="align-self:center;display:flex;align-items:center;min-height:36px;font-size:14.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Copy it instead</span>',
      { z: 32 });
    return '';
  }

  // "Send an update" to people on the plan (posted on the plan now; delivery comes with notifications)
  function viewBlast() {
    const b = state.blast, s = state.sparks.find(x => x.id === b.id), close = () => setState({ blast: null });
    if (!s) return '';
    const g = going(s).length, m = s.rsvps.filter(r => r.status === 'maybe').length;
    const aud = [['all', 'Everyone', s.rsvps.length], ['going', 'Going', g], ['maybe', 'Maybe', m]];
    // Shortcuts that fit the people who replied (owner, 2026-09-30): reminders are automatic now, so no Reminder or Last call
    const tpl = [['Change of plans', 'Heads up, small change for ' + s.text + ': '], ['Running late', 'Running about 10 minutes late. Hang tight!'], ['Thank you', 'Thank you all for coming to ' + s.text + '!']];
    const ok = b.text.trim().length > 0 && !state.busy;
    return modal('Send an update', close,
      h3Html('Send an update') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + aud.map(([k, label, n]) => '<span ' + on(() => setState({ blast: Object.assign({}, b, { to: k }) })) + ' style="display:flex;align-items:center;min-height:38px;padding:0 13px;border-radius:999px;font-size:14px;font-weight:800;cursor:pointer;' + (b.to === k ? 'background:#0d1117;color:#fff' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;color:#0d1117') + '">' + label + ' · ' + n + '</span>').join('') + '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + tpl.map(([label, text]) => '<span ' + on(() => setState({ blast: Object.assign({}, b, { text }) })) + ' style="display:flex;align-items:center;min-height:32px;padding:0 11px;border-radius:999px;background:#f3f1fe;font-size:13px;font-weight:800;color:#4a3ad4;cursor:pointer">' + label + '</span>').join('') + '</div>' +
      '<textarea class="fld" rows="4" maxlength="320" aria-label="Your update" placeholder="What should people know?" ' + onInput(e => { if (e.type === 'input') setState({ blast: Object.assign({}, state.blast, { text: e.target.value.slice(0, 320) }) }); }) + ' style="' + FIELD + ';resize:none;line-height:1.4">' + esc(b.text) + '</textarea>' +
      '<button type="button" ' + on(() => { if (ok) postUpdate(s); }) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">' + (state.busy === 'save' ? 'Posting…' : 'Post update') + '</button>' +
      '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">It goes to ' + ({ all: 'everyone who RSVP’d or signed up', going: 'the people going', maybe: 'the maybes' }[b.to] || 'them') + ', on the event and in their notifications.</p>',
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
            '<b style="color:' + (e.kind === 'stall' ? '#9b1c31' : '#0d1117') + '">' + esc(e.kind) + (e.kind === 'layout' ? '' : ' ' + (e.ms / 1000).toFixed(1) + 's') + '</b> · ' + esc(e.screen || '') + ' · ' + esc(clock(e.at)) +
            (e.note ? '<br>' + esc(e.note) : '') + '</div>').join('') +
          '<button type="button" ' + on(() => { try { localStorage.removeItem(DIAG_KEY); } catch (e) { /* blocked */ } render(); }) + ' style="align-self:flex-start;min-height:36px;padding:0 14px;border:1.5px solid #dcdfe6;border-radius:999px;background:#fff;color:#0d1117;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer">Clear</button>'
        : '<div style="font-size:13.5px;font-weight:600;color:#8a909b">Nothing logged yet.</div>') +
    '</div>';
  };

  // The owner's way into the inbox (top of the Profile sheet)
  const fbInboxCard = () => {
    const n = (state.fbInbox || []).length, u = fbUnread();
    return '<div ' + on(() => { setState({ fbOpen: true }); loadFeedback(); }) + ' aria-label="Feedback inbox' + (u ? ', ' + u + ' new' : '') + '" class="hov-row" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<span style="flex:0 0 42px;width:42px;height:42px;border-radius:12px;background:#fdf1d6;display:flex;align-items:center;justify-content:center">' + svg(20, stroke('#8f6405', 2.2), '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z"/>') + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:900;color:#0d1117">Feedback inbox</div><div style="font-size:13px;font-weight:500;color:#6b7280">' + (n ? n + (n === 1 ? ' note' : ' notes') + ' from testers' : 'Notes from testers land here') + '</div></div>' +
      (u ? '<span style="flex:0 0 auto;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#e2556b;color:#fff;font-size:11.5px;font-weight:900;display:flex;align-items:center;justify-content:center;box-sizing:border-box">' + (u > 9 ? '9+' : u) + '</span>' : '') +
      I.chevR(16, '#9aa0ac', 2.4) + '</div>';
  };

  // The owner's way into the New accounts list (under the Feedback inbox card); hidden until new_accounts() has answered
  const acctCard = () => {
    if (!Array.isArray(state.accts)) return '';
    const n = state.accts.length, u = acctUnread();
    return '<div ' + on(() => { setState({ acctOpen: true }); loadAccounts(); }) + ' aria-label="New accounts' + (u ? ', ' + u + ' new' : '') + '" class="hov-row" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<span style="flex:0 0 42px;width:42px;height:42px;border-radius:12px;background:#fdf1d6;display:flex;align-items:center;justify-content:center">' + svg(20, stroke('#8f6405', 2.2), '<circle cx="10" cy="8" r="4"/><path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6"/>') + '</span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:900;color:#0d1117">New accounts</div><div style="font-size:13px;font-weight:500;color:#6b7280">' + (n ? n + (n === 1 ? ' account so far' : ' accounts so far') : 'Everyone who signs up lands here') + '</div></div>' +
      (u ? '<span style="flex:0 0 auto;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#e2556b;color:#fff;font-size:11.5px;font-weight:900;display:flex;align-items:center;justify-content:center;box-sizing:border-box">' + (u > 9 ? '9+' : u) + '</span>' : '') +
      I.chevR(16, '#9aa0ac', 2.4) + '</div>';
  };

  // v6 Update 2: a compact Profile sheet (photo, name, a pencil to edit); Help & info tiles, then Settings
  function viewProfileSheet() {
    const close = () => setState({ profSheet: false, fbHint: false });
    const st = state, avatar = st.myAvatar ? photoUrl(st.myAvatar) : null;
    const ROW = 'display:flex;align-items:center;gap:12px;min-height:60px;padding:10px 16px;cursor:pointer;text-decoration:none';
    const line = (title, sub) => '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#0d1117">' + title + '</div><div style="font-size:13px;font-weight:500;color:#6b7280">' + sub + '</div></div>';
    const section = (label, inner) => '<div style="display:flex;flex-direction:column;gap:8px"><span style="padding:0 4px;' + EYEBROW + '">' + label + '</span><div style="' + CARD + ';overflow:hidden">' + inner + '</div></div>';
    // The owner's mock (2026-10-02): each tile has its colour along the top edge and a solid icon square
    const tile = (icon, title, sub, fn, color, hint) => '<div ' + on(fn) + ' aria-label="' + esc(title) + '" data-help-tile' + (hint ? ' data-fb-hint' : '') + ' class="hov-row' + (hint ? ' fb-hint' : '') + '" style="position:relative;display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:18px;border-top:3px solid ' + color + ';background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      (hint ? '<span aria-hidden="true" style="position:absolute;top:-12px;right:10px;padding:3px 9px;border-radius:999px;background:#e8a71c;color:#fff;font-size:11.5px;font-weight:900;letter-spacing:.4px">RIGHT HERE</span>' : '') +
      '<span aria-hidden="true" style="width:42px;height:42px;border-radius:12px;background:' + color + ';color:#fff;display:flex;align-items:center;justify-content:center">' + icon + '</span>' +
      '<div><div style="font-size:16.5px;line-height:1.2;font-weight:900;letter-spacing:-.2px;color:#0d1117;text-wrap:balance">' + title + '</div><div style="margin-top:4px;font-size:13.5px;line-height:1.35;font-weight:500;color:#5c6270">' + sub + '</div></div></div>';
    return sheet6('Profile', close,
      '<div style="display:flex;align-items:center;gap:14px;padding:2px 2px 4px">' +
        '<span ' + on(openProfileEdit) + ' aria-label="Change photo" style="display:flex;cursor:pointer">' + avatarSpan(st.me, st.myName, avatar, 56) + '</span>' +
        '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px">' +
          '<span style="min-width:0;font-size:20px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(st.myName || 'No name yet') + '</span>' +
          '<span ' + on(openProfileEdit) + ' aria-label="Edit profile" style="flex:0 0 32px;width:32px;height:32px;border-radius:999px;color:#9aa0ac;display:flex;align-items:center;justify-content:center;cursor:pointer">' + svg(15, stroke('currentColor', 2.2), '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>') + '</span></div>' +
        closeX(close) + '</div>',
      '<div style="padding:18px 14px 30px;display:flex;flex-direction:column;gap:20px">' + (st.demoAdmin ? '<div style="display:flex;flex-direction:column;gap:10px">' + fbInboxCard() + acctCard() + '</div>' : '') +
        '<div style="display:flex;flex-direction:column;gap:10px"><h2 style="margin:0;padding:0 4px;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117">Help &amp; info</h2>' +
          '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' +
            tile('<span style="font-size:17px;font-weight:900">?</span>', 'How this works', 'Events and pitching in', () => go('how', { howFrom: state.screen }), '#5b4ae8') +
            tile(svg(17, stroke('currentColor', 2.4), '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>'), 'Give feedback', 'Tell Eric what you think', () => setState({ fb: { text: '', nudge: !!st.fbHint }, fbHint: false }), '#149a4b', !!st.fbHint) +
          '</div></div>' +
        section('Settings',
          '<div ' + on(() => setState({ nSettings: true })) + ' class="hov-row" style="' + ROW + '">' + line('Notifications', 'In the app and on your phone') + I.chevR(16, '#9aa0ac', 2.4) + '</div>' +
          (installMode() ? '<div ' + on(startInstall) + ' class="hov-row" style="' + ROW + ';border-top:1px solid #f2f3f6">' + line('Add to Home Screen', installMode() === 'prompt' ? 'Install Spark Hub on this phone' : 'A few taps in ' + IOS_BROWSER + '’s Share menu') + I.chevR(16, '#9aa0ac', 2.4) + '</div>' : '') +
          '<a href="/privacy.html" target="_blank" rel="noopener" class="hov-row" style="' + ROW + ';border-top:1px solid #f2f3f6">' + line('Privacy', 'Who sees your profile and events') + I.chevR(16, '#9aa0ac', 2.4) + '</a>') +
        '<div style="display:flex;flex-direction:column;gap:14px">' +
          testerCard() +
          (st.demoAdmin ? diagCard() : '') +
          '<div ' + on(signOut) + ' style="' + CARD + ';padding:0 16px;min-height:52px;display:flex;align-items:center;cursor:pointer"><span style="font-size:15.5px;font-weight:800;color:#9b1c31">Sign out</span></div>' +
          (st.demoAdmin ? '' : '<span ' + on(() => setState({ acctDel: '' })) + ' data-delete-account style="align-self:center;display:flex;align-items:center;min-height:44px;padding:0 12px;font-size:14px;font-weight:700;color:#6b7280;text-decoration:underline;text-underline-offset:3px;cursor:pointer">Delete my account</span>') +
        '</div>' +
      '</div>', 48);
  }

  // ---------------------------------------------------------------------------
  // 8. Edit group (owners and admins)
  // ---------------------------------------------------------------------------

  const memberFace = (m, size, extra) => {
    const url = m.user_id === state.me ? avatarOf(state.me) : (PHOTO_PATH.test(m.avatar_path || '') ? photoUrl(m.avatar_path) : null);
    return avatarSpan(m.user_id, m.name, url, size, extra);
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
      head6('Edit group', backBtn6(closeGroupPage)) +
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
        (st.gpFail ? '<div role="alert" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:#fdecee;font-size:14px;line-height:1.4;font-weight:600;color:#9b1c31"><span style="flex:1;min-width:0">Couldn’t load the invite code and members.</span>' +
          '<span ' + on(() => openGroupPage(g.id, true)) + ' style="flex:0 0 auto;font-weight:800;text-decoration:underline;text-underline-offset:3px;cursor:pointer">Try again</span></div>' : '') +
        '<div style="display:flex;flex-direction:column;gap:7px">' +
          '<span style="' + LABEL + '">Invite code</span>' +
          '<div style="display:flex;gap:8px"><span style="' + WELL + ';flex:1;font-size:18px;font-weight:900;letter-spacing:4px;color:#0d1117">' + esc(st.gpCode || '······') + '</span>' +
            '<button type="button" class="hov-outline" ' + on(() => { if (st.gpCode) copy(st.gpCode, 'Code copied'); }) + ' aria-label="Copy code" style="' + COPY_BTN + '">Copy</button></div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:7px">' +
          '<span style="' + LABEL + '">Invite link</span>' +
          '<div style="display:flex;gap:8px"><span style="' + WELL + ';flex:1;min-width:0;font-size:14.5px;font-weight:600;color:#5c6270;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(link.replace(/^https?:\/\//, '')) + '</span>' +
            '<button type="button" class="hov-outline" ' + on(() => { if (link) copy(link, 'Invite link copied'); }) + ' aria-label="Copy invite link" style="' + COPY_BTN + '">Copy</button></div>' +
          (owner ? '<span ' + on(() => askNewCode(g)) + ' style="align-self:flex-start;display:flex;align-items:center;min-height:36px;padding:0 2px;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">Get a new invite link</span>' : '') +
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
      : setState({ locText: v, locPlace: null });
    const pick = (p) => { clearTimeout(placeTimer); setState(field === 'offer'
      ? { offerText: p.name, offerPlace: p, offerSuggest: [] }
      : { locText: p.name, locPlace: p, locSuggest: [] }); };
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
  const EV_STEPS = ['title', 'when', 'where', 'details', 'help', 'lead'];   // Who's leading it? is the last step before Review (owner, 2026-10-02, again over v7-4's step 2)
  const EV_NAMES = { title: 'Event title', when: 'Date & time', where: 'Location', details: 'Details', help: 'How people can help', lead: 'Who’s leading it?', review: 'Review' };
  const BIT_PH = ['e.g. Meet by the front desk', 'e.g. Coffee and donuts at 9:30', 'e.g. Kids and dogs welcome'];
  const EV_GRAD = 'linear-gradient(135deg,#5b4ae8,#8a6ff0 55%,#e8a71c)';
  const AMBER_INK = '#8f6405';
  const BIG = 'display:block;box-sizing:border-box;width:100%;min-width:0;min-height:58px;margin:0;border:2px solid #dcdfe6;border-radius:16px;padding:0 16px;font-family:inherit;font-size:17px;font-weight:800;color:#0d1117;background:#fff;outline:none';
  const HINT = 'position:absolute;left:18px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:16.5px;font-weight:400;font-style:italic;color:#b9bcc4;white-space:nowrap';
  const DARK_X = svg(14, stroke('#fff', 2.6), '<path d="M6 6l12 12M18 6 6 18"/>');
  const PENCIL = '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>';
  const CAMERA = '<path d="M4 8.5A2 2 0 0 1 6 6.5h1.8l1.4-2h5.6l1.4 2H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.4"/>';
  const POLL_IC = '<path d="M5 20V11M12 20V5M19 20v-6"/>';
  const FLASK_IC = '<path d="M9.5 3.5h5M10.5 3.5v5.2L5.2 18a1.8 1.8 0 0 0 1.6 2.6h10.4a1.8 1.8 0 0 0 1.6-2.6l-5.3-9.3V3.5"/><path d="M7.6 14.5h8.8"/>';
  const BULB_IC = '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z"/>';
  const HAND_IC = P6.clip;   // the clipboard used for helping everywhere (owner, 2026-10-01)
  const LINES_IC = '<path d="M5 7h14M5 12h14M5 17h9"/>';
  const TRASH_IC = '<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>';
  const PEOPLE_IC = '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16 14.2a4.5 4.5 0 0 1 5 4.8"/>';
  const LOCK_IC = '<rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>';

  // Older events kept several sentences in one line, or a paragraph in `vision` (the retired "What you're picturing";
  // only demo events have one): one bullet per sentence. Saving Basic details moves it into the bullets.
  const splitBits = (arr) => [].concat(...(arr || []).map(b => String(b || '').split(/(?<=[.!?])\s+/))).map(x => x.trim()).filter(Boolean);
  const basicsOf = (s) => s.hopes.length ? s.hopes.map(x => String(x || '').trim()).filter(Boolean) : splitBits([s.vision]);   // a line is never split at its sentences (owner, 2026-10-01)
  const evPhotoUrl = (st) => st.photos[0] ? st.photos[0].url : (PHOTO_PATH.test(st.evPhotoPath || '') ? photoUrl(st.evPhotoPath) : null);
  const evFilled = (st) => ({ title: !!cleanTitle(st.activity) && st.evTest != null, when: !!st.evDate || !!st.evDatePoll, where: !!cleanTitle(st.locText) || !!st.evSpotPoll,
    details: st.evBits.some(b => b.trim()) || (MIN_PEOPLE && !st.evDate && st.evNeed > 0), help: st.evNeeds.length > 0, lead: true });   // leading it is already picked
  // "Sat, Oct 24 · 10am", "Sat, Oct 24 · 10am – 12pm"
  const dayLabel = (d, t, e) => d ? fmtDay(d) + (t ? ' · ' + (e ? spanTime({ time: t, endTime: e }) : fmtTime(t)) : '') : '';
  const jobMeta = (j) => j.shifts ? j.shifts.length + (j.shifts.length === 1 ? ' shift' : ' shifts')
    : (j.need ? j.need + (j.need === 1 ? ' person' : ' people') : 'Anyone') + (j.time ? ' · ' + fmtTime(j.time) : '');
  const evStarted = (st) => !!(cleanTitle(st.activity) || st.evDate || st.evDatePoll || cleanTitle(st.locText) || st.evSpotPoll || st.evBits.some(b => b.trim()) || st.evNeeds.length);
  const evGroupIds = (st) => {
    const mine = myGroups().map(g => g.id), list = (st.evGroups || []).filter(id => mine.indexOf(id) > -1), g = currentGroup();
    return list.length ? list : g ? [g.id] : [];
  };
  // Several groups in one line: "Torrez Fitness & 1 other", "… & 2 others" (owner, 2026-10-02)
  const groupsShort = (names) => names.length <= 1 ? (names[0] || '') : names[0] + ' & ' + (names.length - 1) + (names.length === 2 ? ' other' : ' others');
  const namesList = (names) => names.length > 2 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names.join(' and ');

  const composeReset = () => {
    state.photos.forEach(p => URL.revokeObjectURL(p.url));
    dropKept();
    return blankCompose();
  };
  // Create event, kept as it's typed (owner, 2026-10-02): a phone can drop the tab while someone looks up an address,
  // and the reload used to lose the whole event. This tab's storage only, the same account only, half a day at most.
  // A picked photo is kept too (owner, 2026-10-02), under its own key and written once per photo, not on every keystroke.
  const COMPOSE_KEEP = 'spark-hub-compose', COMPOSE_PHOTO = 'spark-hub-compose-photo';
  let keptBlob = null;
  function keepCompose() {
    try {
      const ph = state.photos[0] ? state.photos[0].blob : null;
      if (ph !== keptBlob) {
        keptBlob = ph;
        if (!ph) sessionStorage.removeItem(COMPOSE_PHOTO);
        else blobToDataUrl(ph).then(u => { try { if (keptBlob === ph) sessionStorage.setItem(COMPOSE_PHOTO, u); } catch (e) { /* too big for this tab's storage: the rest is still kept */ } }).catch(() => {});
      }
      if (!state.email || !evStarted(state)) return;
      const data = { me: state.me, at: Date.now(), evDraftId: state.evDraftId || null, evPhoto: state.evPhotoPath || null, evFrom: state.evFrom || null };
      DRAFT_FIELDS.forEach(k => { data[k] = state[k]; });
      sessionStorage.setItem(COMPOSE_KEEP, JSON.stringify(data));
    } catch (e) { /* storage full or off: nothing kept */ }
  }
  function dropKept() { keptBlob = null; try { sessionStorage.removeItem(COMPOSE_KEEP); sessionStorage.removeItem(COMPOSE_PHOTO); } catch (e) { /* fine */ } }
  const keptCompose = (me) => {
    try {
      const d = JSON.parse(sessionStorage.getItem(COMPOSE_KEEP) || 'null');
      return d && d.me === me && Date.now() - d.at < 12 * 3600 * 1000 ? d : null;
    } catch (e) { return null; }
  };
  const goCompose = (extra) => {
    setState({ menu: null });
    if (state.email && !currentGroup()) {
      if (state.error === 'load') { toast('Couldn’t load your groups yet. Trying again…'); retryNow(); return; }
      if (state.loaded) openJoin(); return;   // groups still loading: wait
    }
    const pre = extra && !extra.type ? extra : {};   // on(goCompose) passes the click event
    const from = ORIGINS.indexOf(state.screen) > -1 || state.screen === 'detail' ? state.screen : null;   // where Never mind, X and Discard go back to
    go('compose', Object.assign(composeReset(), pre, { evFrom: from }));
  };
  const evGo = (k, extra) => setState(Object.assign({ evStep: k, menu: null, timeOpen: null }, extra || {}));
  // Out of Create event without posting: on to the tab they tapped, else back where it was opened from
  const evExit = () => {
    const to = state.evLeaveTo, from = state.evFrom && (state.evFrom !== 'detail' || subject()) ? state.evFrom : 'calendar';
    if (to) { setState(composeReset()); to(); } else go(from, composeReset());
  };
  // Real or test? (owner, 2026-10-01): a pop-up over Create event until it's answered, no default, so nobody posts a test
  // as real by accident. Closing it before choosing backs out of Create event entirely; reopened from Review, it just closes
  function viewKindAsk() {
    const st = state, again = st.evTest != null;
    const close = () => again ? setState({ evKindAsk: false }) : evExit();
    const pick = (test) => setState({ evTest: test, evKindAsk: false });
    // The owner's mock (2026-10-01): Real is the lavender Led by look with sparkles, Just testing is gold with confetti
    const opt = (test, label, sub, icon) => { const onIt = st.evTest === test;
      const T = test ? { bg: 'linear-gradient(135deg,#fdf4d8,#fbe6b2)', tile: '#efc95a', ic: '#3d2a00', ink: '#3d2a00', sub: '#6b4d00', ring: '#d9a83a', shadow: 'rgba(176,132,20,.25)' }
        : { bg: 'linear-gradient(135deg,#f1edff,#e0d8ff)', tile: '#5b4ae8', ic: '#fff', ink: '#2a1f8f', sub: '#4a3ad4', ring: '#5b4ae8', shadow: 'rgba(91,74,232,.3)' };
      const bits = test
        ? '<span aria-hidden="true" style="position:absolute;right:18%;top:16%;width:9px;height:9px;border-radius:2px;background:#e8b84a;transform:rotate(20deg)"></span><span aria-hidden="true" style="position:absolute;right:8%;top:58%;width:8px;height:5px;border-radius:2px;background:#f0a35a;transform:rotate(-25deg)"></span><span aria-hidden="true" style="position:absolute;right:30%;bottom:12%;width:6px;height:6px;border-radius:999px;background:#fff"></span>'
        : '<span aria-hidden="true" style="position:absolute;right:20%;top:12%;font-size:11px;color:#9d93f7">✦</span><span aria-hidden="true" style="position:absolute;right:9%;top:48%;font-size:13px;color:#7b6ef0">✦</span><span aria-hidden="true" style="position:absolute;right:38%;bottom:10%;font-size:8px;color:#b8aefc">✦</span>';
      return '<button type="button" ' + on(() => pick(test)) + ' data-ev-kind="' + (test ? 'test' : 'real') + '" aria-pressed="' + onIt + '" style="position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;width:100%;padding:18px 16px;border:0;border-radius:24px;font-family:inherit;text-align:left;cursor:pointer;background:' + T.bg + ';box-shadow:' + (onIt ? 'inset 0 0 0 2.5px ' + T.ring : 'none') + '">' + bits +
        '<span style="position:relative;flex:0 0 54px;width:54px;height:54px;border-radius:18px;background:' + T.tile + ';box-shadow:0 6px 14px ' + T.shadow + ';display:flex;align-items:center;justify-content:center;color:' + T.ic + '">' + svg(24, stroke('currentColor', 2.2), icon) + '</span>' +
        '<span style="position:relative;flex:1;min-width:0"><span style="display:block;font-size:19px;font-weight:900;letter-spacing:-.3px;color:' + T.ink + '">' + label + '</span><span style="display:block;margin-top:3px;font-size:14.5px;line-height:1.4;font-weight:600;color:' + T.sub + '">' + sub + '</span></span></button>'; };
    return modal('Real or test?', close,
      h3Html('Real or test?') + paraHtml('Trying the app out? Post a test. It shows a DEMO tag and no one gets notified.') +
      '<div data-ev-kinds style="display:flex;flex-direction:column;gap:12px">' +
        opt(false, 'Real event', 'It’s happening. Your groups hear about it.', P6.cal) + opt(true, 'Just testing', 'Shows a DEMO tag. No one gets notified.', FLASK_IC) + '</div>' +
      (again ? '' : '<span ' + on(close) + ' data-ev-back-out style="align-self:center;display:flex;align-items:center;min-height:40px;font-size:14px;font-weight:800;color:#6b7280;cursor:pointer">Never mind</span>'), { z: 60 });
  }
  // Who's leading it? (v7-4's cards, 1a): the last step of Create event before Review (owner, 2026-10-02), and Review's
  // Lead card opens it in a pop-up. Two tinted cards, I'll lead it (purple, chosen to begin with) and Just float the idea (yellow), each with a
  // rounded checkbox; the one not picked fades. In the pop-up a pick closes it
  const LEAD_WHY = 'The lead picks the date and place. You can add co-leads and jobs later.';
  const leadOptions = (st, pop) => {
    const pick = (float) => setState(Object.assign({ evFloat: float }, pop ? { evPop: null } : {}));
    const card = (float, title, sub, icon, C) => { const onIt = !!st.evFloat === float;
      return '<button type="button" ' + on(() => pick(float)) + ' data-ev-lead="' + (float ? 'float' : 'me') + '" aria-pressed="' + onIt + '" style="display:flex;align-items:center;gap:14px;width:100%;padding:16px;border:0;border-radius:20px;font-family:inherit;text-align:left;cursor:pointer;transition:opacity .2s,filter .2s,box-shadow .2s;background:' + C.bg + ';box-shadow:' +
          (onIt ? 'inset 0 0 0 2px ' + C.main + ', 0 8px 20px ' + C.glow : 'inset 0 0 0 1.5px ' + C.ring + ';opacity:.62;filter:saturate(.55)') + '">' +
        '<span style="flex:0 0 48px;width:48px;height:48px;border-radius:14px;background:' + C.main + ';display:flex;align-items:center;justify-content:center">' + svg(24, stroke('#fff', 2.3), icon) + '</span>' +
        '<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font-size:18px;font-weight:900;color:' + C.ink + '">' + title + '</span>' +
          '<span style="font-size:14px;line-height:1.4;font-weight:600;color:' + C.sub + '">' + sub + '</span></span>' +
        '<span aria-hidden="true" style="flex:0 0 26px;width:26px;height:26px;box-sizing:border-box;border-radius:7px;background:' + (onIt ? C.main : '#fff') + ';border:2px solid ' + (onIt ? C.main : C.ring) + ';display:flex;align-items:center;justify-content:center">' +
          (onIt ? svg(14, stroke('#fff', 3.6), '<path d="m5 12 5 5 9-10"/>') : '') + '</span></button>'; };
    return '<div data-ev-leads role="radiogroup" aria-label="Who’s leading it?" style="display:flex;flex-direction:column;gap:10px">' +
      card(false, 'I’ll lead it', 'You make sure it happens and make final calls. Others can help!', '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
        { main: '#5b4ae8', bg: '#f1eefe', ring: '#c9c2fb', glow: 'rgba(91,74,232,.18)', ink: '#2b1f9e', sub: '#4a3ad4' }) +
      card(true, 'Just float the idea', 'Someone else might pick it up', '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z"/>',
        { main: '#e8a71c', bg: '#fdf4dc', ring: '#f3d58a', glow: 'rgba(232,167,28,.2)', ink: '#5c3f00', sub: '#8f6405' }) +
      '</div>';
  };
  // The phone's Back (or the browser's) inside the post flow: close the open sheet, else go back a step,
  // else ask about a draft. False only when there's nothing to lose, so the flow can close.
  const composeBack = () => {
    const st = state;
    if (st.busy) return true;
    if (st.evKindAsk) { setState({ evKindAsk: false }); return true; }
    if (st.pollSheet || st.needSheet || st.evLeave || st.timeOpen || st.dateOpen) { setState({ pollSheet: null, needSheet: null, evLeave: false, evLeaveTo: null, timeOpen: null, dateOpen: null }); return true; }
    if (st.evPop) { if (st.evPop !== 'title' || cleanTitle(st.activity)) setState({ evPop: null }); else toast('Add a title first'); return true; }
    if (st.evStep === 'review') { evGo(EV_STEPS[EV_STEPS.length - 1]); return true; }
    if (st.evFromReview) { evGo('review', { evFromReview: false }); return true; }
    const i = EV_STEPS.indexOf(st.evStep);
    if (i > 0) { evGo(EV_STEPS[i - 1]); return true; }
    if (evStarted(st)) { setState({ evLeave: true }); return true; }
    return false;
  };

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

  // After a save that worked: refresh, tolerating one failed try (the next background refresh catches up)
  const freshAfterSave = async () => {
    try { await loadFresh(); } catch (e) {
      console.error(e);
      try { await loadFresh(); } catch (e2) { console.error(e2); }
    }
  };
  const postEvent = () => {
    const st = state, groups = evGroupIds(st);
    if (!groups.length || st.busy || !cleanTitle(st.activity) || st.evTest == null) return;
    if (st.evDate && st.evDate < todayISO()) { evGo('when'); toast('That date has passed. Pick a new one.'); return; }
    const place = st.locPlace && cleanTitle(st.locText) ? st.locPlace : null, spot = cleanTitle(st.locText).slice(0, 80) || null;
    const who = (st.myName || 'Someone').slice(0, 40), dated = !!st.evDate, float = !!st.evFloat, plan = dated && !float;   // a date posts it as a plan; without one, or floated (no lead yet), it's an idea
    let id = null, cover = null;
    setState({ busy: 'post' });
    (async () => {
      try {
        await ensureSession();
        cover = await evCover(st);
        const row = {
          group_id: groups[0], author_name: st.myName, text: cleanTitle(st.activity).slice(0, 40),
          hopes: st.evBits.map(b => b.trim().slice(0, 60)).filter(Boolean), vision: null,
          photos: cover ? [cover.path] : [], cat: 'events', answers: {}, lead_id: st.me, lead_name: st.myName, created_by: st.me,
          spot, spot_open: !spot, spot_address: place ? place.address : null, spot_lat: place ? place.lat : null, spot_lon: place ? place.lon : null,
          day_date: st.evDate || null, day_time: st.evDate && st.evTime ? st.evTime : null, day_end: st.evDate && st.evTime && st.evEnd ? st.evEnd : null,
          planned: plan, visibility: st.evPriv ? 'invite' : 'group', guest_invites: !st.evNoGuestInv, min_people: dated || !MIN_PEOPLE ? null : st.evNeed || null, tags: (st.evTags || []).slice(0, 2),
          cover_pos: cover && st.coverPos ? posOf(st.coverPos, IDEA_POS) : null
        };
        if (float) row.wants_host = true;   // Just float the idea: it goes up looking for a lead, and the group gets no push (20261102020000_float_and_ask.sql)
        if (st.evTest) row.test = true;   // Just testing: the DEMO chip, and no pushes (20261031000000_test_events.sql)
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
        // It's posted: from here a failed tidy-up or refresh mustn't show "didn't go through" (a second tap would post it twice)
        try {
          if (st.evDraftId) {
            must(await sb.from('event_drafts').delete().eq('id', st.evDraftId));
            if (cover && cover.fresh && st.evPhotoPath) deletePhotos([st.evPhotoPath]);   // the draft's old cover
          }
        } catch (e) { console.error(e); }
        await freshAfterSave();
        setState(Object.assign(composeReset(), { busy: null, phaseTab: plan ? 'plan' : 'idea' }));
        // Then straight to asking people (research review, 2026-10-01): a host who lines up one or two people before
        // anyone else sees it makes the event far more likely to happen. Not for "Just testing" events
        // A floated idea asks for a lead instead (owner, 2026-10-02)
        const floated = float && !row.test ? state.sparks.find(x => x.id === id) : null;
        go('detail', Object.assign({ subjectId: id }, row.test || float ? {} : { share: { id, copied: false, ask: true } }));
        if (floated) openLeadAsk(floated);
      } catch (e) {
        console.error(e);
        setState({ busy: null });
        toast(failed(e));
      }
    })();
  };

  // Drafts: the flow's own fields, saved to your account (only you see them)
  const DRAFT_FIELDS = ['activity', 'evStep', 'evDate', 'evTime', 'evEnd', 'evEndOn', 'locText', 'locPlace', 'evBits', 'evNeed', 'evTags', 'evNeeds', 'evDatePoll', 'evSpotPoll', 'evLater', 'evPriv', 'evNoGuestInv', 'evTest', 'evFloat', 'evHelpNone', 'evGroups', 'coverPos'];
  const saveDraft = () => {
    const st = state;
    if (st.busy) return;
    if (!cleanTitle(st.activity)) { setState({ evLeave: false, evLeaveTo: null }); evGo('title'); toast('Add a title first so you can find it later'); return; }
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
        cover = null;   // saved: the draft now points at this photo, so a later failure mustn't delete it
        if (st.evPhotoPath && data.evPhoto !== st.evPhotoPath) deletePhotos([st.evPhotoPath]);
        await freshAfterSave();
        const to = state.evLeaveTo;
        setState(Object.assign(composeReset(), { busy: null }));
        if (to) to(); else go('home');
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
      evDate: /^\d{4}-\d{2}-\d{2}$/.test(x.evDate || '') && x.evDate >= todayISO() ? x.evDate : '', evTime: str(x.evTime), evEnd: str(x.evEnd), evEndOn: !!x.evEndOn,
      locText: str(x.locText).slice(0, 80), locPlace: x.locPlace && typeof x.locPlace === 'object' ? x.locPlace : null,
      evBits: [0, 1, 2].map(i => str((x.evBits || [])[i]).slice(0, 60)), evNeed: Number.isInteger(x.evNeed) && x.evNeed > 0 ? Math.min(x.evNeed, 99) : null, evTags: (arr(x.evTags) || []).filter(k => TYPES6.some(t => t[0] === k)).slice(0, 2), evNeeds: arr(x.evNeeds) || [],
      evDatePoll: arr(x.evDatePoll), evSpotPoll: arr(x.evSpotPoll), evLater: x.evLater && typeof x.evLater === 'object' ? x.evLater : {},
      evPriv: !!x.evPriv, evNoGuestInv: !!x.evNoGuestInv, evTest: typeof x.evTest === 'boolean' ? x.evTest : null, evFloat: !!x.evFloat, evHelpNone: !!x.evHelpNone, evGroups: arr(x.evGroups), coverPos: x.coverPos || null,
      evPhotoPath: PHOTO_PATH.test(x.evPhoto || '') ? x.evPhoto : null, evDraftId: d.id
    });
    return out;
  };
  const resumeDraft = (d) => goCompose(draftState(d));
  const deleteDraft = (d) => {
    if (state.viewAs) return run(async () => {});
    const drafts = state.drafts;
    setState({ drafts: drafts.filter(x => x.id !== d.id) });
    toast('Draft deleted', true);
    ensureSession().then(() => sb.from('event_drafts').delete().eq('id', d.id)).then(r => {
      if (r.error) throw r.error;
      if (PHOTO_PATH.test((d.data || {}).evPhoto || '')) deletePhotos([d.data.evPhoto]);
    }).catch(e => { console.error(e); setState({ drafts }); toast(failed(e)); });
  };
  const agoSaved = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'Saved just now' : m < 60 ? 'Saved ' + m + ' min ago' : m < 1440 ? 'Saved ' + Math.round(m / 60) + 'h ago' : 'Saved ' + Math.round(m / 1440) + 'd ago'; };
  const draftStep = (x) => x.evStep === 'review' ? EV_STEPS.length : Math.max(0, EV_STEPS.indexOf(x.evStep));
  const draftCover = (x) => x.evPhotoPath ? '#2b303a ' + bg(photoUrl(x.evPhotoPath)) : EV_GRAD;
  // A draft as a card in Your tasks' Leading row (owner, 2026-10-01): the cover (or the post flow's gradient) with the
  // title and DRAFT · saved time, then the 5-step bar, Up next and Continue; a tap anywhere picks it up, the trash deletes it
  const draftCard6 = (d) => {
    const x = draftState(d), j = draftStep(x), t = cleanTitle(x.activity) || 'Untitled event';
    return '<div ' + on(() => resumeDraft(d)) + ' data-draft="' + esc(x.activity) + '" aria-label="Draft: ' + esc(t) + '" style="' + CARD6 + '">' +
      '<div style="position:relative;height:92px;background:' + draftCover(x) + '">' +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.9) 0%, rgba(13,17,23,.45) 60%, rgba(13,17,23,.2) 100%)"></div>' +
        '<span ' + on((e) => { stop(e); if (!state.busy) deleteDraft(d); }) + ' aria-label="Delete draft" style="position:absolute;top:8px;right:8px;width:32px;height:32px;border-radius:999px;background:rgba(13,17,23,.35);display:flex;align-items:center;justify-content:center;cursor:pointer">' + svg(15, stroke('#fff', 2.2), TRASH_IC) + '</span>' +
        '<div style="position:absolute;left:14px;right:48px;bottom:11px;display:flex;flex-direction:column;gap:3px;color:#fff">' +
          '<div style="font-size:18px;line-height:1.15;font-weight:900;letter-spacing:-.3px;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(t) + '</div>' +
          '<div style="font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:' + R6.lead.kick + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">DRAFT · ' + esc(agoSaved(d.saved)) + '</div>' +
        '</div></div>' +
      '<div style="padding:11px 12px 12px;display:flex;flex-direction:column;gap:10px">' +
        '<div aria-hidden="true" style="display:flex;gap:3px">' + EV_STEPS.map((_, k) => '<span style="flex:1 1 0;height:4px;border-radius:999px;background:' + (k < j ? '#5b4ae8' : '#d5d8df') + '"></span>').join('') + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span style="min-width:0;font-size:13.5px;font-weight:700;color:#454b55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Up next: ' + esc(EV_NAMES[x.evStep] || 'Event title') + '</span>' +
          '<span ' + on((e) => { stop(e); resumeDraft(d); }) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:32px;padding:0 13px;border-radius:999px;background:' + R6.lead.pill + ';color:' + R6.lead.ink + ';font-size:13px;font-weight:800;cursor:pointer">Continue</span></div>' +
      '</div></div>';
  };
  // The same draft as a row in Leading's View all
  const draftRow6 = (d) => {
    const x = draftState(d), t = cleanTitle(x.activity) || 'Untitled event';
    return '<div ' + on(() => { setState({ dashAll: null }); resumeDraft(d); }) + ' data-draft-all="' + esc(x.activity) + '" aria-label="Draft: ' + esc(t) + '" style="display:flex;align-items:center;gap:12px;padding:12px;background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(15,18,25,.08);cursor:pointer">' +
      '<span aria-hidden="true" style="flex:0 0 40px;width:40px;height:40px;border-radius:10px;background:' + draftCover(x) + '"></span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:15px;line-height:1.25;font-weight:800;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t) + '</div>' +
        '<div style="margin-top:2px;font-size:12.5px;font-weight:600;color:' + R6.lead.ink + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Draft · ' + draftStep(x) + ' of ' + EV_STEPS.length + ' steps · Up next: ' + esc(EV_NAMES[x.evStep] || 'Event title') + '</div></div>' +
      I.chevR(14, '#b9bcc4', 2.6) + '</div>';
  };

  // A 30-minute time list that opens under its field (not a sheet), scrolled to the current value
  // A list or calendar that would run past its pop-up's edge scrolls into view as it opens
  const showDrop = (sel) => setTimeout(() => { const el = document.querySelector(sel); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }, 0);
  // o: { label, slim: no clock icon (a narrow row), h: the field's height (58), none: a first row that clears the time }
  const timeField = (key, value, opts, hint, pick, o) => {
    o = o || {};
    const open = state.timeOpen === key;
    const toggle = () => { setState({ timeOpen: open ? null : key, dateOpen: null }); if (!open) { setTimeout(() => { const el = document.querySelector('[data-time-list] [data-cur]'); if (el) el.parentNode.scrollTop = el.offsetTop - 96; }, 0); showDrop('[data-time-list]'); } };
    return '<div style="position:relative;min-width:0">' +
      '<div ' + on(toggle) + ' aria-label="' + esc(o.label || hint) + '" aria-expanded="' + open + '" style="display:flex;align-items:center;gap:' + (o.slim ? 8 : 10) + 'px;min-height:' + (o.h || 58) + 'px;padding:0 ' + (o.slim ? 12 : 14) + 'px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 2px ' + (open ? '#5b4ae8' : '#dcdfe6') + ';cursor:pointer">' +
        (o.slim ? '' : '<span style="display:flex;color:' + (value ? '#5b4ae8' : '#9aa0ac') + '">' + svg(18, stroke('currentColor', 2.2), P5.clock) + '</span>') +
        '<span style="flex:1;min-width:0;' + (o.slim ? 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' : '') + (value ? 'font-size:17px;font-weight:800;color:#0d1117' : 'font-size:16.5px;font-weight:400;font-style:italic;color:#b9bcc4') + '">' + esc(value ? clock(value) : hint) + '</span>' +
        I.chevD(14, '#9aa0ac', 2.6) + '</div>' +
      (open ? '<div ' + on(() => setState({ timeOpen: null })) + ' aria-hidden="true" style="position:fixed;inset:0;z-index:19"></div>' +
        '<div data-time-list role="listbox" style="scroll-margin:12px;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:20;max-height:236px;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 14px 34px rgba(15,18,25,.2), 0 0 0 1px #e6e7eb;padding:6px;display:flex;flex-direction:column;gap:2px">' +
          (o.none && value ? '<div ' + on(() => pick(''), 'option') + ' aria-selected="false" style="display:flex;align-items:center;min-height:44px;padding:0 12px;border-radius:10px;flex:0 0 auto;font-size:16px;font-weight:700;color:#6b7280;cursor:pointer">' + esc(o.none) + '</div>' : '') +
          opts.map(v => '<div ' + on(() => pick(v), 'option') + ' aria-selected="' + (v === value) + '"' + (v === value ? ' data-cur' : '') + ' style="display:flex;align-items:center;justify-content:space-between;min-height:44px;padding:0 12px;border-radius:10px;flex:0 0 auto;font-size:16px;cursor:pointer;' +
            (v === value ? 'background:#f3f1fe;color:#5b4ae8;font-weight:900' : 'color:#0d1117;font-weight:700') + '"><span>' + clock(v) + '</span>' + (v === value ? I.check(16, '#5b4ae8', 3) : '') + '</div>').join('') + '</div>' : '') +
    '</div>';
  };
  // The date picker (owner, 2026-10-01: the browser's own calendar looked old next to the time list): a field like the
  // time field that opens our month grid. Past days can't be picked; the chosen day is purple, today has a ring.
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateField = (value, label, hint, set, extra, anyDay) => {   // anyDay: past days too (fixing a past event's date)
    const open = state.dateOpen === label, today = todayISO();
    const month = (open && state.calMonth) || (value || today).slice(0, 7);
    const toggle = () => { setState({ dateOpen: open ? null : label, calMonth: (value || today).slice(0, 7), timeOpen: null }); if (!open) showDrop('[data-calendar]'); };
    const shift = (n) => { const [y, m] = month.split('-').map(Number), d = new Date(y, m - 1 + n, 1); setState({ calMonth: d.getFullYear() + '-' + pad2(d.getMonth() + 1) }); showDrop('[data-calendar]'); };
    const pick = (iso) => { setState({ dateOpen: null }); set(iso); };
    const grid = () => {
      const [y, m] = month.split('-').map(Number), first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate(), cells = [];
      for (let k = 0; k < first; k++) cells.push('<span></span>');
      for (let d = 1; d <= days; d++) {
        const iso = month + '-' + pad2(d), past = !anyDay && iso < today, on_ = iso === value, now = iso === today;
        cells.push('<span ' + (past ? 'aria-disabled="true"' : on(() => pick(iso))) + ' data-day="' + iso + '" aria-label="' + esc(fmtDay(iso)) + '"' + (on_ ? ' aria-pressed="true"' : '') +
          ' style="justify-self:center;width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:' + (on_ || now ? 800 : 700) + ';' +
          (on_ ? 'background:#5b4ae8;color:#fff;cursor:pointer' : past ? 'color:#c9ccd3' : 'color:' + (now ? '#5b4ae8' : '#0d1117') + ';cursor:pointer' + (now ? ';box-shadow:inset 0 0 0 1.5px #5b4ae8' : '')) + '"' +
          (past || on_ ? '' : ' class="hov-grey-fill"') + '>' + d + '</span>');
      }
      return cells.join('');
    };
    const roundBtn = (dis, fn, icon, lbl) => '<span ' + (dis ? 'aria-disabled="true"' : on(fn)) + ' aria-label="' + lbl + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;' + (dis ? 'opacity:.35' : 'cursor:pointer') + '">' + icon + '</span>';
    return '<div style="position:relative;min-width:0;' + (extra || '') + '">' +
      '<div ' + on(toggle) + ' aria-label="' + esc(label) + '" aria-expanded="' + open + '" data-date-field style="display:flex;align-items:center;gap:10px;min-height:58px;padding:0 14px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 2px ' + (open ? '#5b4ae8' : '#dcdfe6') + ';cursor:pointer">' +
        '<span style="display:flex;color:' + (value ? '#5b4ae8' : '#9aa0ac') + '">' + svg(18, stroke('currentColor', 2.2), P6.cal) + '</span>' +
        '<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + (value ? 'font-size:17px;font-weight:800;color:#0d1117' : 'font-size:16.5px;font-weight:400;font-style:italic;color:#b9bcc4') + '">' + esc(value ? fmtDay(value) : hint) + '</span>' +
        I.chevD(14, '#9aa0ac', 2.6) + '</div>' +
      (open ? '<div ' + on(() => setState({ dateOpen: null })) + ' aria-hidden="true" style="position:fixed;inset:0;z-index:19"></div>' +
        '<div data-calendar="' + month + '" role="dialog" aria-label="Pick a date" style="scroll-margin:12px;position:absolute;left:0;top:calc(100% + 6px);z-index:20;width:316px;max-width:calc(100vw - 40px);box-sizing:border-box;background:#fff;border-radius:18px;box-shadow:0 14px 34px rgba(15,18,25,.2), 0 0 0 1px #e6e7eb;padding:14px">' +
          '<div style="display:flex;align-items:center;gap:8px;padding:0 2px 10px"><span style="flex:1;font-size:17px;font-weight:900;color:#0d1117">' + MONTH_NAMES[Number(month.slice(5)) - 1] + ' ' + month.slice(0, 4) + '</span>' +
            roundBtn(!anyDay && month <= today.slice(0, 7), () => shift(-1), I.chevL(15, '#0d1117', 2.6), 'Previous month') + roundBtn(false, () => shift(1), I.chevR(15, '#0d1117', 2.6), 'Next month') + '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(7,1fr);row-gap:4px">' +
            ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => '<span style="justify-self:center;font-size:12px;font-weight:800;color:#9aa0ac;padding-bottom:4px">' + d + '</span>').join('') + grid() + '</div>' +
          '<div style="display:flex;justify-content:space-between;padding:8px 4px 0">' +
            (value ? '<span ' + on(() => pick('')) + ' aria-label="Clear the date" style="font-size:14px;font-weight:800;color:#9b1c31;cursor:pointer">Clear</span>' : '<span></span>') +
            (value !== today ? '<span ' + on(() => pick(today)) + ' style="font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">Today</span>' : '') + '</div>' +
        '</div>' : '') + '</div>';
  };
  const orLine = () => '<div style="padding:14px 4px 0;display:flex;align-items:center;gap:10px"><span style="flex:1;height:1px;background:#d5d8df"></span><span style="font-size:12px;font-weight:800;letter-spacing:1px;color:#8a909b">OR</span><span style="flex:1;height:1px;background:#d5d8df"></span></div>';
  const pollRow = (fn) => '<div style="padding-top:10px"><div ' + on(fn) + ' class="hov-fill" style="display:flex;align-items:center;gap:12px;min-height:52px;padding:0 14px;border-radius:14px;box-shadow:inset 0 0 0 1.5px #c9ccd3;color:#454b55;cursor:pointer">' +
    svg(16, stroke('currentColor', 2.2), POLL_IC) + '<span style="flex:1;font-size:15px;font-weight:800">Poll the group</span>' + I.chevR(14, '#b9bcc4', 2.6) + '</div></div>';
  const pollCard = (labels, edit, remove) => '<div data-poll style="background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08);padding:14px;display:flex;flex-direction:column;gap:8px">' +
    '<div style="display:flex;align-items:center;gap:10px">' + svg(16, stroke('#5b4ae8', 2.2), POLL_IC) + '<span style="flex:1;font-size:12px;font-weight:800;letter-spacing:1.1px;color:#5b4ae8">POLL · ' + labels.length + ' OPTIONS</span>' +
      '<span ' + on(edit) + ' style="font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span><span ' + on(remove) + ' style="font-size:13.5px;font-weight:800;color:#9b1c31;cursor:pointer">Remove</span></div>' +
    labels.map(l => '<div style="display:flex;align-items:center;min-height:40px;padding:0 12px;border-radius:12px;background:#f4f5f7;font-size:15px;font-weight:800;color:#0d1117">' + esc(l) + '</div>').join('') +
    '<span style="font-size:13px;line-height:1.4;font-weight:500;color:#6b7280">People vote once it’s posted. You pick the winner.</span></div>';
  const openPoll = (kind) => {
    const st = state, rows = kind === 'when'
      ? (st.evDatePoll ? st.evDatePoll.map(r => Object.assign({}, r)) : [{ d: st.evDate || '', t: st.evDate ? st.evTime || '' : '' }, { d: '', t: '' }])
      : (st.evSpotPoll ? st.evSpotPoll.map(r => Object.assign({}, r)) : [{ v: cleanTitle(st.locText) }, { v: '' }]);
    setState({ pollSheet: { kind, rows }, timeOpen: null });
  };
  // "How many people do you want?" (optional; an idea's People step fills against it; wording: owner, 2026-10-02).
  // Hidden everywhere for now (owner, 2026-10-02): the row, Review's line and the People step. min_people stays in
  // the database and is kept as it is; set MIN_PEOPLE to true to bring it all back
  const MIN_PEOPLE = false;
  const needRow = (n, set) => !MIN_PEOPLE ? '' : '<div data-need-people style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 2px #dcdfe6">' +
    '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">How many people do you want?</div>' +
      '<div style="margin-top:1px;font-size:12.5px;line-height:1.35;font-weight:600;color:#6b7280;text-wrap:pretty">' + (n ? 'It’s a go once ' + n + (n === 1 ? ' person is' : ' people are') + ' in.' : 'What’s the minimum number that would make this feel like a success?') + '</div></div>' +
    stepper(n, set, 'how many people needed') + '</div>';
  const bitRows = (bits, set) => bits.map((v, k) => '<label style="display:flex;align-items:center;gap:10px;min-height:58px;padding:0 16px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 2px #dcdfe6;cursor:text">' +
    '<span aria-hidden="true" style="flex:0 0 7px;width:7px;height:7px;border-radius:999px;background:' + (v.trim() ? '#0f7a3c' : '#c9ccd3') + '"></span>' +
    '<input class="bit-fld" type="text" maxlength="60" aria-label="Details, line ' + (k + 1) + '" placeholder="' + esc(BIT_PH[k]) + '" value="' + esc(v) + '" ' + onInput(e => { if (e.type === 'input') set(k, e.target.value.slice(0, 60)); }) +
      ' style="flex:1 1 auto;min-width:0;border:0;padding:0;background:transparent;font-family:inherit;font-size:17px;font-weight:800;color:#0d1117;outline:none">' +
    (v.length ? '<span style="font-size:11.5px;font-weight:700;color:#9aa0ac">' + v.length + '/60</span>' : '') + '</label>').join('');
  // A starter chip leaves just its verb ("Bring "): Save waits for what (owner, 2026-09-30)
  const JOB_VERBS = ['bring', 'set up', 'help with', 'clean up', 'coordinate'];
  const jobNamed = (item) => { const t = cleanTitle(item || ''); return !!t && JOB_VERBS.indexOf(t.toLowerCase()) < 0; };
  const blankJob = (item) => ({ item: item || '', desc: '', time: '', need: 1, shifts: null });
  const openJob = (i, row) => {
    setState({ needSheet: { i, row } });
    setTimeout(() => { const f = document.querySelector('[data-job-name]'); if (f) { f.focus(); const n = f.value.length; try { f.setSelectionRange(n, n); } catch (e) { /* ignore */ } } }, 60);
  };

  function viewCompose() {
    const st = state, cur = st.evStep, i = EV_STEPS.indexOf(cur), filled = evFilled(st), url = evPhotoUrl(st), title = cleanTitle(st.activity);
    const CLEAR = { when: { evDate: '', evTime: '', evEnd: '', evEndOn: false, evDatePoll: null }, where: { locText: '', locPlace: null, locSuggest: [], evSpotPoll: null }, details: { evBits: ['', '', ''] }, help: { evNeeds: [] } };
    const nextOf = (k) => EV_STEPS[EV_STEPS.indexOf(k) + 1] || 'review';
    const close = () => { if (evStarted(st)) setState({ evLeave: true, timeOpen: null }); else evExit(); };
    const later = (k) => Object.assign({}, st.evLater, { [k]: false });

    if (cur === 'review') {
      // Real or test is a stopgap while people try the app out, and looks it whatever is picked (owner, 2026-10-02):
      // pale yellow, a dashed edge and a hazard-striped band along the top
      const card = (icon, label, has, act, step, inner) => '<div data-review-card="' + step + '" style="' + (step === 'kind'
          ? 'position:relative;overflow:hidden;background:#fffaea;border:2px dashed #d9a83a;border-radius:18px;padding:22px 14px 12px'
          : 'background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08);padding:14px 16px') + ';display:flex;flex-direction:column;gap:10px">' +
        (step === 'kind' ? '<span aria-hidden="true" style="position:absolute;left:0;right:0;top:0;height:9px;background:repeating-linear-gradient(135deg,#f5b729 0 10px,#3d2a00 10px 20px)"></span>' : '') +
        '<div style="display:flex;align-items:center;gap:10px"><span style="flex:0 0 20px;display:flex;color:' + (has ? '#0f7a3c' : '#b07a0a') + '">' + svg(18, stroke('currentColor', 2.2), icon) + '</span>' +
          '<span style="flex:1;font-size:12px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#6b7280">' + label + '</span>' +
          '<span ' + on(() => step === 'kind' ? setState({ evKindAsk: true }) : setState({ evPop: step, timeOpen: null, dateOpen: null })) + ' aria-label="Edit ' + label.toLowerCase() + '" style="font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span></div>' +
        '<div style="padding-left:28px">' + inner + '</div></div>';
      const main = (t, has, sub) => '<div style="font-size:15px;line-height:1.3;font-weight:800;color:' + (has ? '#0d1117' : AMBER_INK) + ';text-wrap:pretty">' + esc(t) + '</div>' +
        (sub ? '<div style="margin-top:2px;font-size:13.5px;line-height:1.35;font-weight:500;color:#6b7280">' + esc(sub) + '</div>' : '');
      const list = (rows) => rows.map((r, k) => '<div style="display:flex;align-items:baseline;gap:10px;padding:8px 0;border-top:' + (k ? '1px solid #f2f3f6' : '0') + '">' + r + '</div>').join('');
      const bits = st.evBits.map(b => b.trim()).filter(Boolean), place = cleanTitle(st.locText);
      const needLine = MIN_PEOPLE && !st.evDate && st.evNeed > 0 ? 'It’s a go once ' + st.evNeed + (st.evNeed === 1 ? ' person is' : ' people are') + ' in.' : '';
      const groups = evGroupIds(st), names = groups.map(id => (groupById(id) || {}).name).filter(Boolean), gOpen = st.menu === 'evGroups', g0 = groupById(groups[0]);
      const tile = (priv, label, sub, icon) => { const onIt = !!st.evPriv === priv;
        return '<div ' + on(() => setState({ evPriv: priv }), 'radio') + ' aria-checked="' + onIt + '" style="flex:1 1 0;display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:14px;cursor:pointer;' + (onIt ? 'background:#f3f1fe;box-shadow:inset 0 0 0 2px #5b4ae8' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6') + '">' +
          '<span style="display:flex;color:' + (onIt ? '#5b4ae8' : '#454b55') + '">' + svg(22, stroke('currentColor', 2.2), icon) + '</span>' +
          '<span style="font-size:15px;font-weight:900;color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + label + '</span><span style="font-size:12.5px;line-height:1.35;font-weight:600;color:#6b7280">' + sub + '</span></div>'; };
      const busy = st.busy === 'post', chosen = st.evTest != null, asPlan = !!st.evDate && !st.evFloat;   // a floated idea keeps its date but isn't a plan
      const pickKind = () => setState({ evKindAsk: true });
      return '<div class="overlay-screen" data-screen-label="New spark"><div style="min-height:100%;display:flex;flex-direction:column">' +
        '<div style="position:relative;flex:0 0 auto;height:210px;background:' + (url ? '#2b303a ' + bg(url) : EV_GRAD) + '">' +
          '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top, rgba(13,17,23,.9) 0%, rgba(13,17,23,.2) 60%, rgba(13,17,23,.3) 100%)"></div>' +
          '<span ' + on(() => evGo(EV_STEPS[EV_STEPS.length - 1])) + ' aria-label="Back" style="position:absolute;top:14px;left:14px;width:40px;height:40px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.12);display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.chevL(14, '#0d1117', 2.6) + '</span>' +
          '<label style="position:absolute;top:16px;right:14px;z-index:2;display:flex;align-items:center;gap:6px;min-height:38px;padding:0 13px;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(13,17,23,.25);font-size:13px;font-weight:800;color:#0d1117;cursor:pointer">' +
            svg(15, stroke('currentColor', 2.2), CAMERA) + (url ? 'Change photo' : 'Add a cover photo') + photoInput('Cover photo') + '</label>' +
          '<div style="position:absolute;left:18px;right:18px;bottom:14px;color:#fff"><div style="font-size:12px;font-weight:900;letter-spacing:1px;color:#e4dfff">LOOKS GOOD</div>' +
            '<div ' + on(() => setState({ evPop: 'title', timeOpen: null, dateOpen: null })) + ' aria-label="Edit the title" style="margin-top:2px;display:flex;align-items:flex-end;gap:10px;cursor:pointer"><span style="font-size:30px;line-height:1.05;font-weight:900;letter-spacing:-.8px;text-wrap:balance;overflow-wrap:anywhere">' + esc(title) + '</span>' +
              svg(18, stroke('#fff', 2.3) + ' style="flex:0 0 18px;margin-bottom:6px;opacity:.85"', PENCIL) + '</div></div>' +
        '</div>' +
        '<div style="padding:16px 14px 0;display:flex;flex-direction:column;gap:18px"><div style="display:flex;flex-direction:column;gap:10px">' +
          card(st.evTest ? FLASK_IC : P6.cal, 'Real or test', chosen, '', 'kind', chosen ? main(st.evTest ? 'Just testing' : 'Real event', true, st.evTest ? 'Shows a DEMO tag. No one gets notified.' : st.evFloat ? 'It shows on the Ideas board.' : 'Your groups hear about it.') : main('Not chosen yet', false)) +
          card(P6.person, 'Lead', true, '', 'lead', st.evFloat ? main('Just floating it', true, 'It goes up as an idea that needs a lead.') : main('You’re leading it', true, 'You pick the date and place and keep it moving.')) +
          card(P6.cal, 'Date &amp; time', filled.when, '', 'when', st.evDatePoll ? main('Poll: ' + st.evDatePoll.length + ' dates', true, 'People vote, you pick') : st.evDate ? main(dayLabel(st.evDate, st.evTime, st.evEnd), true) : main('Date TBD', false)) +
          card(P6.pin, 'Location', filled.where, '', 'where', st.evSpotPoll ? main('Poll: ' + st.evSpotPoll.length + ' locations', true, 'People vote, you pick') : place ? main(place, true, st.locPlace ? st.locPlace.address : '') : main('Location TBD', false)) +
          card(LINES_IC, 'Details', filled.details, '', 'details', bits.length || needLine ? list(bits.concat(needLine ? [needLine] : []).map(t => '<span style="flex:0 0 6px;width:6px;height:6px;border-radius:999px;background:#0f7a3c;transform:translateY(-2px)"></span><span style="font-size:15.5px;line-height:1.35;font-weight:800;color:#0d1117;text-wrap:pretty">' + esc(t) + '</span>')) : main('Details TBD', false)) +
          card(HAND_IC, 'How people can help', filled.help || (st.evHelpNone && !st.evNeeds.length), '', 'help', st.evNeeds.length ? list(st.evNeeds.map(j => '<span style="flex:1;min-width:0;font-size:15.5px;line-height:1.35;font-weight:800;color:#0d1117;text-wrap:pretty">' + esc(cleanTitle(j.item)) + '</span><span style="flex:0 0 auto;font-size:13px;font-weight:700;color:#6b7280">' + esc(jobMeta(j)) + '</span>')) : st.evHelpNone ? main('No help needed', true) : main('Help TBD', false)) +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px"><div style="padding:0 4px;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.5px;color:#0d1117">Who can see it</div>' +
          '<div style="background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08)"><div data-menu style="position:relative">' +
            '<div ' + on((e) => { stop(e); setState({ menu: gOpen ? null : 'evGroups' }); }) + ' aria-label="Post to" aria-expanded="' + gOpen + '" style="display:flex;align-items:center;gap:12px;min-height:58px;padding:10px 14px;cursor:pointer">' +
              '<span aria-hidden="true" style="flex:0 0 36px;width:36px;height:36px;border-radius:11px;background:' + groupBg(g0, '#f3f1fe') + '"></span>' +
              '<div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:#8a909b">Post to</div><div style="font-size:15px;font-weight:800;color:#0d1117">' + esc(groupsShort(names)) + '</div></div>' +
              (myGroups().length > 1 ? '<span style="font-size:13px;font-weight:800;color:#5b4ae8">Choose</span>' : '') + '</div>' +
            (gOpen && myGroups().length > 1 ? '<div style="position:absolute;left:12px;right:12px;top:60px;z-index:20;background:#fff;border-radius:16px;box-shadow:0 12px 32px rgba(15,18,25,.18), 0 0 0 1px #e6e7eb;padding:6px">' +
              groupsInOrder().map(g => groupCheck(g, groups.indexOf(g.id) > -1, (e) => { stop(e); const nx = groups.indexOf(g.id) > -1 ? groups.filter(x => x !== g.id) : groups.concat(g.id); setState({ evGroups: nx.length ? nx : groups }); })).join('') + '</div>' : '') +
          '</div><div style="padding:12px 14px 14px;border-top:1px solid #f2f3f6;display:flex;gap:8px">' +
            tile(false, 'Public', 'Everyone in your groups', PEOPLE_IC) + tile(true, 'Private', 'Only people you invite', LOCK_IC) + '</div>' +
            '<div style="padding:0 14px 14px">' + guestInvSwitch(!st.evNoGuestInv, () => setState({ evNoGuestInv: !st.evNoGuestInv })) + '</div></div></div>' +
        '</div>' +
        // At the end of the page, not stuck over it (owner, 2026-10-01). A date locks it in as a plan (green); without one
        // it goes up as an idea: a gold card saying so, and a gold Post as an idea (owner's mock, 2026-10-01)
        '<div style="padding:18px 14px 24px">' +
          (asPlan
            ? '<div data-posts-as style="padding:0 6px 10px;text-align:center;font-size:13.5px;line-height:1.4;font-weight:600;color:#5c6270">It goes on the calendar as a plan.</div>'
            : '<div data-posts-as style="display:flex;gap:14px;margin-bottom:14px;padding:16px;border-radius:20px;background:#fdf5d6;box-shadow:inset 0 0 0 1.5px #efc95a">' +
                '<span style="flex:0 0 46px;width:46px;height:46px;border-radius:999px;background:#efc95a;display:flex;align-items:center;justify-content:center">' + svg(22, stroke('#3d2a00', 2.2), BULB_IC) + '</span>' +
                '<div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:900;color:#0d1117">' + (st.evFloat ? 'This goes up as an idea that needs a lead' : 'This goes up as an idea') + '</div>' +
                  '<div style="margin-top:3px;font-size:14.5px;line-height:1.45;font-weight:500;color:#454b55">' + (st.evFloat
                    ? 'It shows on the Ideas board, and no one gets notified. ' + (st.evPriv ? 'Someone you invite' : 'Anyone in your groups') + ' can take it on, and you can ask someone. It can’t become a plan until it has a lead.' + (st.evDate ? ' Your date stays on it.' : '')
                    : 'No date yet, so people can vote and suggest times. Once it has a lead (you) and a date, tap <strong style="font-weight:800;color:#0d1117">Make it a plan</strong> to lock it in.') + '</div></div></div>') +
          '<button type="button" ' + on(() => { if (busy) return; if (!chosen) { pickKind(); return; } createEvent(); }) + ' aria-disabled="' + (busy || !chosen) + '" style="position:relative;overflow:hidden;width:100%;min-height:56px;border:0;border-radius:999px;background:' + (asPlan ? '#149a4b;color:#fff' : '#efc95a;color:#3d2a00') + ';font-family:inherit;font-size:17px;font-weight:900;cursor:pointer;box-shadow:0 10px 24px ' + (asPlan ? 'rgba(20,154,75,.32)' : 'rgba(176,132,20,.25)') + (busy ? ';opacity:.72;cursor:wait' : !chosen ? ';opacity:.5' : '') + '">' +
            (asPlan ? ['#ffd98a:6%:18%', '#cfc9ff:22%:68%', '#fff:78%:28%', '#ffb3c1:88%:64%', '#b8f0cd:62%:74%', '#ffd98a:40%:20%'] : ['#fff6d6:5%:12%', '#fff6d6:11%:30%', '#fff6d6:89%:12%', '#fff6d6:94%:32%']).map(c => { const [col, x, y] = c.split(':'); return '<span aria-hidden="true" style="position:absolute;left:' + x + ';top:' + y + ';width:' + (asPlan ? 6 : 9) + 'px;height:' + (asPlan ? 6 : 9) + 'px;border-radius:2px;background:' + col + ';transform:rotate(30deg);opacity:.9"></span>'; }).join('') +
            '<span style="position:relative;display:inline-flex;align-items:center;gap:8px">' + (busy ? 'Posting…' : st.evFloat ? 'Float the idea' : st.evDate ? 'Post it' : 'Post as an idea') + '</span></button>' +
          '<button type="button" ' + on(saveDraft) + ' style="margin-top:12px;width:100%;min-height:50px;background:transparent;border:2px solid #c9ccd3;border-radius:999px;font-family:inherit;font-size:15.5px;font-weight:800;color:#0d1117;cursor:pointer">' + (st.busy === 'draft' ? 'Saving…' : 'Save as draft') + '</button>' +
        '</div></div></div>';
    }

    const body = evBody(st, cur, false);

    // Opened from Review's Edit: Next and Back both return to Review, instead of walking the later steps again
    const ok = filled[cur], back = st.evFromReview;
    const ahead = back ? 'review' : nextOf(cur), aheadX = back ? { evFromReview: false } : {};
    const next = () => { if (!ok) return; evGo(ahead, Object.assign({ evLater: later(cur) }, aheadX)); };
    const hint = ok ? '' : cur === 'title' ? (st.evTest == null ? '' : back ? 'Add a title to go back to Review.' : 'Add a title to keep going.')
      : cur === 'when' && st.evTime ? 'Pick a date to go with that time, or decide later.' : '';
    // Decide later only shows on an empty step (it used to wipe a filled one: every job, the poll…)
    const skip = () => evGo(ahead, Object.assign({}, CLEAR[cur] || {}, aheadX, { evLater: Object.assign({}, st.evLater, { [cur]: true }) }, cur === 'help' ? { evHelpNone: false } : {}));
    // v7 Update 15 (1b): with no job yet, How people can help offers No help needed → (an answer, unlike Decide later)
    const noHelp = cur === 'help' && !st.evNeeds.length;
    const helpNone = () => evGo(ahead, Object.assign({ evHelpNone: true, evLater: Object.assign({}, st.evLater, { help: false }) }, aheadX));
    return '<div class="overlay-screen" data-screen-label="New spark"><div style="display:flex;flex-direction:column;min-height:100%">' +
      '<div style="position:relative;flex:0 0 auto;height:' + (cur === 'title' ? 270 : 200) + 'px;transition:height 240ms ease;background:' + (url ? '#2b303a ' + bg(url) : EV_GRAD) + '">' +
        '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(to top,rgba(13,17,23,.88),rgba(13,17,23,.12) 55%,rgba(13,17,23,.4))"></div>' +
        '<div style="position:absolute;left:0;right:0;top:0;z-index:2"><div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;padding:12px 16px">' +
          '<div style="display:flex"><span ' + on(close) + ' aria-label="Close" style="flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;cursor:pointer">' + DARK_X + '</span></div>' +
          '<span style="font-size:14.5px;font-weight:800;color:#fff">' + (i + 1) + ' of ' + EV_STEPS.length + '</span><div></div></div>' +
          '<div aria-hidden="true" style="height:4px;background:rgba(255,255,255,.22)"><div style="width:' + ((i + 1) / EV_STEPS.length * 100) + '%;height:100%;background:#fff;border-radius:0 999px 999px 0;transition:width 240ms ease"></div></div></div>' +
        '<div style="position:absolute;left:18px;right:18px;bottom:30px;z-index:1;color:#fff"><div style="font-size:11.5px;font-weight:900;letter-spacing:1.2px;color:#ffe7b3">START AN EVENT</div>' +
          '<div style="margin-top:2px;font-size:' + (cur === 'title' ? 30 : 24) + 'px;line-height:1.05;font-weight:900;letter-spacing:-.7px;color:' + (title ? '#fff' : 'rgba(255,255,255,.55)') + ';overflow-wrap:anywhere;text-wrap:balance">' + esc(title || 'Your event') + '</div></div>' +
      '</div>' +
      '<div style="margin-top:-16px;position:relative;z-index:1;flex:1 1 auto;display:flex;flex-direction:column;background:#e8eaee;border-radius:20px 20px 0 0">' + body +
        '<div style="margin-top:auto;padding:14px 16px 20px;display:flex;flex-direction:column;gap:4px">' +
          (hint ? '<div data-step-hint role="status" style="text-align:center;padding-bottom:6px;font-size:13.5px;font-weight:700;color:#6b7280">' + hint + '</div>' : '') +
          (i > 0 && !ok ? '<div style="display:flex;justify-content:center;padding-bottom:4px"><span ' + on(skip) + ' data-later style="display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:999px;color:#6b7280;font-size:14.5px;font-weight:700;cursor:pointer">Decide later' + I.chevR(13, 'currentColor', 2.8) + '</span></div>' : '') +
          '<div style="display:flex;gap:8px">' +
            (i > 0 && !back ? '<button type="button" ' + on(() => evGo(EV_STEPS[i - 1])) + ' style="flex:0 0 auto;min-height:54px;padding:0 22px;background:transparent;border:2px solid #c9ccd3;border-radius:999px;font-family:inherit;font-size:16px;font-weight:800;color:#0d1117;cursor:pointer">Back</button>' : '') +
            (noHelp ? '<button type="button" data-enter data-no-help ' + on(helpNone) + ' style="flex:1 1 auto;min-width:0;min-height:54px;background:#fff;border:2px solid #c9ccd3;border-radius:999px;font-family:inherit;font-size:16.5px;font-weight:800;color:#0d1117;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer">No help needed' + svg(17, stroke('currentColor', 2.6), '<path d="M5 12h14M13 6l6 6-6 6"/>') + '</button>' :
            '<button type="button" data-enter ' + on(next) + ' aria-disabled="' + !ok + '" style="flex:1 1 auto;min-width:0;min-height:54px;border:0;border-radius:999px;background:' + (ok ? '#5b4ae8' : '#d5d8df') + ';color:#fff;font-family:inherit;font-size:16.5px;font-weight:800;cursor:' + (ok ? 'pointer' : 'default') + '">' + (back ? 'Back to review' : cur === EV_STEPS[EV_STEPS.length - 1] ? 'Review' : 'Next') + '</button>') +
          '</div></div>' +
      '</div></div></div>';
  }

  // A step's fields: the page under the photo, or (pop) the same fields in Review's Edit pop-up, where the pop-up's
  // own title stands in for the page's heading
  function evBody(st, cur, pop) {
    const url = evPhotoUrl(st);
    const head = (t, sub) => pop ? (sub ? '<p style="margin:0;padding:2px 18px 0;font-size:14.5px;line-height:1.4;font-weight:500;color:#5c6270;text-wrap:pretty">' + esc(sub) + '</p>' : '')
      : '<div style="padding:26px 18px 0"><h2 style="margin:0;font-size:24px;line-height:1.05;font-weight:900;letter-spacing:-.8px;color:#0d1117">' + esc(t) + '</h2>' +
        (sub ? '<p style="margin:8px 0 0;font-size:14.5px;line-height:1.4;font-weight:500;color:#5c6270;text-wrap:pretty">' + esc(sub) + '</p>' : '') + '</div>';
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
      body = head('Date & time') + (st.evDatePoll
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
      body = head('Details', 'Up to three quick notes on what to expect or the vibe.') +
        '<div style="padding:12px 16px 0;display:flex;flex-direction:column;gap:8px">' + bitRows(st.evBits, (k, v) => { const b = state.evBits.slice(); b[k] = v; setState({ evBits: b }); }) +
          (st.evDate ? '' : needRow(st.evNeed, (n) => setState({ evNeed: n }))) + '</div>';   // no date: it goes up as an idea, which can say how many it needs
    } else if (cur === 'help') {
      // The owner's mock (2026-10-02): how it works in three steps while the list is empty, then bigger starter chips; purple numbered circles (owner, 2026-10-02)
      const chip = (label, fn, dashed) => '<span ' + on(fn) + ' style="display:flex;align-items:center;gap:8px;min-height:46px;padding:0 18px;border-radius:999px;font-size:16px;font-weight:800;cursor:pointer;' +
        (dashed ? 'border:1.5px dashed #b9bcc4;color:#5c6270' : 'background:#fff;box-shadow:0 1px 3px rgba(15,18,25,.1);color:#0d1117') + '">' + I.plus(14, '#5b4ae8', 2.6) + label + '</span>';
      const step = (n, t, sub) => '<div style="display:flex;align-items:center;gap:12px">' +
        '<span aria-hidden="true" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#5b4ae8;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff">' + n + '</span>' +
        '<div style="min-width:0"><div style="font-size:16px;line-height:1.25;font-weight:900;letter-spacing:-.2px;color:#0d1117">' + t + '</div>' +
          '<div style="margin-top:2px;font-size:13.5px;line-height:1.35;font-weight:500;color:#5c6270">' + sub + '</div></div></div>';
      const jobs = st.evNeeds.map((j, k) => {
          const edit = () => openJob(k, JSON.parse(JSON.stringify(j)));
          return '<div data-job="' + esc(cleanTitle(j.item)) + '" style="background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(15,18,25,.08);padding:12px 8px 12px 14px;display:flex;align-items:center;gap:8px">' +
            '<div ' + on(edit) + ' style="flex:1;min-width:0;cursor:pointer"><div style="font-size:15.5px;font-weight:800;color:#0d1117;text-wrap:pretty">' + esc(cleanTitle(j.item)) + '</div>' +
              '<div style="margin-top:2px;font-size:13px;font-weight:700;color:#454b55">' + esc(jobMeta(j)) + '</div>' +
              (j.desc ? '<div style="margin-top:3px;font-size:13px;line-height:1.4;font-weight:500;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(j.desc) + '</div>' : '') + '</div>' +
            '<span ' + on(edit) + ' style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 10px;font-size:13.5px;font-weight:800;color:#5b4ae8;cursor:pointer">Edit</span>' +
            '<span ' + on(() => setState({ evNeeds: state.evNeeds.filter((_, x) => x !== k) })) + ' aria-label="Remove ' + esc(cleanTitle(j.item)) + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#f4f5f7;display:flex;align-items:center;justify-content:center;cursor:pointer">' + svg(15, stroke('#9b1c31', 2.2), TRASH_IC) + '</span></div>';
        }).join('');
      body = head('How people can help') +   // no subtitle (owner, 2026-10-02)
        (jobs ? '<div style="padding:14px 14px 0;display:flex;flex-direction:column;gap:8px">' + jobs + '</div>'
          : '<div style="padding:14px 16px 0"><div data-help-how style="display:flex;flex-direction:column;gap:14px;padding:16px 14px;border-radius:18px;background:#f3f1fe">' +
              step(1, 'You list what’s needed', 'Like “Bring snacks” or “Set up chairs.”') +
              step(2, 'People sign up', 'They tap a job on the event page.') +
              step(3, 'You see who’s on it', 'No group texts to sort it out.') + '</div></div>') +
        '<div style="padding:18px 16px 0;font-size:12.5px;font-weight:800;letter-spacing:1.2px;color:#6b7280">' + (jobs ? 'ADD ANOTHER' : 'START WITH ONE') + '</div>' +
        '<div style="padding:10px 16px 0;display:flex;flex-wrap:wrap;gap:10px">' +
          [['Bring', 'Bring '], ['Set up', 'Set up '], ['Help with', 'Help with '], ['Clean up', 'Clean up '], ['Coordinate', 'Coordinate ']].map(([l, p]) => chip(l, () => openJob(null, blankJob(p)))).join('') +
          chip('Something else', () => openJob(null, blankJob('')), true) + '</div>';
    } else if (cur === 'lead') {
      body = head('Who’s leading it?', LEAD_WHY) + pad(leadOptions(st, pop));
    }
    return body;
  }
  // Review's Edit (owner, 2026-10-02): each part opens in a pop-up over Review, not back on its step's page. The fields
  // change the event as they're typed, so Done (or closing it) only goes back
  function viewEvPop() {
    const st = state, k = st.evPop;
    // The title can't be left empty (owner, 2026-10-02: the title is a pop-up too); the rest can be decided later
    const close = () => k === 'title' && !cleanTitle(state.activity) ? toast('Add a title first')
      : setState({ evPop: null, timeOpen: null, dateOpen: null, evLater: Object.assign({}, state.evLater, { [k]: !evFilled(state)[k] }) });
    const tall = k === 'when' || k === 'where';   // room for the calendar, the time list and the suggested places under their fields
    return '<div class="sheet-scrim" data-scrim="' + reg(close) + '">' +
      '<div role="dialog" aria-modal="true" aria-label="' + esc(EV_NAMES[k]) + '" data-screen-label="' + esc(EV_NAMES[k]) + '" data-ev-pop="' + k + '" class="sheet" style="max-height:calc(100% - 56px);' + (tall ? 'min-height:min(88%,640px);' : '') + 'display:flex;flex-direction:column;background:#e8eaee">' +
        '<div style="padding:10px 18px 2px;display:flex;flex-direction:column;gap:10px"><span aria-hidden="true" style="align-self:center;width:38px;height:5px;border-radius:999px;background:#c9ccd3"></span>' +
          '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0;font-size:22px;font-weight:900;letter-spacing:-.4px;color:#0d1117">' + esc(EV_NAMES[k]) + '</div>' + closeX(close, 'background:#fff') + '</div></div>' +
        '<div style="flex:1 1 auto;min-height:0;overflow-y:auto;padding-bottom:10px">' + evBody(st, k, true) + '</div>' +
        '<div style="padding:10px 16px calc(18px + env(safe-area-inset-bottom, 0px))"><button type="button" data-enter ' + on(close) + ' style="width:100%;min-height:54px;border:0;border-radius:999px;background:#5b4ae8;color:#fff;font-family:inherit;font-size:16.5px;font-weight:800;cursor:pointer">Done</button></div>' +
      '</div></div>';
  }

  // A group row with a checkbox (Post to, Who can see it)
  const groupCheck = (g, onIt, pick, note, noteHtml) => '<div ' + on(pick, 'checkbox') + ' aria-checked="' + onIt + '" style="display:flex;align-items:center;gap:10px;min-height:46px;padding:9px 12px;border-radius:12px;background:' + (onIt ? '#f3f1fe' : 'transparent') + ';cursor:pointer">' +
    '<span aria-hidden="true" style="flex:0 0 20px;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;' + (onIt ? 'background:#5b4ae8' : 'background:#fff;box-shadow:inset 0 0 0 2px #c9ccd3') + '">' + (onIt ? I.check(12, '#fff', 3.4) : '') + '</span>' +
    '<span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:' + (onIt ? '#5b4ae8' : '#0d1117') + '">' + esc(g.name) + groupTag(g) + '</span>' + (note ? '<span style="font-size:12.5px;font-weight:700;color:#8a909b">' + note + '</span>' : '') + (noteHtml || '') + '</div>';

  // The flow's sheets: Poll the group, Add a job, Save this as a draft? (one at a time, never stacked)
  const stepper = (n, set, label) => '<div style="flex:0 0 auto;display:flex;align-items:center;gap:8px">' +
    '<span ' + on(() => set(n > 1 ? n - 1 : null)) + ' aria-label="Fewer' + (label ? ' for ' + label : '') + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#0d1117;font-size:18px;font-weight:800;line-height:1">−</span>' +
    '<span style="min-width:22px;text-align:center;font-size:16px;font-weight:900;color:#0d1117">' + (n || 'Any') + '</span>' +
    '<span ' + on(() => set(Math.min(99, (n || 0) + 1))) + ' aria-label="More' + (label ? ' for ' + label : '') + '" style="flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #dcdfe6;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#0d1117;font-size:18px;font-weight:800;line-height:1">+</span></div>';
  const SHEET_PAD = 'padding:10px 18px calc(24px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:14px;max-height:88%;overflow-y:auto';
  const sheetHead = (eyebrow, title, sub, close) => '<div style="display:flex;align-items:flex-start;gap:10px"><div style="flex:1;min-width:0">' +
    (eyebrow ? '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280">' + esc(eyebrow) + '</div>' : '') +
    '<div style="margin-top:' + (eyebrow ? 2 : 0) + 'px;font-size:22px;line-height:1.1;font-weight:900;letter-spacing:-.4px;color:#0d1117">' + esc(title) + '</div>' +
    (sub ? '<div style="margin-top:4px;font-size:14px;line-height:1.4;font-weight:500;color:#5c6270">' + esc(sub) + '</div>' : '') + '</div>' + closeX(close) + '</div>';
  const saveBtn = (ok, fn, label) => '<button type="button" ' + on(() => { if (ok) fn(); }) + ' aria-disabled="' + !ok + '" style="min-height:52px;border:0;border-radius:999px;background:' + (ok ? '#5b4ae8' : '#d5d8df') + ';color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:' + (ok ? 'pointer' : 'default') + '">' + (label || 'Save') + '</button>';

  function viewComposeSheets() {
    const st = state;
    if (st.pollSheet) {
      const p = st.pollSheet, when = p.kind === 'when', close = () => setState({ pollSheet: null });
      const setRow = (k, patch, more) => setState(Object.assign({ pollSheet: Object.assign({}, state.pollSheet, { rows: state.pollSheet.rows.map((r, j) => j === k ? Object.assign({}, r, patch) : r) }) }, more));
      const valid = when ? p.rows.filter(r => r.d) : p.rows.filter(r => cleanTitle(r.v || ''));
      const rm = (k) => () => { if (p.rows.length <= 2) setRow(k, when ? { d: '', t: '' } : { v: '' }); else setState({ pollSheet: Object.assign({}, p, { rows: p.rows.filter((_, j) => j !== k) }) }); };
      const rmBtn = (k) => '<span ' + on(rm(k)) + ' aria-label="Remove option ' + (k + 1) + '" style="flex:0 0 32px;width:32px;height:32px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(12, '#6b7280', 2.8) + '</span>';
      const save = () => {
        if (valid.length < 2) { toast('Add at least two options'); return; }
        // Two identical dates made the whole post fail; two identical spots split the vote
        const keys = valid.map(r => when ? r.d + ' ' + (r.t || '') : cleanTitle(r.v).toLowerCase());
        if (keys.some((k, j) => keys.indexOf(k) !== j)) { toast(when ? 'Two options are the same date and time. Change or remove one.' : 'Two options are the same place. Change or remove one.'); return; }
        if (p.sparkId) {   // Run a poll from an event's When and where (owner, 2026-10-01)
          const who = (state.myName || 'Someone').slice(0, 40);
          run(async () => {
            if (when) must(await sb.from('date_options').insert(valid.map(o => ({ spark_id: p.sparkId, day_date: o.d, day_time: o.t || null, who }))));
            else must(await sb.from('spot_options').insert(valid.map(o => ({ spark_id: p.sparkId, name: cleanTitle(o.v).slice(0, 80), who }))));
          }, { pollSheet: null }).then(ok => { if (ok) toast('Poll started. Everyone can vote now.', true); });
          return;
        }
        if (when) setState({ pollSheet: null, evDatePoll: valid.map(r => ({ d: r.d, t: r.t || '' })), evDate: '', evTime: '', evEnd: '', evEndOn: false, evLater: Object.assign({}, st.evLater, { when: false }) });
        else setState({ pollSheet: null, evSpotPoll: valid.map(r => ({ v: cleanTitle(r.v).slice(0, 80) })), locText: '', locPlace: null, locSuggest: [], evLater: Object.assign({}, st.evLater, { where: false }) });
      };
      // The date poll opens tall, so the calendar under an option isn't cut off by the pop-up's edge (owner, 2026-10-02)
      return sheet('Poll the group', close, SHEET_PAD + (when ? ';min-height:min(88%,700px)' : ''),
        sheetHead(when ? 'Date & time' : 'Location', 'Create a poll', when ? 'Add a few options. Everyone votes, and you pick the winner.' : 'Add a few locations. Everyone votes, and you pick the winner.', close) +
        '<div style="display:flex;flex-direction:column;gap:8px">' + p.rows.map((r, k) => '<div style="display:flex;align-items:center;gap:8px">' +
          (when ? dateField(r.d, 'Date option ' + (k + 1), 'Date', (v) => setRow(k, { d: v }), 'flex:1.4 1 0') + '<div style="flex:1 1 0;min-width:0">' + timeField('poll' + k, r.t, EV_TIMES, 'Time', (v) => setRow(k, { t: v }, { timeOpen: null }), { label: 'Time option ' + (k + 1), slim: true, none: 'No time' }) + '</div>'
            : '<input class="fld" type="text" maxlength="80" aria-label="Place option ' + (k + 1) + '" placeholder="Add a place" value="' + esc(r.v || '') + '" ' + onInput(e => { if (e.type === 'input') setRow(k, { v: e.target.value.slice(0, 80) }); }) + ' style="' + BIG + ';min-height:54px;flex:1 1 auto">') +
          rmBtn(k) + '</div>').join('') + '</div>' +
        (p.rows.length < 5 ? '<span ' + on(() => setState({ pollSheet: Object.assign({}, p, { rows: p.rows.concat([when ? { d: '', t: '' } : { v: '' }]) }) })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:36px;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(14, 'currentColor', 2.6) + (when ? 'Add another option' : 'Add another location') + '</span>' : '') +
        '<div style="margin-top:auto;display:flex;flex-direction:column">' + saveBtn(valid.length >= 2, save) + '</div>', 36);
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
      return sheet('Add a job', close, SHEET_PAD + ';min-height:min(88%,580px)',   // room for the time list under its field
        sheetHead('How people can help', ns.i != null ? 'Edit job' : 'Add a job', '', close) + jobFields(r, set) +
        '<div style="margin-top:auto;display:flex;flex-direction:column">' + saveBtn(jobNamed(r.item), save) + '</div>', 36);
    }
    if (st.evLeave) {
      const close = () => setState({ evLeave: false, evLeaveTo: null });
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
    // The same time list as the date fields (owner, 2026-10-02: the browser's menu didn't match), as tall as the fields here
    const jobTime = (key, value, opts, hint, pick, label, none) => '<div style="flex:1 1 0;min-width:0">' +
      timeField('job' + tag + key, value, opts, hint, (v) => { setState({ timeOpen: null }); pick(v); }, { label, slim: true, h: 52, none }) + '</div>';
    // Sign-ups belong to the job or to its shifts, and switching between them would drop them, so it's locked while anyone's on it
    const held = r.n > 0, heldNote = (t) => '<span data-held style="font-size:13px;line-height:1.4;font-weight:600;color:#6b7280">' + esc(t) + '</span>';
    return '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<input class="fld" type="text" maxlength="60"' + (idx == null ? ' data-job-name' : '') + ' aria-label="Job name' + tag + '" placeholder="What you need, e.g. Bring a case of water" value="' + esc(r.item) + '" ' + onInput(e => { if (e.type === 'input') set({ item: e.target.value.slice(0, 60) }); }) + ' style="' + BIG + ';min-height:52px;font-size:16px">' +
      '<textarea class="fld" rows="2" maxlength="400" aria-label="Details' + tag + '" placeholder="Details (optional)" ' + onInput(e => { if (e.type === 'input') set({ desc: e.target.value.slice(0, 400) }); }) + ' style="' + BIG + ';min-height:52px;padding:12px 16px;font-size:16px;font-weight:500;line-height:1.4;resize:none">' + esc(r.desc || '') + '</textarea>' +
      (r.shifts
        ? r.shifts.map((q, k) => '<div data-shift-row style="display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:14px;background:#fff;box-shadow:inset 0 0 0 1.5px #eef0f3">' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              jobTime('s' + k, q.time, EV_TIMES, 'Start', (v) => setShift(k, { time: v, end: q.end && q.end <= v ? '' : q.end }), 'Shift ' + (k + 1) + ' start', 'No time') +
              '<span aria-hidden="true" style="font-weight:800;color:#9aa0ac">–</span>' +
              jobTime('e' + k, q.end, EV_TIMES.filter(v => !q.time || v > q.time), 'End', (v) => setShift(k, { end: v }), 'Shift ' + (k + 1) + ' end', 'No end time') +
              (held && r.shifts.length === 1 ? '' : '<span ' + on(() => set({ shifts: r.shifts.length > 1 ? r.shifts.filter((_, j) => j !== k) : null, time: r.shifts.length > 1 ? r.time : q.time, need: r.shifts.length > 1 ? r.need : q.need })) + ' aria-label="Remove shift ' + (k + 1) + '" style="flex:0 0 28px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(13, '#6b7280', 2.8) + '</span>') + '</div>' +
            (q.n ? heldNote(q.n + (q.n === 1 ? ' person is' : ' people are') + ' on this shift. Removing it lets them know.') : '') +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span style="font-size:13px;font-weight:800;color:#6b7280">People needed</span>' + stepper(q.need, (n) => setShift(k, { need: n }), 'shift ' + (k + 1)) + '</div></div>').join('') +
          '<span ' + on(() => set({ shifts: r.shifts.concat([{ time: '', end: '', need: 1 }]) })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:36px;font-size:14px;font-weight:800;color:#5b4ae8;cursor:pointer">' + I.plus(14, 'currentColor', 2.6) + 'Add a shift</span>' +
          (held ? heldNote('People are signed up for these shifts, so they stay as shifts.') : '<span ' + on(() => set({ shifts: null, time: r.shifts[0].time, need: r.shifts[0].need || 1 })) + ' style="align-self:flex-start;display:flex;align-items:center;min-height:32px;font-size:13.5px;font-weight:700;color:#6b7280;cursor:pointer">Use one time instead</span>')
        : '<div style="display:flex;align-items:center;gap:10px">' + jobTime('', r.time, EV_TIMES, 'Time (optional)', (v) => set({ time: v }), 'Time' + tag, 'No time') + stepper(r.need, (n) => set({ need: n }), 'how many people') + '</div>' +
          (held ? heldNote('People are signed up, so it can’t be split into shifts.') : '<span ' + on(() => set({ shifts: [{ time: r.time || '', end: '', need: r.need || 1 }, { time: '', end: '', need: r.need || 1 }] })) + ' style="align-self:flex-start;display:flex;align-items:center;gap:6px;min-height:32px;font-size:13.5px;font-weight:700;color:#6b7280;cursor:pointer">' + svg(14, stroke('currentColor', 2.4), P5.clock) + 'Add a shift</span>')) +
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
  // h3Html / paraHtml take markup: escape any user text going in (esc())
  const h3Html = (t, extra) => '<h3 style="margin:' + (extra || '0') + ';padding-right:36px;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117;text-wrap:pretty">' + t + '</h3>';
  const paraHtml = (t, color) => '<p style="margin:0;font-size:14.5px;line-height:1.45;font-weight:500;color:' + (color || '#5c6270') + ';text-wrap:pretty;overflow-wrap:break-word">' + t + '</p>';
  const codeInput = (value, label, onChange, size) => '<input class="fld" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label="' + label + '" placeholder="000000" value="' + esc(value) + '" ' +
    onInput(e => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))) +
    ' style="width:100%;background:#fff;border:2px solid #e6e7eb;border-radius:14px;padding:14px 16px;font-family:inherit;font-size:' + (size || 26) + 'px;font-weight:800;letter-spacing:10px;text-align:center;color:#0d1117;outline:none">';

  function viewLogin() {
    const st = state, busy = st.busy;
    if (st.loginStep === 'email') {
      // Opened from Welcome's "Continue with email": just the email field (owner, 2026-09-30)
      const emailOk = EMAIL_OK.test(st.loginEmail.trim()), withGoogle = GOOGLE_ON && !st.loginEmailOnly;
      const lead = { post: 'Sign in to post your event. ', guest: 'Your name fills in, and everything you add is saved to your account. ', account: 'Guests can RSVP. To suggest, vote, sign up to help and get reminders, make a free account. ', join: 'Sign in to join a group. ', friend: 'Sign in to add your friend. ' }[st.loginFrom] ||
        'Your events, groups and name are saved to your account. ';
      return modal('Sign in', closeLogin,
        h3Html(st.loginFrom === 'post' ? 'Sign in to post' : st.loginFrom === 'account' ? 'Create a free account' : 'Sign in') +
        paraHtml(lead + (withGoogle ? 'Use Google, or we’ll email you a 6-digit code. No password.' : 'We’ll email you a 6-digit code. No password.')) +
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
        '<button type="button" data-enter ' + on(() => { if (emailOk && !busy) sendCode(false); }) + ' aria-disabled="' + !(emailOk && !busy) + '" style="' + primary(emailOk && !busy) + '">' + (busy === 'send' ? 'Sending…' : 'Email me a code') + '</button>' +
        '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Used to sign you in. Your groups’ admins can see it; other members can’t. <a href="/privacy.html" target="_blank" rel="noopener" style="font-weight:800;color:#5b4ae8">Privacy</a></p>',
        { z: 32 });
    }
    const codeOk = st.loginCode.length >= 6 && !busy;
    return modal('Enter the code', closeLogin,
      h3Html('Enter the code') +
      paraHtml('Sent to <strong style="font-weight:700;color:#0d1117">' + esc(st.loginEmail.trim()) + '</strong> · <span ' + on(() => setState({ loginStep: 'email' })) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Change</span>') +
      codeInput(st.loginCode, 'Code from the email', v => setState({ loginCode: v })) +
      '<button type="button" data-enter ' + on(() => { if (codeOk) verifyCode(); }) + ' aria-disabled="' + !codeOk + '" style="' + primary(codeOk) + '">' + (busy === 'signin' ? 'Signing in…' : 'Sign in') + '</button>' +
      '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:4px;font-size:14px;line-height:1.45;font-weight:500;color:#6b7280"><span>Not there? Check spam, or</span>' +
        '<span ' + on(() => { if (!busy) sendCode(true); }) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">' + (st.resent && Date.now() - (st.resentAt || 0) < 60000 ? 'Sent again' : 'Send it again') + '</span></div>',
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
      h3Html(st.myName ? 'Change name' : 'Your name', '2px 0 0') +
      '<input class="fld" type="text" maxlength="30" autocomplete="given-name" aria-label="First name" placeholder="First name" value="' + esc(st.nameText) + '" ' + onInput(e => setState({ nameText: e.target.value.slice(0, 30) })) + ' style="' + FIELD + '">' +
      '<button type="button" data-enter ' + on(submit) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">Continue</button>' +
      (!st.myName && !st.email
        ? '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:4px;font-size:13.5px;font-weight:500;color:#6b7280"><span>Been here before?</span><span ' + on(() => openLogin('default', st.nameAsk)) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Sign in</span></div>'
        : ''),
      { max: 330 });
  }

  function viewGuest() {
    const st = state, s = subject();
    const ok = st.guestName.trim().length > 0 && !st.busy;
    const to = s ? firstName(nameOf(s.leadId, s.leadName)) : 'The lead';
    const close = () => setState({ guestOpen: false, guestThen: null });
    const submit = async () => {
      if (!ok) return;
      const name = cleanTitle(st.guestName).slice(0, 30);
      const then = st.guestThen;
      setState({ guest: { name }, guestOpen: false, guestThen: null, myName: st.myName || name });
      try { await ensureSession(); must(await sb.from('profiles').upsert({ id: state.me, name }, { onConflict: 'id' })); } catch (e) { console.error(e); }
      if (typeof then === 'function') then();
    };
    return modal('RSVP as a guest', close,
      h3Html('RSVP as a guest') +
      paraHtml('Your name goes on the list, so ' + esc(to) + ' knows who’s coming.') +
      '<input class="fld" type="text" maxlength="30" autocomplete="given-name" aria-label="Your name" placeholder="Your name" value="' + esc(st.guestName) + '" ' + onInput(e => setState({ guestName: e.target.value.slice(0, 30) })) + ' style="' + FIELD + '">' +
      '<button type="button" data-enter ' + on(submit) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">Continue</button>' +
      '<div style="margin-top:4px;background:#f3f1fe;border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:12px">' +
        '<div style="flex:1 1 auto;min-width:0"><div style="font-size:15px;font-weight:800;color:#0d1117">Have an account?</div>' +
        '<div style="margin-top:2px;font-size:13.5px;line-height:1.4;font-weight:500;color:#454b55">Sign in to skip this and get reminders.</div></div>' +
        '<span ' + on(() => { const fn = st.guestThen; setState({ guestOpen: false, guestThen: null }); openLogin('guest', () => needName(fn || (() => {}))); }) + ' class="hov-primary" style="flex:0 0 auto;display:flex;align-items:center;min-height:40px;padding:0 16px;background:#5b4ae8;border-radius:999px;font-size:14.5px;font-weight:800;color:#fff;cursor:pointer">Sign in</span>' +
      '</div>');
  }

  // Add a date / Add a location (owner's mock, 2026-10-02): a sheet with the app's own date and time lists, and "Add my
  // vote to it too" (on by default)
  function viewOffer(s) {
    const st = state, kind = st.offerKind, day = kind === 'day', voteOn = st.offerVote !== false;
    const ready = st.offerText.trim().length > 0 && !st.busy;
    const close = () => setState({ offerKind: null, offerText: '', offerPlace: null, offerSuggest: [], dateOpen: null, timeOpen: null, offerVote: true });
    const lbl = (t) => '<span style="font-size:13px;font-weight:800;letter-spacing:1.2px;color:#6b7280">' + t + '</span>';
    let field;
    if (day) {
      const d = st.offerText.slice(0, 10), t = st.offerText.length > 10 ? st.offerText.slice(11, 16) : '';
      field = '<div style="display:flex;flex-direction:column;gap:8px">' + lbl('DAY') + dateField(d, 'Date', 'Pick a day', (v) => setState({ offerText: v ? v + (t ? 'T' + t : '') : '' })) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' + lbl('START TIME') + timeField('offT', t, EV_TIMES, 'Optional', (v) => setState({ offerText: d ? d + (v ? 'T' + v : '') : '', timeOpen: null })) + '</div>' +
        // room for the open calendar or time list, so the sheet grows instead of hiding it
        (st.dateOpen === 'Date' ? '<div aria-hidden="true" style="height:300px"></div>' : st.timeOpen === 'offT' ? '<div aria-hidden="true" style="height:200px"></div>' : '');
    } else {
      field = '<div style="display:flex;flex-direction:column;gap:8px">' + lbl('LOCATION') + placeField('offer', { placeholder: 'Search a place or address', style: FIELD }) + '</div>';
    }
    const mine = '<div ' + on(() => setState({ offerVote: !voteOn }), 'checkbox') + ' aria-checked="' + voteOn + '" data-offer-vote style="display:flex;align-items:center;gap:14px;min-height:58px;padding:0 16px;border-radius:16px;background:' + VG.box + ';cursor:pointer">' +
      voteTick(voteOn) + '<span style="font-size:16px;font-weight:700;color:' + VG.dark + '">Add my vote to it too</span></div>';
    return sheet(day ? 'Add a date' : 'Add a location', close, SHEET_PAD,
      sheetHead('', day ? 'Add a date' : 'Add a location', 'Everyone can vote on it.', close) + field + mine +
      '<button type="button" data-enter ' + on(() => { if (ready) commitOffer(s); }) + ' aria-disabled="' + !ready + '" style="min-height:56px;border:0;border-radius:999px;font-family:inherit;font-size:17px;font-weight:900;cursor:' + (ready ? 'pointer' : 'default') + ';background:' + (ready ? VG.on : '#eceef1') + ';color:' + (ready ? VG.dark : '#9aa0ac') + '">' + (st.busy === 'save' ? 'Adding…' : day ? 'Add date' : 'Add location') + '</button>', 37);
  }

  function viewJoin() {
    const st = state, ok = st.joinCode.length === 6 && !st.busy;
    return modal('Join a group', () => setState({ joinOpen: false }),
      h3Html('Join a group') + paraHtml('Got a code or a link from someone in the group? Enter it here.') +
      '<input class="fld" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Group code" placeholder="ABC123" value="' + esc(st.joinCode) + '" ' +
        // A pasted invite link works too: its code is the part after /join/
        onInput(e => { const m = e.target.value.match(/\/join\/([A-Za-z0-9]{6})/); const v = (m ? m[1] : e.target.value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); if (e.target.value !== v) e.target.value = v; setState({ joinCode: v, joinBad: false }); }) +
        ' style="' + FIELD + ';padding:14px 16px;font-size:24px;font-weight:800;letter-spacing:8px;text-align:center;text-transform:uppercase">' +
      (st.joinBad ? '<div role="alert" style="font-size:14px;line-height:1.4;font-weight:700;color:#9b1c31">That code didn’t match a group. Check it with whoever sent it.</div>' : '') +
      '<button type="button" data-enter ' + on(submitJoin) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + '">' + (st.busy === 'join' ? 'Joining…' : 'Join') + '</button>' +
      '<button type="button" ' + on(() => { setState({ joinOpen: false }); startGroup(); }) + ' style="' + SECONDARY + '">Start a group instead</button>' +
      '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">A group’s owners and admins find its code and link in the group’s settings.</p>',
      { z: 31, max: 330 });
  }

  function viewProfileEdit() {
    const st = state, pe = st.pe, busy = st.busy === 'profile';
    const close = () => setState({ pe: null });
    if (pe.step === 'code') {
      const ok = pe.code.length >= 6 && !busy;
      return modal('Confirm your new email', close,
        h3Html('Confirm your new email') +
        paraHtml('We sent a code to <strong style="font-weight:700;color:#0d1117">' + esc(pe.email) + '</strong> · <span ' + on(() => setPe({ step: 'form' })) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Change</span>') +
        codeInput(pe.code, 'Code from the email', v => setPe({ code: v })) +
        '<button type="button" ' + on(confirmPe) + ' aria-disabled="' + !ok + '" style="' + btn(ok) + '">' + (busy ? 'Confirming…' : 'Confirm') + '</button>' +
        '<p style="margin:0;font-size:13px;line-height:1.45;font-weight:500;color:#6b7280">Until you confirm, you keep signing in with ' + esc(st.email) + '. Didn’t get it? <span ' + on(resendPe) + ' style="font-weight:800;color:#5b4ae8;cursor:pointer">Send it again</span></p>', { z: 45 });
    }
    const nameOk = pe.name.trim().length > 0;
    const newEmail = pe.email.trim().toLowerCase();
    const changed = !st.isGoogle && newEmail !== st.email.toLowerCase();
    const ok = nameOk && (!changed || EMAIL_OK.test(newEmail)) && !busy;
    return modal('Edit profile', close,
      h3Html('Edit profile') +
      '<div style="display:flex;align-items:center;gap:14px">' +
        avatarSpan(state.me, pe.name, pe.avatar ? pe.avatar.url : null, 64) +
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
        '<button type="button" ' + on(() => { if (state.busy) return; if (c.alt) c.alt(); else setState({ confirm: null }); }) + ' style="' + SECONDARY + '">' + esc(c.keep) + '</button>' +   // alt: the second button does something too
      '</div>',
      { z: c.z || 34, role: 'alertdialog', max: 330 });
  }

  // A bottom sheet (Your groups, Members): slides up over a fading scrim; tapping the scrim closes it
  const sheet = (label, close, style, inner, z) => '<div class="sheet-scrim" data-scrim="' + reg(close) + '"' + (z ? ' style="z-index:' + z + '"' : '') + '>' +
    '<div role="dialog" aria-modal="true" aria-label="' + esc(label) + '" data-screen-label="' + esc(label) + '" class="sheet" style="' + style + '">' +
      '<div style="width:40px;height:5px;border-radius:999px;background:#dcdfe6;margin:0 auto 12px"></div>' + inner +
    '</div></div>';

  // Members of a group you run. Owners (up to two) set roles; admins see them
  function viewMembers() {
    const st = state, g = groupById(st.membersOpen), close = () => setState({ membersOpen: null, membersQ: '', memberOpen: null });
    if (!g || !g.role) return '';
    const admin = runs(g), owner = g.role === 'owner', list = st.membersList || [], owners = list.filter(m => m.role === 'owner').length;
    const q = st.membersQ.trim().toLowerCase();
    const rows = list.filter(m => m.user_id === st.me).concat(list.filter(m => m.user_id !== st.me)).filter(m => !q || m.name.toLowerCase().includes(q));
    const chip = (role) => role === 'member' ? '' : roleBadge(role, 'padding:3px 9px');
    const pill = (label, fn) => '<span ' + on(fn) + ' class="hov-outline" style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 14px;border:1.5px solid #dcdfe6;border-radius:999px;background:#fff;font-size:13.5px;font-weight:800;color:#0d1117;cursor:pointer">' + label + '</span>';
    const redBtn = (label, fn) => '<span ' + on(fn) + ' class="hov-danger" style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #f5c2cb;font-size:13.5px;font-weight:800;color:#9b1c31;cursor:pointer">' + label + '</span>';
    // What the viewer may do: owners change roles (up to five owners, never none); admins remove members, owners anyone but themselves
    const actions = (m) => {
      const mine = m.user_id === st.me, out = [];
      if (owner && !mine) {
        if (m.role === 'member') out.push(pill('Make admin', () => setRole(g, m, 'admin')));
        if (m.role !== 'owner' && owners < 5) out.push(pill('Make owner', () => setRole(g, m, 'owner')));
        if (m.role === 'admin') out.push(pill('Remove as admin', () => setRole(g, m, 'member')));
        if (m.role === 'owner') out.push(pill('Remove as owner', () => setRole(g, m, 'admin')));
      }
      if (owner && mine && owners > 1) out.push(pill('Step down as owner', () => setRole(g, m, 'admin')));
      if (admin && !mine && (owner || m.role === 'member')) out.push(redBtn('Remove from group', () => removeMember(g, m)), redBtn('Remove and block', () => removeMember(g, m, true)));
      return out.join('');
    };
    // v6 Update 13: friend requests start here (you share this group)
    const friendBtn = (m) => {
      if (m.user_id === st.me || !st.fr.loaded) return '';
      const asked = st.fr.incoming.find(f => f.id === m.user_id);
      if (isFriend(m.user_id)) return '<span data-friend-state style="flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:999px;background:#e7f6ec;font-size:13.5px;font-weight:800;color:#0f7a3c">' + I.check(12, '#0f7a3c', 3.2) + 'Friends</span>';
      if (asked) return '<span ' + on(() => answerRequest(asked, true)) + ' class="hov-primary" style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background:#5b4ae8;font-size:13.5px;font-weight:800;color:#fff;cursor:pointer">Accept friend request</span>';
      if (st.fr.outgoing.indexOf(m.user_id) > -1) return '<span data-friend-state style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background:#f2f3f6;font-size:13.5px;font-weight:800;color:#6b7280">Requested</span>';
      return '<span ' + on(() => sendRequest(m.user_id, m.name)) + ' class="hov-primary" style="flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:999px;background:#5b4ae8;font-size:13.5px;font-weight:800;color:#fff;cursor:pointer">' +
        svg(14, stroke('#fff', 2.6), '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>') + 'Add friend</span>';
    };
    const joined = (t) => t ? new Date(t).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
    const panel = (m) => '<div data-member-panel style="margin:0 6px 10px;padding:12px 14px;border-radius:14px;background:#f7f7f9;display:flex;flex-direction:column;gap:10px">' +
      '<div style="display:flex;flex-direction:column;gap:3px;font-size:14px;font-weight:600;color:#454b55">' +
        (admin ? '<div style="display:flex;align-items:center;gap:8px;min-width:0"><span style="flex:0 0 auto;font-size:12px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:#8a909b">Email</span>' +
          (m.email ? '<a href="mailto:' + esc(m.email) + '" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4a3ad4;font-weight:700;text-decoration:none">' + esc(m.email) + '</a>' : '<span style="color:#8a909b">Not shared</span>') + '</div>' : '') +
        (m.joined_at ? '<div style="font-size:13px;color:#6b7280">Joined ' + esc(joined(m.joined_at)) + '</div>' : '') + '</div>' +
      (friendBtn(m) || actions(m) || m.user_id !== st.me ? '<div style="display:flex;flex-wrap:wrap;gap:8px">' + friendBtn(m) +
        (m.user_id !== st.me ? pill('See profile', () => openPerson(m.user_id)) : '') + actions(m) + '</div>' : '') + '</div>';
    const row = (m) => { const open = st.memberOpen === m.user_id;
      return '<div data-member="' + esc(m.name) + '" style="border-bottom:1px solid #f2f3f6">' +
        '<div ' + on(() => setState({ memberOpen: open ? null : m.user_id })) + ' aria-expanded="' + open + '" aria-label="' + esc(m.name) + (m.user_id === st.me ? ' (you)' : '') + '" style="display:flex;align-items:center;gap:12px;min-height:58px;padding:6px;cursor:pointer">' +
          memberFace(m, 40) +
          '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px"><span style="font-size:16px;font-weight:700;color:#0d1117;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(m.name) + '</span>' +
            (m.user_id === st.me ? '<span style="font-size:14px;font-weight:600;color:#8a909b">(you)</span>' : '') + '</div>' +
          chip(m.role) +
          '<span aria-hidden="true" style="flex:0 0 auto;display:flex;transition:transform .15s;transform:' + (open ? 'rotate(180deg)' : 'none') + '">' + I.chevD(14, '#9aa0ac', 2.8) + '</span>' +
        '</div>' + (open ? panel(m) : '') + '</div>'; };
    return sheet('Members', close, 'height:84%;display:flex;flex-direction:column;padding:10px 0 0',
      '<div style="padding:0 14px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 6px 12px">' +
          '<div style="display:flex;align-items:baseline;gap:8px"><h3 style="margin:0;font-size:22px;line-height:1.15;font-weight:900;letter-spacing:-.5px;color:#0d1117">Members</h3>' +
            '<span style="font-size:15px;font-weight:700;color:#8a909b">' + (st.membersList ? list.length : '') + '</span></div>' +
          closeX(close) +
        '</div>' +
        '<label style="margin:0 2px 8px;display:flex;align-items:center;gap:10px;min-height:48px;padding:0 10px 0 14px;border-radius:14px;background:#fff;box-shadow:0 1px 3px rgba(13,17,23,.08),0 0 0 1px rgba(13,17,23,.06)">' + ic6('search', 18, '#6b7280', 2.4) +
          '<input class="fld" type="search" aria-label="Search members" placeholder="Search members" value="' + esc(st.membersQ) + '" ' + onInput(e => { if (e.type === 'input') setState({ membersQ: e.target.value.slice(0, 40) }); }) + ' style="flex:1;min-width:0;border:0;outline:none;background:transparent;font-family:inherit;font-size:16px;font-weight:600;color:#0d1117">' +
          (st.membersQ ? '<span ' + on(() => setState({ membersQ: '' })) + ' aria-label="Clear search" style="flex:0 0 24px;width:24px;height:24px;border-radius:999px;background:#c3c7d0;display:flex;align-items:center;justify-content:center;cursor:pointer">' + I.x(10, '#fff', 4) + '</span>' : '') +
        '</label>' +
      '</div>' +
      '<div style="flex:1;overflow:auto;padding:0 14px 22px">' +
        (st.membersList == null
          ? '<div style="padding:28px 8px;text-align:center;font-size:15px;font-weight:600;color:#8a909b">Loading…</div>'
          : rows.map(row).join('') +
            (rows.length ? '' : '<div style="padding:28px 8px;text-align:center;font-size:15px;font-weight:600;color:#8a909b">No one by that name.</div>')) +
        (admin && (st.blockedList || []).length && !q ? '<div data-blocked style="margin-top:18px;display:flex;flex-direction:column">' +
          '<span style="padding:0 6px 6px;font-size:12px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:#8a909b">Blocked</span>' +
          st.blockedList.map(b => '<div data-blocked-row="' + esc(b.name) + '" style="display:flex;align-items:center;gap:12px;min-height:58px;padding:6px;border-bottom:1px solid #f2f3f6">' +
            memberFace(b, 40) +
            '<span style="flex:1;min-width:0;font-size:16px;font-weight:700;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(b.name) + '</span>' +
            pill('Unblock', () => unblock(g, b)) + '</div>').join('') + '</div>' : '') +
      '</div>');
  }

  // Delete {Name}?: type DELETE to confirm (owners)
  // Delete your own account (owner, 2026-10-02): the same typed DELETE as a group. delete_my_account() refuses while
  // you're the only owner of a group other people are in.
  const deleteAccount = async () => {
    if ((state.acctDel || '').trim() !== 'DELETE' || state.busy) return;
    if (state.viewAs) { toast('You’re viewing as ' + firstName(state.viewAs.name) + ', so nothing changes. Exit to make changes.'); return; }
    setState({ busy: 'save' });
    try {
      await ensureSession();
      await forgetPush().catch(() => {});
      must(await sb.rpc('delete_my_account'));
      setState({ busy: null, acctDel: null, profSheet: false });
      await signOut();
      toast('Your account is deleted', true);
    } catch (e) {
      console.error(e);
      const m = /only owner of: (.+)$/.exec(e.message || '');
      setState({ busy: null, acctDel: m ? null : state.acctDel });
      toast(m ? 'You’re the only owner of ' + m[1] + '. Make someone else an owner first (Edit group → Members), or delete the group.' : failed(e));
    }
  };
  function viewDeleteAccount() {
    const st = state, close = () => setState({ acctDel: null }), ok = st.acctDel.trim() === 'DELETE' && !st.busy;
    return modal('Delete account', close,
      h3Html('Delete your account?') +
      paraHtml('This removes ' + esc(st.email) + ' from Spark Hub: your groups, replies, sign-ups and friends. Events you lead pass to a co-lead, or are deleted if there isn’t one. It can’t be undone.') +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="' + LABEL + '">Type <strong style="font-weight:900;color:#9b1c31">DELETE</strong> to confirm</span>' +
        '<input class="fld fld-danger" type="text" autocomplete="off" autocapitalize="characters" aria-label="Type DELETE to confirm" placeholder="DELETE" value="' + esc(st.acctDel) + '" ' +
          onInput(e => { const v = e.target.value.toUpperCase().slice(0, 12); if (e.target.value !== v) e.target.value = v; setState({ acctDel: v }); }) + ' style="' + FIELD + ';font-weight:800;letter-spacing:1px"></label>' +
      '<button type="button" data-enter ' + on(deleteAccount) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + ';box-shadow:none;background:' + (ok ? '#9b1c31' : '#b9bcc4') + '">' + (st.busy === 'save' ? 'Deleting…' : 'Delete my account') + '</button>' +
      '<button type="button" class="hov-outline" ' + on(close) + ' style="' + SECONDARY + '">Keep it</button>',
      { z: 60 });
  }
  function viewDeleteGroup() {
    const st = state, g = groupById(st.gpId), close = () => setState({ gpDel: null });
    if (!g || g.role !== 'owner') return '';
    const ok = st.gpDel.trim() === 'DELETE' && !st.busy;
    return modal('Delete group', close,
      h3Html('Delete ' + esc(g.name) + '?') +
      paraHtml('This removes the group and every event in it, ' + (st.gpMembers === 1 ? 'for its 1 member' : 'for all ' + (st.gpMembers || 0) + ' members') + '. It can’t be undone.') +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="' + LABEL + '">Type <strong style="font-weight:900;color:#9b1c31">DELETE</strong> to confirm</span>' +
        '<input class="fld fld-danger" type="text" autocomplete="off" autocapitalize="characters" aria-label="Type DELETE to confirm" placeholder="DELETE" value="' + esc(st.gpDel) + '" ' +
          onInput(e => { const v = e.target.value.toUpperCase().slice(0, 12); if (e.target.value !== v) e.target.value = v; setState({ gpDel: v }); }) + ' style="' + FIELD + ';font-weight:800;letter-spacing:1px"></label>' +
      '<button type="button" ' + on(() => deleteGroup(g)) + ' aria-disabled="' + !ok + '" style="' + primary(ok) + ';box-shadow:none;background:' + (ok ? '#9b1c31' : '#b9bcc4') + '">' + (st.busy === 'save' ? 'Deleting…' : 'Delete group') + '</button>' +
      '<button type="button" class="hov-outline" ' + on(close) + ' style="' + SECONDARY + '">Keep it</button>',
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
    const close = () => setState({ interestList: false }), lead = isLead(s);
    return modal('Who’s interested', close,
      h3Html('Who’s interested') +
      (lead && s.contacts.some(c => c.phone && s.interested.indexOf(c.user_id) > -1) ? paraHtml('Only you see phone numbers. They’re from people who took part without an account.') : '') +
      '<div style="display:flex;flex-direction:column">' +
        s.interested.map((u, i) => {
          const c = lead && s.contacts.find(x => x.user_id === u);
          const name = u === state.me ? 'You' : c ? c.name : nameOf(u);
          return '<div data-interested ' + (c ? '' : on(() => openPerson(u)) + ' aria-label="' + esc(name) + ', see profile" ') + 'style="display:flex;align-items:center;gap:12px;min-height:52px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + (c ? '' : ';cursor:pointer') + '">' +
            face(u, name, 32, null) +
            '<span style="flex:1 1 auto;min-width:0;font-size:15.5px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</span>' +
            (s.canHelp.indexOf(u) > -1 ? '<span data-can-help-chip style="flex:0 0 auto;padding:3px 9px;border-radius:999px;background:#f3f1fe;font-size:12px;font-weight:800;color:#5b4ae8">Can help</span>' : '') +
            (c && c.phone ? '<a href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '" style="flex:0 0 auto;font-size:14px;font-weight:800;color:#5b4ae8">' + esc(c.phone) + '</a>' : c ? '<span style="flex:0 0 auto;padding:3px 9px;border-radius:999px;background:#f2f3f6;font-size:12px;font-weight:800;color:#6b7280">Guest</span>' : '') +
          '</div>';
        }).join('') +
      '</div>');
  }

  // The host's guest list: everyone who replied, by answer, with guests' phone numbers (only the host can read those)
  function viewGuestList(s) {
    const close = () => setState({ guestList: null }), lead = isLead(s);
    const row = (u, i) => {
      const c = lead && s.contacts.find(x => x.user_id === u), name = u === state.me ? 'You' : personName(s, u);
      // Tap someone for their profile (guests without an account have none)
      return '<div data-guest ' + (c ? '' : on(() => openPerson(u)) + ' aria-label="' + esc(name) + ', see profile" ') + 'style="display:flex;align-items:center;gap:12px;min-height:50px;border-top:' + (i ? '1px solid #f2f3f6' : '0') + (c ? '' : ';cursor:pointer') + '">' +
        face(u, name, 32, null) +
        '<span style="flex:1 1 auto;min-width:0;font-size:15.5px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</span>' +
        (c && c.phone ? '<a href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '" style="flex:0 0 auto;font-size:14px;font-weight:800;color:#5b4ae8">' + esc(c.phone) + '</a>' : c ? '<span style="flex:0 0 auto;padding:3px 9px;border-radius:999px;background:#f2f3f6;font-size:12px;font-weight:800;color:#6b7280">Guest</span>' : '') + '</div>';
    };
    const section = (k, label, ink, ids, rowFn) => !ids.length ? '' : '<div data-guest-part="' + k + '" style="display:flex;flex-direction:column;gap:2px"><span style="font-size:12px;font-weight:900;letter-spacing:1px;color:' + ink + '">' + label + ' · ' + ids.length + '</span>' +
      '<div style="display:flex;flex-direction:column">' + ids.map(rowFn).join('') + '</div></div>';
    const part = (k, label, ink) => section(k, label, ink, s.rsvps.filter(r => r.status === k).map(r => r.userId), row);
    // Haven't replied (v7 Update 15, owner 2026-10-02): the people invited who haven't answered, each with a Nudge
    // (once a day per person) while the plan is still ahead
    const open = lead && s.planned && !s.cancelledAt && phaseOf(s) === 'plan';
    const quiet = !open ? [] : notReplied(s);
    const nudgeRow = (i, n) => {
      const name = invitedName(i.userId), done = nudgedToday(i);
      return '<div data-not-replied style="display:flex;align-items:center;gap:12px;min-height:52px;border-top:' + (n ? '1px solid #f2f3f6' : '0') + '">' +
        '<span ' + on(() => openPerson(i.userId)) + ' aria-label="' + esc(name) + ', see profile" style="flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:12px;cursor:pointer">' + face(i.userId, name, 32, null) +
          '<span style="flex:1 1 auto;min-width:0;font-size:15.5px;font-weight:800;color:#0d1117;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</span></span>' +
        '<button type="button" data-nudge ' + on(() => nudge(s, i)) + ' aria-label="' + (done ? 'Nudged ' : 'Nudge ') + esc(name) + '" style="flex:0 0 auto;display:flex;align-items:center;min-height:36px;padding:0 14px;border:0;border-radius:999px;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer;' +
          (done ? 'background:#f2f3f6;color:#8a909b' : 'background:#fff;box-shadow:inset 0 0 0 1.5px #c9c2fb;color:#4a3ad4') + '">' + (done ? 'Nudged' : 'Nudge') + '</button></div>';
    };
    const any = s.rsvps.some(r => lead || r.status !== 'no') || quiet.length > 0;
    // The lead's Guest list (with guests' numbers, Can't and Haven't replied); everyone else sees who's going and who might
    return modal(lead ? 'Who’s coming' : 'Who’s going', close,
      h3Html(lead ? 'Who’s coming' : 'Who’s going') +
      (any ? (lead && s.contacts.some(c => c.phone && s.rsvps.some(r => r.userId === c.user_id)) ? paraHtml('Phone numbers are from people who RSVP’d without an account. Only you see them.') : '') +
        '<div style="display:flex;flex-direction:column;gap:14px">' + part('going', 'GOING', '#0f7a3c') + part('maybe', 'MAYBE', '#b07a0a') + (lead ? part('no', 'CAN’T', '#6b7280') : '') +
          section('none', 'HAVEN’T REPLIED', '#5b4ae8', quiet, nudgeRow) + '</div>'
        : paraHtml(lead ? 'Nobody has replied yet. Share the link to get the word out.' : 'Nobody yet. Be the first.')));
  }

  // People invited to a plan who haven't replied (not its leads)
  const notReplied = (s) => (s.invites || []).filter(i => !s.rsvps.some(r => r.userId === i.userId) && i.userId !== s.leadId && s.cohosts.indexOf(i.userId) < 0);
  const pendingInv = (s) => s.planned && !s.cancelledAt && phaseOf(s) === 'plan' ? notReplied(s).length : 0;
  const invitedName = (u) => nameOf(u, (friendById(u) || {}).name);   // a friend's name comes with Friends
  const nudgedToday = (i) => !!i.nudgedAt && new Date(i.nudgedAt).toDateString() === new Date().toDateString();
  // Nudge someone invited who hasn't replied (nudge_invitee, 20261102040000_invited_and_nudge.sql): a fixed note,
  // once a day per person
  const nudge = (s, i) => {
    const first = firstName(invitedName(i.userId)), today = 'You nudged ' + first + ' today. Try again tomorrow.';
    if (nudgedToday(i)) return toast(today);
    const line = firstName(state.myName || 'You') + ' is hoping you can make ' + s.text + '. Going, Maybe or Can’t?';
    let sent = true;
    quick(s, { invites: s.invites.map(x => x.userId === i.userId ? Object.assign({}, x, { nudgedAt: Date.now() }) : x) },
      async () => { sent = must(await sb.rpc('nudge_invitee', { p_spark: s.id, p_user: i.userId })).data !== false; },
      (ok) => { if (ok) toast(sent ? 'Nudged ' + first + ': “' + line + '”' : today, sent); });
  };

  // Who thanked the host (Round 64d): everyone can see it, as thank-yous are public
  function viewThanksList(s) {
    const close = () => setState({ thanksList: false });
    const who = s.reactions.filter(r => r.kind === 'thanks').map(r => r.userId);
    return modal('Thanks for ' + firstName(nameOf(s.leadId, s.leadName)), close,
      h3Html('Thanks for ' + esc(firstName(nameOf(s.leadId, s.leadName)))) +
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
        (t.act ? '<span ' + on(() => { clearTimeout(toastTimer); setState({ toast: null }); t.act.fn(); }) + ' style="pointer-events:auto;margin-left:6px;flex:0 0 auto;font-size:14.5px;font-weight:800;color:#ecc56a;cursor:pointer">' + esc(t.act.label) + '</span>' : '') +
      '</div></div>';
  }

  // ---------------------------------------------------------------------------
  // Tab bar and the whole view
  // ---------------------------------------------------------------------------

  // v7 Update 16 tab bar (owner, 2026-10-03): Explore · Your tasks · Your calendar (centre, in a ring) · Groups · Profile (a sheet)
  function viewNav() {
    const s = state.screen, prof = state.profSheet, n = tasksBadge();
    // In Create event with something typed, a tab asks about a draft first, then goes there (owner, 2026-10-02)
    const leave = (fn) => () => {
      if (s !== 'compose') return fn();
      if (state.email && evStarted(state)) return setState({ evLeave: true, evLeaveTo: fn, timeOpen: null, dateOpen: null });
      setState(composeReset()); fn();
    };
    const tab = (active, label, icon, fn) => '<div ' + on(leave(fn)) + ' aria-label="' + label + '"' + (active ? ' aria-current="page"' : '') +
      ' style="padding:9px 0;min-height:44px;display:flex;align-items:center;justify-content:center;width:100%;color:' + (active ? '#5b4ae8' : '#6b7280') + ';cursor:pointer">' + icon + '</div>';
    const calOn = s === 'sched' && !prof;
    return '<nav class="tabbar" aria-label="Main">' +
      tab(s === 'calendar' && !prof, 'Explore', svg(23, stroke('currentColor', 1.9), '<circle cx="12" cy="12" r="8.75"/><path d="m15.6 8.4-2.2 5-5 2.2 2.2-5 5-2.2Z"/>'), () => go('calendar')) +
      // the icon sits 3px left so the icon and its count read as centred
      tab(s === 'home' && !prof, n ? 'Your tasks, ' + n : 'Your tasks', '<span style="position:relative;display:flex' + (n ? ';margin-left:-6px' : '') + '">' + svg(23, stroke('currentColor', 1.9), P6.tasks) +
        (n ? '<span aria-hidden="true" style="position:absolute;top:-6px;right:-9px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;border:2px solid #fff;background:#5b4ae8;color:#fff;font-size:10.5px;font-weight:900;display:flex;align-items:center;justify-content:center;box-sizing:border-box">' + (n > 9 ? '9+' : n) + '</span>' : '') + '</span>', () => go('home')) +
      '<div ' + on(leave(() => go('sched'))) + ' aria-label="Your calendar"' + (calOn ? ' aria-current="page"' : '') + ' style="display:flex;align-items:center;justify-content:center;width:100%;cursor:pointer">' +
        '<span style="width:48px;height:48px;border-radius:999px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 ' + (calOn ? '2px #5b4ae8' : '1.9px #c3c7d0') + ';color:' + (calOn ? '#5b4ae8' : '#6b7280') + '">' +
          svg(23, stroke('currentColor', 2.1), '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>') + '</span></div>' +
      tab(s === 'groups' && !prof, 'Groups', I.tabPeople, () => go('groups')) +
      // Gear, not a person: the sheet is profile + settings (owner, 2026-10-01)
      tab(prof, 'Profile', svg(23, stroke('currentColor', 1.9), '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'), openProfileSheet) +
    '</nav>';
  }

  // Full-screen photo (the vibe photos): tap anywhere or ✕ to close, arrows between them
  function viewZoom() {
    const z = state.zoom, n = z.photos.length, close = () => setState({ zoom: null });
    const step = (d) => (e) => { stop(e); setState({ zoom: { photos: z.photos, i: (z.i + d + n) % n } }); };
    const arrow = (d, label, path) => '<span ' + on(step(d)) + ' aria-label="' + label + '" style="position:absolute;top:50%;' + (d < 0 ? 'left' : 'right') + ':12px;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;cursor:pointer">' + path + '</span>';
    return '<div role="dialog" aria-modal="true" aria-label="Photo" data-scrim="' + reg(close) + '" style="position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;animation:fadeIn 160ms ease both;cursor:zoom-out">' +
      '<img data-on="' + reg(close) + '" src="' + esc(z.photos[z.i]) + '" alt="Photo ' + (z.i + 1) + ' of ' + n + '" style="max-width:100%;max-height:100%;object-fit:contain;display:block">' +
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
    else if (s === 'detail' && subj) main = viewDetail(subj);
    else if (s === 'detail' && st.subjectId) main = eventLoading();
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
      (st.peek && s === 'calendar' ? viewPeek() : '') +
      (s === 'browse' && st.loaded && currentGroup() && !st.gSearch && !st.gMenu ? swipeHints() : '') +
      (st.email && st.gSearch && s === 'browse' ? viewGroupSearch() : '') +
      (st.gMenu && s === 'browse' ? viewGroupMenu() : '') +
      (st.shiftPick ? viewShiftSheet() : '') +
      (st.banner ? viewBanner() : '') +
      (s === 'compose' ? viewCompose() : '') +
      (s === 'compose' && (st.evTest == null || st.evKindAsk) && !st.evLeave && !st.loginStep ? viewKindAsk() : '') +
      (s === 'compose' && st.evPop && st.evStep === 'review' && !st.evLeave && !st.loginStep ? viewEvPop() : '') +   // under the poll and job sheets it opens
      (s === 'compose' && st.email ? viewComposeSheets() : st.pollSheet && st.pollSheet.sparkId ? viewComposeSheets() : '') +
      (st.offerKind && subj ? viewOffer(subj) : '') +
      (st.voteAll ? viewVoteAll() : '') +
      (st.interestList && subj ? viewInterestList(subj) : '') +
      (st.guestList && subj && st.guestList === subj.id ? viewGuestList(subj) : '') +
      (st.leadsSheet ? viewLeadsSheet() : '') +
      (st.jobAsk ? viewJobAsk() : '') +
      (st.handOff ? viewHandOff() : '') +
      (st.cohostPick ? viewCohostPicker() : '') +
      (st.leadAsk ? viewLeadAsk() : '') +
      (st.takeDown ? viewTakeDown() : '') +
      (st.thanksList && subj ? viewThanksList(subj) : '') +
      (st.guestOpen ? viewGuest() : '') +
      (st.nameAsk ? viewName() : '') +
      (st.pe ? viewProfileEdit() : '') +
      (st.joinOpen ? viewJoin() : '') +
      (st.nSettings && st.email ? viewNotifSettings() : '') +
      (st.membersOpen ? viewMembers() : '') +
      (st.email && st.pplAdd ? viewPplAdd() : '') +
      (st.email && st.frInvite && st.frSel.length ? viewFrInvite() : '') +
      (st.email && st.person ? viewPerson() : '') +
      (st.frAdd ? viewFrAdd() : '') +
      (st.gpDel != null && s === 'groupPage' ? viewDeleteGroup() : '') +
      (st.acctDel != null && st.email ? viewDeleteAccount() : '') +
      (st.invite ? viewInvite() : '') +
      (st.sec && subj ? viewSecSheet() : '') +
      (st.ph ? viewPositioner() : '') +   // above Edit event, which can open it
      (st.needEd && subj ? viewNeedsSheet() : '') +
      (st.share ? viewShareSheet() : '') +
      (st.startName != null ? viewStartGroup() : '') +
      (st.blast ? viewBlast() : '') +
      (st.loginStep ? (st.inv && st.inv.step === 'land' && st.loginStep === 'code' ? viewInvCode() : viewLogin()) : '') +
      (st.inv && st.inv.step === 'confirm' && st.email ? viewInvConfirm() : '') +
      (st.confirm ? viewConfirm() : '') +
      (st.zoom ? viewZoom() : '') +
      (st.fbOpen && st.demoAdmin ? viewFbInbox() : '') +
      (st.acctOpen && st.demoAdmin ? viewAccounts() : '') +
      (st.fb && st.email ? viewFeedback() : '') +
      (st.installPop ? viewInstallPop() : '') +
      (st.toast ? viewToast() : '') +
      // no tab bar on Welcome, the invite screens, or for a guest on an event (it only led to sign-in)
      (welcomeShown() || invFull() || (!state.email && state.screen === 'detail') ? '' : viewNav()) +
      (st.fbNudge && !st.profSheet && !st.fb ? viewFbNudge() : '') +   // above the tab bar
      (st.fbTip && !st.fbNudge ? viewFbTip() : '');                    // pointing at Profile
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
  // Back from Google the page can load while iOS is still closing the sign-in sheet, so keep nudging for a few seconds
  window.addEventListener('load', () => { [0, 300, 1000, 2000, 4000].forEach(ms => { setTimeout(nudgeLayout, ms); setTimeout(tallFix, ms + 50); }); setTimeout(() => layoutNote('4s after load'), 4200); });
  window.addEventListener('pageshow', nudgeLayout);
  window.addEventListener('resize', () => { if (STANDALONE) setTimeout(nudgeLayout, 100); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && STANDALONE) { setTimeout(nudgeLayout, 100); setTimeout(nudgeLayout, 800); } });
  // Freeze log (temporary): what iOS reports for the screen vs what the app got, when they disagree (the band under
  // the tab bar). All in CSS points.
  const layoutNote = (when) => {
    if (!STANDALONE) return;
    const app = document.querySelector('.app'), probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100lvh;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const lvh = probe.offsetHeight;
    probe.remove();
    const m = { inner: innerHeight, vv: window.visualViewport ? Math.round(visualViewport.height) : 0, client: document.documentElement.clientHeight,
      screen: screen.height, lvh, app: app ? Math.round(app.getBoundingClientRect().bottom) : 0 };
    if (m.app < m.screen - 4 || m.inner < m.screen - 4) diag('layout', 0, when + ' · screen ' + m.screen + ' · app ' + m.app + ' · inner ' + m.inner + ' · vv ' + m.vv + ' · client ' + m.client + ' · lvh ' + m.lvh + (AUTH_RETURN.any ? ' · back from Google' : '') + (tallFixOn ? ' · stretched' : ''));
  };
  // Back from Google in the installed app, iOS reports every height short by the status bar (852 vs 793 on the
  // owner's iPhone, 2026-09-30) and nudging doesn't bring it back. The band under the tab bar is the page's own gray,
  // so stretch the app to the screen's height while that's the case (upright only, short by 20–80pt). Off again
  // as soon as iOS reports the full height (e.g. the next launch).
  let tallFixOn = false;
  const tallFix = () => {
    if (!STANDALONE) return;
    const short = screen.height - innerHeight, upright = innerWidth < innerHeight;
    const on = upright && short >= 20 && short <= 80;
    if (on === tallFixOn) return;
    tallFixOn = on;
    document.documentElement.classList.toggle('tall-fix', on);
    document.documentElement.style.setProperty('--true-h', on ? screen.height + 'px' : '');
  };
  window.addEventListener('resize', () => setTimeout(tallFix, 150));
  // The installed app also comes up short after the keyboard closes (typing an email and code when joining),
  // and when the tab bar comes back after Welcome or the invite screens: nudge then too (2026-09-30)
  const nudgeSoon = () => { if (!STANDALONE) return; setTimeout(nudgeLayout, 60); setTimeout(nudgeLayout, 350); };
  document.addEventListener('focusout', (e) => { if (isField(e.target)) nudgeSoon(); });
  if (window.visualViewport) { let vh = visualViewport.height; visualViewport.addEventListener('resize', () => { if (visualViewport.height > vh + 80) nudgeSoon(); vh = visualViewport.height; }); }
  let hadNoNav = null;
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
    if (!state.demoAdmin) return;   // only the owner's device keeps a log (it's only shown to them)
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
    const noNav = welcomeShown() || invFull() || (!state.email && state.screen === 'detail');
    root.classList.toggle('no-nav', noNav);
    if (hadNoNav && !noNav) { nudgeSoon(); tallFix(); setTimeout(tallFix, 400); setTimeout(() => layoutNote('tab bar back'), 1500); }   // the tab bar is back
    hadNoNav = noNav;
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
    if (el && fn && !(scrim && e.target === scrim)) noteTap6(el);   // for feedback: what was tapped, by its label
    // Clicking outside a menu closes it
    if (state.menu && !e.target.closest('[data-menu]')) setState({ menu: null });
    if (fn) fn(e);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.zoom) return setState({ zoom: null });
      if (state.fb) return setState({ fb: null });
      if (state.installPop) return a2hsLater();
      if (state.inv && state.loginStep === 'code') { closeLogin(); return setState({ invCodeBad: false }); }
      if (state.inv && state.inv.step === 'confirm' && !state.inv.busy) return closeInvite();
      if (state.confirm) return setState({ confirm: null });
      if (state.person) return setState({ person: null });
      if (state.peek) return setState({ peek: null });
      if (state.gMenu) return setState({ gMenu: null });
      if (state.jobAsk) return setState({ jobAsk: null });
      if (state.handOff) return setState({ handOff: null });
      if (state.ph) return closePositioner();
      if (state.invite) return setState({ invite: null });
      if (state.dateOpen) return setState({ dateOpen: null });
      if (state.timeOpen) return setState({ timeOpen: null });
      if (state.sec) return setState({ sec: null });
      if (state.needEd) return setState({ needEd: null });
      if (state.share) return setState({ share: null });
      if (state.pollSheet) return setState({ pollSheet: null });
      if (state.needSheet) return setState({ needSheet: null });
      if (state.evLeave) return setState({ evLeave: false, evLeaveTo: null });
      if (state.shiftPick) return setState({ shiftPick: null });
      if (state.startName != null) return setState({ startName: null });
      if (state.blast) return setState({ blast: null });
      if (state.acctDel != null) return setState({ acctDel: null });
      if (state.gpDel != null) return setState({ gpDel: null });
      if (state.gpRename != null) return setState({ gpRename: null });
      if (state.nSettings) return setState({ nSettings: false });
      if (state.loginStep) return closeLogin();
      if (state.joinOpen) return setState({ joinOpen: false });
      if (state.membersOpen) return setState({ membersOpen: null, membersQ: '' });
      if (state.frAdd && !state.frAdd.busy) return closeFrAdd();
      if (state.frInvite) return setState({ frInvite: false });
      if (state.pplAdd) return setState({ pplAdd: false });
      if (state.pplSearch) return setState({ pplSearch: false, pplQ: '' });
      if (state.pe) return setState({ pe: null });
      if (state.nameAsk) return setState({ nameAsk: null, nameText: '' });
      if (state.guestOpen) return setState({ guestOpen: false, guestThen: null });
      if (state.offerKind) return setState({ offerKind: null, offerText: '' });
      if (state.voteAll) return setState({ voteAll: null });
      if (state.interestList) return setState({ interestList: false });
      if (state.guestList) return setState({ guestList: null });
      if (state.cohostPick) return setState({ cohostPick: null });
      if (state.leadAsk) return setState({ leadAsk: null });
      if (state.leadsSheet) return setState({ leadsSheet: null });
      if (state.takeDown) return setState({ takeDown: null });
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
    // Return / Go in a one-line field presses that screen's main button (the one marked data-enter)
    if (e.key === 'Enter' && !e.isComposing && e.target.matches('input:not([type=file]):not([data-rename])')) {
      const box = e.target.closest('[role="dialog"], .overlay-screen, [data-screen-label]') || root;
      const btn = box.querySelector('[data-enter]:not([aria-disabled="true"])');
      if (btn) { e.preventDefault(); btn.click(); return; }
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
    if (state.screen === 'compose' && location.hash === '#/new') return;   // Back's popstate re-pushed #/new; its hashchange follows
    const target = fromUrl();
    if (target.inviteCode) { takeInvite(target.inviteCode); return; }
    if (target.friendCode) { takeFriendLink(target.friendCode); return; }
    let leaving = {};
    if (state.screen === 'compose') {
      if (composeBack()) { history.pushState(null, '', '#/new'); return; }   // stay in the flow
      leaving = composeReset();
    }
    if (target.screen === state.screen && target.subjectId === state.subjectId && target.gpId === state.gpId) return;
    setState(Object.assign(leaving, { menu: null, offerKind: null, nameAsk: null, confirm: null, loginStep: null, loginThen: null, interestList: false, thanksList: false, guestList: null, back: null,
      profSheet: false, notifSheet: false, dashAll: null, cHandSheet: false, cSearch: false, cq: '', gSearch: false, gq: '', gTry: null }, target));
    const sc = scroller();
    if (sc) sc.scrollTop = 0;
    if (state.me) loadForRoute().catch(e => {
      console.error(e);
      if (state.screen === 'detail' && !subject()) { setState({ screen: 'sched', subjectId: null }); toast('Couldn’t open that event. Check your connection and try again.'); }
    });
  };
  window.addEventListener('popstate', followUrl);
  window.addEventListener('hashchange', followUrl);

  // Every 30 seconds while someone's using it; every 2 minutes after 5 idle minutes; after failures, backing off
  // to 5 minutes. Coming back to the app (and pull to refresh) loads at once.
  let lastInput = Date.now(), lastRefresh = 0, refreshFails = 0;
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  const refresh = (now) => {
    if (!state.me || state.busy || document.hidden) return;
    const t = Date.now(), every = refreshFails ? Math.min(300000, 30000 * 2 ** refreshFails) : t - lastInput > 300000 ? 120000 : 30000;
    if (now !== true && t - lastRefresh < every - 2000) return;
    lastRefresh = t;
    loadFresh()
      .then(() => {
        refreshFails = 0;
        if (state.error === 'load') setState({ error: null });
        // The event on screen was taken down (or you lost access): say so instead of showing a blank page
        if (state.screen === 'detail' && state.subjectId && !subject() && !routeLoading) setState({ screen: 'sched', subjectId: null, goneOpen: true, sec: null, needEd: null });
      })
      .catch(e => { console.error(e); refreshFails++; if (!state.loaded || state.error) setState({ error: 'load', loaded: true }); });
  };
  document.addEventListener('visibilitychange', () => refresh(true));
  // Time toward the feedback nudge: counted every 15 seconds while the app is on screen (a check soon after opening
  // picks up time from earlier visits)
  document.addEventListener('visibilitychange', () => { fbTickAt = Date.now(); });
  setInterval(fbNudgeTick, 15000);
  setTimeout(fbNudgeTick, 4000);

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
      if (go) { hintLearned(); switchTab(next, dir, true); }   // the neighbour is already where it belongs, so no slide-in
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
      // Back from Google mid-invite: nothing may leave the Joining screen hanging. Signed in → join now (inviteJoin
      // shows Try again if it fails); not signed in → the landing.
      if (state.inv && state.inv.step === 'joining' && !state.inv.busy) {
        const s0 = (await sb.auth.getSession()).data.session;
        if (s0 && !s0.user.is_anonymous) { if (!state.email) noteSession(s0); inviteJoin(); }
        else setInv({ step: 'land' });
      }
      await loadForRoute();
      if (invite) takeInvite(invite);
      if (pendingFriend()) startFriendAdd(pendingFriend());   // a friend link, or back from Google signing in for one
      if (state.inv && state.inv.step === 'confirm' && !state.email) setInv({ step: 'land' });   // the saved session had ended
      if (state.profSheet && !state.email) { setState({ profSheet: false }); openLogin('profile', () => go('sched', { profSheet: true })); }
    } catch (e) {
      console.error(e);
      setState(Object.assign({ error: 'load', loaded: true }, state.screen === 'detail' && !subject() ? { screen: 'sched', subjectId: null } : {}));
    }
  }

  const bootHash = location.hash;
  Object.assign(state, fromUrl());
  // The link, or an invite that was still open when the page reloaded (phones drop the tab while people fetch their code)
  const bootInvite = state.inviteCode || (sb && !AUTH_RETURN.any ? pendingInvite() : '');
  delete state.inviteCode;
  if (state.friendCode) { setPendingFriend(state.friendCode); history.replaceState(null, '', '/'); }
  delete state.friendCode;
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
      ? { isGoogle: c.isGoogle, myName: c.myName || '', myAvatar: c.myAvatar, myPlace: c.myPlace || '', myBio: c.myBio || '', memberSince: c.memberSince || null, groups: c.groups || [], sparks: (c.sparks || []).map(x => Object.assign({ leadAsks: [], invites: [], jobAsks: [], leadOffer: null }, x)), profiles: c.profiles || {},
          sizes: c.sizes || {}, notif: c.notif || state.notif, demoAdmin: !!c.demoAdmin, fr: c.fr && c.fr.friends ? c.fr : state.fr, loaded: true, fromCache: true }
      : {});
  }
  // Create event was open when the page reloaded: pick it up where it was
  if (bootUser && bootHash === '#/new' && !state.inv) {
    const k = keptCompose(bootUser.id);
    if (k) {
      Object.assign(state, blankCompose(), draftState({ id: k.evDraftId, data: k }), { screen: 'compose', evFrom: ORIGINS.indexOf(k.evFrom) > -1 ? k.evFrom : null });
      try {
        const u = sessionStorage.getItem(COMPOSE_PHOTO);
        if (u) { keptBlob = dataUrlToBlob(u); state.photos = [{ blob: keptBlob, url: URL.createObjectURL(keptBlob) }]; }
      } catch (e) { /* the photo didn't survive: they pick it again */ }
      history.replaceState(null, '', location.pathname + location.search + '#/new');
    }
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
