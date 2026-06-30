import { getLayoutForVehicle, VEHICLE_LAYOUTS } from './busLayouts.js';

export const LAYOUT_OPTIONS = Object.values(VEHICLE_LAYOUTS).map((l) => ({
  id: l.id,
  label: l.label,
}));

export const DEFAULT_ASIDE_PANEL = {
  show_trip_card: true,
  show_legend: true,
  show_pricing: true,
  show_amenities: true,
  show_availability: true,
  show_vehicle_photo: false,
  show_route_stops: false,
  show_tips: true,
  show_deposit_note: true,
  show_selected_seats: true,
  trip_card_title: 'Η εκδρομή σας',
  amenities_title: 'Παροχές onboard',
  standard_amenities_label: 'Standard',
  vip_amenities_label: '',
  vehicle_image_url: '',
  route_stops: [],
  tips: [],
  legend_hint: '',
  deposit_note: '',
  availability_label: '',
};

export const DEFAULT_LAYOUT_PRICING = {
  show_popup: true,
  standard_mode: 'trip_price',
  standard_price_eur: null,
  vip_mode: 'markup',
  vip_price_eur: null,
  vip_markup_pct: 25,
  standard_amenities: ['Κλιματισμός', 'USB θύρες', 'Αποσκευές κάτω από θέση'],
  vip_amenities: [
    'Extra legroom',
    'USB & 220V',
    'Ανακλινόμενα leather seats',
    'Προτεραιότητα επιβίβασης',
  ],
  seat_overrides: {},
  aside_panel: { ...DEFAULT_ASIDE_PANEL },
};

export const DEFAULT_SEAT_PRICING = {
  layouts: {
    'luxury-coach': { ...DEFAULT_LAYOUT_PRICING },
    'premium-express': {
      ...DEFAULT_LAYOUT_PRICING,
      vip_markup_pct: 15,
      vip_amenities: ['Extra legroom', 'USB θύρες', 'Ψυγείο nearby'],
    },
    'vip-minibus': {
      ...DEFAULT_LAYOUT_PRICING,
      vip_markup_pct: 20,
      standard_amenities: ['Κλιματισμός', 'Premium audio'],
      vip_amenities: ['Front row panorama', 'USB & 220V', 'Welcome drink'],
      aside_panel: {
        ...DEFAULT_ASIDE_PANEL,
        show_vehicle_photo: true,
        tips: ['Ιδανικό για μικρές ομάδες', 'Οι μπροστινές θέσεις έχουν πανοραμική θέα'],
        deposit_note: 'Προκαταβολή {percent}% online · υπόλοιπο κατά την επιβίβαση.',
      },
    },
  },
};

export function getLayoutIdForTrip(trip) {
  return getLayoutForVehicle(trip?.vehicleType).id;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function parseOverridePrice(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return roundMoney(raw);
  if (typeof raw === 'object' && raw.price_eur != null) return roundMoney(raw.price_eur);
  const n = Number(raw);
  return Number.isFinite(n) ? roundMoney(n) : null;
}

function parseOverrideAmenities(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && Array.isArray(raw.amenities)) {
    return raw.amenities.filter(Boolean).map(String);
  }
  return null;
}

/** @param {object} seat @param {object} layoutConfig @param {number} tripBasePrice */
export function resolveSeatOffer(seat, layoutConfig, tripBasePrice) {
  const cfg = layoutConfig || DEFAULT_LAYOUT_PRICING;
  const base = roundMoney(tripBasePrice || 0);
  const override = cfg.seat_overrides?.[seat.number] ?? cfg.seat_overrides?.[seat.number?.toUpperCase()];

  let price = base;
  const overridePrice = override != null ? parseOverridePrice(override) : null;
  if (overridePrice != null) {
    price = overridePrice;
  } else if (seat.isVip) {
    if (cfg.vip_mode === 'fixed' && cfg.vip_price_eur != null) {
      price = roundMoney(cfg.vip_price_eur);
    } else if (cfg.vip_mode === 'markup') {
      const pct = Number(cfg.vip_markup_pct) || 0;
      price = roundMoney(base * (1 + pct / 100));
    } else {
      price = base;
    }
  } else if (cfg.standard_mode === 'fixed' && cfg.standard_price_eur != null) {
    price = roundMoney(cfg.standard_price_eur);
  } else {
    price = base;
  }

  let amenities =
    parseOverrideAmenities(override) ??
    (seat.isVip ? cfg.vip_amenities : cfg.standard_amenities) ??
    [];
  amenities = [...amenities].filter(Boolean);

  return {
    priceEur: price,
    amenities,
    tier: seat.isVip ? 'vip' : 'standard',
    showPopup: cfg.show_popup !== false,
  };
}

/** @param {object[]} seats @param {object} layoutConfig @param {number} tripBasePrice */
export function enrichSeatsWithPricing(seats, layoutConfig, tripBasePrice) {
  return seats.map((seat) => {
    const offer = resolveSeatOffer(seat, layoutConfig, tripBasePrice);
    return {
      ...seat,
      priceEur: offer.priceEur,
      amenities: offer.amenities,
      tier: offer.tier,
    };
  });
}

export function sumSelectedSeatPrices(seats, selectedIds) {
  return roundMoney(
    seats.filter((s) => selectedIds.includes(s.id)).reduce((sum, s) => sum + (s.priceEur || 0), 0),
  );
}

export function parseSeatOverridesText(text) {
  const overrides = {};
  String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const eqIdx = line.indexOf('=');
      if (eqIdx < 0) return;
      const key = line.slice(0, eqIdx).trim().toUpperCase();
      if (!key) return;

      const rest = line.slice(eqIdx + 1).trim();
      const pipeIdx = rest.indexOf('|');
      const pricePart = pipeIdx >= 0 ? rest.slice(0, pipeIdx).trim() : rest;
      const amenitiesPart = pipeIdx >= 0 ? rest.slice(pipeIdx + 1).trim() : '';

      const entry = {};
      if (pricePart !== '') {
        const price = Number(pricePart);
        if (Number.isFinite(price)) entry.price_eur = roundMoney(price);
      }
      if (amenitiesPart) {
        entry.amenities = amenitiesPart
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean);
      }
      if (entry.price_eur != null || entry.amenities?.length) {
        overrides[key] = entry;
      }
    });
  return overrides;
}

export function formatSeatOverridesText(overrides = {}) {
  return Object.entries(overrides)
    .map(([seat, val]) => {
      const price = parseOverridePrice(val);
      const amenities = parseOverrideAmenities(val);
      if (price == null && !amenities?.length) return null;

      let line = `${seat}=`;
      if (price != null) line += price;
      if (amenities?.length) line += `|${amenities.join(', ')}`;
      return line;
    })
    .filter(Boolean)
    .join('\n');
}

export function amenitiesToText(list) {
  return (list || []).join('\n');
}

export function textToAmenities(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function normalizeAsidePanel(raw = {}) {
  const merged = { ...DEFAULT_ASIDE_PANEL, ...raw };
  merged.show_trip_card = merged.show_trip_card !== false;
  merged.show_legend = merged.show_legend !== false;
  merged.show_pricing = merged.show_pricing !== false;
  merged.show_amenities = merged.show_amenities !== false;
  merged.show_availability = merged.show_availability !== false;
  merged.show_vehicle_photo = Boolean(merged.show_vehicle_photo);
  merged.show_route_stops = Boolean(merged.show_route_stops);
  merged.show_tips = merged.show_tips !== false;
  merged.show_deposit_note = merged.show_deposit_note !== false;
  merged.show_selected_seats = merged.show_selected_seats !== false;
  merged.trip_card_title = String(merged.trip_card_title || DEFAULT_ASIDE_PANEL.trip_card_title).trim();
  merged.amenities_title = String(merged.amenities_title || DEFAULT_ASIDE_PANEL.amenities_title).trim();
  merged.standard_amenities_label = String(
    merged.standard_amenities_label || DEFAULT_ASIDE_PANEL.standard_amenities_label,
  ).trim();
  merged.vip_amenities_label = String(merged.vip_amenities_label || '').trim();
  merged.vehicle_image_url = String(merged.vehicle_image_url || '').trim();
  merged.legend_hint = String(merged.legend_hint || '').trim();
  merged.deposit_note = String(merged.deposit_note || '').trim();
  merged.availability_label = String(merged.availability_label || '').trim();
  merged.route_stops = Array.isArray(merged.route_stops)
    ? merged.route_stops.map((s) => String(s).trim()).filter(Boolean)
    : textToAmenities(merged.route_stops);
  merged.tips = Array.isArray(merged.tips)
    ? merged.tips.map((s) => String(s).trim()).filter(Boolean)
    : textToAmenities(merged.tips);
  return merged;
}

/** @param {object} layoutConfig */
export function resolveAsidePanel(layoutConfig) {
  return normalizeAsidePanel(layoutConfig?.aside_panel);
}

/** @param {string} template @param {{ count?: number, percent?: number }} vars */
export function fillPanelTemplate(template, vars = {}) {
  return String(template || '')
    .replace(/\{count\}/g, String(vars.count ?? ''))
    .replace(/\{percent\}/g, String(vars.percent ?? ''));
}

export function parseRouteStopLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;
  const pipeIdx = raw.indexOf('|');
  if (pipeIdx >= 0) {
    return {
      time: raw.slice(0, pipeIdx).trim(),
      label: raw.slice(pipeIdx + 1).trim(),
    };
  }
  const match = raw.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
  if (match) return { time: match[1], label: match[2] };
  return { time: '', label: raw };
}
