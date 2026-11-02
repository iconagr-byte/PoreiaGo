import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  canAccessPlatformOperatorUi,
  decodeJwtPayload,
  getSaasRoles,
  isImpersonating,
} from '../../lib/saasJwt.js';
import {
  getSaasTenantId,
  getSaasToken,
  getSaasUserEmail,
} from '../../services/saasApi.js';
import {
  sendAdminPasswordResetByEmail,
  sendPlatformUserPasswordReset,
} from '../../services/platformApi.js';
import { useUiLang } from '../../hooks/useUiLang.js';
import '../../styles/office-logo-modal.css';
import '../../styles/admin-header-icons.css';

function roleLabel(t) {
  if (isImpersonating()) return t('role_impersonation');
  if (canAccessPlatformOperatorUi()) return t('role_super');
  const roles = getSaasRoles();
  if (roles.includes('tenant_admin')) return t('role_office_admin');
  if (roles.includes('agent')) return t('role_agent');
  return t('role_admin');
}

function sessionExpiryLabel() {
  const payload = decodeJwtPayload(getSaasToken());
  if (!payload?.exp) return null;
  try {
    return new Date(payload.exp * 1000).toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

/**
 * Account + security sheet — password reset for self, session info, shortcuts.
 */
export default function AdminAccountSecurityModal({ open, onClose, onNavigateSettings }) {
  const { t } = useUiLang();
  const [busy, setBusy] = useState(false);
  const email = getSaasUserEmail();
  const tenantId = getSaasTenantId();
  const payload = decodeJwtPayload(getSaasToken());
  const userId = payload?.sub ? String(payload.sub) : '';
  const expires = sessionExpiryLabel();
  const role = roleLabel(t);
  const isSuper = canAccessPlatformOperatorUi();

  if (!open) return null;

  const go = (sub) => {
    onClose?.();
    onNavigateSettings?.(sub);
  };

  const requestPasswordReset = async () => {
    if (!email) {
      toast.error(t('security_no_email'));
      return;
    }
    setBusy(true);
    try {
      if (isSuper) {
        await sendAdminPasswordResetByEmail({ email, tenantId: tenantId || undefined });
      } else if (userId) {
        await sendPlatformUserPasswordReset(userId);
      } else {
        throw new Error(t('security_reset_unavailable'));
      }
      toast.success(t('security_reset_sent'));
    } catch (err) {
      toast.error(err.message || t('security_reset_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="olm-root" role="dialog" aria-modal="true" aria-label={t('security')}>
      <button type="button" className="olm-backdrop" aria-label={t('close')} onClick={onClose} />
      <div className="olm-panel admin-sec-panel">
        <header className="olm-header">
          <div>
            <p className="olm-kicker">{t('account')}</p>
            <h2 className="olm-title">{t('security')}</h2>
            <p className="olm-subtitle">{t('security_subtitle')}</p>
          </div>
          <button type="button" className="olm-close" onClick={onClose} aria-label={t('close')}>
            <span className="material-symbols-outlined" aria-hidden>
              close
            </span>
          </button>
        </header>

        <div className="olm-body admin-sec-body">
          <div className="admin-sec-card">
            <p className="admin-sec-card-label">{t('security_signed_in')}</p>
            <p className="admin-sec-card-value">{email || t('signed_in_admin')}</p>
            <p className="admin-sec-card-meta">
              {role}
              {tenantId ? ` · ${String(tenantId).slice(0, 8)}…` : ''}
            </p>
            {expires ? (
              <p className="admin-sec-card-meta">
                {t('security_session_until')}: {expires}
              </p>
            ) : null}
          </div>

          <div className="admin-sec-actions">
            <button
              type="button"
              className="olm-btn olm-btn--primary"
              disabled={busy}
              onClick={requestPasswordReset}
            >
              <span className="material-symbols-outlined" aria-hidden>
                lock_reset
              </span>
              {busy ? t('security_sending') : t('security_change_password')}
            </button>
            <p className="olm-field-hint">{t('security_change_password_hint')}</p>
          </div>

          <div className="admin-acct-section admin-sec-links">
            <button type="button" className="admin-acct-item" onClick={() => go('logins')}>
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
            <button type="button" className="admin-acct-item" onClick={() => go('compliance')}>
              <span className="admin-acct-item-icon is-mint" aria-hidden>
                <span className="material-symbols-outlined">shield</span>
              </span>
              <span className="admin-acct-item-body">
                <span className="admin-acct-item-label">{t('security_gdpr')}</span>
                <span className="admin-acct-item-hint">{t('security_gdpr_hint')}</span>
              </span>
              <span className="material-symbols-outlined admin-acct-chevron" aria-hidden>
                chevron_right
              </span>
            </button>
            {isSuper ? (
              <button type="button" className="admin-acct-item" onClick={() => go('password_reset')}>
                <span className="admin-acct-item-icon is-warn" aria-hidden>
                  <span className="material-symbols-outlined">key</span>
                </span>
                <span className="admin-acct-item-body">
                  <span className="admin-acct-item-label">{t('security_admin_passwords')}</span>
                  <span className="admin-acct-item-hint">{t('security_admin_passwords_hint')}</span>
                </span>
                <span className="material-symbols-outlined admin-acct-chevron" aria-hidden>
                  chevron_right
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
