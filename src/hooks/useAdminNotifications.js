import { useCallback, useEffect, useRef, useState } from 'react';
import { buildWsUrl } from '../lib/wsUrl.js';
import { LIVE_REFRESH_MS } from '../lib/liveRefresh.js';
import { playNotificationClick, unlockNotificationAudio } from '../lib/admin/notificationClickSound.js';
import { fetchDriverChatUnread, fetchDriverChatThreads } from '../services/platformApi.js';
import { fetchTelemetryAlerts } from '../services/telemetryApi.js';

const STORAGE_KEY = 'admin_notif_inbox_v1';
const MAX_ITEMS = 40;
const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

function loadStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
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

function normalizeItem( partial ) {
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
  const [items, setItems] = useState(() => loadStored());
  const [open, setOpen] = useState(false);
  const seenRef = useRef(new Set(loadStored().map((i) => i.id)));
  const wsRef = useRef(null);

  const pushItem = useCallback((raw, { silent = false } = {}) => {
    const item = normalizeItem(raw);
    if (seenRef.current.has(item.id)) return;
    seenRef.current.add(item.id);
    setItems((prev) => {
      const next = [item, ...prev.filter((x) => x.id !== item.id)].slice(0, MAX_ITEMS);
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
    const qs = `?tenant_id=${tenantId}`;
    const url = buildWsUrl(`/ws/admin/telemetry/alerts${qs}`);
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

  // Chat unread → bell item when count rises.
  const chatUnreadRef = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const [u, t] = await Promise.all([
          fetchDriverChatUnread().catch(() => ({ unread: 0 })),
          fetchDriverChatThreads().catch(() => ({ threads: [] })),
        ]);
        if (cancelled) return;
        const unread = Number(u.unread || 0);
        const prev = chatUnreadRef.current;
        chatUnreadRef.current = unread;
        if (unread > prev) {
          const top = (t.threads || []).find((x) => Number(x.unread_office || 0) > 0);
          pushItem({
            id: `chat-${Date.now()}`,
            title: 'Νέο μήνυμα οδηγού',
            body: top?.last_body || top?.driver_name || `${unread} μη αναγνωσμένα`,
            type: 'driver_office_chat',
            tab: 'driver_chat',
            driverId: top?.driver_id || null,
            url: top?.driver_id
              ? `/admin?tab=driver_chat&driverId=${encodeURIComponent(top.driver_id)}`
              : '/admin?tab=driver_chat',
          });
        }
      } catch {
        /* ignore */
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
      pushItem({
        id: payload.tag || `push-${Date.now()}`,
        title: payload.title || 'Ειδοποίηση',
        body: payload.body || '',
        type: payload.data?.type || 'push',
        tab: payload.data?.tab || null,
        driverId: payload.data?.driver_id || null,
        url: payload.url || payload.data?.url || null,
      });
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
