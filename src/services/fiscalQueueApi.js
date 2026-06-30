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

export async function fetchFiscalQueue(limit = 100) {
  const res = await adminFetch(`/api/admin/platform/fiscal-queue?limit=${limit}`);
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function fetchFiscalStats(days = 30) {
  const res = await adminFetch(`/api/admin/platform/fiscal-stats?days=${days}`);
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function downloadFiscalInvoicesCsv({ days = 90, status = '' } = {}) {
  const q = new URLSearchParams({ days: String(days) });
  if (status) q.set('status', status);
  const res = await adminFetch(`/api/admin/platform/fiscal-invoices/export?${q}`);
  if (!res.ok) await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = status ? `fiscal-invoices-${status}.csv` : 'fiscal-invoices-all.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchFiscalReconciliation({ days = 90, onlyGaps = true, limit = 100 } = {}) {
  const q = new URLSearchParams({
    days: String(days),
    only_gaps: onlyGaps ? 'true' : 'false',
    limit: String(limit),
  });
  const res = await adminFetch(`/api/admin/platform/fiscal-reconciliation?${q}`);
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function downloadFiscalReconciliationCsv({ days = 90, onlyGaps = false } = {}) {
  const q = new URLSearchParams({
    days: String(days),
    only_gaps: onlyGaps ? 'true' : 'false',
  });
  const res = await adminFetch(`/api/admin/platform/fiscal-reconciliation/export?${q}`);
  if (!res.ok) await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = onlyGaps ? 'fiscal-reconciliation-gaps.csv' : 'fiscal-reconciliation-all.csv';
  link.click();
  URL.revokeObjectURL(url);
}
