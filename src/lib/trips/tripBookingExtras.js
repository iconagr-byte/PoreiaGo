/**
 * Bookable trip extras / υπηρεσίες εκδρομής (after seat selection).
 * Office catalog lives on site appearance → trip_extra_options.
 */

export const TRIP_EXTRA_ICON_OPTIONS = [
  'restaurant',
  'shield_with_heart',
  'luggage',
  'tour_guide',
  'museum',
  'local_cafe',
  'hotel',
  'directions_bus',
  'child_care',
  'photo_camera',
  'spa',
  'celebration',
];

/** Sensible starter catalog for small offices (3–6 items). */
export const DEFAULT_TRIP_EXTRA_OPTIONS = [
  {
    id: 'travel_insurance',
    icon: 'shield_with_heart',
    title: 'Ασφάλεια ταξιδιού',
    blurb: 'Βασική κάλυψη ακύρωσης και ιατρικών εξόδων για την εκδρομή.',
    includes: ['Ιατρικά έξοδα', 'Ακύρωση ταξιδιού'],
    eur: 8,
    priceMode: 'per_person',
    formKey: 'travel_insurance',
  },
  {
    id: 'meal_pack',
    icon: 'restaurant',
    title: 'Πακέτο γεύματος',
    blurb: 'Γεύμα στη διαδρομή ή στον προορισμό — χωρίς ουρές.',
    includes: ['Κυρίως πιάτο', 'Νερό'],
    eur: 12,
    priceMode: 'per_person',
    formKey: 'meal_pack',
  },
  {
    id: 'extra_luggage',
    icon: 'luggage',
    title: 'Επιπλέον αποσκευή',
    blurb: 'Μεγάλη βαλίτσα ή δεύτερη αποσκευή στο χώρο αποσκευών.',
    includes: ['1 μεγάλη αποσκευή'],
    eur: 5,
    priceMode: 'per_booking',
    formKey: 'extra_luggage',
  },
  {
    id: 'guided_tour',
    icon: 'tour_guide',
    title: 'Ξενάγηση',
    blurb: 'Τοπικός ξεναγός στον προορισμό — μικρή ομάδα.',
    includes: ['Ξενάγηση 1–2 ώρες'],
    eur: 15,
    priceMode: 'per_person',
    formKey: 'guided_tour',
  },
];

const MAX_OPTIONS = 8;

function slugFormKey(raw, fallback = 'extra') {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || fallback;
}

export function createTripExtraOption(partial = {}) {
  const id =
    String(partial.id || '').trim() ||
    `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const formKey = slugFormKey(partial.formKey || partial.id || id, `extra_${id.slice(-6)}`);
  const includes = Array.isArray(partial.includes)
    ? partial.includes.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const price = Number(partial.eur ?? partial.priceEur ?? partial.eurPerDay);
  const mode = String(partial.priceMode || 'per_person').toLowerCase() === 'per_booking'
    ? 'per_booking'
    : 'per_person';
  return {
    id,
    icon: String(partial.icon || 'verified_user').trim() || 'verified_user',
    title: String(partial.title || '').trim(),
    blurb: String(partial.blurb || '').trim(),
    includes,
    eur: Number.isFinite(price) ? Math.max(0, price) : 0,
    priceMode: mode,
    formKey,
    visible: partial.visible !== false,
  };
}

/** Merge tenant overrides with defaults when empty/invalid. */
export function normalizeTripExtraOptions(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    return DEFAULT_TRIP_EXTRA_OPTIONS.map((o) => createTripExtraOption(o));
  }
  const seenKeys = new Set();
  const out = [];
  for (const item of raw) {
    const opt = createTripExtraOption(item || {});
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
    if (out.length >= MAX_OPTIONS) break;
  }
  return out.length ? out : DEFAULT_TRIP_EXTRA_OPTIONS.map((o) => createTripExtraOption(o));
}

export function visibleTripExtraOptions(rawOrList) {
  return normalizeTripExtraOptions(rawOrList).filter((o) => o.visible !== false);
}

export function readTripExtrasCatalog(appearance) {
  return {
    options: normalizeTripExtraOptions(appearance?.trip_extra_options),
  };
}

export function emptyTripExtrasSelection(catalog) {
  const out = {};
  for (const opt of visibleTripExtraOptions(catalog)) {
    out[opt.formKey] = false;
  }
  return out;
}

export function readTripExtrasSelection(stored = {}, catalog) {
  const base = emptyTripExtrasSelection(catalog);
  for (const key of Object.keys(base)) {
    if (stored?.[key]) base[key] = true;
  }
  // Also accept pending.extrasSelection keys
  if (stored && typeof stored === 'object') {
    for (const [k, v] of Object.entries(stored)) {
      if (k in base) base[k] = Boolean(v);
    }
  }
  return base;
}

export function seatCountFromPending(pending) {
  if (!pending) return 1;
  if (Array.isArray(pending.seatBreakdown) && pending.seatBreakdown.length) {
    return pending.seatBreakdown.length;
  }
  const fromSeats = String(pending.seats || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length;
  return Math.max(1, fromSeats || 1);
}

export function lineTotalForExtra(opt, seatCount) {
  const unit = Number(opt?.eur) || 0;
  if (opt?.priceMode === 'per_booking') return Math.round(unit * 100) / 100;
  const qty = Math.max(1, Number(seatCount) || 1);
  return Math.round(unit * qty * 100) / 100;
}

/** Selected lines for checkout / booking persistence. */
export function buildTripExtrasLines(selection, catalog, seatCount) {
  const visible = visibleTripExtraOptions(catalog);
  const qtySeats = Math.max(1, Number(seatCount) || 1);
  const lines = [];
  for (const opt of visible) {
    if (!selection?.[opt.formKey]) continue;
    const qty = opt.priceMode === 'per_booking' ? 1 : qtySeats;
    const lineTotalEur = lineTotalForExtra(opt, qtySeats);
    lines.push({
      id: opt.id,
      formKey: opt.formKey,
      title: opt.title,
      icon: opt.icon,
      unitPriceEur: Number(opt.eur) || 0,
      priceMode: opt.priceMode,
      qty,
      lineTotalEur,
    });
  }
  return lines;
}

export function tripExtrasTotal(selection, catalog, seatCount) {
  return buildTripExtrasLines(selection, catalog, seatCount).reduce(
    (sum, line) => sum + (Number(line.lineTotalEur) || 0),
    0,
  );
}

export function selectedTripExtrasLabels(selection, catalog) {
  return visibleTripExtraOptions(catalog)
    .filter((o) => selection?.[o.formKey])
    .map((o) => o.title);
}

export function euroLabel(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '€0';
  return `€${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

export function priceModeLabel(mode) {
  return mode === 'per_booking' ? 'ανά κράτηση' : 'ανά άτομο';
}

/** Build pendingCheckout patch after extras step. */
export function applyExtrasToPending(pending, selection, catalog) {
  const seatSubtotal = Number(pending?.seatSubtotal ?? pending?.total) || 0;
  const seats = Math.max(1, seatCountFromPending(pending));
  const extras = buildTripExtrasLines(selection, catalog, seats);
  const extrasTotal = extras.reduce((s, l) => s + (Number(l.lineTotalEur) || 0), 0);
  const total = Math.round((seatSubtotal + extrasTotal) * 100) / 100;
  return {
    ...pending,
    seatSubtotal,
    extrasSelection: selection,
    extras,
    extrasTotal: Math.round(extrasTotal * 100) / 100,
    total,
  };
}
