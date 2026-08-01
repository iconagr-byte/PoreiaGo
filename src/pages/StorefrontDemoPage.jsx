import React, { useState, useEffect, useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { fetchPublicOfficeTrips } from '../services/officeTripsApi.js';
import { getTripMarket, MARKET_DOMESTIC, MARKET_INTERNATIONAL } from '../lib/trips/tripMarket.js';
import {
  filterTrips,
  formatTripDepartureLabel,
  MARKET_FILTER_ALL,
  MARKET_FILTER_DOMESTIC,
  MARKET_FILTER_INTERNATIONAL,
  sortTripsByDeparture,
  tripDepartureIso,
  tripsForMarketFilter,
} from '../lib/trips/tripSearch.js';
import {
  DEFAULT_PLATFORM_SETTINGS,
  fetchPlatformSettings,
} from '../services/platformApi.js';
import {
  DEFAULT_SITE_APPEARANCE,
  fetchSiteAppearance,
} from '../services/siteAppearanceApi.js';
import {
  isStorefrontPreviewMode,
  readHomepagePreviewDraft,
} from '../lib/homepage/homepagePreview.js';
import { isPlatformMarketingHost, isTenantStorefrontHost } from '../lib/platform/tenantHost.js';
import { fetchPublicFleet } from '../services/fleetPublicApi.js';
import {
  DEFAULT_OFFICE_MODULES,
  fetchOfficeModules,
  isRentOnlyModules,
} from '../services/officeModulesApi.js';
import { fetchPublicRentalCatalog } from '../services/customerRentalApi.js';
import { withDemoRentFleet } from '../lib/rental/demoRentFleet.js';
import FleetShowcaseSection from '../components/FleetShowcaseSection.jsx';
import StorefrontHeader from '../components/storefront/StorefrontHeader.jsx';
import StorefrontHero from '../components/storefront/StorefrontHero.jsx';
import StorefrontFooter from '../components/storefront/StorefrontFooter.jsx';
import StorefrontRentSection from '../components/storefront/StorefrontRentSection.jsx';
import TripsSection from '../components/storefront/TripsSection.jsx';

const RENT_ONLY_HERO = {
  hero_badge: 'Ενοικιάσεις οχημάτων',
  hero_title: 'Νοίκιασε όχημα,',
  hero_title_accent: 'online σε λίγα λεπτά.',
  hero_subtitle:
    'Διάλεξε από τον στόλο ενοικίασης, κλείσε ημερομηνίες και παρέλαβε — χωρίς εκδρομές λεωφορείου σε αυτή τη σελίδα.',
  hero_search_label: 'Ενοικίαση',
};

export default function StorefrontDemoPage() {
  const navigate = useNavigate();
  const isLiveTenantSite = isTenantStorefrontHost();
  // PoreiaGo SaaS host is marketing only — never a white-label office storefront
  // (blocks Achillio Travel leftovers on www.poreiago.com/storefront?preview=1).
  const blockOnMarketingHost = isPlatformMarketingHost();
  // Live office domain/subdomain only. Preview on poreiago.com is not allowed.
  const allowStorefront = isLiveTenantSite && !blockOnMarketingHost;

  const [trips, setTrips] = useState([]);
  const domesticTrips = useMemo(
    () =>
      trips
        .filter((t) => getTripMarket(t) === MARKET_DOMESTIC)
        .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))),
    [trips],
  );
  const internationalTrips = useMemo(
    () =>
      trips
        .filter((t) => getTripMarket(t) === MARKET_INTERNATIONAL)
        .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))),
    [trips],
  );
  const [searchFilters, setSearchFilters] = useState({
    tripId: '',
    market: MARKET_FILTER_ALL,
    date: '',
  });
  const [pricingSettings, setPricingSettings] = useState(DEFAULT_PLATFORM_SETTINGS);
  const [siteAppearance, setSiteAppearance] = useState(DEFAULT_SITE_APPEARANCE);
  const [fleetShowcase, setFleetShowcase] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [modules, setModules] = useState(DEFAULT_OFFICE_MODULES);
  const [rentalVehicles, setRentalVehicles] = useState([]);
  const [rentalLoading, setRentalLoading] = useState(false);

  const tripsEnabled = modules.trips_enabled !== false;
  const rentEnabled = Boolean(modules.rent_enabled);
  const rentOnly = isRentOnlyModules(modules);

  const pickerTrips = useMemo(
    () => sortTripsByDeparture(tripsForMarketFilter(trips, searchFilters.market)),
    [trips, searchFilters.market],
  );
  const departureDates = useMemo(() => {
    const dates = new Set(pickerTrips.map(tripDepartureIso).filter(Boolean));
    return [...dates].sort();
  }, [pickerTrips]);
  const selectedTrip = useMemo(
    () => trips.find((t) => String(t.id) === String(searchFilters.tripId)) || null,
    [trips, searchFilters.tripId],
  );
  const listFilters = useMemo(
    () => ({ tripId: searchFilters.tripId, date: searchFilters.date }),
    [searchFilters.tripId, searchFilters.date],
  );
  const filteredDomestic = useMemo(
    () => filterTrips(domesticTrips, listFilters),
    [domesticTrips, listFilters],
  );
  const filteredInternational = useMemo(
    () => filterTrips(internationalTrips, listFilters),
    [internationalTrips, listFilters],
  );
  const showDomestic = searchFilters.market !== MARKET_FILTER_INTERNATIONAL;
  const showInternational = searchFilters.market !== MARKET_FILTER_DOMESTIC;
  const totalResults =
    (showDomestic ? filteredDomestic.length : 0) +
    (showInternational ? filteredInternational.length : 0);

  const heroAppearance = useMemo(() => {
    if (!rentOnly) return siteAppearance;
    const brand =
      siteAppearance.footer_brand_name ||
      siteAppearance.display_name ||
      '';
    return {
      ...siteAppearance,
      ...RENT_ONLY_HERO,
      hero_subtitle: brand
        ? `Κλείσε online από τον στόλο του ${brand} — ημερομηνίες, παραλαβή και επιστροφή σε λίγα βήματα.`
        : RENT_ONLY_HERO.hero_subtitle,
    };
  }, [rentOnly, siteAppearance]);

  useEffect(() => {
    // Marketing host redirects away — do not load office storefront data there.
    if (!allowStorefront) return undefined;

    const applyPreviewAppearance = () => {
      const draft = readHomepagePreviewDraft();
      if (draft) {
        setSiteAppearance({ ...DEFAULT_SITE_APPEARANCE, ...draft });
        return true;
      }
      return false;
    };

    const loadCommon = () => {
      fetchOfficeModules().then(setModules);
      fetchPlatformSettings().then(setPricingSettings);
    };

    if (isStorefrontPreviewMode()) {
      if (!applyPreviewAppearance()) {
        fetchSiteAppearance().then(setSiteAppearance).catch(() => {});
      }
      const onStorage = (e) => {
        if (e.key === 'aerostride_homepage_preview_v1' || e.key === 'aerostride_site_appearance_v1') {
          applyPreviewAppearance();
        }
      };
      window.addEventListener('storage', onStorage);
      loadCommon();
      setFleetLoading(true);
      fetchPublicFleet()
        .then(setFleetShowcase)
        .finally(() => setFleetLoading(false));
      fetchPublicOfficeTrips().then(setTrips);
      return () => window.removeEventListener('storage', onStorage);
    }

    fetchSiteAppearance().then(setSiteAppearance).catch(() => {});
    loadCommon();
    setFleetLoading(true);
    fetchPublicFleet()
      .then(setFleetShowcase)
      .finally(() => setFleetLoading(false));
    fetchPublicOfficeTrips().then(setTrips);
    return undefined;
  }, [allowStorefront]);

  useEffect(() => {
    if (!rentEnabled) {
      setRentalVehicles([]);
      return undefined;
    }
    let cancelled = false;
    setRentalLoading(true);
    fetchPublicRentalCatalog()
      .then((rows) => {
        if (!cancelled) setRentalVehicles(withDemoRentFleet(rows || []));
      })
      .catch(() => {
        if (!cancelled) setRentalVehicles(withDemoRentFleet([]));
      })
      .finally(() => {
        if (!cancelled) setRentalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rentEnabled]);

  const handleMarketChange = (market) => {
    setSearchFilters((f) => ({
      market,
      tripId: '',
      date: '',
    }));
  };

  const handleTripPick = (tripId) => {
    if (!tripId) {
      setSearchFilters((f) => ({ ...f, tripId: '', date: '' }));
      return;
    }
    const trip = pickerTrips.find((t) => String(t.id) === String(tripId));
    setSearchFilters((f) => ({
      ...f,
      tripId: String(tripId),
      date: trip ? tripDepartureIso(trip) : '',
    }));
  };

  const handleSearch = (e) => {
    e?.preventDefault?.();
    const targetId =
      searchFilters.market === MARKET_FILTER_INTERNATIONAL
        ? 'international-trips'
        : 'search-results';
    setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const headerTemplate = siteAppearance.header_template || 'glass_dark';
  const themeVars = {
    '--sf-accent': siteAppearance.accent_color || '#0ea5e9',
    '--sf-secondary': siteAppearance.secondary_color || '#1e3a5f',
    '--sf-surface': siteAppearance.surface_color || '#f8fafc',
  };

  const rentHeroCta = (
    <div className="mt-2 p-4 md:p-6 rounded-[28px] bg-white/10 border border-white/20 backdrop-blur-md space-y-4 max-w-xl">
      <p className="text-xs font-bold uppercase tracking-wider text-white/70">
        {heroAppearance.hero_search_label || 'Ενοικίαση'}
      </p>
      <p className="text-sm text-white/85 leading-relaxed">
        Διαθέσιμος στόλος για ημερήσια ή πολυήμερη ενοικίαση. Συνέχισε στην εφαρμογή Rent για ημερομηνίες και κράτηση.
      </p>
      <div className="flex flex-wrap gap-3 pt-1">
        <Link
          to="/rent"
          className="bg-teal-600 text-white px-8 py-3.5 rounded-full font-label-md font-bold hover:bg-teal-500 transition-all inline-flex items-center justify-center gap-2"
        >
          Δες στόλο ενοικίασης
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </Link>
        <a
          href="#rent"
          className="px-8 py-3.5 rounded-full font-label-md font-bold bg-white text-slate-900 hover:bg-white/90 transition-all inline-flex items-center gap-2"
        >
          Περισσότερα
          <span className="material-symbols-outlined text-[20px]">expand_more</span>
        </a>
      </div>
    </div>
  );

  const searchForm = (
    <form
      onSubmit={handleSearch}
      className="mt-2 p-4 md:p-6 rounded-[28px] bg-white/10 border border-white/20 backdrop-blur-md space-y-4 max-w-2xl"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-white/70">
        {siteAppearance.hero_search_label || 'Πρόγραμμα εκδρομών'}
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          { id: MARKET_FILTER_ALL, label: 'Όλες' },
          { id: MARKET_FILTER_DOMESTIC, label: 'Ελλάδα' },
          { id: MARKET_FILTER_INTERNATIONAL, label: 'Εξωτερικό' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleMarketChange(m.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              searchFilters.market === m.id
                ? 'bg-white text-slate-900'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {pickerTrips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pickerTrips.slice(0, 4).map((trip) => {
            const active = String(searchFilters.tripId) === String(trip.id);
            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => handleTripPick(active ? '' : trip.id)}
                className={`text-left px-3 py-2 rounded-2xl text-xs font-semibold border transition-all max-w-full ${
                  active
                    ? 'bg-white text-slate-900 border-white'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
              >
                <span className="block opacity-80">{formatTripDepartureLabel(trip)}</span>
                <span className="block truncate">{trip.title}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-white/80 mb-1.5 block">Εκδρομή</span>
          <select
            value={searchFilters.tripId}
            onChange={(e) => handleTripPick(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-white/95 text-slate-900 text-sm font-medium"
          >
            <option value="">Όλες οι διαθέσιμες εκδρομές ({pickerTrips.length})</option>
            {pickerTrips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {formatTripDepartureLabel(trip)} · {trip.title}
                {trip.destination ? ` · ${trip.destination}` : ''}
                {trip.availableSeats != null ? ` · ${trip.availableSeats} θέσεις` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-white/80 mb-1.5 block">Ημερομηνία</span>
          <select
            value={searchFilters.date}
            disabled={Boolean(selectedTrip)}
            onChange={(e) =>
              setSearchFilters((f) => ({
                ...f,
                date: e.target.value,
                tripId: '',
              }))
            }
            className="w-full px-4 py-3 rounded-2xl bg-white/95 text-slate-900 text-sm disabled:opacity-70"
          >
            <option value="">Όλες οι ημερομηνίες</option>
            {departureDates.map((d) => (
              <option key={d} value={d}>
                {new Date(`${d}T12:00:00`).toLocaleDateString('el-GR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          {selectedTrip && (
            <p className="text-sm text-white/90 pb-3">
              <span className="font-bold text-white">{selectedTrip.availableSeats}</span> θέσεις · από{' '}
              <span className="font-bold text-white">€{Number(selectedTrip.price || 0).toFixed(0)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="submit"
          className="bg-primary text-white px-8 py-3.5 rounded-full font-label-md font-bold hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
        >
          Δες εκδρομές
          {totalResults > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{totalResults}</span>
          )}
          <span className="material-symbols-outlined text-[20px]">expand_more</span>
        </button>
        {selectedTrip && (
          <button
            type="button"
            onClick={() => navigate(`/trip/${selectedTrip.id}`)}
            className="px-8 py-3.5 rounded-full font-label-md font-bold bg-white text-slate-900 hover:bg-white/90 transition-all flex items-center gap-2"
          >
            Κράτηση
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        )}
        {rentEnabled ? (
          <Link
            to="/rent"
            className="px-6 py-3.5 rounded-full font-label-md font-bold bg-teal-600/90 text-white hover:bg-teal-500 transition-all inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">directions_car</span>
            Rent
          </Link>
        ) : null}
      </div>
    </form>
  );

  if (!allowStorefront) {
    return <Navigate to="/" replace />;
  }

  const brandName =
    siteAppearance.footer_brand_name || siteAppearance.display_name || '';
  const showBusFleet = tripsEnabled && siteAppearance.show_fleet_section !== false;

  return (
    <div className="storefront-themed min-h-screen" style={themeVars}>
      <StorefrontHeader
        siteAppearance={siteAppearance}
        templateId={headerTemplate}
        tripsEnabled={tripsEnabled}
        rentEnabled={rentEnabled}
      />
      <main>
        <StorefrontHero
          siteAppearance={heroAppearance}
          templateId={siteAppearance.hero_template || 'fullscreen_overlay'}
          searchForm={rentOnly ? rentHeroCta : searchForm}
        />

        {tripsEnabled ? (
          <>
            <TripsSection
              id="search-results"
              eyebrow={siteAppearance.trips_section_eyebrow}
              title={siteAppearance.trips_section_title}
              subtitle={siteAppearance.trips_section_subtitle}
              trips={showDomestic ? filteredDomestic : []}
              emptyMessage={
                showDomestic
                  ? 'Δεν βρέθηκαν εγχώριες εκδρομές με τα κριτήριά σας.'
                  : 'Επιλέξατε διεθνείς εκδρομές — δείτε παρακάτω.'
              }
              siteAppearance={siteAppearance}
              pricingSettings={pricingSettings}
            />

            <TripsSection
              id="international-trips"
              eyebrow={siteAppearance.intl_section_eyebrow}
              title={siteAppearance.intl_section_title}
              subtitle={siteAppearance.intl_section_subtitle}
              trips={filteredInternational}
              emptyMessage="Δεν βρέθηκαν διεθνή δρομολόγια με τα κριτήριά σας."
              siteAppearance={siteAppearance}
              pricingSettings={pricingSettings}
              hidden={!showInternational}
            />
          </>
        ) : null}

        {rentEnabled ? (
          <StorefrontRentSection
            vehicles={rentalVehicles}
            loading={rentalLoading}
            rentOnly={rentOnly}
            brandName={brandName}
            siteAppearance={siteAppearance}
          />
        ) : null}

        <FleetShowcaseSection
          vehicles={fleetShowcase}
          loading={fleetLoading}
          hidden={!showBusFleet}
        />

        {siteAppearance.show_why_us_section !== false && (
        <section className="py-24 bg-surface-bright border-y border-black/[0.05]">
          <div className="max-w-container-max mx-auto px-margin-desktop">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-headline-lg font-bold text-on-surface mb-6">
                Γιατί να μας επιλέξετε
              </h2>
              <p className="font-body-lg text-on-surface-variant">
                {rentOnly
                  ? 'Online κράτηση ενοικίασης, ξεκάθαροι όροι και υποστήριξη πριν και κατά τη διαδρομή.'
                  : 'Όλες οι premium υπηρεσίες μας με μια ματιά. Από πανεύκολες κρατήσεις μέχρι ασφάλεια και εγγύηση κάθε στιγμή.'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="bg-surface-container-lowest p-8 rounded-3xl border border-black/[0.03] shadow-sm flex flex-col items-center text-center hover:-translate-y-1 transition-transform">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[32px]">
                    {rentOnly ? 'smartphone' : 'event_available'}
                  </span>
                </div>
                <h3 className="font-headline-sm font-bold text-on-surface mb-3">
                  {rentOnly ? 'Κράτηση από το κινητό' : 'Εύκολη Κράτηση'}
                </h3>
                <p className="text-on-surface-variant font-body-md">
                  {rentOnly
                    ? 'Διάλεξε όχημα και ημερομηνίες στο Rent app — χωρίς τηλεφωνική αναμονή.'
                    : 'Διαλέξτε ημερομηνία και κλείστε τη θέση σας με λίγα μόνο κλικ.'}
                </p>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-3xl border border-black/[0.03] shadow-sm flex flex-col items-center text-center hover:-translate-y-1 transition-transform">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[32px]">
                    {rentOnly ? 'directions_car' : 'airline_seat_recline_extra'}
                  </span>
                </div>
                <h3 className="font-headline-sm font-bold text-on-surface mb-3">
                  {rentOnly ? 'Στόλος σε ετοιμότητα' : 'Άνεση & Πολυτέλεια'}
                </h3>
                <p className="text-on-surface-variant font-body-md">
                  {rentOnly
                    ? 'Οχήματα συντηρημένα και έτοιμα για παραλαβή με καθαρό ιστορικό.'
                    : 'Ταξιδέψτε με υπερσύγχρονα οχήματα και αναπαυτικά καθίσματα.'}
                </p>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-3xl border border-black/[0.03] shadow-sm flex flex-col items-center text-center hover:-translate-y-1 transition-transform">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[32px]">shield_person</span>
                </div>
                <h3 className="font-headline-sm font-bold text-on-surface mb-3">Απόλυτη Ασφάλεια</h3>
                <p className="text-on-surface-variant font-body-md">
                  {rentOnly
                    ? 'Υποστήριξη διαδρομής, όροι ενοικίασης και βοήθεια όταν τη χρειάζεσαι.'
                    : 'Έμπειροι οδηγοί και αυστηρά μέτρα προστασίας σε κάθε διαδρομή.'}
                </p>
              </div>
            </div>
          </div>
        </section>
        )}

      </main>

      <StorefrontFooter
        siteAppearance={siteAppearance}
        templateId={siteAppearance.footer_template || 'classic_columns'}
      />
    </div>
  );
}
