/**
 * Driver PWA — HTML5 geolocation watchPosition (high accuracy, every 5s).
 */

import { detectIosDevice, iosGeolocationOptions } from './iosPwaGps.js';

/** How often the driver app pushes GPS to the platform. */
export const DRIVER_GPS_INTERVAL_MS = 5000;

/** Shared last fix — SOS / incident reports must reuse this, not open a competing GPS request. */
let sharedLastCoords = null;

/**
 * @returns {{ lat: number, lng: number, accuracy_m: number|null, at: number } | null}
 */
export function getLastKnownDriverCoords() {
  return sharedLastCoords ? { ...sharedLastCoords } : null;
}

function rememberCoords(position) {
  if (!position?.coords) return;
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  sharedLastCoords = {
    lat: latitude,
    lng: longitude,
    accuracy_m: Number.isFinite(accuracy) ? accuracy : null,
    at: Date.now(),
  };
}

/**
 * Resolve coords for SOS without fighting the live GPS watch.
 * Prefers the last telemetry fix; optional short refresh only when none exists.
 */
export async function resolveCoordsForSos({ allowFresh = true } = {}) {
  const known = getLastKnownDriverCoords();
  if (known) return known;

  if (!allowFresh || !isGeolocationSupported()) {
    return { lat: 0, lng: 0, accuracy_m: null, at: Date.now(), approximate: true };
  }

  try {
    const fresh = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
            at: Date.now(),
          }),
        reject,
        {
          enableHighAccuracy: false,
          timeout: 2500,
          maximumAge: 60_000,
        },
      );
    });
    sharedLastCoords = {
      lat: fresh.lat,
      lng: fresh.lng,
      accuracy_m: fresh.accuracy_m ?? null,
      at: fresh.at,
    };
    return fresh;
  } catch {
    return { lat: 0, lng: 0, accuracy_m: null, at: Date.now(), approximate: true };
  }
}

/** Ask the active shift session to re-publish GPS (keeps live map pin alive after SOS). */
export function requestDriverGpsKeepalive() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('driver-gps-keepalive', { detail: { reason: 'sos' } }));
}

/**
 * @param {object} options
 * @param {(position: GeolocationPosition) => void} options.onPosition
 * @param {(error: GeolocationPositionError) => void} [options.onError]
 * @param {number} [options.intervalMs]
 * @returns {() => void} stop function
 */
export function startDriverGeolocationWatch({
  onPosition,
  onError,
  intervalMs = DRIVER_GPS_INTERVAL_MS,
} = {}) {
  if (!isGeolocationSupported()) {
    onError?.({ code: 0, message: 'Geolocation not supported' });
    return () => {};
  }

  const isIos = detectIosDevice();
  const geoOptions = {
    ...iosGeolocationOptions(isIos),
    // Prefer a fresh fix at least as often as we publish.
    maximumAge: Math.min(intervalMs, isIos ? 5000 : 4000),
  };

  let lastEmitAt = 0;
  let lastPos = null;

  const emit = (pos, { force = false } = {}) => {
    if (!pos) return;
    lastPos = pos;
    rememberCoords(pos);
    const now = Date.now();
    if (!force && lastEmitAt && now - lastEmitAt < intervalMs) {
      return;
    }
    lastEmitAt = now;
    onPosition(pos);
  };

  const watchId = navigator.geolocation.watchPosition(
    (pos) => emit(pos),
    (err) => onError?.(err),
    geoOptions,
  );

  // Guarantee a platform update every intervalMs even if watchPosition is quiet.
  const pollId = window.setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => emit(pos, { force: true }),
      () => {
        // If getCurrentPosition fails, re-send last known fix so the map stays alive.
        if (lastPos) emit(lastPos, { force: true });
      },
      { ...geoOptions, maximumAge: intervalMs, timeout: isIos ? 18000 : 12000 },
    );
  }, intervalMs);

  const onKeepalive = () => {
    if (lastPos) emit(lastPos, { force: true });
  };
  window.addEventListener('driver-gps-keepalive', onKeepalive);

  return () => {
    navigator.geolocation.clearWatch(watchId);
    window.clearInterval(pollId);
    window.removeEventListener('driver-gps-keepalive', onKeepalive);
  };
}

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function positionToTelemetryPayload(position, session, extras = {}) {
  const { latitude, longitude, speed, heading } = position.coords;
  const busPlate =
    extras.busPlate ||
    session?.busPlate ||
    session?.vehiclePlate ||
    session?.vehicleCode ||
    null;
  return {
    lat: latitude,
    lng: longitude,
    speed: speed != null ? Math.round(speed * 3.6 * 10) / 10 : 0,
    heading: heading != null && !Number.isNaN(heading) ? heading : null,
    driver_id: session?.driverId || session?.sub || null,
    tenant_id: session?.tenantId || null,
    trip_id: session?.tripId || null,
    timestamp: Date.now(),
    driver_name: extras.driverName || session?.driverName || null,
    bus_plate: busPlate,
    vehicle_code: busPlate,
  };
}
