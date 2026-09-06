import { FLEET_OPS_ITEMS, FLEET_OPS_OVERVIEW_TAB, fleetOpsAccent, fleetOpsBadge } from '../../../lib/admin/fleetOpsHub.js';
import { useFleetOpsStats } from '../../../hooks/useFleetOpsStats.js';

/**
 * Fleet ops hub — calendar, availability, documents, expenses, notifications.
 */
export default function FleetOpsHubNav({
  activeTab = FLEET_OPS_OVERVIEW_TAB,
  onNavigate,
  stats: statsProp,
  loading: loadingProp,
  onRefresh,
  compact = false,
  showOverviewLink = false,
}) {
  const hook = useFleetOpsStats({ enabled: !statsProp });
  const stats = statsProp ?? hook.stats;
  const loading = loadingProp ?? hook.loading;
  const refresh = onRefresh ?? hook.refresh;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {(showOverviewLink || activeTab !== FLEET_OPS_OVERVIEW_TAB) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate?.(FLEET_OPS_OVERVIEW_TAB)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Πίσω στον στόλο
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-black/[0.08] bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            Ανανέωση
          </button>
        </div>
      )}

      <div
        className={`grid gap-3 ${
          compact ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
        }`}
      >
        {FLEET_OPS_ITEMS.map((item) => {
          const accent = fleetOpsAccent(item.accent);
          const active = activeTab === item.id;
          const badge = fleetOpsBadge(item.id, stats);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`group relative text-left rounded-2xl border bg-gradient-to-br p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                accent.card
              } ${active ? accent.active : 'shadow-sm'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${accent.icon}`}
                >
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                </span>
                {badge ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      badge.warn ? accent.badgeWarn : accent.badge
                    }`}
                  >
                    {badge.text}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 min-w-0">
                <div className="font-bold text-slate-900 text-sm tracking-tight">{item.label}</div>
                {!compact ? (
                  <p className="mt-1 text-xs text-slate-500 leading-snug line-clamp-2">{item.description}</p>
                ) : null}
              </div>
              <span
                className={`absolute bottom-3 right-3 material-symbols-outlined text-[18px] text-slate-300 transition group-hover:text-slate-500 ${
                  active ? 'text-primary opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                chevron_right
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
