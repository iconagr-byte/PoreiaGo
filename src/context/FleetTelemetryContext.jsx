import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildWsUrl } from '../lib/wsUrl.js';
import { getSaasTenantId, getSaasToken } from '../services/saasApi.js';
import { decodeJwtPayload, getImpersonationTarget } from '../lib/saasJwt.js';
import { fetchLiveFleet } from '../services/telemetryApi.js';
import { adminAuthHeaders } from '../services/adminApi.js';

export const DEMO_TENANT = import.meta.env.VITE_DEMO_TENANT_ID || '00000000-0000-0000-0000-000000000001';

/** Tenant για fleet egress — JWT impersonation, localStorage ή demo fallback. */
export function resolveFleetTenantId() {
  const impersonated = getImpersonationTarget();
  if (impersonated) return impersonated;
  const stored = getSaasTenantId();
  if (stored) return stored;
  const token = getSaasToken();
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload?.tenant_id) return payload.tenant_id;
  }
  return DEMO_TENANT;
}

const FleetTelemetryContext = createContext(null);

function normalizeVehicle(msg, id, prev) {
  const targetLat = Number(msg.lat ?? msg.latitude);
  const targetLng = Number(msg.lng ?? msg.longitude);
  if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return null;
  const prevLat = Number.isFinite(prev?.lat) ? prev.lat : targetLat;
  const prevLng = Number.isFinite(prev?.lng) ? prev.lng : targetLng;
  return {
    id,
    vehicle_id: msg.vehicle_id || id,
    vehicle_code: msg.vehicle_code || msg.bus_plate || id,
    bus_plate: msg.bus_plate || msg.vehicle_code || '—',
    driver_name: msg.driver_name || '—',
    driver_id: msg.driver_id,
    trip_id: msg.trip_id,
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
    animStart: typeof performance !== 'undefined' ? performance.now() : 0,
  };
}

function vehicleIdFromRow(v) {
  return v.vehicle_id || v.driver_id || `${v.bus_plate || v.vehicle_code || 'bus'}-${v.trip_id || '0'}`;
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

  // HTTP poll is primary in production — Traefik often 404s WebSocket upgrades.
  useEffect(() => {
    let closed = false;
    let pollTimer = null;
    let ws = null;
    let mode = 'poll';

    const applyRows = (rows, { replace = true } = {}) => {
      if (!Array.isArray(rows)) return;
      setVehicles((prev) => {
        const map = replace ? {} : { ...prev };
        rows.forEach((row) => {
          const id = vehicleIdFromRow(row);
          const normalized = normalizeVehicle(row, id, map[id] || prev[id]);
          if (normalized) map[id] = normalized;
        });
        return map;
      });
    };

    const tick = () => {
      const headers = adminAuthHeaders();
      if (!headers.Authorization && !getSaasToken()) {
        setPollError('Απαιτείται σύνδεση admin για τον live χάρτη');
        setConnected(false);
        return;
      }
      fetchLiveFleet(headers)
        .then((rows) => {
          if (closed) return;
          if (!Array.isArray(rows)) {
            setPollError('Μη έγκυρη απάντηση live fleet');
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
        })
        .catch((err) => {
          if (closed) return;
          const raw = String(err?.message || '');
          const msg =
            raw === 'Failed to fetch' || /network|load failed|fetch/i.test(raw)
              ? 'Δεν συνδέει με το API (Failed to fetch). Ανανέωσε τη σελίδα· αν συνεχίζει, το api host είναι εκτός.'
              : raw || 'Αποτυχία φόρτωσης live στόλου';
          setPollError(msg);
        });
    };

    // Start poll immediately — do not wait for WebSocket.
    setTransport('poll');
    tick();
    pollTimer = window.setInterval(tick, 3000);

    const url = buildWsUrl(`/ws/telemetry/egress/${tenantId}`);
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
              const normalized = normalizeVehicle(msg, id, prev[id]);
              if (!normalized) return prev;
              return { ...prev, [id]: normalized };
            });
            return;
          }
          if (msg.type === 'fleet_driver_offline') {
            const id = vehicleIdFromRow(msg);
            setVehicles((prev) => {
              if (!prev[id]) {
                const matchKey = Object.keys(prev).find(
                  (k) =>
                    prev[k].driver_id === msg.driver_id &&
                    String(prev[k].trip_id) === String(msg.trip_id),
                );
                if (!matchKey) return prev;
                const next = { ...prev };
                delete next[matchKey];
                return next;
              }
              const next = { ...prev };
              delete next[id];
              return next;
            });
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
      if (pollTimer) window.clearInterval(pollTimer);
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
