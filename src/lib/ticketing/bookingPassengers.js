/**
 * Multi-seat party members for a booking (booker + companions).
 * Additive: legacy bookings without `passengers` still work via customerName.
 */

export function seatListFromBooking(bookingOrSeats) {
  if (Array.isArray(bookingOrSeats)) {
    return bookingOrSeats.map((s) => String(s).trim()).filter(Boolean);
  }
  if (bookingOrSeats && typeof bookingOrSeats === 'object') {
    if (Array.isArray(bookingOrSeats.seats)) {
      return bookingOrSeats.seats.map((s) => String(s).trim()).filter(Boolean);
    }
    const raw = bookingOrSeats.seat || bookingOrSeats.seat_label || '';
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(bookingOrSeats || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build passengers[] aligned 1:1 with seats.
 * @param {{ seats: string[], bookerName: string, companionNames?: string[] }} input
 */
export function buildBookingPassengers({ seats, bookerName, companionNames = [] }) {
  const seatList = seatListFromBooking(seats);
  const booker = String(bookerName || '').trim();
  const companions = Array.isArray(companionNames)
    ? companionNames.map((n) => String(n || '').trim())
    : [];

  return seatList.map((seat, index) => {
    if (index === 0) {
      return { seat, name: booker, role: 'booker' };
    }
    return {
      seat,
      name: companions[index - 1] || '',
      role: 'companion',
    };
  });
}

/** Validate companion names when seat count > 1. Returns error message or null. */
export function validateCompanionNames(seats, companionNames) {
  const seatList = seatListFromBooking(seats);
  if (seatList.length <= 1) return null;
  const needed = seatList.length - 1;
  for (let i = 0; i < needed; i += 1) {
    const name = String(companionNames?.[i] || '').trim();
    if (name.length < 2) {
      return `Συμπληρώστε το ονοματεπώνυμο για τη θέση ${seatList[i + 1]}`;
    }
  }
  return null;
}

/**
 * Normalize passengers from a stored booking (local or API metadata).
 * Falls back to single booker name for legacy records.
 */
export function getBookingPassengers(booking) {
  if (!booking) return [];
  const seats = seatListFromBooking(booking);
  const raw =
    booking.passengers ||
    booking.metadata_json?.passengers ||
    booking.metadata?.passengers ||
    null;

  if (Array.isArray(raw) && raw.length) {
    return raw.map((p, index) => ({
      seat: String(p.seat || seats[index] || '').trim(),
      name: String(p.name || '').trim(),
      role: p.role === 'booker' || index === 0 ? 'booker' : 'companion',
    }));
  }

  const booker =
    booking.customerName ||
    booking.passengerName ||
    booking.passenger_name ||
    booking.name ||
    '';
  if (!seats.length && !booker) return [];
  if (!seats.length) {
    return [{ seat: '', name: String(booker).trim(), role: 'booker' }];
  }
  return seats.map((seat, index) => ({
    seat,
    name: index === 0 ? String(booker).trim() : '',
    role: index === 0 ? 'booker' : 'companion',
  }));
}

export function bookerNameFromPassengers(passengers, fallback = '') {
  const list = Array.isArray(passengers) ? passengers : [];
  const booker = list.find((p) => p.role === 'booker') || list[0];
  return String(booker?.name || fallback || '').trim();
}
