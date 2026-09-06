/**
 * Default airport buffer rules (minutes) for connection planning.
 * Operators can override per trip via trip.airportBuffers.
 */

export const DEFAULT_AIRPORT_BUFFERS = {
  ATH: 45,
  SKG: 30,
  HER: 35,
  RHO: 35,
  CFU: 30,
  ZTH: 30,
  JMK: 25,
  JTR: 25,
  CHQ: 30,
  KLX: 25,
  LHR: 60,
  LGW: 55,
  STN: 50,
  CDG: 60,
  FCO: 50,
  MUC: 45,
  FRA: 55,
  IST: 50,
  AYT: 40,
};

export function resolveAirportBuffer(airportCode, overrides = {}) {
  const code = String(airportCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 3);
  if (!code) return 0;
  const custom = overrides?.[code];
  if (custom != null && custom !== '') return Math.max(0, Number(custom) || 0);
  return DEFAULT_AIRPORT_BUFFERS[code] ?? 40;
}

/** Effective connection threshold = max(baseThreshold, arrivalAirportBuffer). */
export function effectiveConnectionThreshold({
  baseThreshold = 90,
  arrivalAirport,
  airportBuffers = {},
} = {}) {
  const buffer = resolveAirportBuffer(arrivalAirport, airportBuffers);
  return Math.max(Number(baseThreshold) || 90, buffer);
}

export function listAirportBufferRows(overrides = {}) {
  const codes = new Set([
    ...Object.keys(DEFAULT_AIRPORT_BUFFERS),
    ...Object.keys(overrides || {}),
  ]);
  return [...codes]
    .sort()
    .map((code) => ({
      code,
      minutes: resolveAirportBuffer(code, overrides),
      isCustom: overrides?.[code] != null && overrides?.[code] !== '',
    }));
}
