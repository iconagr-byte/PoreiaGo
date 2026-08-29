import { useEffect, useState } from 'react';
import {
  DEFAULT_FLEET_OPS_TAB,
  FLEET_OPS_HUB_TABS,
  sanitizeFleetOpsSubTab,
} from '../../../lib/admin/fleetOpsHub.js';
import FleetKpisDashboard from '../FleetKpisDashboard.jsx';
import DriverChatInbox from '../DriverChatInbox.jsx';
import FleetRouteHistory from '../FleetRouteHistory.jsx';
import FleetCalendarPanel from './FleetCalendarPanel.jsx';
import FleetAvailabilityPanel from './FleetAvailabilityPanel.jsx';
import FleetDocumentsPanel from './FleetDocumentsPanel.jsx';
import FleetExpensesPanel from './FleetExpensesPanel.jsx';
import FleetDigestPanel from './FleetDigestPanel.jsx';
import AdminMenuFade from '../AdminMenuFade.jsx';

const RAIL_ACTIVE = {
  violet: 'border-violet-300 bg-violet-50 shadow-sm',
  sky: 'border-sky-300 bg-sky-50 shadow-sm',
  indigo: 'border-indigo-300 bg-indigo-50 shadow-sm',
  emerald: 'border-emerald-300 bg-emerald-50 shadow-sm',
  amber: 'border-amber-300 bg-amber-50 shadow-sm',
  rose: 'border-rose-300 bg-rose-50 shadow-sm',
};

const RAIL_ICON_ACTIVE = {
  violet: 'bg-violet-700 text-white',
  sky: 'bg-sky-600 text-white',
  indigo: 'bg-indigo-600 text-white',
  emerald: 'bg-emerald-600 text-white',
  amber: 'bg-amber-600 text-white',
  rose: 'bg-rose-600 text-white',
};

const RAIL_ICON_IDLE = {
  violet: 'bg-violet-100 text-violet-700',
  sky: 'bg-sky-100 text-sky-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
};

const CHIP_ACTIVE = {
  violet: 'bg-violet-700 text-white border-violet-700',
  sky: 'bg-sky-600 text-white border-sky-600',
  indigo: 'bg-indigo-600 text-white border-indigo-600',
  emerald: 'bg-emerald-600 text-white border-emerald-600',
  amber: 'bg-amber-600 text-white border-amber-600',
  rose: 'bg-rose-600 text-white border-rose-600',
};

/**
 * Fleet ops hub — one sidebar entry «Λειτουργίες Στόλου», cards rail like Settings.
 */
export default function FleetOpsHub({
  initialTab,
  onSubTabChange,
  chatFocusDriverId = null,
  onOpenLiveMap,
  onOpenFleet,
  onOpenPayments,
  /** When true, hide the left rail (parent BusesHub already shows the menu). */
  embedded = false,
}) {
  const [tab, setTab] = useState(() => sanitizeFleetOpsSubTab(initialTab));

  useEffect(() => {
    if (initialTab) setTab(sanitizeFleetOpsSubTab(initialTab));
  }, [initialTab]);

  const active = FLEET_OPS_HUB_TABS.find((t) => t.id === tab) || FLEET_OPS_HUB_TABS[0];

  const selectTab = (id) => {
    const next = sanitizeFleetOpsSubTab(id);
    setTab(next);
    onSubTabChange?.(next);
  };

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="font-headline-md font-bold text-on-surface tracking-tight">
          {active.label}
        </h2>
        <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">{active.description}</p>
      </div>
      <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl border bg-sky-500/[0.08] border-sky-500/15">
        <span className="material-symbols-outlined text-[20px] text-sky-700">{active.icon}</span>
        <span className="text-sm font-bold text-sky-800">{active.label}</span>
      </div>
    </div>
  );

  const subtabChips = (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
      {FLEET_OPS_HUB_TABS.map((t) => {
        const isActive = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold border transition ${
              isActive
                ? CHIP_ACTIVE[t.accent] || CHIP_ACTIVE.sky
                : 'bg-white text-on-surface-variant border-black/[0.08]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const body = (
    <FleetOpsHubPanel
      tab={tab || DEFAULT_FLEET_OPS_TAB}
      chatFocusDriverId={chatFocusDriverId}
      onOpenLiveMap={onOpenLiveMap}
      onOpenFleet={onOpenFleet}
      onOpenPayments={onOpenPayments}
      onOpenCalendar={() => selectTab('fleet_calendar')}
      onOpenDocuments={() => selectTab('fleet_documents')}
    />
  );

  if (embedded) {
    return (
      <div className="fleet-ops-hub fleet-ops-hub--embedded w-full space-y-5">
        {header}
        {subtabChips}
        <AdminMenuFade panelKey={tab || DEFAULT_FLEET_OPS_TAB}>{body}</AdminMenuFade>
      </div>
    );
  }

  return (
    <div className="fleet-ops-hub w-full">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-start justify-start">
        <aside className="w-full lg:w-[15.5rem] xl:w-64 shrink-0 lg:sticky lg:top-3 self-start">
          <div className="rounded-[24px] border border-black/[0.06] bg-white/90 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.05)] p-2.5 sm:p-3 space-y-3">
            <div className="px-1.5 pt-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700/80">
                Λειτουργίες Στόλου
              </p>
              <p className="text-sm font-bold text-on-surface mt-0.5">Λεωφορεία & οδηγοί</p>
            </div>

            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              {FLEET_OPS_HUB_TABS.map((t) => {
                const isActive = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTab(t.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold border transition ${
                      isActive
                        ? CHIP_ACTIVE[t.accent] || CHIP_ACTIVE.sky
                        : 'bg-white text-on-surface-variant border-black/[0.08]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>

            <ul className="hidden lg:block space-y-1">
              {FLEET_OPS_HUB_TABS.map((t) => {
                const isActive = t.id === tab;
                const accent = t.accent || 'sky';
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectTab(t.id)}
                      className={`w-full text-left flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${
                        isActive
                          ? RAIL_ACTIVE[accent] || RAIL_ACTIVE.sky
                          : 'border-transparent bg-black/[0.02] hover:bg-black/[0.04] hover:border-black/[0.06]'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isActive
                            ? RAIL_ICON_ACTIVE[accent] || RAIL_ICON_ACTIVE.sky
                            : RAIL_ICON_IDLE[accent] || RAIL_ICON_IDLE.sky
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[20px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {t.icon}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-sm font-bold truncate ${
                            isActive ? 'text-slate-950' : 'text-on-surface'
                          }`}
                        >
                          {t.label}
                        </span>
                        <span className="block text-[11px] text-on-surface-variant truncate mt-0.5 leading-snug">
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

        <AdminMenuFade panelKey={tab || DEFAULT_FLEET_OPS_TAB} className="min-w-0 flex-1 space-y-5 w-full">
          {header}
          {body}
        </AdminMenuFade>
      </div>
    </div>
  );
}

function FleetOpsHubPanel({
  tab,
  chatFocusDriverId,
  onOpenLiveMap,
  onOpenFleet,
  onOpenPayments,
  onOpenCalendar,
  onOpenDocuments,
}) {
  switch (tab) {
    case 'fleet_kpis':
      return <FleetKpisDashboard />;
    case 'driver_chat':
      return (
        <DriverChatInbox initialDriverId={chatFocusDriverId} onOpenLiveMap={onOpenLiveMap} />
      );
    case 'fleet_route_playback':
      return <FleetRouteHistory />;
    case 'fleet_calendar':
      return (
        <FleetCalendarPanel onOpenDocuments={onOpenDocuments} onOpenFleet={onOpenFleet} />
      );
    case 'fleet_availability':
      return <FleetAvailabilityPanel />;
    case 'fleet_documents':
      return <FleetDocumentsPanel />;
    case 'fleet_expenses':
      return <FleetExpensesPanel />;
    case 'fleet_digest':
      return (
        <FleetDigestPanel onOpenPayments={onOpenPayments} onOpenCalendar={onOpenCalendar} />
      );
    default:
      return <FleetKpisDashboard />;
  }
}
