import { TICKET_TOKEN_PREFIX, TICKET_VERSION } from './constants.js';
import { hmacSign, hmacVerify, toBase64Url, fromBase64Url } from './crypto.js';

const textEncoder = new TextEncoder();

/**
 * Compact signed ticket payload embedded in QR.
 * @typedef {{ v: number, bid: string, tripId: number, seat: string, exp: number, nonce: string }} TicketPayload
 */

function getSigningSecret() {
  const secret =
    import.meta.env.VITE_TICKET_SIGNING_SECRET ||
    'dev-only-aerostride-ticket-secret-change-in-production';
  return secret;
}

export function buildCanonicalMessage(payload) {
  return [payload.v, payload.bid, payload.tripId, payload.seat, payload.exp, payload.nonce].join('|');
}

/**
 * @param {import('./bookingStore.js').BookingRecord} booking
 * @param {{ ttlHours?: number }} [opts]
 */
export async function issueSignedQrToken(booking, opts = {}) {
  const ttlHours = opts.ttlHours ?? 72;
  const departure = booking.date ? new Date(`${booking.date}T23:59:59`) : new Date();
  const exp = Math.floor(
    (departure.getTime() + ttlHours * 60 * 60 * 1000) / 1000,
  );

  /** @type {TicketPayload} */
  const payload = {
    v: TICKET_VERSION,
    bid: booking.id,
    tripId: booking.tripId ?? 0,
    seat: booking.seat || (booking.seats?.[0] ?? ''),
    exp,
    nonce: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
  };

  const message = buildCanonicalMessage(payload);
  const signature = await hmacSign(message, getSigningSecret());
  const payloadB64 = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const sigB64 = toBase64Url(signature);

  return `${TICKET_TOKEN_PREFIX}.${payloadB64}.${sigB64}`;
}

/**
 * @returns {{ ok: true, payload: TicketPayload } | { ok: false, reason: string }}
 */
export async function verifySignedQrToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') {
    return { ok: false, reason: 'EMPTY_TOKEN' };
  }

  const trimmed = tokenString.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts[0] !== TICKET_TOKEN_PREFIX) {
    return { ok: false, reason: 'INVALID_FORMAT' };
  }

  try {
    const payloadJson = new TextDecoder().decode(fromBase64Url(parts[1]));
    /** @type {TicketPayload} */
    const payload = JSON.parse(payloadJson);
    const signature = fromBase64Url(parts[2]);
    const message = buildCanonicalMessage(payload);

    const valid = await hmacVerify(message, signature, getSigningSecret());
    if (!valid) return { ok: false, reason: 'INVALID_SIGNATURE' };

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return { ok: false, reason: 'EXPIRED' };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'PARSE_ERROR' };
  }
}

/** Human-readable failure messages for drivers */
export function scanFailureMessage(reason) {
  const map = {
    EMPTY_TOKEN: 'Κενό QR code.',
    INVALID_FORMAT: 'Μη έγκυρη μορφή εισιτηρίου.',
    INVALID_SIGNATURE: 'Πλαστό ή τροποποιημένο QR (αποτυχία υπογραφής).',
    EXPIRED: 'Το εισιτήριο έχει λήξει.',
    PARSE_ERROR: 'Δεν ήταν δυνατή η ανάγνωση του QR.',
    NOT_FOUND: 'Δεν βρέθηκε κράτηση.',
    NOT_PAID: 'Η κράτηση δεν έχει εξοφληθεί.',
    CANCELLED: 'Η κράτηση έχει ακυρωθεί.',
    ALREADY_CHECKED_IN: 'Ο επιβάτης έχει ήδη επιβιβαστεί.',
    ALREADY_SCANNED: 'Ο επιβάτης έχει ήδη επιβιβαστεί.',
    TRIP_MISMATCH: 'Λάθος εκδρομή για αυτό το εισιτήριο.',
    UNAUTHORIZED: 'Μη εξουσιοδοτημένη πρόσβαση.',
    OFFLINE_NOT_IN_MANIFEST: 'Το εισιτήριο δεν είναι στο offline manifest.',
    OFFLINE_ALREADY_USED: 'Το εισιτήριο χρησιμοποιήθηκε ήδη (offline).',
  };
  return map[reason] || 'Άκυρο εισιτήριο.';
}
