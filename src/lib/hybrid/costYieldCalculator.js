/**
 * Auto-cost & yield calculator — aggregates ground + flight PNR costs
 * and recommends per-person pricing for a target margin.
 */
import { convertAmount, DEFAULT_FX_TO_EUR, normalizeCurrency } from '../currency/multiCurrency.js';

export function calculateTripYield({
  flights = [],
  segments = [],
  passengerCount = 1,
  targetMarginPct = 25,
  displayCurrency = 'EUR',
  fxRatesToEur = DEFAULT_FX_TO_EUR,
} = {}) {
  const display = normalizeCurrency(displayCurrency);
  const rates = { ...DEFAULT_FX_TO_EUR, ...(fxRatesToEur || {}) };

  const flightCost = (flights || []).reduce(
    (sum, f) => sum + convertAmount(f.total_cost ?? f.totalCost ?? 0, f.currency || 'EUR', display, rates),
    0,
  );
  const groundCost = (segments || []).reduce(
    (sum, s) => sum + convertAmount(s.ground_cost ?? s.groundCost ?? 0, s.currency || 'EUR', display, rates),
    0,
  );
  const totalCost = flightCost + groundCost;
  const pax = Math.max(Number(passengerCount) || 1, 1);
  const margin = Math.max(Number(targetMarginPct) || 0, 0);
  const targetRevenue = totalCost * (1 + margin / 100);
  const recommended = targetRevenue / pax;

  return {
    passengerCount: pax,
    targetMarginPct: margin,
    displayCurrency: display,
    flightCost: round2(flightCost),
    groundCost: round2(groundCost),
    totalCost: round2(totalCost),
    targetRevenue: round2(targetRevenue),
    recommendedPricePerPerson: round2(recommended),
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function newClientId(prefix = 'seg') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
