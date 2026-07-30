/**
 * Office chat panel for a selected driver.
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
import '../../styles/office-chat.css';

const POLL_MS = 5000;

function initials(name) {
  return (name || 'Ο')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
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
  const [loadError, setLoadError] = useState('');
  const [resolvedName, setResolvedName] = useState(driverName || '');
  const bottomRef = useRef(null);
  const seenIdsRef = useRef(new Set());
  const toastedErrorRef = useRef('');

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
        setLoadError('');
        return;
      }
      try {
        const data = await fetchAdminDriverChatMessages(driverId);
        const rows = Array.isArray(data.messages) ? data.messages : [];
        setMessages(rows);
        setUnread(Number(data.unread || 0));
        setLoadError('');
        if (data.driver_name) setResolvedName(data.driver_name);
        if (!silent) setLoading(false);
        for (const m of rows) {
          if (m.sender === 'driver' && m.id && !seenIdsRef.current.has(m.id)) {
            if (seenIdsRef.current.size > 0) {
              toast(`Μήνυμα από ${driverName || data.driver_name || 'οδηγό'}`, {
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
        const msg = err.message || 'Αποτυχία chat';
        setLoadError(msg);
        if (!silent) {
          setLoading(false);
          // Toast once per driver — polling must not spam "Driver not found".
          if (toastedErrorRef.current !== `${driverId}:${msg}`) {
            toastedErrorRef.current = `${driverId}:${msg}`;
            toast.error(msg, { id: `office-chat-err-${driverId}` });
          }
        }
      }
    },
    [driverId, driverName],
  );

  useEffect(() => {
    seenIdsRef.current = new Set();
    toastedErrorRef.current = '';
    setResolvedName(driverName || '');
    setLoadError('');
    setLoading(true);
    load();
    const id = window.setInterval(() => load({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [load, driverName]);

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
      <div className="office-chat messages-inbox-empty-hint">
        <span
          className="material-symbols-outlined text-[42px] text-[#007aff] mb-2 block mx-auto"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          forum
        </span>
        Επιλέξτε συνομιλία
        <strong>Διαλέξτε όχημα / οδηγό για chat.</strong>
      </div>
    );
  }

  const lastMineId = [...messages].reverse().find((m) => m.sender === 'office')?.id;
  const title = resolvedName || driverName || 'Οδηγός';

  return (
    <div
      className={`office-chat office-chat-shell rounded-[1.35rem] ${
        compact ? 'min-h-[300px]' : 'min-h-[400px]'
      }`}
    >
      <div className="office-chat-header">
        <div className="office-chat-header-main">
          <span className="office-chat-avatar" aria-hidden>
            {initials(title)}
          </span>
          <div className="min-w-0">
            <h3 className="office-chat-title">{title}</h3>
            <p className="office-chat-subtitle">
              {tripId != null ? `Δρομολόγιο #${tripId} · ` : ''}
              Παραδόθηκε · Διαβάστηκε
            </p>
          </div>
        </div>
        {unread > 0 ? <span className="office-chat-unread">{unread}</span> : null}
      </div>

      {loadError ? (
        <p className="office-chat-loading" role="alert" style={{ color: '#b42318' }}>
          {loadError}
        </p>
      ) : null}

      <div
        className={`office-chat-thread ${compact ? 'max-h-[240px] min-h-[200px]' : 'max-h-[320px] min-h-[260px]'}`}
      >
        {loading ? (
          <p className="office-chat-loading">Φόρτωση…</p>
        ) : messages.length === 0 && !loadError ? (
          <div className="office-chat-empty">
            <div className="office-chat-empty-icon">
              <span className="material-symbols-outlined">chat_bubble</span>
            </div>
            Ξεκινήστε τη συνομιλία με τον οδηγό.
          </div>
        ) : (
          messages.map((m, idx) => {
            const mine = m.sender === 'office';
            const receipt = resolveChatReceipt(m, 'office');
            const showReceipt = mine && m.id === lastMineId;
            return (
              <div
                key={m.id}
                className={`office-chat-row ${mine ? 'is-mine' : 'is-theirs'}`}
                style={{ animationDelay: `${Math.min(idx, 8) * 28}ms` }}
              >
                <div className="office-chat-bubble">
                  {!mine ? (
                    <div className="office-chat-sender">{m.sender_name || 'Οδηγός'}</div>
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
          aria-label={`Μήνυμα προς ${title}`}
          maxLength={2000}
          className="office-chat-input"
          style={{ fontSize: '0.9375rem', padding: '0.6rem 0.95rem' }}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="office-chat-send"
          style={{ width: '2.35rem', height: '2.35rem' }}
          aria-label="Αποστολή"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>
            arrow_upward
          </span>
        </button>
      </form>
    </div>
  );
}
