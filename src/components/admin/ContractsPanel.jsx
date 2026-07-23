import { useCallback, useEffect, useMemo, useState } from 'react';
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

const PLAN_ICONS = {
  starter: 'storefront',
  professional: 'apartment',
  enterprise: 'domain',
};

const STATUS_META = {
  active: {
    label: 'Ενεργό',
    icon: 'verified',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  trialing: {
    label: 'Δοκιμή',
    icon: 'hourglass_top',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  past_due: {
    label: 'Εκκρεμεί πληρωμή',
    icon: 'warning',
    className: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  canceled: {
    label: 'Ακυρωμένο',
    icon: 'cancel',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
  },
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

function daysUntil(iso) {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
}

function planDisplayName(planId) {
  return AGENCY_PLANS.find((p) => p.id === planId)?.name || planId || '—';
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
      if (subscription?.plan) setSelectedPlan(subscription.plan);
      if (subscription?.interval === 'year' || subscription?.interval === 'month') {
        setInterval(subscription.interval);
      }
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

  const catalogPlan = AGENCY_PLANS.find((p) => p.id === selectedPlan) || AGENCY_PLANS[1];
  const quote = displayPrice(catalogPlan, interval);
  const checkoutReady = billingConfig?.checkout_ready === true;
  const demoMode = billingConfig?.demo_mode === true;
  const trialDays = billingConfig?.trial_days || 14;
  const onTrial = sub?.status === 'trialing';
  const periodEnd = sub?.current_period_end || sub?.trial_ends_at;
  const remaining = useMemo(() => daysUntil(periodEnd), [periodEnd]);
  const statusMeta = STATUS_META[sub?.status] || {
    label: sub?.status || '—',
    icon: 'info',
    className: 'bg-slate-50 text-slate-700 border-slate-200',
  };
  const sameTrialPlan = onTrial && sub?.plan === selectedPlan;
  const hasToken = Boolean(getSaasToken());
  const trialProgress =
    onTrial && remaining != null && trialDays > 0
      ? Math.max(0, Math.min(100, Math.round(((trialDays - Math.max(remaining, 0)) / trialDays) * 100)))
      : null;

  if (!hasToken) {
    return (
      <div className="rounded-[28px] border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <span className="material-symbols-outlined text-[24px]">lock</span>
          </span>
          <div>
            <h3 className="font-bold text-lg text-amber-950">Απαιτείται σύνδεση</h3>
            <p className="text-sm text-amber-900/80 mt-1 leading-relaxed">
              Συνδεθείτε για να διαχειριστείτε το συμβόλαιο του γραφείου σας.
            </p>
            <Link
              to="/admin/login"
              className="inline-flex mt-4 px-5 py-2.5 rounded-full bg-amber-900 text-white text-sm font-bold hover:opacity-95"
            >
              Σύνδεση διαχείρισης
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {billingConfig && demoMode && (
        <div className="rounded-[22px] border border-amber-200/80 bg-gradient-to-r from-amber-50 to-white px-4 py-3.5 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <span className="material-symbols-outlined text-[20px]">science</span>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-950">Δωρεάν δοκιμή ενεργή</p>
            <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
              Μπορείτε να δοκιμάσετε το πλάνο για {trialDays} ημέρες χωρίς χρέωση. Όταν είστε έτοιμοι, ενεργοποιείτε
              την πληρωμή από εδώ.
            </p>
          </div>
        </div>
      )}

      {billingConfig && !checkoutReady && !demoMode && (
        <div className="rounded-[22px] border border-sky-200/80 bg-gradient-to-r from-sky-50 to-white px-4 py-3.5 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <span className="material-symbols-outlined text-[20px]">info</span>
          </span>
          <div>
            <p className="text-sm font-bold text-sky-950">Πληρωμές σε ρύθμιση</p>
            <p className="text-xs text-sky-900/80 mt-0.5 leading-relaxed">
              Μπορείτε να ξεκινήσετε δωρεάν δοκιμή {trialDays} ημερών τώρα. Η online πληρωμή θα ενεργοποιηθεί μόλις
              ολοκληρωθεί η ρύθμιση Stripe.
            </p>
          </div>
        </div>
      )}

      <section className="bg-white rounded-[28px] border border-slate-200/70 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-4 bg-gradient-to-r from-primary/5 via-white to-white">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </span>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Συμβόλαιο γραφείου</h3>
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Σύγκριση πλάνων, δωρεάν δοκιμή και διαχείριση συνδρομής σε ένα μέρος
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="Ανανέωση"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Ανανέωση
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="h-28 animate-pulse rounded-[22px] bg-slate-100" />
          ) : sub ? (
            <div className="rounded-[22px] border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${statusMeta.className}`}>
                    <span className="material-symbols-outlined text-[16px]">{statusMeta.icon}</span>
                    {statusMeta.label}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{planDisplayName(sub.plan)}</p>
                    <p className="text-xs text-slate-500">
                      Λήξη {formatDate(periodEnd)}
                      {remaining != null && remaining >= 0 ? ` · ${remaining} ημέρες ακόμα` : ''}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                    sub.is_active
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {sub.is_active ? 'check_circle' : 'pause_circle'}
                  </span>
                  Γραφείο {sub.is_active ? 'ενεργό' : 'σε αναστολή'}
                </span>
              </div>

              {trialProgress != null && (
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                    <span>Πρόοδος δοκιμής</span>
                    <span>
                      {Math.max(remaining, 0)} / {trialDays} ημέρες
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${trialProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
              Δεν υπάρχει ακόμα ενεργό συμβόλαιο — επιλέξτε πλάνο και ξεκινήστε δοκιμή ή πληρωμή.
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Επιλέξτε πλάνο</p>
              <p className="text-xs text-slate-500 mt-0.5">Κλικ στην κάρτα · ετήσιο = 2 μήνες δώρο</p>
            </div>
            <div className="inline-flex p-1 rounded-full bg-slate-100 border border-slate-200/80">
              {Object.values(BILLING_INTERVALS).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setInterval(opt.id)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                    interval === opt.id
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {opt.label}
                  {opt.badge && interval === opt.id && (
                    <span className="ml-1.5 text-[10px] font-bold text-emerald-600">{opt.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {AGENCY_PLANS.map((plan) => {
              const p = displayPrice(plan, interval);
              const active = selectedPlan === plan.id;
              const isCurrent = sub?.plan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => !plan.contactSales && setSelectedPlan(plan.id)}
                  className={`text-left rounded-[22px] border p-5 transition ${
                    active && !plan.contactSales
                      ? 'border-primary/40 bg-gradient-to-b from-primary/[0.07] to-white ring-2 ring-primary/15 shadow-sm'
                      : 'border-slate-200/90 bg-gradient-to-b from-slate-50/50 to-white hover:border-primary/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          active && !plan.contactSales
                            ? 'bg-primary/15 text-primary'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {PLAN_ICONS[plan.id] || 'workspace_premium'}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-lg">{plan.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{plan.tagline}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Τρέχον
                        </span>
                      )}
                      {plan.highlighted && !isCurrent && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          Προτεινόμενο
                        </span>
                      )}
                      {active && !plan.contactSales && (
                        <span className="material-symbols-outlined text-primary text-[22px]">check_circle</span>
                      )}
                    </div>
                  </div>

                  <p className="text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                    {p.label}
                    {p.suffix && <span className="text-sm font-semibold text-slate-500">{p.suffix}</span>}
                  </p>
                  {interval === 'year' && p.compareAt && (
                    <p className="text-xs text-emerald-700 font-semibold mt-1">
                      Αντί €{p.compareAt}/έτος — εξοικονόμηση €{p.compareAt - p.amount}
                    </p>
                  )}

                  <ul className="mt-4 space-y-1.5">
                    {(plan.features || []).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="material-symbols-outlined text-[14px] text-primary mt-0.5">check</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.contactSales && (
                    <Link
                      to="/grafeia"
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Επικοινωνία πωλήσεων
                    </Link>
                  )}
                </button>
              );
            })}
          </div>

          <div className="sticky bottom-3 z-10 rounded-[22px] border border-slate-200/80 bg-white/95 backdrop-blur shadow-lg px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Επιλεγμένο συμβόλαιο</p>
              <p className="font-bold text-slate-900 truncate">
                {catalogPlan.name} · {BILLING_INTERVALS[interval]?.label} — {quote.label}
                {quote.suffix || ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {checkoutReady && !demoMode ? (
                <button
                  type="button"
                  disabled={working}
                  onClick={startCheckout}
                  className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {working ? 'Αναμονή…' : 'Ενεργοποίηση / αναβάθμιση'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={working || sameTrialPlan}
                  onClick={startTrial}
                  className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {sameTrialPlan
                    ? `Δοκιμή ενεργή (${trialDays} ημέρες)`
                    : `Ξεκινήστε δωρεάν δοκιμή ${trialDays} ημερών`}
                </button>
              )}
              {checkoutReady && billingConfig?.portal_ready && (
                <button
                  type="button"
                  disabled={working}
                  onClick={openPortal}
                  className="px-5 py-2.5 border border-primary/25 text-primary rounded-full text-sm font-bold hover:bg-primary/[0.05] disabled:opacity-50"
                >
                  Διαχείριση πληρωμών
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Δημόσια σύγκριση τιμών:{' '}
            <Link to="/grafeia" className="text-primary font-semibold hover:underline">
              /grafeia
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
