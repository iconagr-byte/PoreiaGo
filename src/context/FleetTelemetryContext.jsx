import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildWsUrl } from '../lib/wsUrl.js';
import { getSaasTenantId, getSaasToken } from '../services/saasApi.js';
import { decodeJwtPayload, getImpersonationTarget } from '../lib/saasJwt.js';

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
  const targetLat = Number(msg.lat);
  const targetLng = Number(msg.lng);
  const prevLat = prev?.lat ?? targetLat;
  const prevLng = prev?.lng ?? targetLng;
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
    timestamp: msg.timestamp,
    accuracy_m: msg.accuracy_m ?? null,
    altitude_m: msg.altitude_m ?? null,
    boarding: msg.boarding ?? null,
    sensors: msg.sensors ?? null,
    animStart: typeof performance !== 'undefined' ? performance.now() : 0,
  };
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
  const wsRef = useRef(null);

  useEffect(() => {
    const url = buildWsUrl(`/ws/telemetry/egress/${tenantId}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'fleet_snapshot' && Array.isArray(msg.vehicles)) {
          const map = {};
          msg.vehicles.forEach((v) => {
            const id = v.vehicle_id || `${v.bus_plate}-${v.trip_id}`;
            map[id] = normalizeVehicle(v, id);
          });
          setVehicles(map);
          return;
        }
        if (msg.type === 'fleet_location') {
          const id = msg.vehicle_id || msg.driver_id || `${msg.bus_plate}-${msg.trip_id}`;
          setVehicles((prev) => {
            const previous = prev[id];
            return {
              ...prev,
              [id]: normalizeVehicle(msg, id, previous),
            };
          });
          return;
        }
        if (msg.type === 'fleet_driver_offline') {
          const id = msg.vehicle_id || msg.driver_id || `${msg.bus_plate || 'bus'}-${msg.trip_id}`;
          setVehicles((prev) => {
            if (!prev[id]) {
              const matchKey = Object.keys(prev).find(
                (k) => prev[k].driver_id === msg.driver_id && String(prev[k].trip_id) === String(msg.trip_id),
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

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 25000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [tenantId]);

  const value = useMemo(
    () => ({
      connected,
      vehicles: Object.values(vehicles),
      vehicleMap: vehicles,
      tenantId,
    }),
    [connected, vehicles, tenantId],
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
