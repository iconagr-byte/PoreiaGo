/**
 * Apply office «Push» / Master QR invite into the driver session.
 * Accepts magic-link URL, relative /driver/auth?token=…, or raw token.
 */
import { exchangeMasterQr } from '../../services/driverPortalApi.js';
import { clearDriverShiftLaunchState } from './useDriverShiftSession.js';

export function extractMasterQrToken(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') {
    return extractMasterQrToken({ auth_url: payload });
  }
  const raw = String(payload.auth_url || payload.url || payload.token || '').trim();
  if (!raw) return '';
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) {
      const href = raw.startsWith('/')
        ? new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://local')
        : new URL(raw);
      const token = href.searchParams.get('token') || href.searchParams.get('t');
      if (token) return token.trim();
    }
  } catch {
    /* fall through — treat as raw token */
  }
  return raw;
}

/**
 * Exchange invite → bind trip on session. Does not auto-start GPS/shift.
 * @returns {Promise<object>} mapped driver session
 */
export async function applyDriverShiftInvite(payload) {
  const token = extractMasterQrToken(payload);
  if (!token) {
    throw new Error('Λείπει το token πρόσκλησης βάρδιας');
  }
  const session = await exchangeMasterQr(token);
  clearDriverShiftLaunchState();
  return session;
}
