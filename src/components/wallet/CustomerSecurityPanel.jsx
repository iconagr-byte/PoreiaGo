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
    <div className="max-w-2xl space-y-6">
      <section className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-level-2 p-6 md:p-8">
        <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined">shield</span>
          </span>
          Ασφάλεια λογαριασμού
        </h2>
        <p className="text-sm text-on-surface-variant mt-3 leading-relaxed">
          Ο κωδικός αποθηκεύεται στον server — λειτουργεί από οποιαδήποτε συσκευή.
        </p>

        {isGoogle && (
          <div className="mt-5 flex gap-3 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
            <span className="material-symbols-outlined text-[20px] shrink-0">info</span>
            <p>
              Συνδέεστε με <strong>Google</strong>. Μπορείτε να ορίσετε επιπλέον κωδικό email &amp; κωδικό.
            </p>
          </div>
        )}

        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-surface-container-low px-4 py-3">
            <dt className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Email</dt>
            <dd className="font-bold text-on-surface mt-1 break-all">{email}</dd>
          </div>
          <div className="rounded-2xl bg-surface-container-low px-4 py-3">
            <dt className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Κωδικός email</dt>
            <dd className="font-bold text-on-surface mt-1">
              {hasPassword === null ? '…' : passwordSet ? 'Ορισμένος' : 'Δεν έχει οριστεί'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-level-2 p-6 md:p-8">
        <h3 className="text-lg font-bold text-on-surface mb-1">
          {passwordSet ? 'Αλλαγή κωδικού' : 'Ορισμός κωδικού'}
        </h3>
        <p className="text-sm text-on-surface-variant mb-6">
          {passwordSet
            ? 'Εισάγετε τον τρέχοντα κωδικό και τον νέο.'
            : 'Ορίστε κωδικό για σύνδεση με email.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {passwordSet && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-on-surface" htmlFor="sec-current">
                Τρέχων κωδικός
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg">
                  lock
                </span>
                <input
                  id="sec-current"
                  type="password"
                  autoComplete="current-password"
                  value={form.current}
                  onChange={handleChange('current')}
                  className="w-full pl-12 pr-4 py-3.5 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container"
                  required={passwordSet}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-bold text-on-surface" htmlFor="sec-next">
              {passwordSet ? 'Νέος κωδικός' : 'Κωδικός'}
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg">
                key
              </span>
              <input
                id="sec-next"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={form.next}
                onChange={handleChange('next')}
                className="w-full pl-12 pr-4 py-3.5 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container"
                required
              />
            </div>
            <p className="text-xs text-on-surface-variant">Τουλάχιστον 6 χαρακτήρες</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-on-surface" htmlFor="sec-confirm">
              Επιβεβαίωση κωδικού
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg">
                key
              </span>
              <input
                id="sec-confirm"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={form.confirm}
                onChange={handleChange('confirm')}
                className="w-full pl-12 pr-4 py-3.5 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || hasPassword === null}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary-container text-white font-bold text-sm hover:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">
              {saving ? 'hourglass_empty' : 'save'}
            </span>
            {saving ? 'Αποθήκευση…' : passwordSet ? 'Αλλαγή κωδικού' : 'Ορισμός κωδικού'}
          </button>
        </form>
      </section>
    </div>
  );
}
