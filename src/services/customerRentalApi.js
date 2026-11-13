import { getApiBase } from '../config/api.js';
import { customerAuthHeaders } from './customerAuthApi.js';
import {
  isNativeRentDemo,
  NATIVE_RENT_DEMO_OFFICE_HOST,
} from '../lib/rental/nativeRentDemo.js';

async function sealedOfficeHeaders() {
  const headers = {};
  try {
    const { getWalletTenantId } = await import('../lib/wallet/walletTenantSeal.js');
    const tid = getWalletTenantId();
    if (tid) headers['X-Wallet-Tenant-Id'] = tid;
  } catch {
    /* ignore */
  }
  if (isNativeRentDemo()) {
    headers['X-Office-Host'] = NATIVE_RENT_DEMO_OFFICE_HOST;
  }
  return headers;
}

function withTenantQuery(path) {
  try {
    // Sync read — seal is in localStorage.
    const tid =
      typeof localStorage !== 'undefined'
        ? String(localStorage.getItem('wallet_tenant_id') || '').trim()
        : '';
    if (!tid) return path;
    const join = path.includes('?') ? '&' : '?';
    return `${path}${join}tenant_id=${encodeURIComponent(tid)}`;
  } catch {
    return path;
  }
}

async function customerRentalFetch(path, options = {}) {
  const officeHeaders = await sealedOfficeHeaders();
  const res = await fetch(`${getApiBase()}/api/customer/rentals${withTenantQuery(path)}`, {
    ...options,
    headers: {
      ...customerAuthHeaders(),
      ...officeHeaders,
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
  const officeHeaders = await sealedOfficeHeaders();
  const res = await fetch(`${getApiBase()}/api/customer/rentals${withTenantQuery(path)}`, {
    ...options,
    headers: {
      ...officeHeaders,
      ...(options.headers || {}),
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

/** Authenticated wallet member check-in. */
export async function customerRentalCheckIn(bookingId) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/check-in`, {
    method: 'POST',
  });
}

/**
 * Customer pickup / return inspection (fuel, km, notes, photos, signature).
 * PICKUP_CHECK also marks online_checkin_ready on the booking.
 */
export async function customerRentalInspection(bookingId, body) {
  return customerRentalFetch(`/bookings/${encodeURIComponent(bookingId)}/inspections`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Guest online check-in lookup — surname + RN-/RB- code. */
export async function guestRentalLookup({ surname, referenceCode }) {
  const data = await publicRentalFetch('/public/check-in/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surname: String(surname || '').trim(),
      reference_code: String(referenceCode || '').trim(),
    }),
  });
  return data.booking || null;
}

/** Guest online check-in confirm. */
export async function guestRentalCheckIn({ surname, referenceCode }) {
  const data = await publicRentalFetch('/public/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surname: String(surname || '').trim(),
      reference_code: String(referenceCode || '').trim(),
    }),
  });
  return data.booking || null;
}
