/** Match active rental bookings onto live GPS pins (plate / gps_device_id / vehicle_id). */

function norm(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function overlayKeys(overlay) {
  return [overlay.gps_device_id, overlay.plate_number, overlay.vehicle_id]
    .map(norm)
    .filter(Boolean);
}

function vehicleKeys(vehicle) {
  return [
    vehicle.id,
    vehicle.vehicle_id,
    vehicle.bus_plate,
    vehicle.vehicle_code,
    vehicle.gps_device_id,
  ]
    .map(norm)
    .filter(Boolean);
}

/** Live-map / pill label — vehicle identity only (never renter name). */
export function rentalFleetMapLabel(overlay = {}, vehicle = {}) {
  const plate = String(
    overlay.plate_number || vehicle.bus_plate || vehicle.vehicle_code || '',
  )
    .trim()
    .toUpperCase();
  const device = String(overlay.gps_device_id || vehicle.gps_device_id || '').trim();
  if (plate) return `Ενοικίαση · ${plate}`;
  if (device) return `Ενοικίαση · device ${device}`;
  return 'Ενοικίαση · όχημα';
}

export function mergeRentalOverlays(vehicles, overlays) {
  if (!Array.isArray(vehicles) || !vehicles.length) return vehicles || [];
  if (!Array.isArray(overlays) || !overlays.length) return vehicles;

  const byKey = new Map();
  for (const ov of overlays) {
    for (const key of overlayKeys(ov)) {
      if (!byKey.has(key)) byKey.set(key, ov);
    }
  }

  return vehicles.map((v) => {
    let hit = null;
    for (const key of vehicleKeys(v)) {
      hit = byKey.get(key);
      if (hit) break;
    }
    if (!hit) return v;
    const mapLabel = rentalFleetMapLabel(hit, v);
    return {
      ...v,
      is_rental: true,
      rental_overlay: hit,
      // Kept for desk CRM only — never used as map / pin title.
      rental_client_name: hit.client_name,
      rental_booking_id: hit.booking_id,
      trip_title: mapLabel,
      driver_name: mapLabel,
    };
  });
}
