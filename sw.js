const CACHE_NAME = 'lmb-stats-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.php',
  './assets/css/material-theme.css',
  './assets/js/app.js',
  './assets/js/offline-sync.js',
  './assets/js/live-scorer.js',
  './assets/images/lmb_logo.png',
  './assets/images/team_daom.png',
  './assets/images/team_ferro.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Roboto:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
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
  // Network first for API endpoints, Cache first for assets
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((res) => res || fetch(e.request))
    );
  }
});
