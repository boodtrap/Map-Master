var cacheName = 'turunmap-pwa-v1';
// Minimal cache list so we don't hardcode generated artifact filenames from trunk.
var filesToCache = [
  './',
  './index.html'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(cacheName).then(function (cache) {
      return cache.addAll(filesToCache);
    })
  );
});

// network-first, fallback to cache
self.addEventListener('fetch', function (e) {
  e.respondWith(
    fetch(e.request).then(function (response) {
      return response;
    }).catch(function () {
      return caches.match(e.request).then(function (response) {
        return response || caches.match('./index.html');
      });
    })
  );
});
