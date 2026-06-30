/** Marketing + checkout catalog for travel agency SaaS plans (EUR). */

export const BILLING_INTERVALS = {
  month: { id: 'month', label: 'Μηνιαίο', short: '/μήνα' },
  year: { id: 'year', label: 'Ετήσιο', short: '/έτος', badge: '2 μήνες δώρο' },
};

export const AGENCY_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Μικρά γραφεία & νέες εκκινήσεις',
    monthlyEur: 99,
    features: [
      'Έως 2 λεωφορεία στο fleet',
      'Online κρατήσεις & QR εισιτήρια',
      'Βασικό Control Panel',
      'Καμπάνιες email με έτοιμα πρότυπα',
      'Email υποστήριξη',
    ],
    highlighted: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'Ταξιδιωτικά γραφεία σε ανάπτυξη',
    monthlyEur: 299,
    features: [
      'Απεριόριστα λεωφορεία (metered)',
      'Live GPS & telematics',
      'Dynamic pricing & Growth tools',
      'Email Hub — 94+ έτοιμα πρότυπα καμπάνιας',
      'GDPR & audit logs',
      'Προτεραιότητα υποστήριξης',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Πολυκαταστήματα & white-label',
    monthlyEur: null,
    features: [
      'Πολλαπλά branches / tenants',
      'Custom domain & SLA',
      'Dedicated onboarding',
      'API & partner webhooks',
    ],
    highlighted: false,
    contactSales: true,
  },
];

export function yearlyFromMonthly(monthlyEur) {
  if (monthlyEur == null) return null;
  return monthlyEur * 10;
}

export function getPlanById(planId) {
  return AGENCY_PLANS.find((p) => p.id === planId) || AGENCY_PLANS[0];
}

export function displayPrice(plan, interval) {
  if (plan.contactSales || plan.monthlyEur == null) {
    return { amount: null, label: 'Κατόπιν συνεννόησης' };
  }
  if (interval === 'year') {
    const yearly = yearlyFromMonthly(plan.monthlyEur);
    return {
      amount: yearly,
      label: `€${yearly}`,
      suffix: BILLING_INTERVALS.year.short,
      compareAt: plan.monthlyEur * 12,
    };
  }
  return {
    amount: plan.monthlyEur,
    label: `€${plan.monthlyEur}`,
    suffix: BILLING_INTERVALS.month.short,
  };
}
