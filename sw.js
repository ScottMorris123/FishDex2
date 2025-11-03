// sw.js
const CACHE = 'fishdex-v3';
// App shell (only files that actually exist)
const ASSETS = [
  './',                // index.html
  './index.html',
  './encyclopedia.html',
  './category.html',
  './types.html',
  './type-results.html',
  './species.html',
  './manifest.json',
  // Core icons actually present
  './icons/fish.svg',
  './icons/home.svg',
  './icons/book.svg',
  './icons/gamefish.svg',
  './icons/commercial.svg',
  './icons/baitfish.svg',
  './icons/pole.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // If any asset fails, don't block install entirely; proceed with whatever cached
        console.warn('[SW] precache error', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Allow manual immediate activation after update
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Network-first for navigation; cache-first for static assets
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Navigation: network-first, then cached page (if precached), then fallback to index.html
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch (err) {
        // try exact cached page first
        const cachedPage = await caches.match(req, { ignoreSearch: true });
        if (cachedPage) return cachedPage;
        // final fallback to shell
        return caches.match('./index.html');
      }
    })());
    return;
  }

  if (req.method !== 'GET') return; // let non-GET pass through

  // Images: serve cached or fallback to fish.svg
  if (req.destination === 'image') {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        const put = res.clone();
        caches.open(CACHE).then(c => c.put(req, put));
        return res;
      } catch {
        return caches.match('./icons/fish.svg');
      }
    })());
    return;
  }

  // Default: cache-first with network fallback, and cache the response for offline reuse
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const put = res.clone();
      caches.open(CACHE).then(c => c.put(req, put));
      return res;
    } catch (err) {
      // as a last resort return whatever cached version we might have (even if mismatched by search params)
      const any = await caches.match(req, { ignoreSearch: true });
      if (any) return any;
      throw err;
    }
  })());
});
