/**
 * Build a read-only boarding κάτοψη from the driver manifest.
 * Seat labels may be "4A", "1A, 1B", "Θέση 12B", etc.
 */
import { VEHICLE_LAYOUTS, getLayoutForVehicle } from '../seats/busLayouts.js';

const SEAT_TOKEN_RE = /(\d{1,2})\s*[-.]?\s*([A-Da-d])/g;

/** Parse one or more seat codes from a booking seat_number string. */
export function parseSeatNumbers(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  const found = [];
  const seen = new Set();
  let m;
  const re = new RegExp(SEAT_TOKEN_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const number = `${Number(m[1])}${String(m[2]).toUpperCase()}`;
    if (seen.has(number)) continue;
    seen.add(number);
    found.push(number);
  }
  return found;
}

/** Pick a coach layout that fits capacity (fallback Luxury Coach). */
export function layoutForCapacity(capacity, vehicleType) {
  if (vehicleType && VEHICLE_LAYOUTS[vehicleType]) {
    return getLayoutForVehicle(vehicleType);
  }
  const seats = Number(capacity) || 0;
  if (seats > 0 && seats <= 16) return VEHICLE_LAYOUTS['VIP Minibus'];
  if (seats > 0 && seats <= 34) return VEHICLE_LAYOUTS['Premium Express'];
  return VEHICLE_LAYOUTS['Luxury Coach'];
}

function passengerIndex(list) {
  const bySeat = new Map();
  for (const p of list || []) {
    const seats = parseSeatNumbers(p?.seat_number);
    if (!seats.length) continue;
    for (const number of seats) {
      bySeat.set(number, p);
    }
  }
  return bySeat;
}

/**
 * @param {object} manifest driver boarding manifest
 * @param {{ vehicleType?: string }} [opts]
 */
export function buildBoardingSeatMap(manifest, opts = {}) {
  const capacity =
    Number(manifest?.capacity) ||
    Number(manifest?.booked_count) + Number(manifest?.boarded_count) ||
    45;
  const layout = layoutForCapacity(capacity, opts.vehicleType || manifest?.vehicle_type);
  const boardedBySeat = passengerIndex(manifest?.boarded_passengers);
  const missingBySeat = passengerIndex(manifest?.missing_passengers);

  const seats = [];
  for (let row = 1; row <= layout.rows; row += 1) {
    for (const col of layout.cols) {
      const number = `${row}${col}`;
      const boarded = boardedBySeat.get(number);
      const missing = !boarded ? missingBySeat.get(number) : null;
      let status = 'EMPTY';
      let passenger = null;
      if (boarded) {
        status = 'BOARDED';
        passenger = boarded;
      } else if (missing) {
        status = 'RESERVED';
        passenger = missing;
      }
      seats.push({
        id: number,
        row,
        col,
        number,
        isVip: layout.vipRows.includes(row),
        status,
        passenger_name: passenger?.passenger_name || null,
        booking_ref: passenger?.booking_ref || passenger?.booking_id || null,
        boarded_at: boarded?.boarded_at || null,
      });
    }
  }

  const boardedCount = seats.filter((s) => s.status === 'BOARDED').length;
  const reservedCount = seats.filter((s) => s.status === 'RESERVED').length;
  const emptyCount = seats.filter((s) => s.status === 'EMPTY').length;

  return {
    layout,
    seats,
    capacity: layout.rows * layout.cols.length,
    boardedCount,
    reservedCount,
    emptyCount,
    progressPercent:
      seats.length > 0 ? Math.min(100, Math.round((boardedCount / seats.length) * 100)) : 0,
  };
}
