/**
 * Rent fleet categories — ACRISS-inspired groups (Hertz / Sixt / Europcar style).
 * Offices book & display by class, not a flat «CAR» dump.
 */

/** @typedef {{
 *   id: string,
 *   label: string,
 *   shortLabel: string,
 *   blurb: string,
 *   icon: string,
 *   sort: number,
 *   acrissHint: string,
 * }} RentVehicleCategory */

/** @type {RentVehicleCategory[]} */
export const RENT_VEHICLE_CATEGORIES = [
  {
    id: 'MINI',
    label: 'Mini',
    shortLabel: 'Mini',
    blurb: 'Πολύ μικρό city car — εύκολο πάρκινγκ, χαμηλή κατανάλωση.',
    icon: 'directions_car',
    sort: 10,
    acrissHint: 'M',
  },
  {
    id: 'ECONOMY',
    label: 'Οικονομικό',
    shortLabel: 'Economy',
    blurb: 'Οικονομικό επιβατικό για πόλη και καθημερινές διαδρομές.',
    icon: 'directions_car',
    sort: 20,
    acrissHint: 'E',
  },
  {
    id: 'COMPACT',
    label: 'Compact',
    shortLabel: 'Compact',
    blurb: 'Compact hatchback — άνεση για 4–5 άτομα και αποσκευές.',
    icon: 'directions_car',
    sort: 30,
    acrissHint: 'C',
  },
  {
    id: 'INTERMEDIATE',
    label: 'Μεσαίο',
    shortLabel: 'Intermediate',
    blurb: 'Μεσαία κατηγορία για οικογένεια ή επαγγελματικά ταξίδια.',
    icon: 'directions_car',
    sort: 40,
    acrissHint: 'I',
  },
  {
    id: 'STANDARD',
    label: 'Standard',
    shortLabel: 'Standard',
    blurb: 'Μεγαλύτερο επιβατικό με χώρο και άνεση στον αυτοκινητόδρομο.',
    icon: 'directions_car',
    sort: 50,
    acrissHint: 'S',
  },
  {
    id: 'FULLSIZE',
    label: 'Μεγάλο',
    shortLabel: 'Fullsize',
    blurb: 'Μεγάλο sedan / estate για άνετα ταξίδια και αποσκευές.',
    icon: 'directions_car',
    sort: 60,
    acrissHint: 'F',
  },
  {
    id: 'PREMIUM',
    label: 'Premium',
    shortLabel: 'Premium',
    blurb: 'Premium επιβατικό με υψηλότερη άνεση και εξοπλισμό.',
    icon: 'airport_shuttle',
    sort: 70,
    acrissHint: 'P',
  },
  {
    id: 'LUXURY',
    label: 'Luxury',
    shortLabel: 'Luxury',
    blurb: 'Luxury / executive για VIP μετακινήσεις.',
    icon: 'diamond',
    sort: 80,
    acrissHint: 'L',
  },
  {
    id: 'SUV',
    label: 'SUV',
    shortLabel: 'SUV',
    blurb: 'SUV — ψηλή θέση, χώρος και άνεση σε μεγαλύτερες αποστάσεις.',
    icon: 'airport_shuttle',
    sort: 90,
    acrissHint: 'SF',
  },
  {
    id: 'VAN',
    label: 'Van / Πολυμορφικό',
    shortLabel: 'Van',
    blurb: 'Van ή πολυμορφικό για οικογένειες και ομάδες (έως ~8 θέσεις).',
    icon: 'airport_shuttle',
    sort: 100,
    acrissHint: 'V',
  },
  {
    id: 'MINIBUS',
    label: 'Minibus',
    shortLabel: 'Minibus',
    blurb: 'Minibus 8+ θέσεων για γκρουπ, transfers και εκδρομές.',
    icon: 'directions_bus',
    sort: 110,
    acrissHint: 'V',
  },
];

const BY_ID = Object.fromEntries(RENT_VEHICLE_CATEGORIES.map((c) => [c.id, c]));

/** Dropdown options for admin forms (canonical ids only). */
export const RENT_CATEGORY_OPTIONS = RENT_VEHICLE_CATEGORIES.map((c) => ({
  value: c.id,
  label: `${c.label} (${c.shortLabel})`,
}));

export function rentCategoryMeta(category) {
  const id = normalizeRentVehicleCategory(category);
  return BY_ID[id] || null;
}

export function rentCategoryLabel(category) {
  const meta = rentCategoryMeta(category);
  if (meta) return meta.label;
  const raw = String(category || '').trim();
  return raw || 'Όχημα';
}

/**
 * Normalize legacy CAR/… codes (+ optional seats/model hints) to ACRISS-style id.
 */
export function normalizeRentVehicleCategory(category, { seats, model } = {}) {
  const raw = String(category || '')
    .trim()
    .toUpperCase();
  const seatN = Number(seats);
  const name = String(model || '')
    .trim()
    .toLowerCase();

  // Canonical ids — still upgrade 9+ seat vans to minibus.
  if (BY_ID[raw]) {
    if (raw === 'VAN' && Number.isFinite(seatN) && seatN >= 9) return 'MINIBUS';
    return raw;
  }

  if (raw === 'SUV' || /tucson|kuga|qashqai|rav4|sportage|x-trail/.test(name)) {
    return 'SUV';
  }
  if (raw === 'MINIBUS' || (Number.isFinite(seatN) && seatN >= 9)) {
    return 'MINIBUS';
  }
  if (raw === 'VAN' || /vito|transporter|multivan|trafic|transit|custom/.test(name)) {
    return Number.isFinite(seatN) && seatN >= 9 ? 'MINIBUS' : 'VAN';
  }

  // Legacy flat «CAR» → Mini / Economy / Compact / Intermediate by size.
  if (raw === 'CAR' || !raw) {
    if (/aygo|i10|up!|twingo|picanto|fortwo/.test(name) || (Number.isFinite(seatN) && seatN <= 4)) {
      return 'MINI';
    }
    if (/208|clio|yaris|c3|polo|fiesta|ibiza|corsa/.test(name)) {
      return 'COMPACT';
    }
    if (/corolla|civic|focus|golf|octavia|astra|megane/.test(name)) {
      return 'INTERMEDIATE';
    }
    if (Number.isFinite(seatN) && seatN <= 4) return 'MINI';
    return 'COMPACT';
  }

  return 'COMPACT';
}

/** Van / people-carrier classes (vs passenger cars + SUV). */
export function isVanLikeRentCategory(category, opts = {}) {
  const id = normalizeRentVehicleCategory(category, opts);
  return id === 'VAN' || id === 'MINIBUS';
}

/** Hero / storefront counts: επιβατικά vs van. */
export function countRentFleetByBody(vehicles = []) {
  let cars = 0;
  let vans = 0;
  for (const v of vehicles || []) {
    if (
      isVanLikeRentCategory(v?.category, {
        seats: v?.seating_capacity,
        model: v?.model,
      })
    ) {
      vans += 1;
    } else {
      cars += 1;
    }
  }
  return { cars, vans };
}

/** Filter chips for /rent home — only classes present in the current fleet. */
export function rentHomeCategoryFilters(vehicles = []) {
  const present = new Set(
    (vehicles || []).map((v) =>
      normalizeRentVehicleCategory(v?.category, {
        seats: v?.seating_capacity,
        model: v?.model,
      }),
    ),
  );
  return ['', ...RENT_VEHICLE_CATEGORIES.filter((c) => present.has(c.id)).map((c) => c.id)];
}

/** Group vehicles into category sections (only non-empty, sorted). */
export function groupVehiclesByRentCategory(vehicles = []) {
  const buckets = new Map();
  for (const v of vehicles || []) {
    const id = normalizeRentVehicleCategory(v?.category, {
      seats: v?.seating_capacity,
      model: v?.model,
    });
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id).push(v);
  }

  return RENT_VEHICLE_CATEGORIES.filter((c) => buckets.has(c.id)).map((c) => ({
    ...c,
    vehicles: buckets.get(c.id) || [],
    count: (buckets.get(c.id) || []).length,
  }));
}
