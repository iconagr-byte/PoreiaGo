/**
 * Driver PWA — chat with office.
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
import '../../styles/office-chat.css';

const POLL_MS = 4000;

function initials(name) {
  return (name || 'Γ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
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
    <div className="driver-stack office-chat">
      <div className="office-chat-shell rounded-[1.35rem] min-h-[60vh]">
        <div className="office-chat-header">
          <div className="office-chat-header-main">
            <span className="office-chat-avatar" aria-hidden>
              {initials('Γραφείο')}
            </span>
            <div className="min-w-0">
              <h2 className="office-chat-title">Γραφείο</h2>
              <p className="office-chat-subtitle">Παραδόθηκε · Διαβάστηκε</p>
            </div>
          </div>
          {unread > 0 ? <span className="office-chat-unread">{unread}</span> : null}
        </div>

        <div className="office-chat-thread min-h-[40vh] max-h-[55vh]">
          {loading ? (
            <p className="office-chat-loading">Φόρτωση…</p>
          ) : messages.length === 0 ? (
            <div className="office-chat-empty">
              <div className="office-chat-empty-icon">
                <span className="material-symbols-outlined">forum</span>
              </div>
              Δεν υπάρχουν μηνύματα ακόμα. Γράψτε στο γραφείο παρακάτω.
            </div>
          ) : (
            messages.map((m, idx) => {
              const mine = m.sender === 'driver';
              const receipt = resolveChatReceipt(m, 'driver');
              const showReceipt = mine && m.id === lastMineId;
              return (
                <div
                  key={m.id}
                  className={`office-chat-row ${mine ? 'is-mine' : 'is-theirs'}`}
                  style={{ animationDelay: `${Math.min(idx, 8) * 28}ms` }}
                >
                  <div className="office-chat-bubble">
                    {!mine ? (
                      <div className="office-chat-sender">{m.sender_name || 'Γραφείο'}</div>
                    ) : null}
                    <div className="office-chat-body">{m.body}</div>
                    <div className="office-chat-meta">{formatChatTime(m.created_at)}</div>
                  </div>
                  {showReceipt ? (
                    <div className="office-chat-receipt">
                      <ChatReceiptStatus status={receipt} tone="light" />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="office-chat-composer">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Γράψτε μήνυμα…"
            aria-label="Μήνυμα προς το γραφείο"
            maxLength={2000}
            className="office-chat-input"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="office-chat-send"
            aria-label="Αποστολή"
          >
            <span className="material-symbols-outlined">arrow_upward</span>
          </button>
        </form>
      </div>
    </div>
  );
}
