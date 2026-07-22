/**
 * Office chat panel for one driver — used on live map & inbox.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchAdminDriverChatMessages,
  markAdminDriverChatRead,
  sendAdminDriverChatMessage,
} from '../../services/platformApi.js';

const POLL_MS = 4000;

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function DriverOfficeChatPanel({
  driverId,
  driverName,
  tripId,
  compact = false,
}) {
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const seenIdsRef = useRef(new Set());

  const scrollBottom = () => {
    window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!driverId) {
        setMessages([]);
        setLoading(false);
        return;
      }
      try {
        const data = await fetchAdminDriverChatMessages(driverId);
        const rows = Array.isArray(data.messages) ? data.messages : [];
        setMessages(rows);
        setUnread(Number(data.unread || 0));
        if (!silent) setLoading(false);
        for (const m of rows) {
          if (m.sender === 'driver' && m.id && !seenIdsRef.current.has(m.id)) {
            if (seenIdsRef.current.size > 0) {
              toast(`Μήνυμα από ${driverName || 'οδηγό'}`, {
                icon: '💬',
                id: `office-chat-${m.id}`,
              });
            }
            seenIdsRef.current.add(m.id);
          } else if (m.id) {
            seenIdsRef.current.add(m.id);
          }
        }
        scrollBottom();
        if (Number(data.unread || 0) > 0) {
          markAdminDriverChatRead(driverId).catch(() => {});
        }
      } catch (err) {
        if (!silent) {
          setLoading(false);
          toast.error(err.message || 'Αποτυχία chat');
        }
      }
    },
    [driverId, driverName],
  );

  useEffect(() => {
    seenIdsRef.current = new Set();
    setLoading(true);
    load();
    const id = window.setInterval(() => load({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !driverId || sending) return;
    setSending(true);
    try {
      const res = await sendAdminDriverChatMessage(driverId, body, {
        tripId,
        senderName: 'Γραφείο',
      });
      setText('');
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
        seenIdsRef.current.add(res.message.id);
        scrollBottom();
      } else {
        await load({ silent: true });
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποστολής');
    } finally {
      setSending(false);
    }
  };

  if (!driverId) {
    return (
      <div className="rounded-[24px] border border-black/[0.06] bg-white p-4 shadow-sm text-sm text-slate-500">
        Επιλέξτε όχημα / οδηγό για chat.
      </div>
    );
  }

  return (
    <div
      className={`rounded-[24px] border border-black/[0.06] bg-white shadow-sm overflow-hidden flex flex-col ${
        compact ? 'min-h-[280px]' : 'min-h-[360px]'
      }`}
    >
      <div className="px-4 py-3 border-b border-black/[0.05] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 truncate">
            <span className="material-symbols-outlined text-primary text-[18px]">chat</span>
            Chat · {driverName || 'Οδηγός'}
          </h3>
          {tripId != null ? (
            <p className="text-[11px] text-slate-400">Δρομολόγιο #{tripId}</p>
          ) : null}
        </div>
        {unread > 0 ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
            {unread}
          </span>
        ) : null}
      </div>

      <div
        className={`flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50/80 ${
          compact ? 'max-h-[220px]' : 'max-h-[280px]'
        }`}
      >
        {loading ? (
          <p className="text-center text-xs text-slate-400 py-6">Φόρτωση…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6">
            Ξεκινήστε τη συνομιλία με τον οδηγό.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === 'office';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-white border border-black/[0.06] text-slate-800 rounded-bl-md'
                  }`}
                >
                  {!mine ? (
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                      {m.sender_name || 'Οδηγός'}
                    </div>
                  ) : null}
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                    {formatTime(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="p-3 border-t border-black/[0.05] flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Μήνυμα προς οδηγό…"
          maxLength={2000}
          className="flex-1 rounded-xl border border-black/[0.08] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="px-3 py-2 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 inline-flex items-center"
          aria-label="Αποστολή"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
        </button>
      </form>
    </div>
  );
}
