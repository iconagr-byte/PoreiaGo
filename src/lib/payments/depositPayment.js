/** Deposit checkout — configurable % online, balance in cash on the bus. */

export const PAYMENT_PLAN_FULL = 'full';
export const PAYMENT_PLAN_DEPOSIT = 'deposit';

export const DEFAULT_DEPOSIT_PERCENT = 30;

export function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function normalizeDepositPercent(value) {
  let pct = parseInt(String(value ?? DEFAULT_DEPOSIT_PERCENT), 10);
  if (!Number.isFinite(pct)) pct = DEFAULT_DEPOSIT_PERCENT;
  return Math.max(5, Math.min(90, pct));
}

/** @param {number} depositPercent */
export function getPaymentPlans(depositPercent = DEFAULT_DEPOSIT_PERCENT) {
  const pct = normalizeDepositPercent(depositPercent);
  return [
    {
      id: PAYMENT_PLAN_FULL,
      label: 'Πλήρης πληρωμή',
      description: 'Ολόκληρο το ποσό online — τίποτα στο λεωφορείο.',
      icon: 'payments',
    },
    {
      id: PAYMENT_PLAN_DEPOSIT,
      label: `Προκαταβολή ${pct}%`,
      description: `Κλείστε με ${pct}% τώρα · το υπόλοιπο μετρητά κατά την επιβίβαση.`,
      icon: 'savings',
    },
  ];
}

/** @param {number} totalEur @param {number} [depositPercent] */
export function computeDepositSplit(totalEur, depositPercent = DEFAULT_DEPOSIT_PERCENT) {
  const pct = normalizeDepositPercent(depositPercent);
  const rate = pct / 100;
  const total = roundMoney(totalEur);
  const depositAmount = roundMoney(total * rate);
  const balanceDue = roundMoney(total - depositAmount);
  return {
    total,
    depositAmount,
    balanceDue,
    depositPercent: pct,
  };
}

/** @param {number} totalEur @param {'full'|'deposit'} plan @param {number} [depositPercent] */
export function amountDueAtCheckout(totalEur, plan, depositPercent = DEFAULT_DEPOSIT_PERCENT) {
  const split = computeDepositSplit(totalEur, depositPercent);
  if (plan === PAYMENT_PLAN_DEPOSIT) return split.depositAmount;
  return split.total;
}

/** @param {'full'|'deposit'} plan @param {string} methodId @param {number} [depositPercent] */
export function buildPaymentStatusLabel(plan, methodId, depositPercent = DEFAULT_DEPOSIT_PERCENT) {
  const pct = normalizeDepositPercent(depositPercent);
  if (methodId === 'bank_transfer') {
    if (plan === PAYMENT_PLAN_DEPOSIT) {
      return `PENDING · Προκαταβολή ${pct}% (Τράπεζα)`;
    }
    return 'PENDING (Bank Transfer)';
  }
  const method =
    methodId === 'card'
      ? 'Credit Card'
      : methodId === 'paypal'
        ? 'PayPal'
        : 'Apple Pay';
  if (plan === PAYMENT_PLAN_DEPOSIT) {
    return `DEPOSIT ${pct}% (${method})`;
  }
  return `PAID (${method})`;
}

/** @param {'full'|'deposit'} plan @param {string} methodId @param {number} [depositPercent] */
export function buildPaymentMethodLabel(plan, methodId, depositPercent = DEFAULT_DEPOSIT_PERCENT) {
  const pct = normalizeDepositPercent(depositPercent);
  if (methodId === 'bank_transfer') {
    return plan === PAYMENT_PLAN_DEPOSIT
      ? `Τραπεζική μεταφορά · προκαταβολή ${pct}%`
      : 'Τραπεζική μεταφορά';
  }
  const method =
    methodId === 'card'
      ? 'Πιστωτική Κάρτα'
      : methodId === 'paypal'
        ? 'PayPal'
        : 'Apple Pay';
  if (plan === PAYMENT_PLAN_DEPOSIT) {
    return `Προκαταβολή ${pct}% · ${method}`;
  }
  return method;
}

export function formatDepositPaymentStatus(depositPercent = DEFAULT_DEPOSIT_PERCENT) {
  return `DEPOSIT ${normalizeDepositPercent(depositPercent)}% (Online)`;
}
