/**
 * Header account control — Log in when guest; avatar + name dropdown when signed in
 * (My Wallet / account / logout), like large consumer sites.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getCustomerEmail,
  getCustomerName,
  getCustomerPicture,
  getCustomerToken,
  isCustomer,
  logoutCustomer,
} from '../../lib/auth.js';

function hasWalletSession() {
  return Boolean(isCustomer() && getCustomerToken());
}

function readProfile() {
  const email = (getCustomerEmail() || '').trim();
  const name = (getCustomerName() || '').trim() || email.split('@')[0] || 'Πελάτης';
  const picture = (getCustomerPicture() || '').trim();
  return { email, name, picture };
}

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export default function StorefrontAccountMenu({
  isDark = true,
  compact = false,
  onOpenLogin,
  onSessionChange,
}) {
  const navigate = useNavigate();
  const menuId = useId();
  const rootRef = useRef(null);
  const [ready, setReady] = useState(() =>
    typeof window !== 'undefined' ? hasWalletSession() : false,
  );
  const [profile, setProfile] = useState(() =>
    typeof window !== 'undefined' ? readProfile() : { email: '', name: '', picture: '' },
  );
  const [open, setOpen] = useState(false);

  const sync = () => {
    const ok = hasWalletSession();
    setReady(ok);
    setProfile(ok ? readProfile() : { email: '', name: '', picture: '' });
    if (!ok) setOpen(false);
    onSessionChange?.(ok);
  };

  useEffect(() => {
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on mount / storage / focus only
  }, []);

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

  const pill = isDark
    ? 'inline-flex items-center gap-1.5 rounded-full bg-white text-slate-900 shadow-sm hover:bg-white/90 transition-colors'
    : 'inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 transition-colors';

  const pad = compact ? 'px-2.5 py-1.5 text-xs font-bold' : 'px-3.5 py-2 text-sm font-bold';
  const menuPanel = isDark
    ? 'bg-slate-950/95 text-white border border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.45)]'
    : 'bg-white text-slate-900 border border-black/[0.08] shadow-[0_16px_40px_rgba(15,23,42,0.14)]';
  const menuItem = isDark
    ? 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 text-left'
    : 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 text-left';
  const menuDanger = isDark
    ? 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/15 text-left'
    : 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 text-left';

  if (!ready) {
    return (
      <button
        type="button"
        className={`${pill} ${pad}`}
        title="Log in to your account"
        aria-label="Log in to your account"
        onClick={() => onOpenLogin?.()}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden>
          login
        </span>
        Log in
      </button>
    );
  }

  const displayName = compact
    ? profile.name.split(/\s+/)[0] || profile.name
    : profile.name;

  const handleLogout = () => {
    setOpen(false);
    logoutCustomer();
    sync();
    navigate('/', { replace: false });
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`${pill} ${pad} max-w-[14rem]`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={profile.email || profile.name}
        onClick={() => setOpen((v) => !v)}
      >
        {profile.picture ? (
          <img
            src={profile.picture}
            alt=""
            className="h-6 w-6 rounded-full object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold tracking-tight ${
              isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
            }`}
            aria-hidden
          >
            {initials(profile.name)}
          </span>
        )}
        <span className="truncate">{displayName}</span>
        <span className="material-symbols-outlined text-[18px] opacity-70 shrink-0" aria-hidden>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Λογαριασμός"
          className={`absolute right-0 top-[calc(100%+0.45rem)] z-[60] min-w-[14.5rem] rounded-2xl p-2 ${menuPanel}`}
        >
          <div
            className={`px-3 py-2 mb-1 border-b ${
              isDark ? 'border-white/10' : 'border-black/[0.06]'
            }`}
          >
            <p className="text-sm font-bold truncate">{profile.name}</p>
            {profile.email ? (
              <p
                className={`text-xs truncate mt-0.5 ${
                  isDark ? 'text-white/55' : 'text-slate-500'
                }`}
              >
                {profile.email}
              </p>
            ) : null}
          </div>
          <Link
            role="menuitem"
            to="/wallet"
            className={menuItem}
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              account_balance_wallet
            </span>
            My Wallet
          </Link>
          <Link
            role="menuitem"
            to="/wallet"
            className={menuItem}
            onClick={() => {
              setOpen(false);
            }}
            state={{ walletTab: 'account' }}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              person
            </span>
            Λογαριασμός
          </Link>
          <button type="button" role="menuitem" className={menuDanger} onClick={handleLogout}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              logout
            </span>
            Έξοδος
          </button>
        </div>
      ) : null}
    </div>
  );
}
