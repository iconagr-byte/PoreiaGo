import { SocialLogin } from '@capgo/capacitor-social-login';
import { isNativeApp } from './isNativeApp.js';
import {
  isUsableGoogleClientId,
  PRODUCTION_GOOGLE_CLIENT_ID,
} from '../googleClientId.js';

let initPromise = null;

function resolveWebClientId(preferred) {
  const buildId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  for (const raw of [preferred, buildId, PRODUCTION_GOOGLE_CLIENT_ID]) {
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

  if (!initPromise) {
    initPromise = SocialLogin.initialize({
      google: {
        webClientId: clientId,
        mode: 'online',
      },
    })
      .then(() => ({ ok: true, clientId }))
      .catch((err) => {
        initPromise = null;
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
  const res = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile', 'openid'],
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
