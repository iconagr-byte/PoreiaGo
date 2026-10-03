/**
 * Guest /rent fleet sidebar filters (Rentalcars-style).
 * Location · Transmission · Fuel type · Extras · Luggage capacity.
 */

export const RENT_FILTER_LOCATIONS = [
  { id: 'airport_terminal', label: 'Αεροδρόμιο (τερματικό)' },
  { id: 'airport_shuttle', label: 'Αεροδρόμιο (shuttle)' },
  { id: 'other', label: 'Άλλα σημεία' },
];

export const RENT_FILTER_TRANSMISSIONS = [
  { id: 'automatic', label: 'Αυτόματο' },
  { id: 'manual', label: 'Χειροκίνητο' },
];

export const RENT_FILTER_FUEL_TYPES = [
  { id: 'electric', label: 'Πλήρως ηλεκτρικό' },
  { id: 'hybrid', label: 'Υβριδικό' },
  { id: 'plug_in_hybrid', label: 'Plug-in υβριδικό' },
  { id: 'petrol_diesel', label: 'Βενζίνη ή ντίζελ' },
];

export const RENT_FILTER_EXTRAS = [
  { id: 'extra_driver', label: 'Επιπλέον οδηγός' },
  { id: 'baby_seat', label: 'Κάθισμα βρέφους' },
  { id: 'booster_seat', label: 'Booster κάθισμα' },
  { id: 'child_seat', label: 'Παιδικό κάθισμα' },
  { id: 'gps', label: 'GPS' },
  { id: 'wifi', label: 'Wi‑Fi hotspot' },
  { id: 'snow_chains', label: 'Αλυσίδες χιονιού' },
];

export const RENT_FILTER_EXTRAS_VISIBLE = 5;

export const RENT_FILTER_LUGGAGE = [
  { id: 1, label: '1 βαλίτσα' },
  { id: 2, label: '2 βαλίτσες' },
  { id: 3, label: '3 βαλίτσες' },
  { id: 4, label: '4 βαλίτσες' },
  { id: 5, label: '5 βαλίτσες' },
];

export const EMPTY_RENT_FLEET_FILTERS = {
  locations: [],
  transmissions: [],
  fuelTypes: [],
  extras: [],
  luggage: [],
};

/** @param {unknown} raw */
export function normalizeTransmissionKey(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (!t) return '';
  if (/αυτόματο|automatic|auto\b/.test(t)) return 'automatic';
  if (/χειροκίνητο|manual|με ταχύτητες/.test(t)) return 'manual';
  return '';
}

/** @param {unknown} raw */
export function normalizeFuelTypeKey(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (!t) return '';
  if (/plug[-\s]?in|plugin|phev|plug.?in.?hybrid/.test(t)) return 'plug_in_hybrid';
  if (/fully\s*electric|ηλεκτρ|electric|\bev\b|bev\b/.test(t)) return 'electric';
  if (/υβριδ|hybrid|hev\b/.test(t)) return 'hybrid';
  if (/βενζίν|ντίζελ|πετρέλ|petrol|diesel|gasoline|gas\b|ice\b/.test(t)) {
    return 'petrol_diesel';
  }
  return '';
}

/** @param {unknown} luggage */
export function parseLuggageBags(luggage) {
  const m = String(luggage || '').match(/(\d+)/);
  if (!m) return 0;
  return Math.max(0, Math.min(8, Number(m[1]) || 0));
}

/**
 * Soft tags used by the sidebar — derived from enriched vehicle fields.
 * @param {object} vehicle
 */
export function vehicleFilterTags(vehicle) {
  const v = vehicle && typeof vehicle === 'object' ? vehicle : {};
  const transmission =
    normalizeTransmissionKey(v.transmission_key || v.transmission) || 'manual';
  const bags =
    Number(v.luggage_bags) > 0
      ? Number(v.luggage_bags)
      : parseLuggageBags(v.luggage || v.luggage_label);

  const cat = String(v.category || '').toLowerCase();
  const seats = Number(v.seating_capacity) || 0;
  const highlights = (Array.isArray(v.highlights) ? v.highlights : [])
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
  const fuelBlob = `${v.fuel || ''} ${v.fuel_type || ''} ${highlights}`;
  const fuelType =
    normalizeFuelTypeKey(fuelBlob) ||
    (/electric|ηλεκτρ/i.test(`${cat} ${v.model || ''}`) ? 'electric' : 'petrol_diesel');

  const locations = [];
  if (/van|transfer|airport/i.test(`${cat} ${highlights} ${v.model || ''}`)) {
    locations.push('airport_terminal');
  }
  if (/suv|van|airport|shuttle/i.test(`${cat} ${highlights}`)) {
    locations.push('airport_shuttle');
  }
  locations.push('other');

  const extras = new Set(['extra_driver', 'gps']);
  if (seats >= 4 || /compact|intermediate|suv|fullsize|van/.test(cat)) {
    extras.add('child_seat');
    extras.add('baby_seat');
    extras.add('booster_seat');
  }
  if (/suv|van/.test(cat) || seats >= 7) {
    extras.add('wifi');
    extras.add('snow_chains');
  }
  if (/gps/i.test(highlights)) extras.add('gps');

  return {
    transmission,
    fuelType,
    luggage_bags: bags,
    locations: [...new Set(locations)],
    extras: [...extras],
  };
}

/**
 * @param {object[]} vehicles
 * @param {typeof EMPTY_RENT_FLEET_FILTERS} filters
 */
export function applyRentFleetFilters(vehicles, filters) {
  const list = Array.isArray(vehicles) ? vehicles : [];
  const f = filters || EMPTY_RENT_FLEET_FILTERS;
  const locs = new Set(f.locations || []);
  const trans = new Set(f.transmissions || []);
  const fuels = new Set(f.fuelTypes || []);
  const extras = new Set(f.extras || []);
  const bags = new Set((f.luggage || []).map(Number));

  return list.filter((vehicle) => {
    const tags = vehicleFilterTags(vehicle);
    if (locs.size && ![...locs].some((id) => tags.locations.includes(id))) return false;
    if (trans.size && !trans.has(tags.transmission)) return false;
    if (fuels.size && !fuels.has(tags.fuelType)) return false;
    if (extras.size && ![...extras].every((id) => tags.extras.includes(id))) return false;
    if (bags.size) {
      const n = tags.luggage_bags;
      // "N bags" ⇒ at least N (large vans with "big cargo" count as 5+)
      const capacity = n > 0 ? n : /μεγάλος|cargo|φόρτωσης/i.test(String(vehicle.luggage || '')) ? 5 : 0;
      if (![...bags].some((need) => capacity >= need)) return false;
    }
    return true;
  });
}

/**
 * Counts for each option given the *other* active filters (facet counts).
 * @param {object[]} vehicles
 * @param {typeof EMPTY_RENT_FLEET_FILTERS} filters
 */
export function countRentFleetFilterFacets(vehicles, filters) {
  const base = filters || EMPTY_RENT_FLEET_FILTERS;
  const locations = {};
  for (const opt of RENT_FILTER_LOCATIONS) {
    locations[opt.id] = applyRentFleetFilters(vehicles, {
      ...base,
      locations: [opt.id],
    }).length;
  }
  const transmissions = {};
  for (const opt of RENT_FILTER_TRANSMISSIONS) {
    transmissions[opt.id] = applyRentFleetFilters(vehicles, {
      ...base,
      transmissions: [opt.id],
    }).length;
  }
  const fuelTypes = {};
  for (const opt of RENT_FILTER_FUEL_TYPES) {
    fuelTypes[opt.id] = applyRentFleetFilters(vehicles, {
      ...base,
      fuelTypes: [opt.id],
    }).length;
  }
  const extras = {};
  for (const opt of RENT_FILTER_EXTRAS) {
    extras[opt.id] = applyRentFleetFilters(vehicles, {
      ...base,
      extras: [...(base.extras || []).filter((x) => x !== opt.id), opt.id],
    }).length;
  }
  const luggage = {};
  for (const opt of RENT_FILTER_LUGGAGE) {
    luggage[opt.id] = applyRentFleetFilters(vehicles, {
      ...base,
      luggage: [opt.id],
    }).length;
  }
  return { locations, transmissions, fuelTypes, extras, luggage };
}

export function rentFleetFiltersActive(filters) {
  const f = filters || EMPTY_RENT_FLEET_FILTERS;
  return Boolean(
    (f.locations && f.locations.length) ||
      (f.transmissions && f.transmissions.length) ||
      (f.fuelTypes && f.fuelTypes.length) ||
      (f.extras && f.extras.length) ||
      (f.luggage && f.luggage.length),
  );
}

export function toggleRentFilterValue(list, value) {
  const cur = Array.isArray(list) ? list : [];
  return cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
}
