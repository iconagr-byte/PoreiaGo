/**
 * Authenticated admin API helpers — Bearer JWT from SaaS login.
 */
import { API_BASE } from '../config/api.js';
import { getSaasToken, saasAuthHeaders } from './saasApi.js';

export { getSaasToken };

export function adminAuthHeaders(extra = {}) {
  // Tenant scope comes from JWT only — never send a client Host override
  // (spoofable). Achillio recovery uses proxied Host + Achillio JWT.
  return { ...saasAuthHeaders(), ...extra };
}

/** Bearer only (FormData uploads — no Content-Type). */
export function adminBearerHeaders(extra = {}) {
  const token = getSaasToken();
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isNetworkError(err) {
  const raw = String(err?.message || err || '').trim();
  return (
    err?.name === 'TypeError' ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(raw)
  );
}

function networkAdminError() {
  return new Error(
    'Δεν υπάρχει σύνδεση με τον server (πιθανό deploy). Περιμένετε λίγο και πατήστε Δοκιμή ξανά.',
  );
}

/**
 * fetch() with short retries — deploy bounces often surface as "Failed to fetch"
 * or 502/503 while Traefik/nginx reattach api-blue.
 */
export async function adminFetch(path, options = {}) {
  const attempts = Math.max(1, Number(options.retries) || 3);
  const { retries, ...fetchOpts } = options;
  void retries;
  const isFormData =
    typeof FormData !== 'undefined' && fetchOpts.body instanceof FormData;
  // FormData must not send Content-Type: application/json (breaks multipart + auth proxies).
  const baseHeaders = isFormData ? adminBearerHeaders() : adminAuthHeaders();
  let lastErr;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...fetchOpts,
        headers: { ...baseHeaders, ...(fetchOpts.headers || {}) },
      });
      if ([502, 503, 504].includes(res.status) && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 450 * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (!isNetworkError(err) || i === attempts - 1) {
        throw isNetworkError(err) ? networkAdminError() : err;
      }
      await new Promise((r) => setTimeout(r, 450 * (i + 1)));
    }
  }

  throw isNetworkError(lastErr) ? networkAdminError() : lastErr;
}
