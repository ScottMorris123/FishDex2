// sw.js
const CACHE = 'fishdex-v2';
const ASSETS = [
  './',                // index.html
  './index.html',
  './encyclopedia.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  // add your CSS, JS, and any local images used on the homepage:
  './styles.css',
  './script.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigation; cache-first for static assets
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Always use network-first for HTML/document navigations and do not cache them
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for static assets only (scripts, styles, images, fonts, JSON)
  if (req.method === 'GET') {
    e.respondWith(
      caches.match(req).then(cached =>
        cached ||
        fetch(req).then(res => {
          try {
            const resClone = res.clone();
            caches.open(CACHE).then(c => c.put(req, resClone));
          } catch {}
          return res;
        }).catch(() => cached)
      )
    );
  }
});
