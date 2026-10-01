/**
 * Collapse duplicate live-map pins for the same plate.
 * Teltonika wins position while present; App GPS only when hardware is gone.
 * Both live sources are kept on the winner for the dual badge.
 */

/** Greek lookalikes → Latin so App/Teltonika plates share one key. */
const GREEK_PLATE_FOLD = {
  Α: 'A',
  Β: 'B',
  Ε: 'E',
  Ζ: 'Z',
  Η: 'H',
  Ι: 'I',
  Κ: 'K',
  Μ: 'M',
  Ν: 'N',
  Ο: 'O',
  Ρ: 'P',
  Τ: 'T',
  Υ: 'Y',
  Χ: 'X',
};

export function normalizePlateString(value) {
  const upper = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.]/g, '');
  let out = '';
  for (const ch of upper) {
    out += GREEK_PLATE_FOLD[ch] || ch;
  }
  return out.replace(/[^A-Z0-9]/g, '');
}

export function normalizePlateKey(v) {
  return normalizePlateString(v?.bus_plate || v?.vehicle_code || v?.plate_number || '');
}

export function isHardwareTrackerRow(row) {
  const src = String(row?.source || '').toLowerCase();
  if (src.startsWith('teltonika') || src === 'tracker' || src === 'test_ping') return true;
  if (row?.imei && src !== 'driver_pwa' && src !== 'app') return true;
  const sources = Array.isArray(row?.gps_sources) ? row.gps_sources : [];
  if (sources.some((s) => String(s).toLowerCase().includes('teltonika')) && row?.imei) {
    return true;
  }
  return false;
}

export function isPhoneGpsRow(row) {
  const src = String(row?.source || '').toLowerCase();
  if (!src) {
    const sources = Array.isArray(row?.gps_sources) ? row.gps_sources : [];
    return sources.some((s) => {
      const k = String(s || '').toLowerCase();
      return k === 'app' || k.includes('driver') || k.includes('pwa') || k.includes('phone');
    });
  }
  if (isHardwareTrackerRow(row)) return false;
  return src.includes('driver') || src.includes('pwa') || src.includes('phone') || src === 'app';
}

function rowUpdatedMs(row) {
  const t = new Date(row?.timestamp || row?.updated_at || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function collectSources(row) {
  const seen = new Set();
  const push = (kind) => {
    if (kind) seen.add(kind);
  };
  for (const item of row?.gps_sources || []) {
    const s = String(item || '').toLowerCase();
    if (s.includes('teltonika') || s === 'tracker') push('teltonika');
    if (s === 'app' || s.includes('driver') || s.includes('pwa')) push('app');
  }
  if (isHardwareTrackerRow(row)) push('teltonika');
  if (isPhoneGpsRow(row)) push('app');
  if (row?.app_seen_at) push('app');
  return ['teltonika', 'app'].filter((k) => seen.has(k));
}

function mergeRowsKeepSources(winner, other) {
  if (!other) return winner;
  const sources = [...new Set([...collectSources(winner), ...collectSources(other)])];
  const ordered = ['teltonika', 'app'].filter((k) => sources.includes(k));
  const appSeen = [winner?.app_seen_at, other?.app_seen_at]
    .filter(Boolean)
    .sort()
    .at(-1);
  const plate =
    normalizePlateString(winner?.bus_plate || winner?.vehicle_code) ||
    normalizePlateString(other?.bus_plate || other?.vehicle_code);
  return {
    ...winner,
    bus_plate: plate || winner.bus_plate || other.bus_plate,
    vehicle_code: plate || winner.vehicle_code || other.vehicle_code,
    gps_sources: ordered,
    app_seen_at: appSeen || winner.app_seen_at || null,
    // Prefer driver name from app when hardware label is generic.
    driver_name:
      winner.driver_name && winner.driver_name !== '—' && winner.driver_name !== 'Tracker'
        ? winner.driver_name
        : other.driver_name || winner.driver_name,
    photo_url: winner.photo_url || other.photo_url || null,
    vehicle_image_url: winner.vehicle_image_url || other.vehicle_image_url || null,
  };
}

export function preferVehicleRow(a, b) {
  if (!a) return b;
  if (!b) return a;
  const aHw = isHardwareTrackerRow(a);
  const bHw = isHardwareTrackerRow(b);
  let winner;
  let other;
  if (aHw && !bHw) {
    winner = a;
    other = b;
  } else if (bHw && !aHw) {
    winner = b;
    other = a;
  } else if (rowUpdatedMs(a) >= rowUpdatedMs(b)) {
    winner = a;
    other = b;
  } else {
    winner = b;
    other = a;
  }
  return mergeRowsKeepSources(winner, other);
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
      byPlate.set(plate, { key, row: { ...row, gps_sources: collectSources(row) } });
      continue;
    }
    const merged = preferVehicleRow(prev.row, row);
    const winnerKey =
      isHardwareTrackerRow(prev.row) && !isHardwareTrackerRow(row)
        ? prev.key
        : isHardwareTrackerRow(row) && !isHardwareTrackerRow(prev.row)
          ? key
          : rowUpdatedMs(row) > rowUpdatedMs(prev.row)
            ? key
            : prev.key;
    byPlate.set(plate, { key: winnerKey, row: merged });
  }
  const out = { ...orphans };
  for (const { key, row } of byPlate.values()) {
    out[key] = row;
  }
  return out;
}

/** Array form — final safety net before Leaflet/Mapbox markers. */
export function collapseVehicleListByPlate(list) {
  if (!Array.isArray(list) || list.length < 2) return list || [];
  const asMap = {};
  list.forEach((row, idx) => {
    const id = String(row?.id || row?.vehicle_id || `idx-${idx}`);
    asMap[id] = { ...row, id };
  });
  return Object.values(dedupeVehiclesByPlate(asMap));
}
