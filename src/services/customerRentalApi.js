import { API_BASE } from '../config/api.js';
import { customerAuthHeaders } from './customerAuthApi.js';

async function customerRentalFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}/api/customer/rentals${path}`, {
    ...options,
    headers: {
      ...customerAuthHeaders(),
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

export async function fetchCustomerRentalCatalog(category) {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  const data = await customerRentalFetch(`/catalog${q}`);
  return data.vehicles || [];
}

async function publicRentalFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}/api/customer/rentals${path}`, options);
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

export async function fetchPublicRentalCatalog(category) {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  const data = await publicRentalFetch(`/public/catalog${q}`);
  return data.vehicles || [];
}

/** Guest rental booking lookup — email + RB-… (or booking id). */
export async function lookupPublicRentalBooking({ email, reference }) {
  const data = await publicRentalFetch('/public/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      reference: String(reference || '').trim(),
    }),
  });
  return data.booking || null;
}

function availabilityParams({
  startTime,
  endTime,
  category,
  minSeats,
  pickupLocation,
  dropoffLocation,
  driverMode,
}) {
  const params = new URLSearchParams({
    start_time: startTime,
    end_time: endTime,
  });
  if (category) params.set('category', category);
  if (minSeats) params.set('min_seats', String(minSeats));
  if (pickupLocation) params.set('pickup_location', pickupLocation);
  if (dropoffLocation) params.set('dropoff_location', dropoffLocation);
  if (driverMode) params.set('driver_mode', driverMode);
  return params;
}

export async function fetchPublicRentalAvailability(args) {
  const params = availabilityParams(args);
  const data = await publicRentalFetch(`/public/availability?${params}`);
  return data.vehicles || [];
}

export async function fetchCustomerRentalAvailability(args) {
  const params = availabilityParams(args);
  const data = await customerRentalFetch(`/availability?${params}`);
  return data.vehicles || [];
}

export async function fetchMyRentalBookings() {
  const data = await customerRentalFetch('/bookings');
  return data.bookings || [];
}

export async function createCustomerRentalBooking(body) {
  return customerRentalFetch('/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function cancelCustomerRentalBooking(bookingId) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
  });
}
