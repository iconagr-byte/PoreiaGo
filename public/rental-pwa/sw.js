/**
 * Rental customer PWA — offline shell (scope /rent).
 * Assets under /rental-pwa/ so /rent SPA route is not a static directory.
 */
const CACHE = 'poreiago-rental-v2';
const OFFLINE_URL = '/rental-pwa/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/rental-pwa/manifest.webmanifest',
  '/icons/rental-pwa.svg',
  '/icons/rental-pwa-192.png',
  '/icons/rental-pwa-512.png',
];

function offlineHtmlResponse() {
  return caches.match(OFFLINE_URL).then((cached) => {
    if (cached) return cached;
    return fetch(OFFLINE_URL).catch(
      () =>
        new Response('<h1>Offline</h1>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    );
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('poreiago-rental-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.pathname.startsWith('/rent')) {
    event.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(() => offlineHtmlResponse()),
    );
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
            return res;
          }),
      ),
    );
  }
});
