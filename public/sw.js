// Royal Magic Calendar - PWA Service Worker for stable offline operations
const CACHE_NAME = 'royal-magic-v2';
const PRE_CACHE_RESOURCES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE_RESOURCES);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Dynamic cache-first strategy with network update (Stale-While-Revalidate)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // We only cache internal documentations, scripts, styles, local assets, icons, and fonts
  const isWebPageOrAsset = event.request.destination === 'document' ||
                           event.request.destination === 'script' ||
                           event.request.destination === 'style' ||
                           event.request.destination === 'font' ||
                           event.request.destination === 'image' ||
                           url.pathname.endsWith('.js') ||
                           url.pathname.endsWith('.css') ||
                           url.pathname.endsWith('.json') ||
                           url.pathname.endsWith('.ico');

  if (!isWebPageOrAsset) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
        return null;
      });

      return cachedResponse || fetchPromise || caches.match('/');
    })
  );
});
