/**
 * Compact label for live-map bus pins: driver · excursion · speed.
 */

import { getTripById } from '../trips/tripStore.js';

export function resolveVehicleTripTitle(vehicle) {
  if (!vehicle) return '';
  const direct =
    vehicle.trip_title ||
    vehicle.tripTitle ||
    vehicle.excursion_name ||
    vehicle.excursionName ||
    '';
  if (String(direct).trim()) return String(direct).trim();

  const tripId = vehicle.trip_id ?? vehicle.tripId;
  if (tripId == null || tripId === '') return '';
  try {
    const trip = getTripById(tripId);
    if (trip?.title) return String(trip.title).trim();
  } catch {
    /* office trip catalog may be empty */
  }
  return `Εκδρομή #${tripId}`;
}

export function formatFleetBusPillLabel(vehicle, { shortDriver = true } = {}) {
  const rawName = String(vehicle?.driver_name || vehicle?.driverName || 'Οδηγός').trim() || 'Οδηγός';
  const driver = shortDriver ? rawName.split(/\s+/)[0] : rawName;
  const speed = Math.round(Number(vehicle?.speed) || Number(vehicle?.speed_kmh) || 0);
  const trip = resolveVehicleTripTitle(vehicle);
  if (trip) return `${driver} · ${trip} · ${speed} km/h`;
  return `${driver} · ${speed} km/h`;
}
