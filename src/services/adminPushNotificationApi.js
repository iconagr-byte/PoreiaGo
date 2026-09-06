import { API_BASE } from '../config/api.js';
import {
  ensurePushSubscription,
  ensureServiceWorkerRegistration,
  getPushSubscriptionForScript,
  getRegistrationByScript,
} from '../lib/push/webPushHelpers.js';
import { saasAuthHeaders } from './saasApi.js';

const ADMIN_SW = '/sw.js';

function getAdminEmail() {
  return localStorage.getItem('saas_user_email') || '';
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

/** True only if THIS browser has an active PushManager subscription on /sw.js. */
export async function isThisBrowserAdminPushSubscribed() {
  if (!isAdminPushSupported()) return false;
  try {
    const subscription = await getPushSubscriptionForScript(ADMIN_SW);
    return Boolean(subscription?.endpoint);
  } catch {
    return false;
  }
}

async function registerAdminServiceWorker() {
  return ensureServiceWorkerRegistration(ADMIN_SW, { scope: '/' });
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

  const registration = await registerAdminServiceWorker();
  const subscription = await ensurePushSubscription(registration, config.public_key);

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
  const registration =
    (await getRegistrationByScript(ADMIN_SW)) ||
    (await navigator.serviceWorker.getRegistration('/'));
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
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
