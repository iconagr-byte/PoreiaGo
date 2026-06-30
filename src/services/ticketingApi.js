import { API_BASE, driverAuthHeaders } from '../config/api.js';
import { SCAN_RESULT } from '../lib/ticketing/constants.js';
import { markCheckedIn } from '../lib/ticketing/bookingStore.js';
import { scanFailureMessage } from '../lib/ticketing/qrToken.js';
import { processScanLocal } from '../lib/ticketing/scanLocal.js';
import { loadBookings } from '../lib/ticketing/bookingStore.js';
import { dispatchPartnerEvent } from '../services/growthApi.js';

export function ensureDriverSession() {
  const role = localStorage.getItem('userRole');
  if (role === 'admin' || role === 'driver') {
    if (!localStorage.getItem('driverApiKey')) {
      localStorage.setItem('driverApiKey', 'dev-driver-key');
    }
    return true;
  }
  return false;
}

function normalizeScanResponse(data) {
  if (!data) return data;
  return {
    ...data,
    passengerName: data.passenger_name ?? data.passengerName,
    seat: data.seat_number ?? data.seat,
    bookingId: data.booking_id ?? data.bookingId,
  };
}

/** Replay scans queued while offline. */
export async function flushOfflineScanQueue() {
  const queue = getOfflineSyncQueue();
  if (!queue.length) return { synced: 0 };

  ensureDriverSession();
  try {
    const res = await fetch(`${API_BASE}/admin/scan/offline-sync`, {
      method: 'POST',
      headers: driverAuthHeaders(),
      body: JSON.stringify(
        queue.map((q) => ({
          qr: q.token,
          trip_id: q.tripId ?? 1,
          scanned_at: q.scannedAt,
        })),
      ),
    });
    if (res.ok) {
      const data = await res.json();
      clearOfflineSyncQueue();
      return data;
    }
  } catch {
    /* still offline */
  }
  return { synced: 0 };
}

/**
 * POST /admin/scan — FastAPI when online; rotating JWT / bt1 locally when offline.
 */
export async function adminScanTicket(body) {
  const tripId = body.tripId ?? body.trip_id ?? 1;
  const qr = body.qr?.trim();
  if (!qr) {
    return fail('EMPTY_TOKEN');
  }

  ensureDriverSession();

  const finishLocal = async (local) => {
    const normalized = normalizeScanResponse(local);
    if (normalized.result === SCAN_RESULT.SUCCESS) {
      if (normalized.bookingId) {
        markCheckedIn(normalized.bookingId, 'BOARDED');
      }
      if (local.offline) {
        enqueueOfflineScan(normalized.bookingId || 'unknown', qr, tripId);
      }
      if (normalized.result === SCAN_RESULT.SUCCESS) {
        dispatchPartnerEvent('passenger.boarded', {
          booking_id: normalized.bookingId,
          trip_id: tripId,
          passenger_name: normalized.passengerName || normalized.passenger_name,
          seat_number: normalized.seat || normalized.seat_number,
        }).catch(() => {});
      }
    }
    return normalized;
  };

  try {
    await flushOfflineScanQueue();
    const res = await fetch(`${API_BASE}/admin/scan`, {
      method: 'POST',
      headers: driverAuthHeaders(),
      body: JSON.stringify({ qr, trip_id: tripId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return finishLocal(await processScanLocal(qr, tripId));
    }
    const normalized = normalizeScanResponse(data);
    if (normalized.result === SCAN_RESULT.SUCCESS && normalized.bookingId) {
      markCheckedIn(normalized.bookingId, 'BOARDED');
      dispatchPartnerEvent('passenger.boarded', {
        booking_id: normalized.bookingId,
        trip_id: tripId,
        passenger_name: normalized.passengerName || normalized.passenger_name,
        seat_number: normalized.seat || normalized.seat_number,
      }).catch(() => {});
    }
    return normalized;
  } catch {
    return finishLocal(await processScanLocal(qr, tripId));
  }
}

export async function fetchBoardingManifest(tripId) {
  try {
    const res = await fetch(`${API_BASE}/admin/boarding/${tripId}`, {
      headers: driverAuthHeaders(),
    });
    if (!res.ok) throw new Error('fail');
    return res.json();
  } catch {
    return buildLocalManifest(tripId);
  }
}

function buildLocalManifest(tripId) {
  const passengers = loadBookings().filter(
    (b) =>
      (b.tripId ?? 1) === tripId &&
      (String(b.paymentStatus || '').includes('PAID') ||
        String(b.paymentStatus || '').includes('DEPOSIT')),
  );
  const capacity = 45;
  const boarded = passengers.filter((p) => p.checkedIn || p.checkInStatus === 'BOARDED');
  const missing = passengers.filter((p) => !p.checkedIn && p.checkInStatus !== 'BOARDED');
  return {
    trip_id: tripId,
    capacity,
    progress_label: `${boarded.length}/${capacity}`,
    progress_percent: Math.round((100 * boarded.length) / capacity),
    missing_passengers: missing.map((p) => ({
      booking_id: p.id,
      passenger_name: p.customerName,
      seat_number: p.seat,
      phone: p.phone,
    })),
    boarded_passengers: boarded.map((p) => ({
      booking_id: p.id,
      passenger_name: p.customerName,
      seat_number: p.seat,
    })),
    alerts: [],
  };
}

export async function downloadOfflineManifest(tripId) {
  const res = await fetch(
    `${API_BASE}/admin/offline-manifest?trip_id=${tripId}`,
    { headers: driverAuthHeaders() },
  );
  if (!res.ok) throw new Error('Offline manifest failed');
  return res.json();
}

function fail(reason, message) {
  return {
    result: SCAN_RESULT.FAILURE,
    reason,
    message: message || scanFailureMessage(reason),
  };
}

export function buildTicketEmailPayload(booking) {
  const bookingPrice =
    Number(
      booking.basePrice != null && booking.taxes != null
        ? booking.basePrice + booking.taxes
        : booking.price,
    ) || 0;
  const base = booking.basePrice ?? bookingPrice * 0.8;
  const taxes = booking.taxes ?? bookingPrice * 0.2;
  const pnr = booking.pnr || booking.ticketRef || booking.id;

  return {
    email: booking.email,
    customer_name: booking.customerName || '',
    trip_title: booking.tripTitle || '',
    date: booking.date || '',
    time: booking.time || null,
    seat: booking.seat || '',
    pnr: String(pnr),
    booking_id: String(booking.id),
    price: bookingPrice,
    base_price: base,
    taxes,
    payment_method: booking.paymentMethod || null,
    payment_status: booking.paymentStatus || booking.status || null,
    phone: booking.phone || null,
    trip_id: booking.tripId || null,
    tripId: booking.tripId || null,
  };
}

/** POST /api/tickets/{id}/email — αποστολή εισιτηρίου στο email του πελάτη. */
export async function sendTicketEmail(booking) {
  const payload = buildTicketEmailPayload(booking);
  const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(booking.id)}/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join(', ')
          : data.message || 'Αποτυχία αποστολής email';
    throw new Error(message);
  }
  return data;
}
