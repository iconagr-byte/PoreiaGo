import { getLayoutForVehicle } from './busLayouts.js';

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function isSeatBooked(tripId, seatId) {
  const ratio = 0.22 + (hashSeed(`${tripId}-${seatId}`) % 18) / 100;
  const threshold = ratio * 100;
  return hashSeed(`booked-${tripId}-${seatId}`) % 100 < threshold;
}

/**
 * Σταθερή διάταξη θέσεων ανά εκδρομή + τύπο λεωφορείου (όχι τυχαία σε κάθε refresh).
 */
export function generateSeatMap(trip) {
  const layout = getLayoutForVehicle(trip?.vehicleType);
  const tripId = String(trip?.id ?? 'default');
  const seats = [];

  for (let row = 1; row <= layout.rows; row += 1) {
    for (const col of layout.cols) {
      const number = `${row}${col}`;
      const id = `${tripId}-${number}`;
      const isVip = layout.vipRows.includes(row);
      const booked = isSeatBooked(tripId, id);
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
