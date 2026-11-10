/**
 * Office chat inbox — Apple Messages-style threads + conversation.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchDriverChatThreads, fetchFleetDrivers } from '../../services/platformApi.js';
import DriverOfficeChatPanel from './DriverOfficeChatPanel.jsx';
import '../../styles/office-chat.css';

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

function initials(name) {
  return (name || 'Ο')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
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

  const idleDrivers = drivers.filter(
    (d) => d.status === 'active' && !threads.some((t) => t.driver_id === d.id),
  );

  return (
    <div className="messages-inbox">
      <div className="messages-inbox-top">
        <div>
          <p className="messages-inbox-kicker">Messages</p>
          <h2 className="messages-inbox-title">Chat οδηγών</h2>
          <p className="messages-inbox-subtitle">
            Συνομιλία γραφείου με οδηγούς εφαρμογής
            {totalUnread > 0 ? ` · ${totalUnread} μη αναγνωσμένα` : ''}
          </p>
        </div>
        {typeof onOpenLiveMap === 'function' ? (
          <button type="button" onClick={onOpenLiveMap} className="messages-inbox-map-btn">
            <span className="material-symbols-outlined text-[18px]">map</span>
            Ζωντανός χάρτης
          </button>
        ) : null}
      </div>

      <div className="messages-inbox-shell">
        <aside className="messages-inbox-list" aria-label="Λίστα συνομιλιών">
          <div className="messages-inbox-list-head">Συνομιλίες</div>
          {loading ? (
            <p className="messages-inbox-empty-hint">Φόρτωση…</p>
          ) : (
            <div className="messages-inbox-scroll">
              {threads.map((t) => {
                const name = t.driver_name || 'Οδηγός';
                const active = selectedId === t.driver_id;
                return (
                  <button
                    key={t.driver_id}
                    type="button"
                    onClick={() => setSelectedId(t.driver_id)}
                    className={`messages-inbox-item ${active ? 'is-active' : ''}`}
                  >
                    <span className="messages-inbox-item-avatar" aria-hidden>
                      {initials(name)}
                    </span>
                    <span className="messages-inbox-item-body">
                      <span className="messages-inbox-item-row">
                        <span className="messages-inbox-item-name">{name}</span>
                        <span className="messages-inbox-item-time">{formatWhen(t.last_at)}</span>
                      </span>
                      <span className="messages-inbox-item-preview">{t.last_message || '—'}</span>
                      {t.vehicle_plate ? (
                        <span className="messages-inbox-item-meta">{t.vehicle_plate}</span>
                      ) : null}
                      {t.unread_office > 0 ? (
                        <span className="messages-inbox-badge">{t.unread_office}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}

              {idleDrivers.slice(0, 12).map((d) => {
                const active = selectedId === d.id;
                return (
                  <button
                    key={`idle-${d.id}`}
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={`messages-inbox-item ${active ? 'is-active' : ''}`}
                  >
                    <span className="messages-inbox-item-avatar" aria-hidden>
                      {initials(d.name)}
                    </span>
                    <span className="messages-inbox-item-body">
                      <span className="messages-inbox-item-name">{d.name}</span>
                      <span className="messages-inbox-item-preview">Νέα συνομιλία</span>
                    </span>
                  </button>
                );
              })}

              {!threads.length && !idleDrivers.length ? (
                <p className="messages-inbox-empty-hint">
                  Δεν υπάρχουν οδηγοί / μηνύματα ακόμα.
                </p>
              ) : null}
            </div>
          )}
        </aside>

        <section className="messages-inbox-pane" aria-label="Συνομιλία">
          {selectedId ? (
            <DriverOfficeChatPanel
              driverId={selectedId}
              driverName={selectedName}
              tripId={selected?.trip_id}
            />
          ) : (
            <div className="messages-inbox-empty-hint">
              <span
                className="material-symbols-outlined text-[42px] text-[#007aff] mb-2 block"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                chat_bubble
              </span>
              Επιλέξτε συνομιλία
              <strong>Διαλέξτε οδηγό από τα αριστερά για να ξεκινήσετε.</strong>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
