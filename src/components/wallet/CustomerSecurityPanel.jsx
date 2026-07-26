import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  changeCustomerPasswordApi,
  fetchCustomerMe,
} from '../../services/customerAuthApi.js';

export default function CustomerSecurityPanel({ email, authProvider }) {
  const isGoogle = authProvider === 'google';
  const [form, setForm] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [saving, setSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);

  useEffect(() => {
    fetchCustomerMe()
      .then((me) => setHasPassword(Boolean(me.has_password)))
      .catch(() => setHasPassword(false));
  }, [email]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) {
      toast.error('Οι νέοι κωδικοί δεν ταιριάζουν');
      return;
    }
    setSaving(true);
    try {
      await changeCustomerPasswordApi({
        currentPassword: form.current,
        newPassword: form.next,
      });
      setForm({ current: '', next: '', confirm: '' });
      setHasPassword(true);
      toast.success('Ο κωδικός ενημερώθηκε — ισχύει σε όλες τις συσκευές');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αλλαγής κωδικού');
    } finally {
      setSaving(false);
    }
  };

  const passwordSet = hasPassword === true;

  return (
    <>
      <section className="wallet-panel">
        <div className="wallet-panel-head">
          <span className="wallet-panel-head-icon" aria-hidden>
            <span className="material-symbols-outlined">shield</span>
          </span>
          <div>
            <h2>Ασφάλεια λογαριασμού</h2>
            <p>Ο κωδικός αποθηκεύεται στον server — λειτουργεί από οποιαδήποτε συσκευή.</p>
          </div>
        </div>

        {isGoogle ? (
          <div className="wallet-notice wallet-notice-info" style={{ marginBottom: '1rem' }}>
            <span className="material-symbols-outlined">info</span>
            <p>
              Συνδέεστε με <strong>Google</strong>. Μπορείτε να ορίσετε επιπλέον κωδικό email &amp;
              κωδικό.
            </p>
          </div>
        ) : null}

        <dl className="wallet-meta-grid">
          <div className="wallet-meta-tile">
            <dt>Email</dt>
            <dd>{email}</dd>
          </div>
          <div className="wallet-meta-tile">
            <dt>Κωδικός email</dt>
            <dd>{hasPassword === null ? '…' : passwordSet ? 'Ορισμένος' : 'Δεν έχει οριστεί'}</dd>
          </div>
        </dl>
      </section>

      <section className="wallet-panel">
        <h2>{passwordSet ? 'Αλλαγή κωδικού' : 'Ορισμός κωδικού'}</h2>
        <p className="wallet-panel-lead">
          {passwordSet
            ? 'Εισάγετε τον τρέχοντα κωδικό και τον νέο.'
            : 'Ορίστε κωδικό για σύνδεση με email.'}
        </p>

        <form onSubmit={handleSubmit} className="wallet-form">
          {passwordSet ? (
            <div className="wallet-field">
              <label htmlFor="sec-current">Τρέχων κωδικός</label>
              <div className="wallet-input-icon-wrap">
                <span className="material-symbols-outlined">lock</span>
                <input
                  id="sec-current"
                  type="password"
                  autoComplete="current-password"
                  value={form.current}
                  onChange={handleChange('current')}
                  className="wallet-input"
                  required={passwordSet}
                />
              </div>
            </div>
          ) : null}

          <div className="wallet-field">
            <label htmlFor="sec-next">{passwordSet ? 'Νέος κωδικός' : 'Κωδικός'}</label>
            <div className="wallet-input-icon-wrap">
              <span className="material-symbols-outlined">key</span>
              <input
                id="sec-next"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={form.next}
                onChange={handleChange('next')}
                className="wallet-input"
                required
              />
            </div>
            <p className="wallet-field-hint">Τουλάχιστον 6 χαρακτήρες</p>
          </div>

          <div className="wallet-field">
            <label htmlFor="sec-confirm">Επιβεβαίωση κωδικού</label>
            <div className="wallet-input-icon-wrap">
              <span className="material-symbols-outlined">key</span>
              <input
                id="sec-confirm"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={form.confirm}
                onChange={handleChange('confirm')}
                className="wallet-input"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || hasPassword === null}
            className="wallet-btn wallet-btn-primary wallet-btn-block"
          >
            <span className="material-symbols-outlined text-[18px]">
              {saving ? 'hourglass_empty' : 'save'}
            </span>
            {saving ? 'Αποθήκευση…' : passwordSet ? 'Αλλαγή κωδικού' : 'Ορισμός κωδικού'}
          </button>
        </form>
      </section>
    </>
  );
}
