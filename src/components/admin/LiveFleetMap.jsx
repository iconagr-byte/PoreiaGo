import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchHeatmap, fetchLiveFleet } from '../../services/telemetryApi.js';
import { adminAuthHeaders } from '../../services/adminApi.js';
import { clampFleetLivePollMs } from '../../lib/admin/fleetLivePoll.js';

const busIcon = L.divIcon({
  className: 'fleet-bus-marker',
  html: '<div style="background:#0040df;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #facc15;font-weight:bold;font-size:14px">🚌</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function FitBounds({ vehicles }) {
  const map = useMap();
  useEffect(() => {
    if (!vehicles?.length) return;
    const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, [vehicles, map]);
  return null;
}

/**
 * Live fleet map — Leaflet (works without Mapbox token).
 * Set VITE_MAPBOX_TOKEN and swap TileLayer URL for Mapbox GL in production.
 */
export default function LiveFleetMap({ authHeaders = adminAuthHeaders(), pollMs = 5000 }) {
  const [vehicles, setVehicles] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [showHeat, setShowHeat] = useState(true);
  const refreshMs = clampFleetLivePollMs(pollMs);

  useEffect(() => {
    const headers = authHeaders || adminAuthHeaders();
    const load = () => {
      fetchLiveFleet(headers).then(setVehicles);
      fetchHeatmap({ days: 7 }, headers).then(setHeatmap);
    };
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [authHeaders, refreshMs]);

  const center = useMemo(() => {
    if (vehicles.length) return [vehicles[0].lat, vehicles[0].lng];
    return [38.5, 23.0];
  }, [vehicles]);

  const maxWeight = Math.max(...heatmap.map((h) => h.weight), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="font-headline-md font-bold">Live Fleet Tracking</h2>
          <p className="text-sm text-on-surface-variant">
            {vehicles.length} ενεργά οχήματα · refresh {refreshMs / 1000}s
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
          <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
          Heatmap στάσεων
        </label>
      </div>

      <div className="h-[min(70vh,560px)] rounded-[24px] overflow-hidden border border-black/[0.08] shadow-level-2">
        <MapContainer center={center} zoom={7} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution="© OpenStreetMap · © CARTO"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <FitBounds vehicles={vehicles} />
          {showHeat &&
            heatmap.map((p, i) => (
              <CircleMarker
                key={`h-${i}`}
                center={[p.lat, p.lng]}
                radius={8 + (p.weight / maxWeight) * 24}
                pathOptions={{
                  color: '#f97316',
                  fillColor: '#ef4444',
                  fillOpacity: 0.25 + (p.weight / maxWeight) * 0.45,
                  weight: 1,
                }}
              />
            ))}
          {vehicles.map((v) => (
            <Marker key={v.vehicle_id} position={[v.lat, v.lng]} icon={busIcon}>
              <Popup>
                <strong>{v.vehicle_code}</strong>
                <br />
                Trip {v.trip_id} · {v.speed_kmh} km/h
                <br />
                {v.engine_on ? 'Engine ON' : 'Engine OFF'}
                <br />
                Idle: {Math.floor(v.idle_seconds_trip / 60)} min
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {vehicles.map((v) => (
          <div
            key={v.vehicle_id}
            className={`p-4 rounded-2xl border ${
              v.speed_kmh < 3 && v.engine_on
                ? 'border-amber-400 bg-amber-50'
                : 'border-black/[0.06] bg-white'
            }`}
          >
            <div className="font-bold">{v.vehicle_code}</div>
            <div className="text-sm text-gray-500 mt-1">
              {v.speed_kmh < 3 && v.engine_on ? '⚠️ Idling' : `${v.speed_kmh} km/h`}
            </div>
            <div className="text-xs mt-2">Idle trip: {Math.floor(v.idle_seconds_trip / 60)} min</div>
          </div>
        ))}
      </div>
    </div>
  );
}
