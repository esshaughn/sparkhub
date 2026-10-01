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
// Chrome/Android (FCM), Safari (Apple), Firefox (Mozilla), Edge/Windows (WNS)
const PUSH_HOST = /^https:\/\/(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)\//;
const CHUNK = 50;
const text = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';

module.exports = async (req, res) => {
  const { PUSH_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!PUSH_SECRET || !same(req.headers['x-push-secret'], PUSH_SECRET)) return res.status(403).json({ error: 'forbidden' });
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'push keys missing' });
  webpush.setVapidDetails('mailto:sparks@mail.ericscott-creative.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const b = req.body || {};
  const all = Array.isArray(b.subs) ? b.subs : [];
  // Only the push services' own addresses (the database's push_endpoint_ok() has the same rule)
  const subs = all.filter(s => s && typeof s.endpoint === 'string' && PUSH_HOST.test(s.endpoint) && s.keys);
  if (subs.length < all.length) console.warn('push: dropped', all.length - subs.length, 'devices that aren\'t push-service addresses');
  const url = typeof b.url === 'string' && /^\/[#\w/-]*$/.test(b.url) ? b.url : '/';
  const payload = JSON.stringify({ title: text(b.title, 120) || 'Spark Hub', body: text(b.body, 240), url, tag: text(b.tag, 120) });

  // In chunks, so a big group doesn't open hundreds of connections at once (and nobody is cut off)
  const gone = [];
  let sent = 0, failed = 0;
  for (let i = 0; i < subs.length; i += CHUNK) {
    const chunk = subs.slice(i, i + CHUNK);
    const results = await Promise.allSettled(chunk.map(s => webpush.sendNotification(s, payload, { TTL: 86400, urgency: 'normal' })));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') sent++;
      else if (r.reason && (r.reason.statusCode === 404 || r.reason.statusCode === 410)) gone.push(chunk[j].endpoint);
      else { failed++; console.error('push failed', r.reason && (r.reason.statusCode || r.reason.message)); }
    });
  }
  if (failed) console.warn('push: sent', sent, 'failed', failed, 'gone', gone.length);
  return res.status(200).json({ sent, gone });
};
