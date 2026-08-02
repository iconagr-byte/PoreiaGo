import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AGENCY_PLANS,
  BILLING_INTERVALS,
  RENT_ADDON,
  RENT_STANDALONE_PLAN,
  displayPrice,
  isBillablePlanId,
  listVisibleAgencyPlans,
  mergeAgencyPlanCatalog,
  mergeRentPlanCatalog,
  rentAddonDisplayPrice,
} from '../../lib/billing/planCatalog.js';
import {
  createBillingCheckout,
  createBillingPortal,
  enableBillingRentAddon,
  fetchBillingConfig,
  fetchBillingSubscription,
  startBillingTrial,
} from '../../services/billingApi.js';
import { fetchAdminOfficeModules } from '../../services/officeModulesApi.js';
import { getSaasToken } from '../../services/saasApi.js';
import { fetchPublicAgencyPlanCatalog } from '../../services/agencyPlanCatalogApi.js';
import { fetchPublicRentPlanCatalog } from '../../services/rentPlanCatalogApi.js';
import AgencyPlanCatalogEditor from './AgencyPlanCatalogEditor.jsx';
import RentPlanCardsEditor from './fleet/RentPlanCardsEditor.jsx';

const PLAN_ICONS = {
  starter: 'storefront',
  professional: 'apartment',
  enterprise: 'domain',
  rent: 'car_rental',
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

function planDisplayName(planId, agencyPlans = AGENCY_PLANS, rentStandalone = RENT_STANDALONE_PLAN) {
  if (planId === rentStandalone.id) return rentStandalone.name;
  return agencyPlans.find((p) => p.id === planId)?.name || planId || '—';
}

function findCatalogPlan(planId, agencyPlans = AGENCY_PLANS, rentStandalone = RENT_STANDALONE_PLAN) {
  if (planId === rentStandalone.id) return rentStandalone;
  return agencyPlans.find((p) => p.id === planId) || agencyPlans[1] || AGENCY_PLANS[1];
}

export default function ContractsPanel({
  initialPlan,
  initialInterval = 'month',
  focusRentModule = false,
} = {}) {
  const [sub, setSub] = useState(null);
  const [billingConfig, setBillingConfig] = useState(null);
  const [modules, setModules] = useState(null);
  const [agencyCatalog, setAgencyCatalog] = useState(() => mergeAgencyPlanCatalog(null));
  const [rentCatalog, setRentCatalog] = useState(() => mergeRentPlanCatalog(null));
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [interval, setInterval] = useState(initialInterval);
  const [selectedPlan, setSelectedPlan] = useState(initialPlan || 'professional');
  const rentSectionRef = useRef(null);

  const agencyPlans = agencyCatalog.plans || AGENCY_PLANS;
  const visibleAgencyPlans = listVisibleAgencyPlans(agencyCatalog);
  const rentAddon = rentCatalog.addon || RENT_ADDON;
  const rentStandalone = rentCatalog.standalone || RENT_STANDALONE_PLAN;

  const loadCatalogs = useCallback(async () => {
    const [agency, rent] = await Promise.all([
      fetchPublicAgencyPlanCatalog().catch(() => mergeAgencyPlanCatalog(null)),
      fetchPublicRentPlanCatalog().catch(() => mergeRentPlanCatalog(null)),
    ]);
    setAgencyCatalog(agency);
    setRentCatalog(rent);
  }, []);

  const load = useCallback(async () => {
    if (!getSaasToken()) {
      setSub(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [subscription, config, officeModules] = await Promise.all([
        fetchBillingSubscription(),
        fetchBillingConfig().catch(() => null),
        fetchAdminOfficeModules().catch(() => null),
      ]);
      await loadCatalogs();
      setSub(subscription);
      setBillingConfig(config);
      setModules(officeModules);
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
  }, [loadCatalogs]);

  useEffect(() => {
    // Initial subscription fetch — setState happens after the async resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === 'success') {
      toast.success('Το συμβόλαιο ενεργοποιήθηκε — ενημερώνουμε…');
      void load();
    }
    const onCatalog = () => {
      void loadCatalogs();
    };
    window.addEventListener('agency-plan-catalog-changed', onCatalog);
    window.addEventListener('rent-plan-catalog-changed', onCatalog);
    return () => {
      window.removeEventListener('agency-plan-catalog-changed', onCatalog);
      window.removeEventListener('rent-plan-catalog-changed', onCatalog);
    };
  }, [load, loadCatalogs]);

  useEffect(() => {
    if (!focusRentModule || loading) return;
    rentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusRentModule, loading]);

  // Sync parent-provided plan/interval during render (avoids setState-in-effect).
  const [propSeed, setPropSeed] = useState({ plan: initialPlan, interval: initialInterval });
  if (initialPlan !== propSeed.plan || initialInterval !== propSeed.interval) {
    setPropSeed({ plan: initialPlan, interval: initialInterval });
    if (initialPlan) setSelectedPlan(initialPlan);
    if (initialInterval) setInterval(initialInterval);
  }

  const startCheckout = async () => {
    if (!isBillablePlanId(selectedPlan)) {
      toast.error('Αυτό το πλάνο είναι μόνο για marketing — επιλέξτε Starter, Professional ή Rent');
      return;
    }
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
    if (!isBillablePlanId(selectedPlan)) {
      toast.error('Αυτό το πλάνο είναι μόνο για marketing — επιλέξτε Starter, Professional ή Rent');
      return;
    }
    setWorking(true);
    try {
      const updated = await startBillingTrial(selectedPlan, interval);
      setSub(updated);
      toast.success(`Δωρεάν δοκιμή ${billingConfig?.trial_days || 14} ημερών ενεργοποιήθηκε`);
      const officeModules = await fetchAdminOfficeModules().catch(() => null);
      if (officeModules) setModules(officeModules);
      if (selectedPlan === 'rent') {
        toast.success('Το μενού Ενοικιάσεις είναι πλέον διαθέσιμο — κάνε refresh αν δεν φαίνεται.');
      }
    } catch (e) {
      toast.error(e.message || 'Αποτυχία ενεργοποίησης δοκιμής');
    } finally {
      setWorking(false);
    }
  };

  const enableRentAddon = async () => {
    setWorking(true);
    try {
      const result = await enableBillingRentAddon();
      setModules({
        trips_enabled: result.trips_enabled !== false,
        rent_enabled: Boolean(result.rent_enabled),
        plan: String(result.plan || sub?.plan || 'starter'),
        mode: String(result.mode || 'both'),
      });
      toast.success(result.message || 'Το Rent add-on ενεργοποιήθηκε');
      window.dispatchEvent(new Event('saas-session-changed'));
    } catch (e) {
      toast.error(e.message || 'Αποτυχία ενεργοποίησης Rent');
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

  const catalogPlan = findCatalogPlan(selectedPlan, agencyPlans, rentStandalone);
  const quote = displayPrice(catalogPlan, interval);
  const addonQuote = rentAddonDisplayPrice(interval, rentAddon);
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
  const rentEnabled = Boolean(modules?.rent_enabled);
  const rentOnly = rentEnabled && modules?.trips_enabled === false;
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
    <section className="bg-white rounded-[28px] border border-slate-200/70 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-primary/[0.06] via-white to-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[24px]">workspace_premium</span>
            </span>
            <div className="min-w-0">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Συμβόλαιο γραφείου</h3>
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Κατάσταση, πλάνο λεωφορείων και Rent — όλα σε ένα σημείο
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {demoMode && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
                <span className="material-symbols-outlined text-[16px]">science</span>
                Demo · {trialDays}η δοκιμή
              </span>
            )}
            {rentEnabled && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-900">
                <span className="material-symbols-outlined text-[16px]">car_rental</span>
                {rentOnly ? 'Rent ενεργό' : 'Rent add-on ενεργό'}
              </span>
            )}
            {!checkoutReady && !demoMode && billingConfig && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900">
                <span className="material-symbols-outlined text-[16px]">info</span>
                Πληρωμές σε ρύθμιση
              </span>
            )}
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
        </div>

        {!loading && sub && (
          <div className="mt-4 rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.className}`}>
              <span className="material-symbols-outlined text-[15px]">{statusMeta.icon}</span>
              {statusMeta.label}
            </span>
            <span className="text-sm font-bold text-slate-900">
              {planDisplayName(sub.plan, agencyPlans, rentStandalone)}
            </span>
            <span className="text-xs text-slate-500">
              Λήξη {formatDate(periodEnd)}
              {remaining != null && remaining >= 0 ? ` · ${remaining} ημ.` : ''}
            </span>
            <span
              className={`ml-auto inline-flex items-center gap-1 text-xs font-bold ${
                sub.is_active ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {sub.is_active ? 'check_circle' : 'pause_circle'}
              </span>
              Γραφείο {sub.is_active ? 'ενεργό' : 'σε αναστολή'}
            </span>
            {trialProgress != null && (
              <div className="w-full pt-1">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${trialProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 space-y-5">
        <AgencyPlanCatalogEditor />
        <RentPlanCardsEditor />

        {loading ? (
          <div className="h-40 animate-pulse rounded-[22px] bg-slate-100" />
        ) : (
          <>
            {!sub && (
              <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 text-center text-sm text-slate-500">
                Δεν υπάρχει ακόμα ενεργό συμβόλαιο — επιλέξτε πλάνο παρακάτω.
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Επιλέξτε πλάνο λεωφορείων</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Τα features εμφανίζονται από την παραμετροποίηση πάνω · Ετήσιο = 2 μήνες δώρο
                </p>
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

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
              {visibleAgencyPlans.map((plan) => {
                const p = displayPrice(plan, interval);
                const active = selectedPlan === plan.id;
                const isCurrent = sub?.plan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() =>
                      !plan.contactSales && isBillablePlanId(plan.id) && setSelectedPlan(plan.id)
                    }
                    className={`h-full flex flex-col text-left rounded-[22px] border p-5 transition ${
                      active && !plan.contactSales && isBillablePlanId(plan.id)
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
                            {plan.icon || PLAN_ICONS[plan.id] || 'workspace_premium'}
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

                    <ul className="mt-4 space-y-1.5 flex-1">
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

            <div
              ref={rentSectionRef}
              id="contracts-rent"
              className="scroll-mt-28 rounded-[22px] border border-slate-200/90 bg-gradient-to-b from-slate-50/80 via-white to-teal-50/30 p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800/80">Ενοικιάσεις</p>
                  <h4 className="text-lg font-bold text-slate-900 mt-0.5">Προσθήκη συμβολαίου Rent</h4>
                  <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    Ενεργοποίησε το Rent ως add-on πάνω στο τρέχον πλάνο λεωφορείων, ή διάλεξε αυτόνομο
                    συμβόλαιο μόνο για ενοικιάσεις.
                  </p>
                </div>
                {rentEnabled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300 bg-white px-3 py-1.5 text-xs font-bold text-teal-900">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    {rentOnly ? 'Αυτόνομο Rent ενεργό' : 'Add-on ενεργό'}
                  </span>
                ) : null}
              </div>

              <div className="grid md:grid-cols-2 gap-3 items-stretch">
                {rentAddon.visible !== false ? (
                  <div
                    className={`h-full flex flex-col rounded-[20px] border p-5 ${
                      rentEnabled && !rentOnly
                        ? 'border-teal-300 bg-white ring-2 ring-teal-100'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700">
                          {rentAddon.badge}
                        </p>
                        <p className="font-bold text-slate-900 text-lg mt-0.5">{rentAddon.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{rentAddon.tagline}</p>
                      </div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                      {addonQuote.label}
                      {addonQuote.suffix ? (
                        <span className="text-sm font-semibold text-slate-500">{addonQuote.suffix}</span>
                      ) : null}
                    </p>
                    <ul className="mt-3 space-y-1.5 flex-1">
                      {(rentAddon.features || []).slice(0, 4).map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <span className="material-symbols-outlined text-[14px] text-teal-700 mt-0.5">
                            check
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={working || (rentEnabled && !rentOnly) || rentOnly}
                      onClick={enableRentAddon}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-teal-700 text-white px-4 py-2.5 text-sm font-bold hover:bg-teal-800 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">car_rental</span>
                      {rentOnly
                        ? 'Ήδη σε αυτόνομο Rent'
                        : rentEnabled
                          ? 'Rent add-on ενεργό'
                          : 'Ενεργοποίηση Rent add-on'}
                    </button>
                  </div>
                ) : null}

                {rentStandalone.visible !== false ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(rentStandalone.id)}
                    className={`h-full flex flex-col text-left rounded-[20px] border p-5 transition ${
                      selectedPlan === rentStandalone.id
                        ? 'border-teal-400 bg-white ring-2 ring-teal-100 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700">
                          {rentStandalone.badge}
                        </p>
                        <p className="font-bold text-slate-900 text-lg mt-0.5">{rentStandalone.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{rentStandalone.tagline}</p>
                      </div>
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          selectedPlan === rentStandalone.id
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">directions_car</span>
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                      {displayPrice(rentStandalone, interval).label}
                      {displayPrice(rentStandalone, interval).suffix ? (
                        <span className="text-sm font-semibold text-slate-500">
                          {displayPrice(rentStandalone, interval).suffix}
                        </span>
                      ) : null}
                    </p>
                    {sub?.plan === 'rent' && (
                      <span className="inline-flex mt-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Τρέχον
                      </span>
                    )}
                    <ul className="mt-3 space-y-1.5 flex-1">
                      {(rentStandalone.features || []).slice(0, 4).map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <span className="material-symbols-outlined text-[14px] text-teal-700 mt-0.5">
                            check
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs font-semibold text-teal-800">
                      {selectedPlan === rentStandalone.id
                        ? 'Επιλεγμένο — πάτα δοκιμή / ενεργοποίηση κάτω'
                        : 'Πάτα για επιλογή αυτόνομου Rent'}
                    </p>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="sticky bottom-3 z-10 rounded-[22px] border border-primary/15 bg-gradient-to-r from-primary/[0.06] to-white backdrop-blur shadow-lg px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Επιλεγμένο</p>
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
          </>
        )}
      </div>
    </section>
  );
}
