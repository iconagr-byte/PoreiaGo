import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AGENCY_PLANS,
  BILLING_INTERVALS,
  displayPrice,
} from '../../lib/billing/planCatalog.js';
import {
  createBillingCheckout,
  createBillingPortal,
  fetchBillingSubscription,
} from '../../services/billingApi.js';
import { getSaasToken } from '../../services/saasApi.js';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-800',
  trialing: 'bg-sky-100 text-sky-800',
  past_due: 'bg-amber-100 text-amber-900',
  canceled: 'bg-rose-100 text-rose-800',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('el-GR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function ContractsPanel({ initialPlan, initialInterval = 'month' }) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [interval, setInterval] = useState(initialInterval);
  const [selectedPlan, setSelectedPlan] = useState(initialPlan || 'professional');

  const load = useCallback(async () => {
    if (!getSaasToken()) {
      setSub(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setSub(await fetchBillingSubscription());
    } catch (e) {
      toast.error(e.message || 'Αποτυχία φόρτωσης συνδρομής');
      setSub(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === 'success') {
      toast.success('Το συμβόλαιο ενεργοποιήθηκε — ενημερώνουμε…');
      load();
    }
  }, [load]);

  useEffect(() => {
    if (initialPlan) setSelectedPlan(initialPlan);
    if (initialInterval) setInterval(initialInterval);
  }, [initialPlan, initialInterval]);

  const startCheckout = async () => {
    setWorking(true);
    try {
      const { checkout_url: url } = await createBillingCheckout(selectedPlan, interval);
      if (url) window.location.href = url;
      else toast.error('Δεν επιστράφηκε checkout URL');
    } catch (e) {
      toast.error(e.message || 'Αποτυχία ενεργοποίησης συμβολαίου');
    } finally {
      setWorking(false);
    }
  };

  const openPortal = async () => {
    setWorking(true);
    try {
      const { portal_url: url } = await createBillingPortal();
      if (url) window.location.href = url;
    } catch (e) {
      toast.error(e.message || 'Portal απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  if (!getSaasToken()) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-6 text-sm space-y-3">
        <p>Συνδεθείτε για να διαχειριστείτε το συμβόλαιο του γραφείου σας.</p>
        <Link to="/admin/login" className="text-primary font-bold hover:underline">
          Σύνδεση διαχείρισης
        </Link>
      </div>
    );
  }

  const catalogPlan = AGENCY_PLANS.find((p) => p.id === selectedPlan) || AGENCY_PLANS[1];
  const quote = displayPrice(catalogPlan, interval);

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-[24px] border border-black/[0.06] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">description</span>
              Συμβόλαιο γραφείου
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Επιλέξτε μηνιαίο ή ετήσιο πλάνο · πληρωμή μέσω Stripe
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
            title="Ανανέωση"
          >
            <span className="material-symbols-outlined text-[20px]">refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse h-20 bg-gray-100 rounded-2xl mb-6" />
        ) : sub ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <MiniStat label="Ενεργό πλάνο" value={sub.plan} />
            <MiniStat
              label="Κατάσταση"
              value={
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[sub.status] || 'bg-gray-100'}`}>
                  {sub.status}
                </span>
              }
            />
            <MiniStat label="Λήξη περιόδου" value={formatDate(sub.current_period_end)} />
            <MiniStat
              label="Γραφείο ενεργό"
              value={sub.is_active ? 'Ναι' : 'Αναστολή'}
              warn={!sub.is_active}
            />
          </div>
        ) : null}

        <div className="inline-flex p-1 rounded-full bg-surface-container-low border mb-6">
          {Object.values(BILLING_INTERVALS).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setInterval(opt.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                interval === opt.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {AGENCY_PLANS.filter((p) => !p.contactSales).map((plan) => {
            const p = displayPrice(plan, interval);
            const active = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                className={`text-left rounded-2xl p-4 border transition-all ${
                  active
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-black/[0.06] hover:border-primary/30'
                }`}
              >
                <p className="font-bold">{plan.name}</p>
                <p className="text-lg font-bold mt-1">
                  {p.label}
                  <span className="text-sm text-gray-500">{p.suffix}</span>
                </p>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl bg-surface-container-low p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Επιλεγμένο συμβόλαιο</p>
            <p className="font-bold text-lg">
              {catalogPlan.name} · {BILLING_INTERVALS[interval]?.label} — {quote.label}
              {quote.suffix}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={working}
              onClick={startCheckout}
              className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold disabled:opacity-50"
            >
              Ενεργοποίηση / αναβάθμιση
            </button>
            <button
              type="button"
              disabled={working}
              onClick={openPortal}
              className="px-5 py-2.5 border border-primary/30 text-primary rounded-full text-sm font-bold"
            >
              Διαχείριση στο Stripe
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Δημόσιες τιμές: <Link to="/grafeia" className="text-primary font-semibold hover:underline">/grafeia</Link>
        </p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, warn }) {
  return (
    <div className={`rounded-xl p-3 ${warn ? 'bg-rose-50' : 'bg-surface-container-low'}`}>
      <dt className="text-[10px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="font-bold mt-0.5">{value}</dd>
    </div>
  );
}
