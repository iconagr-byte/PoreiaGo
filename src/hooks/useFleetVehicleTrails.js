/**
 * Accumulate live GPS breadcrumbs for each active fleet vehicle.
 * Merges server trail (Redis shift path) with live pin append so the
 * route keeps growing while the bus moves — even when the API only
 * returns a short / 1-point trail.
 */

import { useEffect, useRef, useState } from 'react';
import {
  mergeVehicleTrail,
  normalizeServerTrail,
  sameTrailTip,
} from '../lib/maps/fleetTrailMerge.js';

export { haversineM, mergeVehicleTrail, normalizeServerTrail } from '../lib/maps/fleetTrailMerge.js';

function vehicleKey(v) {
  return String(v?.id || v?.vehicle_id || v?.driver_id || '');
}

/**
 * @param {Array<object>} vehicles
 * @param {{ maxPoints?: number, minMoveM?: number, enabled?: boolean, graceMs?: number }} [opts]
 * @returns {{ id: string, points: Array<{lat:number,lng:number,s?:number}>, color?: string }[]}
 */
export function useFleetVehicleTrails(vehicles, opts = {}) {
  const maxPoints = opts.maxPoints ?? 3000;
  const minMoveM = opts.minMoveM ?? 3;
  const enabled = opts.enabled !== false;
  const graceMs = opts.graceMs ?? 45000;
  const trailsRef = useRef(new Map());
  const lastSeenRef = useRef(new Map());
  const [trails, setTrails] = useState([]);

  useEffect(() => {
    if (!enabled) {
      if (trailsRef.current.size) {
        trailsRef.current = new Map();
        lastSeenRef.current = new Map();
        setTrails([]);
      }
      return;
    }

    const list = Array.isArray(vehicles) ? vehicles : [];
    const now = Date.now();
    const active = new Set();
    let changed = false;

    for (const v of list) {
      const id = vehicleKey(v);
      if (!id) continue;
      active.add(id);
      lastSeenRef.current.set(id, now);

      const serverPts = normalizeServerTrail(v.trail);
      const lat = Number(v.targetLat ?? v.lat);
      const lng = Number(v.targetLng ?? v.lng);
      const prev = trailsRef.current.get(id) || [];
      const next = mergeVehicleTrail(prev, serverPts, { lat, lng }, { maxPoints, minMoveM });

      const prevTip = prev[prev.length - 1];
      const nextTip = next[next.length - 1];
      if (prev.length !== next.length || !sameTrailTip(prevTip, nextTip)) {
        trailsRef.current.set(id, next);
        changed = true;
      }
    }

    for (const id of [...trailsRef.current.keys()]) {
      if (active.has(id)) continue;
      const seen = lastSeenRef.current.get(id) || 0;
      // Keep drawing briefly through poll gaps; drop after grace (shift ended).
      if (now - seen > graceMs) {
        trailsRef.current.delete(id);
        lastSeenRef.current.delete(id);
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
  }, [vehicles, maxPoints, minMoveM, enabled, graceMs]);

  return trails;
}
