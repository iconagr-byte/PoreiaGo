import { API_BASE } from '../config/api.js';
import { adminFetch } from './adminApi.js';
import { mergeAgencyPlanCatalog } from '../lib/billing/planCatalog.js';

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  const detail = err.detail;
  if (typeof detail === 'string' && detail.trim()) throw new Error(detail);
  if (Array.isArray(detail) && detail.length) {
    const msg = detail
      .map((d) => d?.msg || d?.message || JSON.stringify(d))
      .filter(Boolean)
      .join('; ');
    throw new Error(msg || res.statusText || 'Request failed');
  }
  throw new Error(res.statusText || `Σφάλμα αποθήκευσης (${res.status})`);
}

export async function fetchPublicAgencyPlanCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/site/agency-plan-catalog`);
    if (res.ok) return mergeAgencyPlanCatalog(await res.json());
  } catch {
    /* offline */
  }
  return mergeAgencyPlanCatalog(null);
}

export async function fetchAdminAgencyPlanCatalog() {
  const res = await adminFetch('/api/admin/platform/agency-plan-catalog');
  if (!res.ok) await parseError(res);
  return mergeAgencyPlanCatalog(await res.json());
}

export async function updateAgencyPlanCatalog(patch) {
  const res = await adminFetch('/api/admin/platform/agency-plan-catalog', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseError(res);
  return mergeAgencyPlanCatalog(await res.json());
}
