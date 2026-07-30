/**
 * Bookable coverages / extras for rent wizard (display + notes; client-side estimate).
 */

export const RENT_PREFERRED_VEHICLE_KEY = 'rent_preferred_vehicle_id_v1';
export const RENT_VEHICLE_SNAPSHOT_KEY = 'rent_vehicle_snapshot_v1';

export const RENT_BOOKING_STEPS = [
  { id: 'trip', label: 'Παραλαβή & παράδοση', short: '1' },
  { id: 'vehicle', label: 'Επιλογή οχήματος', short: '2' },
  { id: 'services', label: 'Υπηρεσίες', short: '3' },
  { id: 'details', label: 'Συμπληρώνεις στοιχεία', short: '4' },
];

/** Coverage / add-on catalog — teal brand, not Hertz yellow clone. */
export const RENT_COVERAGE_OPTIONS = [
  {
    id: 'scdw',
    icon: 'shield_with_heart',
    title: 'SCDW Plus',
    blurb: 'Μειώνει το franchise σε ζημιές αμαξώματος. Ιδανικό αν θες ήσυχο μυαλό στην οδήγηση.',
    includes: ['Κάλυψη ζημιών αμαξώματος', 'Χαμηλότερο franchise'],
    excludes: ['Ζημιές από αμέλεια', 'Αντικείμενα στην καμπίνα'],
    eurPerDay: 13.5,
    formKey: 'extra_insurance',
  },
  {
    id: 'super_cover',
    icon: 'verified_user',
    title: 'Super Cover',
    blurb: 'Επιπλέον προστασία για γυαλιά, λάστιχα και κάτω μέρος — όταν τα χιλιόμετρα είναι πολλά.',
    includes: ['Γυαλιά / καθρέφτες', 'Λάστιχα & ζάντες'],
    excludes: ['Off-road χρήση'],
    eurPerDay: 9.5,
    formKey: 'super_cover',
  },
  {
    id: 'extra_driver',
    icon: 'sports_motorsports',
    title: 'Επιπλέον οδηγός',
    blurb: 'Δεύτερος οδηγός στο συμβόλαιο — μοιράσου τη διαδρομή χωρίς έξτρα γραφειοκρατία στο desk.',
    includes: ['Ένας επιπλέον οδηγός', 'Ίδια κάλυψη με κύριο'],
    excludes: [],
    eurPerDay: 8,
    formKey: 'extra_driver',
  },
  {
    id: 'child_seat',
    icon: 'child_care',
    title: 'Παιδικό κάθισμα',
    blurb: 'Κάθισμα ασφαλείας για μικρούς επιβάτες — διαθέσιμο στην παραλαβή.',
    includes: ['1 κάθισμα', 'Τοποθέτηση στο γραφείο'],
    excludes: [],
    eurPerDay: 7,
    formKey: 'child_seat',
  },
  {
    id: 'gps_pack',
    icon: 'explore',
    title: 'GPS pack',
    blurb: 'Φορητό GPS με ελληνικούς χάρτες — χρήσιμο όταν δεν θες data στο κινητό.',
    includes: ['Συσκευή + βάση'],
    excludes: [],
    eurPerDay: 5,
    formKey: 'gps_pack',
  },
];

export const RENT_INCLUDED_DEFAULTS = [
  'Οδική βοήθεια 24/7',
  'Κάλυψη κλοπής',
  'ΦΠΑ 24%',
  'Basic CDW',
];

export const RENT_COVERAGE_ICON_OPTIONS = [
  'shield_with_heart',
  'verified_user',
  'sports_motorsports',
  'child_care',
  'explore',
  'health_and_safety',
  'car_crash',
  'garage',
  'local_gas_station',
  'wifi',
  'luggage',
  'pets',
];

const MAX_COVERAGE_OPTIONS = 12;

function slugFormKey(raw, fallback = 'extra') {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || fallback;
}

export function createCoverageOption(partial = {}) {
  const id =
    String(partial.id || '').trim() ||
    `cov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const formKey = slugFormKey(partial.formKey || partial.id || id, `extra_${id.slice(-6)}`);
  const includes = Array.isArray(partial.includes)
    ? partial.includes.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const excludes = Array.isArray(partial.excludes)
    ? partial.excludes.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const price = Number(partial.eurPerDay);
  return {
    id,
    icon: String(partial.icon || 'verified_user').trim() || 'verified_user',
    title: String(partial.title || '').trim(),
    blurb: String(partial.blurb || '').trim(),
    includes,
    excludes,
    eurPerDay: Number.isFinite(price) ? Math.max(0, price) : 0,
    formKey,
    visible: partial.visible !== false,
  };
}

/** Merge tenant overrides with defaults; empty/invalid falls back to built-in catalog. */
export function normalizeCoverageOptions(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    return RENT_COVERAGE_OPTIONS.map((o) => createCoverageOption(o));
  }
  const seenKeys = new Set();
  const out = [];
  for (const item of raw) {
    const opt = createCoverageOption(item || {});
    if (!opt.title) continue;
    let key = opt.formKey;
    let n = 2;
    while (seenKeys.has(key)) {
      key = `${opt.formKey}_${n}`;
      n += 1;
    }
    opt.formKey = key;
    seenKeys.add(key);
    out.push(opt);
    if (out.length >= MAX_COVERAGE_OPTIONS) break;
  }
  return out.length ? out : RENT_COVERAGE_OPTIONS.map((o) => createCoverageOption(o));
}

export function visibleCoverageOptions(rawOrList) {
  return normalizeCoverageOptions(rawOrList).filter((o) => o.visible !== false);
}

export function normalizeIncludedDefaults(raw) {
  if (!Array.isArray(raw) || !raw.length) return [...RENT_INCLUDED_DEFAULTS];
  const rows = raw.map((x) => String(x || '').trim()).filter(Boolean);
  return rows.length ? rows.slice(0, 20) : [...RENT_INCLUDED_DEFAULTS];
}

export function readCoverageCatalog(appearance) {
  return {
    options: normalizeCoverageOptions(appearance?.rent_coverage_options),
    included: normalizeIncludedDefaults(appearance?.rent_included_defaults),
  };
}

export function rentalDayCount(startTime, endTime) {
  const a = new Date(startTime);
  const b = new Date(endTime);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 1;
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function formatRentWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function euroLabel(n) {
  return `€${Number(n || 0).toFixed(2)}`;
}

export function rememberRentVehicle(vehicle) {
  if (!vehicle?.id) return;
  try {
    localStorage.setItem(RENT_PREFERRED_VEHICLE_KEY, String(vehicle.id));
    const snap = {
      id: vehicle.id,
      model: vehicle.model,
      category: vehicle.category,
      seating_capacity: vehicle.seating_capacity,
      daily_rate_eur: vehicle.daily_rate_eur,
      photo_url: vehicle.photo_url || vehicle.photo_urls?.[0] || '',
      transmission: vehicle.transmission,
      luggage_label: vehicle.luggage_label,
      seats_label: vehicle.seats_label,
      ac_label: vehicle.ac_label,
      group_code: vehicle.group_code,
      size_label: vehicle.size_label,
      similar_label: vehicle.similar_label,
    };
    localStorage.setItem(RENT_VEHICLE_SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export function readRentVehicleSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(RENT_VEHICLE_SNAPSHOT_KEY) || 'null');
  } catch {
    return null;
  }
}

export function readPreferredVehicleId() {
  try {
    return localStorage.getItem(RENT_PREFERRED_VEHICLE_KEY) || '';
  } catch {
    return '';
  }
}

export function emptyExtrasSelection(catalog = RENT_COVERAGE_OPTIONS) {
  const base = {};
  for (const opt of normalizeCoverageOptions(catalog)) {
    base[opt.formKey] = false;
  }
  return base;
}

export function readExtrasSelection(prefs = {}, catalog = RENT_COVERAGE_OPTIONS) {
  const base = emptyExtrasSelection(catalog);
  for (const key of Object.keys(base)) {
    if (typeof prefs[key] === 'boolean') base[key] = prefs[key];
  }
  return base;
}

export function extrasDayTotal(selection, catalog = RENT_COVERAGE_OPTIONS) {
  return visibleCoverageOptions(catalog).reduce((sum, opt) => {
    if (selection?.[opt.formKey]) return sum + Number(opt.eurPerDay || 0);
    return sum;
  }, 0);
}

export function selectedExtrasLabels(selection, catalog = RENT_COVERAGE_OPTIONS) {
  return visibleCoverageOptions(catalog)
    .filter((opt) => selection?.[opt.formKey])
    .map((opt) => opt.title);
}

export function extrasNotesLine(selection, catalog = RENT_COVERAGE_OPTIONS) {
  const labels = selectedExtrasLabels(selection, catalog);
  if (!labels.length) return '';
  return `Extras: ${labels.join(', ')}`;
}

export function estimateBookingTotals({ dailyRate, days, selection, catalog = RENT_COVERAGE_OPTIONS }) {
  const d = Math.max(1, Number(days) || 1);
  const vehicle = Number(dailyRate || 0) * d;
  const extrasDay = extrasDayTotal(selection, catalog);
  const extras = extrasDay * d;
  return {
    days: d,
    vehicle,
    extras,
    total: vehicle + extras,
    extrasPerDay: extrasDay,
  };
}
