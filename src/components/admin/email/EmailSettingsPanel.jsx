import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createEmailSettings,
  deleteEmailSettings,
  fetchEmailSettings,
  testEmailConnection,
  testSavedEmailConnection,
  updateEmailSettings,
} from '../../../services/emailSettingsApi.js';
import {
  downloadEmailSettingsEnvTemplate,
  downloadEmailSettingsTemplate,
  parseEmailSettingsBytes,
} from '../../../lib/email/emailSettingsImport.js';
const EMPTY = {
  label: '',
  email_address: '',
  imap_host: '',
  imap_port: 993,
  imap_secure: true,
  imap_mailbox: 'INBOX',
  imap_folder_sent: 'Sent',
  imap_folder_spam: 'Spam',
  smtp_host: '',
  smtp_port: 587,
  smtp_secure: true,
  mail_username: '',
  mail_password: '',
  is_active: true,
};

export default function EmailSettingsPanel({ onAccountChange }) {
  const [accounts, setAccounts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    try {
      const list = await fetchEmailSettings();
      setAccounts(list);
      if (list.length && onAccountChange && !localStorage.getItem('email_active_account')) {
        onAccountChange(list[0].id);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: v }));
  };

  const startNew = () => {
    setEditingId('new');
    setForm({ ...EMPTY });
    setTestResult(null);
    setPasswordVisible(false);
  };

  const startEdit = (acc) => {
    setEditingId(acc.id);
    setForm({
      ...EMPTY,
      label: acc.label,
      email_address: acc.email_address,
      imap_host: acc.imap_host,
      imap_port: acc.imap_port,
      imap_secure: acc.imap_secure,
      imap_mailbox: acc.imap_mailbox,
      imap_folder_sent: acc.imap_folder_sent,
      imap_folder_spam: acc.imap_folder_spam,
      smtp_host: acc.smtp_host,
      smtp_port: acc.smtp_port,
      smtp_secure: acc.smtp_secure,
      mail_username: acc.mail_username,
      mail_password: '',
      is_active: acc.is_active,
    });
    setTestResult(null);
    setPasswordVisible(false);
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testEmailConnection({
        ...form,
        imap_port: Number(form.imap_port),
        smtp_port: Number(form.smtp_port),
        mail_username: form.mail_username || form.email_address,
      });
      const msg = r.ok ? 'IMAP & SMTP: επιτυχής σύνδεση' : r.imap?.error || r.smtp?.error || 'Αποτυχία σύνδεσης';
      setTestResult({ ok: Boolean(r.ok), message: msg });
      if (r.ok) toast.success(msg);
      else toast.error(msg);
    } catch (err) {
      toast.error(err.message);
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const runTestSaved = async (id) => {
    setTesting(true);
    try {
      const r = await testSavedEmailConnection(id);
      if (r.ok) toast.success('Σύνδεση OK');
      else toast.error(r.imap?.error || r.smtp?.error || 'Αποτυχία');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!form.email_address || !form.imap_host || !form.smtp_host) {
      toast.error('Συμπληρώστε email, IMAP host και SMTP host');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        imap_port: Number(form.imap_port),
        smtp_port: Number(form.smtp_port),
        mail_username: form.mail_username || form.email_address,
      };
      if (editingId === 'new') {
        if (!form.mail_password) {
          toast.error('Απαιτείται κωδικός για νέο λογαριασμό');
          setSaving(false);
          return;
        }
        const created = await createEmailSettings(payload);
        toast.success('Ο λογαριασμός αποθηκεύτηκε');
        onAccountChange?.(created.id);
        localStorage.setItem('email_active_account', created.id);
      } else {
        const patch = { ...payload };
        if (!patch.mail_password) delete patch.mail_password;
        await updateEmailSettings(editingId, patch);
        toast.success('Ενημερώθηκε');
      }
      setEditingId(null);
      setTestResult(null);
      setPasswordVisible(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Διαγραφή λογαριασμού email;')) return;
    try {
      await deleteEmailSettings(id);
      toast.success('Διαγράφηκε');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const applyImportedAccount = (account) => {
    setEditingId('new');
    setForm({
      ...EMPTY,
      ...account,
      mail_password: account.mail_password || '',
    });
    setTestResult(null);
    setPasswordVisible(false);
    // Scroll the editor into view — import used to feel like a no-op above the fold.
    requestAnimationFrame(() => {
      document.getElementById('email-settings-editor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const { accounts, errors } = parseEmailSettingsBytes(buf, file.name);

      if (!accounts.length) {
        if (errors.length) errors.forEach((msg) => toast.error(msg, { duration: 6000 }));
        else toast.error('Δεν βρέθηκαν έγκυροι λογαριασμοί στο αρχείο');
        return;
      }

      // Soft warnings (e.g. missing password) — still show form when we cannot save yet.
      const softErrors = errors.filter(Boolean);

      if (accounts.length === 1) {
        const account = accounts[0];
        if (account.mail_password && account.mail_password !== 'YOUR_PASSWORD_HERE') {
          try {
            const created = await createEmailSettings({
              ...account,
              imap_port: Number(account.imap_port) || 993,
              smtp_port: Number(account.smtp_port) || 587,
              mail_username: account.mail_username || account.email_address,
            });
            toast.success('Ο λογαριασμός εισήχθη και αποθηκεύτηκε');
            onAccountChange?.(created.id);
            localStorage.setItem('email_active_account', created.id);
            setEditingId(null);
            load();
            return;
          } catch (err) {
            // Fall back to form so the user can fix and save.
            toast.error(err.message || 'Αποτυχία αποθήκευσης — ελέγξτε τη φόρμα');
            applyImportedAccount(account);
            return;
          }
        }
        applyImportedAccount(account);
        softErrors.forEach((msg) => toast.error(msg, { duration: 6000 }));
        toast.success(
          account.mail_password
            ? 'Φορτώθηκε — αλλάξτε τον κωδικό-πρότυπο και πατήστε Αποθήκευση'
            : 'Φορτώθηκε η φόρμα — συμπληρώστε κωδικό και πατήστε Αποθήκευση',
        );
        return;
      }

      softErrors.forEach((msg) => toast.error(msg, { duration: 5000 }));
      let created = 0;
      for (const account of accounts) {
        if (!account.mail_password || account.mail_password === 'YOUR_PASSWORD_HERE') continue;
        await createEmailSettings(account);
        created += 1;
      }
      if (created) {
        toast.success(`Εισήχθησαν ${created} λογαριασμοί`);
        load();
      } else {
        applyImportedAccount(accounts[0]);
        toast.error('Κανένας λογαριασμός δεν αποθηκεύτηκε αυτόματα — συμπληρώστε κωδικό και Αποθήκευση');
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία εισαγωγής');
    } finally {
      setImporting(false);
    }
  };

  const isNew = editingId === 'new';
  const requiredOk = Boolean(
    (form.email_address || '').trim() &&
      (form.imap_host || '').trim() &&
      (form.smtp_host || '').trim(),
  );
  const canTest = requiredOk && !testing && !saving;
  const canSave =
    requiredOk &&
    !saving &&
    (isNew ? Boolean((form.mail_password || '').trim()) : true);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Ρυθμίσεις Email</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Συνδέστε τον δικό σας λογαριασμό (π.χ. info@mydomain.gr) — IMAP/SMTP.
            Εισαγωγή από <strong>.mobileconfig</strong> / <strong>.vbs</strong> (cPanel Secure Email),{' '}
            <strong>JSON</strong> ή <strong>.env</strong> — αποθηκεύεται αυτόματα όταν υπάρχει κωδικός.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mobileconfig,.vbs,.json,.env,.txt,application/json,text/plain,.env.prod,.env.local,.env.example,application/x-apple-aspen-config,text/vbscript,*/*"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 rounded-lg border border-outline-variant text-label-md font-bold"
          >
            {importing ? 'Εισαγωγή…' : 'Εισαγωγή από αρχείο'}
          </button>
          <button
            type="button"
            onClick={downloadEmailSettingsTemplate}
            className="px-4 py-2 rounded-lg border border-outline-variant text-label-md"
          >
            Πρότυπο JSON
          </button>
          <button
            type="button"
            onClick={downloadEmailSettingsEnvTemplate}
            className="px-4 py-2 rounded-lg border border-outline-variant text-label-md"
          >
            Πρότυπο .env
          </button>
          <button
            type="button"
            onClick={startNew}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md"
          >
            + Νέος λογαριασμός
          </button>
        </div>
      </div>

      {accounts.length > 0 && (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl border border-outline-variant bg-surface"
            >
              <div>
                <p className="font-semibold text-on-surface">{a.label || a.email_address}</p>
                <p className="text-body-sm text-on-surface-variant">{a.email_address}</p>
                {a.last_sync_error && (
                  <p className="text-label-sm text-error mt-1">Sync: {a.last_sync_error}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => runTestSaved(a.id)} className="text-label-sm text-primary font-bold">
                  Έλεγχος
                </button>
                <button type="button" onClick={() => startEdit(a)} className="text-label-sm font-bold">
                  Επεξεργασία
                </button>
                <button type="button" onClick={() => remove(a.id)} className="text-label-sm text-error font-bold">
                  Διαγραφή
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingId && (
        <div
          id="email-settings-editor"
          className="rounded-2xl border border-outline-variant p-6 space-y-4 bg-surface-container-lowest"
        >
          <h3 className="font-title-md text-title-md">
            {editingId === 'new' ? 'Νέος λογαριασμός' : 'Επεξεργασία'}
          </h3>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="px-3 py-2 rounded-lg border border-outline-variant"
                placeholder="Ετικέτα (π.χ. Πωλήσεις)"
                value={form.label}
                onChange={set('label')}
              />
              <input
                className="px-3 py-2 rounded-lg border border-outline-variant"
                placeholder="Email *"
                value={form.email_address}
                onChange={set('email_address')}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-outline-variant p-4 space-y-3 bg-surface-container-lowest">
                <h4 className="font-bold text-label-md text-on-surface">IMAP</h4>
                <input
                  className="px-3 py-2 rounded-lg border border-outline-variant w-full"
                  placeholder="IMAP Host *"
                  value={form.imap_host}
                  onChange={set('imap_host')}
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    className="px-3 py-2 rounded-lg border border-outline-variant"
                    type="number"
                    placeholder="IMAP Port"
                    value={form.imap_port}
                    onChange={set('imap_port')}
                  />
                  <label className="flex items-center gap-2 text-body-sm">
                    <input type="checkbox" checked={form.imap_secure} onChange={set('imap_secure')} /> IMAP SSL/TLS
                  </label>
                </div>
                <input
                  className="px-3 py-2 rounded-lg border border-outline-variant w-full"
                  placeholder="IMAP Mailbox (π.χ. INBOX)"
                  value={form.imap_mailbox}
                  onChange={set('imap_mailbox')}
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    className="px-3 py-2 rounded-lg border border-outline-variant"
                    placeholder="IMAP Folder Sent"
                    value={form.imap_folder_sent}
                    onChange={set('imap_folder_sent')}
                  />
                  <input
                    className="px-3 py-2 rounded-lg border border-outline-variant"
                    placeholder="IMAP Folder Spam"
                    value={form.imap_folder_spam}
                    onChange={set('imap_folder_spam')}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant p-4 space-y-3 bg-surface-container-lowest">
                <h4 className="font-bold text-label-md text-on-surface">SMTP</h4>
                <input
                  className="px-3 py-2 rounded-lg border border-outline-variant w-full"
                  placeholder="SMTP Host *"
                  value={form.smtp_host}
                  onChange={set('smtp_host')}
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    className="px-3 py-2 rounded-lg border border-outline-variant"
                    type="number"
                    placeholder="SMTP Port"
                    value={form.smtp_port}
                    onChange={set('smtp_port')}
                  />
                  <label className="flex items-center gap-2 text-body-sm">
                    <input type="checkbox" checked={form.smtp_secure} onChange={set('smtp_secure')} /> SMTP STARTTLS
                  </label>
                </div>
                <input
                  className="px-3 py-2 rounded-lg border border-outline-variant w-full"
                  placeholder="Username"
                  value={form.mail_username}
                  onChange={set('mail_username')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  className="px-3 py-2 rounded-lg border border-outline-variant w-full pr-24"
                  type={passwordVisible ? 'text' : 'password'}
                  placeholder={editingId === 'new' ? 'Κωδικός *' : 'Κωδικός (κενό = χωρίς αλλαγή)'}
                  value={form.mail_password}
                  onChange={set('mail_password')}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md border border-outline-variant text-label-sm font-bold bg-surface-container-lowest"
                >
                  {passwordVisible ? 'Απόκρυψη' : 'Εμφάνιση'}
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`rounded-xl border p-3 ${
                  testResult.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
                role="status"
              >
                <div className="font-bold text-label-md">{testResult.ok ? 'Έλεγχος OK' : 'Έλεγχος αποτυχία'}</div>
                <div className="text-body-sm mt-1">{testResult.message}</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={runTest}
                disabled={!canTest}
                className="px-4 py-2 rounded-lg border border-primary text-primary font-bold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {testing ? 'Έλεγχος…' : 'Έλεγχος Σύνδεσης'}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Αποθήκευση
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setTestResult(null);
                  setPasswordVisible(false);
                }}
                className="px-4 py-2 rounded-lg border disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Ακύρωση
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
