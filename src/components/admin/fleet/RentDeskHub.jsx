import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_RENT_DESK_TAB,
  RENT_DESK_GROUPS,
  RENT_DESK_TABS,
  sanitizeRentDeskTab,
} from '../../../lib/admin/rentDeskNav.js';
import FleetRentalPanel from './FleetRentalPanel.jsx';
import AdminMenuFade from '../AdminMenuFade.jsx';

const RAIL_ACTIVE = {
  teal: 'border-teal-300 bg-teal-50 shadow-sm',
  emerald: 'border-emerald-300 bg-emerald-50 shadow-sm',
  sky: 'border-sky-300 bg-sky-50 shadow-sm',
  amber: 'border-amber-300 bg-amber-50 shadow-sm',
  violet: 'border-violet-300 bg-violet-50 shadow-sm',
  rose: 'border-rose-300 bg-rose-50 shadow-sm',
  slate: 'border-slate-300 bg-slate-50 shadow-sm',
};

const RAIL_ICON_ACTIVE = {
  teal: 'bg-teal-700 text-white',
  emerald: 'bg-emerald-600 text-white',
  sky: 'bg-sky-600 text-white',
  amber: 'bg-amber-600 text-white',
  violet: 'bg-violet-600 text-white',
  rose: 'bg-rose-600 text-white',
  slate: 'bg-slate-700 text-white',
};

const RAIL_ICON_IDLE = {
  teal: 'bg-teal-100 text-teal-800',
  emerald: 'bg-emerald-100 text-emerald-700',
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-800',
  violet: 'bg-violet-100 text-violet-700',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-100 text-slate-700',
};

const CHIP_ACTIVE = {
  teal: 'bg-teal-700 text-white border-teal-700',
  emerald: 'bg-emerald-600 text-white border-emerald-600',
  sky: 'bg-sky-600 text-white border-sky-600',
  amber: 'bg-amber-600 text-white border-amber-600',
  violet: 'bg-violet-600 text-white border-violet-600',
  rose: 'bg-rose-600 text-white border-rose-600',
  slate: 'bg-slate-700 text-white border-slate-700',
};

/**
 * Rent desk hub — one sidebar entry «Ενοικιάσεις», cards rail like Settings / Fleet ops.
 */
export default function RentDeskHub({
  activeTab: controlledTab,
  onTabChange,
  onOpenLiveMap,
  onOpenCustomer,
  initialTab,
}) {
  const [tab, setTab] = useState(() =>
    sanitizeRentDeskTab(controlledTab || initialTab || DEFAULT_RENT_DESK_TAB),
  );

  useEffect(() => {
    if (controlledTab != null) setTab(sanitizeRentDeskTab(controlledTab));
  }, [controlledTab]);

  const active = RENT_DESK_TABS.find((t) => t.id === tab) || RENT_DESK_TABS[0];

  const grouped = useMemo(
    () =>
      RENT_DESK_GROUPS.map((g) => ({
        ...g,
        items: RENT_DESK_TABS.filter((t) => t.group === g.id),
      })).filter((g) => g.items.length > 0),
    [],
  );

  const selectTab = (id) => {
    const next = sanitizeRentDeskTab(id);
    setTab(next);
    onTabChange?.(next);
  };

  return (
    <div className="rent-desk-hub w-full">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-start justify-start">
        <aside className="w-full lg:w-[15.5rem] xl:w-64 shrink-0 lg:sticky lg:top-3 self-start">
          <div className="rounded-[24px] border border-black/[0.06] bg-white/90 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.05)] p-2.5 sm:p-3 space-y-3">
            <div className="px-1.5 pt-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700/80">
                Ενοικιάσεις
              </p>
              <p className="text-sm font-bold text-on-surface mt-0.5">Rent desk</p>
            </div>

            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              {RENT_DESK_TABS.map((t) => {
                const isActive = t.id === tab;
                const accent = t.accent || 'teal';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTab(t.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold border transition ${
                      isActive
                        ? CHIP_ACTIVE[accent] || CHIP_ACTIVE.teal
                        : 'bg-white text-on-surface-variant border-black/[0.08]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                    {t.label.replace(' /rent', '')}
                  </button>
                );
              })}
            </div>

            <div className="hidden lg:block space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto pr-0.5">
              {grouped.map((section) => (
                <div key={section.id} className="space-y-1">
                  <p className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700/70">
                    {section.label}
                  </p>
                  <ul className="space-y-1">
                    {section.items.map((t) => {
                      const isActive = t.id === tab;
                      const accent = t.accent || 'teal';
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => selectTab(t.id)}
                            className={`w-full text-left flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 transition ${
                              isActive
                                ? RAIL_ACTIVE[accent] || RAIL_ACTIVE.teal
                                : 'border-transparent bg-black/[0.02] hover:bg-black/[0.04] hover:border-black/[0.06]'
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                isActive
                                  ? RAIL_ICON_ACTIVE[accent] || RAIL_ICON_ACTIVE.teal
                                  : RAIL_ICON_IDLE[accent] || RAIL_ICON_IDLE.teal
                              }`}
                            >
                              <span
                                className="material-symbols-outlined text-[18px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                {t.icon}
                              </span>
                            </span>
                            <span className="min-w-0">
                              <span
                                className={`block text-[13px] font-bold truncate leading-tight ${
                                  isActive ? 'text-slate-950' : 'text-on-surface'
                                }`}
                              >
                                {t.label}
                              </span>
                              <span className="block text-[10px] text-on-surface-variant truncate mt-0.5 leading-snug">
                                {t.description}
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

        <AdminMenuFade panelKey={tab || DEFAULT_RENT_DESK_TAB} className="min-w-0 flex-1 space-y-4 w-full">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-headline-md font-bold text-on-surface tracking-tight">
                {active.label}
              </h2>
              <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
                {active.description}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl border bg-teal-500/[0.08] border-teal-500/15">
              <span className="material-symbols-outlined text-[20px] text-teal-700">
                {active.icon}
              </span>
              <span className="text-sm font-bold text-teal-800">{active.label}</span>
            </div>
          </div>

          <FleetRentalPanel
            hideSideNav
            activeTab={tab || DEFAULT_RENT_DESK_TAB}
            onTabChange={selectTab}
            initialTab={tab || DEFAULT_RENT_DESK_TAB}
            onOpenLiveMap={onOpenLiveMap}
            onOpenCustomer={onOpenCustomer}
          />
        </AdminMenuFade>
      </div>
    </div>
  );
}
