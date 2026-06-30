import { API_BASE } from '../config/api.js';
import { customerAuthHeaders } from './customerAuthApi.js';

function parseError(data) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(', ');
  return data?.message || 'Αποτυχία αιτήματος';
}

/** Όλες οι κρατήσεις — Control Panel. */
export async function fetchAllBookingsFromServer() {
  const res = await fetch(`${API_BASE}/api/bookings`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data.items || [];
}

/** Κρατήσεις συνδεδεμένου πελάτη. */
export async function fetchMyBookingsFromServer() {
  const res = await fetch(`${API_BASE}/api/customer/bookings`, {
    headers: customerAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data.items || [];
}

/** Bulk sync τοπικών κρατήσεων πελάτη → server. */
export async function syncMyBookingsToServer(bookings) {
  const res = await fetch(`${API_BASE}/api/customer/bookings/sync`, {
    method: 'POST',
    headers: customerAuthHeaders(),
    body: JSON.stringify({ bookings }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data.items || [];
}

/** Upsert μίας κράτησης (μετά checkout). */
export async function upsertBookingOnServer(booking) {
  const res = await fetch(`${API_BASE}/api/customer/bookings`, {
    method: 'POST',
    headers: customerAuthHeaders(),
    body: JSON.stringify({ booking }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data;
}

/** Signed live-track URL για επιβάτη (χάρτης + ETA). */
export async function fetchCustomerBookingTrackLink(bookingId) {
  const res = await fetch(
    `${API_BASE}/api/customer/bookings/${encodeURIComponent(bookingId)}/track-link`,
    { headers: customerAuthHeaders() },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data;
}

/** Φρέσκα fiscal πεδία (MARK, κατάσταση) από Postgres — My Wallet polling. */
export async function fetchCustomerBookingFiscal(bookingId) {
  const res = await fetch(
    `${API_BASE}/api/customer/bookings/${encodeURIComponent(bookingId)}/fiscal`,
    { headers: customerAuthHeaders() },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data;
}
