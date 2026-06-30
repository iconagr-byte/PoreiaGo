import {
  fetchFleetPlateAvailability,
  fetchFleetVehicles,
  reportFleetDispatchBlocked,
} from '../../services/platformApi.js';

function normalizePlate(plate) {
  return String(plate || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function checkLocal(plate, vehicles) {
  const p = normalizePlate(plate);
  if (!p) return { available: true };
  const vehicle = vehicles.find((v) => normalizePlate(v.plate_number) === p);
  if (!vehicle) return { available: true, unknown_plate: true };

  if (vehicle.service_status === 'Urgent') {
    return {
      available: false,
      reason: 'Το όχημα έχει επείγουσα ανάγκη συντήρησης.',
      service_status: vehicle.service_status,
    };
  }

  if (vehicle.days_to_legal_deadline != null && vehicle.days_to_legal_deadline < 0) {
    return {
      available: false,
      reason: 'Το ΚΤΕΟ έχει λήξει.',
      service_status: vehicle.service_status,
    };
  }

  if (vehicle.service_status === 'Warning') {
    return {
      available: true,
      warning: 'Το όχημα πλησιάζει service — η κράτηση επιτρέπεται.',
      service_status: vehicle.service_status,
    };
  }

  return { available: true, service_status: vehicle.service_status };
}

/** @param {string | undefined} plate */
export async function checkTripVehicleAvailable(plate) {
  if (!plate) return { available: true };

  try {
    const api = await fetchFleetPlateAvailability(plate);
    if (api && typeof api.available === 'boolean') return api;
  } catch {
    /* fallback */
  }

  const vehicles = await fetchFleetVehicles();
  return checkLocal(plate, vehicles);
}

/** @param {{ vehiclePlate?: string, title?: string }} trip */
export async function checkTripAvailable(trip) {
  if (!trip?.vehiclePlate) return { available: true };
  const result = await checkTripVehicleAvailable(trip.vehiclePlate);
  if (result.available === false && result.reason) {
    reportFleetDispatchBlocked({
      plate: trip.vehiclePlate,
      reason: result.reason,
      tripTitle: trip.title,
    }).catch(() => {});
  }
  return result;
}
