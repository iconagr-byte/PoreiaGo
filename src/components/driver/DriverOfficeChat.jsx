/**
 * Driver PWA — chat with office (poll every 4s).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchDriverChatMessages,
  markDriverChatRead,
  sendDriverChatMessage,
} from '../../services/driverPortalApi.js';

const POLL_MS = 4000;

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

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
      // Toast for newly arrived office messages
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

  return (
    <div className="driver-stack">
      <div className="driver-card !p-0 overflow-hidden flex flex-col min-h-[60vh]">
        <div className="px-4 py-3 border-b border-[var(--driver-border)] flex items-center justify-between gap-2">
          <div>
            <h2 className="font-extrabold text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--driver-accent)]">chat</span>
              Chat γραφείου
            </h2>
            <p className="text-xs text-[var(--driver-muted)]">Άμεση επικοινωνία με το κεντρικό</p>
          </div>
          {unread > 0 ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
              {unread} νέα
            </span>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-[var(--driver-surface)] min-h-[40vh] max-h-[55vh]">
          {loading ? (
            <p className="text-center text-sm text-[var(--driver-muted)] py-8">Φόρτωση…</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-[var(--driver-muted)] py-8">
              Δεν υπάρχουν μηνύματα ακόμα. Γράψτε στο γραφείο παρακάτω.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender === 'driver';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      mine
                        ? 'bg-[var(--driver-accent)] text-white rounded-br-md'
                        : 'bg-white border border-[var(--driver-border)] text-[var(--driver-text)] rounded-bl-md'
                    }`}
                  >
                    {!mine ? (
                      <div className="text-[10px] font-bold uppercase opacity-70 mb-0.5">
                        {m.sender_name || 'Γραφείο'}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-[var(--driver-muted)]'}`}>
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="p-3 border-t border-[var(--driver-border)] flex gap-2 bg-white">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Μήνυμα προς γραφείο…"
            maxLength={2000}
            className="flex-1 rounded-xl border border-[var(--driver-border)] px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--driver-accent)]/30"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="driver-touch driver-btn-primary px-4 rounded-xl font-bold disabled:opacity-50"
            aria-label="Αποστολή"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
