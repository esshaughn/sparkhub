// Spark Hub service worker: push notifications (and the icon badge) only. It deliberately has no
// fetch handler and caches no pages, so the site keeps loading straight from the network (and ?v= cache-busting
// in index.html keeps working).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// The Home Screen badge: one more for each push (the app resets it to the real unread count when
// it opens). The count is one small entry in the 'spark-hub-badge' cache, not a cached page.
const bumpBadge = async () => {
  if (!self.navigator || !('setAppBadge' in self.navigator)) return;
  try {
    const c = await caches.open('spark-hub-badge'), r = await c.match('/badge-count');
    const n = (r ? parseInt(await r.text(), 10) || 0 : 0) + 1;
    await c.put('/badge-count', new Response(String(n)));
    await self.navigator.setAppBadge(n);
  } catch (err) { /* the badge is a nice-to-have */ }
};

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(bumpBadge().then(() => self.registration.showNotification(d.title || 'Spark Hub', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/' }
  })));
});

// Tapping a notification opens the app at that event (or brings an open window there)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin !== self.location.origin) continue;
      await w.focus();
      w.postMessage({ type: 'open', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
