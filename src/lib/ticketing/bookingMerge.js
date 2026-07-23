import { loadTrips } from '../trips/tripStore.js';
import { fetchAdminBookings } from '../../services/adminBookingsApi.js';
import { getSaasToken, fetchSaasBookings } from '../../services/saasApi.js';
import { loadAllBookingsAsync, loadBookings, mergeBookingsIntoStore } from './bookingStore.js';
import { CHECK_IN } from './constants.js';
import { formatDepositPaymentStatus } from '../payments/depositPayment.js';

/** Map SaaS API row → wallet/admin booking shape. */
export function mapSaasBookingToLocal(row) {
  const meta = row.metadata_json || {};
  const tripId = meta.external_trip_id ?? 0;
  const trip = loadTrips().find((t) => t.id === tripId);
  const seats = meta.seats || (row.seat_label ? row.seat_label.split(',').map((s) => s.trim()) : []);
  const created = row.created_at ? new Date(row.created_at) : new Date();
  const status = String(row.status || '').toLowerCase();
  const paid = ['paid', 'confirmed', 'boarded'].includes(status);
  const checkedIn = status === 'boarded' || Boolean(meta.checked_in);
  const totalEur = Number(meta.total_eur) || Number(row.amount_eur) || 0;
  const amountPaid = Number(meta.amount_paid) || Number(row.amount_eur) || 0;
  const balanceDue = Number(meta.balance_due) || 0;
  const depositPercent = Number(meta.deposit_percent) || (balanceDue > 0 ? 30 : 0);

  return {
    id: `B-${row.reference_code}`,
    saasBookingId: row.id,
    syncedToSaas: true,
    customerName: row.passenger_name,
    customerId: null,
    tripTitle: meta.trip_title || trip?.title || '—',
    tripId: tripId || trip?.id || 0,
    date: created.toISOString().slice(0, 10),
    time: created.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
    seats,
    seat: row.seat_label || seats.join(', '),
    price: totalEur,
    amountPaid,
    balanceDue,
    paymentPlan: meta.payment_plan || (balanceDue > 0 ? 'deposit' : 'full'),
    depositPercent: balanceDue > 0 ? depositPercent : null,
    balanceDueMethod: meta.balance_due_method || null,
    status: paid ? 'Επιβεβαιωμένη' : row.status,
    checkInStatus: checkedIn ? CHECK_IN.CHECKED_IN : CHECK_IN.NONE,
    checkedIn,
    phone: meta.phone || '',
    email: row.passenger_email || '',
    paymentStatus:
      balanceDue > 0
        ? formatDepositPaymentStatus(depositPercent)
        : paid
          ? 'PAID (SaaS)'
          : row.status,
    paymentMethod: meta.payment_method || 'Online',
    pnr: row.reference_code,
    boardingPassIssued: paid,
    bookingSource: 'Website (SaaS)',
  };
}

function mergeByKey(local, remote) {
  const map = new Map();
  for (const b of local) {
    map.set(b.saasBookingId || b.id, b);
  }
  for (const r of remote) {
    const key = r.saasBookingId || r.id;
    const prev = [...map.entries()].find(
      ([, v]) => v.saasBookingId === r.saasBookingId || v.id === r.id,
    );
    if (prev) {
      map.set(prev[0], { ...prev[1], ...r });
    } else {
      map.set(key, r);
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0),
  );
}

/** Postgres admin API → cache; fallback SQLite / SaaS JWT / localStorage. */
export async function loadMergedBookings() {
  const authenticated = Boolean(getSaasToken());

  try {
    const pg = await fetchAdminBookings();
    if (Array.isArray(pg)) {
      // Authenticated office with empty PG must stay empty (no mock seed).
      if (authenticated || pg.length) {
        mergeBookingsIntoStore(pg);
        return pg;
      }
    }
  } catch (err) {
    console.warn('[bookings] Postgres admin load failed', err);
  }

  await loadAllBookingsAsync();
  const local = loadBookings();
  if (!authenticated) return local;
  try {
    const saas = await fetchSaasBookings();
    if (!Array.isArray(saas) || !saas.length) return local;
    const merged = mergeByKey(local, saas.map(mapSaasBookingToLocal));
    mergeBookingsIntoStore(merged);
    return merged;
  } catch {
    return local;
  }
}
