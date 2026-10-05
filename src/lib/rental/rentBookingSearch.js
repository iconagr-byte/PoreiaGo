/** Shared prefs + helpers for Hertz-like rent search bar → booking form. */

export const RENT_BOOKING_PREFS_KEY = 'rent_booking_prefs_v1';

/**
 * Office-linked pickup options from site appearance / brand.
 * Always includes the office; extra points come from rent_pickup_locations.
 * @param {{
 *   brandLabel?: string,
 *   officeName?: string,
 *   footerAddress?: string,
 *   pickupLocations?: string[],
 * }} office
 */
export function buildRentLocationOptions(office = {}) {
  const brand = String(office.brandLabel || office.officeName || 'Γραφείο').trim() || 'Γραφείο';
  const address = String(office.footerAddress || '').trim();
  // Guest UI shows «Γραφείο» like Hertz network field; extras come from admin pickups.
  const officeValue = 'Γραφείο';
  const officeLabel = address ? `Γραφείο — ${address}` : brand !== 'Γραφείο' ? `Γραφείο · ${brand}` : 'Γραφείο';

  const options = [
    { id: 'office', label: officeLabel, value: officeValue, kind: 'office' },
  ];

  const extras = Array.isArray(office.pickupLocations)
    ? office.pickupLocations
    : Array.isArray(office.rent_pickup_locations)
      ? office.rent_pickup_locations
      : [];

  extras.forEach((raw, idx) => {
    const label = String(raw || '').trim();
    if (!label) return;
    if (label.toLowerCase() === 'γραφείο') return;
    options.push({
      id: `extra-${idx}`,
      label,
      value: label,
      kind: 'extra',
    });
  });

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

/** Session flag: land on search dates with a friendly prompt. */
export const RENT_NEED_DATES_KEY = 'rent_need_dates_v1';

export const RENT_NEED_DATES_DEFAULT_MESSAGE =
  'Επίλεξε ημερομηνίες παραλαβής και επιστροφής για να συνεχίσεις.';

/** @param {ReturnType<typeof readRentBookingPrefs>} [prefs] */
export function rentTripSearchReady(prefs = readRentBookingPrefs()) {
  const p = prefs && typeof prefs === 'object' ? prefs : {};
  return Boolean(
    String(p.start_time || '').trim() &&
      String(p.end_time || '').trim() &&
      String(p.pickup_location || '').trim(),
  );
}

/** @param {string} [message] */
export function markNeedRentDates(message = RENT_NEED_DATES_DEFAULT_MESSAGE) {
  try {
    sessionStorage.setItem(
      RENT_NEED_DATES_KEY,
      JSON.stringify({
        message: String(message || RENT_NEED_DATES_DEFAULT_MESSAGE).trim(),
        at: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

/** @returns {{ message: string, at?: number } | null} */
export function consumeNeedRentDates() {
  try {
    const raw = sessionStorage.getItem(RENT_NEED_DATES_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RENT_NEED_DATES_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      message: String(parsed.message || RENT_NEED_DATES_DEFAULT_MESSAGE).trim(),
      at: Number(parsed.at) || Date.now(),
    };
  } catch {
    try {
      sessionStorage.removeItem(RENT_NEED_DATES_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * Redirect to guest search focused on pickup date.
 * @param {(to: string, opts?: object) => void} navigate
 * @param {{ message?: string, replace?: boolean }} [opts]
 */
export function navigateToRentDateSearch(navigate, opts = {}) {
  const message = opts.message || RENT_NEED_DATES_DEFAULT_MESSAGE;
  markNeedRentDates(message);
  if (typeof navigate !== 'function') {
    if (typeof window !== 'undefined') {
      window.location.assign('/rent#rent-pickup-date');
    }
    return;
  }
  navigate('/rent#rent-pickup-date', { replace: Boolean(opts.replace) });
}
