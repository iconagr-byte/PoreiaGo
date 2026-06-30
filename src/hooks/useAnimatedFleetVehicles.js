import { useEffect, useState, useRef } from 'react';

const DEFAULT_ANIM_MS = 3500;

/**
 * Ομαλή μετάβαση δεικτών στόλου (ease-out quad) μεταξύ GPS pings.
 */
export function useAnimatedFleetVehicles(vehicles, animMs = DEFAULT_ANIM_MS) {
  const [display, setDisplay] = useState([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      setDisplay(
        vehicles.map((v) => {
          const start = v.animStart || now;
          const t = Math.min(1, (now - start) / animMs);
          const ease = t * (2 - t);
          return {
            ...v,
            lat: v.prevLat + (v.targetLat - v.prevLat) * ease,
            lng: v.prevLng + (v.targetLng - v.prevLng) * ease,
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
