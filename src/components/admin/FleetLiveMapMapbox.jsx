import { useEffect, useMemo } from 'react';
import Map, { Marker, useMap } from 'react-map-gl/mapbox';
import { LngLatBounds } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_STYLE, MAPBOX_TOKEN } from '../../lib/maps/mapboxConfig.js';
import { useAnimatedFleetVehicles } from '../../hooks/useAnimatedFleetVehicles.js';
import FleetDriverPlaybackButton from './FleetDriverPlaybackButton.jsx';
import FleetGeofenceMapboxLayers from './FleetGeofenceMapboxLayers.jsx';
import FleetSosPinsMapbox from './FleetSosPinsMapbox.jsx';
import FleetMapFlyToMapbox from './FleetMapFlyToMapbox.jsx';
import {
  formatBoardingLabel,
  formatPassengerNames,
  formatSensorSummary,
} from '../../lib/admin/fleetVehicleDetails.js';

function HeatmapDots({ points = [], visible = true }) {
  if (!visible || !points.length) return null;
  const maxWeight = Math.max(...points.map((p) => p.weight), 1);
  return points.map((p, i) => {
    const scale = 0.35 + (p.weight / maxWeight) * 0.85;
    return (
      <Marker key={`heat-${p.lat}-${p.lng}-${i}`} longitude={p.lng} latitude={p.lat} anchor="center">
        <div
          className="rounded-full border border-orange-500 bg-red-500/40"
          style={{
            width: `${16 * scale}px`,
            height: `${16 * scale}px`,
          }}
          aria-hidden
        />
      </Marker>
    );
  });
}

function BusMarker({ vehicle }) {
  return (
    <Marker longitude={vehicle.lng} latitude={vehicle.lat} anchor="center">
      <div className="relative cursor-pointer">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#facc15] bg-[#0040df] text-lg text-white shadow-lg"
          style={{ transform: `rotate(${vehicle.heading ?? 0}deg)` }}
          aria-label={`${vehicle.driver_name}, ${vehicle.bus_plate}`}
        >
          🚌
        </div>
        <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-bold text-white shadow">
          {vehicle.driver_name}
        </div>
      </div>
    </Marker>
  );
}

function MapboxAnimatedMarkers({ vehicles }) {
  const display = useAnimatedFleetVehicles(vehicles);
  return display.map((v) => <BusMarker key={v.id} vehicle={v} />);
}

function FitBounds({ vehicles }) {
  const map = useMap();

  useEffect(() => {
    const mapInstance = map?.getMap?.() || map;
    if (!mapInstance || !vehicles?.length) return;
    const bounds = new LngLatBounds();
    vehicles.forEach((v) => {
      if (Number.isFinite(v.lng) && Number.isFinite(v.lat)) {
        bounds.extend([v.lng, v.lat]);
      }
    });
    if (bounds.isEmpty()) return;
    mapInstance.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 800 });
  }, [vehicles, map]);

  return null;
}

/** Mapbox GL — react-map-gl με ομαλή κίνηση δεικτών. */
export default function FleetLiveMapMapbox({
  vehicles,
  heatmap = [],
  showHeat = false,
  geofenceLayers = null,
  mapAlerts = [],
  sosAlerts = [],
  showGeofence = false,
  showSosPins = true,
  focusSosAlert = null,
}) {
  const initialViewState = useMemo(() => {
    if (vehicles.length) {
      return { longitude: vehicles[0].lng, latitude: vehicles[0].lat, zoom: 10 };
    }
    if (sosAlerts.length) {
      return { longitude: sosAlerts[0].lng, latitude: sosAlerts[0].lat, zoom: 12 };
    }
    return { longitude: 23.0, latitude: 38.5, zoom: 7 };
  }, [vehicles, sosAlerts]);

  const fitVehicles = useMemo(() => {
    const extra = sosAlerts.map((a) => ({ lat: a.lat, lng: a.lng }));
    return [...vehicles, ...extra];
  }, [vehicles, sosAlerts]);

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={initialViewState}
      mapStyle={MAPBOX_STYLE}
      style={{ width: '100%', height: '100%' }}
      attributionControl
    >
      <FitBounds vehicles={fitVehicles} />
      {focusSosAlert ? <FleetMapFlyToMapbox alert={focusSosAlert} /> : null}
      <FleetGeofenceMapboxLayers layers={geofenceLayers} mapAlerts={mapAlerts} visible={showGeofence} />
      <FleetSosPinsMapbox alerts={sosAlerts} visible={showSosPins} />
      <HeatmapDots points={heatmap} visible={showHeat} />
      <MapboxAnimatedMarkers vehicles={vehicles} />
    </Map>
  );
}
