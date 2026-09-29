// Web push sender. The database (private.push_send, supabase/migrations/20261010000000_web_push.sql)
// works out who to tell and posts their devices here with a shared secret; this signs each message
// with the VAPID key and hands it to the push services (Apple, Google, Mozilla). Both databases
// use this one function; it never reads the database. Its reply lists devices the push services
// say are gone, which the daily job then forgets.
// Vercel env: PUSH_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (Production).
const crypto = require('crypto');
const webpush = require('web-push');

const same = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const text = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';

module.exports = async (req, res) => {
  const { PUSH_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!PUSH_SECRET || !same(req.headers['x-push-secret'], PUSH_SECRET)) return res.status(403).json({ error: 'forbidden' });
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'push keys missing' });
  webpush.setVapidDetails('mailto:sparks@mail.ericscott-creative.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const b = req.body || {};
  const subs = (Array.isArray(b.subs) ? b.subs : []).filter(s => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys).slice(0, 500);
  const url = typeof b.url === 'string' && /^\/[#\w/-]*$/.test(b.url) ? b.url : '/';
  const payload = JSON.stringify({ title: text(b.title, 120) || 'Spark Hub', body: text(b.body, 240), url, tag: text(b.tag, 120) });

  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(s, payload, { TTL: 86400, urgency: 'normal' })));
  const gone = [];
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sent++;
    else if (r.reason && (r.reason.statusCode === 404 || r.reason.statusCode === 410)) gone.push(subs[i].endpoint);
    else console.error('push failed', r.reason && (r.reason.statusCode || r.reason.message));
  });
  return res.status(200).json({ sent, gone });
};
