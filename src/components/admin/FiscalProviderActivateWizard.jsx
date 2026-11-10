import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PROVIDER_DEFAULT_URLS,
  YPAHES_PROVIDERS,
  testFiscalConnection,
  updateFiscalSettings,
} from '../../services/fiscalSettingsApi.js';

const STEPS = [
  { id: 'welcome', label: 'Έναρξη' },
  { id: 'choose', label: 'Πάροχος' },
  { id: 'credentials', label: 'Στοιχεία' },
  { id: 'verify', label: 'Έλεγχος' },
  { id: 'done', label: 'Έτοιμο' },
];

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-gray-200/90 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20';

function StepRail({ stepIndex }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < stepIndex;
        const active = i === stepIndex;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={[
                'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-bold',
                done
                  ? 'bg-teal-600 text-white'
                  : active
                    ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-500/30'
                    : 'bg-gray-100 text-gray-400',
              ].join(' ')}
            >
              {done ? (
                <span className="material-symbols-outlined text-[14px]">check</span>
              ) : (
                i + 1
              )}
            </span>
            <span
              className={`hidden sm:inline text-xs font-semibold ${
                active ? 'text-teal-800' : done ? 'text-gray-600' : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="hidden sm:block h-px w-4 bg-gray-200" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function CheckRow({ label, status, detail }) {
  const tone =
    status === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : status === 'fail'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : status === 'running'
          ? 'border-teal-200 bg-teal-50 text-teal-900'
          : 'border-gray-200 bg-gray-50 text-gray-600';
  const icon =
    status === 'ok'
      ? 'check_circle'
      : status === 'fail'
        ? 'error'
        : status === 'running'
          ? 'progress_activity'
          : 'radio_button_unchecked';
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${tone}`}>
      <span
        className={`material-symbols-outlined text-[20px] shrink-0 ${
          status === 'running' ? 'animate-spin' : ''
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{label}</p>
        {detail ? <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{detail}</p> : null}
      </div>
    </div>
  );
}

/**
 * Activation wizard for AADE ΥΠΑΗΕΣ providers (SoftOne / Impact).
 * Used from Fiscal settings and Office setup after contract purchase.
 */
export default function FiscalProviderActivateWizard({
  open = true,
  compact = false,
  initialSettings = null,
  onActivated,
  onCancel,
}) {
  const [step, setStep] = useState(0);
  const [providerId, setProviderId] = useState('softone');
  const [issuerVat, setIssuerVat] = useState('');
  const [issuerName, setIssuerName] = useState('');
  const [apiUrl, setApiUrl] = useState(PROVIDER_DEFAULT_URLS.softone.prod);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [branchCode, setBranchCode] = useState(0);
  const [itemCode, setItemCode] = useState('TRAVEL');
  const [seriesRetail, setSeriesRetail] = useState('ΑΠΥ');
  const [seriesInvoice, setSeriesInvoice] = useState('ΤΠΥ');
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState([]);
  const [verified, setVerified] = useState(false);
  const [hadStoredKey, setHadStoredKey] = useState(false);

  const providerMeta = useMemo(
    () => YPAHES_PROVIDERS.find((p) => p.id === providerId) || YPAHES_PROVIDERS[0],
    [providerId],
  );

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setVerified(false);
    setChecks([]);
    setApiKey('');
    setApiKeyVisible(false);

    const s = initialSettings || {};
    const preferred =
      s.provider === 'impact' || s.provider === 'softone' ? s.provider : 'softone';
    setProviderId(preferred);
    setIssuerVat(String(s.issuer_vat || '').trim());
    setSeriesRetail(s.series_retail || 'ΑΠΥ');
    setSeriesInvoice(s.series_invoice || 'ΤΠΥ');

    const block = s[preferred] || {};
    setIssuerName(String(block.issuer_name || '').trim());
    setApiUrl(
      String(block.api_url || PROVIDER_DEFAULT_URLS[preferred]?.prod || '').trim(),
    );
    setBranchCode(Number(block.branch_code) || 0);
    setItemCode(String(block.item_code || 'TRAVEL').trim() || 'TRAVEL');
    setHadStoredKey(Boolean(block.api_key_configured));
  }, [open, initialSettings]);

  useEffect(() => {
    const defaults = PROVIDER_DEFAULT_URLS[providerId];
    if (!defaults) return;
    setApiUrl((prev) => {
      const urls = Object.values(PROVIDER_DEFAULT_URLS).flatMap((u) => [u.prod, u.demo]);
      if (!prev || urls.includes(prev)) return defaults.prod;
      return prev;
    });
    const block = initialSettings?.[providerId];
    if (block) {
      setIssuerName(String(block.issuer_name || '').trim());
      setBranchCode(Number(block.branch_code) || 0);
      setItemCode(String(block.item_code || 'TRAVEL').trim() || 'TRAVEL');
      setHadStoredKey(Boolean(block.api_key_configured));
      if (block.api_url) setApiUrl(String(block.api_url).trim());
    }
  }, [providerId, initialSettings]);

  const canCredentials =
    Boolean(issuerVat.trim()) &&
    Boolean(apiUrl.trim()) &&
    (Boolean(apiKey.trim()) || hadStoredKey);

  const applyEnv = (env) => {
    const url = PROVIDER_DEFAULT_URLS[providerId]?.[env];
    if (url) setApiUrl(url);
  };

  const runVerify = async () => {
    if (!canCredentials) {
      toast.error('Συμπληρώστε ΑΦΜ και API key');
      return false;
    }
    setBusy(true);
    setVerified(false);
    setChecks([
      {
        id: 'url',
        label: `API endpoint · ${apiUrl.replace(/^https?:\/\//, '')}`,
        status: 'running',
        detail: 'Έλεγχος προσβασιμότητας…',
      },
      {
        id: 'login',
        label: `Authentication · ΑΦΜ ${issuerVat.trim()}`,
        status: 'pending',
        detail: '',
      },
      {
        id: 'token',
        label: 'Access token από πάροχο',
        status: 'pending',
        detail: '',
      },
    ]);

    const tick = window.setTimeout(() => {
      setChecks((rows) =>
        rows.map((r, i) =>
          i === 0
            ? { ...r, detail: 'Σύνδεση με EliseCore…' }
            : i === 1
              ? { ...r, status: 'running', detail: 'Login με API key…' }
              : r,
        ),
      );
    }, 450);

    try {
      const body = {
        provider: providerId,
        issuer_vat: issuerVat.trim(),
        api_url: apiUrl.trim(),
      };
      if (apiKey.trim()) body.api_key = apiKey.trim();

      const result = await testFiscalConnection(body);
      window.clearTimeout(tick);

      if (!result?.ok) {
        setChecks([
          {
            id: 'url',
            label: `API endpoint · ${apiUrl.replace(/^https?:\/\//, '')}`,
            status: 'ok',
            detail: 'Endpoint αποκρίθηκε',
          },
          {
            id: 'login',
            label: `Authentication · ΑΦΜ ${issuerVat.trim()}`,
            status: 'fail',
            detail: result?.message || 'Αποτυχία login',
          },
          {
            id: 'token',
            label: 'Access token από πάροχο',
            status: 'fail',
            detail: 'Δεν ελήφθη token',
          },
        ]);
        toast.error(result?.message || 'Αποτυχία σύνδεσης');
        return false;
      }

      setChecks([
        {
          id: 'url',
          label: `API endpoint · ${(result.api_url || apiUrl).replace(/^https?:\/\//, '')}`,
          status: 'ok',
          detail: 'Endpoint OK',
        },
        {
          id: 'login',
          label: `Authentication · ΑΦΜ ${issuerVat.trim()}`,
          status: 'ok',
          detail: 'Επιτυχές login',
        },
        {
          id: 'token',
          label: 'Access token από πάροχο',
          status: 'ok',
          detail: result.token_received ? 'Token ελήφθη' : 'OK',
        },
      ]);
      setVerified(true);
      toast.success(result.message || 'Επιτυχής σύνδεση');
      return true;
    } catch (err) {
      window.clearTimeout(tick);
      const msg = err.message || 'Αποτυχία αιτήματος';
      setChecks((rows) =>
        rows.map((r, i) =>
          i === 0
            ? { ...r, status: 'fail', detail: msg }
            : { ...r, status: 'fail', detail: i === 1 ? msg : '' },
        ),
      );
      toast.error(msg);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!verified && !(await runVerify())) return;
    setBusy(true);
    try {
      const patch = {
        provider: providerId,
        issuer_vat: issuerVat.trim(),
        series_retail: seriesRetail.trim() || 'ΑΠΥ',
        series_invoice: seriesInvoice.trim() || 'ΤΠΥ',
        [providerId]: {
          api_url: apiUrl.trim(),
          issuer_name: issuerName.trim(),
          branch_code: Number(branchCode) || 0,
          item_code: itemCode.trim() || 'TRAVEL',
        },
      };
      if (apiKey.trim()) patch[providerId].api_key = apiKey.trim();

      const data = await updateFiscalSettings(patch);
      toast.success(`${providerMeta.label} ενεργοποιήθηκε για το γραφείο`);
      setStep(4);
      onActivated?.(data);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ενεργοποίησης');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const body = (
    <div
      className={
        compact
          ? 'space-y-5'
          : 'relative w-full max-w-2xl rounded-[28px] border border-black/[0.06] bg-white shadow-2xl shadow-teal-900/10 overflow-hidden'
      }
    >
      {!compact ? (
        <div className="px-6 py-5 border-b border-teal-100/80 bg-gradient-to-br from-teal-50 via-white to-emerald-50/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700/80">
                Ενεργοποίηση παρόχου
              </p>
              <h2 className="mt-1 text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700">verified</span>
                Πάροχος ηλεκτρονικής τιμολόγησης
              </h2>
              <p className="mt-1.5 text-sm text-gray-500 max-w-md leading-relaxed">
                Οδηγός ρύθμισης ΥΠΑΗΕΣ για το γραφείο μετά την αγορά συμβολαίου — SoftOne ή
                Impact.
              </p>
            </div>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                aria-label="Κλείσιμο"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            ) : null}
          </div>
          <div className="mt-4">
            <StepRail stepIndex={step} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <StepRail stepIndex={step} />
        </div>
      )}

      <div className={compact ? 'space-y-5' : 'px-6 py-6 space-y-5'}>
        {STEPS[step].id === 'welcome' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-white p-5">
              <div className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/25">
                  <span className="material-symbols-outlined text-[26px]">receipt_long</span>
                </span>
                <div>
                  <h3 className="font-bold text-gray-900">Γιατί πάροχος;</h3>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                    Με πιστοποιημένο πάροχο ΑΑΔΕ (ΥΠΑΗΕΣ), τα παραστατικά εκδίδονται με MARK σε
                    πραγματικό χρόνο μετά την πληρωμή — χωρίς χειροκίνητη διαβίβαση.
                  </p>
                </div>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-3">
              {[
                { icon: 'key', t: 'API key', d: 'Από το portal SoftOne / Impact' },
                { icon: 'badge', t: 'ΑΦΜ γραφείου', d: 'Ίδιο με τον λογαριασμό παρόχου' },
                { icon: 'bolt', t: 'Έλεγχος + ενεργοποίηση', d: 'Login test χωρίς έκδοση' },
              ].map((item) => (
                <li
                  key={item.t}
                  className="rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-3"
                >
                  <span className="material-symbols-outlined text-teal-700 text-[20px]">
                    {item.icon}
                  </span>
                  <p className="mt-1.5 text-sm font-bold text-gray-900">{item.t}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.d}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {STEPS[step].id === 'choose' ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Επιλέξτε τον αδειοδοτημένο πάροχο με τον οποίο έχει λογαριασμό το γραφείο.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {YPAHES_PROVIDERS.map((p) => {
                const active = providerId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProviderId(p.id)}
                    className={[
                      'relative text-left rounded-2xl border p-4 transition',
                      active
                        ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-teal-200',
                    ].join(' ')}
                  >
                    {active ? (
                      <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white">
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                        active ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span className="material-symbols-outlined">{p.icon}</span>
                    </span>
                    <span className="mt-3 block text-sm font-bold text-gray-900">{p.label}</span>
                    <span className="mt-1 block text-xs text-gray-500 leading-relaxed">
                      {p.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {STEPS[step].id === 'credentials' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyEnv('prod')}
                className="text-xs font-bold px-3 py-1.5 rounded-full border border-teal-200 bg-teal-50 text-teal-800"
              >
                Production URL
              </button>
              <button
                type="button"
                onClick={() => applyEnv('demo')}
                className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              >
                Demo / UAT URL
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-gray-500">API URL</span>
                <input
                  className={fieldClass}
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder={PROVIDER_DEFAULT_URLS[providerId]?.prod}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">ΑΦΜ εκδότη *</span>
                <input
                  className={fieldClass}
                  value={issuerVat}
                  onChange={(e) => setIssuerVat(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="123456789"
                  inputMode="numeric"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">
                  API Key *{hadStoredKey && !apiKey ? ' · αποθηκευμένο' : ''}
                </span>
                <div className="relative">
                  <input
                    className={`${fieldClass} pr-11`}
                    type={apiKeyVisible ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hadStoredKey ? '•••••••• (αφήστε κενό για το υπάρχον)' : 'API key'}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700"
                    onClick={() => setApiKeyVisible((v) => !v)}
                    aria-label="Εμφάνιση API key"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {apiKeyVisible ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Επωνυμία εκδότη</span>
                <input
                  className={fieldClass}
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  placeholder="Επωνυμία ΑΕ"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Κωδικός είδους</span>
                <input
                  className={fieldClass}
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="TRAVEL"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Υποκατάστημα</span>
                <input
                  className={fieldClass}
                  type="number"
                  value={branchCode}
                  onChange={(e) => setBranchCode(Number(e.target.value) || 0)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Σειρά λιανικής</span>
                <input
                  className={fieldClass}
                  value={seriesRetail}
                  onChange={(e) => setSeriesRetail(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Σειρά τιμολογίου</span>
                <input
                  className={fieldClass}
                  value={seriesInvoice}
                  onChange={(e) => setSeriesInvoice(e.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}

        {STEPS[step].id === 'verify' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-sm font-bold text-gray-900">{providerMeta.label}</p>
              <p className="text-xs text-gray-500 mt-1">
                ΑΦΜ {issuerVat || '—'} · {apiUrl.replace(/^https?:\/\//, '')}
              </p>
            </div>
            <div className="space-y-2">
              {checks.length ? (
                checks.map((c) => <CheckRow key={c.id} {...c} />)
              ) : (
                <p className="text-sm text-gray-500">
                  Πατήστε «Έλεγχος σύνδεσης» για login στον πάροχο χωρίς έκδοση παραστατικού.
                </p>
              )}
            </div>
            {verified ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">verified</span>
                Έτοιμο για ενεργοποίηση στο γραφείο
              </div>
            ) : null}
          </div>
        ) : null}

        {STEPS[step].id === 'done' ? (
          <div className="text-center py-4 space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg shadow-teal-600/30">
              <span className="material-symbols-outlined text-[36px]">check</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900">Ο πάροχος ενεργοποιήθηκε</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              Το γραφείο εκδίδει πλέον μέσω <strong>{providerMeta.label}</strong>. Οι νέες
              πληρωμές θα περνούν από το fiscal pipeline για MARK.
            </p>
          </div>
        ) : null}
      </div>

      <div
        className={
          compact
            ? 'flex flex-wrap items-center justify-between gap-3 pt-2'
            : 'px-6 py-4 border-t border-gray-100 bg-gray-50/40 flex flex-wrap items-center justify-between gap-3'
        }
      >
        <div className="flex gap-2">
          {step > 0 && STEPS[step].id !== 'done' ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-100"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Πίσω
            </button>
          ) : null}
          {onCancel && STEPS[step].id !== 'done' ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold text-gray-400 hover:text-gray-600"
            >
              Αργότερα
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {STEPS[step].id === 'verify' && !verified ? (
            <button
              type="button"
              disabled={busy || !canCredentials}
              onClick={runVerify}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-teal-200 bg-white text-teal-800 text-sm font-bold disabled:opacity-50 hover:bg-teal-50"
            >
              <span className="material-symbols-outlined text-[18px]">wifi_tethering</span>
              {busy ? 'Έλεγχος…' : 'Έλεγχος σύνδεσης'}
            </button>
          ) : null}
          {STEPS[step].id === 'verify' ? (
            <button
              type="button"
              disabled={busy || (!verified && !canCredentials)}
              onClick={activate}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-teal-700 text-white text-sm font-bold shadow-lg shadow-teal-700/20 disabled:opacity-50 hover:bg-teal-800"
            >
              <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
              {busy ? 'Ενεργοποίηση…' : 'Ενεργοποίηση παρόχου'}
            </button>
          ) : STEPS[step].id === 'done' ? (
            <button
              type="button"
              onClick={() => (onCancel ? onCancel() : onActivated?.(null))}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-teal-700 text-white text-sm font-bold shadow-lg shadow-teal-700/20"
            >
              Ολοκλήρωση
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={STEPS[step].id === 'credentials' && !canCredentials}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-teal-700 text-white text-sm font-bold shadow-lg shadow-teal-700/20 disabled:opacity-50 hover:bg-teal-800"
            >
              Συνέχεια
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (compact) return body;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Ενεργοποίηση παρόχου"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Κλείσιμο"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full sm:w-auto max-h-[95vh] overflow-y-auto">{body}</div>
    </div>
  );
}
