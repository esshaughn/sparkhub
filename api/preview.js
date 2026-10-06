// Link previews. Chat apps (iMessage, WhatsApp, Facebook…) don't run the app's JavaScript and
// ignore everything after '#', so shared links are real paths: /e/<event code> (since v8-8; old /i/<id> links redirect
// there until 2027-04-06), /join/<code> and /add/<friend code>
// (rewrites in vercel.json). This serves the normal index.html with its preview tags (between
// <!-- preview --> and <!-- /preview -->) filled in for that idea or group; the app then boots as
// usual. The details come from link_preview() / group_preview() (only what's safe to show anyone
// holding the link; invite-only plans stay generic). Any failure serves the page unchanged.
const fs = require('fs');
const path = require('path');

const LIVE_HOSTS = ['gosparkhub.vercel.app', 'sparkhub.wereallneighbors.org', 'torrezhub.vercel.app'];   // keep in step with js/config.js
const DB = {
  live: { url: 'https://xwrzfpgsazyrgieymtee.supabase.co', key: 'sb_publishable_NrnRB0SC3-dzeCJTU6vUjQ_328Q1BJC' },
  test: { url: 'https://hroxgvxvafgikikviiud.supabase.co', key: 'sb_publishable_f7dwskaTS-TV42YC-p0lFw_9Pe8FY1O' },
  // The Supabase on a developer's computer (tests/local/start.sh), for the previews test with E2E_DB=local
  local: { url: 'http://127.0.0.1:54321', key: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' }
};
const SITE = 'https://gosparkhub.vercel.app';
// Groups whose invite link has its own preview card and title (owner, 2026-10-01). Fixed codes only (CLAUDE.md: TORREZ, HUNTER)
const INVITE_CARDS = {
  TORREZ: { title: 'Join Torrez Fitness | Spark Hub | Plans with your people', image: '/photos/share-torrez.jpg' },
  HUNTER: { title: 'Join Hub on Hunters | Spark Hub | Plans with your people', image: '/photos/share-hub.jpg' }
};
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE = /^[A-Za-z0-9]{6}$/;
const ECODE = /^[a-z0-9]{6,16}$/;
const PHOTO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/, SITE_PHOTO = /^photos\/[a-z0-9-]+\.(jpg|png)$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let page;
const indexHtml = () => page || (page = fs.readFileSync(
  [path.join(__dirname, '..', 'index.html'), path.join(process.cwd(), 'index.html')].find(f => fs.existsSync(f)), 'utf8'));

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const photoUrl = (db, p) => PHOTO.test(p || '') ? db.url + '/storage/v1/object/public/spark-photos/' + p
  : SITE_PHOTO.test(p || '') ? SITE + '/' + p : null;

// "Sat, Oct 12 · 7pm" (the app's own format)
const when = (date, time) => {
  if (!date) return '';
  const d = new Date(date + 'T12:00:00Z');
  let out = DAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  if (time) {
    const [h, m] = time.split(':').map(Number);
    out += ' · ' + ((h % 12) || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm');
  }
  return out;
};

async function rpc(db, fn, args) {
  const r = await fetch(db.url + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: db.key, Authorization: 'Bearer ' + db.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(3000)
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows && rows[0] || null;
}

// The short link's preview (Design v8-8): the event only. Title, "{day} · {location}", its photo or the purple sparkle
// card; no group name. event_preview() returns nothing for an invite-only or cancelled event (generic tags)
async function details(db, q) {
  if (q.e && ECODE.test(q.e)) {
    const s = await rpc(db, 'event_preview', { p_code: q.e });
    if (!s) return null;
    return { title: s.title, description: [when(s.day_date, s.day_time), s.spot].filter(Boolean).join(' · ') || 'On Spark Hub', image: photoUrl(db, s.photo) };
  }
  if (q.i && ID.test(q.i)) {
    const s = await rpc(db, 'link_preview', { p_spark: q.i });
    if (!s) return null;
    // "Buffy Bingo – Thu, Oct 1" (the date moves up to the title; the time and place stay below)
    const time = s.day_date && s.day_time ? when(s.day_date, s.day_time).split(' · ')[1] : '';
    const bits = [time, s.spot].filter(Boolean).join(' · ');
    return {
      title: s.title + (s.day_date ? ' – ' + when(s.day_date) : ''),
      description: (bits ? bits + ' · ' : '') + (s.planned ? 'A plan in ' : 'An idea in ') + s.group_name + ' on Spark Hub',
      image: photoUrl(db, s.photo)
    };
  }
  if (q.join && CODE.test(q.join)) {
    const g = await rpc(db, 'group_preview', { p_code: q.join.toUpperCase() });
    if (!g) return null;
    const card = INVITE_CARDS[q.join.toUpperCase()];
    return {
      title: card ? card.title : 'Join ' + g.name + ' on Spark Hub',
      tab: card ? card.title : null,
      description: 'You’re invited to ' + g.name + '. Make plans with your people and show up together.',
      image: card ? SITE + card.image : photoUrl(db, g.photo)
    };
  }
  if (q.add && CODE.test(q.add)) {
    const f = await rpc(db, 'friend_link_preview', { p_code: q.add.toUpperCase() });
    if (!f) return null;
    const first = String(f.name || '').trim().split(/\s+/)[0] || 'Someone';
    return {
      title: 'Be friends with ' + first + ' on Spark Hub',
      description: 'Friends on Spark Hub can invite each other to events, even across groups.',
      image: photoUrl(db, f.avatar_path)
    };
  }
  return null;
}

const tags = (d, url) => [
  '<meta property="og:site_name" content="Spark Hub">',
  '<meta property="og:type" content="website">',
  '<meta property="og:url" content="' + esc(url) + '">',
  '<meta property="og:title" content="' + esc(d.title) + '">',
  '<meta property="og:description" content="' + esc(d.description) + '">',
  '<meta property="og:image" content="' + esc(d.image || SITE + '/icons/share.jpg') + '">',
  '<meta name="twitter:card" content="summary_large_image">'
].join('\n');

module.exports = async (req, res) => {
  let html = indexHtml();
  try {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const db = host === '127.0.0.1' ? DB.local : DB[LIVE_HOSTS.indexOf(host) > -1 ? 'live' : 'test'];
    const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    // An old /i/{id} link: send it on to the event's short link (until 2027-04-06; after that the app says it expired)
    if (q.i && ID.test(q.i)) {
      const r = await fetch(db.url + '/rest/v1/rpc/link_code_for', { method: 'POST', headers: { apikey: db.key, Authorization: 'Bearer ' + db.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_spark: q.i }), signal: AbortSignal.timeout(3000) });
      const code = r.ok ? await r.json() : null;
      if (typeof code === 'string' && ECODE.test(code)) {
        res.statusCode = 301;
        res.setHeader('Location', (db === DB.live ? 'https://sparkhub.wereallneighbors.org' : (host === '127.0.0.1' ? 'http://' : 'https://') + host) + '/e/' + code);
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
        res.end();
        return;
      }
    }
    const d = await details(db, q);
    if (d) {
      const url = 'https://' + host + (q.e ? '/e/' + q.e : q.i ? '/i/' + q.i : q.add ? '/add/' + q.add : '/join/' + q.join);
      html = html
        .replace(/<!-- preview -->[\s\S]*?<!-- \/preview -->/, () => '<!-- preview -->\n' + tags(d, url) + '\n<!-- /preview -->')   // a function: "$&" in a title must stay text
        .replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(d.tab || d.title + ' · Spark Hub') + '</title>');
    }
  } catch (e) {
    console.error(e);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.statusCode = 200;
  res.end(html);
};
