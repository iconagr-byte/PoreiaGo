import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createEmailSettings,
  testEmailConnection,
} from '../../../services/emailSettingsApi.js';
import {
  buildAccountFromWizard,
  detectProvider,
} from '../../../lib/email/emailProviderPresets.js';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-outline-variant/80 bg-surface px-3.5 py-2.5 text-body-md text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

const labelClass = 'text-label-sm font-semibold text-on-surface-variant';

function serverFromProvider(prov) {
  return {
    imap_host: prov.imap_host || '',
    imap_port: Number(prov.imap_port) || 993,
    imap_secure: Boolean(prov.imap_secure),
    smtp_host: prov.smtp_host || '',
    smtp_port: Number(prov.smtp_port) || 465,
    smtp_secure: Boolean(prov.smtp_secure),
  };
}

/**
 * Personal-email onboarding for offices after contract purchase.
 * Detects Gmail / Outlook / Yahoo presets; other domains use mail.{domain}.
 * Host/port are editable so cPanel Secure SSL (993/465) can be set exactly.
 */
export default function EmailConnectWizard({ onConnected, onCancel, compact = false }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [checks, setChecks] = useState([]);
  const [server, setServer] = useState(() => serverFromProvider(detectProvider('')));

  const detected = useMemo(() => detectProvider(email), [email]);
  const isCustom = detected.id === 'custom';
  const activeProvider = useMemo(
    () => ({
      ...detected,
      ...server,
      help: detected.help,
      passwordLabel: detected.passwordLabel,
      label: detected.label,
      id: detected.id,
    }),
    [detected, server],
  );

  const canNextEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSave =
    canNextEmail &&
    Boolean(password.trim()) &&
    Boolean(String(server.imap_host || '').trim()) &&
    Boolean(String(server.smtp_host || '').trim());

  const goToServerStep = () => {
    setServer(serverFromProvider(detectProvider(email)));
    setStep(2);
  };

  const patchServer = (patch) => {
    setServer((s) => {
      const next = { ...s, ...(patch || {}) };
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'imap_port')) {
        const imapPort = Number(next.imap_port);
        if (imapPort === 993) next.imap_secure = true;
        if (imapPort === 143) next.imap_secure = false;
      }
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'smtp_port')) {
        const smtpPort = Number(next.smtp_port);
        if (smtpPort === 465) next.smtp_secure = false;
        if (smtpPort === 587) next.smtp_secure = true;
      }
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'imap_secure')) {
        next.imap_secure = Boolean(patch.imap_secure);
      }
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'smtp_secure')) {
        next.smtp_secure = Boolean(patch.smtp_secure);
      }
      return next;
    });
  };

  const draftAccount = () =>
    buildAccountFromWizard({
      email: email.trim(),
      password,
      provider: activeProvider,
      mode: 'direct',
      label: email.trim(),
    });

  const buildPendingChecks = (account) => [
    {
      id: 'imap_host',
      label: `IMAP host · ${account.imap_host}:${account.imap_port}`,
      status: 'pending',
      detail: '',
    },
    {
      id: 'imap_auth',
      label: `IMAP login · ${account.mail_username || account.email_address}`,
      status: 'pending',
      detail: '',
    },
    {
      id: 'smtp_host',
      label: `SMTP host · ${account.smtp_host}:${account.smtp_port}`,
      status: 'pending',
      detail: '',
    },
    {
      id: 'smtp_auth',
      label: `SMTP login · ${account.mail_username || account.email_address}`,
      status: 'pending',
      detail: '',
    },
  ];

  const patchChecks = (updater) => {
    setChecks((prev) => updater(prev.map((c) => ({ ...c }))));
  };

  const runTest = async () => {
    if (!canSave) {
      toast.error('Συμπληρώστε email και κωδικό');
      return;
    }
    const account = draftAccount();
    setBusy(true);
    setTesting(true);
    setTestMsg(null);
    setChecks(buildPendingChecks(account));

    // Progressive UI while the API runs both IMAP + SMTP.
    patchChecks((rows) => {
      rows[0].status = 'running';
      rows[0].detail = 'Σύνδεση στον διακομιστή…';
      return rows;
    });

    const tick = window.setTimeout(() => {
      patchChecks((rows) => {
        if (rows[0].status === 'running') {
          rows[0].detail = 'Αναμονή απάντησης IMAP…';
        }
        if (rows[1].status === 'pending') {
          rows[1].status = 'running';
          rows[1].detail = 'Έλεγχος κωδικού…';
        }
        return rows;
      });
    }, 600);

    try {
      const r = await testEmailConnection({
        ...account,
        imap_port: Number(account.imap_port),
        smtp_port: Number(account.smtp_port),
      });

      window.clearTimeout(tick);
      const imapOk = Boolean(r.imap?.ok);
      const smtpOk = Boolean(r.smtp?.ok);
      const imapErr = r.imap?.error || (!imapOk ? 'Αποτυχία IMAP' : '');
      const smtpErr = r.smtp?.error || (!smtpOk ? 'Αποτυχία SMTP' : '');
      const isTimeout = (msg) =>
        /timeout|timed out|δεν ήταν δυνατή η σύνδεση|Errno 110/i.test(String(msg || ''));
      const imapHostFail = !imapOk && isTimeout(imapErr);
      const smtpHostFail = !smtpOk && isTimeout(smtpErr);

      setChecks([
        {
          id: 'imap_host',
          label: `IMAP host · ${account.imap_host}:${account.imap_port}`,
          status: imapOk ? 'ok' : 'fail',
          detail: imapOk ? 'Σύνδεση OK' : imapErr,
        },
        {
          id: 'imap_auth',
          label: `IMAP login · ${account.mail_username || account.email_address}`,
          status: imapOk ? 'ok' : imapHostFail ? 'skip' : 'fail',
          detail: imapOk
            ? 'Ταυτοποίηση OK'
            : imapHostFail
              ? 'Παραλείφθηκε — δεν ανοίγει πρώτα ο διακομιστής'
              : imapErr,
        },
        {
          id: 'smtp_host',
          label: `SMTP host · ${account.smtp_host}:${account.smtp_port}`,
          status: smtpOk ? 'ok' : 'fail',
          detail: smtpOk ? 'Σύνδεση OK' : smtpErr,
        },
        {
          id: 'smtp_auth',
          label: `SMTP login · ${account.mail_username || account.email_address}`,
          status: smtpOk ? 'ok' : smtpHostFail ? 'skip' : 'fail',
          detail: smtpOk
            ? 'Ταυτοποίηση OK'
            : smtpHostFail
              ? 'Παραλείφθηκε — δεν ανοίγει πρώτα ο διακομιστής'
              : smtpErr,
        },
      ]);

      if (r.ok) {
        setTestMsg({ ok: true, text: 'IMAP & SMTP επιτυχία — μπορείτε να αποθηκεύσετε' });
        toast.success('IMAP & SMTP OK');
      } else if (imapHostFail && smtpHostFail) {
        const text =
          'Ένα πρόβλημα δικτύου: ο mail server δεν απαντά από τον server της εφαρμογής (όχι λάθος κωδικός). Ζητήστε από τον πάροχο hosting να επιτρέψει εξωτερικές συνδέσεις IMAP/SMTP (θύρες 993 και 465, όπως στο cPanel Secure SSL/TLS).';
        setTestMsg({ ok: false, text });
        toast.error('Mail server μη προσβάσιμος');
      } else {
        const text = [imapOk ? null : `IMAP: ${imapErr}`, smtpOk ? null : `SMTP: ${smtpErr}`]
          .filter(Boolean)
          .join(' · ');
        setTestMsg({ ok: false, text: text || 'Αποτυχία σύνδεσης' });
        toast.error(text || 'Αποτυχία σύνδεσης');
      }
    } catch (err) {
      window.clearTimeout(tick);
      const msg = err.message || 'Αποτυχία αιτήματος';
      setChecks((prev) =>
        prev.map((c) => ({
          ...c,
          status: 'fail',
          detail: c.status === 'pending' ? 'Δεν ολοκληρώθηκε' : msg,
        })),
      );
      setTestMsg({ ok: false, text: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
      setTesting(false);
    }
  };

  const save = async () => {
    if (!canSave) {
      toast.error('Συμπληρώστε email και κωδικό');
      return;
    }
    setBusy(true);
    try {
      const account = draftAccount();
      const created = await createEmailSettings({
        ...account,
        imap_port: Number(account.imap_port),
        smtp_port: Number(account.smtp_port),
        mail_username: account.mail_username || account.email_address,
      });
      toast.success('Το προσωπικό email συνδέθηκε');
      onConnected?.(created);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        compact
          ? 'email-connect-compact space-y-4'
          : 'rounded-2xl border border-outline-variant/80 bg-surface p-5 shadow-sm sm:p-6 space-y-5 max-w-2xl'
      }
    >
      {!compact && (
        <div className="border-b border-outline-variant/50 pb-4">
          <p className="text-label-sm font-bold uppercase tracking-wide text-primary">
            Αυτόματη σύνδεση
          </p>
          <h3 className="mt-1 font-title-md text-title-md text-on-surface">
            Συνδέστε το προσωπικό σας email
          </h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Καταχωρήστε το email του γραφείου και τον κωδικό mailbox για συγχρονισμό IMAP/SMTP.
          </p>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full ${
                  step >= n ? 'bg-primary' : 'bg-surface-container-high'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {compact && (
        <div className="flex gap-2" aria-hidden>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full ${
                step >= n ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            />
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="wiz-email" className="text-label-sm font-semibold text-on-surface-variant">
              Διεύθυνση email *
            </label>
            <input
              id="wiz-email"
              type="email"
              autoComplete="email"
              className={fieldClass}
              placeholder="π.χ. name@gmail.com ή info@το-domain.gr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-3 sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent pb-1">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-outline-variant px-4 py-2.5 text-label-md font-semibold bg-white"
              >
                Αργότερα
              </button>
            )}
            <button
              type="button"
              disabled={!canNextEmail}
              onClick={goToServerStep}
              className="rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary disabled:opacity-50 shadow-sm"
            >
              Συνέχεια
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-outline-variant/70 bg-surface-container-low/40 px-4 py-3">
            <p className="text-label-sm font-bold text-on-surface">
              {isCustom ? 'Διακομιστές mailbox (cPanel)' : activeProvider.label}
            </p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Προσυμπληρώθηκαν από το domain σας — μπορείτε να τα αλλάξετε όπως στο Mail Client
              (π.χ. IMAP 993 · SMTP 465).
            </p>
            {!isCustom && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-body-sm text-on-surface-variant">
                {(activeProvider.help || []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="wiz-imap-host" className={labelClass}>
                IMAP host *
              </label>
              <input
                id="wiz-imap-host"
                className={fieldClass}
                value={server.imap_host}
                onChange={(e) => patchServer({ imap_host: e.target.value })}
                placeholder="mail.example.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="wiz-imap-port" className={labelClass}>
                IMAP port
              </label>
              <input
                id="wiz-imap-port"
                type="number"
                className={fieldClass}
                value={server.imap_port}
                onChange={(e) => patchServer({ imap_port: e.target.value })}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => patchServer({ imap_port: 993, imap_secure: true })}
                  className={`rounded-lg px-2.5 py-1 text-label-sm font-bold ${
                    Number(server.imap_port) === 993
                      ? 'bg-primary text-on-primary'
                      : 'border border-outline-variant bg-surface'
                  }`}
                >
                  993 SSL
                </button>
                <button
                  type="button"
                  onClick={() => patchServer({ imap_port: 143, imap_secure: false })}
                  className={`rounded-lg px-2.5 py-1 text-label-sm font-bold ${
                    Number(server.imap_port) === 143
                      ? 'bg-primary text-on-primary'
                      : 'border border-outline-variant bg-surface'
                  }`}
                >
                  143 STARTTLS
                </button>
              </div>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 rounded-xl border border-outline-variant px-3 py-2.5 text-body-sm">
                <input
                  type="checkbox"
                  checked={Boolean(server.imap_secure)}
                  onChange={(e) => patchServer({ imap_secure: e.target.checked })}
                />
                IMAP SSL
              </label>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="wiz-smtp-host" className={labelClass}>
                SMTP host *
              </label>
              <input
                id="wiz-smtp-host"
                className={fieldClass}
                value={server.smtp_host}
                onChange={(e) => patchServer({ smtp_host: e.target.value })}
                placeholder="mail.example.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="wiz-smtp-port" className={labelClass}>
                SMTP port
              </label>
              <input
                id="wiz-smtp-port"
                type="number"
                className={fieldClass}
                value={server.smtp_port}
                onChange={(e) => patchServer({ smtp_port: e.target.value })}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => patchServer({ smtp_port: 465, smtp_secure: false })}
                  className={`rounded-lg px-2.5 py-1 text-label-sm font-bold ${
                    Number(server.smtp_port) === 465
                      ? 'bg-primary text-on-primary'
                      : 'border border-outline-variant bg-surface'
                  }`}
                >
                  465 SSL
                </button>
                <button
                  type="button"
                  onClick={() => patchServer({ smtp_port: 587, smtp_secure: true })}
                  className={`rounded-lg px-2.5 py-1 text-label-sm font-bold ${
                    Number(server.smtp_port) === 587
                      ? 'bg-primary text-on-primary'
                      : 'border border-outline-variant bg-surface'
                  }`}
                >
                  587 STARTTLS
                </button>
              </div>
            </div>
            <div className="flex items-end pb-1">
              <label
                className={`flex items-center gap-2 rounded-xl border border-outline-variant px-3 py-2.5 text-body-sm ${
                  Number(server.smtp_port) === 465 ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(server.smtp_secure)}
                  disabled={Number(server.smtp_port) === 465}
                  onChange={(e) => patchServer({ smtp_secure: e.target.checked })}
                />
                SMTP STARTTLS
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setServer(serverFromProvider(detectProvider(email)))}
            className="text-label-sm font-semibold text-primary"
          >
            Επαναφορά προεπιλογών domain
          </button>

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-outline-variant px-4 py-2.5 text-label-md font-semibold"
            >
              Πίσω
            </button>
            <button
              type="button"
              disabled={!String(server.imap_host || '').trim() || !String(server.smtp_host || '').trim()}
              onClick={() => setStep(3)}
              className="rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary disabled:opacity-50"
            >
              Συνέχεια
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="wiz-pass" className="text-label-sm font-semibold text-on-surface-variant">
              {activeProvider.passwordLabel} *
            </label>
            <div className="relative">
              <input
                id="wiz-pass"
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                className={`${fieldClass} pr-24`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-outline-variant bg-surface px-2.5 py-1 text-label-sm font-bold"
              >
                {passwordVisible ? 'Απόκρυψη' : 'Εμφάνιση'}
              </button>
            </div>
          </div>

          {(testing || checks.length > 0) && (
            <div
              className="rounded-2xl border border-black/[0.08] bg-white/90 px-3.5 py-3 shadow-sm"
              role="status"
              aria-live="polite"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#0071e3]">
                {testing ? 'Έλεγχος σε εξέλιξη' : 'Αποτέλεσμα ελέγχου'}
              </p>
              <ul className="mt-2 space-y-1.5">
                {checks.map((c) => {
                  const icon =
                    c.status === 'ok'
                      ? '✓'
                      : c.status === 'fail'
                        ? '✕'
                        : c.status === 'skip'
                          ? '–'
                          : c.status === 'running'
                            ? '●'
                            : '○';
                  const color =
                    c.status === 'ok'
                      ? 'text-emerald-700'
                      : c.status === 'fail'
                        ? 'text-rose-700'
                        : c.status === 'skip'
                          ? 'text-[#86868b]'
                          : c.status === 'running'
                            ? 'text-[#0071e3]'
                            : 'text-[#86868b]';
                  return (
                    <li
                      key={c.id}
                      className="flex items-start gap-2 rounded-xl bg-[#f5f5f7]/80 px-2.5 py-2 text-[13px]"
                    >
                      <span className={`mt-0.5 w-4 shrink-0 text-center font-bold ${color}`}>{icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-[#1d1d1f]">{c.label}</span>
                        {c.detail ? (
                          <span className={`mt-0.5 block text-[12px] leading-snug ${color}`}>{c.detail}</span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {testMsg && (
            <div
              className={`rounded-xl border px-3 py-2 text-body-sm ${
                testMsg.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {testMsg.text}
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl border border-outline-variant px-4 py-2.5 text-label-md font-semibold"
            >
              Πίσω
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canSave || busy}
                onClick={runTest}
                className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-label-md font-bold text-primary disabled:opacity-50"
              >
                {testing ? 'Έλεγχος…' : 'Έλεγχος σύνδεσης'}
              </button>
              <button
                type="button"
                disabled={!canSave || busy}
                onClick={save}
                className="rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary disabled:opacity-50"
              >
                Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
