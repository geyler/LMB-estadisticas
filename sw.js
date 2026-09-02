// Pure Real-Time Service Worker - Zero Caching
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Always fetch directly from network in real-time
  e.respondWith(fetch(e.request, { cache: 'no-store' }));
});
