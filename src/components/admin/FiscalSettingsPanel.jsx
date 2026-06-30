import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_FISCAL_SETTINGS,
  FISCAL_PROVIDERS,
  fetchFiscalSettings,
  updateFiscalSettings,
} from '../../services/fiscalSettingsApi.js';
import FiscalPipelineHelp from './FiscalPipelineHelp.jsx';

function SecretField({ label, configured, value, onChange, placeholder }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={configured ? '••••••••  (αφήστε κενό για να μείνει)' : placeholder}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
      />
      {configured ? (
        <span className="text-xs text-emerald-600">Ρυθμισμένο — συμπληρώστε μόνο για αλλαγή</span>
      ) : null}
    </label>
  );
}

function TextField({ label, value, onChange, type = 'text', hint }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
      />
      {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
      />
    </label>
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
    return <p className="text-center text-gray-400 py-12">Φόρτωση ρυθμίσεων φορολογίας…</p>;
  }

  return (
    <form onSubmit={onSave} className="space-y-8">
      <section className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Πάροχος φορολογικής έκδοσης</h2>
            <p className="text-sm text-gray-500">
              Επιλέξτε πώς εκδίδονται ΑΠΥ/τιμολόγια μετά την πληρωμή (myDATA MARK).
            </p>
          </div>
          <FiscalPipelineHelp />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {FISCAL_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                form.provider === p.id
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Στοιχεία εκδότη</h3>
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
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Για Native AADE, τα credentials (AADE_USER_ID, AADE_SUBSCRIPTION_KEY, AADE_VAT_NUMBER)
            ρυθμίζονται στο περιβάλλον του server — όχι εδώ.
          </p>
        ) : null}
      </section>

      {form.provider === 'prosvasis' ? (
        <section className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Prosvasis GO</h3>
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
        </section>
      ) : null}

      {form.provider === 'epsilon' ? (
        <section className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Epsilon Smart</h3>
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
        </section>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      </div>
    </form>
  );
}
