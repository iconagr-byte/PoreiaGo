/**
 * Admin Miles+Bonus (loyalty) API client.
 */
import { adminFetch } from './adminApi.js';

const BASE = '/api/admin/platform/loyalty';

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  let detail = err.detail ?? res.statusText ?? 'Request failed';
  if (Array.isArray(detail)) {
    detail = detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
  } else if (typeof detail === 'object' && detail) {
    detail = JSON.stringify(detail);
  }
  throw new Error(String(detail));
}

async function jsonOrThrow(res) {
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function fetchLoyaltyMeta() {
  const res = await adminFetch(`${BASE}/meta`);
  return jsonOrThrow(res);
}

export async function fetchLoyaltyAccounts() {
  const res = await adminFetch(`${BASE}/accounts`);
  const data = await jsonOrThrow(res);
  return Array.isArray(data.items) ? data.items : [];
}

export async function createLoyaltyAccount(body) {
  const res = await adminFetch(`${BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return jsonOrThrow(res);
}

export async function updateLoyaltyAccount(accountId, body) {
  const res = await adminFetch(`${BASE}/accounts/${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return jsonOrThrow(res);
}

export async function deleteLoyaltyAccount(accountId) {
  const res = await adminFetch(`${BASE}/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
  return jsonOrThrow(res);
}

export async function fetchLoyaltyTransactions(accountId) {
  const res = await adminFetch(
    `${BASE}/accounts/${encodeURIComponent(accountId)}/transactions`,
  );
  const data = await jsonOrThrow(res);
  return Array.isArray(data.items) ? data.items : [];
}

export async function postLoyaltyTransaction(body) {
  const res = await adminFetch(`${BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return jsonOrThrow(res);
}

export const LOYALTY_TIER_LABELS = {
  STANDARD: 'Standard',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
};

export const LOYALTY_TX_LABELS = {
  EARN: 'Κέρδος',
  REDEEM: 'Εξαργύρωση',
  ADJUST: 'Διόρθωση',
  EXPIRE: 'Λήξη',
};
