/**
 * Tour Leader luggage PWA — offline shell + cache for /tour routes.
 */
const CACHE = 'poreiago-tour-leader-v1';
const OFFLINE_URL = '/tour-leader-offline.html';

const PRECACHE_URLS = [OFFLINE_URL];

function offlineHtmlResponse() {
  const body = `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Χωρίς σύνδεση</title><style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;font-family:system-ui,sans-serif;padding:24px;text-align:center}h1{color:#38bdf8;font-size:1.25rem}p{color:#94a3b8;line-height:1.5}button{margin-top:16px;padding:14px 20px;border:0;border-radius:14px;background:#38bdf8;color:#0f172a;font-weight:800;font-size:1rem;width:100%;max-width:280px}</style></head><body><div><h1>Χωρίς σύνδεση</h1><p>Οι αλλαγές αποσκευών παραμένουν στην ουρά και θα συγχρονιστούν όταν επανέλθει το δίκτυο.</p><button type="button" onclick="location.reload()">Δοκιμή ξανά</button></div></body></html>`;
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
            .filter((key) => key.startsWith('poreiago-tour-leader-') && key !== CACHE)
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

  if (request.mode === 'navigate' && url.pathname.startsWith('/tour')) {
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
