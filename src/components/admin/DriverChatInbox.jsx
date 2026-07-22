/**
 * Office chat inbox — threads list + conversation (dashboard / nav tab).
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchDriverChatThreads, fetchFleetDrivers } from '../../services/platformApi.js';
import DriverOfficeChatPanel from './DriverOfficeChatPanel.jsx';

const POLL_MS = 5000;

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

export default function DriverChatInbox({ initialDriverId = null, onOpenLiveMap } = {}) {
  const [threads, setThreads] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedId, setSelectedId] = useState(initialDriverId);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const [tRes, dList] = await Promise.all([
        fetchDriverChatThreads().catch(() => ({ threads: [] })),
        fetchFleetDrivers().catch(() => []),
      ]);
      setThreads(Array.isArray(tRes.threads) ? tRes.threads : []);
      setDrivers(Array.isArray(dList) ? dList : []);
      if (!silent) setLoading(false);
    } catch (err) {
      if (!silent) {
        setLoading(false);
        toast.error(err.message || 'Αποτυχία inbox');
      }
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => load({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (initialDriverId) setSelectedId(initialDriverId);
  }, [initialDriverId]);

  const selected =
    threads.find((t) => t.driver_id === selectedId) ||
    drivers.find((d) => d.id === selectedId) ||
    null;

  const selectedName =
    selected?.driver_name || selected?.name || drivers.find((d) => d.id === selectedId)?.name;

  const totalUnread = threads.reduce((s, t) => s + Number(t.unread_office || 0), 0);

  // Drivers without a thread yet — still chatable
  const idleDrivers = drivers.filter(
    (d) => d.status === 'active' && !threads.some((t) => t.driver_id === d.id),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">forum</span>
            Chat οδηγών
          </h2>
          <p className="text-sm text-on-surface-variant">
            Συνομιλία γραφείου με οδηγούς εφαρμογής
            {totalUnread > 0 ? ` · ${totalUnread} μη αναγνωσμένα` : ''}
          </p>
        </div>
        {typeof onOpenLiveMap === 'function' ? (
          <button
            type="button"
            onClick={onOpenLiveMap}
            className="px-4 py-2 rounded-full border border-black/[0.08] text-sm font-bold hover:bg-surface-container-low inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            Ζωντανός χάρτης
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <div className="rounded-[24px] border border-black/[0.06] bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.05] text-xs font-bold uppercase text-on-surface-variant">
            Συνομιλίες
          </div>
          {loading ? (
            <p className="text-sm text-on-surface-variant text-center py-10">Φόρτωση…</p>
          ) : (
            <ul className="max-h-[480px] overflow-y-auto divide-y divide-black/[0.04]">
              {threads.map((t) => (
                <li key={t.driver_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.driver_id)}
                    className={`w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors ${
                      selectedId === t.driver_id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-on-surface truncate">
                          {t.driver_name || 'Οδηγός'}
                        </div>
                        <div className="text-xs text-on-surface-variant truncate mt-0.5">
                          {t.last_message}
                        </div>
                        <div className="text-[10px] text-on-surface-variant/70 mt-1">
                          {formatWhen(t.last_at)}
                          {t.vehicle_plate ? ` · ${t.vehicle_plate}` : ''}
                        </div>
                      </div>
                      {t.unread_office > 0 ? (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                          {t.unread_office}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
              {idleDrivers.slice(0, 12).map((d) => (
                <li key={`idle-${d.id}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors ${
                      selectedId === d.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="font-bold text-sm text-on-surface truncate">{d.name}</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">Νέα συνομιλία</div>
                  </button>
                </li>
              ))}
              {!threads.length && !idleDrivers.length ? (
                <li className="text-sm text-on-surface-variant text-center py-10 px-4">
                  Δεν υπάρχουν οδηγοί / μηνύματα ακόμα.
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <DriverOfficeChatPanel
          driverId={selectedId}
          driverName={selectedName}
          tripId={selected?.trip_id}
        />
      </div>
    </div>
  );
}
