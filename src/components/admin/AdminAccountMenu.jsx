import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  canAccessPlatformOperatorUi,
  getSaasRoles,
  isImpersonating,
} from '../../lib/saasJwt.js';
import {
  clearSaasSession,
  exitImpersonationSession,
  getSaasUserEmail,
  hasImpersonationBackup,
} from '../../services/saasApi.js';
import toast from 'react-hot-toast';

function initialsFromEmail(email) {
  const local = String(email || '')
    .split('@')[0]
    .replace(/[^a-zA-Z0-9α-ωΑ-Ω]/g, ' ')
    .trim();
  if (!local) return 'AD';
  const parts = local.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function displayNameFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  if (!local) return 'Διαχειριστής';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function roleLabel() {
  if (isImpersonating()) return 'Impersonation';
  if (canAccessPlatformOperatorUi()) return 'Super Admin';
  const roles = getSaasRoles();
  if (roles.includes('tenant_admin')) return 'Διαχειριστής γραφείου';
  if (roles.includes('agent')) return 'Agent';
  return 'Διαχειριστής';
}

/**
 * Header account chip + menu — name, role, logout (and exit impersonation).
 */
export default function AdminAccountMenu({ onOpenSettings } = {}) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const email = useMemo(() => getSaasUserEmail(), [open]);
  const name = displayNameFromEmail(email);
  const initials = initialsFromEmail(email);
  const role = roleLabel();
  const impersonating = isImpersonating() && hasImpersonationBackup();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const logout = () => {
    setOpen(false);
    localStorage.removeItem('userRole');
    clearSaasSession();
    navigate('/admin/login');
  };

  const exitImpersonation = () => {
    setOpen(false);
    if (exitImpersonationSession()) {
      toast.success('Επιστροφή σε Super Admin');
      window.location.assign('/admin?tab=settings&sub=tenants');
    }
  };

  const goSettings = () => {
    setOpen(false);
    if (typeof onOpenSettings === 'function') {
      onOpenSettings();
      return;
    }
    navigate('/admin?tab=settings');
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`flex items-center gap-2 sm:gap-2.5 pl-1 pr-2 sm:pr-2.5 py-1 rounded-full border transition-colors ${
          open
            ? 'bg-sky-50 border-sky-200 shadow-sm'
            : 'bg-white border-black/[0.08] hover:border-black/[0.14] hover:bg-black/[0.02]'
        }`}
        aria-label="Λογαριασμός"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold tracking-wide shrink-0 ${
            impersonating
              ? 'bg-amber-500 text-white'
              : 'bg-[#0b4f6c] text-white'
          }`}
          aria-hidden
        >
          {initials}
        </span>
        <span className="hidden sm:flex flex-col items-start min-w-0 text-left leading-tight pr-0.5">
          <span className="text-[13px] font-semibold text-on-surface truncate max-w-[9.5rem]">
            {name}
          </span>
          <span className="text-[11px] text-on-surface-variant truncate max-w-[9.5rem]">
            {role}
          </span>
        </span>
        <span
          className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          expand_more
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[17.5rem] rounded-2xl border border-black/[0.08] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)] overflow-hidden z-50"
        >
          <div className="px-3.5 py-3 border-b border-black/[0.06] bg-slate-50/80">
            <p className="text-sm font-bold text-on-surface truncate">{name}</p>
            <p className="text-xs text-on-surface-variant truncate mt-0.5">
              {email || 'Συνδεδεμένος διαχειριστής'}
            </p>
            <span
              className={`inline-flex items-center gap-1 mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                impersonating
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-sky-100 text-sky-900'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden>
                {impersonating ? 'visibility' : 'verified_user'}
              </span>
              {role}
            </span>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-on-surface hover:bg-black/[0.04] text-left"
              onClick={goSettings}
            >
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden>
                settings
              </span>
              Ρυθμίσεις
            </button>

            {impersonating ? (
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-amber-900 hover:bg-amber-50 text-left"
                onClick={exitImpersonation}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>
                  logout
                </span>
                Έξοδος impersonation
              </button>
            ) : null}

            <button
              type="button"
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50 text-left"
              onClick={logout}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden>
                logout
              </span>
              Αποσύνδεση
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
