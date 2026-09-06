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
      'Newsletter templates (με ενεργό συμβόλαιο)',
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
      'Email Hub — πρότυπα καμπάνιας + Newsletter',
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
 * without needing bus ticketing / trip GPS.
 * Marketing copy can be overridden via /api/site/rent-plan-catalog.
 */
export const RENT_STANDALONE_PLAN = {
  id: 'rent',
  badge: 'Αυτόνομο συμβόλαιο',
  name: 'PoreiaGo Rent',
  tagline: 'Μόνο ενοικιάσεις οχημάτων — χωρίς λεωφορεία',
  kind: 'rent_only',
  monthlyEur: 149,
  features: [
    'Customer app /rent + Rent Wallet',
    'Στόλος ενοικίασης, κρατήσεις, QR check-in',
    'SOS, οδική 24/7, CDW/SCDW, share trip, checklist',
    'Αρχική σελίδα γραφείου μόνο με Rent (χωρίς λεωφορεία)',
    'Desk Ενοικιάσεις στο Control Panel',
    'Email πρότυπα Ενοικιάσεων + Newsletter',
  ],
  ctaLoggedIn: 'Επιλογή Rent συμβολαίου',
  ctaGuest: 'Εγγραφή μόνο για Rent',
  visible: true,
  highlighted: true,
};

/**
 * Add-on on top of a bus plan (Starter / Professional / Enterprise).
 */
export const RENT_ADDON = {
  id: 'rent_addon',
  badge: 'Add-on σε λεωφορεία',
  name: 'Add-on Ενοικιάσεις',
  tagline: 'Προσθήκη Rent πάνω στο συμβόλαιο λεωφορείων',
  kind: 'addon',
  monthlyEur: 79,
  features: [
    'Όλα του Rent module πάνω στο υπάρχον πλάνο',
    'Ίδιο /rent app & wallet για πελάτες',
    'SOS · οδική · ασφάλεια · share · checklist',
    'Email πρότυπα Ενοικιάσεων στο Πρότυπα',
    'Χωρίς αλλαγή του core συμβολαίου λεωφορείων',
  ],
  ctaLoggedIn: 'Ενεργοποίηση add-on στο συμβόλαιο',
  ctaGuest: 'Θέλω λεωφορεία + Rent',
  servicesLinkLabel: 'Δες δημόσια σελίδα υπηρεσιών →',
  visible: true,
};

export const DEFAULT_RENT_SECTION_TITLE = 'Ενοικιάσεις — ξεχωριστά';

export function mergeRentCard(defaults, override) {
  if (!override || typeof override !== 'object') {
    return { ...defaults, features: [...(defaults.features || [])] };
  }
  const features = Array.isArray(override.features)
    ? override.features.map((f) => String(f).trim()).filter(Boolean)
    : defaults.features;
  const monthly =
    override.monthlyEur != null && Number.isFinite(Number(override.monthlyEur))
      ? Number(override.monthlyEur)
      : defaults.monthlyEur;
  return {
    ...defaults,
    ...override,
    id: defaults.id,
    kind: defaults.kind,
    monthlyEur: monthly,
    features: features?.length ? features : [...(defaults.features || [])],
    visible: override.visible !== false,
    highlighted: defaults.highlighted,
  };
}

export function mergeRentPlanCatalog(payload) {
  return {
    sectionTitle:
      (payload?.sectionTitle && String(payload.sectionTitle).trim()) ||
      DEFAULT_RENT_SECTION_TITLE,
    standalone: mergeRentCard(RENT_STANDALONE_PLAN, payload?.standalone),
    addon: mergeRentCard(RENT_ADDON, payload?.addon),
  };
}

export const DEFAULT_AGENCY_SECTION_TITLE = 'Συμβόλαια λεωφορείων';
export const BUILTIN_AGENCY_PLAN_IDS = new Set(AGENCY_PLANS.map((p) => p.id));
/** Plans that can go through Stripe / trial checkout (custom cards are marketing-only). */
export const BILLABLE_PLAN_IDS = new Set(['starter', 'professional', 'rent']);

export function isBillablePlanId(planId) {
  return BILLABLE_PLAN_IDS.has(String(planId || ''));
}

export function normalizeAgencyPlan(raw, fallback = null) {
  const base = fallback || {
    id: 'custom',
    name: 'Custom',
    tagline: '',
    kind: 'buses',
    monthlyEur: 0,
    features: [],
    highlighted: false,
    contactSales: false,
    visible: true,
    icon: 'workspace_premium',
    builtin: false,
  };
  if (!raw || typeof raw !== 'object') {
    return { ...base, features: [...(base.features || [])] };
  }
  const id = String(raw.id || base.id || 'custom').trim() || 'custom';
  const builtin = BUILTIN_AGENCY_PLAN_IDS.has(id) || Boolean(raw.builtin);
  const features = Array.isArray(raw.features)
    ? raw.features.map((f) => String(f).trim()).filter(Boolean)
    : [...(base.features || [])];
  let monthlyEur = base.monthlyEur;
  if (Object.prototype.hasOwnProperty.call(raw, 'monthlyEur')) {
    if (raw.monthlyEur == null || raw.monthlyEur === '') monthlyEur = null;
    else {
      const n = Number(raw.monthlyEur);
      monthlyEur = Number.isFinite(n) ? n : base.monthlyEur;
    }
  }
  const contactSales = raw.contactSales != null ? Boolean(raw.contactSales) : Boolean(base.contactSales);
  if (contactSales) monthlyEur = null;
  return {
    ...base,
    ...raw,
    id,
    name: String(raw.name || base.name || '').trim() || base.name,
    tagline: String(raw.tagline ?? base.tagline ?? '').trim(),
    kind: String(raw.kind || base.kind || 'buses'),
    icon: String(raw.icon || base.icon || 'workspace_premium'),
    monthlyEur,
    features: features.length ? features : [...(base.features || [])],
    highlighted: Boolean(raw.highlighted ?? base.highlighted),
    contactSales,
    visible: raw.visible !== false,
    builtin,
  };
}

export function mergeAgencyPlanCatalog(payload) {
  const defaultsById = Object.fromEntries(AGENCY_PLANS.map((p) => [p.id, p]));
  const rawPlans = Array.isArray(payload?.plans) ? payload.plans : null;
  let plans;
  if (rawPlans?.length) {
    const seen = new Set();
    plans = [];
    for (const item of rawPlans) {
      const id = String(item?.id || '').trim();
      const normalized = normalizeAgencyPlan(item, defaultsById[id] || null);
      if (!normalized.id || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      plans.push(normalized);
    }
    for (const builtin of AGENCY_PLANS) {
      if (!seen.has(builtin.id)) {
        plans.push(normalizeAgencyPlan({ ...builtin, visible: false }, builtin));
      }
    }
  } else {
    plans = AGENCY_PLANS.map((p) => normalizeAgencyPlan(p, p));
  }
  return {
    sectionTitle:
      (payload?.sectionTitle && String(payload.sectionTitle).trim()) ||
      DEFAULT_AGENCY_SECTION_TITLE,
    plans,
  };
}

/** Visible bus plans for marketing pages (hero + /grafeia). */
export function listVisibleAgencyPlans(catalogOrPlans) {
  const plans = Array.isArray(catalogOrPlans)
    ? catalogOrPlans
    : catalogOrPlans?.plans || AGENCY_PLANS;
  return plans.filter((p) => p && p.visible !== false);
}

export function yearlyFromMonthly(monthlyEur) {
  if (monthlyEur == null) return null;
  return monthlyEur * 10;
}

export function getPlanById(planId, agencyCatalog = null, rentCatalog = null) {
  const rent = mergeRentPlanCatalog(rentCatalog).standalone;
  if (planId === rent.id) return rent;
  const agency = mergeAgencyPlanCatalog(agencyCatalog);
  return agency.plans.find((p) => p.id === planId) || agency.plans[0] || AGENCY_PLANS[0];
}

/** Plans that can be selected at signup / contracts (excludes contact-sales-only). */
export function selectableAgencyPlans(agencyCatalog = null, rentCatalog = null) {
  const buses = listVisibleAgencyPlans(agencyCatalog || AGENCY_PLANS).filter(
    (p) => !p.contactSales,
  );
  const rent = mergeRentPlanCatalog(rentCatalog).standalone;
  const rentOption = rent.visible === false ? [] : [rent];
  return [...buses, ...rentOption];
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

export function rentAddonDisplayPrice(interval = 'month', plan = RENT_ADDON) {
  return displayPrice(plan, interval);
}

export function rentStandaloneDisplayPrice(interval = 'month', plan = RENT_STANDALONE_PLAN) {
  return displayPrice(plan, interval);
}
