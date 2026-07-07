import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAnimatedFleetVehicles } from '../../hooks/useAnimatedFleetVehicles.js';
import FleetHeatmapLayer from './FleetHeatmapLayer.jsx';
import FleetDriverPlaybackButton from './FleetDriverPlaybackButton.jsx';
import {
  formatBoardingLabel,
  formatPassengerNames,
  formatSensorSummary,
} from '../../lib/admin/fleetVehicleDetails.js';
import FleetGeofenceLayers from './FleetGeofenceLayers.jsx';
import FleetSosPins from './FleetSosPins.jsx';
import FleetMapFlyTo from './FleetMapFlyTo.jsx';

const busIcon = (heading) =>
  L.divIcon({
    className: 'fleet-bus-marker-ws',
    html: `<div style="transform:rotate(${heading ?? 0}deg);background:#0040df;color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #facc15;font-size:18px">🚌</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

function LeafletAnimatedMarkers({ vehicles }) {
  const display = useAnimatedFleetVehicles(vehicles);

  return display.map((v) => (
    <Marker key={v.id} position={[v.lat, v.lng]} icon={busIcon(v.heading)}>
      <Tooltip direction="top" offset={[0, -18]} opacity={0.95} permanent={false}>
        <strong>{v.driver_name}</strong>
        <br />
        {v.bus_plate} · {Math.round(v.speed)} km/h
        {formatBoardingLabel(v) ? (
          <>
            <br />
            Επιβάτες: {formatBoardingLabel(v)}
          </>
        ) : null}
      </Tooltip>
      <Popup>
        <strong>{v.driver_name}</strong>
        <br />
        Πινακίδα: {v.bus_plate}
        <br />
        Ταχύτητα: {Math.round(v.speed)} km/h
        <br />
        Δρομολόγιο #{v.trip_id ?? '—'}
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
        <div className="mt-2">
          <FleetDriverPlaybackButton vehicle={v} />
        </div>
      </Popup>
    </Marker>
  ));
}

function FitBounds({ vehicles }) {
  const map = useMap();
  useEffect(() => {
    if (!vehicles?.length) return;
    const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
  }, [vehicles, map]);
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
}) {
  const fitPoints = useMemo(() => {
    const pts = vehicles.map((v) => [v.lat, v.lng]);
    sosAlerts.forEach((a) => pts.push([a.lat, a.lng]));
    return pts;
  }, [vehicles, sosAlerts]);

  return (
    <MapContainer center={center} zoom={7} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution="© OpenStreetMap · © CARTO"
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FitBounds vehicles={fitPoints.length ? fitPoints.map(([lat, lng]) => ({ lat, lng })) : vehicles} />
      {focusSosAlert ? <FleetMapFlyTo alert={focusSosAlert} /> : null}
      <FleetGeofenceLayers layers={geofenceLayers} mapAlerts={mapAlerts} visible={showGeofence} />
      <FleetSosPins alerts={sosAlerts} visible={showSosPins} />
      <FleetHeatmapLayer points={heatmap} visible={showHeat} />
      <LeafletAnimatedMarkers vehicles={vehicles} />
    </MapContainer>
  );
}
