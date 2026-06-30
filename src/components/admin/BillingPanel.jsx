import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createBillingCheckout,
  createBillingPortal,
  fetchBillingSubscription,
} from '../../services/billingApi.js';
import { getSaasToken } from '../../services/saasApi.js';

const PLAN_LABELS = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-800',
  trialing: 'bg-sky-100 text-sky-800',
  past_due: 'bg-amber-100 text-amber-900',
  canceled: 'bg-rose-100 text-rose-800',
  unpaid: 'bg-rose-100 text-rose-800',
  incomplete: 'bg-gray-100 text-gray-700',
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

export default function BillingPanel() {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

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
      toast.success('Η πληρωμή ολοκληρώθηκε — ενημερώνουμε τη συνδρομή…');
      load();
    } else if (params.get('billing') === 'cancel') {
      toast('Η πληρωμία ακυρώθηκε', { icon: 'ℹ️' });
    }
  }, [load]);

  const openCheckout = async (plan) => {
    setWorking(true);
    try {
      const { checkout_url: url } = await createBillingCheckout(plan);
      if (url) window.location.href = url;
      else toast.error('Δεν επιστράφηκε checkout URL');
    } catch (e) {
      toast.error(e.message || 'Stripe checkout απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  const openPortal = async () => {
    setWorking(true);
    try {
      const { portal_url: url } = await createBillingPortal();
      if (url) window.location.href = url;
      else toast.error('Δεν επιστράφηκε portal URL');
    } catch (e) {
      toast.error(e.message || 'Customer portal απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  if (!getSaasToken()) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-6 text-sm text-amber-900">
        Συνδεθείτε με JWT SaaS για διαχείριση συνδρομής.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-[24px] border border-black/[0.06] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">payments</span>
              Συνδρομή & Billing
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Stripe checkout · customer portal · metered usage (λεωφορεία + εκδρομές)
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
          <div className="animate-pulse h-24 bg-gray-100 rounded-2xl" />
        ) : sub ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Πλάνο" value={PLAN_LABELS[sub.plan] || sub.plan} />
            <StatCard
              label="Κατάσταση"
              value={
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                    STATUS_STYLES[sub.status] || STATUS_STYLES.incomplete
                  }`}
                >
                  {sub.status}
                </span>
              }
            />
            <StatCard
              label="Tenant ενεργό"
              value={sub.is_active ? 'Ναι' : 'Όχι (suspended)'}
              warn={!sub.is_active}
            />
            <StatCard label="Περίοδος έως" value={formatDate(sub.current_period_end)} />
            <StatCard
              label="Βασικό ποσό"
              value={
                sub.base_amount_cents
                  ? `€${(sub.base_amount_cents / 100).toFixed(2)}/μήνα`
                  : '—'
              }
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-6">Δεν βρέθηκε συνδρομή.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={working}
            onClick={() => openCheckout('professional')}
            className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-50"
          >
            Stripe Checkout
          </button>
          <button
            type="button"
            disabled={working}
            onClick={openPortal}
            className="px-5 py-2.5 border border-primary/30 text-primary rounded-full text-sm font-bold hover:bg-primary/5 disabled:opacity-50"
          >
            Διαχείριση συνδρομής (Portal)
          </button>
        </div>

        <p className="text-xs text-on-surface-variant mt-4">
          Απαιτούνται <code className="bg-gray-100 px-1 rounded">STRIPE_*</code> env vars στο backend.
          Μετά την πληρωμή επιστρέφετε στο admin με{' '}
          <code className="bg-gray-100 px-1 rounded">?billing=success</code>.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, warn }) {
  return (
    <div
      className={`rounded-xl p-4 ${
        warn ? 'bg-rose-50 ring-1 ring-rose-200/60' : 'bg-surface-container-low'
      }`}
    >
      <dt className="text-xs uppercase tracking-wide text-on-surface-variant">{label}</dt>
      <dd className="font-bold text-on-surface mt-1">{value}</dd>
    </div>
  );
}
