import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingFiscalMark } from '../lib/fiscal/fiscalDisplay.js';
import { isPaid } from '../lib/bookingDisplay.js';

const MAX_ITEMS = 40;
const ADMIN_ONLY_TYPES = new Set([
  'driver_shift',
  'sos',
  'driver_office_chat',
  'lost_item_report',
]);

function storageKey(email) {
  const e = String(email || '').trim().toLowerCase() || 'guest';
  return `wallet_notif_inbox_v1:${e}`;
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
    bookingId: partial.bookingId || null,
    at: partial.at || new Date().toISOString(),
    read: Boolean(partial.read),
  };
}

function loadStored(email) {
  try {
    const raw = localStorage.getItem(storageKey(email));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeItem).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function persist(email, items) {
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore */
  }
}

function parseTripDate(booking) {
  const raw = String(booking?.date || '').trim();
  if (!raw) return null;
  // Prefer ISO / YYYY-MM-DD; fall back to Date.parse for locale strings.
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T${booking?.time || '12:00'}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Seed inbox rows from wallet bookings (fiscal MARK + soon departures). */
export function bookingsToNotifItems(bookings = []) {
  const now = Date.now();
  const out = [];
  for (const b of bookings) {
    if (!b?.id) continue;
    const mark = bookingFiscalMark(b);
    if (mark) {
      out.push(
        normalizeItem({
          id: `fiscal-${b.id}-${mark}`,
          title: 'Φορολογική απόδειξη (MARK)',
          body: `${b.tripTitle || 'Κράτηση'} · MARK ${mark}`,
          type: 'fiscal_receipt_issued',
          tab: 'pass',
          bookingId: b.id,
          url: `/wallet`,
          at: b.updatedAt || b.updated_at || b.createdAt || new Date().toISOString(),
          read: true,
        }),
      );
    }
    const when = parseTripDate(b);
    if (when) {
      const ms = when.getTime() - now;
      // Within 48h ahead (or up to 2h past) — trip reminder.
      if (ms < 48 * 3600 * 1000 && ms > -2 * 3600 * 1000) {
        out.push(
          normalizeItem({
            id: `trip-soon-${b.id}`,
            title: 'Επερχόμενη εκδρομή',
            body: `${b.tripTitle || 'Εκδρομή'} · ${b.date || ''} ${b.time || ''}`.trim(),
            type: 'trip_reminder',
            tab: isPaid(b) ? 'pass' : 'bookings',
            bookingId: b.id,
            at: when.toISOString(),
            read: true,
          }),
        );
      }
    }
  }
  return out;
}

function isAdminOnlyPush(payload = {}) {
  const t = String(payload.data?.type || payload.type || '').toLowerCase();
  if (ADMIN_ONLY_TYPES.has(t)) return true;
  if (t.includes('driver_shift') || t.includes('office_chat')) return true;
  return false;
}

/**
 * Customer / Wallet notification inbox.
 * Sources: localStorage inbox, booking-derived rows, Web Push via customer SW
 * (`ADMIN_PUSH_RECEIVED` / `CUSTOMER_PUSH_RECEIVED` postMessage).
 */
export function useWalletNotifications({ email, bookings = [], enabled = true } = {}) {
  const [items, setItems] = useState(() => (enabled ? loadStored(email) : []));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    setItems(loadStored(email));
  }, [email, enabled]);

  const commit = useCallback(
    (next) => {
      const list = (Array.isArray(next) ? next : []).map(normalizeItem).slice(0, MAX_ITEMS);
      setItems(list);
      if (enabled) persist(email, list);
    },
    [email, enabled],
  );

  const pushItem = useCallback(
    (partial, { upsert = true } = {}) => {
      const item = normalizeItem({ ...partial, read: partial.read === true });
      setItems((prev) => {
        let next = prev.slice();
        const idx = next.findIndex((x) => x.id === item.id);
        if (idx >= 0) {
          if (!upsert) return prev;
          next[idx] = { ...next[idx], ...item, read: item.read && next[idx].read };
        } else {
          next = [item, ...next];
        }
        next = next.slice(0, MAX_ITEMS);
        if (enabled) persist(email, next);
        return next;
      });
    },
    [email, enabled],
  );

  // Merge booking-derived rows without re-flagging already-seen ids as unread.
  useEffect(() => {
    if (!enabled || !bookings?.length) return;
    const derived = bookingsToNotifItems(bookings);
    if (!derived.length) return;
    setItems((prev) => {
      const byId = new Map(prev.map((i) => [i.id, i]));
      let changed = false;
      for (const d of derived) {
        if (byId.has(d.id)) continue;
        byId.set(d.id, d);
        changed = true;
      }
      if (!changed) return prev;
      const next = Array.from(byId.values())
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .slice(0, MAX_ITEMS);
      persist(email, next);
      return next;
    });
  }, [bookings, email, enabled]);

  // Customer SW push → inbox (fiscal MARK, booking updates, etc.).
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }
    const onMessage = (event) => {
      const data = event.data;
      if (!data) return;
      if (data.type !== 'ADMIN_PUSH_RECEIVED' && data.type !== 'CUSTOMER_PUSH_RECEIVED') return;
      const payload = data.payload || {};
      if (isAdminOnlyPush(payload)) return;
      const pushType = String(payload.data?.type || payload.type || 'push');
      const bookingId = payload.data?.bookingId || payload.data?.booking_id || null;
      pushItem({
        id:
          payload.tag ||
          payload.data?.invoice_id ||
          payload.data?.message_id ||
          `push-${pushType}-${Date.now()}`,
        title: payload.title || 'Ειδοποίηση',
        body: payload.body || '',
        type: pushType,
        tab: payload.data?.tab || 'pass',
        bookingId,
        url: payload.url || payload.data?.url || '/wallet',
        read: false,
      });
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [enabled, pushItem]);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((i) => (i.read ? i : { ...i, read: true }));
      if (enabled) persist(email, next);
      return next;
    });
  }, [email, enabled]);

  const markRead = useCallback(
    (id) => {
      setItems((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, read: true } : i));
        if (enabled) persist(email, next);
        return next;
      });
    },
    [email, enabled],
  );

  const clearAll = useCallback(() => {
    commit([]);
  }, [commit]);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

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
