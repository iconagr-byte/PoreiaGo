import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildWsUrl } from '../lib/wsUrl.js';
import { getSaasTenantId, getSaasToken } from '../services/saasApi.js';
import { decodeJwtPayload, getImpersonationTarget } from '../lib/saasJwt.js';
import { fetchLiveFleet } from '../services/telemetryApi.js';
import { adminAuthHeaders } from '../services/adminApi.js';
import {
  FLEET_LIVE_POLL_ACTIVE_MS,
  FLEET_LIVE_POLL_MS,
  fleetPollMsForVehicleCount,
} from '../lib/admin/fleetLivePoll.js';
import {
  dedupeVehiclesByPlate,
  isHardwareTrackerRow,
  isPhoneGpsRow,
  normalizePlateKey,
} from '../lib/admin/fleetPinDedupe.js';

export const DEMO_TENANT = import.meta.env.VITE_DEMO_TENANT_ID || '00000000-0000-0000-0000-000000000001';

/** Tenant για fleet egress — JWT tenant πρώτα (όχι stale localStorage). */
export function resolveFleetTenantId() {
  const impersonated = getImpersonationTarget();
  if (impersonated) return impersonated;
  const token = getSaasToken();
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload?.tenant_id) return payload.tenant_id;
  }
  const stored = getSaasTenantId();
  if (stored) return stored;
  return DEMO_TENANT;
}

function isFleetAuthError(err) {
  const status = Number(err?.status);
  if (status === 401 || status === 403) return true;
  const raw = String(err?.message || '');
  return /έληξε|συνδεθείτε|unauthorized|forbidden|401|403/i.test(raw);
}

/** Deploy / Traefik blips — keep last pins, never show a scary banner/toast. */
function isFleetGatewayBlip(err) {
  const status = Number(err?.status);
  if (status === 502 || status === 503 || status === 504) return true;
  const raw = String(err?.message || '');
  return (
    /\b(502|503|504)\b/.test(raw) ||
    /bad gateway|gateway time-?out|service unavailable|live στόλου\s*\(50[234]\)/i.test(raw)
  );
}

const FleetTelemetryContext = createContext(null);

function gpsSourceKind(item) {
  const kind = String(item || '')
    .trim()
    .toLowerCase();
  if (!kind) return '';
  if (kind.includes('teltonika') || kind === 'tracker' || kind === 'test_ping') return 'teltonika';
  if (kind.includes('driver') || kind.includes('pwa') || kind.includes('phone') || kind === 'app') {
    return 'app';
  }
  return '';
}

function listedGpsSources(msg) {
  if (Array.isArray(msg?.gps_sources)) return msg.gps_sources;
  if (Array.isArray(msg?.gpsSources)) return msg.gpsSources;
  return null;
}

/** Trust server App stamp — never resurrect a cleared/offline App channel. */
function pickAppSeenAt(msg, prev) {
  if (
    Object.prototype.hasOwnProperty.call(msg, 'app_seen_at') ||
    Object.prototype.hasOwnProperty.call(msg, 'appSeenAt')
  ) {
    return msg.app_seen_at ?? msg.appSeenAt ?? null;
  }
  const listed = listedGpsSources(msg);
  if (Array.isArray(listed) && !listed.some((s) => gpsSourceKind(s) === 'app')) {
    return null;
  }
  return prev?.app_seen_at || null;
}

function pickAppDriverId(msg, prev) {
  if (
    Object.prototype.hasOwnProperty.call(msg, 'app_driver_id') ||
    Object.prototype.hasOwnProperty.call(msg, 'appDriverId')
  ) {
    return msg.app_driver_id ?? msg.appDriverId ?? null;
  }
  const listed = listedGpsSources(msg);
  if (Array.isArray(listed) && !listed.some((s) => gpsSourceKind(s) === 'app')) {
    return null;
  }
  // Cleared / missing App heartbeat ⇒ drop soft-ack chat id too.
  if (!pickAppSeenAt(msg, prev)) return null;
  return msg.app_driver_id || msg.appDriverId || prev?.app_driver_id || null;
}

/**
 * Parked-hydrate must not stick after the server opens Teltonika again.
 * Explicit false/true wins; a fresh tracker_signal without the flag ⇒ open.
 */
function pickHydratedFromStore(msg, prev) {
  if (
    Object.prototype.hasOwnProperty.call(msg, 'hydrated_from_store') ||
    Object.prototype.hasOwnProperty.call(msg, 'hydratedFromStore')
  ) {
    return Boolean(msg.hydrated_from_store ?? msg.hydratedFromStore);
  }
  const signal = msg.tracker_signal_at || msg.trackerSignalAt;
  if (signal) {
    const t = new Date(signal).getTime();
    if (Number.isFinite(t) && Date.now() - t <= 90_000) {
      return false;
    }
  }
  return Boolean(prev?.hydrated_from_store);
}

function normalizeVehicle(msg, id, prev) {
  const targetLat = Number(msg.lat ?? msg.latitude);
  const targetLng = Number(msg.lng ?? msg.longitude);
  if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return null;
  const prevLat = Number.isFinite(prev?.lat) ? prev.lat : targetLat;
  const prevLng = Number.isFinite(prev?.lng) ? prev.lng : targetLng;
  const appSeenAt = pickAppSeenAt(msg, prev);
  const listed = listedGpsSources(msg);
  const appDriverId = pickAppDriverId(msg, prev);
  return {
    id,
    vehicle_id: msg.vehicle_id || id,
    vehicle_code: msg.vehicle_code || msg.bus_plate || id,
    bus_plate: msg.bus_plate || msg.vehicle_code || '—',
    driver_name: msg.driver_name || '—',
    // Teltonika pin may only carry app_driver_id (soft-ack) for office chat.
    driver_id: msg.driver_id || appDriverId || (appSeenAt ? prev?.driver_id : null) || null,
    app_driver_id: appDriverId,
    trip_id: msg.trip_id,
    trip_title: msg.trip_title || msg.tripTitle || prev?.trip_title || null,
    tracking_started_at:
      msg.tracking_started_at || msg.trackingStartedAt || prev?.tracking_started_at || null,
    lat: prevLat,
    lng: prevLng,
    targetLat,
    targetLng,
    prevLat,
    prevLng,
    speed: msg.speed ?? msg.speed_kmh ?? 0,
    heading: msg.heading ?? msg.heading_deg,
    timestamp: msg.timestamp || msg.updated_at,
    accuracy_m: msg.accuracy_m ?? null,
    altitude_m: msg.altitude_m ?? null,
    boarding: msg.boarding ?? null,
    sensors: msg.sensors ?? null,
    photo_url: msg.photo_url ?? prev?.photo_url ?? null,
    vehicle_image_url: msg.vehicle_image_url ?? prev?.vehicle_image_url ?? null,
    trail: Array.isArray(msg.trail) && msg.trail.length ? msg.trail : prev?.trail || null,
    source: msg.source || prev?.source || null,
    imei: msg.imei || prev?.imei || null,
    app_seen_at: appSeenAt,
    tracker_signal_at:
      msg.tracker_signal_at || msg.trackerSignalAt || prev?.tracker_signal_at || null,
    hydrated_from_store: pickHydratedFromStore(msg, prev),
    // Explicit server list wins — do not merge prev (that kept App after logout).
    gps_sources: mergeGpsSources(listed, Array.isArray(listed) ? null : prev?.gps_sources),
    animStart: typeof performance !== 'undefined' ? performance.now() : 0,
  };
}

function mergeGpsSources(nextList, prevList) {
  const out = [];
  const seen = new Set();
  // When the server sends gps_sources, trust that list alone.
  const lists = Array.isArray(nextList) ? [nextList] : [nextList, prevList];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const norm = gpsSourceKind(item);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
    }
  }
  return ['teltonika', 'app'].filter((k) => seen.has(k));
}

function vehicleIdFromRow(v) {
  return v.vehicle_id || v.driver_id || `${v.bus_plate || v.vehicle_code || 'bus'}-${v.trip_id || '0'}`;
}

const SOURCE_FRESH_MS = 90_000;

function isChannelFresh(raw, maxMs = SOURCE_FRESH_MS) {
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= maxMs;
}

function isTeltonikaRowOnline(row) {
  if (!row || !isHardwareTrackerRow(row)) return false;
  if (row.hydrated_from_store || row.hydratedFromStore) {
    return isChannelFresh(row.tracker_signal_at || row.trackerSignalAt);
  }
  return isChannelFresh(
    row.tracker_signal_at || row.trackerSignalAt || row.timestamp || row.updated_at,
  );
}

function stripAppChannelFromRow(row) {
  const sources = (Array.isArray(row.gps_sources) ? row.gps_sources : [])
    .map((s) => gpsSourceKind(s))
    .filter((k) => k === 'teltonika');
  return {
    ...row,
    driver_id: null,
    app_driver_id: null,
    app_seen_at: null,
    gps_sources: sources.length ? sources : ['teltonika'],
  };
}

function dropOfflineVehicles(prev, msg) {
  const next = { ...prev };
  let changed = false;
  const removedIds = Array.isArray(msg.removed_vehicle_ids)
    ? msg.removed_vehicle_ids.map(String)
    : [];
  for (const rid of removedIds) {
    if (next[rid]) {
      delete next[rid];
      changed = true;
    }
    // Also drop rows keyed by plate/code when Redis id differs from map key.
    for (const [key, row] of Object.entries(next)) {
      if (
        String(row.vehicle_id || '') === rid ||
        String(row.vehicle_code || '') === rid ||
        String(row.bus_plate || '') === rid
      ) {
        delete next[key];
        changed = true;
      }
    }
  }
  const did = msg.driver_id != null ? String(msg.driver_id) : '';
  if (did) {
    for (const [key, row] of Object.entries(next)) {
      const belongs =
        String(row.driver_id || '') === did || String(row.app_driver_id || '') === did;
      if (!belongs) continue;
      if (isHardwareTrackerRow(row)) {
        // App offline — strip App badge. Drop pin only when Teltonika is also offline.
        if (!isTeltonikaRowOnline(row)) {
          delete next[key];
          changed = true;
        } else {
          next[key] = stripAppChannelFromRow(row);
          changed = true;
        }
        continue;
      }
      delete next[key];
      changed = true;
    }
  }
  if (!changed) {
    const id = vehicleIdFromRow(msg);
    if (next[id]) {
      delete next[id];
      changed = true;
    }
  }
  return changed ? next : prev;
}

export function FleetTelemetryProvider({ tenantId: tenantIdProp, children }) {
  const [tenantId, setTenantId] = useState(() => tenantIdProp || resolveFleetTenantId());

  useEffect(() => {
    setTenantId(tenantIdProp || resolveFleetTenantId());
  }, [tenantIdProp]);

  useEffect(() => {
    const syncTenant = () => setTenantId(tenantIdProp || resolveFleetTenantId());
    window.addEventListener('storage', syncTenant);
    window.addEventListener('saas-session-changed', syncTenant);
    return () => {
      window.removeEventListener('storage', syncTenant);
      window.removeEventListener('saas-session-changed', syncTenant);
    };
  }, [tenantIdProp]);

  const [vehicles, setVehicles] = useState({});
  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState('connecting'); // ws | poll | connecting
  const [pollError, setPollError] = useState('');
  const [lastPollAt, setLastPollAt] = useState(null);
  const wsRef = useRef(null);
  const vehicleCountRef = useRef(0);
  const boostPollUntilRef = useRef(0);

  useEffect(() => {
    vehicleCountRef.current = Object.keys(vehicles).length;
  }, [vehicles]);

  // HTTP poll is primary in production — Traefik often 404s WebSocket upgrades.
  useEffect(() => {
    let closed = false;
    let pollTimer = null;
    let ws = null;
    let mode = 'poll';

    const wipeVehicles = () => {
      vehicleCountRef.current = 0;
      setVehicles({});
    };

    const applyRows = (rows, { replace = true } = {}) => {
      if (!Array.isArray(rows)) return;
      setVehicles((prev) => {
        // Authenticated empty list = Redis has no live pins — clear immediately
        // so Τέλος βάρδιας does not wait on a grace window.
        if (rows.length > 0) {
          /* keep */
        }
        const map = replace ? {} : { ...prev };
        rows.forEach((row) => {
          const id = vehicleIdFromRow(row);
          const normalized = normalizeVehicle(row, id, map[id] || prev[id]);
          if (normalized) map[id] = normalized;
        });
        const deduped = dedupeVehiclesByPlate(map);
        vehicleCountRef.current = Object.keys(deduped).length;
        return deduped;
      });
    };

    const nextPollDelay = () => {
      if (Date.now() < boostPollUntilRef.current) return FLEET_LIVE_POLL_ACTIVE_MS;
      return fleetPollMsForVehicleCount(vehicleCountRef.current);
    };

    const scheduleNext = () => {
      if (closed) return;
      pollTimer = window.setTimeout(() => {
        tick();
      }, nextPollDelay());
    };

    const tick = () => {
      const headers = adminAuthHeaders();
      if (!headers.Authorization && !getSaasToken()) {
        wipeVehicles();
        setPollError('Απαιτείται σύνδεση admin για τον live χάρτη');
        setConnected(false);
        scheduleNext();
        return;
      }
      fetchLiveFleet(headers)
        .then((rows) => {
          if (closed) return;
          if (!Array.isArray(rows)) {
            setPollError('Μη έγκυρη απάντηση live fleet');
            scheduleNext();
            return;
          }
          applyRows(rows, { replace: true });
          setPollError('');
          setLastPollAt(new Date());
          setConnected(true);
          if (mode !== 'ws') {
            mode = 'poll';
            setTransport('poll');
          }
          scheduleNext();
        })
        .catch((err) => {
          if (closed) return;
          const raw = String(err?.message || '');
          if (isFleetAuthError(err)) {
            // Expired JWT must not freeze the last pin forever as "1 ενεργά".
            wipeVehicles();
            setConnected(false);
            setPollError(
              /έληξε|συνδεθείτε/i.test(raw)
                ? raw
                : 'Η σύνδεση έληξε — συνδεθείτε ξανά στο γραφείο',
            );
            scheduleNext();
            return;
          }
          if (isFleetGatewayBlip(err)) {
            // API restart / NPM 502 during deploy — silent retry, keep last pins.
            setConnected(false);
            setPollError('');
            scheduleNext();
            return;
          }
          const msg =
            raw === 'Failed to fetch' || /network|load failed|fetch/i.test(raw)
              ? 'Δεν συνδέει με το API (Failed to fetch). Ανανέωσε τη σελίδα· αν συνεχίζει, το api host είναι εκτός.'
              : raw || 'Αποτυχία φόρτωσης live στόλου';
          setPollError(msg);
          scheduleNext();
        });
    };

    // Start poll immediately — do not wait for WebSocket.
    setTransport('poll');
    tick();

    const url = buildWsUrl(`/ws/telemetry/egress/${tenantId}`, {
      token: getSaasToken() || '',
    });
    try {
      ws = new WebSocket(url);
      wsRef.current = ws;
    } catch {
      ws = null;
    }

    if (ws) {
      ws.onopen = () => {
        if (closed) return;
        mode = 'ws';
        setTransport('ws');
        setConnected(true);
      };
      ws.onclose = () => {
        if (closed) return;
        if (mode === 'ws') {
          mode = 'poll';
          setTransport('poll');
        }
      };
      ws.onerror = () => {
        /* poll already running */
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'fleet_snapshot' && Array.isArray(msg.vehicles)) {
            // Never wipe HTTP poll data with an empty WS snapshot.
            if (!msg.vehicles.length) return;
            applyRows(msg.vehicles, { replace: true });
            return;
          }
          if (msg.type === 'fleet_location') {
            const id = vehicleIdFromRow(msg);
            setVehicles((prev) => {
              const plate = normalizePlateKey(msg);
              // Teltonika owns the plate — fold App GPS into the hardware pin
              // (dual badge) instead of painting a second marker.
              if (plate && isPhoneGpsRow(msg)) {
                const hwEntry = Object.entries(prev).find(
                  ([, row]) => normalizePlateKey(row) === plate && isHardwareTrackerRow(row),
                );
                if (hwEntry) {
                  const [hwKey, existingHw] = hwEntry;
                  const next = {
                    ...prev,
                    [hwKey]: {
                      ...existingHw,
                      app_seen_at:
                        msg.app_seen_at ||
                        msg.appSeenAt ||
                        msg.timestamp ||
                        msg.updated_at ||
                        existingHw.app_seen_at ||
                        new Date().toISOString(),
                      gps_sources: mergeGpsSources(
                        ['teltonika', 'app', ...(msg.gps_sources || msg.gpsSources || [])],
                        existingHw.gps_sources,
                      ),
                      driver_name:
                        existingHw.driver_name &&
                        existingHw.driver_name !== '—' &&
                        existingHw.driver_name !== 'Tracker'
                          ? existingHw.driver_name
                          : msg.driver_name || existingHw.driver_name,
                      photo_url: existingHw.photo_url || msg.photo_url || null,
                    },
                  };
                  // Drop any leftover App UUID for this plate.
                  for (const [key, row] of Object.entries(next)) {
                    if (key === hwKey) continue;
                    if (normalizePlateKey(row) === plate && isPhoneGpsRow(row)) {
                      delete next[key];
                    }
                  }
                  const collapsed = dedupeVehiclesByPlate(next);
                  vehicleCountRef.current = Object.keys(collapsed).length;
                  return collapsed;
                }
              }
              const normalized = normalizeVehicle(msg, id, prev[id]);
              if (!normalized) return prev;
              const next = dedupeVehiclesByPlate({ ...prev, [id]: normalized });
              vehicleCountRef.current = Object.keys(next).length;
              return next;
            });
            return;
          }
          if (msg.type === 'fleet_driver_offline') {
            // Instant pin drop — do not wait for the next HTTP poll.
            setVehicles((prev) => {
              const next = dropOfflineVehicles(prev, msg);
              vehicleCountRef.current = Object.keys(next).length;
              return next;
            });
            // Burst-poll for a few seconds in case WS arrived before Redis delete.
            boostPollUntilRef.current = Date.now() + 4000;
            if (pollTimer) window.clearTimeout(pollTimer);
            tick();
          }
        } catch {
          // ignore malformed frames
        }
      };
    }

    const ping = window.setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send('ping');
    }, 25000);

    return () => {
      closed = true;
      if (pollTimer) window.clearTimeout(pollTimer);
      window.clearInterval(ping);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [tenantId]);

  const value = useMemo(
    () => ({
      connected,
      transport,
      vehicles: Object.values(vehicles),
      vehicleMap: vehicles,
      tenantId,
      pollError,
      lastPollAt,
      pollIntervalMs: fleetPollMsForVehicleCount(Object.keys(vehicles).length),
    }),
    [connected, transport, vehicles, tenantId, pollError, lastPollAt],
  );

  return <FleetTelemetryContext.Provider value={value}>{children}</FleetTelemetryContext.Provider>;
}

export function useFleetTelemetryEgress() {
  const ctx = useContext(FleetTelemetryContext);
  if (!ctx) {
    throw new Error('Το useFleetTelemetryEgress πρέπει να χρησιμοποιείται μέσα στο FleetTelemetryProvider');
  }
  return ctx;
}

// Re-export for tests / callers that previously imported poll constants via context path.
export { FLEET_LIVE_POLL_MS, FLEET_LIVE_POLL_ACTIVE_MS };
