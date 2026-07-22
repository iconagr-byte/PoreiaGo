import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../styles/fleet-live-map.css';
import { useAnimatedFleetVehicles } from '../../hooks/useAnimatedFleetVehicles.js';
import FleetHeatmapLayer from './FleetHeatmapLayer.jsx';
import FleetDriverPlaybackButton from './FleetDriverPlaybackButton.jsx';
import {
  formatBoardingLabel,
  formatPassengerNames,
  formatSensorSummary,
  formatUpdatedAgo,
  resolveFleetMarkerImage,
} from '../../lib/admin/fleetVehicleDetails.js';
import FleetGeofenceLayers from './FleetGeofenceLayers.jsx';
import FleetSosPins from './FleetSosPins.jsx';
import FleetMapFlyTo from './FleetMapFlyTo.jsx';

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const busIcon = (vehicle) => {
  const heading = Number.isFinite(vehicle?.heading) ? vehicle.heading : 0;
  const img = escapeAttr(resolveFleetMarkerImage(vehicle));
  const name = escapeAttr(vehicle?.driver_name || 'Οδηγός');
  const speed = Math.round(vehicle?.speed || 0);
  return L.divIcon({
    className: 'fleet-bus-marker-ws',
    html: `<div class="fleet-apple-bus-pin">
      <div class="fleet-apple-bus-pin__ring">
        <div class="fleet-apple-bus-pin__avatar"><img src="${img}" alt="" /></div>
        <div class="fleet-apple-bus-pin__heading" style="transform:translateX(-50%) rotate(${heading}deg)"></div>
      </div>
      <div class="fleet-apple-bus-pill">${name} · ${speed} km/h</div>
    </div>`,
    iconSize: [52, 72],
    iconAnchor: [26, 26],
  });
};

function LeafletAnimatedMarkers({ vehicles, onVehicleHistory }) {
  const display = useAnimatedFleetVehicles(vehicles);

  return display.map((v) => (
    <Marker
      key={v.id}
      position={[v.lat, v.lng]}
      icon={busIcon(v)}
      eventHandlers={{
        dblclick: (e) => {
          e.originalEvent?.preventDefault?.();
          e.originalEvent?.stopPropagation?.();
          onVehicleHistory?.(v);
        },
      }}
    >
      <Tooltip className="fleet-apple-tooltip" direction="top" offset={[0, -34]} opacity={1} permanent={false}>
        <strong>{v.driver_name}</strong>
        <br />
        {v.bus_plate} · {Math.round(v.speed)} km/h
      </Tooltip>
      <Popup>
        <div className="fleet-apple-popup" style={{ minWidth: 180 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <img
              src={resolveFleetMarkerImage(v)}
              alt=""
              style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover' }}
            />
            <div>
              <div className="fleet-apple-popup__title">{v.driver_name}</div>
              <div className="fleet-apple-popup__meta">{v.bus_plate}</div>
            </div>
          </div>
          Ταχύτητα: {Math.round(v.speed)} km/h
          <br />
          Δρομολόγιο #{v.trip_id ?? '—'}
          <br />
          Ενημέρωση: {formatUpdatedAgo(v.timestamp) || '—'}
          {formatBoardingLabel(v) ? (
            <>
              <br />
              Επιβιβασμένοι: {formatBoardingLabel(v)}
            </>
          ) : null}
          {formatPassengerNames(v) ? (
            <>
              <br />
              <span className="text-xs">{formatPassengerNames(v)}</span>
            </>
          ) : null}
          {formatSensorSummary(v) ? (
            <>
              <br />
              <span className="text-xs text-gray-500">{formatSensorSummary(v)}</span>
            </>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <FleetDriverPlaybackButton vehicle={v} />
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
              onClick={() => onVehicleHistory?.(v)}
            >
              Ιστορικό
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>Διπλό κλικ στο pin για ιστορικό</p>
        </div>
      </Popup>
    </Marker>
  ));
}

/** Fit only when the vehicle *set* changes or when parent requests recenter — never on GPS ticks. */
function FitBounds({ vehicles, fitNonce = 0 }) {
  const map = useMap();
  const fittedIdsRef = useRef('');
  const userMovedRef = useRef(false);
  const lastNonceRef = useRef(fitNonce);

  useEffect(() => {
    const markMoved = () => {
      userMovedRef.current = true;
    };
    map.on('dragstart', markMoved);
    map.on('zoomstart', markMoved);
    return () => {
      map.off('dragstart', markMoved);
      map.off('zoomstart', markMoved);
    };
  }, [map]);

  useEffect(() => {
    if (!vehicles?.length) return;
    const ids = vehicles
      .map((v) => v.id || v.vehicle_id || `${v.lat},${v.lng}`)
      .sort()
      .join('|');
    const force = fitNonce !== lastNonceRef.current;
    if (force) {
      userMovedRef.current = false;
      lastNonceRef.current = fitNonce;
    } else if (userMovedRef.current) {
      return;
    } else if (ids === fittedIdsRef.current) {
      return;
    }
    fittedIdsRef.current = ids;
    const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng]));
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 14 });
  }, [vehicles, map, fitNonce]);

  return null;
}

/** Leaflet fallback — χωρίς Mapbox token. */
export default function FleetLiveMapLeaflet({
  vehicles,
  center,
  heatmap = [],
  showHeat = false,
  geofenceLayers = null,
  mapAlerts = [],
  sosAlerts = [],
  showGeofence = false,
  showSosPins = true,
  focusSosAlert = null,
  fitNonce = 0,
  onVehicleHistory,
}) {
  const fitPoints = useMemo(() => {
    const pts = vehicles.map((v) => ({ ...v, id: v.id || v.vehicle_id }));
    sosAlerts.forEach((a, i) => pts.push({ id: `sos-${a.id || i}`, lat: a.lat, lng: a.lng }));
    return pts;
  }, [vehicles, sosAlerts]);

  return (
    <MapContainer center={center} zoom={7} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution="© OpenStreetMap · © CARTO"
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FitBounds vehicles={fitPoints} fitNonce={fitNonce} />
      {focusSosAlert ? <FleetMapFlyTo alert={focusSosAlert} /> : null}
      <FleetGeofenceLayers layers={geofenceLayers} mapAlerts={mapAlerts} visible={showGeofence} />
      <FleetSosPins alerts={sosAlerts} visible={showSosPins} />
      <FleetHeatmapLayer points={heatmap} visible={showHeat} />
      <LeafletAnimatedMarkers vehicles={vehicles} onVehicleHistory={onVehicleHistory} />
    </MapContainer>
  );
}
