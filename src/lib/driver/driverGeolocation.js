/**
 * Driver PWA — HTML5 geolocation watchPosition (high accuracy, every 5s).
 */

import { detectIosDevice, iosGeolocationOptions } from './iosPwaGps.js';

/** How often the driver app pushes GPS to the platform. */
export const DRIVER_GPS_INTERVAL_MS = 5000;

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
