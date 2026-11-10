import { useEffect, useId, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getAuthProvider,
  getCustomerId,
  getCustomerName,
  getCustomerPhone,
  getCustomerPicture,
  getCustomerToken,
} from '../../lib/auth.js';
import { getWalletTenantId } from '../../lib/wallet/walletTenantSeal.js';
import {
  changeCustomerEmailApi,
  changeCustomerPasswordApi,
  fetchCustomerMe,
} from '../../services/customerAuthApi.js';
import {
  getWalletDeviceSecurity,
  isBiometricsAvailable,
  setQuickLoginEnabled,
  setWalletPin,
} from '../../lib/wallet/walletDeviceSecurity.js';

const ACTIONS = [
  {
    id: 'quick',
    icon: 'lock_open',
    tone: 'is-mint',
    label: 'Γρήγορη σύνδεση',
    hint: 'Είσοδος με PIN σε αυτή τη συσκευή',
  },
  {
    id: 'pin',
    icon: 'pin',
    tone: '',
    label: 'PIN συσκευής',
    hint: 'Απαιτείται για Γρήγορη σύνδεση',
  },
  {
    id: 'password',
    icon: 'lock',
    tone: 'is-sunset',
    label: 'Αλλαγή κωδικού πρόσβασης',
    hint: 'Κωδικός σύνδεσης στον server',
  },
  {
    id: 'email',
    icon: 'alternate_email',
    tone: '',
    label: 'Αλλαγή email',
    hint: 'Νέο email σύνδεσης My Wallet',
  },
];

function currentSessionSnapshot() {
  return {
    accessToken: getCustomerToken(),
    name: getCustomerName(),
    picture: getCustomerPicture(),
    provider: getAuthProvider() || 'email',
    phone: getCustomerPhone(),
    customerId: getCustomerId(),
    tenantId: getWalletTenantId(),
  };
}

export default function CustomerSecurityPanel({
  email,
  authProvider,
  initialAction = null,
  onEmailChanged,
}) {
  const baseId = useId();
  const isGoogle = authProvider === 'google';
  const [openAction, setOpenAction] = useState(
    initialAction === 'biometrics' ? 'quick' : initialAction || null,
  );
  const [hasPassword, setHasPassword] = useState(null);
  const [deviceSec, setDeviceSec] = useState(() => getWalletDeviceSecurity(email));
  const [saving, setSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [emailForm, setEmailForm] = useState({ next: '', password: '' });
  const [pinForm, setPinForm] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    setDeviceSec(getWalletDeviceSecurity(email));
  }, [email]);

  useEffect(() => {
    if (!initialAction) return;
    setOpenAction(initialAction === 'biometrics' ? 'quick' : initialAction);
  }, [initialAction]);

  useEffect(() => {
    fetchCustomerMe()
      .then((me) => setHasPassword(Boolean(me.has_password)))
      .catch(() => setHasPassword(false));
  }, [email]);

  const passwordSet = hasPassword === true;
  const quickOn = Boolean(deviceSec.quickLoginEnabled || deviceSec.biometricsEnabled);
  const biometricsOk = isBiometricsAvailable();

  const toggleAction = (id) => {
    setOpenAction((prev) => (prev === id ? null : id));
  };

  const handleQuickLoginToggle = async () => {
    try {
      const next = !quickOn;
      if (next && !deviceSec.hasPin) {
        toast.error('Ορίστε πρώτα PIN για τη Γρήγορη σύνδεση');
        setOpenAction('pin');
        return;
      }
      const updated = await setQuickLoginEnabled(
        email,
        next,
        next ? currentSessionSnapshot() : null,
      );
      setDeviceSec(updated);
      toast.success(
        next
          ? 'Γρήγορη σύνδεση ενεργή — είσοδος με PIN σε αυτή τη συσκευή'
          : 'Η Γρήγορη σύνδεση απενεργοποιήθηκε',
      );
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
      if (/PIN/i.test(String(err?.message || ''))) setOpenAction('pin');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('Οι νέοι κωδικοί δεν ταιριάζουν');
      return;
    }
    setSaving(true);
    try {
      await changeCustomerPasswordApi({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      });
      setPasswordForm({ current: '', next: '', confirm: '' });
      setHasPassword(true);
      toast.success('Ο κωδικός ενημερώθηκε — ισχύει σε όλες τις συσκευές');
      setOpenAction(null);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αλλαγής κωδικού');
    } finally {
      setSaving(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const nextEmail = String(emailForm.next || '').trim().toLowerCase();
    if (!nextEmail || !nextEmail.includes('@')) {
      toast.error('Εισάγετε έγκυρο νέο email');
      return;
    }
    setSaving(true);
    try {
      const profile = await changeCustomerEmailApi({
        newEmail: nextEmail,
        currentPassword: emailForm.password,
      });
      setEmailForm({ next: '', password: '' });
      toast.success('Το email ενημερώθηκε');
      setOpenAction(null);
      onEmailChanged?.(profile);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αλλαγής email');
    } finally {
      setSaving(false);
    }
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (pinForm.next !== pinForm.confirm) {
      toast.error('Τα νέα PIN δεν ταιριάζουν');
      return;
    }
    setSaving(true);
    try {
      const updated = await setWalletPin(email, {
        currentPin: pinForm.current,
        newPin: pinForm.next,
        session: currentSessionSnapshot(),
      });
      setDeviceSec(updated);
      setPinForm({ current: '', next: '', confirm: '' });
      toast.success(
        deviceSec.hasPin
          ? 'Το PIN ενημερώθηκε — Γρήγορη σύνδεση ενεργή'
          : 'Το PIN ορίστηκε — Γρήγορη σύνδεση ενεργή στην πλατφόρμα',
      );
      setOpenAction(null);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης PIN');
    } finally {
      setSaving(false);
    }
  };

  const actionStatus = (id) => {
    if (id === 'quick') {
      return quickOn && deviceSec.hasPin ? 'Ενεργή' : quickOn ? 'Χρειάζεται PIN' : 'Ανενεργή';
    }
    if (id === 'pin') {
      return deviceSec.hasPin ? 'Ορισμένο' : 'Δεν έχει οριστεί';
    }
    if (id === 'password') {
      if (hasPassword === null) return '…';
      return passwordSet ? 'Ορισμένος' : 'Δεν έχει οριστεί';
    }
    if (id === 'email') return email || '—';
    return '';
  };

  return (
    <section className="wallet-panel" id="wallet-security">
      <div className="wallet-panel-head">
        <span className="wallet-panel-head-icon is-mint" aria-hidden>
          <span className="material-symbols-outlined">shield</span>
        </span>
        <div>
          <h2>Ασφάλεια λογαριασμού</h2>
          <p>Γρήγορη σύνδεση με PIN, κωδικός και email.</p>
        </div>
      </div>

      {isGoogle ? (
        <div className="wallet-notice wallet-notice-info" style={{ marginBottom: '0.85rem' }}>
          <span className="material-symbols-outlined">info</span>
          <p>
            Συνδέεστε με <strong>Google</strong>. Μπορείτε να ορίσετε επιπλέον κωδικό για αλλαγή
            email / σύνδεση με email.
          </p>
        </div>
      ) : null}

      <div className="wallet-account-rows" role="list">
        {ACTIONS.map((action) => {
          const expanded = openAction === action.id;
          const status = actionStatus(action.id);
          return (
            <div key={action.id} role="listitem">
              <button
                type="button"
                className={`wallet-account-row wallet-account-row--action${
                  expanded ? ' is-open' : ''
                }`}
                aria-expanded={expanded}
                aria-controls={`${baseId}-${action.id}`}
                onClick={() => {
                  if (action.id === 'quick') {
                    handleQuickLoginToggle();
                    return;
                  }
                  toggleAction(action.id);
                }}
              >
                <span className={`wallet-account-row-icon ${action.tone}`.trim()} aria-hidden>
                  <span className="material-symbols-outlined">{action.icon}</span>
                </span>
                <div className="wallet-account-row-body">
                  <span className="wallet-account-row-label">{action.label}</span>
                  <span className="wallet-account-row-value">{status}</span>
                  <span className="wallet-account-row-hint">{action.hint}</span>
                </div>
                <span className="material-symbols-outlined wallet-account-row-chevron" aria-hidden>
                  {action.id === 'quick'
                    ? quickOn && deviceSec.hasPin
                      ? 'toggle_on'
                      : 'toggle_off'
                    : expanded
                      ? 'expand_less'
                      : 'chevron_right'}
                </span>
              </button>

              {expanded && action.id === 'password' ? (
                <form
                  id={`${baseId}-password`}
                  className="wallet-security-drawer wallet-form"
                  onSubmit={handlePasswordSubmit}
                >
                  <p className="wallet-panel-lead">
                    {passwordSet
                      ? 'Εισάγετε τον τρέχοντα κωδικό και τον νέο.'
                      : 'Ορίστε κωδικό για σύνδεση με email.'}
                  </p>
                  {passwordSet ? (
                    <div className="wallet-field">
                      <label htmlFor={`${baseId}-pw-cur`}>Τρέχων κωδικός</label>
                      <input
                        id={`${baseId}-pw-cur`}
                        type="password"
                        autoComplete="current-password"
                        value={passwordForm.current}
                        onChange={(e) =>
                          setPasswordForm((p) => ({ ...p, current: e.target.value }))
                        }
                        className="wallet-input"
                        required
                      />
                    </div>
                  ) : null}
                  <div className="wallet-field">
                    <label htmlFor={`${baseId}-pw-next`}>
                      {passwordSet ? 'Νέος κωδικός' : 'Κωδικός'}
                    </label>
                    <input
                      id={`${baseId}-pw-next`}
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      value={passwordForm.next}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
                      className="wallet-input"
                      required
                    />
                    <p className="wallet-field-hint">Τουλάχιστον 6 χαρακτήρες</p>
                  </div>
                  <div className="wallet-field">
                    <label htmlFor={`${baseId}-pw-confirm`}>Επιβεβαίωση κωδικού</label>
                    <input
                      id={`${baseId}-pw-confirm`}
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      value={passwordForm.confirm}
                      onChange={(e) =>
                        setPasswordForm((p) => ({ ...p, confirm: e.target.value }))
                      }
                      className="wallet-input"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving || hasPassword === null}
                    className="wallet-btn wallet-btn-primary wallet-btn-block"
                  >
                    {saving ? 'Αποθήκευση…' : passwordSet ? 'Αλλαγή κωδικού' : 'Ορισμός κωδικού'}
                  </button>
                </form>
              ) : null}

              {expanded && action.id === 'email' ? (
                <form
                  id={`${baseId}-email`}
                  className="wallet-security-drawer wallet-form"
                  onSubmit={handleEmailSubmit}
                >
                  {!passwordSet ? (
                    <div className="wallet-notice wallet-notice-info">
                      <span className="material-symbols-outlined">info</span>
                      <p>Ορίστε πρώτα κωδικό πρόσβασης, μετά αλλάξτε το email.</p>
                    </div>
                  ) : null}
                  <div className="wallet-field">
                    <label htmlFor={`${baseId}-em-next`}>Νέο email</label>
                    <input
                      id={`${baseId}-em-next`}
                      type="email"
                      autoComplete="email"
                      value={emailForm.next}
                      onChange={(e) => setEmailForm((p) => ({ ...p, next: e.target.value }))}
                      className="wallet-input"
                      required
                      disabled={!passwordSet}
                    />
                  </div>
                  <div className="wallet-field">
                    <label htmlFor={`${baseId}-em-pw`}>Τρέχων κωδικός</label>
                    <input
                      id={`${baseId}-em-pw`}
                      type="password"
                      autoComplete="current-password"
                      value={emailForm.password}
                      onChange={(e) =>
                        setEmailForm((p) => ({ ...p, password: e.target.value }))
                      }
                      className="wallet-input"
                      required
                      disabled={!passwordSet}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving || !passwordSet}
                    className="wallet-btn wallet-btn-primary wallet-btn-block"
                  >
                    {saving ? 'Αποθήκευση…' : 'Αλλαγή email'}
                  </button>
                </form>
              ) : null}

              {expanded && action.id === 'pin' ? (
                <form
                  id={`${baseId}-pin`}
                  className="wallet-security-drawer wallet-form"
                  onSubmit={handlePinSubmit}
                >
                  <p className="wallet-panel-lead">
                    Το PIN ενεργοποιεί τη Γρήγορη σύνδεση σε αυτή τη συσκευή. Μετά την αποσύνδεση
                    θα μπορείτε να μπείτε με το PIN αντί για κωδικό.
                  </p>
                  {deviceSec.hasPin ? (
                    <div className="wallet-field">
                      <label htmlFor={`${baseId}-pin-cur`}>Τρέχον PIN</label>
                      <input
                        id={`${baseId}-pin-cur`}
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={6}
                        value={pinForm.current}
                        onChange={(e) =>
                          setPinForm((p) => ({ ...p, current: e.target.value.replace(/\D/g, '') }))
                        }
                        className="wallet-input"
                        required
                      />
                    </div>
                  ) : null}
                  <div className="wallet-field">
                    <label htmlFor={`${baseId}-pin-next`}>
                      {deviceSec.hasPin ? 'Νέο PIN' : 'PIN (4–6 ψηφία)'}
                    </label>
                    <input
                      id={`${baseId}-pin-next`}
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      value={pinForm.next}
                      onChange={(e) =>
                        setPinForm((p) => ({ ...p, next: e.target.value.replace(/\D/g, '') }))
                      }
                      className="wallet-input"
                      required
                    />
                  </div>
                  <div className="wallet-field">
                    <label htmlFor={`${baseId}-pin-confirm`}>Επιβεβαίωση PIN</label>
                    <input
                      id={`${baseId}-pin-confirm`}
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      value={pinForm.confirm}
                      onChange={(e) =>
                        setPinForm((p) => ({
                          ...p,
                          confirm: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      className="wallet-input"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="wallet-btn wallet-btn-primary wallet-btn-block"
                  >
                    {saving
                      ? 'Αποθήκευση…'
                      : deviceSec.hasPin
                        ? 'Αλλαγή PIN'
                        : 'Ορισμός PIN & ενεργοποίηση'}
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>

      {!biometricsOk ? (
        <p className="wallet-field-hint" style={{ marginTop: '0.75rem' }}>
          Η Γρήγορη σύνδεση χρησιμοποιεί PIN σε αυτή τη συσκευή. Face ID / δακτυλικό θα προστεθεί
          όταν είναι διαθέσιμο στο native app.
        </p>
      ) : null}
    </section>
  );
}
