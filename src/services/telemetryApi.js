import { API_BASE } from '../config/api.js';
import { adminAuthHeaders } from './adminApi.js';
import { driverSessionHeaders } from '../lib/driver/driverSession.js';

const DEVICE_KEY = import.meta.env.VITE_TELEMETRY_DEVICE_KEY || 'dev-gps-key';

/** Admin live map HTTP poll cadence — matches driver GPS send interval (5s). */
export const FLEET_LIVE_POLL_MS = 5000;
export async function postTelemetryUpdate(payload) {
  const res = await fetch(`${API_BASE}/telemetry/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Key': DEVICE_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Telemetry rejected');
  }
  return res.json();
}

export async function fetchLiveFleet(authHeaders = adminAuthHeaders()) {
  const res = await fetch(`${API_BASE}/api/v1/telemetry/fleet/live`, {
    headers: authHeaders,
  });
  if (res.ok) {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }
  // Authenticated failures must not fall back to mock fleet (hides real LIVE drivers).
  if (authHeaders?.Authorization) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Αποτυχία live στόλου (${res.status})`);
  }
  return getMockFleet();
}

export async function fetchHeatmap(
  { days = 7, tripId, slowOnly = false, cellSize = 0.01 } = {},
  authHeaders = adminAuthHeaders(),
) {
  try {
    const params = new URLSearchParams({
      days: String(days),
      cell_size: String(cellSize),
      min_weight: '2',
    });
    if (tripId) params.set('trip_id', String(tripId));
    if (slowOnly) params.set('slow_only', 'true');
    const res = await fetch(`${API_BASE}/api/admin/telemetry/heatmap?${params}`, {
      headers: authHeaders,
    });
    if (res.ok) {
      const data = await res.json();
      return data.points || [];
    }
  } catch {
    /* offline */
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/telemetry/heatmap`, {
      headers: authHeaders,
    });
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  return [];
}

export async function fetchFleetHeatmap(options = {}, authHeaders = adminAuthHeaders()) {
  const params = new URLSearchParams();
  const days = options.days ?? 7;
  params.set('days', String(days));
  if (options.cellSize) params.set('cell_size', String(options.cellSize));
  if (options.tripId) params.set('trip_id', String(options.tripId));
  if (options.slowOnly) params.set('slow_only', 'true');
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  const res = await fetch(`${API_BASE}/api/admin/telemetry/heatmap?${params}`, {
    headers: authHeaders,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία φόρτωσης heatmap');
  }
  return data;
}

export async function fetchFleetKpis({ days = 30, from, to } = {}, authHeaders = adminAuthHeaders()) {
  const params = new URLSearchParams({ days: String(days) });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const res = await fetch(`${API_BASE}/api/admin/telemetry/kpis?${params}`, {
    headers: authHeaders,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία φόρτωσης fleet KPIs');
  }
  return data;
}

export async function fetchFleetEtas(authHeaders = adminAuthHeaders()) {
  const res = await fetch(`${API_BASE}/api/admin/telemetry/etas`, { headers: authHeaders });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία φόρτωσης fleet ETA');
  }
  return data;
}

/** Signed public passenger track link — POST /api/admin/telemetry/trips/{id}/track-link */
export async function createPassengerTrackLink(
  tripId,
  { ttlHours = 72 } = {},
  authHeaders = adminAuthHeaders(),
) {
  const params = new URLSearchParams();
  if (ttlHours) params.set('ttl_hours', String(ttlHours));
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/api/admin/telemetry/trips/${tripId}/track-link${qs ? `?${qs}` : ''}`,
    { method: 'POST', headers: authHeaders },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία δημιουργίας track link');
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    ...data,
    url: data.path?.startsWith('http') ? data.path : `${origin}${data.path || ''}`,
  };
}

export async function fetchGeofenceMapLayers({ tripIds } = {}, authHeaders = adminAuthHeaders()) {
  const params = new URLSearchParams();
  if (tripIds?.length) params.set('trip_ids', tripIds.join(','));
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/api/admin/telemetry/geofence-map${qs ? `?${qs}` : ''}`, {
    headers: authHeaders,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία φόρτωσης geofence layers');
  }
  return data;
}

export async function fetchDriverTripTelemetry() {
  try {
    const res = await fetch(`${API_BASE}/api/driver/telemetry/trip`, {
      headers: driverSessionHeaders(),
    });
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  return {
    trip_id: 1,
    idle_seconds: 120,
    idle_cost_eur: 1.54,
    fuel_wasted_liters: 0.83,
    estimated_fuel_saved_liters: 0.42,
    is_currently_idling: false,
  };
}

export const DEFAULT_TELEMETRY_SETTINGS = {
  geofence_radius_m: 50,
  corridor_buffer_m: 75,
  corridor_min_speed_kmh: 8,
  corridor_debounce_points: 3,
  idle_alert_seconds: 300,
  idle_fuel_liters_per_hour: 2.5,
  fuel_price_eur_per_liter: 1.85,
  gforce_spike_threshold_g: 0.45,
  prefer_tracker_events: true,
  eta_refresh_seconds: 300,
  eta_ws_push_seconds: 30,
  driver_stale_seconds: 90,
  google_maps_configured: false,
};

const SETTINGS_STORAGE_KEY = 'aerostride_telemetry_settings';

export async function fetchTelemetrySettings(authHeaders = adminAuthHeaders()) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/telemetry/settings`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  } catch {
    /* offline */
  }
  try {
    const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_TELEMETRY_SETTINGS };
}

export async function updateTelemetrySettings(patch, authHeaders = adminAuthHeaders()) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/telemetry/settings`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
      return data;
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Settings update failed');
  } catch (e) {
    if (e.message && e.message !== 'Failed to fetch') throw e;
    const merged = { ...DEFAULT_TELEMETRY_SETTINGS, ...patch };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }
}

export async function fetchTelemetryAlerts({ limit = 50 } = {}, authHeaders = adminAuthHeaders()) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/telemetry/alerts?limit=${limit}`, {
      headers: authHeaders,
    });
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  return getMockAlerts();
}

export async function compareTripRoutes(tripA, tripB, { limit = 5000 } = {}, authHeaders = adminAuthHeaders()) {
  const params = new URLSearchParams({
    trip_a: String(tripA),
    trip_b: String(tripB),
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE}/api/admin/telemetry/trips/compare?${params}`, {
    headers: authHeaders,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία σύγκρισης διαδρομών');
  }
  return data;
}

export async function fetchTripRoute(
  tripId,
  { from, to, driverId, limit = 5000 } = {},
  authHeaders = adminAuthHeaders(),
) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (driverId) params.set('driver_id', String(driverId));
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/api/admin/telemetry/trips/${tripId}/route${qs ? `?${qs}` : ''}`,
    { headers: authHeaders },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία φόρτωσης διαδρομής');
  }
  return data;
}

export async function fetchPlannedVsActual(
  tripId,
  { plannedStops, bufferM, limit = 5000 } = {},
  authHeaders = adminAuthHeaders(),
) {
  const params = new URLSearchParams({ limit: String(limit) });
  const stops =
    plannedStops?.filter((s) => s.lat != null && s.lng != null).map((s) => ({
      lat: Number(s.lat),
      lng: Number(s.lng),
      name: s.name || s.title || null,
    })) || [];

  const usePost = stops.length >= 2;
  const res = await fetch(
    `${API_BASE}/api/admin/telemetry/trips/${tripId}/planned-vs-actual?${params}`,
    {
      method: usePost ? 'POST' : 'GET',
      headers: {
        ...authHeaders,
        ...(usePost ? { 'Content-Type': 'application/json' } : {}),
      },
      body: usePost
        ? JSON.stringify({
            planned_stops: stops,
            ...(bufferM != null ? { buffer_m: bufferM } : {}),
          })
        : undefined,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία σύγκρισης planned vs actual');
  }
  return data;
}

export async function downloadTripRouteExport(
  tripId,
  format = 'gpx',
  { from, to, driverId, limit = 5000 } = {},
  authHeaders = adminAuthHeaders(),
) {
  const params = new URLSearchParams({ format });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (driverId) params.set('driver_id', String(driverId));
  if (limit) params.set('limit', String(limit));
  const res = await fetch(
    `${API_BASE}/api/admin/telemetry/trips/${tripId}/route/export?${params}`,
    { headers: authHeaders },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Αποτυχία εξαγωγής διαδρομής');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `trip-${tripId}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getMockAlerts() {
  const now = new Date().toISOString();
  return [
    {
      id: 'mock-1',
      alert_type: 'ROUTE_DEVIATION',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      vehicle_id: 'demo-vehicle-1',
      trip_id: 1,
      message: 'Αποκλίνουσα διαδρομή — 120m εκτός διαδρόμου',
      metadata: { distance_outside_m: 120, buffer_m: 75 },
      created_at: now,
    },
  ];
}

function getMockFleet() {
  return [
    {
      vehicle_id: '1',
      vehicle_code: 'XAH-4021',
      trip_id: 1,
      lat: 38.9,
      lng: 22.4,
      speed_kmh: 72,
      engine_on: true,
      fuel_level_pct: 68,
      idle_seconds_trip: 180,
    },
    {
      vehicle_id: '2',
      vehicle_code: 'YZA-9901',
      trip_id: 2,
      lat: 39.1,
      lng: 21.8,
      speed_kmh: 0,
      engine_on: true,
      fuel_level_pct: 45,
      idle_seconds_trip: 420,
    },
  ];
}
