/**
 * Persist the featured boarding pass so My Wallet can show it offline.
 * Key lives in localStorage (same origin as /wallet offline shell).
 */

export const WALLET_LAST_PASS_KEY = 'wallet_last_pass_v1';

function pickBookingFields(booking) {
  if (!booking || typeof booking !== 'object') return null;
  return {
    id: booking.id,
    tripId: booking.tripId,
    tripTitle: booking.tripTitle,
    date: booking.date,
    time: booking.time,
    seat: booking.seat || booking.seats,
    seats: booking.seats || booking.seat,
    pnr: booking.pnr,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    price: booking.price,
    passengerName: booking.passengerName,
    name: booking.name,
    email: booking.email,
    fiscal_mark: booking.fiscal_mark,
    fiscalMark: booking.fiscalMark,
  };
}

export function loadLastPass() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WALLET_LAST_PASS_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap?.booking?.id) return null;
    return snap;
  } catch {
    return null;
  }
}

export function clearLastPass() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(WALLET_LAST_PASS_KEY);
}

/**
 * @param {{
 *   booking: object,
 *   coverImage?: string,
 *   brandLabel?: string,
 *   passengerName?: string,
 *   qrValue?: string,
 *   qrDataUrl?: string,
 * }} partial
 */
export function saveLastPass(partial) {
  if (typeof window === 'undefined' || !partial?.booking?.id) return null;
  const prev = loadLastPass();
  const sameId = prev?.booking?.id === partial.booking.id;
  const booking = pickBookingFields(partial.booking);
  const snap = {
    booking,
    coverImage: partial.coverImage ?? (sameId ? prev?.coverImage : '') ?? '',
    brandLabel: partial.brandLabel ?? (sameId ? prev?.brandLabel : 'My Wallet') ?? 'My Wallet',
    passengerName:
      partial.passengerName ?? (sameId ? prev?.passengerName : '') ?? booking.passengerName ?? '',
    qrValue: partial.qrValue ?? (sameId ? prev?.qrValue : '') ?? '',
    qrDataUrl: partial.qrDataUrl ?? (sameId ? prev?.qrDataUrl : '') ?? '',
    cachedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(WALLET_LAST_PASS_KEY, JSON.stringify(snap));
  } catch {
    // Quota / private mode — ignore
  }
  return snap;
}

export function patchLastPassQr({ bookingId, qrValue, qrDataUrl }) {
  const prev = loadLastPass();
  if (!prev?.booking?.id || (bookingId && prev.booking.id !== bookingId)) return null;
  return saveLastPass({
    booking: prev.booking,
    coverImage: prev.coverImage,
    brandLabel: prev.brandLabel,
    passengerName: prev.passengerName,
    qrValue: qrValue ?? prev.qrValue,
    qrDataUrl: qrDataUrl ?? prev.qrDataUrl,
  });
}
