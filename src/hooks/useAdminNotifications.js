import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { buildWsUrl } from '../lib/wsUrl.js';
import { LIVE_REFRESH_MS } from '../lib/liveRefresh.js';
import {
  armNotificationAudioUnlock,
  playDriverConnectChime,
  playNotificationClick,
  unlockNotificationAudio,
} from '../lib/admin/notificationClickSound.js';
import { fetchDriverChatUnread, fetchDriverChatThreads } from '../services/platformApi.js';
import { fetchTelemetryAlerts } from '../services/telemetryApi.js';
import { getSaasTenantId, getSaasToken } from '../services/saasApi.js';
import { notifyBookingsChanged } from '../lib/ticketing/bookingSyncEvents.js';

const STORAGE_KEY_BASE = 'admin_notif_inbox_v1';
const CHAT_BASELINE_KEY_BASE = 'admin_notif_chat_baseline_v1';
const LEGACY_STORAGE_KEY = 'admin_notif_inbox_v1';
const MAX_ITEMS = 40;
const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

function storageKeyFor(tenantId) {
  const tid = String(tenantId || '').trim() || 'anonymous';
  return `${STORAGE_KEY_BASE}::${tid}`;
}

function chatBaselineKeyFor(tenantId) {
  const tid = String(tenantId || '').trim() || 'anonymous';
  return `${CHAT_BASELINE_KEY_BASE}::${tid}`;
}

function readChatBaseline(tenantId) {
  try {
    const raw = sessionStorage.getItem(chatBaselineKeyFor(tenantId));
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeChatBaseline(tenantId, value) {
  try {
    const key = chatBaselineKeyFor(tenantId);
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
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
    tenantId: partial.tenantId || partial.tenant_id || null,
    at: partial.at || new Date().toISOString(),
    read: Boolean(partial.read),
  };
}

/** True for the old shared demo ROUTE_DEVIATION that leaked into every office bell. */
export function isDemoFleetMockAlert(rowOrItem) {
  if (!rowOrItem) return false;
  const id = String(rowOrItem.id || '');
  if (id === 'mock-1' || id === 'alert-mock-1' || id.includes('mock-1')) return true;
  const vehicle = String(rowOrItem.vehicle_id || rowOrItem.vehicleId || '');
  if (vehicle === 'demo-vehicle-1') return true;
  const tenant = String(rowOrItem.tenant_id || rowOrItem.tenantId || '');
  const body = String(rowOrItem.body || rowOrItem.message || '');
  if (
    tenant === DEMO_TENANT &&
    /Αποκλίνουσα διαδρομή/i.test(body) &&
    /120m/i.test(body)
  ) {
    return true;
  }
  return false;
}

export function alertBelongsToTenant(row, tenantId) {
  const rowTid = String(row?.tenant_id || row?.tenantId || '').trim();
  const tid = String(tenantId || '').trim();
  if (!rowTid || !tid) return true;
  return rowTid === tid;
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

export function scrubInboxForTenant(items, tenantId) {
  const tid = String(tenantId || '').trim();
  return dedupeStoredItems(items).filter((item) => {
    if (isDemoFleetMockAlert(item) && tid !== DEMO_TENANT) return false;
    if (!alertBelongsToTenant(item, tid)) return false;
    return true;
  });
}

function loadStored(tenantId) {
  try {
    const key = storageKeyFor(tenantId);
    let raw = sessionStorage.getItem(key);
    // One-time: drop the unscoped legacy inbox that leaked demo alerts
    // across every γραφείο in the same browser tab.
    if (!raw) {
      const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        try {
          sessionStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    }
    const parsed = raw ? JSON.parse(raw) : [];
    return scrubInboxForTenant(Array.isArray(parsed) ? parsed : [], tenantId);
  } catch {
    return [];
  }
}

function persist(tenantId, items) {
  try {
    sessionStorage.setItem(
      storageKeyFor(tenantId),
      JSON.stringify(scrubInboxForTenant(items, tenantId).slice(0, MAX_ITEMS)),
    );
  } catch {
    /* ignore */
  }
}

function alertToItem(row) {
  const type = String(row.alert_type || '').toUpperCase();
  const reason = String(row.reason || row.metadata?.reason || '').toLowerCase();
  let title = 'Ειδοποίηση στόλου';
  let tab = 'fleet_live_map';
  if (type === 'SOS') {
    title = 'SOS οδηγού';
  } else if (type === 'DRIVER_ONLINE') {
    title = reason === 'login' ? 'Σύνδεση οδηγού' : 'Έναρξη βάρδιας';
  } else if (type === 'DRIVER_OFFLINE') {
    title = 'Τέλος βάρδιας';
  } else if (type === 'NEW_BOOKING' || type === 'BOOKING_PAID') {
    title = 'Νέα κράτηση';
    tab = row.metadata?.tab || 'bookings';
  } else if (type === 'BOOKING_DELETED') {
    title = 'Διαγραφή εισιτηρίου';
    tab = row.metadata?.tab || 'bookings';
  }
  if (type === 'NEW_BOOKING' || type === 'BOOKING_PAID' || type === 'BOOKING_DELETED') {
    try {
      notifyBookingsChanged({ reason: type.toLowerCase(), alertId: row.id });
    } catch {
      /* ignore */
    }
  }
  return normalizeItem({
    id: `alert-${row.id}`,
    title,
    body: row.message || '',
    type: type.toLowerCase(),
    tab,
    driverId: row.driver_id || row.metadata?.driver_id || null,
    tenantId: row.tenant_id || null,
    at: row.created_at || new Date().toISOString(),
    read: false,
  });
}

function isDriverPresenceAlert(itemOrType) {
  const t = String(
    typeof itemOrType === 'string' ? itemOrType : itemOrType?.type || '',
  ).toLowerCase();
  return (
    t === 'driver_online' ||
    t === 'driver_offline' ||
    t.includes('driver_shift') ||
    t.includes('driver_online') ||
    t.includes('driver_offline') ||
    (t.includes('shift') && !t.includes('chat'))
  );
}

function isDriverOfflineAlert(itemOrType) {
  const t = String(
    typeof itemOrType === 'string' ? itemOrType : itemOrType?.type || '',
  ).toLowerCase();
  return t === 'driver_offline' || t.includes('driver_offline') || t.includes('shift_end');
}

function isChatInboxItem(item) {
  const t = String(item?.type || '').toLowerCase();
  const id = String(item?.id || '');
  return t === 'driver_office_chat' || t.includes('chat') || id.startsWith('chat-');
}

export function useAdminNotifications({ tenantId, enabled = true } = {}) {
  // Never fall back to DEMO tenant — that sealed Achillio/demo alerts into rent offices.
  const resolvedTenantId = String(tenantId || getSaasTenantId() || '').trim();
  const [items, setItems] = useState(() => {
    const cleaned = loadStored(resolvedTenantId);
    persist(resolvedTenantId, cleaned);
    return cleaned;
  });
  const [open, setOpen] = useState(false);
  const seenRef = useRef(new Set(loadStored(resolvedTenantId).map((i) => i.id)));
  const wsRef = useRef(null);
  const tenantRef = useRef(resolvedTenantId);
  tenantRef.current = resolvedTenantId;

  // Reload inbox when the logged-in office changes (same browser tab).
  useEffect(() => {
    const cleaned = loadStored(resolvedTenantId);
    persist(resolvedTenantId, cleaned);
    setItems(cleaned);
    seenRef.current = new Set(cleaned.map((i) => i.id));
  }, [resolvedTenantId]);

  // Keep WebAudio unlockable for the whole admin session (browsers re-suspend).
  useEffect(() => {
    if (!enabled) return undefined;
    armNotificationAudioUnlock();
    return undefined;
  }, [enabled]);

  // Audible chimes are tracked separately from inbox ids — silent snapshot
  // ingest must not block the live DRIVER_ONLINE chime for the same alert.
  const chimedRef = useRef(new Set());
  const lastConnectChimeRef = useRef({ at: 0, key: '' });

  const pushItem = useCallback((raw, { silent = false, upsert = false } = {}) => {
    const item = normalizeItem(raw);
    const tid = tenantRef.current;
    if (isDemoFleetMockAlert(item) && tid !== DEMO_TENANT) return;
    if (!alertBelongsToTenant(item, tid)) return;
    // Chat rows always upsert on a stable id — never stack duplicates.
    const forceUpsert =
      upsert || String(item.type || '') === 'driver_office_chat' || String(item.id).startsWith('chat-');
    const alreadySeen = seenRef.current.has(item.id);
    const presence = isDriverPresenceAlert(item);
    const offline = isDriverOfflineAlert(item);
    const chat = isChatInboxItem(item);
    // Silent snapshot may seed inbox ids — still allow a later live chime.
    if (!forceUpsert && alreadySeen && (silent || !presence || chimedRef.current.has(item.id))) {
      return;
    }
    const isNew = !alreadySeen;
    seenRef.current.add(item.id);
    if (isNew || forceUpsert) {
      setItems((prev) => {
        const next = scrubInboxForTenant(
          [item, ...prev.filter((x) => x.id !== item.id)],
          tid,
        ).slice(0, MAX_ITEMS);
        persist(tid, next);
        return next;
      });
    }
    if (silent) return;

    // Chat / other inbox rows: bell only — no floating toast on the map.
    if (chat) {
      if (isNew || forceUpsert) {
        unlockNotificationAudio();
        void playNotificationClick();
      }
      return;
    }

    if (presence) {
      if (chimedRef.current.has(item.id)) return;
      const debounceKey = `${offline ? 'out' : 'in'}:${String(item.driverId || item.body || item.id)}`;
      const now = Date.now();
      const prev = lastConnectChimeRef.current;
      // Only collapse duplicate WS/push for the same enter/exit burst.
      if (debounceKey && debounceKey === prev.key && now - prev.at < 1500) {
        chimedRef.current.add(item.id);
        return;
      }
      chimedRef.current.add(item.id);
      lastConnectChimeRef.current = { at: now, key: debounceKey };
      unlockNotificationAudio();
      void playDriverConnectChime();
      toast(item.body || item.title, {
        duration: 5500,
        id: `driver-presence-${item.id}`,
        icon: offline ? '🛑' : '🚌',
        style: {
          background: offline ? '#1e293b' : '#0f172a',
          color: '#f8fafc',
          fontWeight: 650,
          borderRadius: '14px',
          padding: '14px 18px',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.28)',
          maxWidth: '26rem',
        },
      });
      return;
    }

    if (isNew) {
      unlockNotificationAudio();
      void playNotificationClick();
    }
  }, []);

  const markAllRead = useCallback(() => {
    const tid = tenantRef.current;
    setItems((prev) => {
      const next = prev.map((i) => ({ ...i, read: true }));
      persist(tid, next);
      return next;
    });
  }, []);

  const markRead = useCallback((id) => {
    const tid = tenantRef.current;
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, read: true } : i));
      persist(tid, next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    const tid = tenantRef.current;
    setItems([]);
    persist(tid, []);
    seenRef.current = new Set();
    // Keep chat baseline at current unread so clearing the bell does not
    // immediately recreate «Νέο μήνυμα οδηγού» on the next poll.
  }, []);

  // Seed + poll telemetry alerts (silent). Poll catches NEW_BOOKING that
  // arrived on another worker via Redis while the WS was briefly down.
  useEffect(() => {
    if (!enabled || !resolvedTenantId) return undefined;
    let cancelled = false;
    const ingest = async ({ playSound = false } = {}) => {
      try {
        const rows = await fetchTelemetryAlerts({ limit: 20 });
        if (cancelled || !Array.isArray(rows)) return;
        rows
          .slice()
          .reverse()
          .forEach((row) => {
            if (isDemoFleetMockAlert(row) && resolvedTenantId !== DEMO_TENANT) return;
            if (!alertBelongsToTenant(row, resolvedTenantId)) return;
            pushItem(alertToItem(row), {
              silent: !playSound || String(row.alert_type || '').toUpperCase() !== 'NEW_BOOKING',
            });
          });
      } catch {
        /* ignore */
      }
    };
    void ingest({ playSound: false });
    const id = window.setInterval(() => void ingest({ playSound: true }), LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, resolvedTenantId, pushItem]);

  // Live alerts WebSocket — tenant from JWT only (query must match office or be omitted).
  useEffect(() => {
    if (!enabled || !resolvedTenantId) return undefined;
    const token = getSaasToken() || '';
    if (!token) return undefined;
    const url = buildWsUrl('/ws/admin/telemetry/alerts', {
      // Prefer office tenant; server rejects mismatches vs JWT.
      tenant_id: resolvedTenantId,
      token,
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
              if (isDemoFleetMockAlert(data) && resolvedTenantId !== DEMO_TENANT) return;
              if (!alertBelongsToTenant(data, resolvedTenantId)) return;
              pushItem(alertToItem(data));
            } else if (data.type === 'alerts_snapshot' && Array.isArray(data.alerts)) {
              data.alerts
                .slice()
                .reverse()
                .forEach((row) => {
                  if (isDemoFleetMockAlert(row) && resolvedTenantId !== DEMO_TENANT) return;
                  if (!alertBelongsToTenant(row, resolvedTenantId)) return;
                  pushItem(alertToItem(row), { silent: true });
                });
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
  }, [enabled, resolvedTenantId, pushItem]);

  // Chat unread → one bell item when count rises after login baseline.
  // null = not baselined yet (office connect must NOT re-fire existing unread).
  // Persist baseline in sessionStorage so remount / StrictMode does not reset to 0
  // and re-spam. Never treat a failed poll as unread=0 (that re-fires on recovery).
  const chatUnreadRef = useRef(readChatBaseline(resolvedTenantId));
  useEffect(() => {
    chatUnreadRef.current = readChatBaseline(resolvedTenantId);
  }, [resolvedTenantId]);

  useEffect(() => {
    if (!enabled || !resolvedTenantId) return undefined;
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
        writeChatBaseline(resolvedTenantId, unread);
        return;
      }
      const prev = Number(chatUnreadRef.current) || 0;
      chatUnreadRef.current = unread;
      writeChatBaseline(resolvedTenantId, unread);
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
            tenantId: resolvedTenantId,
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
  }, [enabled, resolvedTenantId, pushItem]);

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
      const pushTenant = String(payload.data?.tenant_id || payload.tenant_id || '').trim();
      if (pushTenant && resolvedTenantId && pushTenant !== resolvedTenantId) return;
      // Chat pushes use a stable tag/id so login redelivery does not stack rows.
      const driverId = payload.data?.driver_id || null;
      const stableChatId =
        pushType.includes('chat') || /μήνυμα οδηγού/i.test(String(payload.title || ''))
          ? `chat-${driverId || 'office'}`
          : null;
      const isShift =
        pushType.includes('driver_shift') ||
        /βάρδια|συνδέθηκε|online|οδηγός/i.test(
          `${payload.title || ''} ${payload.body || ''}`,
        );
      const isNewBooking =
        pushType.includes('new_booking') ||
        pushType === 'booking_paid' ||
        /νέα κράτηση/i.test(String(payload.title || ''));
      pushItem(
        {
          id: stableChatId || payload.tag || payload.data?.message_id || `push-${Date.now()}`,
          title: payload.title || 'Ειδοποίηση',
          body: payload.body || '',
          type: pushType,
          tenantId: pushTenant || resolvedTenantId || null,
          tab:
            payload.data?.tab ||
            (stableChatId ? 'driver_chat' : isNewBooking ? 'bookings' : null),
          driverId,
          url: payload.url || payload.data?.url || null,
          read: false,
        },
        // Chat OS push already dinged; driver connect / new booking play in-tab chime.
        { upsert: true, silent: !(isShift || isNewBooking) },
      );
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [enabled, resolvedTenantId, pushItem]);

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
