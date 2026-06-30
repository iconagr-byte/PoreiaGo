import { useEffect, useMemo, useState } from 'react';
import SettingsTabPanels from './SettingsTabPanels.jsx';
import {
  TENANT_SETTINGS_TABS,
  DEFAULT_PLATFORM_TAB,
  DEFAULT_TENANT_SETTINGS_TAB,
  sanitizeSettingsSubTab,
  settingsTabsForRole,
} from '../../lib/admin/settingsTabs.js';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';

const DEFAULT_TENANT_TAB = DEFAULT_TENANT_SETTINGS_TAB;

/** Περιεχόμενο ρυθμίσεων — η πλοήγηση είναι στο αριστερό sidebar. */
export default function SettingsHub({ initialTab, onSubTabChange, contractPrefs }) {
  const superAdmin = isSaasSuperAdmin();
  const tabs = settingsTabsForRole(superAdmin);
  const defaultTab = superAdmin ? DEFAULT_PLATFORM_TAB : DEFAULT_TENANT_TAB;
  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  const [tab, setTab] = useState(() => sanitizeSettingsSubTab(initialTab, superAdmin));

  useEffect(() => {
    if (initialTab) {
      setTab(sanitizeSettingsSubTab(initialTab, superAdmin));
    }
  }, [initialTab, superAdmin]);

  const activeTab = tabs.find((t) => t.id === tab);

  const selectTab = (id) => {
    const next = sanitizeSettingsSubTab(id, superAdmin);
    setTab(next);
    onSubTabChange?.(next);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-headline-md font-bold text-on-surface tracking-tight">
            {activeTab?.label || (superAdmin ? 'Ρυθμίσεις πλατφόρμας' : 'Ρυθμίσεις γραφείου')}
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Επιλέξτε ενότητα από το μενού στα αριστερά
          </p>
        </div>
        {activeTab && (
          <div
            className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl border ${
              superAdmin && activeTab.section === 'platform'
                ? 'bg-indigo-500/[0.08] border-indigo-500/15'
                : 'bg-primary/[0.06] border-primary/10'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                superAdmin && activeTab.section === 'platform' ? 'text-indigo-700' : 'text-primary'
              }`}
            >
              {activeTab.icon}
            </span>
            <span
              className={`text-sm font-bold ${
                superAdmin && activeTab.section === 'platform' ? 'text-indigo-800' : 'text-primary'
              }`}
            >
              {activeTab.label}
            </span>
          </div>
        )}
      </div>

      <SettingsTabPanels
        tab={tab}
        onOpenPayments={() => selectTab('payments')}
        contractPrefs={contractPrefs}
      />
    </div>
  );
}
