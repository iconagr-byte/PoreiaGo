/**
 * Collapse duplicate live-map pins for the same plate.
 * Teltonika wins while present; App GPS only when hardware is gone.
 */

export function normalizePlateKey(v) {
  return String(v?.bus_plate || v?.vehicle_code || '')
    .trim()
    .toUpperCase();
}

export function isHardwareTrackerRow(row) {
  const src = String(row?.source || '').toLowerCase();
  if (src.startsWith('teltonika') || src === 'tracker' || src === 'test_ping') return true;
  if (row?.imei && src !== 'driver_pwa' && src !== 'app') return true;
  return false;
}

export function isPhoneGpsRow(row) {
  const src = String(row?.source || '').toLowerCase();
  if (!src) return false;
  if (isHardwareTrackerRow(row)) return false;
  return src.includes('driver') || src.includes('pwa') || src.includes('phone') || src === 'app';
}

function rowUpdatedMs(row) {
  const t = new Date(row?.timestamp || row?.updated_at || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function preferVehicleRow(a, b) {
  if (!a) return b;
  if (!b) return a;
  const aHw = isHardwareTrackerRow(a);
  const bHw = isHardwareTrackerRow(b);
  if (aHw && !bHw) return a;
  if (bHw && !aHw) return b;
  return rowUpdatedMs(a) >= rowUpdatedMs(b) ? a : b;
}

export function dedupeVehiclesByPlate(map) {
  const byPlate = new Map();
  const orphans = {};
  for (const [key, row] of Object.entries(map || {})) {
    const plate = normalizePlateKey(row);
    if (!plate) {
      orphans[key] = row;
      continue;
    }
    const prev = byPlate.get(plate);
    if (!prev) {
      byPlate.set(plate, { key, row });
      continue;
    }
    const winner = preferVehicleRow(prev.row, row);
    byPlate.set(plate, winner === row ? { key, row } : prev);
  }
  const out = { ...orphans };
  for (const { key, row } of byPlate.values()) {
    out[key] = row;
  }
  return out;
}
