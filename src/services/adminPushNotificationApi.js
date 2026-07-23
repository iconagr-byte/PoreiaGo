import { API_BASE } from '../config/api.js';
import { saasAuthHeaders } from './saasApi.js';

function getAdminEmail() {
  return localStorage.getItem('saas_user_email') || '';
}

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

export function isAdminPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function fetchAdminPushConfig() {
  const res = await fetch(`${API_BASE}/api/admin/push/config`, { headers: saasAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Push config unavailable');
  return data;
}

export async function fetchAdminPushStatus() {
  const res = await fetch(`${API_BASE}/api/admin/push/status`, { headers: saasAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Push status unavailable');
  return data;
}

/** True only if THIS browser has an active PushManager subscription. */
export async function isThisBrowserAdminPushSubscribed() {
  if (!isAdminPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription?.endpoint);
  } catch {
    return false;
  }
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function subscribeAdminFleetPush() {
  if (!isAdminPushSupported()) {
    throw new Error('Το browser δεν υποστηρίζει push ειδοποιήσεις');
  }
  const email = getAdminEmail();
  if (!email) {
    throw new Error('Δεν βρέθηκε email admin — κάντε login ξανά');
  }

  const config = await fetchAdminPushConfig();
  if (!config.enabled || !config.public_key) {
    throw new Error('Ο server δεν έχει ρυθμίσει Web Push (VAPID keys)');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Δεν δόθηκε άδεια ειδοποιήσεων');
  }

  const registration = await registerServiceWorker();
  const serverKey = urlBase64ToUint8Array(config.public_key);
  let subscription = await registration.pushManager.getSubscription();

  // VAPID key rotation / stale browser sub → must resubscribe or push silently fails.
  if (subscription) {
    const existingKey = subscription.options?.applicationServerKey;
    const keyMismatch =
      existingKey &&
      (() => {
        const existing = new Uint8Array(existingKey);
        if (existing.length !== serverKey.length) return true;
        for (let i = 0; i < existing.length; i += 1) {
          if (existing[i] !== serverKey[i]) return true;
        }
        return false;
      })();
    if (keyMismatch) {
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

  const json = subscription.toJSON();
  const res = await fetch(`${API_BASE}/api/admin/push/subscribe`, {
    method: 'POST',
    headers: saasAuthHeaders(),
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      email,
      expirationTime: json.expirationTime ?? null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Αποτυχία εγγραφής push');
  return data;
}

/** Immediate test push to this admin's registered devices. */
export async function sendAdminPushTest() {
  const res = await fetch(`${API_BASE}/api/admin/push/test`, {
    method: 'POST',
    headers: saasAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Αποτυχία δοκιμής push');
  return data;
}

export async function unsubscribeAdminFleetPush() {
  const email = getAdminEmail();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: true };

  const res = await fetch(`${API_BASE}/api/admin/push/subscribe`, {
    method: 'DELETE',
    headers: saasAuthHeaders(),
    body: JSON.stringify({ endpoint: subscription.endpoint, email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Αποτυχία απεγγραφής');
  }
  await subscription.unsubscribe();
  return { ok: true };
}
