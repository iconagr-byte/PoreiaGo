/**
 * Full driver telemetry envelope — GPS, boarding manifest, device sensors.
 */

import { positionToTelemetryPayload } from './driverGeolocation.js';

export function manifestToBoardingSnapshot(manifest) {
  if (!manifest) return null;
  const boarded = manifest.boarded_passengers ?? [];
  return {
    boarded_count: manifest.boarded_count ?? boarded.length,
    capacity: manifest.capacity ?? null,
    progress_label: manifest.progress_label ?? null,
    progress_percent: manifest.progress_percent ?? null,
    boarded_passengers: boarded.map((p) => ({
      booking_id: p.booking_id ?? p.id ?? null,
      passenger_name: p.passenger_name ?? p.customer_name ?? p.name ?? '—',
      seat_number: p.seat_number ?? p.seat ?? null,
      boarded_at: p.boarded_at ?? null,
    })),
  };
}

function gpsExtrasFromPosition(position) {
  const { accuracy, altitude, altitudeAccuracy } = position.coords;
  return {
    accuracy_m: accuracy != null ? Math.round(accuracy * 10) / 10 : null,
    altitude_m: altitude != null ? Math.round(altitude * 10) / 10 : null,
    altitude_accuracy_m:
      altitudeAccuracy != null ? Math.round(altitudeAccuracy * 10) / 10 : null,
  };
}

/**
 * @param {GeolocationPosition} position
 * @param {object} session
 * @param {object} [extras]
 */
export function buildDriverTelemetryPayload(position, session, extras = {}) {
  const base = positionToTelemetryPayload(position, session, {
    driverName: extras.driverName,
    busPlate: extras.busPlate,
  });

  const boarding = manifestToBoardingSnapshot(extras.manifest);
  const sensors = extras.sensors || null;

  const payload = {
    ...base,
    ...gpsExtrasFromPosition(position),
    boarding,
    sensors,
  };

  if (sensors?.acceleration) {
    payload.accel_x = sensors.acceleration.x;
    payload.accel_y = sensors.acceleration.y;
    payload.accel_z = sensors.acceleration.z;
  }

  return payload;
}
