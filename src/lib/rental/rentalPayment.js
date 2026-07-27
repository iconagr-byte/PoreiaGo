/** Rental-specific payment plan copy (balance at pickup, not bus). */

import {
  DEFAULT_DEPOSIT_PERCENT,
  PAYMENT_PLAN_DEPOSIT,
  PAYMENT_PLAN_FULL,
  normalizeDepositPercent,
} from '../payments/depositPayment.js';

export { DEFAULT_DEPOSIT_PERCENT, PAYMENT_PLAN_DEPOSIT, PAYMENT_PLAN_FULL };

export function getRentalPaymentPlans(depositPercent = DEFAULT_DEPOSIT_PERCENT) {
  const pct = normalizeDepositPercent(depositPercent);
  return [
    {
      id: PAYMENT_PLAN_FULL,
      label: 'Πλήρης πληρωμή',
      description: 'Ολόκληρο το ποσό τώρα — τίποτα στην παραλαβή.',
      icon: 'payments',
    },
    {
      id: PAYMENT_PLAN_DEPOSIT,
      label: `Προκαταβολή ${pct}%`,
      description: `Κλείστε με ${pct}% τώρα · το υπόλοιπο στην παραλαβή.`,
      icon: 'savings',
    },
  ];
}

export function paymentStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return 'Εξοφλημένη';
  if (s === 'partial') return 'Προκαταβολή';
  if (s === 'pending') return 'Εκκρεμής πληρωμή';
  return '';
}
