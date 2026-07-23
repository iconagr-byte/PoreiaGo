/**
 * Compact chat preview for admin dashboard.
 */
import { useEffect, useState } from 'react';
import { fetchDriverChatThreads, fetchDriverChatUnread } from '../../services/platformApi.js';
import { LIVE_REFRESH_MS } from '../../lib/liveRefresh.js';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

export default function DriverChatDashboardWidget({ onOpenInbox, onOpenLiveMap }) {
  const [threads, setThreads] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [t, u] = await Promise.all([
          fetchDriverChatThreads().catch(() => ({ threads: [] })),
          fetchDriverChatUnread().catch(() => ({ unread: 0 })),
        ]);
        if (cancelled) return;
        setThreads((t.threads || []).slice(0, 5));
        setUnread(Number(u.unread || 0));
      } catch {
        /* ignore */
      }
    };
    load();
    const id = window.setInterval(load, LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="bg-white rounded-[24px] shadow-level-2 card-inner-border border border-sky-100/60 overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-black/[0.05] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-headline-md text-lg sm:text-xl text-on-surface font-bold tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">forum</span>
            Chat οδηγών
            {unread > 0 ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {unread} νέα
              </span>
            ) : null}
          </h3>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Συνομιλία με την εφαρμογή κινητού · εμφανίζεται και στον live χάρτη
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {typeof onOpenLiveMap === 'function' ? (
            <button
              type="button"
              onClick={onOpenLiveMap}
              className="text-sm font-bold px-3 py-1.5 rounded-full border border-black/[0.08] hover:bg-surface-container-low inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">map</span>
              Χάρτης
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenInbox}
            className="text-sm font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            Άνοιγμα
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
      <ul className="divide-y divide-black/[0.04]">
        {threads.length === 0 ? (
          <li className="px-5 py-8 text-sm text-on-surface-variant text-center">
            Δεν υπάρχουν μηνύματα ακόμα. Ανοίξτε το chat για να γράψετε σε οδηγό.
          </li>
        ) : (
          threads.map((t) => (
            <li key={t.driver_id}>
              <button
                type="button"
                onClick={onOpenInbox}
                className="w-full text-left px-5 py-3.5 hover:bg-primary/[0.03] transition-colors flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-on-surface truncate">
                    {t.driver_name || 'Οδηγός'}
                    {t.vehicle_plate ? (
                      <span className="text-on-surface-variant font-mono text-xs ml-2">
                        {t.vehicle_plate}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-on-surface-variant truncate mt-0.5">{t.last_message}</div>
                  <div className="text-[11px] text-on-surface-variant/70 mt-1">{formatWhen(t.last_at)}</div>
                </div>
                {t.unread_office > 0 ? (
                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    {t.unread_office}
                  </span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
