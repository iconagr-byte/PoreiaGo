import { getSaasToken, saasFetch } from './saasApi.js';

export async function fetchPlatformOverview() {
  return saasFetch('/api/v1/platform/overview');
}

export async function fetchPlatformHealth() {
  return saasFetch('/api/v1/platform/health');
}

export async function fetchPlatformTenants({ offset = 0, limit = 50, q, isActive, plan } = {}) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (q) params.set('q', q);
  if (isActive !== undefined && isActive !== null && isActive !== '') {
    params.set('is_active', String(isActive));
  }
  if (plan) params.set('plan', plan);
  return saasFetch(`/api/v1/platform/tenants?${params}`);
}

export async function createPlatformTenant(body) {
  return saasFetch('/api/v1/platform/tenants', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchPlatformTenant(tenantId) {
  return saasFetch(`/api/v1/platform/tenants/${tenantId}`);
}

export async function updatePlatformTenant(tenantId, body) {
  return saasFetch(`/api/v1/platform/tenants/${tenantId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function validatePlatformDomain(domain) {
  const q = new URLSearchParams({ domain: String(domain || '').trim().toLowerCase() });
  return saasFetch(`/api/v1/platform/tls/validate-domain?${q}`);
}

export async function suspendPlatformTenant(tenantId) {
  return saasFetch(`/api/v1/platform/tenants/${tenantId}/suspend`, { method: 'POST' });
}

export async function reactivatePlatformTenant(tenantId) {
  return saasFetch(`/api/v1/platform/tenants/${tenantId}/reactivate`, { method: 'POST' });
}

export async function impersonatePlatformTenant(tenantId) {
  return saasFetch(`/api/v1/platform/tenants/${tenantId}/impersonate`, { method: 'POST' });
}

export async function reportPlatformUsageAll(stripeOnly = true) {
  return saasFetch(
    `/api/v1/platform/billing/report-usage-all?stripe_only=${stripeOnly ? 'true' : 'false'}`,
    { method: 'POST' },
  );
}

export async function fetchTenantAuditLogs(tenantId, { offset = 0, limit = 50 } = {}) {
  const q = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  return saasFetch(`/api/v1/platform/tenants/${tenantId}/audit?${q}`);
}
