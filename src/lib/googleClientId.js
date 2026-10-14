/**
 * Detect docs / example Google OAuth Web Client IDs that must not enable GIS.
 * Live prod had `123456789-xxxx.apps.googleusercontent.com` from GOOGLE-SIGNIN.md.
 */

/**
 * Public Web Client ID used on Achillio / PoreiaGo production.
 * Safe to embed (GIS client ids are public). Used as Capacitor fallback when
 * /api/auth/google/config cannot be reached from the packaged WebView.
 */
export const PRODUCTION_GOOGLE_CLIENT_ID =
  '838114974488-8q36brogbldig001k9n88qrnciqle1j1.apps.googleusercontent.com';

export function isUsableGoogleClientId(clientId) {
  const id = String(clientId || '').trim();
  if (!id) return false;
  const lower = id.toLowerCase();
  if (!lower.endsWith('.apps.googleusercontent.com')) return false;
  if (lower.includes('xxxx') || lower.includes('example') || lower.includes('your-client')) {
    return false;
  }
  // Docs placeholder prefix
  if (/^1234567890?-x+/i.test(id) || /^123456789-xxxx/i.test(id)) {
    return false;
  }
  return true;
}
