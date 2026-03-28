const CACHE_NAME = '2048-rgb-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Cache bust: triggered by postMessage({ type: 'BUST_CACHE' }) ──────────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'BUST_CACHE') {
    e.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => caches.open(CACHE_NAME))
        .then(cache => cache.addAll(ASSETS))
        .then(() => {
          // Notify all open clients that the bust is done
          self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ type: 'BUST_DONE' }));
          });
        })
    );
  }
});
