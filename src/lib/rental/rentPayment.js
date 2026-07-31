/**
 * Rent checkout payment — deposit / methods with pickup-oriented Greek copy.
 */
import {
  PAYMENT_PLAN_DEPOSIT,
  PAYMENT_PLAN_FULL,
  amountDueAtCheckout,
  computeDepositSplit,
  normalizeDepositPercent,
  roundMoney,
} from '../payments/depositPayment.js';
import {
  PAYMENT_METHOD_BANK,
  getCheckoutPaymentMethods,
  isBankTransferAvailable,
} from '../payments/bankTransfer.js';

export { PAYMENT_PLAN_FULL, PAYMENT_PLAN_DEPOSIT, amountDueAtCheckout, computeDepositSplit };

export const RENT_PAYMENT_CASH = 'cash_office';

/** Card checkout only when Stripe is configured for rent (no fake card PAID). */
export function rentCardPaymentsEnabled() {
  if (import.meta.env.VITE_RENT_STRIPE_ENABLED === 'true') return true;
  return Boolean(
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE,
  );
}

export function getRentPaymentPlans(depositPercent = 30, depositEnabled = true) {
  const pct = normalizeDepositPercent(depositPercent);
  const plans = [
    {
      id: PAYMENT_PLAN_FULL,
      label: 'Πλήρης πληρωμή',
      description: 'Ολόκληρο το ποσό τώρα — τίποτα στην παραλαβή.',
      icon: 'payments',
    },
  ];
  if (depositEnabled) {
    plans.push({
      id: PAYMENT_PLAN_DEPOSIT,
      label: `Προκαταβολή ${pct}%`,
      description: `Κλείσε με ${pct}% τώρα · το υπόλοιπο στην παραλαβή.`,
      icon: 'savings',
    });
  }
  return plans;
}

/** Checkout methods for /rent — includes μετρητά στην παραλαβή when enabled. */
export function getRentPaymentMethods(settings) {
  let methods = getCheckoutPaymentMethods(settings).filter(Boolean);
  if (!rentCardPaymentsEnabled()) {
    methods = methods.filter((m) => m.id !== 'card');
  }
  const cashEnabled = !settings?.methods || settings.methods.cash_office?.enabled !== false;
  if (cashEnabled && !methods.some((m) => m.id === RENT_PAYMENT_CASH)) {
    methods.push({
      id: RENT_PAYMENT_CASH,
      label: settings?.methods?.cash_office?.label || 'Μετρητά στην παραλαβή',
      icon: 'storefront',
    });
  }

  if (
    settings &&
    isBankTransferAvailable(settings) &&
    !methods.some((m) => m.id === PAYMENT_METHOD_BANK)
  ) {
    methods.push({
      id: PAYMENT_METHOD_BANK,
      label: 'Τραπεζική μεταφορά',
      icon: 'account_balance',
    });
  }

  return methods;
}

export function rentAmountDueNow(totalEur, plan, methodId, depositPercent = 30) {
  if (methodId === RENT_PAYMENT_CASH) return 0;
  return amountDueAtCheckout(totalEur, plan, depositPercent);
}

export function buildRentPaymentStatusLabel(plan, methodId, depositPercent = 30) {
  const pct = normalizeDepositPercent(depositPercent);
  if (methodId === RENT_PAYMENT_CASH) {
    return 'PENDING · Μετρητά στην παραλαβή';
  }
  if (methodId === PAYMENT_METHOD_BANK) {
    return plan === PAYMENT_PLAN_DEPOSIT
      ? `PENDING · Προκαταβολή ${pct}% (Τράπεζα)`
      : 'PENDING (Bank Transfer)';
  }
  const method =
    methodId === 'card'
      ? 'Credit Card'
      : methodId === 'paypal'
        ? 'PayPal'
        : methodId === 'apple'
          ? 'Apple Pay'
          : String(methodId || 'Online');
  if (plan === PAYMENT_PLAN_DEPOSIT) {
    return `DEPOSIT ${pct}% (${method})`;
  }
  return `PAID (${method})`;
}

export function buildRentPaymentMethodLabel(plan, methodId, depositPercent = 30) {
  const pct = normalizeDepositPercent(depositPercent);
  if (methodId === RENT_PAYMENT_CASH) return 'Μετρητά στην παραλαβή';
  if (methodId === PAYMENT_METHOD_BANK) {
    return plan === PAYMENT_PLAN_DEPOSIT
      ? `Τραπεζική μεταφορά · προκαταβολή ${pct}%`
      : 'Τραπεζική μεταφορά';
  }
  const method =
    methodId === 'card'
      ? 'Πιστωτική / χρεωστική'
      : methodId === 'paypal'
        ? 'PayPal'
        : methodId === 'apple'
          ? 'Apple Pay'
          : String(methodId || 'Online');
  if (plan === PAYMENT_PLAN_DEPOSIT) return `Προκαταβολή ${pct}% · ${method}`;
  return method;
}

export function rentPaymentIsPending(methodId) {
  return methodId === RENT_PAYMENT_CASH || methodId === PAYMENT_METHOD_BANK;
}

export function summarizeRentPayment({
  totalEur,
  plan = PAYMENT_PLAN_FULL,
  methodId = 'card',
  depositPercent = 30,
} = {}) {
  const split = computeDepositSplit(totalEur, depositPercent);
  const amountPaid = rentAmountDueNow(totalEur, plan, methodId, depositPercent);
  const balanceDue = roundMoney(split.total - amountPaid);
  return {
    ...split,
    amountPaid,
    balanceDue,
    payment_plan: plan,
    payment_method: methodId,
    payment_status: buildRentPaymentStatusLabel(plan, methodId, depositPercent),
    payment_method_label: buildRentPaymentMethodLabel(plan, methodId, depositPercent),
    pending: rentPaymentIsPending(methodId),
  };
}
