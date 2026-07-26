/**
 * My Wallet — offline last pass shell (scope /wallet).
 * Does not claim root `/` so push `/sw.js` can coexist.
 */
const CACHE = 'poreiago-wallet-v1';
const OFFLINE_URL = '/wallet/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/wallet/manifest.webmanifest',
  '/icons/wallet-pwa.svg',
  '/icons/wallet-pwa-192.png',
  '/icons/wallet-pwa-512.png',
];

function offlineHtmlResponse() {
  const body = `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>My Wallet — Offline</title><style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#e8eef5;color:#0f172a;font-family:system-ui,sans-serif;padding:24px;text-align:center}h1{font-size:1.25rem}p{color:#64748b;line-height:1.5}button{margin-top:16px;padding:14px 20px;border:0;border-radius:14px;background:#0f172a;color:#fff;font-weight:800;font-size:1rem;width:100%;max-width:280px}</style></head><body><div><h1>Χωρίς σύνδεση</h1><p>Ανοίξτε ξανά όταν επανέλθει το δίκτυο — το τελευταίο εισιτήριο μπορεί να εμφανιστεί από τοπική αποθήκευση.</p><button type="button" onclick="location.reload()">Δοκιμή ξανά</button></div></body></html>`;
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
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
            .filter((key) => key.startsWith('poreiago-wallet-') && key !== CACHE)
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

  if (request.mode === 'navigate' && url.pathname.startsWith('/wallet')) {
    event.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(() =>
          caches.match(OFFLINE_URL).then((cached) => cached || offlineHtmlResponse()),
        ),
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
