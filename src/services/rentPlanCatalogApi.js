import { API_BASE } from '../config/api.js';
import { adminFetch } from './adminApi.js';
import { mergeRentPlanCatalog } from '../lib/billing/planCatalog.js';

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  const detail = err.detail;
  if (typeof detail === 'string' && detail.trim()) {
    throw new Error(detail);
  }
  if (Array.isArray(detail) && detail.length) {
    const msg = detail
      .map((d) => d?.msg || d?.message || JSON.stringify(d))
      .filter(Boolean)
      .join('; ');
    throw new Error(msg || res.statusText || 'Request failed');
  }
  throw new Error(res.statusText || `Σφάλμα αποθήκευσης (${res.status})`);
}

export async function fetchPublicRentPlanCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/site/rent-plan-catalog`);
    if (res.ok) {
      return mergeRentPlanCatalog(await res.json());
    }
  } catch {
    /* offline / CORS — fall through to defaults */
  }
  return mergeRentPlanCatalog(null);
}

export async function fetchAdminRentPlanCatalog() {
  const res = await adminFetch('/api/admin/platform/rent-plan-catalog');
  if (!res.ok) await parseError(res);
  return mergeRentPlanCatalog(await res.json());
}

export async function updateRentPlanCatalog(patch) {
  const res = await adminFetch('/api/admin/platform/rent-plan-catalog', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseError(res);
  return mergeRentPlanCatalog(await res.json());
}
