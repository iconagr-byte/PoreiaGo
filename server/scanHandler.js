import { verifySignedQrToken } from './ticketSigning.js';
import { getBookingById, isBookingPaid, markCheckedIn } from './bookingDb.js';

const FAILURE_MESSAGES = {
  EMPTY_TOKEN: 'Κενό QR code.',
  INVALID_FORMAT: 'Μη έγκυρη μορφή εισιτηρίου.',
  INVALID_SIGNATURE: 'Πλαστό ή τροποποιημένο QR.',
  EXPIRED: 'Το εισιτήριο έχει λήξει.',
  NOT_FOUND: 'Δεν βρέθηκε κράτηση.',
  NOT_PAID: 'Η κράτηση δεν έχει εξοφληθεί.',
  ALREADY_CHECKED_IN: 'Ο επιβάτης έχει ήδη επιβιβαστεί.',
  UNAUTHORIZED: 'Μη εξουσιοδοτημένη πρόσβαση.',
};

export function handleAdminScan(reqBody, authHeader) {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return json(401, fail('UNAUTHORIZED'));
  }

  const qr = reqBody?.qr?.trim();
  if (!qr) {
    return json(400, fail('EMPTY_TOKEN'));
  }

  const verified = verifySignedQrToken(qr);
  if (!verified.ok) {
    return json(400, fail(verified.reason));
  }

  const booking = getBookingById(verified.payload.bid);
  if (!booking) {
    return json(404, fail('NOT_FOUND'));
  }

  if (!isBookingPaid(booking)) {
    return json(402, fail('NOT_PAID'));
  }

  if (booking.checkInStatus === 'CHECKED_IN' || booking.checkedIn) {
    return json(409, {
      result: 'FAILURE',
      reason: 'ALREADY_CHECKED_IN',
      message: FAILURE_MESSAGES.ALREADY_CHECKED_IN,
      passengerName: booking.customerName,
      seat: booking.seat,
      bookingId: booking.id,
    });
  }

  const updated = markCheckedIn(booking.id);

  return json(200, {
    result: 'SUCCESS',
    passengerName: updated.customerName,
    seat: updated.seat,
    bookingId: updated.id,
    pnr: updated.pnr,
    message: 'Επιτυχής επιβίβαση',
  });
}

function fail(reason) {
  return {
    result: 'FAILURE',
    reason,
    message: FAILURE_MESSAGES[reason] || 'Άκυρο εισιτήριο.',
  };
}

function json(status, body) {
  return { status, body };
}
