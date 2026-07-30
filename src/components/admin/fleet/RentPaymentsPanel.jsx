/**
 * Rent desk — payment controls for /rent checkout (deposit + methods + bank).
 * Uses the office payment settings store (same as Πληρωμές).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  DEFAULT_PAYMENT_SETTINGS,
  normalizePaymentSettings,
  toLegacyCheckoutShape,
} from '../../../lib/payments/paymentSettings.js';
import { formatIbanDisplay } from '../../../lib/payments/bankTransfer.js';
import {
  fetchAdminPaymentSettings,
  updatePaymentSettings,
} from '../../../services/paymentSettingsApi.js';

const METHOD_KEYS = [
  { id: 'card', label: 'Κάρτα' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'apple', label: 'Apple Pay' },
  { id: 'bank_transfer', label: 'Τραπεζική μεταφορά' },
  { id: 'cash_office', label: 'Μετρητά στην παραλαβή' },
];

export default function RentPaymentsPanel() {
  const [settings, setSettings] = useState(() => normalizePaymentSettings(DEFAULT_PAYMENT_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminPaymentSettings();
      const next = normalizePaymentSettings(data);
      setSettings(next);
      setBaseline(JSON.stringify(next));
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης πληρωμών');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => JSON.stringify(settings) !== baseline, [settings, baseline]);
  const legacy = useMemo(() => toLegacyCheckoutShape(settings), [settings]);

  const setDeposit = (patch) =>
    setSettings((s) => ({
      ...s,
      deposit: { ...s.deposit, ...patch },
    }));

  const setMethod = (id, enabled) =>
    setSettings((s) => ({
      ...s,
      methods: {
        ...s.methods,
        [id]: { ...(s.methods?.[id] || {}), enabled },
      },
    }));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await updatePaymentSettings({
        deposit: settings.deposit,
        methods: settings.methods,
      });
      const next = normalizePaymentSettings(saved);
      setSettings(next);
      setBaseline(JSON.stringify(next));
      toast.success('Οι ρυθμίσεις πληρωμής ενοικιάσεων αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 py-8">Φόρτωση πληρωμών…</p>;
  }

  const bank = (settings.bank_accounts || []).find((a) => a.enabled !== false && a.iban);

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700/80 mb-1">
            Checkout · /rent
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Πληρωμές</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Προκαταβολή, τρόποι πληρωμής και μετρητά στην παραλαβή για το βήμα «Ολοκληρώνω την
            κράτηση». Οι τραπεζικοί λογαριασμοί διαχειρίζονται από τις γενικές ρυθμίσεις.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin?tab=settings&sub=payments"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            Πλήρες μενού Πληρωμές
          </Link>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? 'Αποθήκευση…' : dirty ? 'Αποθήκευση' : 'Αποθηκευμένο'}
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-700">savings</span>
            <h3 className="font-bold text-slate-900">Προκαταβολή</h3>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300"
              checked={settings.deposit?.enabled !== false}
              onChange={(e) => setDeposit({ enabled: e.target.checked })}
            />
            <span>
              <span className="font-bold text-slate-800 block text-sm">Ενεργή στο /rent</span>
              <span className="text-xs text-slate-500">
                Ο πελάτης μπορεί να πληρώσει ποσοστό τώρα και το υπόλοιπο στην παραλαβή.
              </span>
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700 text-xs">Ποσοστό προκαταβολής</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={90}
                className="w-24 rounded-xl border px-3 py-2"
                value={settings.deposit?.percent ?? 30}
                disabled={settings.deposit?.enabled === false}
                onChange={(e) => setDeposit({ percent: Number(e.target.value) || 30 })}
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </label>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-700">payments</span>
            <h3 className="font-bold text-slate-900">Τρόποι πληρωμής</h3>
          </div>
          {METHOD_KEYS.map((m) => (
            <label
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
            >
              <span className="text-sm font-bold text-slate-800">{m.label}</span>
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={settings.methods?.[m.id]?.enabled !== false}
                onChange={(e) => setMethod(m.id, e.target.checked)}
              />
            </label>
          ))}
        </section>
      </div>

      <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-800/70 mb-2">
          Τράπεζα (προεπισκόπηση)
        </p>
        {bank ? (
          <dl className="grid sm:grid-cols-2 gap-2 text-sm text-teal-950">
            <div>
              <dt className="text-xs text-teal-800/70">Τράπεζα</dt>
              <dd className="font-bold">{bank.bank_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-teal-800/70">Δικαιούχος</dt>
              <dd className="font-bold">{bank.beneficiary}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-teal-800/70">IBAN</dt>
              <dd className="font-mono font-bold">{formatIbanDisplay(bank.iban)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-teal-900/80">
            Δεν υπάρχει ενεργός λογαριασμός. Πρόσθεσε IBAN από{' '}
            <Link className="underline font-bold" to="/admin?tab=settings&sub=payments">
              Ρυθμίσεις → Πληρωμές
            </Link>
            .
          </p>
        )}
        <p className="mt-3 text-xs text-teal-900/70">
          Προεπιλογή checkout: προκαταβολή{' '}
          {legacy.checkout_deposit_enabled ? `${legacy.checkout_deposit_percent}%` : 'ανενεργή'}.
        </p>
      </section>

      {dirty ? (
        <div className="sticky bottom-3 z-10 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
          >
            Αποθήκευση αλλαγών
          </button>
        </div>
      ) : null}
    </div>
  );
}
