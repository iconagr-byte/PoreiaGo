/**
 * Driver PWA — HTML5 geolocation watchPosition (high accuracy, ~4s interval).
 */

import { detectIosDevice, iosGeolocationOptions } from './iosPwaGps.js';

const DEFAULT_INTERVAL_MS = 4000;

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * @param {object} options
 * @param {(position: GeolocationPosition) => void} options.onPosition
 * @param {(error: GeolocationPositionError) => void} [options.onError]
 * @param {number} [options.intervalMs]
 * @returns {() => void} stop function
 */
export function startDriverGeolocationWatch({ onPosition, onError, intervalMs = DEFAULT_INTERVAL_MS }) {
  if (!isGeolocationSupported()) {
    onError?.({ code: 0, message: 'Geolocation not supported' });
    return () => {};
  }

  const isIos = detectIosDevice();
  const geoOptions = iosGeolocationOptions(isIos);

  const watchId = navigator.geolocation.watchPosition(
    (pos) => onPosition(pos),
    (err) => onError?.(err),
    geoOptions,
  );

  // Some browsers throttle watchPosition — poll as backup every intervalMs
  const pollId = window.setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => onPosition(pos),
      () => {},
      { ...geoOptions, maximumAge: intervalMs, timeout: isIos ? 18000 : 12000 },
    );
  }, intervalMs);

  return () => {
    navigator.geolocation.clearWatch(watchId);
    window.clearInterval(pollId);
  };
}

export function positionToTelemetryPayload(position, session, extras = {}) {
  const { latitude, longitude, speed, heading } = position.coords;
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
    bus_plate: extras.busPlate || session?.busPlate || null,
  };
}
