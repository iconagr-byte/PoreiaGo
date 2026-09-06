import { useCallback, useEffect, useRef, useState } from 'react';
import { buildWsUrl } from '../lib/wsUrl.js';
import { LIVE_REFRESH_MS } from '../lib/liveRefresh.js';
import { playNotificationClick, unlockNotificationAudio } from '../lib/admin/notificationClickSound.js';
import { fetchDriverChatUnread, fetchDriverChatThreads } from '../services/platformApi.js';
import { fetchTelemetryAlerts } from '../services/telemetryApi.js';
import { getSaasToken } from '../services/saasApi.js';

const STORAGE_KEY = 'admin_notif_inbox_v1';
const CHAT_BASELINE_KEY = 'admin_notif_chat_baseline_v1';
const MAX_ITEMS = 40;
const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

function readChatBaseline() {
  try {
    const raw = sessionStorage.getItem(CHAT_BASELINE_KEY);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeChatBaseline(value) {
  try {
    if (value == null) sessionStorage.removeItem(CHAT_BASELINE_KEY);
    else sessionStorage.setItem(CHAT_BASELINE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

function normalizeItem(partial) {
  const id = String(partial.id || `${partial.type || 'n'}-${partial.at || Date.now()}`);
  return {
    id,
    title: partial.title || 'Ειδοποίηση',
    body: partial.body || '',
    type: partial.type || 'info',
    url: partial.url || null,
    tab: partial.tab || null,
    driverId: partial.driverId || null,
    at: partial.at || new Date().toISOString(),
    read: Boolean(partial.read),
  };
}

/** Collapse legacy chat-${Date.now()} duplicates into one row per driver. */
export function dedupeStoredItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const out = [];
  const chatSeen = new Set();
  for (const raw of items) {
    const item = normalizeItem(raw);
    if (String(item.type || '') === 'driver_office_chat') {
      const driverKey = item.driverId || 'office';
      const stableId = `chat-${driverKey}`;
      if (chatSeen.has(stableId)) continue;
      chatSeen.add(stableId);
      out.push({ ...item, id: stableId });
      continue;
    }
    out.push(item);
  }
  return out.slice(0, MAX_ITEMS);
}

function loadStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return dedupeStoredItems(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function persist(items) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore */
  }
}

function alertToItem(row) {
  const type = String(row.alert_type || '').toUpperCase();
  let title = 'Ειδοποίηση στόλου';
  let tab = 'fleet_live_map';
  if (type === 'SOS') {
    title = 'SOS οδηγού';
  } else if (type === 'DRIVER_ONLINE') {
    title = 'Έναρξη βάρδιας';
  } else if (type === 'DRIVER_OFFLINE') {
    title = 'Τέλος βάρδιας';
  }
  return normalizeItem({
    id: `alert-${row.id}`,
    title,
    body: row.message || '',
    type: type.toLowerCase(),
    tab,
    driverId: row.driver_id || null,
    at: row.created_at || new Date().toISOString(),
    read: false,
  });
}

export function useAdminNotifications({ tenantId = DEMO_TENANT, enabled = true } = {}) {
  const [items, setItems] = useState(() => {
    const cleaned = loadStored();
    // Rewrite session inbox so legacy chat-${Date.now()} spam collapses immediately.
    persist(cleaned);
    return cleaned;
  });
  const [open, setOpen] = useState(false);
  const seenRef = useRef(new Set(loadStored().map((i) => i.id)));
  const wsRef = useRef(null);

  const pushItem = useCallback((raw, { silent = false, upsert = false } = {}) => {
    const item = normalizeItem(raw);
    // Chat rows always upsert on a stable id — never stack duplicates.
    const forceUpsert =
      upsert || String(item.type || '') === 'driver_office_chat' || String(item.id).startsWith('chat-');
    if (!forceUpsert && seenRef.current.has(item.id)) return;
    seenRef.current.add(item.id);
    setItems((prev) => {
      const next = dedupeStoredItems([item, ...prev.filter((x) => x.id !== item.id)]).slice(
        0,
        MAX_ITEMS,
      );
      persist(next);
      return next;
    });
    if (!silent) {
      unlockNotificationAudio();
      playNotificationClick();
    }
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((i) => ({ ...i, read: true }));
      persist(next);
      return next;
    });
  }, []);

  const markRead = useCallback((id) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, read: true } : i));
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    persist([]);
    seenRef.current = new Set();
    // Keep chat baseline at current unread so clearing the bell does not
    // immediately recreate «Νέο μήνυμα οδηγού» on the next poll.
  }, []);

  // Seed from recent telemetry alerts (silent).
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchTelemetryAlerts({ limit: 15 });
        if (cancelled || !Array.isArray(rows)) return;
        rows
          .slice()
          .reverse()
          .forEach((row) => pushItem(alertToItem(row), { silent: true }));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, pushItem]);

  // Live alerts WebSocket.
  useEffect(() => {
    if (!enabled) return undefined;
    const url = buildWsUrl('/ws/admin/telemetry/alerts', {
      tenant_id: tenantId,
      token: getSaasToken() || '',
    });
    let closed = false;
    let reconnectTimer;

    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === 'telemetry_alert') {
              pushItem(alertToItem(data));
            }
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          if (!closed) reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
      }
    };
    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [enabled, tenantId, pushItem]);

  // Chat unread → one bell item when count rises after login baseline.
  // null = not baselined yet (office connect must NOT re-fire existing unread).
  // Persist baseline in sessionStorage so remount / StrictMode does not reset to 0
  // and re-spam. Never treat a failed poll as unread=0 (that re-fires on recovery).
  const chatUnreadRef = useRef(readChatBaseline());
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const poll = async () => {
      let u;
      let t;
      try {
        u = await fetchDriverChatUnread();
      } catch {
        // Keep previous baseline — flaky API must not look like unread dropped to 0.
        return;
      }
      try {
        t = await fetchDriverChatThreads();
      } catch {
        t = { threads: [] };
      }
      if (cancelled) return;
      const unread = Math.max(0, Number(u?.unread || 0));
      if (chatUnreadRef.current === null) {
        // First successful poll after office login — baseline only, no fresh row.
        chatUnreadRef.current = unread;
        writeChatBaseline(unread);
        return;
      }
      const prev = Number(chatUnreadRef.current) || 0;
      chatUnreadRef.current = unread;
      writeChatBaseline(unread);
      if (unread > prev) {
        const top = (t.threads || []).find((x) => Number(x.unread_office || 0) > 0);
        const driverId = top?.driver_id || 'office';
        pushItem(
          {
            id: `chat-${driverId}`,
            title: 'Νέο μήνυμα οδηγού',
            body:
              top?.last_message ||
              top?.last_body ||
              top?.driver_name ||
              `${unread} μη αναγνωσμένα`,
            type: 'driver_office_chat',
            tab: 'driver_chat',
            driverId: top?.driver_id || null,
            url: top?.driver_id
              ? `/admin?tab=driver_chat&driverId=${encodeURIComponent(top.driver_id)}`
              : '/admin?tab=driver_chat',
            at: top?.last_at || new Date().toISOString(),
            read: false,
          },
          { upsert: true },
        );
      }
    };
    poll();
    const id = window.setInterval(poll, LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, pushItem]);

  // Service worker push → fill bell while admin tab is open.
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }
    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.type !== 'ADMIN_PUSH_RECEIVED') return;
      const payload = data.payload || {};
      const pushType = String(payload.data?.type || payload.type || 'push');
      // Chat pushes use a stable tag/id so login redelivery does not stack rows.
      const driverId = payload.data?.driver_id || null;
      const stableChatId =
        pushType.includes('chat') || /μήνυμα οδηγού/i.test(String(payload.title || ''))
          ? `chat-${driverId || 'office'}`
          : null;
      pushItem(
        {
          id: stableChatId || payload.tag || payload.data?.message_id || `push-${Date.now()}`,
          title: payload.title || 'Ειδοποίηση',
          body: payload.body || '',
          type: pushType,
          tab: payload.data?.tab || (stableChatId ? 'driver_chat' : null),
          driverId,
          url: payload.url || payload.data?.url || null,
          read: false,
        },
        // OS/Web Push already alerted — update the bell row without stacking or click noise.
        { upsert: true, silent: true },
      );
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [enabled, pushItem]);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const unreadCount = items.filter((i) => !i.read).length;

  return {
    items,
    unreadCount,
    open,
    setOpen,
    pushItem,
    markAllRead,
    markRead,
    clearAll,
  };
}
