/** Helpers for booking status & payment UI */

import { bookingBalanceDue } from './payments/paymentSecurity.js';

export function isPaid(booking) {
  const ps = String(booking.paymentStatus || '').toUpperCase();
  return (
    ps.includes('PAID') ||
    ps.includes('DEPOSIT') ||
    ps.includes('ΠΡΟΚΑΤΑΒΟΛ') ||
    booking.status === 'Επιβεβαιωμένη' ||
    booking.status === 'Ολοκληρώθηκε'
  );
}

export function isFullyPaid(booking) {
  if (Number(booking.balanceDue) > 0) return false;
  return isPaid(booking);
}

export function hasDepositBalance(booking) {
  return bookingBalanceDue(booking) > 0;
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
  const ps = String(booking.paymentStatus || booking.paymentMethod || '');
  if (ps.includes('Credit Card') || ps.includes('Κάρτα')) return { label: 'Πιστωτική κάρτα', icon: 'credit_card' };
  if (ps.includes('PayPal')) return { label: 'PayPal', icon: 'account_balance_wallet' };
  if (ps.includes('DEPOSIT') || ps.includes('ΠΡΟΚΑΤΑΒΟΛ') || String(booking.paymentPlan || '') === 'deposit') {
    const pct = booking.depositPercent ? `${booking.depositPercent}%` : '';
    return {
      label: booking.paymentMethod || (pct ? `Προκαταβολή ${pct}` : 'Προκαταβολή'),
      icon: 'savings',
    };
  }
  if (ps.includes('Cash') || ps.includes('Μετρητά')) return { label: 'Μετρητά', icon: 'payments' };
  if (ps.includes('PENDING') || ps === 'PENDING') return { label: 'Εκκρεμής πληρωμή', icon: 'hourglass_empty' };
  if (ps.includes('Transfer') || ps.includes('Τράπεζ') || ps.includes('Έμβασμα')) {
    return { label: 'Τραπεζική μεταφορά', icon: 'account_balance' };
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
  if (isPaid(booking)) return { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'verified' };
  return { className: 'bg-amber-50 text-amber-800 border-amber-200', icon: 'pending' };
}
