import { API_BASE } from '../config/api.js';

import { DEFAULT_BANK_TRANSFER_SETTINGS, normalizeBankTransferSettings } from '../lib/payments/bankTransfer.js';
import { fetchCheckoutPaymentBundle } from './paymentSettingsApi.js';

const STORAGE_KEY = 'aerostride_checkout_settings_v1';

export const DEFAULT_CHECKOUT_SETTINGS = {
  checkout_deposit_enabled: true,
  checkout_deposit_percent: 30,
  ...DEFAULT_BANK_TRANSFER_SETTINGS,
};

function cacheLocally(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

function loadCached() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_CHECKOUT_SETTINGS, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function normalizeCheckoutSettings(raw = {}) {
  const enabled =
    raw.checkout_deposit_enabled !== undefined
      ? Boolean(raw.checkout_deposit_enabled)
      : DEFAULT_CHECKOUT_SETTINGS.checkout_deposit_enabled;
  let pct = parseInt(String(raw.checkout_deposit_percent ?? 30), 10);
  if (!Number.isFinite(pct)) pct = DEFAULT_CHECKOUT_SETTINGS.checkout_deposit_percent;
  pct = Math.max(5, Math.min(90, pct));
  return {
    checkout_deposit_enabled: enabled,
    checkout_deposit_percent: pct,
    ...normalizeBankTransferSettings(raw),
  };
}

/** Public B2C — deposit rules for checkout (no admin auth). */
export async function fetchCheckoutSettings() {
  try {
    const bundle = await fetchCheckoutPaymentBundle();
    const data = normalizeCheckoutSettings(bundle);
    cacheLocally(data);
    return { ...data, paymentSettings: bundle.paymentSettings };
  } catch {
    /* offline */
  }
  try {
    const platform = localStorage.getItem('aerostride_platform_settings');
    if (platform) {
      return normalizeCheckoutSettings(JSON.parse(platform));
    }
  } catch {
    /* ignore */
  }
  return normalizeCheckoutSettings(loadCached() || DEFAULT_CHECKOUT_SETTINGS);
}
