import { verifySignedQrToken, scanFailureMessage } from './qrToken.js';
import { verifyRotatingJwt } from './rotatingJwt.js';
import {
  getBookingById,
  isBookingPaid,
  isBookingCancelled,
  markCheckedIn,
  loadBookings,
} from './bookingStore.js';
import { CHECK_IN, SCAN_RESULT, TICKET_TOKEN_PREFIX } from './constants.js';

const LAST_SCAN_STEP_KEY = 'aerostride_last_scan_steps';

function getLastScanSteps() {
  try {
    return JSON.parse(localStorage.getItem(LAST_SCAN_STEP_KEY) || '{}');
  } catch {
    return {};
  }
}

function setLastScanStep(bookingId, step) {
  const map = getLastScanSteps();
  map[bookingId] = step;
  localStorage.setItem(LAST_SCAN_STEP_KEY, JSON.stringify(map));
}

function findBookingByTicketRef(ref) {
  const norm = String(ref || '').trim();
  return (
    loadBookings().find(
      (b) =>
        b.ticketRef === norm ||
        b.pnr === norm ||
        b.id === norm ||
        b.id === `B-${norm}` ||
        String(b.id || '').replace(/^B-/, '') === norm.replace(/^BK-/, ''),
    ) ?? null
  );
}

/** Client-side scan when FastAPI is offline (rotating JWT or bt1 tokens). */
export async function processScanLocal(qr, tripId) {
  const trimmed = String(qr || '').trim();
  if (!trimmed.startsWith(`${TICKET_TOKEN_PREFIX}.`)) {
    const rot = await verifyRotatingJwt(trimmed);
    if (rot.ok) {
      if (Number(rot.payload.tid) !== Number(tripId)) {
        return fail('TRIP_MISMATCH');
      }
      const booking = findBookingByTicketRef(rot.payload.ref);
      if (!booking) {
        return fail('NOT_FOUND');
      }
      const steps = getLastScanSteps();
      if (steps[booking.id] === rot.payload.step) {
        return fail('REPLAY_DETECTED', scanFailureMessage('ALREADY_SCANNED'));
      }
      if (!isBookingPaid(booking)) {
        return fail('NOT_PAID', undefined, booking);
      }
      if (isBookingCancelled(booking)) {
        return fail('CANCELLED', undefined, booking);
      }
      if (
        booking.checkInStatus === CHECK_IN.BOARDED ||
        booking.checkInStatus === CHECK_IN.CHECKED_IN ||
        booking.checkedIn
      ) {
        return fail('ALREADY_SCANNED', scanFailureMessage('ALREADY_CHECKED_IN'), booking);
      }
      markCheckedIn(booking.id, CHECK_IN.BOARDED);
      setLastScanStep(booking.id, rot.payload.step);
      const updated = getBookingById(booking.id);
      return success(updated, 'Επιτυχής επιβίβαση (offline JWT)');
    }
    if (rot.reason !== 'INVALID_FORMAT') {
      return fail(rot.reason);
    }
  }

  const verified = await verifySignedQrToken(trimmed);
  if (!verified.ok) {
    return {
      result: SCAN_RESULT.FAILURE,
      reason: verified.reason,
      message: scanFailureMessage(verified.reason),
    };
  }

  let booking = getBookingById(verified.payload.bid);
  if (!booking && verified.payload.bid) {
    booking = loadBookings().find(
      (b) => b.saasBookingId === verified.payload.bid || b.id === verified.payload.bid,
    );
  }
  if (!booking) {
    return fail('NOT_FOUND');
  }

  const bookingTripId = booking.tripId ?? 0;
  if (tripId && bookingTripId && Number(bookingTripId) !== Number(tripId)) {
    return fail('TRIP_MISMATCH', 'Το εισιτήριο δεν ανήκει σε αυτή την εκδρομή.', booking);
  }

  if (!isBookingPaid(booking)) {
    return fail('NOT_PAID', undefined, booking);
  }
  if (isBookingCancelled(booking)) {
    return fail('CANCELLED', undefined, booking);
  }

  if (
    booking.checkInStatus === CHECK_IN.BOARDED ||
    booking.checkInStatus === CHECK_IN.CHECKED_IN ||
    booking.checkedIn
  ) {
    return fail('ALREADY_SCANNED', scanFailureMessage('ALREADY_CHECKED_IN'), booking);
  }

  markCheckedIn(booking.id, CHECK_IN.BOARDED);
  const updated = getBookingById(booking.id);
  return success(updated, 'Επιτυχής επιβίβαση (τοπικά)');
}

function success(booking, message) {
  return {
    result: SCAN_RESULT.SUCCESS,
    booking_id: booking.id,
    bookingId: booking.id,
    passenger_name: booking.customerName,
    passengerName: booking.customerName,
    seat_number: booking.seat,
    seat: booking.seat,
    special_requirements: formatRequirements(booking),
    message,
    offline: true,
  };
}

function formatRequirements(booking) {
  const notes = booking.notes || booking.dietary || '';
  return {
    needs_assistance: false,
    allergies: booking.dietary?.toLowerCase?.().includes('vegan') ? ['dietary'] : [],
    notes,
  };
}

function fail(reason, message, booking) {
  const out = {
    result: SCAN_RESULT.FAILURE,
    reason,
    message: message || scanFailureMessage(reason),
  };
  if (booking) {
    out.passenger_name = booking.customerName;
    out.passengerName = booking.customerName;
    out.seat_number = booking.seat;
    out.seat = booking.seat;
    out.booking_id = booking.id;
  }
  return out;
}

export function syncBookingsFromMockIfEmpty() {
  const all = loadBookings();
  if (all.length > 0) return all;
  return loadBookings();
}
