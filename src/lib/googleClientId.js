/**
 * Detect docs / example Google OAuth Web Client IDs that must not enable GIS.
 * Live prod had `123456789-xxxx.apps.googleusercontent.com` from GOOGLE-SIGNIN.md.
 */

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
