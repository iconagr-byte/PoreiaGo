/**
 * Load trip route + km + boarding for live-map vehicle history popup.
 */
import { getTripById } from '../trips/tripStore.js';
import { localDayRangeIso } from './fleetPlaybackNav.js';
import { fetchPlannedVsActual, fetchTripRoute } from '../../services/telemetryApi.js';
import { fetchBoardingManifest } from '../../services/ticketingApi.js';
import { adminAuthHeaders } from '../../services/adminApi.js';
import { API_BASE } from '../../config/api.js';

const EARTH_RADIUS_M = 6_371_000;

function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function pathLengthKm(points = []) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (
      !Number.isFinite(a?.lat) ||
      !Number.isFinite(a?.lng) ||
      !Number.isFinite(b?.lat) ||
      !Number.isFinite(b?.lng)
    ) {
      continue;
    }
    total += haversineM(a.lat, a.lng, b.lat, b.lng);
  }
  return total / 1000;
}

function parseTimeToMinutes(value) {
  if (!value) return null;
  const m = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function boardedAtMinutes(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  } catch {
    return null;
  }
}

/**
 * Group boarded passengers under planned stops (by boarded_at vs stop.time).
 * Passengers without time go to the first stop (αφετηρία).
 */
export function groupCheckinsByStop(stops = [], boarded = [], missing = []) {
  const list = (Array.isArray(stops) ? stops : []).map((s, i) => ({
    id: s.id ?? `stop-${i}`,
    name: s.name || s.title || `Στάση ${i + 1}`,
    time: s.time || s.arrival_time || s.eta || null,
    lat: s.lat,
    lng: s.lng,
    boarded: [],
    missing: [],
  }));

  if (!list.length) {
    return [
      {
        id: 'all',
        name: 'Επιβίβαση δρομολογίου',
        time: null,
        boarded: [...(boarded || [])],
        missing: [...(missing || [])],
      },
    ];
  }

  const unassignedMissing = [...(missing || [])];
  // Missing passengers typically belong to the origin (first stop).
  list[0].missing.push(...unassignedMissing);

  for (const p of boarded || []) {
    const mins = boardedAtMinutes(p.boarded_at);
    if (mins == null) {
      list[0].boarded.push(p);
      continue;
    }
    let idx = 0;
    for (let i = 0; i < list.length; i += 1) {
      const stopMins = parseTimeToMinutes(list[i].time);
      if (stopMins != null && mins >= stopMins - 20) idx = i;
    }
    list[idx].boarded.push(p);
  }

  return list;
}

async function fetchBoardingForAdmin(tripId) {
  const headers = adminAuthHeaders();
  try {
    const res = await fetch(`${API_BASE}/admin/boarding/${tripId}`, { headers });
    if (res.ok) return res.json();
  } catch {
    /* fall through */
  }
  return fetchBoardingManifest(tripId);
}

/** @param {object} vehicle live fleet vehicle */
export async function loadVehicleTripHistory(vehicle) {
  const tripId = Number(vehicle?.trip_id ?? vehicle?.tripId);
  if (!Number.isFinite(tripId)) {
    throw new Error('Δεν υπάρχει ενεργό δρομολόγιο για αυτό το όχημα');
  }

  const driverId = vehicle?.driver_id ?? vehicle?.driverId ?? undefined;
  const { from, to } = localDayRangeIso();
  const trip = getTripById(tripId);
  const plannedStops = trip?.stops || [];

  const [routeRes, pvaRes, boardingRes] = await Promise.allSettled([
    fetchTripRoute(tripId, { from, to, driverId, limit: 5000 }),
    fetchPlannedVsActual(tripId, { plannedStops }),
    fetchBoardingForAdmin(tripId),
  ]);

  const route = routeRes.status === 'fulfilled' ? routeRes.value : { points: [], point_count: 0 };
  const points = Array.isArray(route.points) ? route.points : [];
  const pva = pvaRes.status === 'fulfilled' ? pvaRes.value : null;
  const boarding =
    boardingRes.status === 'fulfilled'
      ? boardingRes.value
      : { boarded_passengers: [], missing_passengers: [], boarded_count: 0, capacity: 0 };

  const summaryFromPva = pva?.actual?.summary || pva?.summary || null;
  const km =
    Number(summaryFromPva?.path_length_km) > 0
      ? Number(summaryFromPva.path_length_km)
      : pathLengthKm(points);

  const durationMin =
    summaryFromPva?.duration_min != null
      ? Number(summaryFromPva.duration_min)
      : points.length >= 2
        ? (() => {
            try {
              const t0 = new Date(points[0].recorded_at).getTime();
              const t1 = new Date(points[points.length - 1].recorded_at).getTime();
              return Math.max(0, (t1 - t0) / 60000);
            } catch {
              return null;
            }
          })()
        : null;

  const avgSpeed =
    summaryFromPva?.avg_speed_kmh != null
      ? Number(summaryFromPva.avg_speed_kmh)
      : points.length
        ? points.reduce((s, p) => s + Number(p.speed_kmh || 0), 0) / points.length
        : Number(vehicle?.speed || 0);

  const checkinsByStop = groupCheckinsByStop(
    plannedStops,
    boarding.boarded_passengers || [],
    boarding.missing_passengers || [],
  );

  return {
    tripId,
    trip,
    vehicle,
    points,
    pointCount: points.length || Number(route.point_count) || 0,
    fromTime: route.from_time || points[0]?.recorded_at || null,
    toTime: route.to_time || points[points.length - 1]?.recorded_at || null,
    km,
    durationMin,
    avgSpeed,
    boarding,
    checkinsByStop,
    plannedStops,
  };
}
