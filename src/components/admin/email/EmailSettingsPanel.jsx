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
import EmailConnectWizard from './EmailConnectWizard.jsx';

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

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-outline-variant/80 bg-surface px-3.5 py-2.5 text-body-md text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';
const labelClass = 'block text-label-sm font-semibold text-on-surface-variant';
const sectionClass =
  'rounded-2xl border border-outline-variant/70 bg-surface-container-low/40 p-4 sm:p-5 space-y-4';

function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-label-sm text-on-surface-variant/80">{hint}</p> : null}
    </div>
  );
}

function syncErrorHint(error) {
  const msg = String(error || '');
  if (/AUTHENTICATIONFAILED|Authentication failed|λάθος username ή κωδικός/i.test(msg)) {
    return 'Λάθος κωδικός ή username. Βεβαιωθείτε ότι ο κωδικός είναι του mailbox (όχι του admin login).';
  }
  if (/timed out|timeout|Errno 110|δεν φτάνει τον mail host|δεν μπορεί να φτάσει τον mail host/i.test(msg)) {
    return 'Το PoreiaGo δεν φτάνει τον mail server (firewall). Δοκιμάστε IMAP 143 STARTTLS, ή forward σε Gmail (imap.gmail.com), ή whitelist IP 34.141.98.145 από Intechs.';
  }
  if (/ascii codec|ordinal not in range|encoding/i.test(msg)) {
    return 'Πρόβλημα encoding — δοκιμάστε ξανά μετά από αποθήκευση κωδικού.';
  }
  if (/CERTIFICATE|SSL|hostname/i.test(msg)) {
    return 'Πρόβλημα πιστοποιητικού SSL στον mail server — επικοινωνήστε με τον πάροχο hosting.';
  }
  return 'Ελέγξτε host / κωδικό και πατήστε Συγχρονισμός IMAP στο Mailbox.';
}

export default function EmailSettingsPanel({ onAccountChange, openConnectWizard = false }) {
  const [accounts, setAccounts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showWizard, setShowWizard] = useState(Boolean(openConnectWizard));
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

  useEffect(() => {
    if (openConnectWizard) setShowWizard(true);
  }, [openConnectWizard]);

  const set = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: v };
      // Keep username in sync when empty and email changes.
      if (key === 'email_address' && !(f.mail_username || '').trim()) {
        next.mail_username = v;
      }
      // Mirror IMAP host → SMTP host when SMTP still empty or matched previous IMAP host.
      if (key === 'imap_host' && (!(f.smtp_host || '').trim() || f.smtp_host === f.imap_host)) {
        next.smtp_host = v;
      }
      return next;
    });
    setTestResult(null);
  };

  const applyImapPreset = (preset) => {
    if (preset === '993') {
      setForm((f) => ({ ...f, imap_port: 993, imap_secure: true }));
    } else if (preset === '143') {
      setForm((f) => ({ ...f, imap_port: 143, imap_secure: false }));
    }
    setTestResult(null);
  };

  const applySmtpPreset = (preset) => {
    if (preset === '587') {
      setForm((f) => ({ ...f, smtp_port: 587, smtp_secure: true }));
    } else if (preset === '465') {
      setForm((f) => ({ ...f, smtp_port: 465, smtp_secure: false }));
    }
    setTestResult(null);
  };

  const applyGmailFallback = () => {
    setForm((f) => ({
      ...f,
      imap_host: 'imap.gmail.com',
      imap_port: 993,
      imap_secure: true,
      smtp_host: 'smtp.gmail.com',
      smtp_port: 587,
      smtp_secure: true,
    }));
    setTestResult({
      ok: false,
      message: 'Προεπιλογές Gmail φορτώθηκαν',
      hint:
        'Στο cPanel: Forwarders → forward το info@ στο Gmail σας. Στο Google: App Password. Username = το Gmail. Μετά Αποθήκευση → Έλεγχος.',
    });
  };

  const startNew = () => {
    setShowWizard(false);
    setEditingId('new');
    setForm({ ...EMPTY });
    setTestResult(null);
    setPasswordVisible(false);
  };

  const startEdit = (acc) => {
    setShowWizard(false);
    setEditingId(acc.id);
    setForm({
      ...EMPTY,
      label: acc.label || '',
      email_address: acc.email_address || '',
      imap_host: acc.imap_host || '',
      imap_port: acc.imap_port || 993,
      imap_secure: Boolean(acc.imap_secure),
      imap_mailbox: acc.imap_mailbox || 'INBOX',
      imap_folder_sent: acc.imap_folder_sent || 'Sent',
      imap_folder_spam: acc.imap_folder_spam || 'Spam',
      smtp_host: acc.smtp_host || '',
      smtp_port: acc.smtp_port || 587,
      smtp_secure: Boolean(acc.smtp_secure),
      mail_username: acc.mail_username || acc.email_address || '',
      mail_password: '',
      is_active: acc.is_active !== false,
    });
    setTestResult(null);
    setPasswordVisible(false);
    requestAnimationFrame(() => {
      document.getElementById('email-settings-editor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
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
      if (r.ok) {
        const msg = 'IMAP & SMTP: επιτυχής σύνδεση';
        setTestResult({ ok: true, message: msg });
        toast.success(msg);
      } else {
        const parts = [];
        if (r.imap && !r.imap.ok) parts.push(`IMAP: ${r.imap.error || 'αποτυχία'}`);
        if (r.smtp && !r.smtp.ok) parts.push(`SMTP: ${r.smtp.error || 'αποτυχία'}`);
        const msg = parts.join(' · ') || 'Αποτυχία σύνδεσης';
        setTestResult({
          ok: false,
          message: msg,
          hint: syncErrorHint(msg),
        });
        toast.error(msg);
      }
    } catch (err) {
      toast.error(err.message);
      setTestResult({ ok: false, message: err.message, hint: syncErrorHint(err.message) });
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
      const { accounts: imported, errors } = parseEmailSettingsBytes(buf, file.name);

      if (!imported.length) {
        if (errors.length) errors.forEach((msg) => toast.error(msg, { duration: 6000 }));
        else toast.error('Δεν βρέθηκαν έγκυροι λογαριασμοί στο αρχείο');
        return;
      }

      const softErrors = errors.filter(Boolean);

      if (imported.length === 1) {
        const account = imported[0];
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
      for (const account of imported) {
        if (!account.mail_password || account.mail_password === 'YOUR_PASSWORD_HERE') continue;
        await createEmailSettings(account);
        created += 1;
      }
      if (created) {
        toast.success(`Εισήχθησαν ${created} λογαριασμοί`);
        load();
      } else {
        applyImportedAccount(imported[0]);
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
  const canSave = requiredOk && !saving && (isNew ? Boolean((form.mail_password || '').trim()) : true);
  const smtpPreset =
    Number(form.smtp_port) === 465 && !form.smtp_secure
      ? '465'
      : Number(form.smtp_port) === 587 && form.smtp_secure
        ? '587'
        : 'custom';
  const imapPreset =
    Number(form.imap_port) === 143 && !form.imap_secure
      ? '143'
      : Number(form.imap_port) === 993 && form.imap_secure
        ? '993'
        : 'custom';
  const showTimeoutHelp =
    Boolean(testResult && !testResult.ok && /timed out|timeout|Errno 110|δεν φτάνει τον mail host/i.test(testResult.message || '')) ||
    accounts.some((a) => /timed out|timeout|Errno 110|δεν φτάνει τον mail host/i.test(String(a.last_sync_error || '')));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-headline-md text-headline-md text-on-surface">Ρυθμίσεις Email</h2>
          <p className="mt-1 max-w-xl text-body-sm text-on-surface-variant">
            Συνδέστε προσωπικό ή εταιρικό mailbox (IMAP/SMTP) μετά την αγορά συμβολαίου.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mobileconfig,.vbs,.json,.env,.txt,application/json,text/plain,.env.prod,.env.local,.env.example,application/x-apple-aspen-config,text/vbscript,*/*"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => {
              setShowWizard(true);
              setEditingId(null);
            }}
            className="rounded-xl bg-primary px-4 py-2 text-label-md font-semibold text-on-primary shadow-sm hover:opacity-95"
          >
            + Σύνδεση email
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="rounded-xl border border-outline-variant bg-surface px-3.5 py-2 text-label-md font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-60"
          >
            {importing ? 'Εισαγωγή…' : 'Εισαγωγή αρχείου'}
          </button>
          <button
            type="button"
            onClick={downloadEmailSettingsTemplate}
            className="rounded-xl border border-outline-variant bg-surface px-3.5 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-low"
          >
            JSON
          </button>
          <button
            type="button"
            onClick={downloadEmailSettingsEnvTemplate}
            className="rounded-xl border border-outline-variant bg-surface px-3.5 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-low"
          >
            .env
          </button>
          <button
            type="button"
            onClick={startNew}
            className="rounded-xl border border-outline-variant bg-surface px-3.5 py-2 text-label-md font-semibold text-on-surface hover:bg-surface-container-low"
          >
            Χειροκίνητα
          </button>
        </div>
      </div>

      {(showWizard || accounts.length === 0) && !editingId && (
        <EmailConnectWizard
          onCancel={accounts.length ? () => setShowWizard(false) : undefined}
          onConnected={(created) => {
            setShowWizard(false);
            onAccountChange?.(created.id);
            localStorage.setItem('email_active_account', created.id);
            load();
          }}
        />
      )}

      {accounts.length > 0 && (
        <ul className="space-y-3">
          {accounts.map((a) => {
            const hasErr = Boolean(a.last_sync_error);
            return (
              <li
                key={a.id}
                className="rounded-2xl border border-outline-variant/80 bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <path
                          d="m5.5 7.5 6.5 5 6.5-5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-on-surface">
                          {a.label || a.email_address}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                            hasErr
                              ? 'bg-rose-100 text-rose-700'
                              : a.is_active === false
                                ? 'bg-surface-container-high text-on-surface-variant'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {hasErr ? 'Σφάλμα sync' : a.is_active === false ? 'Ανενεργό' : 'Ενεργό'}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-body-sm text-on-surface-variant">
                        {a.email_address}
                      </p>
                      <p className="mt-1 text-label-sm text-on-surface-variant/80">
                        IMAP {a.imap_host}:{a.imap_port}
                        {a.imap_secure ? ' · SSL' : ''} · SMTP {a.smtp_host}:{a.smtp_port}
                        {a.smtp_secure ? ' · STARTTLS' : Number(a.smtp_port) === 465 ? ' · SSL' : ''}
                      </p>
                      {hasErr && (
                        <div className="mt-2 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-label-sm text-rose-800">
                          <p className="font-semibold">Sync: {a.last_sync_error}</p>
                          <p className="mt-0.5 opacity-90">{syncErrorHint(a.last_sync_error)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => runTestSaved(a.id)}
                      disabled={testing}
                      className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-label-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
                    >
                      Έλεγχος
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="rounded-xl border border-outline-variant px-3 py-1.5 text-label-sm font-bold text-on-surface hover:bg-surface-container-low"
                    >
                      Επεξεργασία
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="rounded-xl border border-rose-200 px-3 py-1.5 text-label-sm font-bold text-rose-700 hover:bg-rose-50"
                    >
                      Διαγραφή
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showTimeoutHelp && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm">
          <p className="text-label-md font-bold">Εναλλακτικές για Connection timeout</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-body-sm">
            <li>
              <strong>Επεξεργασία</strong> → IMAP <strong>143 · STARTTLS</strong> → Αποθήκευση → Έλεγχος
              (μερικοί hosts ανοίγουν μόνο τη 143).
            </li>
            <li>
              <strong>Gmail bridge:</strong> cPanel → Forwarders → forward το mailbox στο Gmail → Google
              App Password → στο form πάτα «Προεπιλογές Gmail» → βάλε App Password → Αποθήκευση.
            </li>
            <li>
              Ticket Intechs: whitelist IP <code className="rounded bg-amber-100 px-1">34.141.98.145</code>{' '}
              στις θύρες 993 και 587.
            </li>
          </ol>
          {!editingId && accounts[0] && (
            <button
              type="button"
              onClick={() => {
                startEdit(accounts[0]);
                requestAnimationFrame(() => applyGmailFallback());
              }}
              className="mt-3 rounded-xl border border-amber-300 bg-white px-3 py-2 text-label-sm font-bold text-amber-950 hover:bg-amber-100/60"
            >
              Άνοιγμα επεξεργασίας + προεπιλογές Gmail
            </button>
          )}
        </div>
      )}

      {editingId && (
        <div
          id="email-settings-editor"
          className="space-y-5 rounded-2xl border border-outline-variant/80 bg-surface p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-outline-variant/50 pb-4">
            <div>
              <h3 className="font-title-md text-title-md text-on-surface">
                {isNew ? 'Νέος λογαριασμός' : 'Επεξεργασία λογαριασμού'}
              </h3>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">
                Συμπληρώστε τα πεδία με labels — προτιμήστε SMTP 587 + STARTTLS.
              </p>
            </div>
          </div>

          <section className={sectionClass}>
            <h4 className="text-label-md font-bold uppercase tracking-wide text-on-surface-variant">
              Ταυτότητα
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="email-label" label="Ετικέτα">
                <input
                  id="email-label"
                  className={fieldClass}
                  placeholder="π.χ. Πωλήσεις"
                  value={form.label}
                  onChange={set('label')}
                />
              </Field>
              <Field id="email-address" label="Διεύθυνση email *">
                <input
                  id="email-address"
                  className={fieldClass}
                  type="email"
                  autoComplete="email"
                  placeholder="info@example.com"
                  value={form.email_address}
                  onChange={set('email_address')}
                />
              </Field>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={sectionClass}>
              <h4 className="text-label-md font-bold uppercase tracking-wide text-on-surface-variant">
                IMAP · λήψη
              </h4>
              <Field id="imap-host" label="IMAP host *" hint="Συνήθως mail.το-domain.gr">
                <input
                  id="imap-host"
                  className={fieldClass}
                  placeholder="mail.example.com"
                  value={form.imap_host}
                  onChange={set('imap_host')}
                />
              </Field>
              <div>
                <p className={labelClass}>Προεπιλογή ασφαλείας</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyImapPreset('993')}
                    className={`rounded-xl px-3 py-2 text-label-sm font-bold transition ${
                      imapPreset === '993'
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    993 · SSL
                  </button>
                  <button
                    type="button"
                    onClick={() => applyImapPreset('143')}
                    className={`rounded-xl px-3 py-2 text-label-sm font-bold transition ${
                      imapPreset === '143'
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    143 · STARTTLS
                  </button>
                </div>
                <p className="mt-1.5 text-label-sm text-on-surface-variant/80">
                  Αν το 993 κάνει timeout από firewall, δοκιμάστε 143 · STARTTLS.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field id="imap-port" label="Port">
                  <input
                    id="imap-port"
                    className={fieldClass}
                    type="number"
                    value={form.imap_port}
                    onChange={(e) => {
                      const port = Number(e.target.value);
                      setForm((f) => ({
                        ...f,
                        imap_port: e.target.value,
                        imap_secure: port === 993 ? true : port === 143 ? false : f.imap_secure,
                      }));
                      setTestResult(null);
                    }}
                  />
                </Field>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 rounded-xl border border-outline-variant/80 bg-surface px-3 py-2.5 text-body-sm text-on-surface">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={form.imap_secure}
                      onChange={set('imap_secure')}
                    />
                    SSL / TLS
                  </label>
                </div>
              </div>
              <Field id="imap-mailbox" label="Φάκελος εισερχομένων">
                <input
                  id="imap-mailbox"
                  className={fieldClass}
                  value={form.imap_mailbox}
                  onChange={set('imap_mailbox')}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="imap-sent" label="Απεσταλμένα">
                  <input
                    id="imap-sent"
                    className={fieldClass}
                    value={form.imap_folder_sent}
                    onChange={set('imap_folder_sent')}
                  />
                </Field>
                <Field id="imap-spam" label="Spam">
                  <input
                    id="imap-spam"
                    className={fieldClass}
                    value={form.imap_folder_spam}
                    onChange={set('imap_folder_spam')}
                  />
                </Field>
              </div>
            </section>

            <section className={sectionClass}>
              <h4 className="text-label-md font-bold uppercase tracking-wide text-on-surface-variant">
                SMTP · αποστολή
              </h4>
              <Field id="smtp-host" label="SMTP host *">
                <input
                  id="smtp-host"
                  className={fieldClass}
                  placeholder="mail.example.com"
                  value={form.smtp_host}
                  onChange={set('smtp_host')}
                />
              </Field>
              <div>
                <p className={labelClass}>Προεπιλογή ασφαλείας</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applySmtpPreset('587')}
                    className={`rounded-xl px-3 py-2 text-label-sm font-bold transition ${
                      smtpPreset === '587'
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    587 · STARTTLS
                  </button>
                  <button
                    type="button"
                    onClick={() => applySmtpPreset('465')}
                    className={`rounded-xl px-3 py-2 text-label-sm font-bold transition ${
                      smtpPreset === '465'
                        ? 'bg-primary text-on-primary'
                        : 'border border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    465 · SSL
                  </button>
                  <button
                    type="button"
                    onClick={applyGmailFallback}
                    className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-label-sm font-bold text-on-surface hover:bg-surface-container-low"
                  >
                    Προεπιλογές Gmail
                  </button>
                </div>
                <p className="mt-1.5 text-label-sm text-on-surface-variant/80">
                  Προτείνεται 587 · STARTTLS. Το 465 χρησιμοποιεί άμεσο SSL (χωρίς STARTTLS).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field id="smtp-port" label="Port">
                  <input
                    id="smtp-port"
                    className={fieldClass}
                    type="number"
                    value={form.smtp_port}
                    onChange={(e) => {
                      const port = Number(e.target.value);
                      setForm((f) => ({
                        ...f,
                        smtp_port: e.target.value,
                        // Auto-align encryption when switching common ports.
                        smtp_secure: port === 465 ? false : port === 587 ? true : f.smtp_secure,
                      }));
                      setTestResult(null);
                    }}
                  />
                </Field>
                <div className="flex items-end pb-1">
                  <label
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-body-sm ${
                      Number(form.smtp_port) === 465
                        ? 'cursor-not-allowed border-outline-variant/50 bg-surface-container-low text-on-surface-variant opacity-70'
                        : 'border-outline-variant/80 bg-surface text-on-surface'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={form.smtp_secure}
                      disabled={Number(form.smtp_port) === 465}
                      onChange={set('smtp_secure')}
                    />
                    STARTTLS
                  </label>
                </div>
              </div>
            </section>
          </div>

          <section className={sectionClass}>
            <h4 className="text-label-md font-bold uppercase tracking-wide text-on-surface-variant">
              Στοιχεία σύνδεσης
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="mail-user" label="Username" hint="Συνήθως το πλήρες email">
                <input
                  id="mail-user"
                  className={fieldClass}
                  autoComplete="username"
                  placeholder={form.email_address || 'info@example.com'}
                  value={form.mail_username}
                  onChange={set('mail_username')}
                />
              </Field>
              <Field
                id="mail-pass"
                label={isNew ? 'Κωδικός mailbox *' : 'Κωδικός mailbox'}
                hint={isNew ? null : 'Αφήστε κενό για να μην αλλάξει'}
              >
                <div className="relative">
                  <input
                    id="mail-pass"
                    className={`${fieldClass} pr-24`}
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={isNew ? 'Κωδικός *' : '••••••••'}
                    value={form.mail_password}
                    onChange={set('mail_password')}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-outline-variant bg-surface px-2.5 py-1 text-label-sm font-bold text-on-surface-variant hover:bg-surface-container-low"
                  >
                    {passwordVisible ? 'Απόκρυψη' : 'Εμφάνιση'}
                  </button>
                </div>
              </Field>
            </div>
          </section>

          {testResult && (
            <div
              className={`rounded-2xl border px-4 py-3 ${
                testResult.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
              role="status"
            >
              <p className="text-label-md font-bold">
                {testResult.ok ? 'Έλεγχος επιτυχής' : 'Έλεγχος απέτυχε'}
              </p>
              <p className="mt-1 text-body-sm">{testResult.message}</p>
              {!testResult.ok && testResult.hint ? (
                <p className="mt-1 text-label-sm opacity-90">{testResult.hint}</p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant/50 pt-4">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setTestResult(null);
                setPasswordVisible(false);
              }}
              className="rounded-xl border border-outline-variant px-4 py-2.5 text-label-md font-semibold text-on-surface hover:bg-surface-container-low"
            >
              Ακύρωση
            </button>
            <button
              type="button"
              onClick={runTest}
              disabled={!canTest}
              className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-label-md font-bold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testing ? 'Έλεγχος…' : 'Έλεγχος σύνδεσης'}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
