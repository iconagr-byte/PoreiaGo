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
 * Inline account / security form for the header dropdown (no separate modal window).
 * focus: 'account' shows name + optional password; 'security' focuses password change.
 */
export default function AdminAccountInlinePanel({
  open,
  focus = 'account',
  onBack,
  onProfileSaved,
}) {
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
  const securityFocus = focus === 'security';

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setPassword('');
    setPassword2('');
    setShowPassword(false);
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
  }, [open, email, jwtSub, isSuper, focus]);

  if (!open) return null;

  const saveProfile = async () => {
    const nextName = name.trim();
    const pwd = password.trim();
    const uid = userId || jwtSub;
    if (!uid) {
      toast.error(t('security_reset_unavailable'));
      return;
    }
    if (!securityFocus && nextName.length < 2) {
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
    const nameDirty = !securityFocus && nextName !== savedName.trim();
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
      if (nameDirty) {
        setSavedName(nextName);
        onProfileSaved?.(nextName);
      }
      setPassword('');
      setPassword2('');
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
    <div className="admin-acct-panel" role="group" aria-label={securityFocus ? t('security') : t('my_account')}>
      <div className="admin-acct-panel-head">
        <button
          type="button"
          className="admin-acct-panel-back"
          onClick={onBack}
          aria-label={t('close')}
        >
          <span className="material-symbols-outlined" aria-hidden>
            chevron_left
          </span>
          <span>{t('account')}</span>
        </button>
        <p className="admin-acct-panel-title">{securityFocus ? t('security') : t('my_account')}</p>
      </div>

      <div className="admin-acct-panel-body">
        {loading ? (
          <p className="admin-acct-panel-loading">{t('loading')}</p>
        ) : (
          <>
            <div className="admin-acct-panel-card">
              <p className="admin-acct-panel-card-label">{t('security_signed_in')}</p>
              <p className="admin-acct-panel-card-value">{email || t('signed_in_admin')}</p>
              <p className="admin-acct-panel-card-meta">{role}</p>
              {expires ? (
                <p className="admin-acct-panel-card-meta">
                  {t('security_session_until')}: {expires}
                </p>
              ) : null}
            </div>

            {!securityFocus ? (
              <label className="admin-acct-field">
                <span className="admin-acct-field-label">{t('account_display_name')}</span>
                <input
                  className="admin-acct-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('account_display_name_ph')}
                  disabled={busy}
                  autoComplete="name"
                />
              </label>
            ) : null}

            <div className="admin-acct-password-block">
              <p className="admin-acct-field-label">{t('security_change_password')}</p>
              <label className="admin-acct-field">
                <span className="admin-acct-field-label is-soft">{t('account_new_password')}</span>
                <div className="admin-acct-password-row">
                  <input
                    className="admin-acct-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={busy}
                    autoComplete="new-password"
                    autoFocus={securityFocus}
                  />
                  <button
                    type="button"
                    className="admin-acct-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('hide_password') : t('show_password')}
                    aria-pressed={showPassword}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined" aria-hidden>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </label>
              <label className="admin-acct-field">
                <span className="admin-acct-field-label is-soft">{t('account_confirm_password')}</span>
                <input
                  className="admin-acct-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="••••••••"
                  disabled={busy}
                  autoComplete="new-password"
                />
              </label>
              <p className="admin-acct-field-hint">{t('account_password_hint')}</p>
            </div>

            <div className="admin-acct-panel-actions">
              <button
                type="button"
                className="admin-acct-btn is-primary"
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
                className="admin-acct-btn is-ghost"
                disabled={busy}
                onClick={requestPasswordReset}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  mail
                </span>
                {t('security_email_reset')}
              </button>
              <p className="admin-acct-field-hint">{t('security_change_password_hint')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
