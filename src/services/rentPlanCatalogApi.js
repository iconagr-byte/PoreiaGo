import { API_BASE } from '../config/api.js';
import { adminFetch } from './adminApi.js';
import { mergeRentPlanCatalog } from '../lib/billing/planCatalog.js';

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  const detail = err.detail;
  throw new Error(
    typeof detail === 'string' ? detail : res.statusText || 'Request failed',
  );
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
