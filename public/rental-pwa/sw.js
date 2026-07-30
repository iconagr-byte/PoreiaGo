/**
 * Rental customer PWA — offline shell (scope /rent).
 * Assets under /rental-pwa/ so /rent SPA route is not a static directory.
 *
 * Navigations always prefer the live SPA shell. The offline page is last resort only.
 */
const CACHE = 'poreiago-rental-v8';
const OFFLINE_URL = '/rental-pwa/offline.html';
const APP_SHELL = '/index.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  APP_SHELL,
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

async function putShell(res) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(APP_SHELL, res.clone());
  } catch {
    /* ignore quota / abort */
  }
}

/** Network → cached SPA shell → network shell → offline HTML. */
async function handleRentNavigate(request) {
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res && res.ok) {
      // Successful SPA navigations are the app shell (index.html via nginx).
      await putShell(res);
      return res;
    }
  } catch {
    /* network error — fall through */
  }

  const cachedShell = await caches.match(APP_SHELL);
  if (cachedShell) return cachedShell;

  try {
    const shell = await fetch(APP_SHELL, { cache: 'no-store' });
    if (shell && shell.ok) {
      await putShell(shell);
      return shell;
    }
  } catch {
    /* ignore */
  }

  return offlineHtmlResponse();
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Prefer shell; don't fail the whole install if one asset 404s mid-deploy.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => undefined),
        ),
      ),
    ),
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
  if (event.data?.type === 'CLEAR_RENTAL_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith('poreiago-rental-')).map((key) => caches.delete(key)),
        ),
      ),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.pathname.startsWith('/rent')) {
    event.respondWith(handleRentNavigate(request));
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, clone));
            }
            return res;
          }),
      ),
    );
  }
});
