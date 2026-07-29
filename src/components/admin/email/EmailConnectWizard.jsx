import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createEmailSettings,
  testEmailConnection,
} from '../../../services/emailSettingsApi.js';
import {
  PROVIDERS,
  buildAccountFromWizard,
  detectProvider,
} from '../../../lib/email/emailProviderPresets.js';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-outline-variant/80 bg-surface px-3.5 py-2.5 text-body-md text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

/**
 * Autonomous personal-email onboarding for new offices after contract purchase.
 * Steers Gmail/Outlook/Yahoo (works from PoreiaGo servers) and offers a Gmail
 * forward path for custom cPanel domains that block datacenter IPs.
 */
export default function EmailConnectWizard({ onConnected, onCancel }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [customMode, setCustomMode] = useState('gmail_bridge'); // or 'direct'
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  const provider = useMemo(() => detectProvider(email), [email]);
  const isCustom = provider.id === 'custom';
  const effectiveMode = isCustom ? customMode : 'direct';
  const activeProvider =
    effectiveMode === 'gmail_bridge' ? PROVIDERS.gmail : provider;

  const canNextEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSave = canNextEmail && Boolean(password.trim());

  const draftAccount = () =>
    buildAccountFromWizard({
      email: email.trim(),
      password,
      provider: activeProvider,
      mode: effectiveMode,
      label: email.trim(),
    });

  const runTest = async () => {
    setBusy(true);
    setTestMsg(null);
    try {
      const account = draftAccount();
      // Gmail bridge: username must be the Gmail address after forward —
      // for wizard we ask them to enter the Gmail they forward TO when in bridge mode.
      const r = await testEmailConnection({
        ...account,
        imap_port: Number(account.imap_port),
        smtp_port: Number(account.smtp_port),
      });
      if (r.ok) {
        setTestMsg({ ok: true, text: 'Σύνδεση OK — μπορείτε να αποθηκεύσετε' });
        toast.success('IMAP & SMTP OK');
      } else {
        const text = r.imap?.error || r.smtp?.error || 'Αποτυχία σύνδεσης';
        setTestMsg({ ok: false, text });
        toast.error(text);
      }
    } catch (err) {
      setTestMsg({ ok: false, text: err.message });
      toast.error(err.message);
    } finally {
      setBusy(false);
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
    <div className="rounded-2xl border border-outline-variant/80 bg-surface p-5 shadow-sm sm:p-6 space-y-5 max-w-2xl">
      <div className="border-b border-outline-variant/50 pb-4">
        <p className="text-label-sm font-bold uppercase tracking-wide text-primary">
          Αυτόματη σύνδεση
        </p>
        <h3 className="mt-1 font-title-md text-title-md text-on-surface">
          Συνδέστε το προσωπικό σας email
        </h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Μετά την αγορά συμβολαίου, καταχωρείτε μόνοι σας το email — χωρίς ticket σε
          hosting. Προτείνονται Gmail / Outlook / Yahoo (δουλεύουν αυτόνομα από το
          PoreiaGo).
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
              placeholder="π.χ. name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {canNextEmail && (
            <div className="rounded-xl border border-outline-variant/70 bg-surface-container-low/50 px-4 py-3 text-body-sm">
              <p className="font-semibold text-on-surface">Ανιχνεύτηκε: {provider.label}</p>
              <p className="mt-1 text-on-surface-variant">
                {provider.autonomous
                  ? 'Αυτός ο πάροχος συνδέεται αυτόνομα από το PoreiaGo — δεν χρειάζεται whitelist.'
                  : 'Custom domain / cPanel συχνά μπλοκάρει το server IP. Προτείνεται σύνδεση μέσω Gmail forward.'}
              </p>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-outline-variant px-4 py-2.5 text-label-md font-semibold"
              >
                Αργότερα
              </button>
            )}
            <button
              type="button"
              disabled={!canNextEmail}
              onClick={() => setStep(2)}
              className="rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary disabled:opacity-50"
            >
              Συνέχεια
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {isCustom && (
            <div className="space-y-2">
              <p className="text-label-sm font-semibold text-on-surface-variant">Πώς θα συνδεθεί;</p>
              <label className="flex cursor-pointer gap-3 rounded-xl border border-outline-variant/80 bg-surface p-3">
                <input
                  type="radio"
                  name="customMode"
                  checked={customMode === 'gmail_bridge'}
                  onChange={() => setCustomMode('gmail_bridge')}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="font-semibold text-on-surface">Μέσω Gmail (προτείνεται)</span>
                  <span className="mt-0.5 block text-body-sm text-on-surface-variant">
                    Στο cPanel βάλτε Forwarder από το domain email → Gmail. Εδώ συνδέετε το Gmail με
                    App Password. Αυτόνομο, χωρίς whitelist.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-xl border border-outline-variant/80 bg-surface p-3">
                <input
                  type="radio"
                  name="customMode"
                  checked={customMode === 'direct'}
                  onChange={() => setCustomMode('direct')}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="font-semibold text-on-surface">Απευθείας IMAP (mail.{email.split('@')[1]})</span>
                  <span className="mt-0.5 block text-body-sm text-on-surface-variant">
                    Μπορεί να εμφανίσει Connection timed out αν το hosting μπλοκάρει το PoreiaGo.
                  </span>
                </span>
              </label>
            </div>
          )}

          {effectiveMode === 'gmail_bridge' && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-body-sm text-on-surface">
              <p className="font-semibold">Βήματα Gmail bridge</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-on-surface-variant">
                <li>cPanel → Forwarders → forward του mailbox στο Gmail σας</li>
                <li>Αλλάξτε το email παρακάτω στο <strong>Gmail</strong> που λαμβάνει</li>
                <li>Google → App Password → επικόλληση κωδικού στο επόμενο βήμα</li>
              </ol>
              <label className="mt-3 block text-label-sm font-semibold text-on-surface-variant">
                Gmail που λαμβάνει τα forward *
              </label>
              <input
                type="email"
                className={fieldClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
              />
            </div>
          )}

          <div className="rounded-xl border border-outline-variant/70 bg-surface-container-low/40 px-4 py-3">
            <p className="text-label-sm font-bold text-on-surface">{activeProvider.label}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-body-sm text-on-surface-variant">
              {(activeProvider.help || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-2 text-label-sm text-on-surface-variant/80">
              IMAP {activeProvider.imap_host}:{activeProvider.imap_port} · SMTP{' '}
              {activeProvider.smtp_host}:{activeProvider.smtp_port}
            </p>
          </div>

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
              onClick={() => setStep(3)}
              className="rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary"
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
                {busy ? 'Έλεγχος…' : 'Έλεγχος σύνδεσης'}
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
