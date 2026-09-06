import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import {
  BILLING_INTERVALS,
  DEFAULT_AGENCY_SECTION_TITLE,
  DEFAULT_RENT_SECTION_TITLE,
  RENT_ADDON,
  RENT_STANDALONE_PLAN,
  displayPrice,
  isBillablePlanId,
  listVisibleAgencyPlans,
  mergeAgencyPlanCatalog,
  mergeRentPlanCatalog,
  rentAddonDisplayPrice,
  rentStandaloneDisplayPrice,
} from '../lib/billing/planCatalog.js';
import { CAMPAIGN_TEMPLATE_COUNT } from '../lib/marketing/platformCopy.js';
import { getSaasToken } from '../services/saasApi.js';
import { fetchPublicAgencyPlanCatalog } from '../services/agencyPlanCatalogApi.js';
import { fetchPublicRentPlanCatalog } from '../services/rentPlanCatalogApi.js';

export default function AgencyPlansPage() {
  const navigate = useNavigate();
  const [interval, setInterval] = useState('month');
  const loggedIn = Boolean(getSaasToken());
  const [rentCatalog, setRentCatalog] = useState(() => mergeRentPlanCatalog(null));
  const [agencyCatalog, setAgencyCatalog] = useState(() => mergeAgencyPlanCatalog(null));

  useEffect(() => {
    let cancelled = false;
    const loadAll = () => {
      Promise.all([fetchPublicRentPlanCatalog(), fetchPublicAgencyPlanCatalog()]).then(
        ([rent, agency]) => {
          if (!cancelled) {
            setRentCatalog(rent);
            setAgencyCatalog(agency);
          }
        },
      );
    };
    loadAll();
    const onAgency = () => {
      fetchPublicAgencyPlanCatalog().then((agency) => {
        if (!cancelled) setAgencyCatalog(agency);
      });
    };
    const onRent = () => {
      fetchPublicRentPlanCatalog().then((rent) => {
        if (!cancelled) setRentCatalog(rent);
      });
    };
    window.addEventListener('agency-plan-catalog-changed', onAgency);
    window.addEventListener('rent-plan-catalog-changed', onRent);
    return () => {
      cancelled = true;
      window.removeEventListener('agency-plan-catalog-changed', onAgency);
      window.removeEventListener('rent-plan-catalog-changed', onRent);
    };
  }, []);

  const standalone = rentCatalog.standalone || RENT_STANDALONE_PLAN;
  const addon = rentCatalog.addon || RENT_ADDON;
  const agencyPlans = listVisibleAgencyPlans(agencyCatalog);
  const rentStandalonePrice = rentStandaloneDisplayPrice(interval, standalone);
  const rentAddonPrice = rentAddonDisplayPrice(interval, addon);
  const visibleCards = [standalone.visible !== false, addon.visible !== false].filter(Boolean)
    .length;
  const rentGridClass =
    visibleCards <= 1 ? 'grid md:grid-cols-1 max-w-xl gap-6' : 'grid md:grid-cols-2 gap-6';

  const choosePlan = (planId) => {
    const selected = agencyPlans.find((p) => p.id === planId);
    if (
      selected?.contactSales ||
      planId === 'enterprise' ||
      (planId !== 'rent' && !isBillablePlanId(planId))
    ) {
      window.location.href = `mailto:sales@travelos.app?subject=${encodeURIComponent(
        `${selected?.name || planId} συμβόλαιο`,
      )}`;
      return;
    }
    if (loggedIn) {
      navigate('/admin', {
        state: {
          activeTab: 'settings',
          settingsSubTab: 'contracts',
          plan: planId,
          interval,
          focusRentModule: planId === 'rent',
        },
      });
      return;
    }
    navigate(`/grafeia/signup?plan=${planId}&interval=${interval}`);
  };

  const openRentAddon = () => {
    if (loggedIn) {
      navigate('/admin', {
        state: {
          activeTab: 'settings',
          settingsSubTab: 'contracts',
          interval,
          focusRentModule: true,
        },
      });
      return;
    }
    navigate(`/grafeia/signup?plan=professional&interval=${interval}&addon=rent`);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <PlatformBrand variant="light" />
          <nav className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold text-gray-600 hover:text-primary hidden sm:inline">
              Αρχική
            </Link>
            <Link
              to="/rent"
              className="text-sm font-semibold text-teal-700 hover:text-teal-900 hidden sm:inline"
            >
              Υπηρεσία Rent
            </Link>
            <Link
              to="/admin/login"
              className="text-sm font-bold px-4 py-2 rounded-full bg-gray-900 text-white hover:opacity-90"
            >
              Σύνδεση γραφείου
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 md:py-16 space-y-14">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">description</span>
            Συμβόλαια SaaS
          </span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Λεωφορεία · Rent μόνο · ή και τα δύο
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base">
            Core πλάνα για εκδρομές & στόλο · αυτόνομο συμβόλαιο Rent · add-on Ενοικιάσεις πάνω στα
            λεωφορεία
          </p>

          <div className="inline-flex p-1 rounded-full bg-surface-container-low border border-black/[0.06] mt-6">
            {Object.values(BILLING_INTERVALS).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInterval(opt.id)}
                className={`relative px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  interval === opt.id
                    ? 'bg-white text-primary shadow-md'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {opt.label}
                {opt.badge && interval === opt.id && (
                  <span className="absolute -top-2 -right-1 text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                    -17%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <section className="space-y-5">
          <h2 className="text-xl font-bold tracking-tight">
            {agencyCatalog.sectionTitle || DEFAULT_AGENCY_SECTION_TITLE}
          </h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
            {agencyPlans.map((plan) => {
              const price = displayPrice(plan, interval);
              return (
                <article
                  key={plan.id}
                  className={`relative h-full flex flex-col rounded-[28px] border p-6 md:p-8 ${
                    plan.highlighted
                      ? 'border-sky-300/70 bg-white shadow-[0_16px_40px_rgba(14,165,233,0.12)] ring-1 ring-sky-200'
                      : 'border-black/[0.07] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]'
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sky-600 text-white text-xs font-bold rounded-full shadow-sm">
                      Προτεινόμενο
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-sky-700 text-[22px]">
                      {plan.icon || 'workspace_premium'}
                    </span>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1 mb-6 min-h-[2.5rem]">
                    {plan.tagline}
                  </p>
                  <div className="mb-6 min-h-[4.5rem]">
                    {plan.contactSales ? (
                      <p className="text-2xl font-bold">Κατόπιν συνεννόησης</p>
                    ) : (
                      <>
                        <p className="text-3xl font-bold tracking-tight">
                          {price.label}
                          <span className="text-base font-medium text-gray-500">{price.suffix}</span>
                        </p>
                        {price.compareAt && (
                          <p className="text-xs text-gray-400 line-through mt-1">
                            €{price.compareAt}/έτος χωρίς έκπτωση
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <ul className="space-y-2 flex-1 text-sm text-on-surface-variant mb-8">
                    {(plan.features || []).map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="material-symbols-outlined text-sky-600 text-[18px] shrink-0">
                          check_circle
                        </span>
                        {f}
                      </li>
                    ))}
                    {addon.visible !== false ? (
                      <li className="flex gap-2 text-teal-800 font-semibold">
                        <span className="material-symbols-outlined text-teal-700 text-[18px] shrink-0">
                          add_circle
                        </span>
                        Προαιρετικό add-on Ενοικιάσεις (+{rentAddonPrice.label}
                        {rentAddonPrice.suffix})
                      </li>
                    ) : null}
                  </ul>
                  <button
                    type="button"
                    onClick={() => choosePlan(plan.id)}
                    className={`mt-auto w-full py-3.5 rounded-full font-bold text-sm transition-all ${
                      plan.highlighted
                        ? 'bg-sky-600 text-white hover:bg-sky-700'
                        : 'border border-slate-200 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {plan.contactSales
                      ? 'Επικοινωνία πωλήσεων'
                      : loggedIn
                        ? 'Επιλογή συμβολαίου'
                        : 'Ξεκινήστε εγγραφή'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-xl font-bold tracking-tight">
            {rentCatalog.sectionTitle || DEFAULT_RENT_SECTION_TITLE}
          </h2>
          <div className={`${rentGridClass} items-stretch`}>
            {standalone.visible !== false ? (
              <article className="h-full rounded-[28px] border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-sky-50 p-6 md:p-8 flex flex-col shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                <span className="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-teal-700 text-white text-[11px] font-bold uppercase tracking-wider">
                  {standalone.badge}
                </span>
                <h3 className="mt-4 text-2xl font-bold">{standalone.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{standalone.tagline}</p>
                <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums">
                  {rentStandalonePrice.label}
                  <span className="text-base font-medium text-gray-500">
                    {rentStandalonePrice.suffix}
                  </span>
                </p>
                <ul className="mt-5 space-y-2 flex-1 text-sm text-slate-700">
                  {standalone.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="material-symbols-outlined text-teal-700 text-[18px] shrink-0">
                        check_circle
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => choosePlan('rent')}
                  className="mt-8 w-full py-3.5 rounded-full font-bold text-sm bg-teal-700 text-white hover:bg-teal-800"
                >
                  {loggedIn ? standalone.ctaLoggedIn : standalone.ctaGuest}
                </button>
              </article>
            ) : null}

            {addon.visible !== false ? (
              <article className="h-full rounded-[28px] border border-slate-200 bg-white p-6 md:p-8 flex flex-col shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                <span className="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                  {addon.badge}
                </span>
                <h3 className="mt-4 text-2xl font-bold">{addon.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{addon.tagline}</p>
                <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums">
                  {rentAddonPrice.label}
                  <span className="text-base font-medium text-gray-500">{rentAddonPrice.suffix}</span>
                </p>
                <ul className="mt-5 space-y-2 flex-1 text-sm text-slate-700">
                  {addon.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="material-symbols-outlined text-slate-700 text-[18px] shrink-0">
                        check_circle
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={openRentAddon}
                  className="mt-8 w-full py-3.5 rounded-full font-bold text-sm bg-slate-900 text-white hover:opacity-90"
                >
                  {loggedIn ? addon.ctaLoggedIn : addon.ctaGuest}
                </button>
                {addon.servicesLinkLabel ? (
                  <Link
                    to="/rent"
                    className="mt-3 text-center text-sm font-bold text-teal-800 hover:underline"
                  >
                    {addon.servicesLinkLabel}
                  </Link>
                ) : null}
              </article>
            ) : null}
          </div>
        </section>

        <div className="rounded-[24px] border border-black/[0.06] bg-surface-container-low p-6 md:p-8 text-sm text-on-surface-variant space-y-3">
          <h3 className="font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">info</span>
            Πώς χωρίζονται
          </h3>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Λεωφορεία μόνο:</strong> Starter / Professional / Enterprise — η αρχική του domain δείχνει εκδρομές
            </li>
            <li>
              <strong>Rent μόνο:</strong> συμβόλαιο {standalone.name} (
              {rentStandalonePrice.label}
              {rentStandalonePrice.suffix}) — η αρχική του domain δείχνει μόνο Rent, χωρίς λεωφορεία
            </li>
            <li>
              <strong>Και τα δύο:</strong> πλάνο λεωφορείων + add-on Ενοικιάσεις (
              {rentAddonPrice.label}
              {rentAddonPrice.suffix}) — εκδρομές και Rent στην ίδια αρχική
            </li>
            <li>Email Hub με {CAMPAIGN_TEMPLATE_COUNT}+ πρότυπα · GDPR · διαχείριση από Συμβόλαιο</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
