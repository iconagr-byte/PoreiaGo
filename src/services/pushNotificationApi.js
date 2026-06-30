import { API_BASE } from '../config/api.js';
import { customerAuthHeaders } from './customerAuthApi.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

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
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
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
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.public_key),
    });
  }

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

  const registration = await navigator.serviceWorker.getRegistration('/');
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
