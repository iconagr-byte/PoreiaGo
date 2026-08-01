import { useEffect, useState, useRef } from 'react';
import { FLEET_MARKER_ANIM_MS, easeOutQuad } from '../lib/admin/fleetMarkerMotion.js';

export { FLEET_MARKER_ANIM_MS };

/**
 * Ομαλή μετάβαση δεικτών στόλου (ease-out quad) μεταξύ GPS pings.
 * Duration stays under the active 1s poll so pins do not lag a full cycle behind.
 */
export function useAnimatedFleetVehicles(vehicles, animMs = FLEET_MARKER_ANIM_MS) {
  const [display, setDisplay] = useState([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      setDisplay(
        vehicles.map((v) => {
          const start = v.animStart || now;
          const t = easeOutQuad((now - start) / animMs);
          const prevLat = Number.isFinite(v.prevLat) ? v.prevLat : v.targetLat;
          const prevLng = Number.isFinite(v.prevLng) ? v.prevLng : v.targetLng;
          return {
            ...v,
            lat: prevLat + (v.targetLat - prevLat) * t,
            lng: prevLng + (v.targetLng - prevLng) * t,
          };
        }),
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [vehicles, animMs]);

  return display;
}
