import { useEffect, useMemo, useState } from 'react';
import SettingsTabPanels from './SettingsTabPanels.jsx';
import AdminMenuFade from './AdminMenuFade.jsx';
import AdminResizableRail from './AdminResizableRail.jsx';
import {
  DEFAULT_PLATFORM_TAB,
  DEFAULT_TENANT_SETTINGS_TAB,
  PLATFORM_NAV_SECTIONS,
  sanitizeSettingsSubTab,
  settingsTabsForRole,
} from '../../lib/admin/settingsTabs.js';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';
import { useUiLang } from '../../hooks/useUiLang.js';
import { tAdmin } from '../../lib/i18n/t.js';

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

function sortOfficeTabs(tabs) {
  const rank = new Map(OFFICE_CARD_ORDER.map((id, i) => [id, i]));
  return [...tabs].sort(
    (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99),
  );
}

/**
 * Settings hub — secondary rail + panel (main sidebar only has «Ρυθμίσεις»).
 * Superadmin: Πλατφόρμα SaaS as micro-icon grid, office as compact mini rows.
 */
export default function SettingsHub({
  initialTab,
  hubFocusKey = 0,
  onSubTabChange,
  contractPrefs,
  officeMode = 'trips_only',
}) {
  const { t, lang } = useUiLang();
  const superAdmin = isSaasSuperAdmin();
  const tabs = settingsTabsForRole(superAdmin, officeMode);
  const defaultTab = superAdmin ? DEFAULT_PLATFORM_TAB : DEFAULT_TENANT_SETTINGS_TAB;
  const labelFor = (tabItem) => tAdmin('settings', tabItem.id, tabItem.label);
  const hintFor = (id, fallback = '') => tAdmin('hint', id, fallback);

  const [tab, setTab] = useState(() =>
    sanitizeSettingsSubTab(initialTab, superAdmin, officeMode),
  );
  /** When designing the page, collapse the settings card rail for more canvas. */
  const [railOpen, setRailOpen] = useState(() => {
    const initial = sanitizeSettingsSubTab(initialTab, superAdmin, officeMode);
    return initial !== 'homepage';
  });

  useEffect(() => {
    if (initialTab) {
      const next = sanitizeSettingsSubTab(initialTab, superAdmin, officeMode);
      setTab(next);
      setRailOpen(next !== 'homepage');
    }
  }, [initialTab, superAdmin, officeMode]);

  // Pinned «Ρυθμίσεις» — reopen the card rail so the general menu is visible.
  useEffect(() => {
    if (!hubFocusKey) return;
    setRailOpen(true);
  }, [hubFocusKey]);

  const activeTab = tabs.find((t) => t.id === tab);
  const designMode = tab === 'homepage';

  const selectTab = (id) => {
    const next = sanitizeSettingsSubTab(id, superAdmin, officeMode);
    setTab(next);
    onSubTabChange?.(next);
    // Entering design → fade rail out for space; leaving → bring it back.
    setRailOpen(next !== 'homepage');
  };

  const grouped = useMemo(() => {
    const office = sortOfficeTabs(tabs.filter((tabItem) => tabItem.section === 'office'));
    const platform = tabs.filter((tabItem) => tabItem.section === 'platform');
    if (!superAdmin) {
      return [{ id: 'office', label: t('section_office'), items: office }];
    }
    return PLATFORM_NAV_SECTIONS.map((section) => ({
      ...section,
      label: tAdmin('section', section.id, section.label),
      items: section.id === 'office' ? office : platform,
    })).filter((s) => s.items.length > 0);
  }, [tabs, superAdmin, lang, t]);

  const homepageHint = hintFor('homepage');

  const tabHint =
    tab === 'homepage'
      ? homepageHint
      : hintFor(tab) || (lang === 'en' ? 'Pick a section from the cards on the left' : 'Επιλέξτε ενότητα από τις κάρτες αριστερά');

  return (
    <div id="settings-hub-top" className="settings-hub w-full scroll-mt-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-start justify-start">
        {/* Secondary settings rail — sticky + collapse (top-right) for more canvas */}
        <AdminResizableRail
          storageKey="poreiago_settings_hub_rail_w"
          defaultWidth={336}
          collapsed={!railOpen}
          expandLabel="Μενού ρυθμίσεων"
          onExpand={() => setRailOpen(true)}
          onCollapse={() => setRailOpen(false)}
        >
          <div className="rounded-[24px] lg:rounded-l-none border border-black/[0.06] lg:border-l-0 bg-white/95 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.05)] p-3.5 sm:p-4 space-y-3.5">
            <div className="px-1.5 pt-0.5">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700/80">
                {t('settings')}
              </p>
              <p className="text-base font-bold text-on-surface mt-0.5">
                {superAdmin
                  ? lang === 'en'
                    ? 'Platform & office'
                    : 'Πλατφόρμα & γραφείο'
                  : t('hub_settings_kicker')}
              </p>
            </div>

            {/* Mobile: horizontal chips */}
            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              {tabs.map((tabItem) => {
                const active = tabItem.id === tab;
                return (
                  <button
                    key={tabItem.id}
                    type="button"
                    onClick={() => selectTab(tabItem.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold border transition ${
                      active
                        ? tabItem.section === 'platform'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-violet-700 text-white border-violet-700'
                        : 'bg-white text-on-surface-variant border-black/[0.08]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{tabItem.icon}</span>
                    {labelFor(tabItem)}
                  </button>
                );
              })}
            </div>

            {/* Desktop: platform micro-icons + office mini list */}
            <div className="hidden lg:block space-y-3.5">
              {grouped.map((section) => {
                const isPlatform = section.id === 'platform';
                const officeBelowPlatform = !isPlatform && superAdmin;
                return (
                  <div
                    key={section.id}
                    className={
                      isPlatform
                        ? 'rounded-2xl border border-indigo-100/90 bg-gradient-to-b from-indigo-50/70 to-white p-2.5 space-y-2'
                        : officeBelowPlatform
                          ? 'space-y-2 pt-1 border-t border-black/[0.05]'
                          : 'space-y-2'
                    }
                  >
                    <p
                      className={`px-1 text-[10px] font-bold uppercase tracking-wider ${
                        isPlatform ? 'text-indigo-600/90' : 'text-on-surface-variant/70'
                      }`}
                    >
                      {section.label}
                    </p>

                    {isPlatform ? (
                      <ul className="grid grid-cols-2 gap-1.5">
                        {section.items.map((tabItem) => {
                          const active = tabItem.id === tab;
                          return (
                            <li key={tabItem.id}>
                              <button
                                type="button"
                                onClick={() => selectTab(tabItem.id)}
                                title={hintFor(tabItem.id, tabItem.label)}
                                className={`settings-hub-micro w-full flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition ${
                                  active
                                    ? 'border-indigo-300 bg-white shadow-sm ring-1 ring-indigo-200/60'
                                    : 'border-transparent bg-white/70 hover:bg-white hover:border-indigo-100'
                                }`}
                              >
                                <span
                                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                    active
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-indigo-100/90 text-indigo-700'
                                  }`}
                                >
                                  <span
                                    className="material-symbols-outlined text-[17px]"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                  >
                                    {tabItem.icon}
                                  </span>
                                </span>
                                <span
                                  className={`text-[11px] font-bold leading-tight text-center truncate w-full ${
                                    active ? 'text-indigo-950' : 'text-slate-700'
                                  }`}
                                >
                                  {labelFor(tabItem)}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <ul className="space-y-1">
                        {section.items.map((tabItem) => {
                          const active = tabItem.id === tab;
                          return (
                            <li key={tabItem.id}>
                              <button
                                type="button"
                                onClick={() => selectTab(tabItem.id)}
                                title={
                                  tabItem.id === 'homepage'
                                    ? homepageHint
                                    : hintFor(tabItem.id, tabItem.label)
                                }
                                className={`w-full text-left flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${
                                  active
                                    ? 'border-violet-300 bg-violet-50 shadow-sm'
                                    : 'border-transparent bg-black/[0.02] hover:bg-black/[0.04] hover:border-black/[0.06]'
                                }`}
                              >
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                                    active
                                      ? 'bg-violet-700 text-white'
                                      : 'bg-violet-100 text-violet-700'
                                  }`}
                                >
                                  <span
                                    className="material-symbols-outlined text-[15px]"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                  >
                                    {tabItem.icon}
                                  </span>
                                </span>
                                <span
                                  className={`min-w-0 flex-1 text-[13px] font-bold truncate ${
                                    active ? 'text-violet-950' : 'text-on-surface'
                                  }`}
                                >
                                  {labelFor(tabItem)}
                                </span>
                                <span
                                  className={`material-symbols-outlined text-[16px] shrink-0 ${
                                    active ? 'text-violet-400' : 'text-slate-300'
                                  }`}
                                  aria-hidden
                                >
                                  chevron_right
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </AdminResizableRail>

        {/* Panel content */}
        <AdminMenuFade panelKey={tab || defaultTab} className="min-w-0 flex-1 space-y-5 w-full">
          {!designMode ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-headline-md font-bold text-on-surface tracking-tight">
                  {activeTab
                    ? labelFor(activeTab)
                    : superAdmin
                      ? t('section_platform')
                      : t('section_office')}
                </h2>
                <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">{tabHint}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                      {labelFor(activeTab)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868b]">
                  {t('settings_homepage')}
                </p>
                <h2 className="text-xl font-bold text-[#1d1d1f] tracking-tight mt-0.5">
                  {hintFor('homepage')}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-[#5e5ce6]/10 border border-[#5e5ce6]/20">
                  <span className="material-symbols-outlined text-[20px] text-[#5e5ce6]">palette</span>
                  <span className="text-sm font-bold text-[#5e5ce6]">{t('settings_homepage')}</span>
                </div>
              </div>
            </div>
          )}

          <SettingsTabPanels
            tab={tab || defaultTab}
            onOpenPayments={() => selectTab('payments')}
            contractPrefs={contractPrefs}
          />
        </AdminMenuFade>
      </div>
    </div>
  );
}
