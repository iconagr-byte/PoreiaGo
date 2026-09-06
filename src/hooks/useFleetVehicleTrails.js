/**
 * Accumulate live GPS breadcrumbs for each active fleet vehicle.
 * Prefers server trail (full shift path) and keeps drawing while the pin is active.
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

function normalizeServerTrail(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const points = [];
  for (const p of raw) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push({
      lat,
      lng,
      t: p.t || p.recorded_at || null,
      s: Number.isFinite(Number(p.s ?? p.speed_kmh)) ? Number(p.s ?? p.speed_kmh) : null,
      h: Number.isFinite(Number(p.h ?? p.heading_deg)) ? Number(p.h ?? p.heading_deg) : null,
    });
  }
  return points.length ? points : null;
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

      if (serverPts && serverPts.length >= 1) {
        const prev = trailsRef.current.get(id);
        const sameLen = prev && prev.length === serverPts.length;
        const sameTail =
          sameLen &&
          Math.abs(prev[prev.length - 1].lat - serverPts[serverPts.length - 1].lat) < 1e-6 &&
          Math.abs(prev[prev.length - 1].lng - serverPts[serverPts.length - 1].lng) < 1e-6;
        if (!sameTail) {
          trailsRef.current.set(id, serverPts.slice(-maxPoints));
          changed = true;
        }
        continue;
      }

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
