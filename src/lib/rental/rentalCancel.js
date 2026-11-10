/** Free cancel window for rental bookings (matches backend FREE_CANCEL_HOURS). */

export const FREE_CANCEL_HOURS = 24;

export function hoursUntilStart(startTime, now = Date.now()) {
  const start = new Date(startTime).getTime();
  if (!Number.isFinite(start)) return null;
  return (start - now) / (1000 * 60 * 60);
}

export function isFreeCancelEligible(booking, now = Date.now()) {
  if (!booking || booking.rental_status !== 'CONFIRMED') return false;
  if (typeof booking.free_cancel_eligible === 'boolean') return booking.free_cancel_eligible;
  const hours = hoursUntilStart(booking.start_time, now);
  if (hours == null) return false;
  return hours >= FREE_CANCEL_HOURS;
}

export function cancelBlockedMessage(booking) {
  const hours = booking?.hours_until_start ?? hoursUntilStart(booking?.start_time);
  if (hours != null && hours < FREE_CANCEL_HOURS) {
    return `Η δωρεάν ακύρωση ισχύει έως ${FREE_CANCEL_HOURS} ώρες πριν την παραλαβή. Επικοινωνήστε με το γραφείο.`;
  }
  return 'Δεν είναι δυνατή η online ακύρωση αυτής της κράτησης.';
}
