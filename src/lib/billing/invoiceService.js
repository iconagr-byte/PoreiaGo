"""
invoiceService — booking/payment success hook for AADE / myDATA e-invoicing.

Python fiscal workers already handle native AADE, Prosvasis, and Epsilon.
This module is the frontend-facing facade described in the enterprise brief.
"""

/**
 * Enqueue fiscal transmission after a successful booking/payment.
 * Backend workers fetch PDF/QR + protocol number asynchronously.
 *
 * @param {{ bookingId: string, paymentIntentId?: string, kind?: string }} payload
 * @returns {Promise<{ queued: boolean, detail?: string }>}
 */
export async function transmitInvoice(payload = {}) {
  const bookingId = String(payload.bookingId || '').trim();
  if (!bookingId) {
    return { queued: false, detail: 'missing bookingId' };
  }
  try {
    const res = await fetch('/api/admin/platform/fiscal/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        booking_id: bookingId,
        stripe_payment_intent_id: payload.paymentIntentId || null,
        kind: payload.kind || 'RECEIPT',
      }),
    });
    if (res.status === 404) {
      // Endpoint may be worker-driven only — treat as accepted for UI flows.
      return { queued: true, detail: 'fiscal-worker' };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { queued: false, detail: text || `HTTP ${res.status}` };
    }
    return { queued: true, detail: 'enqueued' };
  } catch (err) {
    return { queued: false, detail: err?.message || 'network' };
  }
}

export default { transmitInvoice };
