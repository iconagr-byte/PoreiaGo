/**
 * After wallet claim register/login — email the passenger their full booking.
 */
import { getBookingById } from '../ticketing/bookingStore.js';
import { sendTicketEmail } from '../../services/ticketingApi.js';

/**
 * @param {{
 *   bookingId?: string,
 *   reference?: string,
 *   email?: string,
 *   name?: string,
 *   phone?: string,
 * }} opts
 */
export async function sendWalletClaimBookingEmail(opts = {}) {
  const bookingId = String(opts.bookingId || opts.reference || '').trim();
  const email = String(opts.email || '').trim().toLowerCase();
  if (!bookingId || !email || !email.includes('@')) {
    return { skipped: true, reason: 'missing_booking_or_email' };
  }

  let booking = getBookingById(bookingId);
  if (!booking) {
    try {
      const { mockBookings } = await import('../../data/mockData.js');
      booking = mockBookings.find((b) => b.id === bookingId) || null;
    } catch {
      booking = null;
    }
  }

  const patched = {
    ...(booking || {
      id: bookingId,
      pnr: opts.reference || bookingId,
      tripTitle: 'Εκδρομή',
    }),
    id: booking?.id || bookingId,
    email,
    customerName:
      opts.name || booking?.customerName || booking?.passengerName || booking?.name || '',
    phone: opts.phone || booking?.phone || '',
  };

  return sendTicketEmail(patched);
}
