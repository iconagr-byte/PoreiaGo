import { API_BASE } from '../config/api.js';
import {
  ensurePushSubscription,
  ensureServiceWorkerRegistration,
  getPushSubscriptionForScript,
  getRegistrationByScript,
} from '../lib/push/webPushHelpers.js';
import { driverSessionHeaders } from '../lib/driver/driverSession.js';

const DRIVER_SW = '/driver-sw.js';
/** Narrow scope so driver SW never controls /admin or storefront pages. */
export const DRIVER_SW_SCOPE = '/driver/';

export function isDriverPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function fetchDriverPushConfig() {
  const res = await fetch(`${API_BASE}/api/driver/push/config`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Push config unavailable');
  return data;
}

export async function fetchDriverPushStatus() {
  const res = await fetch(`${API_BASE}/api/driver/push/status`, {
    headers: driverSessionHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Push status unavailable');
  return data;
}

/** True only if THIS browser has a Push subscription on the driver SW. */
export async function isThisBrowserDriverPushSubscribed() {
  if (!isDriverPushSupported()) return false;
  try {
    const subscription = await getPushSubscriptionForScript(DRIVER_SW);
    return Boolean(subscription?.endpoint);
  } catch {
    return false;
  }
}

export async function registerDriverServiceWorker() {
  return ensureServiceWorkerRegistration(DRIVER_SW, {
    scope: DRIVER_SW_SCOPE,
    updateViaCache: 'none',
  });
}

export async function subscribeDriverPush() {
  if (!isDriverPushSupported()) {
    throw new Error('Το browser δεν υποστηρίζει push ειδοποιήσεις');
  }

  const config = await fetchDriverPushConfig();
  if (!config.enabled || !config.public_key) {
    throw new Error('Ο server δεν έχει ρυθμίσει Web Push (VAPID keys)');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Δεν δόθηκε άδεια ειδοποιήσεων');
  }

  const registration = await registerDriverServiceWorker();
  const subscription = await ensurePushSubscription(registration, config.public_key);

  const json = subscription.toJSON();
  const res = await fetch(`${API_BASE}/api/driver/push/subscribe`, {
    method: 'POST',
    headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      expirationTime: json.expirationTime ?? null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Αποτυχία εγγραφής push');
  return data;
}

export async function unsubscribeDriverPush() {
  const registration =
    (await getRegistrationByScript(DRIVER_SW)) ||
    (await navigator.serviceWorker.getRegistration(DRIVER_SW_SCOPE));
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return { ok: true };

  const res = await fetch(`${API_BASE}/api/driver/push/subscribe`, {
    method: 'DELETE',
    headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Αποτυχία απεγγραφής');
  }
  await subscription.unsubscribe();
  return { ok: true };
}
