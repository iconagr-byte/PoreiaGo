/**
 * Bookable coverages / extras for rent wizard (display + notes; client-side estimate).
 */

export const RENT_PREFERRED_VEHICLE_KEY = 'rent_preferred_vehicle_id_v1';
export const RENT_VEHICLE_SNAPSHOT_KEY = 'rent_vehicle_snapshot_v1';

export const RENT_BOOKING_STEPS = [
  { id: 'trip', label: 'Παραλαβή & παράδοση', short: '1' },
  { id: 'vehicle', label: 'Επιλογή οχήματος', short: '2' },
  { id: 'services', label: 'Υπηρεσίες', short: '3' },
  { id: 'details', label: 'Στοιχεία', short: '4' },
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

export function emptyExtrasSelection() {
  return {
    extra_insurance: false,
    super_cover: false,
    extra_driver: false,
    child_seat: false,
    gps_pack: false,
  };
}

export function readExtrasSelection(prefs = {}) {
  const base = emptyExtrasSelection();
  for (const key of Object.keys(base)) {
    if (typeof prefs[key] === 'boolean') base[key] = prefs[key];
  }
  return base;
}

export function extrasDayTotal(selection) {
  return RENT_COVERAGE_OPTIONS.reduce((sum, opt) => {
    if (selection?.[opt.formKey]) return sum + Number(opt.eurPerDay || 0);
    return sum;
  }, 0);
}

export function selectedExtrasLabels(selection) {
  return RENT_COVERAGE_OPTIONS.filter((opt) => selection?.[opt.formKey]).map((opt) => opt.title);
}

export function extrasNotesLine(selection) {
  const labels = selectedExtrasLabels(selection);
  if (!labels.length) return '';
  return `Extras: ${labels.join(', ')}`;
}

export function estimateBookingTotals({ dailyRate, days, selection }) {
  const d = Math.max(1, Number(days) || 1);
  const vehicle = Number(dailyRate || 0) * d;
  const extrasDay = extrasDayTotal(selection);
  const extras = extrasDay * d;
  return {
    days: d,
    vehicle,
    extras,
    total: vehicle + extras,
    extrasPerDay: extrasDay,
  };
}
