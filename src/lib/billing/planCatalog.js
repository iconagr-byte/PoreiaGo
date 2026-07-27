/** Marketing + checkout catalog for travel agency SaaS plans (EUR). */

export const BILLING_INTERVALS = {
  month: { id: 'month', label: 'Μηνιαίο', short: '/μήνα' },
  year: { id: 'year', label: 'Ετήσιο', short: '/έτος', badge: '2 μήνες δώρο' },
};

/** Core bus / trips plans (without Rent unless add-on is on). */
export const AGENCY_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Μικρά γραφεία & νέες εκκινήσεις',
    kind: 'buses',
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
    kind: 'buses',
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
    kind: 'buses',
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

/**
 * Standalone Rent-only contract — for offices that rent vehicles
 * without needing bus ticketing / fleet GPS.
 */
export const RENT_STANDALONE_PLAN = {
  id: 'rent',
  name: 'Rent',
  tagline: 'Μόνο ενοικιάσεις οχημάτων — χωρίς λεωφορεία',
  kind: 'rent_only',
  monthlyEur: 149,
  features: [
    'Customer app /rent + Rent Wallet',
    'Στόλος ενοικίασης, κρατήσεις, QR check-in',
    'SOS, οδική 24/7, CDW/SCDW, share trip, checklist',
    'Δημόσια σελίδα υπηρεσιών για διαφήμιση',
    'Desk Ενοικιάσεις στο Control Panel',
  ],
  highlighted: true,
};

/**
 * Add-on on top of a bus plan (Starter / Professional / Enterprise).
 */
export const RENT_ADDON = {
  id: 'rent_addon',
  name: 'Add-on Ενοικιάσεις',
  tagline: 'Προσθήκη Rent πάνω στο συμβόλαιο λεωφορείων',
  kind: 'addon',
  monthlyEur: 79,
  features: [
    'Όλα του Rent module πάνω στο υπάρχον πλάνο',
    'Ίδιο /rent app & wallet για πελάτες',
    'SOS · οδική · ασφάλεια · share · checklist',
    'Χωρίς αλλαγή του core συμβολαίου λεωφορείων',
  ],
};

export function yearlyFromMonthly(monthlyEur) {
  if (monthlyEur == null) return null;
  return monthlyEur * 10;
}

export function getPlanById(planId) {
  if (planId === RENT_STANDALONE_PLAN.id) return RENT_STANDALONE_PLAN;
  return AGENCY_PLANS.find((p) => p.id === planId) || AGENCY_PLANS[0];
}

/** Plans that can be selected at signup / contracts (excludes contact-sales-only). */
export function selectableAgencyPlans() {
  return [...AGENCY_PLANS.filter((p) => !p.contactSales), RENT_STANDALONE_PLAN];
}

export function isRentOnlyPlan(planId) {
  return planId === RENT_STANDALONE_PLAN.id;
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

export function rentAddonDisplayPrice(interval = 'month') {
  return displayPrice(RENT_ADDON, interval);
}

export function rentStandaloneDisplayPrice(interval = 'month') {
  return displayPrice(RENT_STANDALONE_PLAN, interval);
}
