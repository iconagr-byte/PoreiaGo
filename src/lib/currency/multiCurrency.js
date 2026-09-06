/**
 * Multi-currency formatting & conversion helpers for hybrid trips / invoicing.
 * Rates are EUR-based placeholders; replace with live FX feed when available.
 */

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'TRY', 'ALL', 'MKD'];

/** Approx mid-market rates → EUR (1 UNIT = rate EUR). */
export const DEFAULT_FX_TO_EUR = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  CHF: 1.05,
  TRY: 0.028,
  ALL: 0.01,
  MKD: 0.016,
};

export function normalizeCurrency(code, fallback = 'EUR') {
  const c = String(code || fallback).trim().toUpperCase();
  return c.length === 3 ? c : fallback;
}

export function convertAmount(amount, fromCurrency, toCurrency, rates = DEFAULT_FX_TO_EUR) {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  const n = Number(amount) || 0;
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;
  const eur = n * fromRate;
  return toRate ? eur / toRate : eur;
}

export function formatMoney(amount, currency = 'EUR', locale = 'el-GR') {
  const cur = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${(Number(amount) || 0).toFixed(2)} ${cur}`;
  }
}
