/** Settings tabs — tenant office vs platform operator (super admin). */

export const TENANT_SETTINGS_TABS = [
  {
    id: 'platform',
    label: 'Γραφείο',
    icon: 'storefront',
    section: 'office',
    accent: 'blue',
    description: 'Στοιχεία γραφείου, επικοινωνία και τιμές θέσεων',
  },
  {
    id: 'payments',
    label: 'Πληρωμές',
    icon: 'account_balance',
    section: 'office',
    accent: 'emerald',
    description: 'Τρόποι πληρωμής, προκαταβολή και τραπεζικοί λογαριασμοί',
  },
  {
    id: 'fiscal',
    label: 'Φορολογία',
    icon: 'receipt_long',
    section: 'office',
    accent: 'amber',
    description: 'myDATA, πάροχοι και ρυθμίσεις αποδείξεων',
  },
  {
    id: 'contracts',
    label: 'Συμβόλαιο',
    icon: 'description',
    section: 'office',
    accent: 'indigo',
    description: 'Πλάνο συνδρομής και τιμολόγηση SaaS',
  },
  {
    id: 'compliance',
    label: 'GDPR & Audit',
    icon: 'shield',
    section: 'office',
    accent: 'teal',
    description: 'Ιδιωτικότητα, αιτήματα και audit trail',
  },
  {
    id: 'homepage',
    label: 'Αρχική σελίδα',
    icon: 'home',
    section: 'office',
    accent: 'violet',
    description: 'Θέμα, ήρωας και περιεχόμενο δημόσιας αρχικής',
  },
  {
    id: 'domain',
    label: 'Domain',
    icon: 'language',
    section: 'office',
    accent: 'sky',
    description: 'Custom domain και branding της σελίδας σας',
  },
  {
    id: 'users',
    label: 'Χρήστες',
    icon: 'group',
    section: 'office',
    accent: 'indigo',
    description: 'Λογαριασμοί διαχειριστών και δικαιώματα',
  },
  {
    id: 'drivers',
    label: 'Οδηγοί',
    icon: 'badge',
    section: 'office',
    accent: 'teal',
    description: 'Μητρώο οδηγών, έγγραφα και πρόσβαση εφαρμογής',
  },
  {
    id: 'telematics',
    label: 'Telematics',
    icon: 'tune',
    section: 'office',
    accent: 'cyan',
    description: 'Geofence, G-force, ETA και ρελαντί στόλου',
  },
];

export const PLATFORM_OPERATOR_TABS = [
  {
    id: 'tenants',
    label: 'Γραφεία',
    icon: 'domain',
    section: 'platform',
    accent: 'indigo',
    description: 'Διαχείριση tenant γραφείων στην πλατφόρμα',
  },
  {
    id: 'saas_infra',
    label: 'SaaS Infra',
    icon: 'dns',
    section: 'platform',
    accent: 'violet',
    description: 'Υποδομή, σύνδεση και κατάσταση υπηρεσιών',
  },
  {
    id: 'backup',
    label: 'Backup',
    icon: 'backup',
    section: 'platform',
    accent: 'amber',
    description: 'Αντίγραφα ασφαλείας και αποκατάσταση',
  },
  // Partner webhooks / growth tools — platform only (όχι νέο γραφείο).
  {
    id: 'growth',
    label: 'Growth',
    icon: 'hub',
    section: 'platform',
    accent: 'rose',
    description: 'Partner webhooks και εργαλεία ανάπτυξης',
  },
];

/** Όλες οι καρτέλες ρυθμίσεων για super admin στο Back Office. */
export const SUPER_ADMIN_SETTINGS_TABS = [
  ...PLATFORM_OPERATOR_TABS,
  ...TENANT_SETTINGS_TABS,
];

export const DEFAULT_PLATFORM_TAB = 'tenants';

export const DEFAULT_TENANT_SETTINGS_TAB = 'platform';

export const PLATFORM_SETTINGS_TABS = SUPER_ADMIN_SETTINGS_TABS;

export const PLATFORM_ONLY_TAB_IDS = new Set(PLATFORM_OPERATOR_TABS.map((t) => t.id));

export const PLATFORM_NAV_SECTIONS = [
  { id: 'platform', label: 'Πλατφόρμα SaaS' },
  { id: 'office', label: 'Ρυθμίσεις γραφείου' },
];

/** Tenant admin — μόνο ρυθμίσεις γραφείου (όχι Tenants/MRR, SaaS Infra, Backup, Growth). */
export function settingsTabsForRole(isSuperAdmin) {
  return isSuperAdmin ? SUPER_ADMIN_SETTINGS_TABS : TENANT_SETTINGS_TABS;
}

/** Απορρίπτει platform-only tabs αν ο χρήστης δεν είναι superadmin. */
export function sanitizeSettingsSubTab(tab, isSuperAdmin) {
  const fallback = isSuperAdmin ? DEFAULT_PLATFORM_TAB : DEFAULT_TENANT_SETTINGS_TAB;
  if (!tab) return fallback;
  if (PLATFORM_ONLY_TAB_IDS.has(tab) && !isSuperAdmin) return DEFAULT_TENANT_SETTINGS_TAB;
  const allowed = new Set(settingsTabsForRole(isSuperAdmin).map((t) => t.id));
  return allowed.has(tab) ? tab : fallback;
}
