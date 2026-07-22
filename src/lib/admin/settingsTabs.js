/** Settings tabs — tenant office vs platform operator (super admin). */

export const TENANT_SETTINGS_TABS = [
  { id: 'platform', label: 'Πλατφόρμα', icon: 'admin_panel_settings', section: 'office' },
  { id: 'payments', label: 'Πληρωμές', icon: 'account_balance', section: 'office' },
  { id: 'fiscal', label: 'Φορολογία', icon: 'receipt_long', section: 'office' },
  { id: 'contracts', label: 'Συμβόλαιο', icon: 'description', section: 'office' },
  { id: 'compliance', label: 'GDPR & Audit', icon: 'shield', section: 'office' },
  { id: 'homepage', label: 'Αρχική σελίδα', icon: 'home', section: 'office' },
  { id: 'growth', label: 'Growth', icon: 'hub', section: 'office' },
  { id: 'users', label: 'Χρήστες', icon: 'group', section: 'office' },
  { id: 'drivers', label: 'Ρυθμίσεις οδηγών', icon: 'badge', section: 'office' },
  { id: 'telematics', label: 'Telematics', icon: 'tune', section: 'office' },
];

export const PLATFORM_OPERATOR_TABS = [
  { id: 'tenants', label: 'Tenants & MRR', icon: 'domain', section: 'platform' },
  { id: 'saas_infra', label: 'SaaS Infra', icon: 'dns', section: 'platform' },
  { id: 'backup', label: 'Backup', icon: 'backup', section: 'platform' },
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

/** Tenant admin — μόνο ρυθμίσεις γραφείου (όχι Tenants/MRR, SaaS Infra, Backup). */
export function settingsTabsForRole(isSuperAdmin) {
  return isSuperAdmin ? SUPER_ADMIN_SETTINGS_TABS : TENANT_SETTINGS_TABS;
}

/** Απορρίπτει platform-only tabs αν ο χρήστης δεν είναι superadmin. */
export function sanitizeSettingsSubTab(tab, isSuperAdmin) {
  const fallback = isSuperAdmin ? DEFAULT_PLATFORM_TAB : DEFAULT_TENANT_SETTINGS_TAB;
  if (!tab) return fallback;
  if (PLATFORM_ONLY_TAB_IDS.has(tab) && !isSuperAdmin) return DEFAULT_TENANT_SETTINGS_TAB;
  const allowed = settingsTabsForRole(isSuperAdmin).map((t) => t.id);
  return allowed.includes(tab) ? tab : fallback;
}
