/**
 * Driver PWA — chat with office.
 * Unread is surfaced via header/nav badge (no toast spam).
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

const POLL_MS = 5000;
const NEAR_BOTTOM_PX = 80;

function initials(name) {
  return (name || 'Γ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function messageSignature(rows) {
  if (!Array.isArray(rows) || !rows.length) return '0';
  const last = rows[rows.length - 1];
  return `${rows.length}:${last?.id || ''}:${last?.read_at || ''}:${last?.delivered_at || ''}`;
}

export default function DriverOfficeChat({ isActive = false, onUnreadChange } = {}) {
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const threadRef = useRef(null);
  const bottomRef = useRef(null);
  const seenIdsRef = useRef(new Set());
  const signatureRef = useRef('');
  const stickToBottomRef = useRef(true);
  const isActiveRef = useRef(isActive);
  const onUnreadChangeRef = useRef(onUnreadChange);
  isActiveRef.current = isActive;
  onUnreadChangeRef.current = onUnreadChange;

  const publishUnread = useCallback((n) => {
    const count = Math.max(0, Number(n) || 0);
    setUnread(count);
    onUnreadChangeRef.current?.(count);
  }, []);

  const isNearBottom = () => {
    const el = threadRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const scrollThreadBottom = ({ force = false } = {}) => {
    if (!force && !stickToBottomRef.current) return;
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const onThreadScroll = () => {
    stickToBottomRef.current = isNearBottom();
  };

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await fetchDriverChatMessages();
      const rows = Array.isArray(data.messages) ? data.messages : [];
      const nextSig = messageSignature(rows);
      const changed = nextSig !== signatureRef.current;
      signatureRef.current = nextSig;

      setMessages(rows);
      for (const m of rows) {
        if (m?.id) seenIdsRef.current.add(m.id);
      }

      const serverUnread = Math.max(0, Number(data.unread || 0));
      if (isActiveRef.current && serverUnread > 0) {
        // Viewing chat — clear server unread; badge goes to zero.
        markDriverChatRead()
          .then(() => publishUnread(0))
          .catch(() => publishUnread(serverUnread));
      } else {
        publishUnread(serverUnread);
      }

      if (!silent) setLoading(false);

      if (isActiveRef.current && (!silent || changed)) {
        stickToBottomRef.current = true;
        window.requestAnimationFrame(() => scrollThreadBottom({ force: !silent }));
      }
    } catch (err) {
      if (!silent) {
        setLoading(false);
        toast.error(err.message || 'Αποτυχία chat');
      }
    }
  }, [publishUnread]);

  useEffect(() => {
    load();
    const id = window.setInterval(() => load({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Opening the chat tab marks messages read immediately.
  useEffect(() => {
    if (!isActive || unread <= 0) return undefined;
    let cancelled = false;
    markDriverChatRead()
      .then(() => {
        if (!cancelled) publishUnread(0);
      })
      .catch(() => {});
    stickToBottomRef.current = true;
    window.requestAnimationFrame(() => scrollThreadBottom({ force: true }));
    return () => {
      cancelled = true;
    };
  }, [isActive, unread, publishUnread]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    stickToBottomRef.current = true;
    try {
      const res = await sendDriverChatMessage(body);
      setText('');
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
        seenIdsRef.current.add(res.message.id);
        signatureRef.current = messageSignature([...(messages || []), res.message]);
        window.requestAnimationFrame(() => scrollThreadBottom({ force: true }));
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
    <div className="driver-stack office-chat office-chat--focus">
      <div className="office-chat-shell office-chat-shell--fill rounded-[1.35rem]">
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

        <div
          ref={threadRef}
          className="office-chat-thread office-chat-thread--fill"
          onScroll={onThreadScroll}
        >
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
