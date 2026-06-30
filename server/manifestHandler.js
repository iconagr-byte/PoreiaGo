import crypto from 'node:crypto';
import { loadBookings, isBookingPaid } from './bookingDb.js';
import { buildCanonicalMessage, TICKET_TOKEN_PREFIX } from './ticketSigning.js';

const DEV_SECRET =
  process.env.TICKET_SIGNING_SECRET ||
  'dev-only-aerostride-ticket-secret-change-in-production';

function issueToken(booking) {
  const departure = booking.date ? new Date(`${booking.date}T23:59:59`) : new Date();
  const exp = Math.floor((departure.getTime() + 72 * 3600 * 1000) / 1000);
  const payload = {
    v: 1,
    bid: booking.id,
    tripId: booking.tripId ?? 0,
    seat: booking.seat || booking.seats?.[0] || '',
    exp,
    nonce: crypto.randomBytes(6).toString('hex'),
  };
  const message = buildCanonicalMessage(payload);
  const sig = crypto.createHmac('sha256', DEV_SECRET).update(message).digest();
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sigB64 = sig.toString('base64url');
  return `${TICKET_TOKEN_PREFIX}.${payloadB64}.${sigB64}`;
}

export async function buildManifestHandler(tripId, date) {
  const bookings = loadBookings().filter(
    (b) =>
      isBookingPaid(b) &&
      b.tripId === tripId &&
      b.date === date &&
      b.checkInStatus !== 'CHECKED_IN' &&
      !b.checkedIn,
  );

  return bookings.map((b) => ({
    bookingId: b.id,
    token: issueToken(b),
    passengerName: b.customerName,
    seat: b.seat || b.seats?.join(', '),
    tripId: b.tripId,
    date: b.date,
  }));
}
