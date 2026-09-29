/**
 * Live-map badge: whether the pin is from Teltonika hardware or the driver app.
 */

export function resolveFleetGpsSource(vehicle) {
  const raw = String(
    vehicle?.source || vehicle?.gps_source || vehicle?.gpsSource || '',
  )
    .trim()
    .toLowerCase();
  if (!raw) {
    // Bound IMEI without explicit source still reads as tracker.
    if (vehicle?.imei) return 'teltonika';
    return '';
  }
  if (raw.includes('teltonika') || raw === 'test_ping' || raw === 'tracker') {
    return 'teltonika';
  }
  if (
    raw.includes('driver') ||
    raw.includes('pwa') ||
    raw.includes('phone') ||
    raw.includes('app')
  ) {
    return 'app';
  }
  return '';
}

/** Short Greek label for the chip above the pin, or '' when unknown. */
export function formatFleetGpsSourceBadge(vehicle) {
  const kind = resolveFleetGpsSource(vehicle);
  if (kind === 'teltonika') return 'Teltonika';
  if (kind === 'app') return 'App οδηγού';
  return '';
}

export function fleetGpsSourceToneClass(vehicle) {
  const kind = resolveFleetGpsSource(vehicle);
  if (kind === 'teltonika') return 'fleet-apple-bus-gps-source--teltonika';
  if (kind === 'app') return 'fleet-apple-bus-gps-source--app';
  return '';
}
