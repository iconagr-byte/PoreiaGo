import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

/** Fly to a selected fleet vehicle when focusNonce bumps (list / pin select). */
export default function FleetMapFocusVehicle({ vehicle, focusNonce = 0, zoom = 14 }) {
  const map = useMap();
  const lastNonceRef = useRef(focusNonce);

  useEffect(() => {
    if (focusNonce === lastNonceRef.current) return;
    lastNonceRef.current = focusNonce;
    const lat = Number(vehicle?.lat);
    const lng = Number(vehicle?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.flyTo([lat, lng], zoom, { duration: 0.85 });
  }, [vehicle, focusNonce, map, zoom]);

  return null;
}
