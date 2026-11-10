/**
 * Driver PWA — HTML5 geolocation watchPosition (high accuracy, every 1s).
 */

import { LIVE_REFRESH_MS } from '../liveRefresh.js';
import { detectIosDevice, iosGeolocationOptions } from './iosPwaGps.js';

/** How often the driver app pushes GPS to the platform. */
export const DRIVER_GPS_INTERVAL_MS = LIVE_REFRESH_MS;

/** Shared last fix — SOS reuses this so it never opens a competing high-accuracy request. */
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
 * Coords for SOS / incident — prefer last shift fix; never starts a shift.
 * Fresh request (if needed) uses low accuracy so it won't fight live GPS.
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
          timeout: 4000,
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

/**
 * Ask an *already online* shift to re-publish GPS after SOS.
 * Must never start a new shift (listener guards on SHIFT_KEY).
 */
export function requestDriverGpsKeepalive() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('driver-gps-keepalive', { detail: { reason: 'sos' } }));
}

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
  const publishEveryMs = Math.max(
    DRIVER_GPS_INTERVAL_MS,
    Number(intervalMs) || DRIVER_GPS_INTERVAL_MS,
  );
  const geoOptions = {
    ...iosGeolocationOptions(isIos),
    // Prefer a fresh fix at least as often as we publish.
    maximumAge: Math.min(publishEveryMs, isIos ? 1000 : 1000),
  };

  let lastEmitAt = 0;
  let lastPos = null;
  let lastGoodPos = null;

  const accuracyM = (pos) => {
    const a = pos?.coords?.accuracy;
    return a != null && Number.isFinite(a) ? Number(a) : null;
  };

  const fixAgeMs = (pos) => {
    const ts = Number(pos?.timestamp);
    if (!Number.isFinite(ts)) return Infinity;
    return Math.max(0, Date.now() - ts);
  };

  const emit = (pos, { force = false } = {}) => {
    if (!pos) return;
    lastPos = pos;
    rememberCoords(pos);
    const now = Date.now();
    const acc = accuracyM(pos);
    const goodAge = lastGoodPos ? fixAgeMs(lastGoodPos) : Infinity;

    if (acc != null && acc > DRIVER_GPS_REJECT_ACCURACY_M) {
      return;
    }
    // Keep the pin accurate: skip noisy fixes when a recent good one exists.
    if (acc != null && acc > DRIVER_GPS_MAX_ACCURACY_M && goodAge < 30000) {
      if (force && lastGoodPos && (!lastEmitAt || now - lastEmitAt >= publishEveryMs)) {
        lastEmitAt = now;
        lastPos = lastGoodPos;
        onPosition(lastGoodPos);
      }
      return;
    }

    if (!force && lastEmitAt && now - lastEmitAt < publishEveryMs) {
      lastPos = pos;
      if (acc == null || acc <= DRIVER_GPS_MAX_ACCURACY_M) lastGoodPos = pos;
      return;
    }

    lastPos = pos;
    if (acc == null || acc <= DRIVER_GPS_MAX_ACCURACY_M) lastGoodPos = pos;
    lastEmitAt = now;
    onPosition(pos);
  };

  const watchId = navigator.geolocation.watchPosition(
    (pos) => emit(pos),
    (err) => onError?.(err),
    geoOptions,
  );

  // Guarantee a platform update every interval even if watchPosition is quiet.
  const pollId = window.setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => emit(pos, { force: true }),
      () => {
        // Brief keepalive only — never refresh a frozen fix with a new timestamp forever.
        const candidate = lastGoodPos || lastPos;
        if (!candidate) return;
        if (fixAgeMs(candidate) > DRIVER_GPS_KEEPALIVE_MAX_AGE_MS) return;
        emit(candidate, { force: true });
      },
      { ...geoOptions, maximumAge: publishEveryMs, timeout: isIos ? 18000 : 12000 },
    );
  }, publishEveryMs);

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
  const fixTs = Number(position?.timestamp);
  return {
    lat: latitude,
    lng: longitude,
    speed: speed != null ? Math.round(speed * 3.6 * 10) / 10 : 0,
    heading: heading != null && !Number.isNaN(heading) ? heading : null,
    driver_id: session?.driverId || session?.sub || null,
    tenant_id: session?.tenantId || null,
    trip_id: session?.tripId || null,
    // Prefer the GPS fix time so keepalive cannot fake "live" freshness.
    timestamp: Number.isFinite(fixTs) && fixTs > 0 ? fixTs : Date.now(),
    driver_name: extras.driverName || session?.driverName || null,
    bus_plate: busPlate,
    vehicle_code: busPlate,
  };
}
