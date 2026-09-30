/**
 * Load trip route + km + boarding for live-map vehicle history popup.
 */
import { getTripById } from '../trips/tripStore.js';
import { localDayRangeIso } from './fleetPlaybackNav.js';
import {
  fetchPlannedVsActual,
  fetchTripRoute,
  fetchVehicleRoute,
} from '../../services/telemetryApi.js';
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

function pointTimeMs(p) {
  if (!p?.recorded_at) return NaN;
  const t = new Date(p.recorded_at).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Split GPS breadcrumbs into map presence sessions (entered / exited).
 * A gap longer than `gapMs` means the vehicle left the live map and later re-entered.
 */
export function segmentGpsSessions(points = [], { gapMs = 20 * 60 * 1000, activeWithinMs = 5 * 60 * 1000 } = {}) {
  const sorted = (Array.isArray(points) ? points : [])
    .filter((p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
    .slice()
    .sort((a, b) => {
      const ta = pointTimeMs(a);
      const tb = pointTimeMs(b);
      if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
      if (!Number.isFinite(ta)) return 1;
      if (!Number.isFinite(tb)) return -1;
      return ta - tb;
    });

  if (!sorted.length) return [];

  const chunks = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prevT = pointTimeMs(sorted[i - 1]);
    const curT = pointTimeMs(sorted[i]);
    const gap = Number.isFinite(prevT) && Number.isFinite(curT) ? curT - prevT : 0;
    if (gap > gapMs) {
      chunks.push(current);
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }
  chunks.push(current);

  const now = Date.now();
  return chunks.map((chunk, idx) => {
    const enteredAt = chunk[0]?.recorded_at || null;
    const exitedAt = chunk[chunk.length - 1]?.recorded_at || null;
    const t0 = pointTimeMs(chunk[0]);
    const t1 = pointTimeMs(chunk[chunk.length - 1]);
    const durationMin =
      Number.isFinite(t0) && Number.isFinite(t1) ? Math.max(0, (t1 - t0) / 60000) : null;
    const km = pathLengthKm(chunk);
    const avgSpeed = chunk.length
      ? chunk.reduce((s, p) => s + Number(p.speed_kmh || 0), 0) / chunk.length
      : 0;
    const stillActive = Number.isFinite(t1) && now - t1 <= activeWithinMs;
    const tripId = chunk.find((p) => p.trip_id != null)?.trip_id ?? null;
    const driverId = chunk.find((p) => p.driver_id)?.driver_id || null;
    return {
      id: `session-${idx}-${enteredAt || idx}`,
      index: idx + 1,
      enteredAt,
      exitedAt,
      active: stillActive,
      points: chunk,
      pointCount: chunk.length,
      km,
      durationMin,
      avgSpeed,
      tripId,
      driverId,
      enterLat: Number(chunk[0]?.lat),
      enterLng: Number(chunk[0]?.lng),
      exitLat: Number(chunk[chunk.length - 1]?.lat),
      exitLng: Number(chunk[chunk.length - 1]?.lng),
    };
  });
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
  const tripIdRaw = vehicle?.trip_id ?? vehicle?.tripId;
  const tripId = Number(tripIdRaw);
  const hasTrip = Number.isFinite(tripId) && tripId > 0;
  const vehicleId = String(vehicle?.id || vehicle?.vehicle_id || '').trim();
  const vehicleCode = String(vehicle?.bus_plate || vehicle?.vehicle_code || '').trim();
  if (!hasTrip && !vehicleId && !vehicleCode) {
    throw new Error('Δεν υπάρχει GPS ιστορικό για αυτό το όχημα');
  }

  const driverId = vehicle?.driver_id ?? vehicle?.driverId ?? undefined;
  const { from, to } = localDayRangeIso();
  const trip = hasTrip ? getTripById(tripId) : null;
  const plannedStops = trip?.stops || [];

  const routePromise = hasTrip
    ? fetchTripRoute(tripId, { from, to, driverId, limit: 5000 })
    : fetchVehicleRoute(vehicleId || 'by-plate', {
        from,
        to,
        vehicleCode: vehicleCode || undefined,
        limit: 5000,
      });

  const [routeRes, pvaRes, boardingRes] = await Promise.allSettled([
    routePromise,
    hasTrip ? fetchPlannedVsActual(tripId, { plannedStops }) : Promise.resolve(null),
    hasTrip ? fetchBoardingForAdmin(tripId) : Promise.resolve(null),
  ]);

  const route = routeRes.status === 'fulfilled' ? routeRes.value : { points: [], point_count: 0 };
  const points = Array.isArray(route.points) ? route.points : [];
  const pva = pvaRes.status === 'fulfilled' ? pvaRes.value : null;
  const boarding =
    boardingRes.status === 'fulfilled' && boardingRes.value
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

  const sessions = segmentGpsSessions(points);

  return {
    tripId: hasTrip ? tripId : null,
    trip,
    vehicle,
    points,
    pointCount: points.length || Number(route.point_count) || 0,
    fromTime: route.from_time || points[0]?.recorded_at || null,
    toTime: route.to_time || points[points.length - 1]?.recorded_at || null,
    trackingStartedAt:
      route.tracking_started_at ||
      vehicle?.tracking_started_at ||
      points[0]?.recorded_at ||
      null,
    km,
    durationMin,
    avgSpeed,
    boarding,
    checkinsByStop,
    plannedStops,
    sessions,
  };
}
