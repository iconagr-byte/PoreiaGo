import { API_BASE } from '../config/api.js';
import { getSaasToken, saasAuthHeaders } from './saasApi.js';

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

export async function fetchRentalAvailability({
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
  const data = await rentalFetch(`/availability?${params}`);
  return data.vehicles || [];
}

export async function fetchRentalLiveOverlays() {
  const data = await rentalFetch('/live-overlays');
  return data.overlays || [];
}

export async function uploadRentalInspectionPhoto(file) {
  const form = new FormData();
  form.append('file', file);
  const token = getSaasToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}/api/admin/platform/fleet-rental/inspections/photo-upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία ανεβάσματος φωτογραφίας');
  }
  return data;
}

export async function fetchRentalBookings({ vehicleId, status } = {}) {
  const params = new URLSearchParams();
  if (vehicleId) params.set('vehicle_id', vehicleId);
  if (status) params.set('status', status);
  const q = params.toString() ? `?${params}` : '';
  const data = await rentalFetch(`/bookings${q}`);
  return data.bookings || [];
}

export async function fetchRentalClients() {
  const data = await rentalFetch('/clients');
  return data.clients || [];
}

export async function createRentalBooking(body) {
  return rentalFetch('/bookings', { method: 'POST', body: JSON.stringify(body) });
}

/**
 * Open issued rental contract HTML in a new tab.
 * Admin `/contracts/file/*` needs Bearer auth — plain <a target=_blank> shows blank/401.
 */
export async function openRentalContractFile(contractUrl) {
  const raw = String(contractUrl || '').trim();
  if (!raw) throw new Error('Δεν υπάρχει αρχείο σύμβασης');
  const abs = raw.startsWith('http') ? raw : `${API_BASE}${raw}`;
  const token = getSaasToken();
  const res = await fetch(abs, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data?.detail === 'string' ? data.detail : `Αποτυχία ανοίγματος σύμβασης (${res.status})`,
    );
  }
  const html = await res.text();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const win = window.open(href, '_blank', 'noopener,noreferrer');
  if (!win) {
    URL.revokeObjectURL(href);
    throw new Error('Το παράθυρο μπλοκαρίστηκε — επέτρεψε pop-ups');
  }
  window.setTimeout(() => URL.revokeObjectURL(href), 120_000);
  return true;
}

/** One-click CONFIRMED sample booking for dual-mode signature demo. */
export async function createRentalDemoSignSample() {
  return rentalFetch('/bookings/demo-sign-sample', { method: 'POST', body: '{}' });
}

export async function updateRentalBookingStatus(id, rentalStatus) {
  return rentalFetch(`/bookings/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ rental_status: rentalStatus }),
  });
}

/** Attach signature to a legal paperwork document on a booking. */
export async function saveRentalLegalDocSignature(bookingId, { docId, signatureUrl, signerName }) {
  return rentalFetch(`/bookings/${encodeURIComponent(bookingId)}/legal-docs`, {
    method: 'PATCH',
    body: JSON.stringify({
      doc_id: docId,
      signature_url: signatureUrl,
      signer_name: signerName || undefined,
    }),
  });
}

/** Tablet checkout — accept terms + signature → issue contract (ACTIVE). */
export async function completeRentalCheckout(bookingId, body) {
  return rentalFetch(`/bookings/${encodeURIComponent(bookingId)}/checkout`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Generate 24h contactless signing link + SMS/email to client. */
export async function createRentalSignLink(bookingId, publicBaseUrl) {
  return rentalFetch(`/bookings/${encodeURIComponent(bookingId)}/sign-link`, {
    method: 'POST',
    body: JSON.stringify({ public_base_url: publicBaseUrl || window.location.origin }),
  });
}

/** Poll agent tablet while waiting for remote client signature. */
export async function fetchRentalCheckoutStatus(bookingId) {
  return rentalFetch(`/bookings/${encodeURIComponent(bookingId)}/checkout-status`);
}

export async function fetchRentalCalendar(days = 30) {
  const data = await rentalFetch(`/calendar?days=${days}`);
  return data.blocks || [];
}

export async function fetchRentalAvailabilityBoard() {
  const data = await rentalFetch('/availability-board');
  return data.vehicles || [];
}

export async function fetchRentalDocuments(vehicleId) {
  const q = vehicleId ? `?vehicle_id=${encodeURIComponent(vehicleId)}` : '';
  const data = await rentalFetch(`/documents${q}`);
  return data.documents || [];
}

export async function uploadRentalDocument(vehicleId, file, { kind = 'registration', expiresAt } = {}) {
  const form = new FormData();
  form.append('file', file);
  const params = new URLSearchParams({ kind });
  if (expiresAt) params.set('expires_at', expiresAt);
  const token = getSaasToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(
    `${API_BASE}/api/admin/platform/fleet-rental/vehicles/${encodeURIComponent(vehicleId)}/documents?${params}`,
    { method: 'POST', headers, body: form },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Αποτυχία ανεβάσματος εγγράφου');
  }
  return data;
}

export async function deleteRentalDocument(vehicleId, documentId) {
  return rentalFetch(
    `/vehicles/${encodeURIComponent(vehicleId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  );
}

export async function fetchRentalExpenses(vehicleId) {
  const q = vehicleId ? `?vehicle_id=${encodeURIComponent(vehicleId)}` : '';
  const data = await rentalFetch(`/expenses${q}`);
  return data.expenses || [];
}

export async function createRentalExpense(body) {
  return rentalFetch('/expenses', { method: 'POST', body: JSON.stringify(body) });
}

export async function deleteRentalExpense(expenseId) {
  return rentalFetch(`/expenses/${encodeURIComponent(expenseId)}`, { method: 'DELETE' });
}

export async function fetchRentalInspections(bookingId) {
  const q = bookingId ? `?booking_id=${encodeURIComponent(bookingId)}` : '';
  const data = await rentalFetch(`/inspections${q}`);
  return data.inspections || [];
}

export async function createRentalInspection(body) {
  return rentalFetch('/inspections', { method: 'POST', body: JSON.stringify(body) });
}
