/**
 * Register My Wallet service worker + manifest (scope /wallet).
 */

const MANIFEST_HREF = '/wallet/manifest.webmanifest';
const SW_HREF = '/wallet/sw.js';
const THEME = '#0f4c81';
const APPLE_ICON = '/icons/wallet-pwa-192.png';

function upsertLink(rel, href, attrs = {}) {
  let el = document.querySelector(`link[rel="${rel}"][data-wallet-pwa="1"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    el.dataset.walletPwa = '1';
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
  let el = document.querySelector(`meta[name="${name}"][data-wallet-pwa="1"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    el.dataset.walletPwa = '1';
    document.head.appendChild(el);
  }
  el.content = content;
  return el;
}

export function injectWalletPwaHead() {
  if (typeof document === 'undefined') return;
  upsertLink('manifest', MANIFEST_HREF);
  upsertLink('apple-touch-icon', APPLE_ICON);
  upsertMeta('theme-color', THEME);
  upsertMeta('apple-mobile-web-app-capable', 'yes');
  upsertMeta('apple-mobile-web-app-status-bar-style', 'default');
  upsertMeta('apple-mobile-web-app-title', 'My Wallet');
}

export function registerWalletServiceWorker() {
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

  navigator.serviceWorker
    .register(SW_HREF, { updateViaCache: 'none', scope: '/wallet' })
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
    })
    .catch(() => {});

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}

export function setupWalletPwa() {
  injectWalletPwaHead();
  return registerWalletServiceWorker();
}
