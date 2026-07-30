import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import {
  AGENCY_PLANS,
  BILLING_INTERVALS,
  DEFAULT_RENT_SECTION_TITLE,
  RENT_ADDON,
  RENT_STANDALONE_PLAN,
  displayPrice,
  mergeRentPlanCatalog,
  rentAddonDisplayPrice,
  rentStandaloneDisplayPrice,
} from '../lib/billing/planCatalog.js';
import { CAMPAIGN_TEMPLATE_COUNT } from '../lib/marketing/platformCopy.js';
import { getSaasToken } from '../services/saasApi.js';
import { fetchPublicRentPlanCatalog } from '../services/rentPlanCatalogApi.js';

/**
 * Public SaaS contracts — split by product:
 * - /grafeia → λεωφορεία
 * - /grafeia/rent → ενοικιάσεις
 */
export default function AgencyPlansPage({ product = 'buses' } = {}) {
  const isRent = product === 'rent';
  const navigate = useNavigate();
  const [interval, setInterval] = useState('month');
  const loggedIn = Boolean(getSaasToken());
  const [rentCatalog, setRentCatalog] = useState(() => mergeRentPlanCatalog(null));

  useEffect(() => {
    if (!isRent) return undefined;
    let cancelled = false;
    fetchPublicRentPlanCatalog().then((data) => {
      if (!cancelled) setRentCatalog(data);
    });
    return () => {
      cancelled = true;
    };
  }, [isRent]);

  const standalone = rentCatalog.standalone || RENT_STANDALONE_PLAN;
  const addon = rentCatalog.addon || RENT_ADDON;
  const rentStandalonePrice = rentStandaloneDisplayPrice(interval, standalone);
  const rentAddonPrice = rentAddonDisplayPrice(interval, addon);
  const visibleCards = [standalone.visible !== false, addon.visible !== false].filter(Boolean)
    .length;
  const rentGridClass =
    visibleCards <= 1 ? 'grid md:grid-cols-1 max-w-xl gap-6' : 'grid md:grid-cols-2 gap-6';

  const choosePlan = (planId) => {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@travelos.app?subject=Enterprise%20συμβόλαιο';
      return;
    }
    if (loggedIn) {
      navigate('/admin', {
        state: {
          activeTab: 'settings',
          settingsSubTab: 'contracts',
          plan: planId,
          interval,
          focusRentModule: planId === 'rent' || isRent,
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
    <div className={`min-h-screen text-on-surface ${isRent ? 'bg-[#f4fbf9]' : 'bg-surface'}`}>
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <PlatformBrand variant="light" />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link to="/" className="text-sm font-semibold text-gray-600 hover:text-primary hidden sm:inline">
              Αρχική
            </Link>
            <div className="inline-flex p-0.5 rounded-full bg-slate-100 border border-black/[0.05]">
              <Link
                to="/grafeia"
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-colors ${
                  !isRent ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Λεωφορεία
              </Link>
              <Link
                to="/grafeia/rent"
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-colors ${
                  isRent ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-500 hover:text-teal-800'
                }`}
              >
                Ενοικιάσεις
              </Link>
            </div>
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
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isRent ? 'bg-teal-100 text-teal-900' : 'bg-primary/10 text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isRent ? 'car_rental' : 'directions_bus'}
            </span>
            {isRent ? 'Συμβόλαια ενοικιάσεων' : 'Συμβόλαια λεωφορείων'}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {isRent ? 'Συμβόλαια για ενοικιάσεις οχημάτων' : 'Συμβόλαια για λεωφορεία & εκδρομές'}
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base">
            {isRent
              ? 'Αυτόνομο Rent ή add-on πάνω σε υπάρχον συμβόλαιο λεωφορείων — ξεχωριστά από τα πλάνα εκδρομών.'
              : 'Starter / Professional / Enterprise για στόλο, κρατήσεις και GPS. Οι ενοικιάσεις έχουν δική τους σελίδα συμβολαίων.'}
          </p>

          <div className="inline-flex p-1 rounded-full bg-white border border-black/[0.06] mt-6 shadow-sm">
            {Object.values(BILLING_INTERVALS).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInterval(opt.id)}
                className={`relative px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  interval === opt.id
                    ? isRent
                      ? 'bg-teal-700 text-white shadow-md'
                      : 'bg-white text-primary shadow-md ring-1 ring-primary/20'
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

        {!isRent ? (
          <section className="space-y-5" aria-labelledby="bus-contracts-title">
            <h2 id="bus-contracts-title" className="text-xl font-bold tracking-tight">
              Πλάνα λεωφορείων
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {AGENCY_PLANS.map((plan) => {
                const price = displayPrice(plan, interval);
                return (
                  <article
                    key={plan.id}
                    className={`relative flex flex-col rounded-[28px] border p-6 md:p-8 ${
                      plan.highlighted
                        ? 'border-primary/40 bg-white shadow-xl ring-2 ring-primary/20 scale-[1.02]'
                        : 'border-black/[0.06] bg-surface-container-lowest shadow-sm'
                    }`}
                  >
                    {plan.highlighted && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                        Προτεινόμενο
                      </span>
                    )}
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-on-surface-variant mt-1 mb-6">{plan.tagline}</p>
                    <div className="mb-6">
                      {plan.contactSales ? (
                        <p className="text-2xl font-bold">Enterprise</p>
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
                      {plan.features.map((f) => (
                        <li key={f} className="flex gap-2">
                          <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                            check_circle
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => choosePlan(plan.id)}
                      className={`w-full py-3.5 rounded-full font-bold text-sm transition-all ${
                        plan.highlighted
                          ? 'bg-primary text-white hover:opacity-90'
                          : 'border border-primary/30 text-primary hover:bg-primary/5'
                      }`}
                    >
                      {plan.contactSales ? 'Επικοινωνία πωλήσεων' : 'Εγγραφή'}
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="rounded-[24px] border border-teal-200/80 bg-gradient-to-r from-teal-50 to-white p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-bold text-teal-950">Θέλετε και ενοικιάσεις οχημάτων;</p>
                <p className="text-sm text-teal-900/70 mt-0.5">
                  Ξεχωριστά συμβόλαια Rent — δική τους διεύθυνση και πράσινο θέμα.
                </p>
              </div>
              <Link
                to="/grafeia/rent"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-teal-700 text-white text-sm font-bold hover:bg-teal-800"
              >
                Συμβόλαια ενοικιάσεων
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>

            <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 md:p-8 text-sm text-on-surface-variant space-y-3">
              <h3 className="font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">info</span>
                Τι περιλαμβάνουν
              </h3>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>Λεωφορεία:</strong> κρατήσεις, QR, στόλος, GPS, Email Hub (
                  {CAMPAIGN_TEMPLATE_COUNT}+ πρότυπα)
                </li>
                <li>
                  Η αρχική του domain δείχνει εκδρομές — χωρίς Rent μέχρι να ενεργοποιήσετε add-on ή
                  αυτόνομο συμβόλαιο
                </li>
              </ul>
            </div>
          </section>
        ) : (
          <section className="space-y-5" aria-labelledby="rent-contracts-title">
            <h2 id="rent-contracts-title" className="text-xl font-bold tracking-tight text-teal-950">
              {rentCatalog.sectionTitle || DEFAULT_RENT_SECTION_TITLE}
            </h2>
            <div className={rentGridClass}>
              {standalone.visible !== false ? (
                <article className="rounded-[28px] border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-sky-50 p-6 md:p-8 flex flex-col shadow-sm">
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
                <article className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8 flex flex-col shadow-sm">
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
                  <p className="mt-3 text-center text-xs text-slate-500 leading-relaxed">
                    Απαιτεί ενεργό συμβόλαιο λεωφορείων.{' '}
                    <Link to="/grafeia" className="font-bold text-teal-800 hover:underline">
                      Δείτε πλάνα λεωφορείων
                    </Link>
                  </p>
                </article>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-bold text-slate-900">Ψάχνετε συμβόλαια λεωφορείων;</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  Starter / Professional / Enterprise — ξεχωριστή σελίδα από τις ενοικιάσεις.
                </p>
              </div>
              <Link
                to="/grafeia"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold hover:opacity-90"
              >
                Συμβόλαια λεωφορείων
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>

            <div className="rounded-[24px] border border-teal-200/70 bg-teal-50/50 p-6 md:p-8 text-sm text-teal-950/80 space-y-3">
              <h3 className="font-bold text-teal-950 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700">info</span>
                Πώς χωρίζονται τα συμβόλαια ενοικιάσεων
              </h3>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>Αυτόνομο Rent:</strong> μόνο ενοικιάσεις — χωρίς λεωφορεία στην αρχική
                </li>
                <li>
                  <strong>Add-on:</strong> πάνω σε υπάρχον συμβόλαιο λεωφορείων (απαιτεί ενεργό πλάνο)
                </li>
                <li>
                  Υπηρεσίες πελάτη:{' '}
                  <Link to="/rent/services" className="font-bold text-teal-800 hover:underline">
                    /rent/services
                  </Link>
                </li>
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
