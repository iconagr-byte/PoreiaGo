/**
 * Rent Wallet expiry — same idea as bus isWalletBookingExpired.
 * After return (end_time) + grace, the pass is no longer active for pickup.
 */

/** Hours after scheduled return before the rent pass shows as ληγμένη. */
export const RENT_PASS_GRACE_HOURS = 2;

export function rentBookingEndMs(booking) {
  const raw = booking?.end_time || booking?.endTime || booking?.dropoff_at;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Instant after which the rental is no longer active for pickup/check-in.
 * Missing end_time → null (treat as still active — don't expire undated rows).
 */
export function rentBookingExpiryMs(booking, { graceHours = RENT_PASS_GRACE_HOURS } = {}) {
  const end = rentBookingEndMs(booking);
  if (!end) return null;
  return end + Math.max(0, Number(graceHours) || 0) * 60 * 60 * 1000;
}

/**
 * True when return time (+ grace) has passed, or status is already COMPLETED.
 * CANCELLED is not "expired" — it stays Ακυρωμένη.
 */
export function isRentBookingExpired(booking, now = new Date(), opts) {
  const status = String(booking?.rental_status || '').toUpperCase();
  if (status === 'CANCELLED') return false;
  if (status === 'COMPLETED') return true;
  const exp = rentBookingExpiryMs(booking, opts);
  if (exp == null) return false;
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return t > exp;
}

/** Display label for wallet chips — Ληγμένη overrides live statuses. */
export function rentBookingStatusLabel(booking, now = new Date(), opts) {
  if (isRentBookingExpired(booking, now, opts)) return 'Ληγμένη';
  const status = booking?.rental_status || 'CONFIRMED';
  const map = {
    RESERVED: 'Εκκρεμεί πληρωμή',
    CONFIRMED: 'Επιβεβαιωμένη',
    ACTIVE: 'Σε εξέλιξη',
    COMPLETED: 'Ολοκληρωμένη',
    CANCELLED: 'Ακυρωμένη',
  };
  return map[status] || status;
}

/**
 * Active rentals first (soonest start), then expired (newest end first).
 * Cancelled stay at the end.
 */
export function sortRentWalletBookings(bookings, now = new Date()) {
  const list = Array.isArray(bookings) ? bookings.filter(Boolean) : [];
  const cancelled = [];
  const active = [];
  const expired = [];
  for (const b of list) {
    const status = String(b.rental_status || '').toUpperCase();
    if (status === 'CANCELLED') {
      cancelled.push(b);
      continue;
    }
    if (isRentBookingExpired(b, now)) expired.push(b);
    else active.push(b);
  }
  active.sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
  expired.sort((a, b) => String(b.end_time || '').localeCompare(String(a.end_time || '')));
  cancelled.sort((a, b) => String(b.start_time || '').localeCompare(String(a.start_time || '')));
  return [...active, ...expired, ...cancelled];
}
