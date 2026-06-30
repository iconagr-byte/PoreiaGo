import { adminFetch } from './adminApi.js';

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  let detail = err.detail ?? res.statusText ?? 'Request failed';
  if (Array.isArray(detail)) {
    detail = detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
  } else if (typeof detail === 'object') {
    detail = JSON.stringify(detail);
  }
  throw new Error(String(detail));
}

/** List bookings from Postgres (BackOffice source of truth). */
export async function fetchAdminBookings() {
  const res = await adminFetch('/api/admin/platform/bookings');
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function fetchAdminBooking(bookingId) {
  const res = await adminFetch(`/api/admin/platform/bookings/${encodeURIComponent(bookingId)}`);
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function patchAdminBooking(bookingId, patch) {
  const res = await adminFetch(`/api/admin/platform/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function cancelAdminBooking(bookingId) {
  const res = await adminFetch(
    `/api/admin/platform/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: 'POST' },
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function retryFiscalInvoice(invoiceId) {
  const res = await adminFetch(
    `/api/admin/platform/fiscal-invoices/${encodeURIComponent(invoiceId)}/retry`,
    { method: 'POST' },
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function issueFiscalReceipt(bookingId) {
  const res = await adminFetch(
    `/api/admin/platform/bookings/${encodeURIComponent(bookingId)}/issue-fiscal`,
    { method: 'POST' },
  );
  if (!res.ok) await parseError(res);
  return res.json();
}
