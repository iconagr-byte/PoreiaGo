/**
 * Accumulate live GPS breadcrumbs for each active fleet vehicle.
 */

import { useEffect, useRef, useState } from 'react';

const EARTH_M = 6371000;

function haversineM(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function vehicleKey(v) {
  return String(v?.id || v?.vehicle_id || v?.driver_id || '');
}

/**
 * @param {Array<object>} vehicles
 * @param {{ maxPoints?: number, minMoveM?: number, enabled?: boolean }} [opts]
 * @returns {{ id: string, points: Array<{lat:number,lng:number}>, color?: string }[]}
 */
export function useFleetVehicleTrails(vehicles, opts = {}) {
  const maxPoints = opts.maxPoints ?? 450;
  const minMoveM = opts.minMoveM ?? 10;
  const enabled = opts.enabled !== false;
  const trailsRef = useRef(new Map());
  const [trails, setTrails] = useState([]);

  useEffect(() => {
    if (!enabled) {
      if (trailsRef.current.size) {
        trailsRef.current = new Map();
        setTrails([]);
      }
      return;
    }

    const list = Array.isArray(vehicles) ? vehicles : [];
    const active = new Set();
    let changed = false;

    for (const v of list) {
      const id = vehicleKey(v);
      if (!id) continue;
      active.add(id);

      const lat = Number(v.targetLat ?? v.lat);
      const lng = Number(v.targetLng ?? v.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      let pts = trailsRef.current.get(id);
      if (!pts) {
        pts = [{ lat, lng }];
        trailsRef.current.set(id, pts);
        changed = true;
        continue;
      }

      const last = pts[pts.length - 1];
      if (haversineM(last, { lat, lng }) < minMoveM) continue;

      pts.push({ lat, lng });
      if (pts.length > maxPoints) {
        pts.splice(0, pts.length - maxPoints);
      }
      changed = true;
    }

    for (const id of [...trailsRef.current.keys()]) {
      if (!active.has(id)) {
        trailsRef.current.delete(id);
        changed = true;
      }
    }

    if (changed) {
      setTrails(
        [...trailsRef.current.entries()].map(([id, points]) => ({
          id,
          points: points.slice(),
        })),
      );
    }
  }, [vehicles, maxPoints, minMoveM, enabled]);

  return trails;
}
