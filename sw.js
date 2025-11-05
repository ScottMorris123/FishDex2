// sw.js
// Bump the cache version whenever static assets or caching strategies change
const CACHE = 'fishdex-v5';
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
  './icons/pole.svg',
  './icons/family.svg',
  './icons/saltwater.svg'
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

  // Only handle GET; let non-GET pass through
  if (req.method !== 'GET') return;

  // HTML documents: network-first to avoid serving stale pages
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      try {
        // Force a network fetch that bypasses HTTP caches to avoid stale HTML
        const fresh = await fetch(new Request(req.url, { cache: 'no-store' }));
        return fresh;
      } catch (err) {
        const cachedPage = await caches.match(req, { ignoreSearch: true });
        if (cachedPage) return cachedPage;
        return caches.match('./index.html');
      }
    })());
    return;
  }

  // Stale-while-revalidate for images, styles, and scripts
  if (['image', 'style', 'script', 'font'].includes(req.destination)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const fetchAndUpdate = fetch(req)
        .then(res => { cache.put(req, res.clone()); return res; })
        .catch(() => null);
      // Return cached immediately if present; otherwise wait on network
      return cached || (await fetchAndUpdate) || (req.destination === 'image' ? (await caches.match('./icons/fish.svg')) : fetch(req));
    })());
    return;
  }

  // JSON and other GET requests: network-first (no-store) with cache fallback
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(new Request(req.url, { cache: 'no-store' }));
      cache.put(req, res.clone());
      return res;
    } catch (err) {
      const cached = await cache.match(req);
      if (cached) return cached;
      const any = await caches.match(req, { ignoreSearch: true });
      if (any) return any;
      throw err;
    }
  })());
});
