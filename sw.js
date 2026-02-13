/* Service Worker — оффлайн и кэширование. При релизе увеличивайте версию в CACHE_NAME. */
var CACHE_NAME = 'cattle-tracker-v4';
var urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
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
  './js/utils/constants.js',
  './js/utils/utils.js',
  './js/core/events.js',
  './js/api/api-client.js',
  './js/storage/storage-objects.js',
  './js/storage/storage-entries.js',
  './js/storage/storage-integrity.js',
  './js/storage/storage.js',
  './js/core/core.js',
  './js/core/users.js',
  './js/ui/ui-helpers.js',
  './js/ui/cow-operations.js',
  './js/utils/voice-handler.js',
  './js/core/app.js',
  './js/core/menu.js',
  './js/features/sync.js',
  './js/features/export-import-parse.js',
  './js/features/export-import.js',
  './js/features/export-excel.js',
  './js/features/insemination.js',
  './js/features/view-cow.js',
  './js/features/search-filter.js',
  './js/features/notifications.js',
  './js/features/analytics-calc.js',
  './js/features/analytics.js',
  './js/features/backup.js',
  './js/features/view-list-fields.js',
  './js/features/view-list.js',
  './js/ui/field-config.js',
  './js/features/protocols.js'
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
