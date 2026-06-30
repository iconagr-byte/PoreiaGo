import { mockBookings } from '../../data/mockData.js';
import { ensureCustomerForPassenger } from '../customers/customerStore.js';
import { loadTrips } from '../trips/tripStore.js';
import {
  getSaasTenantId,
  saasCreateGuestBooking,
  syncTicketForBoarding,
} from '../../services/saasApi.js';
import { dispatchPartnerEvent } from '../../services/growthApi.js';
import { API_BASE } from '../../config/api.js';
import { getCustomerToken } from '../auth.js';
import {
  cancelAdminBooking,
  patchAdminBooking,
} from '../../services/adminBookingsApi.js';
import { confirmBankDepositSecure, recordCashPaymentSecure } from '../../services/paymentSettingsApi.js';
import {
  notifyPaymentConfirmationSafe,
  PAYMENT_NOTIFY_EVENTS,
} from '../../services/paymentNotificationApi.js';
import {
  fetchAllBookingsFromServer,
  syncMyBookingsToServer,
  upsertBookingOnServer,
} from '../../services/customerBookingsApi.js';
import { CHECK_IN } from './constants.js';
import {
  buildPaymentMethodLabel,
  buildPaymentStatusLabel,
  computeDepositSplit,
  normalizeDepositPercent,
  PAYMENT_PLAN_DEPOSIT,
  PAYMENT_PLAN_FULL,
  roundMoney,
} from '../payments/depositPayment.js';
import { PAYMENT_METHOD_BANK } from '../payments/bankTransfer.js';

const STORAGE_KEY = 'aerostride_bookings_v1';

/**
 * @typedef {typeof mockBookings[0] & {
 *   tripId?: number,
 *   checkInStatus?: string,
 *   qrIssuedAt?: string,
 * }} BookingRecord
 */

export function isBookingPaid(booking) {
  if (!booking) return false;
  const ps = String(booking.paymentStatus || '').toUpperCase();
  return (
    ps.includes('PAID') ||
    ps.includes('DEPOSIT') ||
    ps.includes('ΠΡΟΚΑΤΑΒΟΛ') ||
    booking.status === 'Επιβεβαιωμένη' ||
    booking.status === 'CONFIRMED'
  );
}

export function isBookingFullyPaid(booking) {
  if (!booking) return false;
  if (Number(booking.balanceDue) > 0) return false;
  return isBookingPaid(booking);
}

export function isBookingCancelled(booking) {
  if (!booking) return false;
  const ps = String(booking.paymentStatus || '').toUpperCase();
  const cs = String(booking.checkInStatus || '').toUpperCase();
  return ps.includes('CANCELLED') || cs === 'CANCELLED' || booking.status === 'Ακυρωμένη';
}

function tripIdFromTitle(title) {
  const trip = loadTrips().find((t) => t.title === title);
  return trip?.id ?? 0;
}

function seedTripIds(bookings) {
  return bookings.map((b) => ({
    checkInStatus: b.checkedIn ? CHECK_IN.CHECKED_IN : CHECK_IN.NONE,
    tripId: b.tripId ?? tripIdFromTitle(b.tripTitle) ?? 0,
    ...b,
  }));
}

/** Συγχώνευση server/local κρατήσεων στο localStorage cache. */
export function mergeBookingsIntoStore(incoming) {
  if (!incoming?.length) return loadBookings();
  const map = new Map(loadBookings().map((b) => [b.id, b]));
  for (const b of incoming) {
    map.set(b.id, { ...map.get(b.id), ...b });
  }
  const merged = [...map.values()];
  saveBookings(merged);
  return merged;
}

/** Control Panel — φόρτωση από server. */
export async function loadAllBookingsAsync() {
  try {
    const remote = await fetchAllBookingsFromServer();
    if (remote.length) mergeBookingsIntoStore(remote);
  } catch (err) {
    console.warn('[bookings] server load failed, using cache', err);
  }
  return loadBookings();
}

/** My Wallet — sync κρατήσεων πελάτη με server. */
export async function loadBookingsForCustomer(email) {
  const key = String(email || '').trim().toLowerCase();
  const localForUser = loadBookings().filter(
    (b) => String(b.email || '').toLowerCase() === key,
  );

  if (!getCustomerToken()) {
    return localForUser;
  }

  try {
    const synced = await syncMyBookingsToServer(localForUser);
    mergeBookingsIntoStore(synced);
    return loadBookings().filter((b) => String(b.email || '').toLowerCase() === key);
  } catch (err) {
    console.warn('[bookings] customer sync failed', err);
    return localForUser;
  }
}

async function pushBookingToServer(booking) {
  if (!getCustomerToken() || !booking) return booking;
  try {
    const saved = await upsertBookingOnServer(booking);
    mergeBookingsIntoStore([saved]);
    return saved;
  } catch (err) {
    console.warn('[bookings] push to server failed', err);
    return booking;
  }
}

export function loadBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    /* use seed */
  }
  const seeded = seedTripIds(mockBookings);
  saveBookings(seeded);
  return seeded;
}

/** @param {BookingRecord[]} bookings */
export function saveBookings(bookings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

/** @param {string} bookingId */
export function getBookingById(bookingId) {
  const all = loadBookings();
  return (
    all.find((b) => b.id === bookingId || b.saasBookingId === bookingId) ?? null
  );
}

/**
 * @param {string} bookingId
 * @param {Partial<BookingRecord>} patch
 */
export function updateBooking(bookingId, patch) {
  const all = loadBookings();
  const idx = all.findIndex((b) => b.id === bookingId);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  saveBookings(all);
  return all[idx];
}

export function markCheckedIn(bookingId, status = CHECK_IN.BOARDED) {
  return updateBooking(bookingId, {
    checkInStatus: status,
    checkedIn: true,
    checkedInAt: new Date().toISOString(),
  });
}

export async function markCheckedInAsync(bookingId, status = CHECK_IN.BOARDED) {
  try {
    const saved = await patchAdminBooking(bookingId, {
      checkedIn: true,
      checkInStatus: status,
    });
    mergeBookingsIntoStore([saved]);
    return saved;
  } catch {
    return markCheckedIn(bookingId, status);
  }
}

/** @param {BookingRecord} booking */
export function addBooking(booking) {
  const all = loadBookings();
  all.push(booking);
  saveBookings(all);
  return booking;
}

function randomPnr() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function buildLocalBooking({
  trip,
  seats,
  total,
  passenger,
  paymentMethod,
  paymentPlan = PAYMENT_PLAN_FULL,
  amountPaid,
  balanceDue,
  depositPercent,
  saasMeta,
}) {
  const email = passenger.email.trim().toLowerCase();
  const customer = ensureCustomerForPassenger(passenger);
  const seatList = seats.split(',').map((s) => s.trim()).filter(Boolean);
  const pct = normalizeDepositPercent(depositPercent);
  const split = computeDepositSplit(total, pct);
  const paidNow = roundMoney(amountPaid ?? (paymentPlan === PAYMENT_PLAN_DEPOSIT ? split.depositAmount : total));
  const remaining = roundMoney(
    balanceDue ?? (paymentPlan === PAYMENT_PLAN_DEPOSIT ? split.balanceDue : 0),
  );
  const taxes = Math.round(total * 0.24 * 100) / 100;
  const basePrice = Math.round((total - taxes) * 100) / 100;
  const now = new Date();
  const paymentLabel = buildPaymentStatusLabel(paymentPlan, paymentMethod, pct);
  const paymentMethodLabel = buildPaymentMethodLabel(paymentPlan, paymentMethod, pct);

  const dep = trip.departureTime ? new Date(trip.departureTime) : now;
  const ref = saasMeta?.referenceCode || randomPnr();
  const depositNote =
    paymentPlan === PAYMENT_PLAN_DEPOSIT
      ? `Προκαταβολή ${pct}% (€${paidNow.toFixed(2)}) · Υπόλοιπο €${remaining.toFixed(2)} μετρητά στο λεωφορείο.`
      : '';

  return {
    id: saasMeta?.saasBookingId ? `B-${saasMeta.referenceCode}` : `B-${Date.now()}`,
    saasBookingId: saasMeta?.saasBookingId || null,
    customerId: customer.id,
    customerName: passenger.name.trim(),
    tripTitle: trip.title,
    tripId: trip.id,
    date: dep.toISOString().slice(0, 10),
    time: dep.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
    seats: seatList,
    seat: seatList.join(', '),
    price: total,
    amountPaid: paidNow,
    balanceDue: remaining,
    paymentPlan,
    depositPercent: pct,
    balanceDueMethod: remaining > 0 ? 'cash_on_bus' : null,
    status: 'Επιβεβαιωμένη',
    checkInStatus: CHECK_IN.NONE,
    checkedIn: false,
    phone: passenger.phone.trim(),
    email,
    dietary: 'Καμία',
    luggage: '1 Μικρή Αποσκευή',
    paymentStatus: paymentLabel,
    paymentMethod: paymentMethodLabel,
    paymentDate: now.toISOString().replace('T', ' ').slice(0, 19),
    notes: [saasMeta?.syncedToSaas ? 'Συγχρονισμένο με SaaS API' : '', depositNote]
      .filter(Boolean)
      .join(' '),
    boardingPassIssued: true,
    pnr: ref,
    ticketRef: saasMeta?.ticketRef || saasMeta?.referenceCode || null,
    transactionId: saasMeta?.saasBookingId
      ? `TXN-${saasMeta.saasBookingId}`
      : `TXN-${Date.now()}`,
    invoiceNumber: `INV-${now.getFullYear()}-${String(Date.now()).slice(-6)}`,
    basePrice,
    taxes,
    bookingSource: 'Website (B2C)',
    agentName: 'Online Auto',
    syncedToSaas: Boolean(saasMeta?.syncedToSaas),
  };
}

function applyBankTransferPending(
  booking,
  { paymentMethod, amountDue, paymentPlan, depositPercent, busBalanceDue = 0, bankAccountId = null },
) {
  if (paymentMethod !== PAYMENT_METHOD_BANK) return booking;
  const pct = normalizeDepositPercent(depositPercent);
  const bankDue = roundMoney(amountDue);
  const busNote =
    paymentPlan === PAYMENT_PLAN_DEPOSIT && busBalanceDue > 0
      ? ` Υπόλοιπο €${roundMoney(busBalanceDue).toFixed(2)} μετρητά στο λεωφορείο μετά την κατάθεση.`
      : '';
  return {
    ...booking,
    status: 'Εκκρεμής',
    amountPaid: 0,
    balanceDue: bankDue,
    bankAccountId: bankAccountId || null,
    balanceDueMethod: paymentPlan === PAYMENT_PLAN_DEPOSIT && busBalanceDue > 0 ? 'cash_on_bus' : 'bank_transfer',
    paymentStatus: buildPaymentStatusLabel(paymentPlan, PAYMENT_METHOD_BANK, pct),
    paymentMethod: buildPaymentMethodLabel(paymentPlan, PAYMENT_METHOD_BANK, pct),
    notes: `${booking.notes || ''} Αναμένεται τραπεζική κατάθεση €${bankDue.toFixed(2)} · αιτιολογία ${booking.pnr || '—'}.${busNote}`.trim(),
    boardingPassIssued: false,
  };
}

/**
 * Δημιουργία κράτησης μετά το checkout — SaaS API πρώτα, localStorage fallback.
 * @param {{ trip: object, seats: string, total: number, amountPaid?: number, balanceDue?: number, paymentPlan?: string, passenger: { name: string, email: string, phone: string }, paymentMethod: string }} input
 */
export async function createBookingFromCheckout({
  trip,
  seats,
  total,
  amountPaid,
  balanceDue,
  paymentPlan = PAYMENT_PLAN_FULL,
  depositPercent,
  passenger,
  paymentMethod,
  bankAccountId = null,
}) {
  const seatList = seats.split(',').map((s) => s.trim()).filter(Boolean);
  const pct = normalizeDepositPercent(depositPercent);
  const split = computeDepositSplit(total, pct);
  const paidNow = roundMoney(
    amountPaid ?? (paymentPlan === PAYMENT_PLAN_DEPOSIT ? split.depositAmount : total),
  );
  const remaining = roundMoney(
    balanceDue ?? (paymentPlan === PAYMENT_PLAN_DEPOSIT ? split.balanceDue : 0),
  );
  const paymentMethodMeta = buildPaymentMethodLabel(paymentPlan, paymentMethod, pct);
  const tenantId = getSaasTenantId();

  if (tenantId) {
    try {
      const api = await saasCreateGuestBooking({
        tenantId,
        passengerName: passenger.name.trim(),
        passengerEmail: passenger.email.trim(),
        seatLabel: seatList.join(', '),
        amountEur: paidNow,
        externalTripId: trip.id,
        tripTitle: trip.title,
        paymentMethod: paymentMethodMeta,
        phone: passenger.phone.trim(),
        seats: seatList,
        paymentPlan,
        totalEur: total,
        balanceDue: remaining,
        depositPercent: pct,
      });
      const booking = applyBankTransferPending(
        buildLocalBooking({
          trip,
          seats,
          total,
          passenger,
          paymentMethod,
          paymentPlan,
          amountPaid: paidNow,
          balanceDue: remaining,
          depositPercent: pct,
          saasMeta: {
            saasBookingId: api.id,
            referenceCode: api.reference_code,
            syncedToSaas: true,
          },
        }),
        {
          paymentMethod,
          amountDue: paidNow,
          paymentPlan,
          depositPercent: pct,
          busBalanceDue: paymentPlan === PAYMENT_PLAN_DEPOSIT ? remaining : 0,
          bankAccountId,
        },
      );
      const saved = addBooking(booking);
      try {
        const sync = await syncTicketForBoarding(saved);
        if (sync?.ticket_ref) {
          updateBooking(saved.id, { ticketRef: sync.ticket_ref });
          saved.ticketRef = sync.ticket_ref;
        }
        saved.ticketSynced = true;
      } catch (syncErr) {
        console.warn('[checkout] ticket sync failed', syncErr);
      }
      dispatchPartnerEvent('booking.confirmed', {
        booking_id: saved.id,
        trip_id: trip.id,
        trip_title: trip.title,
        amount_eur: paidNow,
        total_eur: total,
        balance_due: remaining,
        payment_plan: paymentPlan,
        seats: seatList,
        passenger_email: passenger.email.trim().toLowerCase(),
      }).catch(() => {});
      await pushBookingToServer(saved);
      notifyPaymentConfirmationSafe(saved, { paymentMethod, paymentPlan });
      return saved;
    } catch (err) {
      console.warn('[checkout] SaaS booking failed, using localStorage', err);
    }
  }

  const saved = addBooking(
    applyBankTransferPending(
      buildLocalBooking({
        trip,
        seats,
        total,
        passenger,
        paymentMethod,
        paymentPlan,
        amountPaid: paidNow,
        balanceDue: remaining,
        depositPercent: pct,
        saasMeta: null,
      }),
      {
        paymentMethod,
        amountDue: paidNow,
        paymentPlan,
        depositPercent: pct,
        busBalanceDue: paymentPlan === PAYMENT_PLAN_DEPOSIT ? remaining : 0,
        bankAccountId,
      },
    ),
  );
  try {
    const sync = await syncTicketForBoarding(saved);
    if (sync?.ticket_ref) {
      updateBooking(saved.id, { ticketRef: sync.ticket_ref });
      saved.ticketRef = sync.ticket_ref;
    }
    saved.ticketSynced = true;
  } catch {
    /* offline — QR falls back to bt1 local token */
  }
  await pushBookingToServer(saved);
  dispatchPartnerEvent('booking.confirmed', {
    booking_id: saved.id,
    trip_id: trip.id,
    trip_title: trip.title,
    amount_eur: paidNow,
    total_eur: total,
    balance_due: remaining,
    payment_plan: paymentPlan,
    seats: seatList,
    passenger_email: passenger.email.trim().toLowerCase(),
  }).catch(() => {});
  notifyPaymentConfirmationSafe(saved, { paymentMethod, paymentPlan });
  return saved;
}

/** Admin: ασφαλής επιβεβαίωση τραπεζικής κατάθεσης */
export async function confirmBankTransferPayment(bookingId, confirmation = {}) {
  const booking = getBookingById(bookingId);
  if (!booking) throw new Error('Δεν βρέθηκε κράτηση');

  try {
    const saved = await confirmBankDepositSecure(bookingId, confirmation);
    mergeBookingsIntoStore([saved]);
    return saved;
  } catch (err) {
    const msg = String(err?.message || '');
    const isOffline =
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('503') ||
      msg.includes('Postgres unavailable');
    if (!isOffline) throw err;
    const total = roundMoney(Number(booking.price) || 0);
    const bankDue = roundMoney(Number(booking.balanceDue) || 0);
    const newPaid = bankDue > 0 ? bankDue : total;
    const pct = normalizeDepositPercent(booking.depositPercent);
    let newBalance = 0;
    let paymentStatus = 'PAID (Bank Transfer)';
    let paymentMethod = 'Τραπεζική μεταφορά';

    if (booking.paymentPlan === PAYMENT_PLAN_DEPOSIT) {
      newBalance = roundMoney(Math.max(0, total - newPaid));
      paymentStatus = `DEPOSIT ${pct}% (Bank Transfer confirmed)`;
      paymentMethod = `Τραπεζική μεταφορά · προκαταβολή ${pct}%`;
    }

    const patch = {
      status: 'Επιβεβαιωμένη',
      paymentStatus,
      paymentMethod,
      amountPaid: newPaid,
      balanceDue: newBalance,
      boardingPassIssued: true,
      notes: `${booking.notes || ''} Κατάθεση επιβεβαιώθηκε ${new Date().toLocaleString('el-GR')}.`.trim(),
    };

    try {
      const saved = await patchAdminBooking(bookingId, patch);
      mergeBookingsIntoStore([saved]);
      notifyPaymentConfirmationSafe(saved, { event: PAYMENT_NOTIFY_EVENTS.BANK_CONFIRMED });
      return saved;
    } catch {
      const local = updateBooking(bookingId, patch);
      notifyPaymentConfirmationSafe(local, { event: PAYMENT_NOTIFY_EVENTS.BANK_CONFIRMED });
      return local;
    }
  }
}

export async function recordCashPayment(bookingId, payload = {}) {
  const booking = getBookingById(bookingId);
  if (!booking) throw new Error('Δεν βρέθηκε κράτηση');

  try {
    const saved = await recordCashPaymentSecure(bookingId, payload);
    const normalized = saved.cashPayment
      ? { ...saved, lastCashAmount: payload.amount }
      : saved;
    mergeBookingsIntoStore([normalized]);
    notifyPaymentConfirmationSafe(normalized, { event: PAYMENT_NOTIFY_EVENTS.CASH_PAYMENT });
    return normalized;
  } catch (err) {
    const msg = String(err?.message || '');
    const isOffline =
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('503') ||
      msg.includes('Postgres unavailable');
    if (!isOffline) throw err;
    throw new Error('Η καταχώρηση μετρητών απαιτεί σύνδεση με τον server');
  }
}

/**
 * Ακύρωση κράτησης — localStorage + SQLite ticketing + partner webhook.
 * @param {string} bookingId
 */
export async function cancelBooking(bookingId) {
  const booking = getBookingById(bookingId);
  if (!booking) {
    throw new Error('Δεν βρέθηκε κράτηση');
  }
  if (isBookingCancelled(booking)) {
    return booking;
  }

  try {
    const fromPg = await cancelAdminBooking(bookingId);
    mergeBookingsIntoStore([fromPg]);
    dispatchPartnerEvent('booking.cancelled', {
      booking_id: fromPg.id,
      trip_id: fromPg.tripId,
      trip_title: fromPg.tripTitle,
      passenger_email: fromPg.email,
      seats: fromPg.seats || [fromPg.seat],
    }).catch(() => {});
    return fromPg;
  } catch {
    /* fallback local + SQLite ticketing */
  }

  const updated = updateBooking(bookingId, {
    status: 'Ακυρωμένη',
    paymentStatus: 'CANCELLED',
    checkInStatus: 'CANCELLED',
    cancelledAt: new Date().toISOString(),
  });

  const ticketId = booking.saasBookingId || booking.id;
  try {
    await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(ticketId)}/cancel`, {
      method: 'POST',
    });
  } catch {
    /* offline — local state still cancelled */
  }

  dispatchPartnerEvent('booking.cancelled', {
    booking_id: updated.id,
    trip_id: updated.tripId,
    trip_title: updated.tripTitle,
    passenger_email: updated.email,
    seats: updated.seats || [updated.seat],
  }).catch(() => {});

  await pushBookingToServer(updated);

  return updated;
}
