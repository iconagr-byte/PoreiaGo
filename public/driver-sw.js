/**
 * Driver Command Center — cache manifest, offline σελίδα, PWA assets.
 */
const CACHE = 'aerostride-driver-v4';
const MANIFEST_PREFIX = '/driver-cache/manifest/';
const OFFLINE_URL = '/driver-offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/driver-telemetry-manifest.webmanifest',
  '/icons/driver-pwa.svg',
  '/icons/driver-pwa-192.png',
  '/icons/driver-pwa-512.png',
];

function offlineHtmlResponse() {
  const body = `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Χωρίς σύνδεση</title><style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;padding:24px;text-align:center}h1{color:#facc15;font-size:1.25rem}p{color:#a3a3a3;line-height:1.5}button{margin-top:16px;padding:14px 20px;border:0;border-radius:14px;background:#facc15;color:#0a0a0a;font-weight:800;font-size:1rem;width:100%;max-width:280px}</style></head><body><div><h1>Δεν υπάρχει σύνδεση</h1><p>Η ζωντανή GPS θέση απαιτεί internet. Δοκιμάστε ξανά όταν επανέλθει το δίκτυο.</p><button type="button" onclick="location.reload()">Δοκιμή ξανά</button></div></body></html>`;
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
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key.startsWith('aerostride-driver-') && key !== CACHE).map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === 'CACHE_MANIFEST' && event.data.tripId) {
    const key = `${MANIFEST_PREFIX}${event.data.tripId}`;
    caches.open(CACHE).then((cache) => {
      cache.put(
        key,
        new Response(JSON.stringify(event.data.manifest ?? {}), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  }
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'PoreiaGo Οδηγός',
    body: 'Νέα ενημέρωση βάρδιας',
    url: '/driver',
    tag: 'driver-pwa',
    data: {},
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    tag: payload.tag || 'driver-pwa',
    data: {
      url: payload.url || '/driver',
      ...(payload.data || {}),
    },
    icon: '/icons/driver-pwa-192.png',
    badge: '/icons/driver-pwa-192.png',
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'PoreiaGo Οδηγός', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  let target = data.url || data.auth_url || '/driver';
  if (target.startsWith('/')) {
    target = `${self.location.origin}${target}`;
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client && client.url.includes('/driver')) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
      return undefined;
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.pathname.startsWith('/driver')) {
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
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
        return res;
      })),
    );
    return;
  }

  if (!url.pathname.includes('/api/driver/manifest')) {
    return;
  }

  const tripId = url.searchParams.get('trip_id') || '1';
  const cacheKey = `${MANIFEST_PREFIX}${tripId}`;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        clone.json().then((data) => {
          caches.open(CACHE).then((cache) =>
            cache.put(cacheKey, new Response(JSON.stringify(data))),
          );
        });
        return res;
      })
      .catch(() =>
        caches.match(cacheKey).then(
          (r) =>
            r ||
            new Response(JSON.stringify({ offline: true, message: 'Manifest offline — χωρίς σύνδεση' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
        ),
      ),
  );
});
