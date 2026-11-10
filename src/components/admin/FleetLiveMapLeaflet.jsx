import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../styles/fleet-live-map.css';
import { useAnimatedFleetVehicles } from '../../hooks/useAnimatedFleetVehicles.js';
import { useFleetVehicleTrails } from '../../hooks/useFleetVehicleTrails.js';
import FleetHeatmapLayer from './FleetHeatmapLayer.jsx';
import FleetDriverPlaybackButton from './FleetDriverPlaybackButton.jsx';
import {
  fleetPinTelemetryHudHtml,
  formatBoardingLabel,
  formatHeadingLabel,
  formatPassengerNames,
  formatSensorSummary,
  formatSpeedKmh,
  formatUpdatedAgo,
  resolveFleetMarkerImage,
} from '../../lib/admin/fleetVehicleDetails.js';
import {
  formatFleetBusPillLabel,
  formatFleetExcursionBadge,
} from '../../lib/admin/fleetBusPillLabel.js';
import {
  fleetGpsSourceBadgeHtml,
  formatFleetGpsSourceBadge,
  resolveFleetGpsSources,
} from '../../lib/admin/fleetGpsSourceBadge.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import FleetGeofenceLayers from './FleetGeofenceLayers.jsx';
import FleetSosPins from './FleetSosPins.jsx';
import FleetMapFlyTo from './FleetMapFlyTo.jsx';
import FleetLiveTrailsLeaflet from './FleetLiveTrailsLeaflet.jsx';
import GreecePlacesLeafletLayer from './GreecePlacesLeafletLayer.jsx';
import { APPLE_LEAFLET_TILES } from '../../lib/maps/appleMapTheme.js';
import { resolveFleetFitMaxZoom, resolveFleetFitPadding } from '../../lib/admin/fleetMapFit.js';

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Avoid recreating L.divIcon every animation frame (reloads the photo). */
const BUS_ICON_CACHE = new Map();
const BUS_ICON_CACHE_MAX = 80;

const busIcon = (vehicle) => {
  const headingRaw = Number.isFinite(Number(vehicle?.heading)) ? Number(vehicle.heading) : 0;
  const heading = Math.round(headingRaw / 15) * 15;
  const speed = formatSpeedKmh(vehicle);
  const img = resolveSiteAssetUrl(resolveFleetMarkerImage(vehicle));
  const label = formatFleetBusPillLabel(vehicle);
  const excursion = formatFleetExcursionBadge(vehicle);
  const gpsBadge = fleetGpsSourceBadgeHtml(vehicle, { escapeAttr });
  const gpsKey = resolveFleetGpsSources(vehicle).join('+');
  const key = `${vehicle?.id || ''}|${img}|${heading}|${speed}|${label}|${excursion}|${gpsKey}`;
  const cached = BUS_ICON_CACHE.get(key);
  if (cached) return cached;

  const excursionHtml = excursion
    ? `<div class="fleet-apple-bus-excursion">${escapeAttr(excursion)}</div>`
    : '';
  const hudHtml = fleetPinTelemetryHudHtml(vehicle, { escapeAttr });
  const tall = Boolean(excursion || gpsBadge.heightBoost);
  // HUD (~34px) sits between plate pill and avatar — bump Leaflet hit box.
  const iconH = tall ? (gpsBadge.dual ? 156 : 148) : 110;
  const anchorY = tall ? (gpsBadge.dual ? 120 : 112) : 74;
  const icon = L.divIcon({
    className: 'fleet-bus-marker-ws',
    html: `<div class="fleet-apple-bus-pin">
      ${gpsBadge.html}
      ${excursionHtml}
      <div class="fleet-apple-bus-pill fleet-apple-bus-pill--above">${escapeAttr(label)}</div>
      ${hudHtml}
      <div class="fleet-apple-bus-pin__ring">
        <div class="fleet-apple-bus-pin__avatar"><img src="${escapeAttr(img)}" alt="" decoding="async" loading="eager" /></div>
        <div class="fleet-apple-bus-pin__heading" style="transform:translateX(-50%) rotate(${heading}deg)"></div>
      </div>
    </div>`,
    iconSize: [52, iconH],
    iconAnchor: [26, anchorY],
  });
  BUS_ICON_CACHE.set(key, icon);
  if (BUS_ICON_CACHE.size > BUS_ICON_CACHE_MAX) {
    const first = BUS_ICON_CACHE.keys().next().value;
    BUS_ICON_CACHE.delete(first);
  }
  return icon;
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
      <Popup>
        <div className="fleet-apple-popup">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <img
              src={resolveSiteAssetUrl(resolveFleetMarkerImage(v))}
              alt=""
              decoding="async"
              style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover' }}
            />
            <div>
              <div className="fleet-apple-popup__title">{v.driver_name}</div>
              <div className="fleet-apple-popup__meta">
                {v.bus_plate}
                {v.trip_title || v.trip_id ? ` · ${v.trip_title || `Εκδρομή #${v.trip_id}`}` : ''}
              </div>
            </div>
          </div>
          Ταχύτητα: {formatSpeedKmh(v)} km/h
          <br />
          Κατεύθυνση: {formatHeadingLabel(v) || '—'}
          <br />
          Πηγή GPS: {formatFleetGpsSourceBadge(v) || '—'}
          {resolveFleetGpsSources(v).length > 1 ? ' (και τα δύο ενεργά)' : ''}
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

/** Fit when the active pin *set* changes (or recenter) — zoom by pin count, never on GPS ticks. */
function FitBounds({ vehicles, fitNonce = 0 }) {
  const map = useMap();
  const fittedIdsRef = useRef('');
  const userMovedRef = useRef(false);
  const programmaticRef = useRef(false);
  const lastNonceRef = useRef(fitNonce);

  useEffect(() => {
    const markMoved = () => {
      if (programmaticRef.current) {
        programmaticRef.current = false;
        return;
      }
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
    const pts = vehicles.filter(
      (v) => Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)),
    );
    if (!pts.length) return;
    const ids = pts
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
    const count = pts.length;
    const maxZoom = resolveFleetFitMaxZoom(count);
    const pad = resolveFleetFitPadding(count);
    programmaticRef.current = true;
    if (count === 1) {
      map.setView([pts[0].lat, pts[0].lng], maxZoom, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(pts.map((v) => [v.lat, v.lng]));
    map.fitBounds(bounds, { padding: [pad, pad], maxZoom, animate: true });
  }, [vehicles, map, fitNonce]);

  return null;
}

/** Leaflet fallback — Apple-like soft basemap + ελληνικές ετικέτες. */
export default function FleetLiveMapLeaflet({
  vehicles,
  trailVehicles,
  center,
  heatmap = [],
  showHeat = false,
  geofenceLayers = null,
  mapAlerts = [],
  sosAlerts = [],
  showGeofence = false,
  showSosPins = true,
  showPlaces = true,
  showTrails = true,
  focusSosAlert = null,
  fitNonce = 0,
  onVehicleHistory,
  onClearSos = null,
}) {
  const fitPoints = useMemo(() => {
    const pts = vehicles.map((v) => ({ ...v, id: v.id || v.vehicle_id }));
    sosAlerts.forEach((a, i) => pts.push({ id: `sos-${a.id || i}`, lat: a.lat, lng: a.lng }));
    return pts;
  }, [vehicles, sosAlerts]);

  // Blue trail only for vehicles with an active excursion (parent may pass a subset).
  const trailSource = trailVehicles ?? vehicles;
  const trails = useFleetVehicleTrails(trailSource, {
    enabled: showTrails,
    maxPoints: 3000,
    minMoveM: 3,
  });

  return (
    <MapContainer
      center={center}
      zoom={6.4}
      className="h-full w-full"
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer
        attribution={APPLE_LEAFLET_TILES.attribution}
        url={APPLE_LEAFLET_TILES.url}
        subdomains={APPLE_LEAFLET_TILES.subdomains}
        maxZoom={APPLE_LEAFLET_TILES.maxZoom}
      />
      <ZoomControl position="bottomright" />
      <GreecePlacesLeafletLayer visible={showPlaces} />
      <FitBounds vehicles={fitPoints} fitNonce={fitNonce} />
      {focusSosAlert ? <FleetMapFlyTo alert={focusSosAlert} /> : null}
      <FleetGeofenceLayers layers={geofenceLayers} mapAlerts={mapAlerts} visible={showGeofence} />
      <FleetLiveTrailsLeaflet trails={trails} visible={showTrails} />
      <FleetSosPins alerts={sosAlerts} visible={showSosPins} onClearSos={onClearSos} />
      <FleetHeatmapLayer points={heatmap} visible={showHeat} />
      <LeafletAnimatedMarkers vehicles={vehicles} onVehicleHistory={onVehicleHistory} />
    </MapContainer>
  );
}
