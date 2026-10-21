/**
 * Multi-seat party members for a booking (booker + companions).
 * Additive: legacy bookings without `passengers` still work via customerName.
 */

export function seatListFromBooking(bookingOrSeats) {
  if (Array.isArray(bookingOrSeats)) {
    return bookingOrSeats.map((s) => String(s).trim()).filter(Boolean);
  }
  if (bookingOrSeats && typeof bookingOrSeats === 'object') {
    const fromArray = Array.isArray(bookingOrSeats.seats)
      ? bookingOrSeats.seats.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const raw = bookingOrSeats.seat || bookingOrSeats.seat_label || '';
    const fromString = String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // Prefer the more complete list — truncated seats[] must not hide companions
    // when seat / seat_label still carries "5D, 5E, 5F".
    if (fromArray.length >= fromString.length && fromArray.length) return fromArray;
    if (fromString.length) return fromString;
    return fromArray;
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
 * Always expands to one entry per seat when seats are known — a short
 * passengers[] (booker only) must not collapse a multi-seat booking to 1 QR.
 */
export function getBookingPassengers(booking) {
  if (!booking) return [];
  const seats = seatListFromBooking(booking);
  const raw =
    booking.passengers ||
    booking.metadata_json?.passengers ||
    booking.metadata?.passengers ||
    null;

  const fromRaw =
    Array.isArray(raw) && raw.length
      ? raw.map((p, index) => ({
          seat: String(p.seat || seats[index] || '').trim(),
          name: String(p.name || '').trim(),
          role: p.role === 'booker' || index === 0 ? 'booker' : 'companion',
        }))
      : [];

  const booker =
    booking.customerName ||
    booking.passengerName ||
    booking.passenger_name ||
    booking.name ||
    '';

  if (!seats.length) {
    if (fromRaw.length) return fromRaw;
    if (!booker) return [];
    return [{ seat: '', name: String(booker).trim(), role: 'booker' }];
  }

  return seats.map((seat, index) => {
    const bySeat = fromRaw.find(
      (p) => p.seat && String(p.seat).toLowerCase() === String(seat).toLowerCase(),
    );
    const byIndex = fromRaw[index];
    const existing = bySeat || byIndex;
    const name =
      String(existing?.name || '').trim() ||
      (index === 0 ? String(booker).trim() : '');
    return {
      seat,
      name,
      role: index === 0 ? 'booker' : 'companion',
    };
  });
}

export function bookerNameFromPassengers(passengers, fallback = '') {
  const list = Array.isArray(passengers) ? passengers : [];
  const booker = list.find((p) => p.role === 'booker') || list[0];
  return String(booker?.name || fallback || '').trim();
}

/**
 * Flatten bookings → one wallet ticket per seat/passenger.
 * Used by My Wallet pass stack / desktop gallery.
 */
export function expandWalletTickets(bookings, { passengerName = '' } = {}) {
  const list = Array.isArray(bookings) ? bookings.filter(Boolean) : [];
  const tickets = [];
  for (const booking of list) {
    let party = getBookingPassengers(booking);
    if (!party.length) {
      party = [
        {
          seat: booking.seat || (Array.isArray(booking.seats) ? booking.seats[0] : '') || '',
          name:
            passengerName ||
            booking.customerName ||
            booking.passengerName ||
            booking.name ||
            '—',
          role: 'booker',
        },
      ];
    } else if (passengerName && party[0]?.role === 'booker' && !party[0].name) {
      party = [{ ...party[0], name: passengerName }, ...party.slice(1)];
    }
    party.forEach((passenger, index) => {
      tickets.push({
        booking,
        passenger,
        key: `${booking.id || booking.pnr || 'b'}-${passenger.seat || index}-${index}`,
      });
    });
  }
  return tickets;
}
