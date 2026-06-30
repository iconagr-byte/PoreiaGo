/**
 * Multi-tenant SaaS API (/api/v1) — JWT auth, bookings, API keys.
 */
import { API_BASE } from '../config/api.js';
import { clearSaasRoles, decodeJwtPayload, getSaasRoles, storeSaasRoles, storeSaasRolesFromToken } from '../lib/saasJwt.js';
import { handleAuthFailure, isAuthFailureStatus } from '../lib/authSession.js';

const TOKEN_KEY = 'saas_access_token';
const TENANT_KEY = 'saas_tenant_id';
const EMAIL_KEY = 'saas_user_email';
const IMPERSONATION_ORIGINAL_TOKEN_KEY = 'saas_impersonation_original_token';
const IMPERSONATION_ORIGINAL_TENANT_KEY = 'saas_impersonation_original_tenant_id';
const IMPERSONATION_ORIGINAL_ROLES_KEY = 'saas_impersonation_original_roles';
const DEV_TENANT = import.meta.env.VITE_SAAS_TENANT_ID || '';

function notifySaasSessionChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('saas-session-changed'));
  }
}

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

export function getSaasToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSaasTenantId() {
  return localStorage.getItem(TENANT_KEY) || DEV_TENANT;
}

export function setSaasSession({ accessToken, tenantId, email }) {
  if (accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    storeSaasRolesFromToken(accessToken);
  }
  if (tenantId) localStorage.setItem(TENANT_KEY, tenantId);
  if (email) localStorage.setItem(EMAIL_KEY, email);
  notifySaasSessionChanged();
}

export function clearSaasSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_TOKEN_KEY);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_TENANT_KEY);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_ROLES_KEY);
  clearSaasRoles();
  notifySaasSessionChanged();
}

/** SuperAdmin masquerade — stash original session, apply impersonation JWT. */
export function startImpersonationSession(tokenResponse) {
  const currentToken = getSaasToken();
  if (currentToken && !localStorage.getItem(IMPERSONATION_ORIGINAL_TOKEN_KEY)) {
    localStorage.setItem(IMPERSONATION_ORIGINAL_TOKEN_KEY, currentToken);
    localStorage.setItem(IMPERSONATION_ORIGINAL_TENANT_KEY, getSaasTenantId() || '');
    localStorage.setItem(IMPERSONATION_ORIGINAL_ROLES_KEY, JSON.stringify(getSaasRoles()));
  }
  const tenantId =
    tokenResponse.tenant_id || decodeJwtPayload(tokenResponse.access_token)?.tenant_id;
  setSaasSession({
    accessToken: tokenResponse.access_token,
    tenantId,
    email: localStorage.getItem(EMAIL_KEY) || undefined,
  });
  if (Array.isArray(tokenResponse.roles) && tokenResponse.roles.length) {
    storeSaasRoles(tokenResponse.roles);
  }
}

/** Restore superadmin session after impersonation. */
export function exitImpersonationSession() {
  const originalToken = localStorage.getItem(IMPERSONATION_ORIGINAL_TOKEN_KEY);
  if (!originalToken) return false;
  const originalTenant = localStorage.getItem(IMPERSONATION_ORIGINAL_TENANT_KEY) || undefined;
  let originalRoles = [];
  try {
    originalRoles = JSON.parse(localStorage.getItem(IMPERSONATION_ORIGINAL_ROLES_KEY) || '[]');
  } catch {
    originalRoles = [];
  }
  setSaasSession({
    accessToken: originalToken,
    tenantId: originalTenant,
  });
  if (originalRoles.length) {
    storeSaasRoles(originalRoles);
  }
  localStorage.removeItem(IMPERSONATION_ORIGINAL_TOKEN_KEY);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_TENANT_KEY);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_ROLES_KEY);
  return true;
}

export function hasImpersonationBackup() {
  return Boolean(localStorage.getItem(IMPERSONATION_ORIGINAL_TOKEN_KEY));
}

export function saasAuthHeaders() {
  const token = getSaasToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function saasFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...saasAuthHeaders(), ...options.headers },
  });
  if (isAuthFailureStatus(res.status)) {
    handleAuthFailure();
    await parseError(res);
  }
  if (!res.ok) await parseError(res);
  if (res.status === 204) return null;
  return res.json();
}

/** POST /api/v1/auth/login — email + password; tenant resolved by backend. */
export async function saasLogin({ email, password, tenantSlug, tenantId, mfaCode }) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      tenant_slug: tenantSlug || undefined,
      tenant_id: tenantId || undefined,
      mfa_code: mfaCode || undefined,
    }),
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  const resolvedTenantId =
    data.tenant_id || decodeJwtPayload(data.access_token)?.tenant_id || DEV_TENANT;
  const roles = Array.isArray(data.roles) && data.roles.length
    ? data.roles
    : storeSaasRolesFromToken(data.access_token);
  setSaasSession({
    accessToken: data.access_token,
    tenantId: resolvedTenantId,
    email,
  });
  if (Array.isArray(data.roles) && data.roles.length) {
    storeSaasRoles(data.roles);
  }
  return { ...data, roles };
}

/** POST /api/v1/auth/dev-login — local dev fallback when Postgres/seed unavailable. */
export async function saasDevLogin({ email, password, tenantSlug }) {
  const res = await fetch(`${API_BASE}/api/v1/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      tenant_slug: tenantSlug || undefined,
    }),
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  const resolvedTenantId =
    data.tenant_id || decodeJwtPayload(data.access_token)?.tenant_id || DEV_TENANT;
  const roles = Array.isArray(data.roles) && data.roles.length
    ? data.roles
    : storeSaasRolesFromToken(data.access_token);
  setSaasSession({
    accessToken: data.access_token,
    tenantId: resolvedTenantId,
    email,
  });
  if (Array.isArray(data.roles) && data.roles.length) {
    storeSaasRoles(data.roles);
  }
  return { ...data, roles, devFallback: true };
}

/** POST /api/v1/operations/master-qr — requires SaaS JWT + trip in Postgres. */
export async function issueSaasMasterQr({ tripId, driverId }) {
  const data = await saasFetch('/api/v1/operations/master-qr', {
    method: 'POST',
    body: JSON.stringify({
      trip_id: Number(tripId),
      driver_id: driverId || undefined,
    }),
  });
  const expiresAt =
    typeof data.expires_at === 'string'
      ? Math.floor(new Date(data.expires_at).getTime() / 1000)
      : data.expires_at;
  return {
    qr_content: data.qr_payload,
    trip_id: data.trip_id,
    tenant_id: getSaasTenantId(),
    expires_at: expiresAt,
    manifest_url: data.manifest_url,
    source: 'postgres',
  };
}

export async function fetchSaasBookings() {
  return saasFetch('/api/v1/bookings');
}

/** B2C checkout — no JWT; uses VITE_SAAS_TENANT_ID or stored tenant. */
/** POST /api/v1/bookings/lookup — email + reference required. */
export async function saasLookupGuestBooking({ tenantId, email, referenceCode }) {
  const tid = tenantId || getSaasTenantId();
  if (!tid) {
    throw new Error('Δεν έχει οριστεί tenant (VITE_SAAS_TENANT_ID)');
  }
  const res = await fetch(`${API_BASE}/api/v1/bookings/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tid,
      passenger_email: email.trim().toLowerCase(),
      reference_code: referenceCode.trim(),
    }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function saasCreateGuestBooking(payload) {
  const tenantId = payload.tenantId || getSaasTenantId();
  if (!tenantId) {
    throw new Error('Δεν έχει οριστεί tenant (VITE_SAAS_TENANT_ID)');
  }
  const res = await fetch(`${API_BASE}/api/v1/bookings/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      passenger_name: payload.passengerName,
      passenger_email: payload.passengerEmail,
      seat_label: payload.seatLabel,
      amount_eur: payload.amountEur,
      external_trip_id: payload.externalTripId ?? null,
      trip_title: payload.tripTitle ?? null,
      payment_method: payload.paymentMethod ?? null,
      phone: payload.phone ?? null,
      seats: payload.seats ?? [],
      payment_plan: payload.paymentPlan ?? null,
      total_eur: payload.totalEur ?? null,
      balance_due: payload.balanceDue ?? null,
      deposit_percent: payload.depositPercent ?? null,
    }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function createSaasApiKey(name, scope = 'telemetry') {
  return saasFetch('/api/v1/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name, scope }),
  });
}

/** Register booking in ticketing SQLite for QR scan / boarding. */
export async function syncTicketForBoarding(booking) {
  const trip = booking.tripId ?? 0;
  const dep = booking.date
    ? `${booking.date}T${booking.time || '08:00'}:00`
    : new Date().toISOString();
  const res = await fetch(`${API_BASE}/api/tickets/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: booking.id,
      trip_id: trip,
      customer_name: booking.customerName,
      seat_number: booking.seat || booking.seats?.join(', ') || '—',
      payment_status:
        Number(booking.balanceDue) > 0 ? 'DEPOSIT' : 'PAID',
      phone: booking.phone,
      departure_at: dep,
      saas_booking_id: booking.saasBookingId || null,
      email: booking.email,
    }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function checkSaasHealth() {
  const res = await fetch(`${API_BASE}/api/v1/health`);
  return res.ok;
}
