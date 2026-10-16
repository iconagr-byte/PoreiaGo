import { SocialLogin } from '@capgo/capacitor-social-login';
import { isNativeApp } from './isNativeApp.js';
import {
  isUsableGoogleClientId,
  PRODUCTION_GOOGLE_CLIENT_ID,
} from '../googleClientId.js';

let initPromise = null;
let initClientId = '';

function resolveWebClientId(preferred) {
  const buildId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  // Native MUST use the Web client in the same GCP project as the Android OAuth
  // client. Production /api/auth/google/config can still return an older project
  // id (838114…) which causes Credential Manager [28444].
  const order = isNativeApp()
    ? [PRODUCTION_GOOGLE_CLIENT_ID, buildId, preferred]
    : [preferred, buildId, PRODUCTION_GOOGLE_CLIENT_ID];
  for (const raw of order) {
    const id = String(raw || '').trim();
    if (isUsableGoogleClientId(id)) return id;
  }
  return '';
}

/**
 * Native Android/iOS Google Sign-In via Credential Manager (not WebView GIS).
 * Requires an Android OAuth client (package + SHA-1) in the same Google Cloud project
 * as the Web client ID used here as webClientId.
 */
export async function ensureNativeGoogleAuth(webClientId) {
  if (!isNativeApp()) return { ok: false, reason: 'not_native' };
  const clientId = resolveWebClientId(webClientId);
  if (!clientId) return { ok: false, reason: 'no_client_id' };

  if (initPromise && initClientId && initClientId !== clientId) {
    initPromise = null;
    initClientId = '';
  }

  if (!initPromise) {
    initClientId = clientId;
    initPromise = SocialLogin.initialize({
      google: {
        webClientId: clientId,
        mode: 'online',
      },
    })
      .then(() => ({ ok: true, clientId }))
      .catch((err) => {
        initPromise = null;
        initClientId = '';
        throw err;
      });
  }
  return initPromise;
}

/**
 * @returns {Promise<string>} Google ID token (JWT) for /api/auth/google
 */
export async function nativeGoogleIdToken(webClientId) {
  await ensureNativeGoogleAuth(webClientId);
  // Do NOT pass scopes here on Android — Capgo rejects any scopes array unless
  // MainActivity implements ModifiedMainActivityForSocialLoginPlugin. Default
  // OIDC scopes (email/profile/openid) are already requested by the plugin and
  // are enough for our backend ID-token verify at /api/auth/google.
  // filterByAuthorizedAccounts:false avoids Family Link / empty-account failures.
  const res = await SocialLogin.login({
    provider: 'google',
    options: {
      style: 'standard',
      filterByAuthorizedAccounts: false,
      autoSelectEnabled: false,
    },
  });
  const result = res?.result || {};
  const idToken = String(result.idToken || result.id_token || '').trim();
  if (!idToken) {
    throw new Error('Δεν ελήφθη Google ID token από το native Sign-In');
  }
  return idToken;
}

export function isNativeGoogleAuthAvailable() {
  return isNativeApp();
}
