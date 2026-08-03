import { useEffect, useMemo, useState } from 'react';
import SettingsTabPanels from './SettingsTabPanels.jsx';
import {
  DEFAULT_PLATFORM_TAB,
  DEFAULT_TENANT_SETTINGS_TAB,
  PLATFORM_NAV_SECTIONS,
  sanitizeSettingsSubTab,
  settingsTabsForRole,
} from '../../lib/admin/settingsTabs.js';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';

/** Preferred office card order (Σχεδιασμός first). */
const OFFICE_CARD_ORDER = [
  'homepage',
  'platform',
  'payments',
  'fiscal',
  'contracts',
  'compliance',
  'domain',
  'users',
  'logins',
];

const TAB_HINTS = {
  platform: 'Επωνυμία, locale, abandoned recovery, δυναμική τιμολόγηση και θέσεις',
  payments: 'Τρόποι πληρωμής, προκαταβολή και τραπεζικοί λογαριασμοί',
  fiscal: 'ΑΑΔΕ / myDATA και φορολογικές ρυθμίσεις',
  contracts: 'Πλάνο συνδρομής και συμβόλαιο γραφείου',
  compliance: 'GDPR, audit trail και δικαιώματα υποκειμένων',
  homepage: 'Σχεδιασμός σελίδας — θέμα, hero και κάρτες',
  domain: 'Domain ιστοσελίδας, επωνυμία, χρώμα και λογότυπο',
  users: 'Λογαριασμοί διαχειριστών του γραφείου',
  logins: 'Ιστορικό συνδέσεων και audit εισόδου',
  tenants: 'Διαχείριση γραφείων / tenants της πλατφόρμας',
  saas_infra: 'Υποδομή SaaS και σύνδεση υπηρεσιών',
  backup: 'Αντίγραφα ασφαλείας και επαναφορά',
  growth: 'Partner webhooks και growth εργαλεία',
};

function sortOfficeTabs(tabs) {
  const rank = new Map(OFFICE_CARD_ORDER.map((id, i) => [id, i]));
  return [...tabs].sort(
    (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99),
  );
}

/**
 * Settings hub — secondary card rail + panel (main sidebar only has «Ρυθμίσεις»).
 */
export default function SettingsHub({
  initialTab,
  onSubTabChange,
  contractPrefs,
  officeMode = 'trips_only',
}) {
  const superAdmin = isSaasSuperAdmin();
  const tabs = settingsTabsForRole(superAdmin, officeMode);
  const defaultTab = superAdmin ? DEFAULT_PLATFORM_TAB : DEFAULT_TENANT_SETTINGS_TAB;

  const [tab, setTab] = useState(() =>
    sanitizeSettingsSubTab(initialTab, superAdmin, officeMode),
  );

  useEffect(() => {
    if (initialTab) {
      setTab(sanitizeSettingsSubTab(initialTab, superAdmin, officeMode));
    }
  }, [initialTab, superAdmin, officeMode]);

  const activeTab = tabs.find((t) => t.id === tab);

  const selectTab = (id) => {
    const next = sanitizeSettingsSubTab(id, superAdmin, officeMode);
    setTab(next);
    onSubTabChange?.(next);
  };

  const grouped = useMemo(() => {
    const office = sortOfficeTabs(tabs.filter((t) => t.section === 'office'));
    const platform = tabs.filter((t) => t.section === 'platform');
    if (!superAdmin) {
      return [{ id: 'office', label: 'Ρυθμίσεις γραφείου', items: office }];
    }
    return PLATFORM_NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.id === 'office' ? office : platform,
    })).filter((s) => s.items.length > 0);
  }, [tabs, superAdmin]);

  const homepageHint =
    officeMode === 'rent_only'
      ? 'Σχεδιασμός σελίδας /rent — από το συμβόλαιο Ενοικιάσεις'
      : officeMode === 'both'
        ? 'Διάλεξε Λεωφορεία ή Ενοικιάσεις και σχεδίασε τη σελίδα'
        : 'Σχεδιασμός αρχικής εκδρομών — θέμα, hero και κάρτες';

  const tabHint =
    tab === 'homepage'
      ? homepageHint
      : TAB_HINTS[tab] || 'Επιλέξτε ενότητα από τις κάρτες αριστερά';

  return (
    <div className="settings-hub animate-in fade-in duration-300 w-full">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-start justify-start">
        {/* Secondary settings rail — larger, flush left */}
        <aside className="w-full lg:w-80 xl:w-[22rem] shrink-0 lg:sticky lg:top-3 self-start">
          <div className="rounded-[24px] lg:rounded-l-none border border-black/[0.06] lg:border-l-0 bg-white/95 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.05)] p-3.5 sm:p-4 space-y-4">
            <div className="px-1.5 pt-0.5">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700/80">
                Ρυθμίσεις
              </p>
              <p className="text-base font-bold text-on-surface mt-0.5">
                {superAdmin ? 'Πλατφόρμα & γραφείο' : 'Γραφείο'}
              </p>
            </div>

            {/* Mobile: horizontal chips */}
            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              {tabs.map((t) => {
                const active = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTab(t.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold border transition ${
                      active
                        ? t.section === 'platform'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-violet-700 text-white border-violet-700'
                        : 'bg-white text-on-surface-variant border-black/[0.08]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Desktop: card list */}
            <div className="hidden lg:block space-y-4">
              {grouped.map((section) => (
                <div key={section.id} className="space-y-2">
                  <p
                    className={`px-1.5 text-[11px] font-bold uppercase tracking-wider ${
                      section.id === 'platform' ? 'text-indigo-600/80' : 'text-on-surface-variant/70'
                    }`}
                  >
                    {section.label}
                  </p>
                  <ul className="space-y-1.5">
                    {section.items.map((t) => {
                      const active = t.id === tab;
                      const platform = t.section === 'platform';
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => selectTab(t.id)}
                            className={`w-full text-left flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition ${
                              active
                                ? platform
                                  ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                                  : 'border-violet-300 bg-violet-50 shadow-sm'
                                : 'border-transparent bg-black/[0.02] hover:bg-black/[0.04] hover:border-black/[0.06]'
                            }`}
                          >
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                active
                                  ? platform
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-violet-700 text-white'
                                  : platform
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-violet-100 text-violet-700'
                              }`}
                            >
                              <span
                                className="material-symbols-outlined text-[22px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                {t.icon}
                              </span>
                            </span>
                            <span className="min-w-0">
                              <span
                                className={`block text-[15px] font-bold truncate ${
                                  active
                                    ? platform
                                      ? 'text-indigo-950'
                                      : 'text-violet-950'
                                    : 'text-on-surface'
                                }`}
                              >
                                {t.label}
                              </span>
                              <span className="block text-xs text-on-surface-variant truncate mt-0.5 leading-snug">
                                {t.id === 'homepage' ? homepageHint : TAB_HINTS[t.id] || ''}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Panel content */}
        <div className="min-w-0 flex-1 space-y-5 w-full">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-headline-md font-bold text-on-surface tracking-tight">
                {activeTab?.label ||
                  (superAdmin ? 'Ρυθμίσεις πλατφόρμας' : 'Ρυθμίσεις γραφείου')}
              </h2>
              <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">{tabHint}</p>
            </div>
            {activeTab ? (
              <div
                className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl border ${
                  superAdmin && activeTab.section === 'platform'
                    ? 'bg-indigo-500/[0.08] border-indigo-500/15'
                    : 'bg-violet-500/[0.08] border-violet-500/15'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    superAdmin && activeTab.section === 'platform'
                      ? 'text-indigo-700'
                      : 'text-violet-700'
                  }`}
                >
                  {activeTab.icon}
                </span>
                <span
                  className={`text-sm font-bold ${
                    superAdmin && activeTab.section === 'platform'
                      ? 'text-indigo-800'
                      : 'text-violet-800'
                  }`}
                >
                  {activeTab.label}
                </span>
              </div>
            ) : null}
          </div>

          <SettingsTabPanels
            tab={tab || defaultTab}
            onOpenPayments={() => selectTab('payments')}
            contractPrefs={contractPrefs}
          />
        </div>
      </div>
    </div>
  );
}
