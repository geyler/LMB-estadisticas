const CACHE_NAME = 'lmb-stats-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.php',
  './assets/css/material-theme.css',
  './assets/js/app.js',
  './assets/js/offline-sync.js',
  './assets/js/live-scorer.js',
  './assets/images/lmb_logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Network-First for API requests with dynamic cache fallback
  if (url.pathname.includes('/api/')) {
    e.respondWith(
      fetch(req).then((networkRes) => {
        if (req.method === 'GET' && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => {
        return caches.match(req).then((cachedRes) => {
          if (cachedRes) return cachedRes;
          return new Response(JSON.stringify({ success: false, message: "Sin conexión. Mostrando datos locales en caché." }), {
            headers: { 'Content-Type': 'application/json' }
          });
        });
      })
    );
  } else {
    // Network-First with Cache Fallback for static assets to ensure latest updates
    e.respondWith(
      fetch(req).then((networkRes) => {
        if (networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => {
        return caches.match(req);
      })
    );
  }
});
