/**
 * Live FX rates via Frankfurter (ECB) — free, no API key.
 * Falls back to DEFAULT_FX_TO_EUR on failure / offline.
 */
import { DEFAULT_FX_TO_EUR, normalizeCurrency } from '../currency/multiCurrency.js';

const CACHE_KEY = 'poreiago_fx_to_eur_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!raw?.rates || !raw?.fetchedAt) return null;
    if (Date.now() - raw.fetchedAt > CACHE_TTL_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeCache(rates, source) {
  const payload = { rates, source, fetchedAt: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  return payload;
}

/** Convert Frankfurter EUR-base rates (1 EUR = X CUR) → UNIT→EUR multipliers. */
function toEurMultipliers(eurBaseRates) {
  const out = { EUR: 1 };
  for (const [code, perEur] of Object.entries(eurBaseRates || {})) {
    const n = Number(perEur);
    if (n > 0) out[normalizeCurrency(code)] = 1 / n;
  }
  return out;
}

export async function fetchLiveFxToEur(currencies = Object.keys(DEFAULT_FX_TO_EUR)) {
  const cached = readCache();
  if (cached) return { ...cached, fromCache: true };

  const wanted = currencies
    .map((c) => normalizeCurrency(c))
    .filter((c) => c !== 'EUR')
    .join(',');
  const url = `https://api.frankfurter.app/latest?from=EUR&to=${encodeURIComponent(wanted)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const data = await res.json();
    const rates = { ...DEFAULT_FX_TO_EUR, ...toEurMultipliers(data.rates || {}) };
    return { ...writeCache(rates, 'frankfurter'), fromCache: false };
  } catch (err) {
    return {
      rates: { ...DEFAULT_FX_TO_EUR },
      source: 'fallback',
      fetchedAt: Date.now(),
      fromCache: false,
      error: err?.message || String(err),
    };
  }
}

export function getCachedFxToEur() {
  return readCache()?.rates || { ...DEFAULT_FX_TO_EUR };
}
