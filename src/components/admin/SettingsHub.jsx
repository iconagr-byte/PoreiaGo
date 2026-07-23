import { useEffect, useState } from 'react';
import SettingsTabPanels from './SettingsTabPanels.jsx';
import {
  sanitizeSettingsSubTab,
  settingsTabsForRole,
} from '../../lib/admin/settingsTabs.js';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';


const ACCENT_PILL = {
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200/80',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  amber: 'bg-amber-50 text-amber-900 border-amber-200/80',
  violet: 'bg-violet-50 text-violet-800 border-violet-200/80',
  sky: 'bg-sky-50 text-sky-800 border-sky-200/80',
  cyan: 'bg-cyan-50 text-cyan-800 border-cyan-200/80',
  rose: 'bg-rose-50 text-rose-800 border-rose-200/80',
  blue: 'bg-blue-50 text-blue-800 border-blue-200/80',
  teal: 'bg-teal-50 text-teal-800 border-teal-200/80',
};

/** Περιεχόμενο ρυθμίσεων — η πλοήγηση είναι στο αριστερό sidebar + quick pills. */
export default function SettingsHub({ initialTab, onSubTabChange, contractPrefs }) {
  const superAdmin = isSaasSuperAdmin();
  const tabs = settingsTabsForRole(superAdmin);

  const [tab, setTab] = useState(() => sanitizeSettingsSubTab(initialTab, superAdmin));

  useEffect(() => {
    if (initialTab) {
      setTab(sanitizeSettingsSubTab(initialTab, superAdmin));
    }
  }, [initialTab, superAdmin]);

  const activeTab = tabs.find((t) => t.id === tab);
  const accent = activeTab?.accent || 'blue';
  const accentPill = ACCENT_PILL[accent] || ACCENT_PILL.blue;

  const selectTab = (id) => {
    const next = sanitizeSettingsSubTab(id, superAdmin);
    setTab(next);
    onSubTabChange?.(next);
  };

  const officeTabs = tabs.filter((t) => t.section === 'office');
  const platformTabs = tabs.filter((t) => t.section === 'platform');

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-headline-md font-bold text-on-surface tracking-tight">
            {activeTab?.label || (superAdmin ? 'Ρυθμίσεις πλατφόρμας' : 'Ρυθμίσεις γραφείου')}
          </h2>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            {activeTab?.description || 'Επιλέξτε ενότητα από το μενού στα αριστερά ή από τις συντομεύσεις κάτω.'}
          </p>
        </div>
        {activeTab && (
          <div
            className={`hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${accentPill}`}
          >
            <span className="material-symbols-outlined text-[20px]">{activeTab.icon}</span>
            <span className="text-sm font-bold">{activeTab.label}</span>
          </div>
        )}
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        {superAdmin && platformTabs.length > 0 && (
          <div className="mb-2.5">
            <p className="px-1 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Πλατφόρμα SaaS
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {platformTabs.map((t) => {
                const active = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTab(t.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition ${
                      active
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          {superAdmin && (
            <p className="px-1 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Ρυθμίσεις γραφείου
            </p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin">
            {officeTabs.map((t) => {
              const active = t.id === tab;
              const pill = ACCENT_PILL[t.accent] || ACCENT_PILL.blue;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTab(t.id)}
                  title={t.description}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition ${
                    active
                      ? `${pill} shadow-sm`
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <SettingsTabPanels
        tab={tab}
        onOpenPayments={() => selectTab('payments')}
        contractPrefs={contractPrefs}
      />
    </div>
  );
}
