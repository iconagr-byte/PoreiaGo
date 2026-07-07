import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_FISCAL_SETTINGS,
  FISCAL_PROVIDERS,
  fetchFiscalSettings,
  updateFiscalSettings,
} from '../../services/fiscalSettingsApi.js';
import FiscalPipelineHelp from './FiscalPipelineHelp.jsx';

const INPUT_CLASS =
  'mt-1.5 w-full rounded-xl border border-gray-200/90 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="mb-5">
      <h4 className="font-bold text-gray-900 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </span>
        {title}
      </h4>
      {subtitle ? <p className="text-sm text-gray-500 mt-2 ml-11">{subtitle}</p> : null}
    </div>
  );
}

function SecretField({ label, configured, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={configured ? '••••••••  (αφήστε κενό για να μείνει)' : placeholder}
        className={INPUT_CLASS}
      />
      {configured ? (
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
          Ρυθμισμένο — συμπληρώστε μόνο για αλλαγή
        </span>
      ) : null}
    </label>
  );
}

function TextField({ label, value, onChange, type = 'text', hint }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
      {hint ? <span className="text-xs text-gray-400 mt-1.5 block">{hint}</span> : null}
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className={INPUT_CLASS}
      />
    </label>
  );
}

function ProviderCard({ provider, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
        active
          ? 'border-primary bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] shadow-[0_8px_24px_rgba(0,64,223,0.08)] ring-1 ring-primary/20'
          : 'border-gray-200/90 bg-white hover:border-primary/25 hover:shadow-md'
      }`}
    >
      {active ? (
        <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-sm">
          <span className="material-symbols-outlined text-[16px]">check</span>
        </span>
      ) : null}
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
          active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-primary/10 group-hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-[22px]">{provider.icon}</span>
      </span>
      <div className="pr-6">
        <span className={`block text-sm font-bold ${active ? 'text-primary' : 'text-gray-900'}`}>
          {provider.label}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-gray-500">{provider.description}</span>
      </div>
    </button>
  );
}

export default function FiscalSettingsPanel() {
  const [form, setForm] = useState(DEFAULT_FISCAL_SETTINGS);
  const [secrets, setSecrets] = useState({
    prosvasis_s1code: '',
    prosvasis_bearer: '',
    epsilon_jwt: '',
    epsilon_subscription_key: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeProvider = FISCAL_PROVIDERS.find((p) => p.id === form.provider);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setForm(await fetchFiscalSettings());
      setSecrets({
        prosvasis_s1code: '',
        prosvasis_bearer: '',
        epsilon_jwt: '',
        epsilon_subscription_key: '',
      });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης ρυθμίσεων φορολογίας');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setProvider = (provider) => setForm((prev) => ({ ...prev, provider }));
  const setProsvasis = (patch) =>
    setForm((prev) => ({ ...prev, prosvasis: { ...prev.prosvasis, ...patch } }));
  const setEpsilon = (patch) =>
    setForm((prev) => ({ ...prev, epsilon: { ...prev.epsilon, ...patch } }));

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const patch = {
        provider: form.provider,
        issuer_vat: form.issuer_vat,
        series_retail: form.series_retail,
        series_invoice: form.series_invoice,
      };

      if (form.provider === 'prosvasis') {
        patch.prosvasis = {
          api_url: form.prosvasis.api_url,
          app_id: form.prosvasis.app_id,
          series_retail: form.prosvasis.series_retail,
          series_invoice: form.prosvasis.series_invoice,
          branch: form.prosvasis.branch,
          default_trdr: form.prosvasis.default_trdr,
          service_mtrl_code: form.prosvasis.service_mtrl_code,
          payment_codes: form.prosvasis.payment_codes,
        };
        if (secrets.prosvasis_s1code.trim()) patch.prosvasis.s1code = secrets.prosvasis_s1code.trim();
        if (secrets.prosvasis_bearer.trim()) patch.prosvasis.bearer_token = secrets.prosvasis_bearer.trim();
      }

      if (form.provider === 'epsilon') {
        patch.epsilon = {
          smart_url: form.epsilon.smart_url,
          retail_item_code: form.epsilon.retail_item_code,
          wholesale_item_code: form.epsilon.wholesale_item_code,
        };
        if (secrets.epsilon_jwt.trim()) patch.epsilon.jwt = secrets.epsilon_jwt.trim();
        if (secrets.epsilon_subscription_key.trim()) {
          patch.epsilon.subscription_key = secrets.epsilon_subscription_key.trim();
        }
      }

      const data = await updateFiscalSettings(patch);
      setForm(data);
      setSecrets({
        prosvasis_s1code: '',
        prosvasis_bearer: '',
        epsilon_jwt: '',
        epsilon_subscription_key: '',
      });
      toast.success('Οι ρυθμίσεις φορολογικής έκδοσης αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="bg-white rounded-[28px] border border-black/[0.06] p-10 text-center text-gray-400 shadow-sm">
        <span className="material-symbols-outlined text-4xl mb-3 animate-pulse text-primary/40">receipt_long</span>
        <p>Φόρτωση ρυθμίσεων φορολογίας…</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-[28px] border border-black/[0.06] shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-violet-500/[0.04] to-white">
        <div>
          <h3 className="font-bold text-xl flex items-center gap-2 text-gray-900">
            <span className="material-symbols-outlined text-primary">receipt_long</span>
            Φορολογική έκδοση
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            ΑΠΥ & τιμολόγια μετά την πληρωμή — myDATA MARK, Celery pipeline, email/SMS επιβεβαίωση
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeProvider ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/15">
              <span className="material-symbols-outlined text-[16px]">{activeProvider.icon}</span>
              {activeProvider.label}
            </span>
          ) : null}
          <FiscalPipelineHelp className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-200/80 bg-white text-violet-800 text-xs font-bold hover:bg-violet-50 shadow-sm transition-colors" />
        </div>
      </div>

      <form onSubmit={onSave} className="p-6 space-y-8">
        <div>
          <SectionHeader
            icon="storefront"
            title="Πάροχος φορολογικής έκδοσης"
            subtitle="Επιλέξτε πώς εκδίδονται ΑΠΥ/τιμολόγια μετά την πληρωμή."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {FISCAL_PROVIDERS.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                active={form.provider === p.id}
                onSelect={() => setProvider(p.id)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-5 sm:p-6">
          <SectionHeader icon="badge" title="Στοιχεία εκδότη" />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="ΑΦΜ εκδότη"
              value={form.issuer_vat}
              onChange={(v) => setForm((prev) => ({ ...prev, issuer_vat: v }))}
            />
            <TextField
              label="Σειρά λιανικής (ΑΠΥ)"
              value={form.series_retail}
              onChange={(v) => setForm((prev) => ({ ...prev, series_retail: v }))}
            />
            <TextField
              label="Σειρά τιμολογίου"
              value={form.series_invoice}
              onChange={(v) => setForm((prev) => ({ ...prev, series_invoice: v }))}
            />
          </div>
          {form.provider === 'native_aade' ? (
            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/50 p-4">
              <span className="material-symbols-outlined text-amber-600 shrink-0">info</span>
              <p className="text-sm text-amber-900/90 leading-relaxed">
                Για <strong>Native AADE</strong>, τα credentials (
                <code className="text-xs bg-white/70 px-1 rounded">AADE_USER_ID</code>,{' '}
                <code className="text-xs bg-white/70 px-1 rounded">AADE_SUBSCRIPTION_KEY</code>,{' '}
                <code className="text-xs bg-white/70 px-1 rounded">AADE_VAT_NUMBER</code>) ρυθμίζονται στο
                περιβάλλον του server — όχι εδώ.
              </p>
            </div>
          ) : null}
        </div>

        {form.provider === 'prosvasis' ? (
          <div className="rounded-2xl border border-sky-100 bg-sky-50/30 p-5 sm:p-6 space-y-4">
            <SectionHeader
              icon="cloud_sync"
              title="Prosvasis GO"
              subtitle="Σύνδεση με S1 Cloud API — κωδικοί και σειρές έκδοσης."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="API URL" value={form.prosvasis.api_url} onChange={(v) => setProsvasis({ api_url: v })} />
              <TextField label="App ID" value={form.prosvasis.app_id} onChange={(v) => setProsvasis({ app_id: v })} />
              <SecretField
                label="S1 Code"
                configured={form.prosvasis.s1code_configured}
                value={secrets.prosvasis_s1code}
                onChange={(v) => setSecrets((s) => ({ ...s, prosvasis_s1code: v }))}
                placeholder="Κωδικός S1"
              />
              <SecretField
                label="Bearer token"
                configured={form.prosvasis.bearer_token_configured}
                value={secrets.prosvasis_bearer}
                onChange={(v) => setSecrets((s) => ({ ...s, prosvasis_bearer: v }))}
                placeholder="Token API"
              />
              <NumberField
                label="Series retail (αριθμός)"
                value={form.prosvasis.series_retail}
                onChange={(v) => setProsvasis({ series_retail: v })}
              />
              <NumberField
                label="Series invoice (αριθμός)"
                value={form.prosvasis.series_invoice}
                onChange={(v) => setProsvasis({ series_invoice: v })}
              />
              <NumberField label="Υποκατάστημα (branch)" value={form.prosvasis.branch} onChange={(v) => setProsvasis({ branch: v })} />
              <TextField
                label="Κωδικός υπηρεσίας (mtrl)"
                value={form.prosvasis.service_mtrl_code}
                onChange={(v) => setProsvasis({ service_mtrl_code: v })}
              />
            </div>
          </div>
        ) : null}

        {form.provider === 'epsilon' ? (
          <div className="rounded-2xl border border-violet-100 bg-violet-50/25 p-5 sm:p-6 space-y-4">
            <SectionHeader
              icon="hub"
              title="Epsilon Smart"
              subtitle="JWT και κωδικοί ειδών για λιανική / χονδρική."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Smart URL"
                value={form.epsilon.smart_url}
                onChange={(v) => setEpsilon({ smart_url: v })}
              />
              <SecretField
                label="JWT / Bearer"
                configured={form.epsilon.jwt_configured}
                value={secrets.epsilon_jwt}
                onChange={(v) => setSecrets((s) => ({ ...s, epsilon_jwt: v }))}
                placeholder="JWT token"
              />
              <SecretField
                label="Subscription key (προαιρετικό)"
                configured={form.epsilon.subscription_key_configured}
                value={secrets.epsilon_subscription_key}
                onChange={(v) => setSecrets((s) => ({ ...s, epsilon_subscription_key: v }))}
                placeholder="Ocp-Apim-Subscription-Key"
              />
              <TextField
                label="Κωδικός είδους λιανικής"
                value={form.epsilon.retail_item_code}
                onChange={(v) => setEpsilon({ retail_item_code: v })}
              />
              <TextField
                label="Κωδικός είδους χονδρικής"
                value={form.epsilon.wholesale_item_code}
                onChange={(v) => setEpsilon({ wholesale_item_code: v })}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 max-w-md">
            Οι αλλαγές ισχύουν για νέες εκδόσεις μετά την αποθήκευση. Για ουρά & σφάλματα, δείτε Πληρωμές → Fiscal.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>
      </form>
    </section>
  );
}
