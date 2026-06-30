import { API_BASE } from '../config/api.js';
import { adminFetch } from './adminApi.js';
import {
  DEFAULT_PAYMENT_SETTINGS,
  normalizePaymentSettings,
  toLegacyCheckoutShape,
} from '../lib/payments/paymentSettings.js';

const STORAGE_KEY = 'aerostride_payment_settings_v1';

function cache(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

function loadCached() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizePaymentSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.detail || res.statusText || 'Request failed');
}

export async function fetchPublicPaymentSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/site/payment-settings`);
    if (res.ok) {
      const data = normalizePaymentSettings(await res.json());
      cache(data);
      return data;
    }
  } catch {
    /* offline */
  }
  return loadCached() || normalizePaymentSettings(DEFAULT_PAYMENT_SETTINGS);
}

export async function fetchAdminPaymentSettings() {
  const res = await adminFetch('/api/admin/platform/payment-settings');
  if (!res.ok) await parseError(res);
  const data = normalizePaymentSettings(await res.json());
  cache(data);
  return data;
}

export async function updatePaymentSettings(patch) {
  const res = await adminFetch('/api/admin/platform/payment-settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseError(res);
  const data = normalizePaymentSettings(await res.json());
  cache(data);
  return data;
}

export async function createBankAccount(payload) {
  const res = await adminFetch('/api/admin/platform/bank-accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res);
  await fetchAdminPaymentSettings();
  return res.json();
}

export async function updateBankAccount(accountId, payload) {
  const res = await adminFetch(`/api/admin/platform/bank-accounts/${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res);
  await fetchAdminPaymentSettings();
  return res.json();
}

export async function deleteBankAccount(accountId) {
  const res = await adminFetch(`/api/admin/platform/bank-accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await parseError(res);
  const data = normalizePaymentSettings(await res.json());
  cache(data);
  return data;
}

export async function fetchPaymentAuditLog(limit = 50) {
  const res = await adminFetch(`/api/admin/platform/payment-audit?limit=${limit}`);
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function downloadPaymentAuditCsv({ limit = 200, fiscalOnly = false } = {}) {
  const q = new URLSearchParams({ limit: String(limit), fiscal_only: fiscalOnly ? 'true' : 'false' });
  const res = await adminFetch(`/api/admin/platform/payment-audit/export?${q}`);
  if (!res.ok) await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fiscalOnly ? 'payment-audit-fiscal.csv' : 'payment-audit-payments.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export async function confirmBankDepositSecure(bookingId, payload) {
  const res = await adminFetch(
    `/api/admin/platform/bookings/${encodeURIComponent(bookingId)}/confirm-bank-deposit`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function recordCashPaymentSecure(bookingId, payload) {
  const res = await adminFetch(
    `/api/admin/platform/bookings/${encodeURIComponent(bookingId)}/record-cash-payment`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

/** Legacy checkout consumers — deposit + default bank flattened. */
export async function fetchCheckoutPaymentBundle() {
  const settings = await fetchPublicPaymentSettings();
  return toLegacyCheckoutShape(settings);
}
