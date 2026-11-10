/**
 * invoiceService — admin-facing hook to issue/retry fiscal receipt for a booking.
 *
 * Automatic issuance still runs from Python (payment webhook → Celery → provider).
 * Use this for manual enqueue from UI tools.
 */
import { saasFetch } from '../../services/saasApi.js';

/**
 * Issue missing fiscal receipt for a booking (admin JWT required).
 *
 * @param {{ bookingId: string, paymentIntentId?: string, kind?: string }} payload
 * @returns {Promise<{ queued: boolean, detail?: string, data?: object }>}
 */
export async function transmitInvoice(payload = {}) {
  const bookingId = String(payload.bookingId || '').trim();
  if (!bookingId) {
    return { queued: false, detail: 'missing bookingId' };
  }
  try {
    const data = await saasFetch(`/api/admin/platform/bookings/${encodeURIComponent(bookingId)}/issue-fiscal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stripe_payment_intent_id: payload.paymentIntentId || null,
        kind: payload.kind || null,
      }),
    });
    return { queued: true, detail: 'issued-or-enqueued', data };
  } catch (err) {
    return { queued: false, detail: err?.message || 'network' };
  }
}

export default { transmitInvoice };
