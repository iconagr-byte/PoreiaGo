import { API_BASE } from '../config/api.js';
import {
  ensurePushSubscription,
  ensureServiceWorkerRegistration,
  getPushSubscriptionForScript,
  getRegistrationByScript,
} from '../lib/push/webPushHelpers.js';
import { driverSessionHeaders } from '../lib/driver/driverSession.js';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';
import {
  isNativePushAvailable,
  readStoredFcmToken,
  registerNativePush,
  unregisterNativePush,
} from '../lib/capacitor/nativePush.js';

const DRIVER_SW = '/driver-sw.js';
/** Narrow scope so driver SW never controls /admin or storefront pages. */
export const DRIVER_SW_SCOPE = '/driver/';

export function isDriverPushSupported() {
  if (typeof window === 'undefined') return false;
  if (isNativeApp()) return isNativePushAvailable();
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
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

/** True only if THIS device has a push subscription (Web or FCM). */
export async function isThisBrowserDriverPushSubscribed() {
  if (!isDriverPushSupported()) return false;
  if (isNativeApp()) {
    return Boolean(readStoredFcmToken());
  }
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

async function subscribeDriverNativePush() {
  const token = await registerNativePush();
  const res = await fetch(`${API_BASE}/api/driver/push/subscribe`, {
    method: 'POST',
    headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: 'fcm',
      token,
      endpoint: `fcm:${token}`,
      platform: 'android',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Αποτυχία εγγραφής FCM');
  return data;
}

export async function subscribeDriverPush() {
  if (!isDriverPushSupported()) {
    throw new Error('Το browser δεν υποστηρίζει push ειδοποιήσεις');
  }

  if (isNativeApp()) {
    return subscribeDriverNativePush();
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
      channel: 'web',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Αποτυχία εγγραφής push');
  return data;
}

export async function unsubscribeDriverPush() {
  if (isNativeApp()) {
    const token = (await unregisterNativePush()) || readStoredFcmToken();
    const endpoint = token ? `fcm:${token}` : '';
    if (!endpoint) return { ok: true };
    const res = await fetch(`${API_BASE}/api/driver/push/subscribe`, {
      method: 'DELETE',
      headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    if (!res.ok && res.status !== 404) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Αποτυχία απεγγραφής');
    }
    return { ok: true };
  }

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

export async function showDriverLocalTestNotification() {
  if (isNativeApp()) {
    // Remote FCM test covers native; local SW notification is browser-only.
    return false;
  }
  const registration = await registerDriverServiceWorker();
  await registration.showNotification('Δοκιμή Push — Οδηγός', {
    body: 'Οι ειδοποιήσεις βάρδιας λειτουργούν σε αυτή τη συσκευή.',
    tag: `driver-local-test-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    icon: '/icons/driver-pwa-192.png',
    badge: '/icons/driver-pwa-192.png',
    data: { url: '/driver', type: 'driver_shift', event: 'test' },
  });
  return true;
}

export async function sendDriverPushTest() {
  let endpoint = '';
  if (isNativeApp()) {
    const token = readStoredFcmToken();
    endpoint = token ? `fcm:${token}` : '';
  } else {
    const localSub = await getPushSubscriptionForScript(DRIVER_SW);
    endpoint = localSub?.endpoint || '';
  }
  const res = await fetch(`${API_BASE}/api/driver/push/test`, {
    method: 'POST',
    headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(endpoint ? { endpoint } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Αποτυχία δοκιμής push');
  return data;
}
