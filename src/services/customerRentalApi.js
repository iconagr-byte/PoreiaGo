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

export async function fetchCustomerRentalAvailability({
  startTime,
  endTime,
  category,
  minSeats,
  pickupLocation,
  dropoffLocation,
  driverMode,
  branch,
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
  if (branch) params.set('branch', branch);
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

export async function uploadCustomerRentalIdDoc(file, kind) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(
    `${API_BASE}/api/customer/rentals/id-docs/upload?kind=${encodeURIComponent(kind)}`,
    {
      method: 'POST',
      headers: {
        ...customerAuthHeaders(),
      },
      body: form,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join(', ')
          : data?.message || `Αποτυχία ανεβάσματος (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function fetchRentalContractTerms() {
  return customerRentalFetch('/contract');
}

export async function fetchRentalInsuranceCover() {
  return customerRentalFetch('/insurance-cover');
}

export async function fetchRentalSafetyContacts() {
  return publicRentalFetch('/safety-contacts');
}

export async function sendRentalSos(bookingId, body) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/sos`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateRentalLiveLocation(bookingId, body) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/location`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createRentalShareLink(bookingId) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/share-link`, {
    method: 'POST',
  });
}

export async function fetchRentalShare(token) {
  return publicRentalFetch(`/share/${encodeURIComponent(token)}`);
}

export async function uploadCustomerRentalSignature(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/customer/rentals/signature-upload`, {
    method: 'POST',
    headers: {
      ...customerAuthHeaders(),
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || `Αποτυχία υπογραφής (${res.status})`);
  }
  return data;
}

export async function cancelCustomerRentalBooking(bookingId) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
  });
}

export async function modifyCustomerRentalBooking(bookingId, body) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function customerRentalContractUrl(bookingId) {
  return `${API_BASE}/api/customer/rentals/bookings/${encodeURIComponent(bookingId)}/contract`;
}

export async function remindCustomerRentalBooking(bookingId) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/remind`, {
    method: 'POST',
  });
}

export async function createCustomerRentalPaymentIntent(bookingId) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/payment-intent`, {
    method: 'POST',
  });
}

export async function confirmCustomerRentalPayment(bookingId) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/confirm-payment`, {
    method: 'POST',
  });
}

export async function submitCustomerRentalReview(bookingId, body) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchCustomerRentalBranches() {
  const data = await customerRentalFetch('/branches');
  return data.branches || [];
}

export async function createCustomerRentalInspection(bookingId, body) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/inspections`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function uploadCustomerRentalPhoto(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/customer/rentals/photos/upload`, {
    method: 'POST',
    headers: {
      ...customerAuthHeaders(),
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || `Αποτυχία ανεβάσματος (${res.status})`);
  }
  return data;
}
