import { useEffect, useRef } from 'react';
import { useAdminNotifications } from '../../hooks/useAdminNotifications.js';
import { unlockNotificationAudio } from '../../lib/admin/notificationClickSound.js';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function iconFor(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('sos')) return 'emergency';
  if (t.includes('chat') || t.includes('message')) return 'chat';
  if (t.includes('lost')) return 'support_agent';
  if (t.includes('online') || t.includes('shift')) return 'play_circle';
  if (t.includes('offline')) return 'stop_circle';
  return 'notifications';
}

/**
 * Top-right admin bell — inbox + classic click sound on new events.
 */
export default function AdminNotificationBell({ onNavigate } = {}) {
  const { items, unreadCount, open, setOpen, markAllRead, markRead, clearAll } =
    useAdminNotifications({ enabled: true });
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpen]);

  const openItem = (item) => {
    markRead(item.id);
    setOpen(false);
    const tab = item.tab || null;
    if (typeof onNavigate === 'function' && tab) {
      onNavigate(tab, { driverId: item.driverId || null, url: item.url });
      return;
    }
    if (item.url) {
      window.location.assign(item.url);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-black/[0.04]"
        aria-label={
          unreadCount > 0 ? `Ειδοποιήσεις, ${unreadCount} νέες` : 'Ειδοποιήσεις'
        }
        aria-expanded={open}
        onClick={() => {
          unlockNotificationAudio();
          setOpen((v) => {
            const next = !v;
            if (next) markAllRead();
            return next;
          });
        }}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 min-w-[1.05rem] h-[1.05rem] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(28rem,70vh)] overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-xl z-50 flex flex-col"
          role="dialog"
          aria-label="Ειδοποιήσεις"
        >
          <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">Ειδοποιήσεις</p>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-bold text-gray-500 hover:text-gray-800"
              >
                Καθαρισμός
              </button>
            ) : null}
          </div>
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-500 text-center">
                Δεν υπάρχουν ειδοποιήσεις ακόμα.
              </p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`w-full text-left px-4 py-3 hover:bg-sky-50/80 transition-colors flex gap-3 ${
                        item.read ? 'opacity-80' : 'bg-sky-50/40'
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5"
                        aria-hidden
                      >
                        {iconFor(item.type)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-gray-900 truncate">
                          {item.title}
                        </span>
                        {item.body ? (
                          <span className="block text-xs text-gray-600 mt-0.5 line-clamp-2">
                            {item.body}
                          </span>
                        ) : null}
                        <span className="block text-[11px] text-gray-400 mt-1">
                          {formatWhen(item.at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
