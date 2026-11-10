import { API_BASE } from '../config/api.js';
import {
  ensurePushSubscription,
  ensureServiceWorkerRegistration,
  getRegistrationByScript,
} from '../lib/push/webPushHelpers.js';
import { customerAuthHeaders } from './customerAuthApi.js';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';
import {
  isNativePushAvailable,
  readStoredFcmToken,
  registerNativePush,
  unregisterNativePush,
} from '../lib/capacitor/nativePush.js';

const CUSTOMER_SW = '/sw.js';

export function isPushSupported() {
  if (typeof window === 'undefined') return false;
  if (isNativeApp()) return isNativePushAvailable();
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function fetchPushConfig() {
  const res = await fetch(`${API_BASE}/api/push/config`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Push config unavailable');
  }
  return data;
}

export async function fetchPushStatus() {
  const res = await fetch(`${API_BASE}/api/push/status`, { headers: customerAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Push status unavailable');
  }
  return data;
}

async function registerServiceWorker() {
  return ensureServiceWorkerRegistration(CUSTOMER_SW, { scope: '/' });
}

async function subscribeNativePush() {
  const token = await registerNativePush();
  const res = await fetch(`${API_BASE}/api/push/subscribe`, {
    method: 'POST',
    headers: { ...customerAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: 'fcm',
      token,
      endpoint: `fcm:${token}`,
      platform: 'android',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία εγγραφής FCM');
  }
  return data;
}

export async function subscribePushNotifications() {
  if (!isPushSupported()) {
    throw new Error('Το browser δεν υποστηρίζει push ειδοποιήσεις');
  }

  if (isNativeApp()) {
    return subscribeNativePush();
  }

  const config = await fetchPushConfig();
  if (!config.enabled || !config.public_key) {
    throw new Error('Ο server δεν έχει ρυθμίσει Web Push (VAPID keys)');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Δεν δόθηκε άδεια ειδοποιήσεων');
  }

  const registration = await registerServiceWorker();
  const subscription = await ensurePushSubscription(registration, config.public_key);

  const json = subscription.toJSON();
  const res = await fetch(`${API_BASE}/api/push/subscribe`, {
    method: 'POST',
    headers: { ...customerAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      expirationTime: json.expirationTime ?? null,
      channel: 'web',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία εγγραφής push');
  }
  return data;
}

export async function unsubscribePushNotifications() {
  if (isNativeApp()) {
    const token = (await unregisterNativePush()) || readStoredFcmToken();
    const endpoint = token ? `fcm:${token}` : '';
    if (!endpoint) return { ok: true };
    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'DELETE',
      headers: customerAuthHeaders(),
      body: JSON.stringify({ endpoint }),
    }).catch(() => null);
    return { ok: true };
  }

  if (!isPushSupported()) {
    return { ok: true };
  }

  const registration =
    (await getRegistrationByScript(CUSTOMER_SW)) ||
    (await navigator.serviceWorker.getRegistration('/'));
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) {
    return { ok: true };
  }

  const endpoint = subscription.endpoint;
  await fetch(`${API_BASE}/api/push/subscribe`, {
    method: 'DELETE',
    headers: customerAuthHeaders(),
    body: JSON.stringify({ endpoint }),
  }).catch(() => null);

  await subscription.unsubscribe();
  return { ok: true };
}
