/**
 * Verify rotating ticketing JWT (HS256, 30s window) — mirrors backend/ticketing/qr_rotating.py.
 */

const ISSUER = 'aerostride-ticketing';
const WINDOW_SECONDS = 30;

function getJwtSecret() {
  return (
    import.meta.env.VITE_TICKET_JWT_SECRET ||
    'change-me-in-production-min-32-characters-long'
  );
}

function base64UrlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function currentStep(ts = Date.now() / 1000) {
  return Math.floor(ts / WINDOW_SECONDS);
}

/**
 * @returns {{ ok: true, payload: { ref: string, tid: number, step: number } } | { ok: false, reason: string }}
 */
export async function verifyRotatingJwt(token) {
  const trimmed = String(token || '').trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'INVALID_FORMAT' };
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (header.alg !== 'HS256') return { ok: false, reason: 'INVALID_SIGNATURE' };
  } catch {
    return { ok: false, reason: 'PARSE_ERROR' };
  }

  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getJwtSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(sigB64),
    new TextEncoder().encode(data),
  );
  if (!valid) return { ok: false, reason: 'INVALID_SIGNATURE' };

  if (payload.iss && payload.iss !== ISSUER) {
    return { ok: false, reason: 'INVALID_SIGNATURE' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    return { ok: false, reason: 'EXPIRED' };
  }

  const step = Number(payload.step);
  const nowStep = currentStep();
  if (step < nowStep - 1 || step > nowStep + 1) {
    return { ok: false, reason: 'WINDOW_MISMATCH' };
  }

  if (!payload.ref || payload.tid == null) {
    return { ok: false, reason: 'PARSE_ERROR' };
  }

  return {
    ok: true,
    payload: {
      ref: String(payload.ref),
      tid: Number(payload.tid),
      step,
    },
  };
}
