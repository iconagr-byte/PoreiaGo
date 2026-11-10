import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/mapbox';

/** Fly Mapbox view to a selected fleet vehicle when focusNonce bumps. */
export default function FleetMapFocusVehicleMapbox({ vehicle, focusNonce = 0, zoom = 14 }) {
  const { current: mapRef } = useMap();
  const lastNonceRef = useRef(focusNonce);

  useEffect(() => {
    if (focusNonce === lastNonceRef.current) return;
    lastNonceRef.current = focusNonce;
    const map = mapRef?.getMap?.();
    if (!map?.flyTo) return;
    const lat = Number(vehicle?.lat);
    const lng = Number(vehicle?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.flyTo({ center: [lng, lat], zoom, duration: 850, essential: true });
  }, [vehicle, focusNonce, mapRef, zoom]);

  return null;
}
