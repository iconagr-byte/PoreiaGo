/**
 * Full marketing page for Rent services — shareable for advertising.
 * Route: /rent/services
 * On office domains, redirect to the storefront homepage (#rent) —
 * offices do not need a separate PoreiaGo-branded services page.
 */
import { Link, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import { RENT_SERVICE_FEATURES, rentServiceCopy } from '../lib/rental/rentServicesCatalog.js';
import {
  RENT_ADDON,
  RENT_STANDALONE_PLAN,
  mergeRentPlanCatalog,
  rentAddonDisplayPrice,
  rentStandaloneDisplayPrice,
} from '../lib/billing/planCatalog.js';
import { getRentLang, setRentLang, t } from '../lib/rental/rentI18n.js';
import { isTenantStorefrontHost } from '../lib/platform/tenantHost.js';
import { fetchPublicRentPlanCatalog } from '../services/rentPlanCatalogApi.js';

export default function RentalServicesPage() {
  const lang = getRentLang();
  const en = lang === 'en';
  const [rentCatalog, setRentCatalog] = useState(() => mergeRentPlanCatalog(null));

  useEffect(() => {
    let cancelled = false;
    fetchPublicRentPlanCatalog().then((data) => {
      if (!cancelled) setRentCatalog(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isTenantStorefrontHost()) {
    return <Navigate to="/" replace />;
  }

  const standalone = rentCatalog.standalone || RENT_STANDALONE_PLAN;
  const addon = rentCatalog.addon || RENT_ADDON;
  const standalonePrice = rentStandaloneDisplayPrice('month', standalone);
  const addonPrice = rentAddonDisplayPrice('month', addon);
  const visibleCards = [standalone.visible !== false, addon.visible !== false].filter(Boolean)
    .length;
  const rentGridClass =
    visibleCards <= 1 ? 'grid md:grid-cols-1 max-w-xl gap-6' : 'grid md:grid-cols-2 gap-6';

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <PlatformBrand variant="light" />
          <nav className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="text-xs font-bold px-3 py-2 rounded-full border border-black/[0.08] bg-white text-slate-600"
              onClick={() => {
                setRentLang(en ? 'el' : 'en');
                window.location.reload();
              }}
            >
              {en ? 'EL' : 'EN'}
            </button>
            <Link
              to="/rent"
              className="text-sm font-bold px-4 py-2 rounded-full border border-teal-200 text-teal-800 hover:bg-teal-50"
            >
              {t('book', lang)}
            </Link>
            <Link
              to="/grafeia/rent"
              className="text-sm font-bold px-4 py-2 rounded-full bg-teal-700 text-white hover:bg-teal-800"
            >
              {en ? 'Contracts' : 'Συμβόλαια'}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-black/[0.05]">
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              background:
                'radial-gradient(900px 420px at 10% -10%, rgba(10,122,108,0.16), transparent 55%), radial-gradient(700px 380px at 90% 0%, rgba(0,113,227,0.1), transparent 50%), linear-gradient(180deg, #ffffff 0%, #f5f5f7 100%)',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700 mb-4">
              {t('services_kicker', lang)}
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl leading-[1.08]">
              {t('services_hero_title', lang)}
            </h1>
            <p className="mt-5 text-lg text-slate-600 max-w-2xl leading-relaxed">
              {t('services_hero_copy', lang)}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/rent"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-teal-700 text-white font-bold hover:bg-teal-800"
              >
                <span className="material-symbols-outlined text-[20px]">directions_car</span>
                {t('services_cta_fleet', lang)}
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white border border-black/[0.08] font-bold text-slate-800 hover:bg-slate-50"
              >
                {en ? 'See contracts' : 'Δες συμβόλαια'}
              </a>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 md:px-8 py-14 md:py-20">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {t('services_title', lang)}
            </h2>
            <p className="mt-3 text-slate-600 leading-relaxed">{t('services_lead', lang)}</p>
          </div>
          <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {RENT_SERVICE_FEATURES.map((feature) => {
              const copy = rentServiceCopy(feature, lang);
              return (
                <li
                  key={feature.id}
                  className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-[#0b3d4a] text-white mb-4">
                    <span className="material-symbols-outlined">{feature.icon}</span>
                  </span>
                  <h3 className="font-bold text-lg tracking-tight">{copy.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{copy.copy}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="pricing" className="border-t border-black/[0.05] bg-white py-14 md:py-20">
          <div className="max-w-6xl mx-auto px-4 md:px-8">
            <div className="max-w-2xl mb-10">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                {en ? 'Contracts for offices' : 'Συμβόλαια για γραφεία'}
              </h2>
              <p className="mt-3 text-slate-600 leading-relaxed">
                {en
                  ? 'Rent as a standalone contract, or as an add-on on top of your bus plan.'
                  : 'Το Rent ως αυτόνομο συμβόλαιο, ή ως add-on πάνω στο συμβόλαιο λεωφορείων.'}
              </p>
            </div>

            <div className={rentGridClass}>
              {standalone.visible !== false ? (
                <article className="rounded-[28px] border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 md:p-8 flex flex-col">
                  <span className="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-teal-700 text-white text-[11px] font-bold uppercase tracking-wider">
                    {en ? 'Standalone' : standalone.badge}
                  </span>
                  <h3 className="mt-4 text-2xl font-bold">{standalone.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{standalone.tagline}</p>
                  <p className="mt-5 text-3xl font-bold tabular-nums">
                    {standalonePrice.label}
                    <span className="text-base font-semibold text-slate-500">
                      {standalonePrice.suffix}
                    </span>
                  </p>
                  <ul className="mt-5 space-y-2 flex-1 text-sm text-slate-700">
                    {standalone.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="material-symbols-outlined text-teal-700 text-[18px]">
                          check_circle
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={`/grafeia/signup?plan=rent&interval=month`}
                    className="mt-8 inline-flex justify-center items-center gap-2 px-5 py-3.5 rounded-full bg-teal-700 text-white font-bold hover:bg-teal-800"
                  >
                    {en ? 'Register' : standalone.ctaGuest}
                  </Link>
                </article>
              ) : null}

              {addon.visible !== false ? (
                <article className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-6 md:p-8 flex flex-col">
                  <span className="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                    {en ? 'Add-on' : addon.badge}
                  </span>
                  <h3 className="mt-4 text-2xl font-bold">{addon.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{addon.tagline}</p>
                  <p className="mt-5 text-3xl font-bold tabular-nums">
                    {addonPrice.label}
                    <span className="text-base font-semibold text-slate-500">{addonPrice.suffix}</span>
                  </p>
                  <ul className="mt-5 space-y-2 flex-1 text-sm text-slate-700">
                    {addon.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="material-symbols-outlined text-slate-700 text-[18px]">
                          check_circle
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/grafeia/rent"
                    className="mt-8 inline-flex justify-center items-center gap-2 px-5 py-3.5 rounded-full bg-slate-900 text-white font-bold hover:opacity-90"
                  >
                    {en ? 'Register' : addon.ctaGuest}
                  </Link>
                </article>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.06] bg-white py-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-wrap justify-between gap-4 text-sm text-slate-500">
          <PlatformBrand variant="light" asLink />
          <div className="flex flex-wrap gap-5">
            <Link to="/" className="hover:text-slate-900">
              {en ? 'Home' : 'Αρχική'}
            </Link>
            <Link to="/grafeia/rent" className="hover:text-slate-900">
              {en ? 'Contracts' : 'Συμβόλαια'}
            </Link>
            <Link to="/rent" className="hover:text-slate-900">
              /rent
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
