import { API_BASE } from '../config/api.js';
import {
  ensurePushSubscription,
  ensureServiceWorkerRegistration,
  getRegistrationByScript,
} from '../lib/push/webPushHelpers.js';
import { customerAuthHeaders } from './customerAuthApi.js';

const CUSTOMER_SW = '/sw.js';

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
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

export async function subscribePushNotifications() {
  if (!isPushSupported()) {
    throw new Error('Το browser δεν υποστηρίζει push ειδοποιήσεις');
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
    headers: customerAuthHeaders(),
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      expirationTime: json.expirationTime ?? null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία εγγραφής push');
  }
  return data;
}

export async function unsubscribePushNotifications() {
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
