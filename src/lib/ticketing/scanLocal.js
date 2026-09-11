import { verifySignedQrToken, scanFailureMessage } from './qrToken.js';
import { verifyRotatingJwt } from './rotatingJwt.js';
import {
  getBookingById,
  isBookingPaid,
  isBookingCancelled,
  markCheckedIn,
  updateBooking,
  loadBookings,
} from './bookingStore.js';
import { CHECK_IN, SCAN_RESULT, TICKET_TOKEN_PREFIX } from './constants.js';
import { getBookingPassengers, seatListFromBooking } from './bookingPassengers.js';

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
  const key = String(bookingId);
  if (!map[key] || typeof map[key] !== 'object') {
    map[key] = { step, seats: [] };
  } else {
    map[key].step = step;
  }
  localStorage.setItem(LAST_SCAN_STEP_KEY, JSON.stringify(map));
}

function normalizeSeat(seat) {
  return String(seat || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function bookingSeatCodes(booking) {
  const fromParty = getBookingPassengers(booking)
    .map((p) => normalizeSeat(p.seat))
    .filter(Boolean);
  if (fromParty.length) return fromParty;
  return seatListFromBooking(booking).map(normalizeSeat).filter(Boolean);
}

function boardedSeatsOf(booking) {
  const raw = booking.boardedSeats || booking.boarded_seats || [];
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeSeat).filter(Boolean);
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

/**
 * Board one seat (airline-style) or the whole booking when QR has no seat claim.
 */
function boardSeatLocal(booking, seatRaw, { scanStep = null, message } = {}) {
  const seatCode = normalizeSeat(seatRaw);
  let seats = bookingSeatCodes(booking);
  let boarded = boardedSeatsOf(booking);

  if (
    booking.checkInStatus === CHECK_IN.BOARDED ||
    booking.checkInStatus === CHECK_IN.CHECKED_IN ||
    booking.checkedIn
  ) {
    return fail('ALREADY_SCANNED', scanFailureMessage('ALREADY_CHECKED_IN'), booking);
  }

  // Legacy QR without seat → board entire booking.
  if (!seatCode) {
    boarded = seats.length ? [...seats] : boarded;
    markCheckedIn(booking.id, CHECK_IN.BOARDED);
    updateBooking(booking.id, { boardedSeats: boarded });
    if (scanStep != null) setLastScanStep(booking.id, scanStep);
    const updated = getBookingById(booking.id);
    return success(updated, message || 'Επιτυχής επιβίβαση (τοπικά)', {
      boardedSeat: null,
      boardedSeats: boarded,
    });
  }

  if (!seats.length) seats = [seatCode];

  if (seats.length && !seats.includes(seatCode)) {
    return fail('SEAT_MISMATCH', `Η θέση ${seatCode} δεν ανήκει σε αυτή την κράτηση.`, booking);
  }

  if (boarded.includes(seatCode)) {
    return fail('ALREADY_SCANNED', `Η θέση ${seatCode} έχει ήδη επιβιβαστεί.`, booking);
  }

  boarded = [...boarded, seatCode];
  const allDone = seats.every((s) => boarded.includes(s));
  if (allDone) {
    markCheckedIn(booking.id, CHECK_IN.BOARDED);
  }
  updateBooking(booking.id, { boardedSeats: boarded });
  if (scanStep != null) setLastScanStep(booking.id, scanStep);

  const updated = getBookingById(booking.id);
  const party = getBookingPassengers(updated);
  const pax = party.find((p) => normalizeSeat(p.seat) === seatCode);
  return success(updated, message || `Επιτυχής επιβίβαση · θέση ${seatCode}`, {
    boardedSeat: seatCode,
    boardedSeats: boarded,
    passengerName: pax?.name || updated.customerName,
  });
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
      const prev = steps[booking.id];
      const prevStep = prev && typeof prev === 'object' ? prev.step : prev;
      if (prevStep === rot.payload.step && !rot.payload.seat) {
        return fail('REPLAY_DETECTED', scanFailureMessage('ALREADY_SCANNED'));
      }
      if (!isBookingPaid(booking)) {
        return fail('NOT_PAID', undefined, booking);
      }
      if (isBookingCancelled(booking)) {
        return fail('CANCELLED', undefined, booking);
      }
      return boardSeatLocal(booking, rot.payload.seat, {
        scanStep: rot.payload.step,
        message: 'Επιτυχής επιβίβαση (offline JWT)',
      });
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

  return boardSeatLocal(booking, verified.payload.seat, {
    message: 'Επιτυχής επιβίβαση (τοπικά)',
  });
}

function success(booking, message, extra = {}) {
  return {
    result: SCAN_RESULT.SUCCESS,
    booking_id: booking.id,
    bookingId: booking.id,
    passenger_name: extra.passengerName || booking.customerName,
    passengerName: extra.passengerName || booking.customerName,
    seat_number: extra.boardedSeat || booking.seat,
    seat: extra.boardedSeat || booking.seat,
    boarded_seats: extra.boardedSeats || boardedSeatsOf(booking),
    special_requirements: formatRequirements(booking, extra.boardedSeats),
    message,
    offline: true,
  };
}

function formatRequirements(booking, boardedSeats) {
  const notes = booking.notes || booking.dietary || '';
  return {
    needs_assistance: false,
    allergies: booking.dietary?.toLowerCase?.().includes('vegan') ? ['dietary'] : [],
    notes,
    boarded_seats: boardedSeats || boardedSeatsOf(booking),
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
