/**
 * Driver PWA — chat with office (iMessage-style receipts).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChatReceiptStatus,
  formatChatTime,
  resolveChatReceipt,
} from '../chat/ChatReceiptStatus.jsx';
import {
  fetchDriverChatMessages,
  markDriverChatRead,
  sendDriverChatMessage,
} from '../../services/driverPortalApi.js';

const POLL_MS = 4000;

export default function DriverOfficeChat() {
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

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await fetchDriverChatMessages();
      const rows = Array.isArray(data.messages) ? data.messages : [];
      setMessages(rows);
      setUnread(Number(data.unread || 0));
      if (!silent) setLoading(false);
      for (const m of rows) {
        if (m.sender === 'office' && m.id && !seenIdsRef.current.has(m.id)) {
          if (seenIdsRef.current.size > 0) {
            toast('Νέο μήνυμα από το γραφείο', { icon: '💬', id: `chat-${m.id}` });
          }
          seenIdsRef.current.add(m.id);
        } else if (m.id) {
          seenIdsRef.current.add(m.id);
        }
      }
      scrollBottom();
      if (Number(data.unread || 0) > 0) {
        markDriverChatRead().catch(() => {});
      }
    } catch (err) {
      if (!silent) {
        setLoading(false);
        toast.error(err.message || 'Αποτυχία chat');
      }
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => load({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await sendDriverChatMessage(body);
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

  const lastMineId = [...messages].reverse().find((m) => m.sender === 'driver')?.id;

  return (
    <div className="driver-stack">
      <div className="driver-card !p-0 overflow-hidden flex flex-col min-h-[60vh]">
        <div className="px-4 py-3 border-b border-[var(--driver-border)] flex items-center justify-between gap-2 bg-[#f2f2f7]">
          <div>
            <h2 className="font-extrabold text-lg flex items-center gap-2 text-slate-900">
              <span className="material-symbols-outlined text-[#007aff]">chat</span>
              Γραφείο
            </h2>
            <p className="text-xs text-slate-500">Παράδοση &amp; ανάγνωση όπως στο iMessage</p>
          </div>
          {unread > 0 ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
              {unread} νέα
            </span>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 bg-[#e5e5ea] min-h-[40vh] max-h-[55vh]">
          {loading ? (
            <p className="text-center text-sm text-slate-500 py-8">Φόρτωση…</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">
              Δεν υπάρχουν μηνύματα ακόμα. Γράψτε στο γραφείο παρακάτω.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender === 'driver';
              const receipt = resolveChatReceipt(m, 'driver');
              const showReceipt = mine && m.id === lastMineId;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                      mine
                        ? 'bg-[#007aff] text-white rounded-[18px] rounded-br-[6px]'
                        : 'bg-white text-slate-900 rounded-[18px] rounded-bl-[6px]'
                    }`}
                  >
                    {!mine ? (
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        {m.sender_name || 'Γραφείο'}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div
                      className={`mt-1 flex items-center justify-end gap-1.5 ${
                        mine ? 'text-white/80' : 'text-slate-400'
                      }`}
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
            className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#007aff]/30"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="w-11 h-11 rounded-full bg-[#007aff] text-white font-bold disabled:opacity-40 inline-flex items-center justify-center shrink-0"
            aria-label="Αποστολή"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_upward</span>
          </button>
        </form>
      </div>
    </div>
  );
}
