/**
 * Office CRM customers — server-backed (tenant JWT).
 * Falls back gracefully when offline; local cache remains in customerStore.
 */
import { adminFetch } from './adminApi.js';

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

export async function fetchOfficeCustomers(serviceScope) {
  const q = serviceScope ? `?serviceScope=${encodeURIComponent(serviceScope)}` : '';
  const res = await adminFetch(`/api/admin/platform/customers${q}`, { retries: 3 });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return Array.isArray(data?.customers) ? data.customers : Array.isArray(data) ? data : [];
}

export async function createOfficeCustomer(payload) {
  const res = await adminFetch('/api/admin/platform/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function updateOfficeCustomer(customerId, payload) {
  const res = await adminFetch(
    `/api/admin/platform/customers/${encodeURIComponent(customerId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deleteOfficeCustomer(customerId, serviceScope) {
  const q = serviceScope ? `?serviceScope=${encodeURIComponent(serviceScope)}` : '';
  const res = await adminFetch(
    `/api/admin/platform/customers/${encodeURIComponent(customerId)}${q}`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 204) await parseError(res);
  return true;
}

/** Push local CRM snapshot to server (one-shot migration / reconcile). */
export async function replaceOfficeCustomers(customers) {
  const res = await adminFetch('/api/admin/platform/customers/replace', {
    method: 'POST',
    body: JSON.stringify({ customers: customers || [] }),
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return Array.isArray(data?.customers) ? data.customers : [];
}
