import { useEffect, useId, useRef, useState } from 'react';

/**
 * Wallet top-left person menu — account + lost & found + logout.
 * Rent lives on /rent (not in this menu).
 */
export default function WalletAccountMenu({
  profile,
  onOpenAccount,
  onOpenLostFound,
  onLogout,
}) {
  const menuId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

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
  }, [open]);

  const go = (fn) => {
    setOpen(false);
    fn?.();
  };

  const name = profile?.name || 'Πελάτης';
  const email = profile?.email || '';

  return (
    <div className="wallet-topbar-menu" ref={rootRef}>
      <button
        type="button"
        className="wallet-topbar-btn wallet-topbar-btn--icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Λογαριασμός"
        title={email || name}
        onClick={() => setOpen((v) => !v)}
      >
        {profile?.picture ? (
          <img
            src={profile.picture}
            alt=""
            className="wallet-topbar-avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="material-symbols-outlined text-[22px]" aria-hidden>
            person
          </span>
        )}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Λογαριασμός"
          className="wallet-topbar-popover wallet-topbar-popover--start"
        >
          <div className="wallet-topbar-popover-profile">
            <p className="wallet-topbar-popover-name">{name}</p>
            {email ? <p className="wallet-topbar-popover-email">{email}</p> : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="wallet-topbar-menu-item"
            onClick={() => go(onOpenAccount)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              manage_accounts
            </span>
            Λογαριασμός
          </button>
          <button
            type="button"
            role="menuitem"
            className="wallet-topbar-menu-item"
            onClick={() => go(onOpenLostFound)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              support_agent
            </span>
            Απωλεσθέντα
          </button>
          <button
            type="button"
            role="menuitem"
            className="wallet-topbar-menu-item is-danger"
            onClick={() => go(onLogout)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              logout
            </span>
            Έξοδος
          </button>
        </div>
      ) : null}
    </div>
  );
}
