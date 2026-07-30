/**
 * Smoke test for rent payment helpers.
 */
import {
  PAYMENT_PLAN_DEPOSIT,
  PAYMENT_PLAN_FULL,
  RENT_PAYMENT_CASH,
  buildRentPaymentStatusLabel,
  getRentPaymentMethods,
  getRentPaymentPlans,
  rentAmountDueNow,
  summarizeRentPayment,
} from './rentPayment.js';

const plans = getRentPaymentPlans(30, true);
console.assert(plans.length === 2, 'full + deposit');
console.assert(getRentPaymentPlans(30, false).length === 1, 'deposit off');

const methods = getRentPaymentMethods({
  checkout_deposit_enabled: true,
  checkout_deposit_percent: 30,
  checkout_bank_transfer_enabled: true,
  checkout_bank_iban: 'GR1601101250000000012300695',
});
console.assert(methods.some((m) => m.id === 'card'), 'card');
console.assert(methods.some((m) => m.id === RENT_PAYMENT_CASH), 'cash');
console.assert(methods.some((m) => m.id === 'bank_transfer'), 'bank');

console.assert(rentAmountDueNow(100, PAYMENT_PLAN_FULL, 'card') === 100, 'full card');
console.assert(rentAmountDueNow(100, PAYMENT_PLAN_DEPOSIT, 'card', 30) === 30, 'deposit 30');
console.assert(rentAmountDueNow(100, PAYMENT_PLAN_FULL, RENT_PAYMENT_CASH) === 0, 'cash now 0');

const sum = summarizeRentPayment({
  totalEur: 200,
  plan: PAYMENT_PLAN_DEPOSIT,
  methodId: 'card',
  depositPercent: 30,
});
console.assert(sum.amountPaid === 60, 'paid 60');
console.assert(sum.balanceDue === 140, 'balance 140');
console.assert(buildRentPaymentStatusLabel(PAYMENT_PLAN_FULL, RENT_PAYMENT_CASH).includes('Μετρητά'), 'cash label');

console.log('rentPayment: OK');
