import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, Popup, NavigationControl, useMap } from 'react-map-gl/mapbox';
import { LngLatBounds } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '../../styles/fleet-live-map.css';
import { MAPBOX_STYLE, MAPBOX_TOKEN } from '../../lib/maps/mapboxConfig.js';
import { useAnimatedFleetVehicles } from '../../hooks/useAnimatedFleetVehicles.js';
import FleetDriverPlaybackButton from './FleetDriverPlaybackButton.jsx';
import FleetGeofenceMapboxLayers from './FleetGeofenceMapboxLayers.jsx';
import FleetSosPinsMapbox from './FleetSosPinsMapbox.jsx';
import FleetMapFlyToMapbox from './FleetMapFlyToMapbox.jsx';
import GreecePlacesMapboxLayer from './GreecePlacesMapboxLayer.jsx';
import {
  formatBoardingLabel,
  formatPassengerNames,
  formatSensorSummary,
  formatUpdatedAgo,
  resolveFleetMarkerImage,
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

function BusMarker({ vehicle, onVehicleHistory }) {
  const [open, setOpen] = useState(false);
  const img = resolveFleetMarkerImage(vehicle);
  const shortName = String(vehicle.driver_name || 'Οδηγός').split(/\s+/)[0];
  const openHistory = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onVehicleHistory?.(vehicle);
  };
  return (
    <Marker longitude={vehicle.lng} latitude={vehicle.lat} anchor="center" onClick={() => setOpen(true)}>
      <button
        type="button"
        className="relative cursor-pointer border-0 bg-transparent p-0"
        onClick={() => setOpen(true)}
        onDoubleClick={openHistory}
      >
        <div className="fleet-apple-bus-pin">
          <div className="fleet-apple-bus-pill fleet-apple-bus-pill--above">
            {shortName} · {Math.round(vehicle.speed || 0)} km/h
          </div>
          <div className="fleet-apple-bus-pin__ring">
            <div className="fleet-apple-bus-pin__avatar">
              <img src={img} alt="" />
            </div>
            <div
              className="fleet-apple-bus-pin__heading"
              style={{
                transform: `translateX(-50%) rotate(${vehicle.heading ?? 0}deg)`,
              }}
            />
          </div>
        </div>
      </button>
      {open ? (
        <Popup
          longitude={vehicle.lng}
          latitude={vehicle.lat}
          anchor="top"
          offset={28}
          onClose={() => setOpen(false)}
          closeOnClick={false}
        >
          <div className="fleet-apple-popup text-sm">
            <div className="mb-2 flex items-center gap-2.5">
              <img src={img} alt="" className="h-12 w-12 rounded-[14px] object-cover" />
              <div>
                <div className="fleet-apple-popup__title">{vehicle.driver_name}</div>
                <div className="fleet-apple-popup__meta">{vehicle.bus_plate}</div>
              </div>
            </div>
            <div>Ταχύτητα: {Math.round(vehicle.speed || 0)} km/h</div>
            <div>Δρομολόγιο #{vehicle.trip_id ?? '—'}</div>
            <div>Ενημέρωση: {formatUpdatedAgo(vehicle.timestamp) || '—'}</div>
            {formatBoardingLabel(vehicle) ? <div>Επιβιβασμένοι: {formatBoardingLabel(vehicle)}</div> : null}
            {formatPassengerNames(vehicle) ? <div className="text-xs">{formatPassengerNames(vehicle)}</div> : null}
            {formatSensorSummary(vehicle) ? (
              <div className="text-xs text-slate-500">{formatSensorSummary(vehicle)}</div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <FleetDriverPlaybackButton vehicle={vehicle} />
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                onClick={openHistory}
              >
                Ιστορικό
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Διπλό κλικ στην κάρτα για ιστορικό</p>
          </div>
        </Popup>
      ) : null}
    </Marker>
  );
}

function MapboxAnimatedMarkers({ vehicles, onVehicleHistory }) {
  const display = useAnimatedFleetVehicles(vehicles);
  return display.map((v) => (
    <BusMarker key={v.id} vehicle={v} onVehicleHistory={onVehicleHistory} />
  ));
}

function FitBounds({ vehicles, fitNonce = 0 }) {
  const map = useMap();
  const fittedIdsRef = useRef('');
  const userMovedRef = useRef(false);
  const lastNonceRef = useRef(fitNonce);

  useEffect(() => {
    const mapInstance = map?.getMap?.() || map;
    if (!mapInstance?.on) return undefined;
    const markMoved = () => {
      userMovedRef.current = true;
    };
    mapInstance.on('dragstart', markMoved);
    mapInstance.on('zoomstart', markMoved);
    return () => {
      mapInstance.off('dragstart', markMoved);
      mapInstance.off('zoomstart', markMoved);
    };
  }, [map]);

  useEffect(() => {
    const mapInstance = map?.getMap?.() || map;
    if (!mapInstance || !vehicles?.length) return;
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
    const bounds = new LngLatBounds();
    vehicles.forEach((v) => {
      if (Number.isFinite(v.lng) && Number.isFinite(v.lat)) {
        bounds.extend([v.lng, v.lat]);
      }
    });
    if (bounds.isEmpty()) return;
    mapInstance.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: force ? 600 : 0 });
  }, [vehicles, map, fitNonce]);

  return null;
}

/** Mapbox GL — Apple light style + ελληνικές ετικέτες. */
export default function FleetLiveMapMapbox({
  vehicles,
  heatmap = [],
  showHeat = false,
  geofenceLayers = null,
  mapAlerts = [],
  sosAlerts = [],
  showGeofence = false,
  showSosPins = true,
  showPlaces = true,
  focusSosAlert = null,
  fitNonce = 0,
  onVehicleHistory,
}) {
  const initialViewState = useMemo(() => {
    if (vehicles.length) {
      return { longitude: vehicles[0].lng, latitude: vehicles[0].lat, zoom: 10 };
    }
    if (sosAlerts.length) {
      return { longitude: sosAlerts[0].lng, latitude: sosAlerts[0].lat, zoom: 12 };
    }
    return { longitude: 23.0, latitude: 38.5, zoom: 6.4 };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial only

  const fitVehicles = useMemo(() => {
    const extra = sosAlerts.map((a, i) => ({ id: `sos-${a.id || i}`, lat: a.lat, lng: a.lng }));
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
      <NavigationControl position="bottom-right" showCompass={false} />
      <GreecePlacesMapboxLayer visible={showPlaces} />
      <FitBounds vehicles={fitVehicles} fitNonce={fitNonce} />
      {focusSosAlert ? <FleetMapFlyToMapbox alert={focusSosAlert} /> : null}
      <FleetGeofenceMapboxLayers layers={geofenceLayers} mapAlerts={mapAlerts} visible={showGeofence} />
      <FleetSosPinsMapbox alerts={sosAlerts} visible={showSosPins} />
      <HeatmapDots points={heatmap} visible={showHeat} />
      <MapboxAnimatedMarkers vehicles={vehicles} onVehicleHistory={onVehicleHistory} />
    </Map>
  );
}
