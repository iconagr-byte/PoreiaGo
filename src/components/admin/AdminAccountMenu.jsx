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
import AdminAccountSecurityModal from './AdminAccountSecurityModal.jsx';
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
 * Header account chip + menu — settings, account/security, logout.
 * onOpenSettings(subTab?) opens the settings hub (default: office «platform»).
 */
export default function AdminAccountMenu({ onOpenSettings } = {}) {
  const { t } = useUiLang();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const firstItemRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const email = useMemo(() => getSaasUserEmail(), [open]);
  const name = displayNameFromEmail(email, t('role_admin'));
  const initials = initialsFromEmail(email);
  const role = roleLabel(t);
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
    const focusTimer = window.setTimeout(() => {
      firstItemRef.current?.focus?.();
    }, 30);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
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
      toast.success(t('back_super'));
      window.location.assign('/admin?tab=settings&sub=tenants');
    }
  };

  const goSettings = (subTab = 'platform') => {
    setOpen(false);
    if (typeof onOpenSettings === 'function') {
      onOpenSettings(subTab);
      return;
    }
    navigate(`/admin?tab=settings&sub=${encodeURIComponent(subTab)}`);
  };

  const openSecurity = () => {
    setOpen(false);
    setSecurityOpen(true);
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
    <>
      <div className="admin-acct relative" ref={rootRef}>
        <button
          type="button"
          className={`admin-hdr-avatar-btn${open ? ' is-open' : ''}${impersonating ? ' is-impersonating' : ''}`}
          aria-label={`${t('account')} · ${name} · ${role}`}
          aria-expanded={open}
          aria-haspopup="menu"
          title={`${name} · ${role}`}
          onClick={() => setOpen((v) => !v)}
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
          <div role="menu" className="admin-acct-menu" aria-label={t('account')}>
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

            <div className="admin-acct-section" role="group" aria-label={t('account_section')}>
              <p className="admin-acct-section-label">{t('account_section')}</p>
              <button
                ref={firstItemRef}
                type="button"
                role="menuitem"
                className="admin-acct-item"
                onClick={() => goSettings('platform')}
              >
                <span className="admin-acct-item-icon" aria-hidden>
                  <span className="material-symbols-outlined">settings</span>
                </span>
                <span className="admin-acct-item-body">
                  <span className="admin-acct-item-label">{t('settings')}</span>
                  <span className="admin-acct-item-hint">{t('settings_hint')}</span>
                </span>
                <span className="material-symbols-outlined admin-acct-chevron" aria-hidden>
                  chevron_right
                </span>
              </button>
            </div>

            <div className="admin-acct-section" role="group" aria-label={t('security_section')}>
              <p className="admin-acct-section-label">{t('security_section')}</p>
              <button
                type="button"
                role="menuitem"
                className="admin-acct-item"
                onClick={openSecurity}
              >
                <span className="admin-acct-item-icon is-mint" aria-hidden>
                  <span className="material-symbols-outlined">shield</span>
                </span>
                <span className="admin-acct-item-body">
                  <span className="admin-acct-item-label">{t('security')}</span>
                  <span className="admin-acct-item-hint">{t('security_hint')}</span>
                </span>
                <span className="material-symbols-outlined admin-acct-chevron" aria-hidden>
                  chevron_right
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="admin-acct-item"
                onClick={() => goSettings('logins')}
              >
                <span className="admin-acct-item-icon" aria-hidden>
                  <span className="material-symbols-outlined">login</span>
                </span>
                <span className="admin-acct-item-body">
                  <span className="admin-acct-item-label">{t('security_logins')}</span>
                  <span className="admin-acct-item-hint">{t('security_logins_hint')}</span>
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
          </div>
        ) : null}
      </div>

      <AdminAccountSecurityModal
        open={securityOpen}
        onClose={() => setSecurityOpen(false)}
        onNavigateSettings={goSettings}
      />
    </>
  );
}
