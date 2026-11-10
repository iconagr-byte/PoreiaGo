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
import { useUiLang } from '../../hooks/useUiLang.js';
import AdminAccountInlinePanel from './AdminAccountSecurityModal.jsx';
import '../../styles/admin-header-icons.css';

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

function displayNameFromEmail(email, fallbackAdmin) {
  const local = String(email || '').split('@')[0] || '';
  if (!local) return fallbackAdmin;
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function roleLabel(t) {
  if (isImpersonating()) return t('role_impersonation');
  if (canAccessPlatformOperatorUi()) return t('role_super');
  const roles = getSaasRoles();
  if (roles.includes('tenant_admin')) return t('role_office_admin');
  if (roles.includes('agent')) return t('role_agent');
  return t('role_admin');
}

/**
 * Header account menu — user-only: account/security expand inline in the dropdown.
 */
export default function AdminAccountMenu() {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const firstItemRef = useRef(null);
  const [open, setOpen] = useState(false);
  /** null | 'account' | 'security' — sub-panels stay inside the dropdown */
  const [panel, setPanel] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const email = useMemo(() => getSaasUserEmail(), [open, panel]);
  const fallbackName = displayNameFromEmail(email, t('role_admin'));
  const name = displayName.trim() || fallbackName;
  const initials = initialsFromEmail(email);
  const role = roleLabel(t);
  const impersonating = isImpersonating() && hasImpersonationBackup();

  const closeMenu = () => {
    setOpen(false);
    setPanel(null);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) closeMenu();
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (panel) {
        setPanel(null);
        return;
      }
      closeMenu();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => {
      if (!panel) firstItemRef.current?.focus?.();
    }, 30);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, panel]);

  const logout = () => {
    closeMenu();
    localStorage.removeItem('userRole');
    clearSaasSession();
    navigate('/admin/login');
  };

  const exitImpersonation = () => {
    closeMenu();
    if (exitImpersonationSession()) {
      toast.success(t('back_super'));
      window.location.assign('/admin?tab=settings&sub=tenants');
    }
  };

  const copyEmail = async () => {
    const value = String(email || '').trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('email_copied'));
    } catch {
      toast.error(value);
    }
  };

  return (
    <div className="admin-acct relative" ref={rootRef}>
      <button
        type="button"
        className={`admin-hdr-avatar-btn${open ? ' is-open' : ''}${impersonating ? ' is-impersonating' : ''}`}
        aria-label={`${t('account')} · ${name} · ${role}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`${name} · ${role}`}
        onClick={() => {
          if (open) {
            closeMenu();
            return;
          }
          setPanel(null);
          setOpen(true);
        }}
      >
        <span className="admin-hdr-avatar-ring" aria-hidden>
          <span
            className={`admin-hdr-avatar-core${impersonating ? ' is-impersonating' : ''}`}
          >
            {initials}
          </span>
        </span>
        {!impersonating ? <span className="admin-hdr-online" aria-hidden /> : null}
      </button>

      {open ? (
        <div
          role="menu"
          className={`admin-acct-menu${panel ? ' is-panel' : ''}`}
          aria-label={t('account')}
        >
          {panel ? (
            <AdminAccountInlinePanel
              open
              focus={panel}
              onBack={() => setPanel(null)}
              onProfileSaved={(nextName) => {
                if (nextName) setDisplayName(nextName);
              }}
            />
          ) : (
            <>
              <div className="admin-acct-identity">
                <span
                  className={`admin-acct-avatar${impersonating ? ' is-impersonating' : ''}`}
                  aria-hidden
                >
                  {initials}
                </span>
                <div className="admin-acct-identity-text">
                  <p className="admin-acct-name">{name}</p>
                  {email ? (
                    <button
                      type="button"
                      className="admin-acct-email"
                      title={t('copy_email')}
                      onClick={copyEmail}
                    >
                      {email}
                    </button>
                  ) : (
                    <p className="admin-acct-email is-static">{t('signed_in_admin')}</p>
                  )}
                  <span
                    className={`admin-acct-role${impersonating ? ' is-impersonating' : ''}`}
                  >
                    <span className="material-symbols-outlined" aria-hidden>
                      {impersonating ? 'visibility' : 'verified_user'}
                    </span>
                    {role}
                  </span>
                </div>
              </div>

              <div className="admin-acct-section" role="group" aria-label={t('account')}>
                <button
                  ref={firstItemRef}
                  type="button"
                  role="menuitem"
                  className="admin-acct-item"
                  onClick={() => setPanel('account')}
                >
                  <span className="admin-acct-item-icon is-mint" aria-hidden>
                    <span className="material-symbols-outlined">manage_accounts</span>
                  </span>
                  <span className="admin-acct-item-body">
                    <span className="admin-acct-item-label">{t('my_account')}</span>
                    <span className="admin-acct-item-hint">{t('my_account_hint')}</span>
                  </span>
                  <span className="material-symbols-outlined admin-acct-chevron" aria-hidden>
                    chevron_right
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="admin-acct-item"
                  onClick={() => setPanel('security')}
                >
                  <span className="admin-acct-item-icon" aria-hidden>
                    <span className="material-symbols-outlined">lock</span>
                  </span>
                  <span className="admin-acct-item-body">
                    <span className="admin-acct-item-label">{t('security')}</span>
                    <span className="admin-acct-item-hint">{t('security_hint')}</span>
                  </span>
                  <span className="material-symbols-outlined admin-acct-chevron" aria-hidden>
                    chevron_right
                  </span>
                </button>
              </div>

              {impersonating ? (
                <div className="admin-acct-section">
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-acct-item is-warn"
                    onClick={exitImpersonation}
                  >
                    <span className="admin-acct-item-icon is-warn" aria-hidden>
                      <span className="material-symbols-outlined">switch_account</span>
                    </span>
                    <span className="admin-acct-item-body">
                      <span className="admin-acct-item-label">{t('exit_impersonation')}</span>
                      <span className="admin-acct-item-hint">{t('back_super')}</span>
                    </span>
                  </button>
                </div>
              ) : null}

              <div className="admin-acct-footer">
                <button
                  type="button"
                  role="menuitem"
                  className="admin-acct-item is-danger"
                  onClick={logout}
                >
                  <span className="admin-acct-item-icon is-danger" aria-hidden>
                    <span className="material-symbols-outlined">logout</span>
                  </span>
                  <span className="admin-acct-item-body">
                    <span className="admin-acct-item-label">{t('logout')}</span>
                    <span className="admin-acct-item-hint">{t('logout_hint')}</span>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
