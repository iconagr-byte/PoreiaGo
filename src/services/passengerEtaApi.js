import { API_BASE } from '../config/api.js';

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

export async function fetchTripEta(tripId, tenantId = DEMO_TENANT) {
  const url = new URL(`${API_BASE}/api/passenger/trips/${tripId}/eta`);
  if (tenantId) url.searchParams.set('tenant_id', tenantId);
  try {
    const res = await fetch(url.toString());
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  return getMockEta(tripId);
}

function getMockEta(tripId) {
  const now = new Date().toISOString();
  return {
    trip_id: tripId,
    next_stop_name: 'Λαμία (επόμενη στάση)',
    eta_seconds: 720,
    eta_display: 'Άφιξη σε 12 λεπτά',
    distance_m: 42000,
    traffic_level: 'heavy',
    traffic_label: 'Κίνηση: Αυξημένη',
    vehicle_lat: 38.9,
    vehicle_lng: 22.4,
    computed_at: now,
    server_sync_interval_sec: 30,
  };
}
