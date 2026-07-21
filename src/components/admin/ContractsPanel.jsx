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
  fetchBillingConfig,
  fetchBillingSubscription,
  startBillingTrial,
} from '../../services/billingApi.js';
import { getSaasToken } from '../../services/saasApi.js';

const STATUS_META = {
  active: { label: 'Ενεργό', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80' },
  trialing: { label: 'Δοκιμή', className: 'bg-sky-50 text-sky-800 ring-sky-200/80' },
  past_due: { label: 'Εκκρεμής πληρωμή', className: 'bg-amber-50 text-amber-900 ring-amber-200/80' },
  canceled: { label: 'Ακυρωμένο', className: 'bg-rose-50 text-rose-800 ring-rose-200/80' },
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('el-GR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function planDisplayName(planId) {
  const found = AGENCY_PLANS.find((p) => p.id === planId);
  return found?.name || planId || '—';
}

export default function ContractsPanel({ initialPlan, initialInterval = 'month' }) {
  const [sub, setSub] = useState(null);
  const [billingConfig, setBillingConfig] = useState(null);
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
      const [subscription, config] = await Promise.all([
        fetchBillingSubscription(),
        fetchBillingConfig().catch(() => null),
      ]);
      setSub(subscription);
      setBillingConfig(config);
    } catch (e) {
      toast.error(e.message || 'Αποτυχία φόρτωσης συμβολαίου');
      setSub(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === 'success') {
      toast.success('Το συμβόλαιο ενεργοποιήθηκε');
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

  const startTrial = async () => {
    setWorking(true);
    try {
      const updated = await startBillingTrial(selectedPlan, interval);
      setSub(updated);
      toast.success(`Δωρεάν δοκιμή ${billingConfig?.trial_days || 14} ημερών ενεργοποιήθηκε`);
    } catch (e) {
      toast.error(e.message || 'Αποτυχία ενεργοποίησης δοκιμής');
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
      <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
            <span className="material-symbols-outlined">lock</span>
          </span>
          <div>
            <h3 className="text-lg font-bold text-amber-950">Απαιτείται σύνδεση</h3>
            <p className="mt-1 text-sm text-amber-900/80">
              Συνδεθείτε για να δείτε και να παραμετροποιήσετε τα συμβόλαια του γραφείου.
            </p>
            <Link
              to="/admin/login"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
            >
              Σύνδεση διαχείρισης
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const catalogPlan = AGENCY_PLANS.find((p) => p.id === selectedPlan) || AGENCY_PLANS[1];
  const quote = displayPrice(catalogPlan, interval);
  const checkoutReady = billingConfig?.checkout_ready === true;
  const trialDays = billingConfig?.trial_days || 14;
  const onTrial = sub?.status === 'trialing' && !sub?.stripe_subscription_id;
  const statusMeta = STATUS_META[sub?.status] || {
    label: sub?.status || '—',
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
  };

  return (
    <div className="space-y-5">
      {/* Intro */}
      <section className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.04)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(0,64,223,0.10),transparent_70%)]"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Ρυθμίσεις · Συμβόλαια
            </p>
            <h3 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[22px]">handshake</span>
              </span>
              Συμβόλαια γραφείου
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Ελέγξτε το ενεργό πλάνο, ξεκινήστε δοκιμή ή αναβαθμίστε μέσω Stripe. Μηνιαίο ή ετήσιο
              συμβόλαιο — χωρίς κρυφές χρεώσεις.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="Ανανέωση"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Ανανέωση
          </button>
        </div>
      </section>

      {billingConfig && !checkoutReady ? (
        <div className="rounded-[22px] border border-sky-200/80 bg-sky-50/90 px-5 py-4 text-sm text-sky-950">
          <p className="font-bold">Stripe δεν είναι πλήρως ρυθμισμένο ακόμα</p>
          <p className="mt-1 text-sky-900/80">
            Μπορείτε να ξεκινήσετε δωρεάν δοκιμή {trialDays} ημερών τώρα. Για πληρωμή κάρτας, ο
            διαχειριστής server προσθέτει τα Stripe keys (
            <code className="rounded bg-white/80 px-1 text-xs">deploy/STRIPE-SETUP.md</code>).
          </p>
        </div>
      ) : null}

      {/* Current contract */}
      <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-400">
            Τρέχον συμβόλαιο
          </h4>
          {sub ? (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : sub ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat icon="workspace_premium" label="Πλάνο" value={planDisplayName(sub.plan)} />
            <MiniStat
              icon="event"
              label="Λήξη περιόδου"
              value={formatDate(sub.current_period_end || sub.trial_ends_at)}
            />
            <MiniStat
              icon="storefront"
              label="Γραφείο"
              value={sub.is_active ? 'Ενεργό' : 'Σε αναστολή'}
              warn={!sub.is_active}
            />
            <MiniStat
              icon="payments"
              label="Τιμολόγηση"
              value={
                sub.stripe_subscription_id
                  ? 'Stripe'
                  : onTrial
                    ? `Δοκιμή ${trialDays}ημ.`
                    : '—'
              }
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
            <span className="material-symbols-outlined text-[32px] text-slate-300">contract</span>
            <p className="mt-2 text-sm font-semibold text-slate-800">Δεν υπάρχει ενεργό συμβόλαιο</p>
            <p className="mt-1 text-[13px] text-slate-500">
              Επιλέξτε πλάνο παρακάτω για δοκιμή ή ενεργοποίηση.
            </p>
          </div>
        )}
      </section>

      {/* Plan picker */}
      <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h4 className="text-lg font-bold tracking-tight text-slate-900">Επιλογή πλάνου</h4>
            <p className="mt-1 text-sm text-slate-500">Αλλάξτε διάστημα και επίπεδο υπηρεσίας</p>
          </div>
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {Object.values(BILLING_INTERVALS).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInterval(opt.id)}
                className={`relative rounded-full px-4 py-2 text-sm font-bold transition-all ${
                  interval === opt.id
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
                {opt.badge && interval === opt.id ? (
                  <span className="ml-1.5 text-[10px] font-bold text-emerald-600">{opt.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {AGENCY_PLANS.filter((p) => !p.contactSales).map((plan) => {
            const p = displayPrice(plan, interval);
            const active = selectedPlan === plan.id;
            const current = sub?.plan === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative flex h-full flex-col rounded-[22px] border p-5 text-left transition-all ${
                  active
                    ? 'border-primary bg-gradient-to-br from-primary/[0.07] to-white ring-2 ring-primary/15 shadow-[0_10px_28px_rgba(0,64,223,0.08)]'
                    : 'border-slate-200/90 bg-white hover:border-primary/25 hover:shadow-md'
                }`}
              >
                {plan.highlighted ? (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Δημοφιλές
                  </span>
                ) : null}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-slate-900">{plan.name}</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">{plan.tagline}</p>
                  </div>
                  {active ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-2xl font-black tracking-tight text-slate-900">
                  {p.label}
                  {p.suffix ? (
                    <span className="ml-1 text-sm font-semibold text-slate-400">{p.suffix}</span>
                  ) : null}
                </p>
                {current ? (
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                    Τρέχον πλάνο
                  </p>
                ) : null}
                <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                  {(plan.features || []).slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[12px] text-slate-600">
                      <span className="material-symbols-outlined mt-0.5 text-[14px] text-primary">
                        check
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-4 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Επιλεγμένο συμβόλαιο
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {catalogPlan.name} · {BILLING_INTERVALS[interval]?.label}
              <span className="ml-2 text-primary">
                {quote.label}
                {quote.suffix || ''}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {checkoutReady ? (
              <button
                type="button"
                disabled={working}
                onClick={startCheckout}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                Ενεργοποίηση / αναβάθμιση
              </button>
            ) : (
              <button
                type="button"
                disabled={working || (onTrial && sub?.plan === selectedPlan)}
                onClick={startTrial}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                {onTrial && sub?.plan === selectedPlan
                  ? `Δοκιμή ενεργή (${trialDays} ημέρες)`
                  : `Δωρεάν δοκιμή ${trialDays} ημερών`}
              </button>
            )}
            {checkoutReady && billingConfig?.portal_ready ? (
              <button
                type="button"
                disabled={working}
                onClick={openPortal}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/25 bg-white px-5 text-sm font-bold text-primary hover:bg-primary/[0.04] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                Διαχείριση στο Stripe
              </button>
            ) : null}
          </div>
        </div>

        <p className="mt-4 text-[12px] text-slate-400">
          Δημόσιες τιμές &amp; σύγκριση πλάνων:{' '}
          <Link to="/grafeia" className="font-semibold text-primary hover:underline">
            /grafeia
          </Link>
        </p>
      </section>
    </div>
  );
}

function MiniStat({ icon, label, value, warn }) {
  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        warn ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50/80'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </div>
      <dd className="mt-1.5 text-[15px] font-bold text-slate-900">{value}</dd>
    </div>
  );
}
