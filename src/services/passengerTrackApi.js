import { API_BASE } from '../config/api.js';

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

export async function fetchTripTrack(tripId, { tenantId = DEMO_TENANT, token } = {}) {
  const url = new URL(`${API_BASE}/api/passenger/trips/${tripId}/track`);
  if (token) url.searchParams.set('token', token);
  else if (tenantId) url.searchParams.set('tenant_id', tenantId);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Track unavailable (${res.status})`);
  }
  return res.json();
}

export function buildPassengerTrackUrl(tripId, { tenantId, token, origin = '' } = {}) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(`${base}/track/trip/${tripId}`);
  if (token) url.searchParams.set('token', token);
  if (tenantId) url.searchParams.set('tenant_id', tenantId);
  return url.toString();
}
