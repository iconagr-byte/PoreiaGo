/**
 * Authenticated admin API helpers — Bearer JWT from SaaS login.
 */
import { API_BASE } from '../config/api.js';
import { getSaasToken, saasAuthHeaders } from './saasApi.js';

export { getSaasToken };

export function adminAuthHeaders(extra = {}) {
  return { ...saasAuthHeaders(), ...extra };
}

/** Bearer only (FormData uploads — no Content-Type). */
export function adminBearerHeaders(extra = {}) {
  const token = getSaasToken();
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function adminFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...adminAuthHeaders(), ...(options.headers || {}) },
  });
}
