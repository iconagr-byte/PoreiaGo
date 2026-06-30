import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/mapbox';

/** Fly Mapbox to latest SOS alert. */
export default function FleetMapFlyToMapbox({ alert, zoom = 14 }) {
  const { current: mapRef } = useMap();
  const lastIdRef = useRef(null);

  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map || !alert?.lat || !alert?.lng) return;
    if (alert.id && alert.id === lastIdRef.current) return;
    lastIdRef.current = alert.id ?? `${alert.lat}-${alert.lng}`;
    map.flyTo({ center: [alert.lng, alert.lat], zoom, duration: 1400, essential: true });
  }, [alert, mapRef, zoom]);

  return null;
}
