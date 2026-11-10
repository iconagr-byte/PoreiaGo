import { useEffect, useRef } from 'react';
import { useWalletNotifications } from '../../hooks/useWalletNotifications.js';

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
  if (t.includes('fiscal') || t.includes('mark')) return 'receipt_long';
  if (t.includes('trip') || t.includes('reminder')) return 'departure_board';
  if (t.includes('rent')) return 'directions_car';
  if (t.includes('payment') || t.includes('paid')) return 'payments';
  return 'notifications';
}

/**
 * Wallet top-right bell — customer inbox (push + booking-derived).
 */
export default function WalletNotificationBell({
  email,
  bookings = [],
  onOpenItem,
}) {
  const { items, unreadCount, open, setOpen, markAllRead, markRead, clearAll } =
    useWalletNotifications({ email, bookings, enabled: Boolean(email) });
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  const openItem = (item) => {
    markRead(item.id);
    setOpen(false);
    if (typeof onOpenItem === 'function') {
      onOpenItem(item);
      return;
    }
    if (item.url && item.url !== '/wallet') {
      window.location.assign(item.url);
    }
  };

  return (
    <div className="wallet-topbar-menu" ref={rootRef}>
      <button
        type="button"
        className="wallet-topbar-btn wallet-topbar-btn--icon"
        aria-label={
          unreadCount > 0 ? `Ειδοποιήσεις, ${unreadCount} νέες` : 'Ειδοποιήσεις'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) markAllRead();
            return next;
          });
        }}
      >
        <span className="material-symbols-outlined text-[22px]" aria-hidden>
          notifications
        </span>
        {unreadCount > 0 ? (
          <span className="wallet-topbar-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="wallet-topbar-popover wallet-topbar-popover--end"
          role="dialog"
          aria-label="Ειδοποιήσεις"
        >
          <div className="wallet-topbar-popover-head">
            <p>Ειδοποιήσεις</p>
            {items.length > 0 ? (
              <button type="button" className="wallet-topbar-popover-clear" onClick={clearAll}>
                Καθαρισμός
              </button>
            ) : null}
          </div>
          <div className="wallet-topbar-popover-body">
            {items.length === 0 ? (
              <p className="wallet-topbar-popover-empty">Δεν υπάρχουν ειδοποιήσεις ακόμα.</p>
            ) : (
              <ul className="wallet-notif-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`wallet-notif-item${item.read ? '' : ' is-unread'}`}
                      onClick={() => openItem(item)}
                    >
                      <span className="material-symbols-outlined" aria-hidden>
                        {iconFor(item.type)}
                      </span>
                      <span className="wallet-notif-item-copy">
                        <span className="wallet-notif-item-title">{item.title}</span>
                        {item.body ? (
                          <span className="wallet-notif-item-body">{item.body}</span>
                        ) : null}
                        <span className="wallet-notif-item-when">{formatWhen(item.at)}</span>
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
