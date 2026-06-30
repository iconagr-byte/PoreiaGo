import crypto from 'node:crypto';

const DEV_SECRET =
  process.env.TICKET_SIGNING_SECRET ||
  'dev-only-aerostride-ticket-secret-change-in-production';

export const TICKET_TOKEN_PREFIX = 'bt1';

export function buildCanonicalMessage(payload) {
  return [payload.v, payload.bid, payload.tripId, payload.seat, payload.exp, payload.nonce].join('|');
}

function toBase64Url(buf) {
  return buf.toString('base64url');
}

function fromBase64Url(str) {
  return Buffer.from(str, 'base64url');
}

export function verifySignedQrToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') {
    return { ok: false, reason: 'EMPTY_TOKEN' };
  }

  const parts = tokenString.trim().split('.');
  if (parts.length !== 3 || parts[0] !== TICKET_TOKEN_PREFIX) {
    return { ok: false, reason: 'INVALID_FORMAT' };
  }

  try {
    const payload = JSON.parse(fromBase64Url(parts[1]).toString('utf8'));
    const signature = fromBase64Url(parts[2]);
    const message = buildCanonicalMessage(payload);
    const expected = crypto.createHmac('sha256', DEV_SECRET).update(message).digest();

    if (!crypto.timingSafeEqual(expected, signature)) {
      return { ok: false, reason: 'INVALID_SIGNATURE' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return { ok: false, reason: 'EXPIRED' };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'PARSE_ERROR' };
  }
}
