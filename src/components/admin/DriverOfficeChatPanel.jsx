/**
 * Office chat panel — iMessage-style receipts for selected driver.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChatReceiptStatus,
  formatChatTime,
  resolveChatReceipt,
} from '../chat/ChatReceiptStatus.jsx';
import {
  fetchAdminDriverChatMessages,
  markAdminDriverChatRead,
  sendAdminDriverChatMessage,
} from '../../services/platformApi.js';

const POLL_MS = 4000;

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

  const lastMineId = [...messages].reverse().find((m) => m.sender === 'office')?.id;

  return (
    <div
      className={`rounded-[24px] border border-black/[0.06] bg-white shadow-sm overflow-hidden flex flex-col ${
        compact ? 'min-h-[300px]' : 'min-h-[380px]'
      }`}
    >
      <div className="px-4 py-3 border-b border-black/[0.05] flex items-center justify-between gap-2 bg-[#f2f2f7]">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 truncate">
            <span className="material-symbols-outlined text-[#007aff] text-[18px]">chat</span>
            {driverName || 'Οδηγός'}
          </h3>
          <p className="text-[11px] text-slate-400 truncate">
            {tripId != null ? `Δρομολόγιο #${tripId} · ` : ''}
            Παραδόθηκε / Διαβάστηκε
          </p>
        </div>
        {unread > 0 ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
            {unread}
          </span>
        ) : null}
      </div>

      <div
        className={`flex-1 overflow-y-auto px-3 py-3 space-y-1.5 bg-[#e5e5ea] ${
          compact ? 'max-h-[240px]' : 'max-h-[300px]'
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
            const receipt = resolveChatReceipt(m, 'office');
            const showReceipt = mine && m.id === lastMineId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[90%] px-3 py-2 text-sm leading-snug shadow-sm ${
                    mine
                      ? 'bg-[#007aff] text-white rounded-[18px] rounded-br-[6px]'
                      : 'bg-white text-slate-900 rounded-[18px] rounded-bl-[6px]'
                  }`}
                >
                  {!mine ? (
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                      {m.sender_name || 'Οδηγός'}
                    </div>
                  ) : null}
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div
                    className={`mt-1 flex justify-end ${mine ? 'text-white/80' : 'text-slate-400'}`}
                  >
                    <span className="text-[10px] tabular-nums">{formatChatTime(m.created_at)}</span>
                  </div>
                </div>
                {showReceipt ? (
                  <div className="mt-0.5 px-1">
                    <ChatReceiptStatus status={receipt} tone="light" />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="p-3 border-t border-black/5 flex gap-2 bg-[#f2f2f7]">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="iMessage"
          maxLength={2000}
          className="flex-1 rounded-full border border-black/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007aff]/20"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="w-9 h-9 rounded-full bg-[#007aff] text-white disabled:opacity-40 inline-flex items-center justify-center shrink-0"
          aria-label="Αποστολή"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
        </button>
      </form>
    </div>
  );
}
