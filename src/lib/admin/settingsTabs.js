/** Settings tabs — tenant office vs platform operator (super admin). */

export const TENANT_SETTINGS_TABS = [
  { id: 'platform', label: 'Γραφείο', icon: 'storefront', section: 'office' },
  { id: 'payments', label: 'Πληρωμές', icon: 'account_balance', section: 'office' },
  { id: 'fiscal', label: 'Φορολογία', icon: 'receipt_long', section: 'office' },
  { id: 'contracts', label: 'Συμβόλαιο', icon: 'description', section: 'office' },
  { id: 'compliance', label: 'GDPR & Audit', icon: 'shield', section: 'office' },
  { id: 'homepage', label: 'Σχεδιασμός σελίδων', icon: 'web', section: 'office' },
  { id: 'domain', label: 'Domain', icon: 'language', section: 'office' },
  { id: 'users', label: 'Χρήστες', icon: 'group', section: 'office' },
  { id: 'telematics', label: 'Telematics', icon: 'tune', section: 'office' },
];

/** Settings relevant for a Rent-only office (no bus driver portal settings). */
export const RENT_ONLY_SETTINGS_TAB_IDS = new Set([
  'platform',
  'payments',
  'fiscal',
  'contracts',
  'compliance',
  'homepage',
  'domain',
  'users',
  'telematics',
]);

export const PLATFORM_OPERATOR_TABS = [
  { id: 'tenants', label: 'Γραφεία', icon: 'domain', section: 'platform' },
  { id: 'saas_infra', label: 'SaaS Infra', icon: 'dns', section: 'platform' },
  { id: 'integrations', label: 'Integrations', icon: 'key', section: 'platform' },
  { id: 'backup', label: 'Backup', icon: 'backup', section: 'platform' },
  // Partner webhooks / growth tools — platform only (όχι νέο γραφείο).
  { id: 'growth', label: 'Growth', icon: 'hub', section: 'platform' },
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
export function settingsTabsForRole(isSuperAdmin, officeMode = 'trips_only') {
  const base = isSuperAdmin ? SUPER_ADMIN_SETTINGS_TABS : TENANT_SETTINGS_TABS;
  if (officeMode !== 'rent_only') return base;
  return base.filter(
    (t) => t.section === 'platform' || RENT_ONLY_SETTINGS_TAB_IDS.has(t.id),
  );
}

/** Απορρίπτει platform-only tabs αν ο χρήστης δεν είναι superadmin. */
export function sanitizeSettingsSubTab(tab, isSuperAdmin, officeMode = 'trips_only') {
  const fallback = isSuperAdmin ? DEFAULT_PLATFORM_TAB : DEFAULT_TENANT_SETTINGS_TAB;
  if (!tab) return fallback;
  if (PLATFORM_ONLY_TAB_IDS.has(tab) && !isSuperAdmin) return DEFAULT_TENANT_SETTINGS_TAB;
  const allowed = new Set(settingsTabsForRole(isSuperAdmin, officeMode).map((t) => t.id));
  return allowed.has(tab) ? tab : fallback;
}
