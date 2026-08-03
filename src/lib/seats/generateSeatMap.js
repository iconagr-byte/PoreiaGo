import { getLayoutForVehicle } from './busLayouts.js';
import { normalizeSeatCode } from './occupiedSeats.js';

/**
 * Build seat map for a trip from vehicle layout + real occupancy.
 * @param {object} trip
 * @param {{ occupiedSeats?: Iterable<string> }} [options]
 */
export function generateSeatMap(trip, options = {}) {
  const layout = getLayoutForVehicle(trip?.vehicleType);
  const tripId = String(trip?.id ?? 'default');
  const occupied = new Set(
    [...(options.occupiedSeats || [])].map(normalizeSeatCode).filter(Boolean),
  );
  const seats = [];

  for (let row = 1; row <= layout.rows; row += 1) {
    for (const col of layout.cols) {
      const number = `${row}${col}`;
      const id = `${tripId}-${number}`;
      const isVip = layout.vipRows.includes(row);
      const booked = occupied.has(normalizeSeatCode(number));
      seats.push({
        id,
        row,
        col,
        number,
        isVip,
        status: booked ? 'BOOKED' : 'AVAILABLE',
      });
    }
  }

  const availableCount = seats.filter((s) => s.status === 'AVAILABLE').length;

  return { layout, seats, availableCount };
}
