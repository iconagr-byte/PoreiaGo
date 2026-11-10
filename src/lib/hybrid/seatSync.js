/**
 * Sync ground seats from local bookings into hybrid passengerFlightSeats.
 */
import { emptyPassengerSeat } from './hybridDefaults.js';

function bookingSeats(booking) {
  if (Array.isArray(booking?.seats) && booking.seats.length) {
    return booking.seats.map((s) => String(s).trim()).filter(Boolean);
  }
  if (booking?.seat) {
    return String(booking.seat)
      .split(/[,;/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function nameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Merge trip bookings into passengerFlightSeats.
 * - Matches existing rows by booking_id or passenger name
 * - Creates new rows for unmatched bookings
 * - Assigns defaultFlightId / PNR when provided
 */
export function syncSeatsFromBookings({
  bookings = [],
  tripId,
  existingSeats = [],
  defaultFlightId = '',
  defaultPnr = '',
} = {}) {
  const tripBookings = (bookings || []).filter(
    (b) => Number(b.tripId ?? b.trip_id) === Number(tripId),
  );
  const next = [...(existingSeats || [])];
  let created = 0;
  let updated = 0;

  for (const b of tripBookings) {
    const seats = bookingSeats(b);
    const ground = seats[0] || '';
    const bookingId = String(b.id || b.booking_id || '');
    const passengerName = String(b.customerName || b.passenger_name || b.name || '').trim();
    if (!passengerName && !ground) continue;

    const idx = next.findIndex(
      (row) =>
        (bookingId && String(row.booking_id) === bookingId) ||
        (passengerName && nameKey(row.passenger_name) === nameKey(passengerName)),
    );

    if (idx >= 0) {
      const row = next[idx];
      next[idx] = {
        ...row,
        booking_id: row.booking_id || bookingId,
        passenger_name: row.passenger_name || passengerName,
        ground_seat: ground || row.ground_seat,
        flight_seat: row.flight_seat || b.flightSeat || b.flight_seat || '',
        ticket_code: row.ticket_code || b.ticketRef || b.ticket_code || '',
        pnr_code: row.pnr_code || b.pnr || defaultPnr || '',
        flight_id: row.flight_id || defaultFlightId || '',
      };
      updated += 1;
    } else {
      next.push(
        emptyPassengerSeat({
          booking_id: bookingId,
          passenger_name: passengerName || `Επιβάτης ${bookingId || created + 1}`,
          ground_seat: ground,
          flight_seat: b.flightSeat || b.flight_seat || '',
          ticket_code: b.ticketRef || b.ticket_code || '',
          pnr_code: b.pnr || defaultPnr || '',
          flight_id: defaultFlightId || '',
        }),
      );
      created += 1;
    }
  }

  return { seats: next, created, updated, scanned: tripBookings.length };
}
