/* Service Worker — оффлайн и кэширование. При релизе увеличивайте версию в CACHE_NAME. */
var CACHE_NAME = 'cattle-tracker-v5';
var urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './app-icons/icon.svg',
  './css/style.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/components-buttons.css',
  './css/components-forms.css',
  './css/components-cards.css',
  './css/components-tables.css',
  './css/screens/search-filter.css',
  './css/screens/notifications.css',
  './css/screens/tasks-analytics.css',
  './css/screens/modals-auth-backup.css',
  './css/forms.css',
  './css/responsive.css',
  './css/sync.css',
  './css/view-cow.css',
  './css/print.css',
  './dist/app.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(urlsToCache).catch(function () {});
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.url.indexOf(self.location.origin) !== 0) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(function (res) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clone);
        });
        return res;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          if (cached) return cached;
          return caches.match('./index.html') || caches.match('./');
        });
      })
  );
});
