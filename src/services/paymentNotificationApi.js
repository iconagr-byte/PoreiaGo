import { API_BASE } from '../config/api.js';
import { PAYMENT_METHOD_BANK } from '../lib/payments/bankTransfer.js';
import { PAYMENT_PLAN_DEPOSIT } from '../lib/payments/depositPayment.js';

export const PAYMENT_NOTIFY_EVENTS = {
  ONLINE_FULL: 'online_paid_full',
  ONLINE_DEPOSIT: 'online_paid_deposit',
  BANK_PENDING: 'bank_pending',
  BANK_CONFIRMED: 'bank_confirmed',
  CASH_PAYMENT: 'cash_payment',
  FISCAL_RECEIPT: 'fiscal_receipt_issued',
};

export function resolvePaymentNotifyEvent(booking, { paymentMethod, paymentPlan } = {}) {
  const status = String(booking?.status || '');
  const pm = String(paymentMethod || booking?.paymentMethod || '').toLowerCase();
  if (status === 'Εκκρεμής' || pm.includes('bank') || pm.includes('τραπεζ')) {
    return status === 'Επιβεβαιωμένη'
      ? PAYMENT_NOTIFY_EVENTS.BANK_CONFIRMED
      : PAYMENT_NOTIFY_EVENTS.BANK_PENDING;
  }
  if (
    paymentPlan === PAYMENT_PLAN_DEPOSIT ||
    booking?.paymentPlan === PAYMENT_PLAN_DEPOSIT ||
    Number(booking?.balanceDue) > 0
  ) {
    return PAYMENT_NOTIFY_EVENTS.ONLINE_DEPOSIT;
  }
  return PAYMENT_NOTIFY_EVENTS.ONLINE_FULL;
}

/** Fire-and-forget — επιβεβαίωση πληρωμής στον πελάτη & admin. */
export async function notifyPaymentConfirmation(booking, options = {}) {
  const event =
    options.event ||
    resolvePaymentNotifyEvent(booking, {
      paymentMethod: options.paymentMethod,
      paymentPlan: options.paymentPlan,
    });

  const res = await fetch(`${API_BASE}/api/notifications/payment-confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking, event }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Notification failed');
  }
  return res.json();
}

export function notifyPaymentConfirmationSafe(booking, options = {}) {
  notifyPaymentConfirmation(booking, options).catch((err) => {
    console.warn('[payment-notify]', err.message || err);
  });
}

export function isBankPaymentMethod(method) {
  return method === PAYMENT_METHOD_BANK;
}
