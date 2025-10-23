var cacheName = 'turunmap-pwa-v1';
// Keep a minimal list; don't hardcode the generated wasm/js names here.
// Trunk generates artifact filenames; if you want to cache them explicitly, update this after building.
var filesToCache = [
  './',
  './index.html'
];

/* Start the service worker and cache minimal content */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(cacheName).then(function (cache) {
      return cache.addAll(filesToCache);
    })
  );
});

/* Fetch handler: network-first, fallback to cache */
self.addEventListener('fetch', function (e) {
  e.respondWith(
    fetch(e.request).then(function (response) {
      // optionally update cache for navigation requests
      return response;
    }).catch(function () {
      return caches.match(e.request).then(function (response) {
        return response || caches.match('./index.html');
      });
    })
  );
});
