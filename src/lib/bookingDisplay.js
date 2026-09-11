/** Helpers for booking status & payment UI */

import { bookingBalanceDue } from './payments/paymentSecurity.js';

function paymentStatusText(booking) {
  return String(booking?.paymentStatus || booking?.paymentMethod || '');
}

function paymentStatusUpper(booking) {
  return paymentStatusText(booking).toUpperCase();
}

/** True when the booking used (or still uses) a deposit / partial-pay plan. */
export function isDepositBooking(booking) {
  if (!booking) return false;
  if (String(booking.paymentPlan || '').toLowerCase() === 'deposit') return true;
  const ps = paymentStatusUpper(booking);
  if (ps.includes('DEPOSIT') || ps.includes('ΠΡΟΚΑΤΑΒΟΛ')) return true;
  const method = String(booking.paymentMethod || '').toUpperCase();
  if (method.includes('ΠΡΟΚΑΤΑΒΟΛ') || method.includes('DEPOSIT')) return true;
  return Number(booking.amountPaid) > 0 && bookingBalanceDue(booking) > 0;
}

export function isPendingBankTransfer(booking) {
  if (!booking) return false;
  if (bookingBalanceDue(booking) <= 0) return false;
  const ps = paymentStatusUpper(booking);
  const method = String(booking.paymentMethod || '').toUpperCase();
  const dueMethod = String(booking.balanceDueMethod || '').toLowerCase();
  const looksBank =
    dueMethod === 'bank_transfer' ||
    ps.includes('BANK TRANSFER') ||
    ps.includes('ΤΡΑΠΕΖ') ||
    method.includes('ΤΡΑΠΕΖ') ||
    method.includes('BANK');
  return looksBank && (ps.includes('PENDING') || dueMethod === 'bank_transfer');
}

export function isPaid(booking) {
  const ps = paymentStatusUpper(booking);
  if (ps.includes('PENDING') && bookingBalanceDue(booking) > 0) {
    return false;
  }
  return (
    ps.includes('PAID') ||
    ps.includes('DEPOSIT') ||
    ps.includes('ΠΡΟΚΑΤΑΒΟΛ') ||
    Number(booking.amountPaid) > 0 ||
    booking.status === 'Ολοκληρώθηκε'
  );
}

export function isFullyPaid(booking) {
  if (bookingBalanceDue(booking) > 0) return false;
  return isPaid(booking);
}

/**
 * Real deposit split still owed (partial paid online + cash on bus).
 * Unpaid full bank-transfer / cash-on-bus bookings are NOT deposits.
 */
export function hasDepositBalance(booking) {
  if (bookingBalanceDue(booking) <= 0) return false;
  return isDepositBooking(booking);
}

export function canRecordCashPayment(booking) {
  if (!booking) return false;
  const status = String(booking.status || '').toLowerCase();
  if (status.includes('ακυρ') || status === 'cancelled' || status === 'refunded') return false;
  return bookingBalanceDue(booking) > 0;
}

export function isConfirmed(booking) {
  const s = booking.status || '';
  return ['Επιβεβαιωμένη', 'Ολοκληρώθηκε', 'CONFIRMED'].includes(s);
}

export function parsePaymentMethod(booking) {
  const ps = paymentStatusText(booking);
  const psUpper = ps.toUpperCase();
  if (psUpper.includes('CREDIT CARD') || ps.includes('Κάρτα')) {
    return { label: 'Πιστωτική κάρτα', icon: 'credit_card' };
  }
  if (psUpper.includes('PAYPAL')) return { label: 'PayPal', icon: 'account_balance_wallet' };

  if (isPendingBankTransfer(booking)) {
    return { label: 'Εκκρεμής τραπεζική μεταφορά', icon: 'hourglass_empty' };
  }

  if (isDepositBooking(booking)) {
    const pct = booking.depositPercent ? `${booking.depositPercent}%` : '';
    return {
      label: booking.paymentMethod || (pct ? `Προκαταβολή ${pct}` : 'Προκαταβολή'),
      icon: 'savings',
    };
  }
  if (
    psUpper.includes('CASH') ||
    ps.includes('Μετρητά') ||
    ps.includes('γκισέ') ||
    ps.includes('λεωφορείο')
  ) {
    return {
      label: psUpper.includes('PAID') || ps.includes('Πληρ') ? 'Μετρητά' : ps || 'Μετρητά',
      icon: 'payments',
    };
  }
  if (psUpper.includes('PENDING') || psUpper === 'PENDING') {
    return { label: 'Εκκρεμής πληρωμή', icon: 'hourglass_empty' };
  }
  if (psUpper.includes('TRANSFER') || ps.includes('Τράπεζ') || ps.includes('Έμβασμα')) {
    return { label: 'Τραπεζική μεταφορά', icon: 'account_balance' };
  }
  if (psUpper.includes('PAID (SAAS)') || psUpper.includes('SAAS')) {
    return { label: 'PAID (SaaS)', icon: 'verified' };
  }
  return { label: ps || '—', icon: 'payment' };
}

export function statusStyle(booking) {
  const s = booking.status || '';
  if (s === 'Επιβεβαιωμένη') return { className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'check_circle' };
  if (s === 'Ολοκληρώθηκε') return { className: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'done_all' };
  if (s === 'Εκκρεμής') return { className: 'bg-amber-100 text-amber-800 border-amber-200', icon: 'schedule' };
  if (s.includes('Ακυρ')) return { className: 'bg-rose-100 text-rose-800 border-rose-200', icon: 'cancel' };
  return { className: 'bg-gray-100 text-gray-700 border-gray-200', icon: 'info' };
}

export function paymentStyle(booking) {
  if (hasDepositBalance(booking)) {
    return { className: 'bg-amber-50 text-amber-800 border-amber-200', icon: 'savings' };
  }
  if (isPendingBankTransfer(booking)) {
    return { className: 'bg-amber-50 text-amber-800 border-amber-200', icon: 'hourglass_empty' };
  }
  if (isPaid(booking)) return { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'verified' };
  return { className: 'bg-amber-50 text-amber-800 border-amber-200', icon: 'pending' };
}
