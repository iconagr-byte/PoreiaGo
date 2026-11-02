import { useEffect, useState } from 'react';
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
  setSaasSession,
} from '../../services/saasApi.js';
import {
  fetchPlatformUsers,
  sendAdminPasswordResetByEmail,
  sendPlatformUserPasswordReset,
  updatePlatformUser,
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

function displayNameFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  if (!local) return '';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
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
 * User-only account sheet: edit display name + change password (direct or email link).
 */
export default function AdminAccountSecurityModal({ open, onClose, onProfileSaved }) {
  const { t } = useUiLang();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const email = getSaasUserEmail();
  const tenantId = getSaasTenantId();
  const payload = decodeJwtPayload(getSaasToken());
  const jwtSub = payload?.sub ? String(payload.sub) : '';
  const expires = sessionExpiryLabel();
  const role = roleLabel(t);
  const isSuper = canAccessPlatformOperatorUi();

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setPassword('');
    setPassword2('');
    (async () => {
      try {
        const list = await fetchPlatformUsers({ allOffices: isSuper });
        const users = Array.isArray(list) ? list : list?.users || [];
        const me =
          users.find((u) => String(u.id) === jwtSub) ||
          users.find((u) => String(u.email || '').toLowerCase() === email.toLowerCase()) ||
          null;
        if (cancelled) return;
        const nextName = String(me?.name || displayNameFromEmail(email) || '').trim();
        setUserId(me?.id ? String(me.id) : jwtSub);
        setName(nextName);
        setSavedName(nextName);
      } catch {
        if (!cancelled) {
          const nextName = displayNameFromEmail(email);
          setUserId(jwtSub);
          setName(nextName);
          setSavedName(nextName);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, email, jwtSub, isSuper]);

  if (!open) return null;

  const saveProfile = async () => {
    const nextName = name.trim();
    const pwd = password.trim();
    const uid = userId || jwtSub;
    if (!uid) {
      toast.error(t('security_reset_unavailable'));
      return;
    }
    if (nextName.length < 2) {
      toast.error(t('account_name_short'));
      return;
    }
    if (pwd) {
      if (pwd.length < 6) {
        toast.error(t('account_password_short'));
        return;
      }
      if (pwd !== password2.trim()) {
        toast.error(t('account_password_mismatch'));
        return;
      }
    }
    const nameDirty = nextName !== savedName.trim();
    if (!nameDirty && !pwd) {
      toast.success(t('account_nothing_to_save'));
      return;
    }
    setBusy(true);
    try {
      const patch = {};
      if (nameDirty) patch.name = nextName;
      if (pwd) patch.password = pwd;
      await updatePlatformUser(uid, patch);
      setSavedName(nextName);
      setPassword('');
      setPassword2('');
      onProfileSaved?.(nextName);
      // Keep local email session; name is derived for UI via callback.
      setSaasSession({
        accessToken: getSaasToken(),
        tenantId: getSaasTenantId(),
        email,
      });
      toast.success(pwd ? t('account_saved_with_password') : t('account_saved'));
    } catch (err) {
      toast.error(err.message || t('account_save_failed'));
    } finally {
      setBusy(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!email) {
      toast.error(t('security_no_email'));
      return;
    }
    setBusy(true);
    try {
      const uid = userId || jwtSub;
      if (isSuper) {
        await sendAdminPasswordResetByEmail({ email, tenantId: tenantId || undefined });
      } else if (uid) {
        await sendPlatformUserPasswordReset(uid);
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
    <div className="olm-root" role="dialog" aria-modal="true" aria-label={t('my_account')}>
      <button type="button" className="olm-backdrop" aria-label={t('close')} onClick={onClose} />
      <div className="olm-panel admin-sec-panel">
        <header className="olm-header">
          <div>
            <p className="olm-kicker">{t('account')}</p>
            <h2 className="olm-title">{t('my_account')}</h2>
            <p className="olm-subtitle">{t('my_account_subtitle')}</p>
          </div>
          <button type="button" className="olm-close" onClick={onClose} aria-label={t('close')}>
            <span className="material-symbols-outlined" aria-hidden>
              close
            </span>
          </button>
        </header>

        <div className="olm-body admin-sec-body">
          {loading ? (
            <p className="olm-loading">{t('loading')}</p>
          ) : (
            <>
              <div className="admin-sec-card">
                <p className="admin-sec-card-label">{t('security_signed_in')}</p>
                <p className="admin-sec-card-value">{email || t('signed_in_admin')}</p>
                <p className="admin-sec-card-meta">{role}</p>
                {expires ? (
                  <p className="admin-sec-card-meta">
                    {t('security_session_until')}: {expires}
                  </p>
                ) : null}
              </div>

              <label className="olm-field">
                <span className="olm-label">{t('account_display_name')}</span>
                <input
                  className="olm-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('account_display_name_ph')}
                  disabled={busy}
                  autoComplete="name"
                />
              </label>

              <div className="admin-sec-password-block">
                <p className="olm-label">{t('security_change_password')}</p>
                <label className="olm-field">
                  <span className="olm-label is-soft">{t('account_new_password')}</span>
                  <div className="admin-sec-password-row">
                    <input
                      className="olm-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={busy}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="admin-sec-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t('hide_password') : t('show_password')}
                    >
                      <span className="material-symbols-outlined" aria-hidden>
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </label>
                <label className="olm-field">
                  <span className="olm-label is-soft">{t('account_confirm_password')}</span>
                  <input
                    className="olm-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    placeholder="••••••••"
                    disabled={busy}
                    autoComplete="new-password"
                  />
                </label>
                <p className="olm-field-hint">{t('account_password_hint')}</p>
              </div>

              <div className="admin-sec-actions">
                <button
                  type="button"
                  className="olm-btn olm-btn--primary"
                  disabled={busy}
                  onClick={saveProfile}
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    save
                  </span>
                  {busy ? t('saving') : t('save_account')}
                </button>
                <button
                  type="button"
                  className="olm-btn olm-btn--ghost"
                  disabled={busy}
                  onClick={requestPasswordReset}
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    mail
                  </span>
                  {t('security_email_reset')}
                </button>
                <p className="olm-field-hint">{t('security_change_password_hint')}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
