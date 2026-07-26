/** Shared Web Push helpers — VAPID rematch + correct service-worker registration. */

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function applicationServerKeysMatch(existingKey, serverKey) {
  if (!existingKey || !serverKey) return true;
  const existing = existingKey instanceof Uint8Array ? existingKey : new Uint8Array(existingKey);
  if (existing.length !== serverKey.length) return false;
  for (let i = 0; i < existing.length; i += 1) {
    if (existing[i] !== serverKey[i]) return false;
  }
  return true;
}

/** Find a registration by its script path (e.g. '/sw.js'), ignoring wrong controllers. */
export async function getRegistrationByScript(scriptPath) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const absolute = new URL(scriptPath, window.location.origin).href;
  const regs = await navigator.serviceWorker.getRegistrations();
  return (
    regs.find((reg) => {
      const workers = [reg.active, reg.waiting, reg.installing].filter(Boolean);
      return workers.some((w) => w.scriptURL === absolute || w.scriptURL.endsWith(scriptPath));
    }) || null
  );
}

async function waitForWorkerActive(registration) {
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) return registration;
  if (worker.state === 'activated') return registration;
  await new Promise((resolve) => {
    const onChange = () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        worker.removeEventListener('statechange', onChange);
        resolve();
      }
    };
    worker.addEventListener('statechange', onChange);
    // Already moved while attaching listener.
    if (worker.state === 'activated' || worker.state === 'redundant') {
      worker.removeEventListener('statechange', onChange);
      resolve();
    }
  });
  return registration;
}

/**
 * Register a service worker and return THAT registration (never a sibling SW).
 * Optionally unregister legacy registrations of the same script with other scopes.
 */
export async function ensureServiceWorkerRegistration(scriptPath, { scope, updateViaCache = 'none' } = {}) {
  const options = { updateViaCache };
  if (scope) options.scope = scope;

  const registration = await navigator.serviceWorker.register(scriptPath, options);
  await waitForWorkerActive(registration);

  if (scope) {
    const absolute = new URL(scriptPath, window.location.origin).href;
    const wantedScope = new URL(scope, window.location.origin).href;
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((reg) => {
          if (reg === registration) return false;
          const workers = [reg.active, reg.waiting, reg.installing].filter(Boolean);
          const sameScript = workers.some(
            (w) => w.scriptURL === absolute || w.scriptURL.endsWith(scriptPath),
          );
          if (!sameScript) return false;
          // Drop root-scoped driver SW that previously stole /admin pages.
          return reg.scope !== wantedScope;
        })
        .map((reg) => reg.unregister().catch(() => false)),
    );
  }

  return registration;
}

/** Get or create a Push subscription, rematching when VAPID keys rotated. */
export async function ensurePushSubscription(registration, publicKeyBase64) {
  const serverKey = urlBase64ToUint8Array(publicKeyBase64);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const existingKey = subscription.options?.applicationServerKey;
    if (!applicationServerKeysMatch(existingKey, serverKey)) {
      try {
        await subscription.unsubscribe();
      } catch {
        /* ignore */
      }
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: serverKey,
    });
  }
  return subscription;
}

export async function getPushSubscriptionForScript(scriptPath) {
  const registration = await getRegistrationByScript(scriptPath);
  if (!registration) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}
