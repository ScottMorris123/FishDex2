// Bump the cache name to avoid any stale 404s being cached
const CACHE_NAME = 'fishdex-sharded-v2';
const ASSETS = ['./','./index.html','./manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k === CACHE_NAME ? null : caches.delete(k)));
    self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (ASSETS.some(a => url.pathname.endsWith(a.replace('./','/')) || (a==='./' && url.pathname.endsWith('/')))) {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }
  if (url.pathname.includes('/fishdex_sharded/') && url.pathname.endsWith('.json')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      try {
        const res = await fetch(req);
        cache.put(req, res.clone());
        return res;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    try { return await fetch(req); }
    catch { return (await caches.match(req)) || Response.error(); }
  })());
});
