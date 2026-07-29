/** Shared prefs + helpers for Hertz-like rent search bar → booking form. */

export const RENT_BOOKING_PREFS_KEY = 'rent_booking_prefs_v1';

/**
 * Office-linked pickup options from site appearance / brand.
 * @param {{ brandLabel?: string, footerAddress?: string }} office
 */
export function buildRentLocationOptions(office = {}) {
  const brand = String(office.brandLabel || office.officeName || 'Γραφείο').trim() || 'Γραφείο';
  const address = String(office.footerAddress || '').trim();
  const officeLabel = address ? `${brand} — ${address}` : brand;

  const options = [
    { id: 'office', label: officeLabel, value: brand, kind: 'office' },
    { id: 'airport', label: 'Αεροδρόμιο', value: 'Αεροδρόμιο', kind: 'airport' },
    { id: 'port', label: 'Λιμάνι / Πειραιάς', value: 'Πειραιάς', kind: 'port' },
    { id: 'athens', label: 'Αθήνα κέντρο', value: 'Αθήνα', kind: 'city' },
  ];

  // Deduplicate by value
  const seen = new Set();
  return options.filter((o) => {
    const key = o.value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Local datetime-local value from Date */
export function toDateTimeLocalValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function defaultPickupDateTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toDateTimeLocalValue(d);
}

export function defaultReturnDateTime(fromLocal) {
  const base = fromLocal ? new Date(fromLocal) : new Date();
  if (Number.isNaN(base.getTime())) return defaultPickupDateTime();
  base.setDate(base.getDate() + 3);
  base.setHours(10, 0, 0, 0);
  return toDateTimeLocalValue(base);
}

export function readRentBookingPrefs() {
  try {
    return JSON.parse(localStorage.getItem(RENT_BOOKING_PREFS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

/**
 * Persist search bar → catalog form (locations + dates + promo).
 */
export function writeRentBookingPrefs(patch = {}) {
  const prev = readRentBookingPrefs();
  const next = {
    ...prev,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(RENT_BOOKING_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
