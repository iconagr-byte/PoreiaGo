/**
 * Capacitor Push Notifications (FCM on Android) — shared by driver + wallet apps.
 */
import { Capacitor } from '@capacitor/core';
import { isNativeApp } from './isNativeApp.js';

const TOKEN_KEY = 'poreiago_fcm_token_v1';
let listenersBound = false;
let registerPromise = null;
/** @type {null | ((token: string) => void)} */
let pendingTokenResolve = null;
/** @type {null | ((err: Error) => void)} */
let pendingTokenReject = null;
let pendingTimer = null;

function canUseNativePush() {
  return isNativeApp() && Capacitor.isPluginAvailable('PushNotifications');
}

export function isNativePushAvailable() {
  return canUseNativePush();
}

export function readStoredFcmToken() {
  try {
    return String(localStorage.getItem(TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
}

function storeFcmToken(token) {
  const value = String(token || '').trim();
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  return value;
}

async function loadPushPlugin() {
  const mod = await import('@capacitor/push-notifications');
  return mod.PushNotifications;
}

async function ensureListeners(PushNotifications) {
  if (listenersBound) return;
  listenersBound = true;

  await PushNotifications.addListener('registration', (event) => {
    const value = storeFcmToken(event?.value);
    if (value && pendingTokenResolve) {
      const resolve = pendingTokenResolve;
      pendingTokenResolve = null;
      pendingTokenReject = null;
      if (pendingTimer) {
        window.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      resolve(value);
    }
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.warn('[native-push] registrationError', err);
    if (pendingTokenReject) {
      const reject = pendingTokenReject;
      pendingTokenResolve = null;
      pendingTokenReject = null;
      if (pendingTimer) {
        window.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      reject(new Error(err?.error || 'Αποτυχία εγγραφής FCM'));
    }
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    const data = event?.notification?.data || {};
    const url = String(data.url || data.path || '').trim();
    if (!url || typeof window === 'undefined') return;
    try {
      const target = url.startsWith('http')
        ? `${new URL(url).pathname}${new URL(url).search}`
        : url;
      if (target.startsWith('/')) window.location.assign(target);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Request permission + register for FCM. Resolves with the device token.
 * @returns {Promise<string>}
 */
export async function registerNativePush() {
  if (!canUseNativePush()) {
    throw new Error('Οι native ειδοποιήσεις δεν υποστηρίζονται σε αυτή τη συσκευή');
  }
  if (registerPromise) return registerPromise;

  registerPromise = (async () => {
    const PushNotifications = await loadPushPlugin();
    const perm = await PushNotifications.requestPermissions();
    const receive = String(perm?.receive || '').toLowerCase();
    if (receive !== 'granted') {
      throw new Error('Δεν δόθηκε άδεια ειδοποιήσεων');
    }

    await ensureListeners(PushNotifications);

    const existing = readStoredFcmToken();
    const tokenPromise = new Promise((resolve, reject) => {
      pendingTokenResolve = resolve;
      pendingTokenReject = reject;
      pendingTimer = window.setTimeout(() => {
        pendingTokenResolve = null;
        pendingTokenReject = null;
        pendingTimer = null;
        const cached = readStoredFcmToken() || existing;
        if (cached) resolve(cached);
        else reject(new Error('Δεν ελήφθη FCM token — ελέγξτε google-services.json'));
      }, 8000);
    });

    await PushNotifications.register();
    return tokenPromise;
  })();

  try {
    return await registerPromise;
  } finally {
    registerPromise = null;
  }
}

export async function unregisterNativePush() {
  const token = readStoredFcmToken();
  storeFcmToken('');
  return token;
}
