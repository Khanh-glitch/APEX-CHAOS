/* APEX CHAOS — restore omitted production art from its immutable upstream commit.
   Never falls back to generated shapes or substitutes a different artwork. */
const UPSTREAM = 'https://raw.githubusercontent.com/Khanh-glitch/APEX-CHAOS/9d06036dda72eff6afe7bb1e34bc72652ae9c248/public';
const CACHE = 'apex-missing-art-9d06036d-v1';
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      !/^\/(?:assets\/|gold\/(?:assets\/|fonts\/))/.test(url.pathname)) return;
  event.respondWith((async () => {
    try {
      const local = await fetch(request);
      if (local.ok && !(local.headers.get('content-type') || '').includes('text/html')) return local;
    } catch (_) { /* target may be absent in an incomplete Arena export */ }
    const cache = await caches.open(CACHE);
    const cached = await cache.match(url.pathname);
    if (cached) return cached;
    try {
      const remote = await fetch(UPSTREAM + url.pathname, { mode: 'cors', credentials: 'omit', redirect:'follow' });
      if (remote.ok) {
        try { await cache.put(url.pathname, remote.clone()); } catch (_) {}
        return remote;
      }
    } catch (error) { console.warn('[APEX missing official art]', url.pathname, error); }
    return new Response('APEX official asset not found: ' + url.pathname, {status:404,headers:{'content-type':'text/plain'}});
  })());
});
