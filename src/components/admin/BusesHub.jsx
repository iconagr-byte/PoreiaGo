import { BUSES_HUB_TABS, DEFAULT_BUSES_HUB_TAB, sanitizeBusesHubTab } from '../../lib/admin/busesHub.js';
import { isFleetOpsSubTab } from '../../lib/admin/fleetOpsHub.js';

const RAIL_ACTIVE = {
  emerald: 'border-emerald-300 bg-emerald-50 shadow-sm',
  violet: 'border-violet-300 bg-violet-50 shadow-sm',
  sky: 'border-sky-300 bg-sky-50 shadow-sm',
  cyan: 'border-cyan-300 bg-cyan-50 shadow-sm',
  indigo: 'border-indigo-300 bg-indigo-50 shadow-sm',
  amber: 'border-amber-300 bg-amber-50 shadow-sm',
  rose: 'border-rose-300 bg-rose-50 shadow-sm',
  blue: 'border-blue-300 bg-blue-50 shadow-sm',
};

const RAIL_ICON_ACTIVE = {
  emerald: 'bg-emerald-600 text-white',
  violet: 'bg-violet-600 text-white',
  sky: 'bg-sky-600 text-white',
  cyan: 'bg-cyan-600 text-white',
  indigo: 'bg-indigo-600 text-white',
  amber: 'bg-amber-600 text-white',
  rose: 'bg-rose-600 text-white',
  blue: 'bg-blue-600 text-white',
};

const RAIL_ICON_IDLE = {
  emerald: 'bg-emerald-100 text-emerald-700',
  violet: 'bg-violet-100 text-violet-700',
  sky: 'bg-sky-100 text-sky-700',
  cyan: 'bg-cyan-100 text-cyan-800',
  indigo: 'bg-indigo-100 text-indigo-700',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
  blue: 'bg-blue-100 text-blue-700',
};

const CHIP_ACTIVE = {
  emerald: 'bg-emerald-600 text-white border-emerald-600',
  violet: 'bg-violet-600 text-white border-violet-600',
  sky: 'bg-sky-600 text-white border-sky-600',
  cyan: 'bg-cyan-600 text-white border-cyan-600',
  indigo: 'bg-indigo-600 text-white border-indigo-600',
  amber: 'bg-amber-600 text-white border-amber-600',
  rose: 'bg-rose-600 text-white border-rose-600',
  blue: 'bg-blue-600 text-white border-blue-600',
};

/**
 * Buses hub — sidebar card «Λεωφορεία» opens this menu on the right
 * (same pattern as SettingsHub / RentDeskHub).
 */
export default function BusesHub({ activeTab, onNavigate, children }) {
  const railTab = sanitizeBusesHubTab(activeTab);
  const active = BUSES_HUB_TABS.find((t) => t.id === railTab) || BUSES_HUB_TABS[0];
  const inFleetOps = activeTab === 'fleet_ops' || isFleetOpsSubTab(activeTab);

  const selectTab = (id) => {
    onNavigate?.(id || DEFAULT_BUSES_HUB_TAB);
  };

  return (
    <div className="buses-hub animate-in fade-in duration-300 w-full">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-start justify-start">
        <aside className="w-full lg:w-80 xl:w-[22rem] shrink-0 lg:sticky lg:top-3 self-start">
          <div className="rounded-[24px] lg:rounded-l-none border border-black/[0.06] lg:border-l-0 bg-white/95 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.05)] p-3.5 sm:p-4 space-y-4">
            <div className="px-1.5 pt-0.5">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-700/80">Λεωφορεία</p>
              <p className="text-base font-bold text-on-surface mt-0.5">Εκδρομές & στόλος</p>
            </div>

            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              {BUSES_HUB_TABS.map((t) => {
                const isActive = t.id === railTab;
                const accent = t.accent || 'sky';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTab(t.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold border transition ${
                      isActive
                        ? CHIP_ACTIVE[accent] || CHIP_ACTIVE.sky
                        : 'bg-white text-on-surface-variant border-black/[0.08]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>

            <ul className="hidden lg:block space-y-1.5">
              {BUSES_HUB_TABS.map((t) => {
                const isActive = t.id === railTab;
                const accent = t.accent || 'sky';
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectTab(t.id)}
                      className={`w-full text-left flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition ${
                        isActive
                          ? RAIL_ACTIVE[accent] || RAIL_ACTIVE.sky
                          : 'border-transparent bg-black/[0.02] hover:bg-black/[0.04] hover:border-black/[0.06]'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isActive
                            ? RAIL_ICON_ACTIVE[accent] || RAIL_ICON_ACTIVE.sky
                            : RAIL_ICON_IDLE[accent] || RAIL_ICON_IDLE.sky
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
                            isActive ? 'text-slate-950' : 'text-on-surface'
                          }`}
                        >
                          {t.label}
                        </span>
                        <span className="block text-xs text-on-surface-variant truncate mt-0.5 leading-snug">
                          {t.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-5 w-full">
          {!inFleetOps ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-headline-md font-bold text-on-surface tracking-tight">
                  {active.label}
                </h2>
                <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">{active.description}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl border bg-sky-500/[0.08] border-sky-500/15">
                <span className="material-symbols-outlined text-[20px] text-sky-700">
                  {active.icon}
                </span>
                <span className="text-sm font-bold text-sky-800">{active.label}</span>
              </div>
            </div>
          ) : null}

          {children}
        </div>
      </div>
    </div>
  );
}
