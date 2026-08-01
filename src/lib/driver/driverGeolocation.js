/**
 * Driver PWA — HTML5 geolocation watchPosition (high accuracy, ~2s publish).
 */

import { detectIosDevice, iosGeolocationOptions } from './iosPwaGps.js';

/** How often the driver app pushes GPS to the platform. */
export const DRIVER_GPS_INTERVAL_MS = 2000;

/** Hard floor — still well under backend driver_gps_max_per_minute (60). */
export const DRIVER_GPS_MIN_INTERVAL_MS = 1000;

/** Prefer a recent good fix over a noisy one. */
export const DRIVER_GPS_MAX_ACCURACY_M = 80;

/** Absolute junk — drop even when we have no better fix. */
export const DRIVER_GPS_REJECT_ACCURACY_M = 150;

/** Re-send last fix only briefly if getCurrentPosition fails (do not fake freshness forever). */
export const DRIVER_GPS_KEEPALIVE_MAX_AGE_MS = 15000;

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
    DRIVER_GPS_MIN_INTERVAL_MS,
    Number(intervalMs) || DRIVER_GPS_INTERVAL_MS,
  );
  const geoOptions = {
    ...iosGeolocationOptions(isIos),
    // Prefer a fresh fix at least as often as we publish.
    maximumAge: Math.min(publishEveryMs, isIos ? 2000 : 1500),
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

  return () => {
    navigator.geolocation.clearWatch(watchId);
    window.clearInterval(pollId);
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
