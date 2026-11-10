/**
 * Compact chat preview for admin dashboard — Apple-minimal panel.
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
    <section className="dash-apple-panel h-full">
      <div className="dash-apple-panel__head">
        <div>
          <h3 className="dash-apple-panel__title">
            Chat οδηγών
            {unread > 0 ? (
              <span className="ml-2 align-middle text-[11px] font-semibold text-[#c93400]">
                {unread} νέα
              </span>
            ) : null}
          </h3>
          <p className="dash-apple-panel__meta">Συνομιλία με την εφαρμογή κινητού</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {typeof onOpenLiveMap === 'function' ? (
            <button type="button" onClick={onOpenLiveMap} className="dash-apple-link">
              <span className="material-symbols-outlined">map</span>
              Χάρτης
            </button>
          ) : null}
          <button type="button" onClick={onOpenInbox} className="dash-apple-link">
            Άνοιγμα
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
      <ul className="divide-y divide-black/[0.04]">
        {threads.length === 0 ? (
          <li className="dash-apple-empty">
            <span className="material-symbols-outlined">chat_bubble</span>
            <p className="dash-apple-empty__title">Χωρίς μηνύματα ακόμα</p>
            <p className="dash-apple-empty__meta">Άνοιξε το chat για να γράψεις σε οδηγό.</p>
          </li>
        ) : (
          threads.map((t) => (
            <li key={t.driver_id}>
              <button
                type="button"
                onClick={onOpenInbox}
                className="w-full text-left px-5 py-3.5 hover:bg-[rgba(0,113,227,0.035)] transition-colors flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[0.92rem] tracking-tight text-[#1d1d1f] truncate">
                    {t.driver_name || 'Οδηγός'}
                    {t.vehicle_plate ? (
                      <span className="text-[#6e6e73] font-mono text-[11px] ml-2 font-medium">
                        {t.vehicle_plate}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[0.84rem] text-[#6e6e73] truncate mt-0.5 tracking-tight">
                    {t.last_message}
                  </div>
                  <div className="text-[11px] text-[#86868b] mt-1 tracking-tight">
                    {formatWhen(t.last_at)}
                  </div>
                </div>
                {t.unread_office > 0 ? (
                  <span className="shrink-0 text-[11px] font-semibold text-[#c93400] tabular-nums">
                    {t.unread_office}
                  </span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
