/**
 * Register Rental customer PWA service worker + manifest (scope /rent).
 */

const MANIFEST_HREF = '/rental-pwa/manifest.webmanifest';
const SW_HREF = '/rental-pwa/sw.js';
const THEME = '#0b3d4a';
const APPLE_ICON = '/icons/rental-pwa-192.png';

/** Captured early so React install UI can still fire the prompt. */
let deferredInstallPrompt = null;
let bipListening = false;
let swRegistered = false;

function upsertLink(rel, href, attrs = {}) {
  let el = document.querySelector(`link[rel="${rel}"][data-rental-pwa="1"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    el.dataset.rentalPwa = '1';
    document.head.appendChild(el);
  }
  el.href = href;
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null) el.removeAttribute(k);
    else el.setAttribute(k, v);
  });
  return el;
}

function upsertMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"][data-rental-pwa="1"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    el.dataset.rentalPwa = '1';
    document.head.appendChild(el);
  }
  el.content = content;
  return el;
}

/** Avoid competing wallet/driver manifests while on /rent. */
function clearForeignManifests() {
  document
    .querySelectorAll('link[rel="manifest"]:not([data-rental-pwa="1"])')
    .forEach((el) => el.remove());
}

export function captureRentalInstallPrompt() {
  if (typeof window === 'undefined' || bipListening) return;
  bipListening = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('rental-pwa-install-available'));
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window.dispatchEvent(new CustomEvent('rental-pwa-installed'));
  });
}

export function getRentalDeferredInstallPrompt() {
  return deferredInstallPrompt;
}

export function clearRentalDeferredInstallPrompt() {
  deferredInstallPrompt = null;
}

export function injectRentalPwaHead() {
  if (typeof document === 'undefined') return;
  clearForeignManifests();
  upsertLink('manifest', MANIFEST_HREF);
  upsertLink('apple-touch-icon', APPLE_ICON);
  upsertMeta('theme-color', THEME);
  upsertMeta('apple-mobile-web-app-capable', 'yes');
  upsertMeta('mobile-web-app-capable', 'yes');
  upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  upsertMeta('apple-mobile-web-app-title', 'Ενοικίαση');
  captureRentalInstallPrompt();
}

export function registerRentalServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  let refreshing = false;
  const onControllerChange = () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  if (!swRegistered) {
    swRegistered = true;
    navigator.serviceWorker
      .register(SW_HREF, { updateViaCache: 'none', scope: '/rent' })
      .then((reg) => {
        reg.update().catch(() => {});
        const askWaiting = () => {
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        };
        askWaiting();
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') askWaiting();
          });
        });
        window.dispatchEvent(new CustomEvent('rental-pwa-sw-ready'));
      })
      .catch((err) => {
        swRegistered = false;
        console.warn('[rental-pwa] service worker registration failed', err);
      });
  }

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}

/** Head + SW — safe to call for guests and authenticated users on /rent. */
export function setupRentalPwa() {
  injectRentalPwaHead();
  return registerRentalServiceWorker();
}
