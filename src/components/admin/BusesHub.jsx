import { useCallback, useMemo, useState } from 'react';
import {
  BUSES_HUB_TABS,
  DEFAULT_BUSES_HUB_TAB,
  busesHubTabsInOrder,
  loadBusesHubOrder,
  moveBusesHubTab,
  sanitizeBusesHubTab,
  saveBusesHubOrder,
} from '../../lib/admin/busesHub.js';
import { isFleetOpsSubTab } from '../../lib/admin/fleetOpsHub.js';
import AdminMenuFade from './AdminMenuFade.jsx';
import AdminResizableRail from './AdminResizableRail.jsx';

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
 * (same pattern as SettingsHub / RentDeskHub). Rail order is drag-and-drop.
 */
export default function BusesHub({ activeTab, onNavigate, children }) {
  const railTab = sanitizeBusesHubTab(activeTab);
  const [order, setOrder] = useState(() => loadBusesHubOrder());
  const [draggingId, setDraggingId] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const tabs = useMemo(() => busesHubTabsInOrder(order), [order]);
  const active = tabs.find((t) => t.id === railTab) || BUSES_HUB_TABS[0];
  const inFleetOps = activeTab === 'fleet_ops' || isFleetOpsSubTab(activeTab);

  const selectTab = (id) => {
    onNavigate?.(id || DEFAULT_BUSES_HUB_TAB);
  };

  const persistOrder = useCallback((next) => {
    const saved = saveBusesHubOrder(next);
    setOrder(saved);
  }, []);

  const onDragStart = (id, event) => {
    event.dataTransfer.effectAllowed = 'move';
    try {
      event.dataTransfer.setData('text/plain', id);
    } catch {
      /* ignore */
    }
    setDraggingId(id);
    setOverIndex(order.indexOf(id));
  };

  const clearDrag = () => {
    setDraggingId(null);
    setOverIndex(null);
  };

  const onDropAt = (index, event) => {
    event.preventDefault();
    const fromId =
      draggingId ||
      (() => {
        try {
          return event.dataTransfer.getData('text/plain');
        } catch {
          return '';
        }
      })();
    if (!fromId) {
      clearDrag();
      return;
    }
    persistOrder(moveBusesHubTab(order, fromId, index));
    clearDrag();
  };

  return (
    <div className="buses-hub w-full">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-start justify-start">
        <AdminResizableRail storageKey="poreiago_buses_hub_rail_w" defaultWidth={336}>
          <div className="rounded-[24px] lg:rounded-l-none border border-black/[0.06] lg:border-l-0 bg-white/95 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.05)] p-3.5 sm:p-4 space-y-4">
            <div className="px-1.5 pt-0.5">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-700/80">Εκδρομές</p>
              <p className="text-base font-bold text-on-surface mt-0.5">Στόλος & κρατήσεις</p>
              <p className="text-[11px] text-on-surface-variant mt-1 hidden lg:block">
                Σύρετε ⋮⋮ για σειρά · άκρη δεξιά για πλάτος
              </p>
            </div>

            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              {tabs.map((t) => {
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
              {tabs.map((t, index) => {
                const isActive = t.id === railTab;
                const accent = t.accent || 'sky';
                const dragging = draggingId === t.id;
                const showDropBefore = draggingId && overIndex === index && draggingId !== t.id;
                return (
                  <li key={t.id}>
                    {showDropBefore ? (
                      <div
                        className="h-1.5 mb-1 rounded-full bg-sky-400/80"
                        aria-hidden
                      />
                    ) : null}
                    <div
                      className={`flex items-stretch gap-1 rounded-2xl transition ${
                        dragging ? 'opacity-50' : ''
                      }`}
                      onDragOver={(e) => {
                        if (!draggingId) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mid = rect.top + rect.height / 2;
                        setOverIndex(e.clientY < mid ? index : index + 1);
                      }}
                      onDrop={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mid = rect.top + rect.height / 2;
                        onDropAt(e.clientY < mid ? index : index + 1, e);
                      }}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => onDragStart(t.id, e)}
                        onDragEnd={clearDrag}
                        className="shrink-0 w-8 self-stretch rounded-xl text-slate-400 hover:text-slate-700 hover:bg-black/[0.04] flex items-center justify-center cursor-grab active:cursor-grabbing"
                        title="Σύρετε για αλλαγή σειράς"
                        aria-label={`Μετακίνηση ${t.label}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => selectTab(t.id)}
                        className={`min-w-0 flex-1 text-left flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
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
                    </div>
                  </li>
                );
              })}
              {draggingId && overIndex === tabs.length ? (
                <li>
                  <div
                    className="h-1.5 mt-1 rounded-full bg-sky-400/80"
                    aria-hidden
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverIndex(tabs.length);
                    }}
                    onDrop={(e) => onDropAt(tabs.length, e)}
                  />
                </li>
              ) : null}
            </ul>
          </div>
        </AdminResizableRail>

        <AdminMenuFade panelKey={railTab} className="min-w-0 flex-1 space-y-5 w-full">
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
        </AdminMenuFade>
      </div>
    </div>
  );
}
