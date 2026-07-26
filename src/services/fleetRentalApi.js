import { API_BASE } from '../config/api.js';
import { saasAuthHeaders } from './saasApi.js';

async function rentalFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}/api/admin/platform/fleet-rental${path}`, {
    ...options,
    headers: {
      ...saasAuthHeaders(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join(', ')
          : data?.message || `Σφάλμα ενοικίασης (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function fetchRentalSummary() {
  return rentalFetch('/summary');
}

export async function fetchRentalVehicles(category) {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  const data = await rentalFetch(`/vehicles${q}`);
  return data.vehicles || [];
}

export async function createRentalVehicle(body) {
  return rentalFetch('/vehicles', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateRentalVehicle(id, body) {
  return rentalFetch(`/vehicles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteRentalVehicle(id) {
  const res = await fetch(`${API_BASE}/api/admin/platform/fleet-rental/vehicles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: saasAuthHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Αποτυχία διαγραφής');
  }
}

export async function fetchRentalAvailability({ startTime, endTime, category, minSeats }) {
  const params = new URLSearchParams({
    start_time: startTime,
    end_time: endTime,
  });
  if (category) params.set('category', category);
  if (minSeats) params.set('min_seats', String(minSeats));
  const data = await rentalFetch(`/availability?${params}`);
  return data.vehicles || [];
}

export async function fetchRentalBookings({ vehicleId, status } = {}) {
  const params = new URLSearchParams();
  if (vehicleId) params.set('vehicle_id', vehicleId);
  if (status) params.set('status', status);
  const q = params.toString() ? `?${params}` : '';
  const data = await rentalFetch(`/bookings${q}`);
  return data.bookings || [];
}

export async function createRentalBooking(body) {
  return rentalFetch('/bookings', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateRentalBookingStatus(id, rentalStatus) {
  return rentalFetch(`/bookings/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ rental_status: rentalStatus }),
  });
}

export async function fetchRentalCalendar(days = 30) {
  const data = await rentalFetch(`/calendar?days=${days}`);
  return data.blocks || [];
}

export async function fetchRentalInspections(bookingId) {
  const q = bookingId ? `?booking_id=${encodeURIComponent(bookingId)}` : '';
  const data = await rentalFetch(`/inspections${q}`);
  return data.inspections || [];
}

export async function createRentalInspection(body) {
  return rentalFetch('/inspections', { method: 'POST', body: JSON.stringify(body) });
}
