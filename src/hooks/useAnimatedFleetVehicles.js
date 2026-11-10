import { useEffect, useRef, useState } from 'react';

/** Blend between GPS fixes — slightly over 1s poll so motion never sits idle. */
export const DEFAULT_ANIM_MS = 1200;
/** Keep coasting after ease so the pin does not freeze between tracker packets. */
export const DEFAULT_COAST_MS = 5000;
const NEAR_DEG = 0.00002;

/**
 * Move lat/lng along GPS heading (degrees clockwise from north) by speed×time.
 * `damp` < 1 softens coast so a late GPS fix does not overshoot hard.
 */
export function offsetLatLngByMotion(lat, lng, headingDeg, speedKmh, dtSec, damp = 0.85) {
  const kmh = Number(speedKmh) || 0;
  const heading = Number(headingDeg);
  const dt = Number(dtSec) || 0;
  if (!(kmh >= 3) || !Number.isFinite(heading) || !(dt > 0)) {
    return { lat, lng };
  }
  const meters = ((kmh * 1000) / 3600) * dt * damp;
  const rad = (heading * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111320;
  const cosLat = Math.cos((Number(lat) * Math.PI) / 180);
  const metersPerDegLng = 111320 * Math.max(0.2, Math.abs(cosLat) || 0.2);
  const dLng = (meters * Math.sin(rad)) / metersPerDegLng;
  return { lat: Number(lat) + dLat, lng: Number(lng) + dLng };
}

function coordsNear(aLat, aLng, bLat, bLng) {
  return (
    Number.isFinite(aLat) &&
    Number.isFinite(aLng) &&
    Number.isFinite(bLat) &&
    Number.isFinite(bLng) &&
    Math.abs(aLat - bLat) < NEAR_DEG &&
    Math.abs(aLng - bLng) < NEAR_DEG
  );
}

function vehicleKey(v) {
  return String(v?.id || v?.vehicle_id || v?.bus_plate || '');
}

function easeOutQuad(t) {
  return t * (2 - t);
}

function sampleMotion(st, now, animMs, coastMs) {
  const elapsed = Math.max(0, now - st.animStart);
  const t = Math.min(1, elapsed / animMs);
  const ease = easeOutQuad(t);
  let lat = st.fromLat + (st.targetLat - st.fromLat) * ease;
  let lng = st.fromLng + (st.targetLng - st.fromLng) * ease;
  if (t >= 1) {
    const coastElapsed = Math.min(Math.max(0, elapsed - animMs), coastMs);
    const coasted = offsetLatLngByMotion(
      st.targetLat,
      st.targetLng,
      st.heading,
      st.speed,
      coastElapsed / 1000,
    );
    lat = coasted.lat;
    lng = coasted.lng;
  }
  return { ...st, lat, lng, _t: t };
}

/**
 * Ομαλή κίνηση pin: συνέχεια από την τρέχουσα θέση + coast με ταχύτητα/κατεύθυνση
 * ώστε να μην «κολλάει» ανάμεσα στα GPS ticks.
 */
export function useAnimatedFleetVehicles(
  vehicles,
  animMs = DEFAULT_ANIM_MS,
  coastMs = DEFAULT_COAST_MS,
) {
  const [display, setDisplay] = useState([]);
  const stateRef = useRef(new Map());

  useEffect(() => {
    const now = performance.now();
    const nextIds = new Set();
    const list = Array.isArray(vehicles) ? vehicles : [];

    for (const v of list) {
      const id = vehicleKey(v);
      if (!id) continue;
      nextIds.add(id);
      const targetLat = Number(v.targetLat ?? v.lat);
      const targetLng = Number(v.targetLng ?? v.lng);
      if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) continue;

      const prev = stateRef.current.get(id);
      const heading = Number(v.heading ?? v.heading_deg);
      const speed = Number(v.speed ?? v.speed_kmh ?? 0);

      if (!prev) {
        stateRef.current.set(id, {
          ...v,
          id,
          fromLat: targetLat,
          fromLng: targetLng,
          targetLat,
          targetLng,
          animStart: now,
          heading,
          speed,
          lat: targetLat,
          lng: targetLng,
        });
        continue;
      }

      const cur = sampleMotion(prev, now, animMs, coastMs);
      const targetMoved = !coordsNear(prev.targetLat, prev.targetLng, targetLat, targetLng);

      if (targetMoved) {
        // Νέο GPS → συνέχισε από το σημείο που φαίνεται τώρα (χωρίς άλμα πίσω).
        stateRef.current.set(id, {
          ...v,
          id,
          fromLat: cur.lat,
          fromLng: cur.lng,
          targetLat,
          targetLng,
          animStart: now,
          heading: Number.isFinite(heading) ? heading : prev.heading,
          speed: Number.isFinite(speed) ? speed : prev.speed,
          lat: cur.lat,
          lng: cur.lng,
        });
      } else {
        stateRef.current.set(id, {
          ...prev,
          ...v,
          id,
          fromLat: prev.fromLat,
          fromLng: prev.fromLng,
          targetLat: prev.targetLat,
          targetLng: prev.targetLng,
          animStart: prev.animStart,
          heading: Number.isFinite(heading) ? heading : prev.heading,
          speed: Number.isFinite(speed) ? speed : prev.speed,
        });
      }
    }

    for (const id of [...stateRef.current.keys()]) {
      if (!nextIds.has(id)) stateRef.current.delete(id);
    }
  }, [vehicles, animMs, coastMs]);

  useEffect(() => {
    let raf = 0;
    const tick = (now) => {
      const out = [];
      for (const st of stateRef.current.values()) {
        out.push(sampleMotion(st, now, animMs, coastMs));
      }
      setDisplay(out);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animMs, coastMs]);

  return display;
}
