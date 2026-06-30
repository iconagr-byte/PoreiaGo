import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

/** Fly map to latest SOS alert when a new one arrives. */
export default function FleetMapFlyTo({ alert, zoom = 14 }) {
  const map = useMap();
  const lastIdRef = useRef(null);

  useEffect(() => {
    if (!alert?.lat || !alert?.lng) return;
    if (alert.id && alert.id === lastIdRef.current) return;
    lastIdRef.current = alert.id ?? `${alert.lat}-${alert.lng}`;
    map.flyTo([alert.lat, alert.lng], zoom, { duration: 1.4 });
  }, [alert, map, zoom]);

  return null;
}
