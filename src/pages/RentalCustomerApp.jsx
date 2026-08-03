import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  getCustomerEmail,
  getCustomerName,
  getCustomerPicture,
  getCustomerToken,
  isCustomer,
  logoutCustomer,
} from '../lib/auth.js';
import { setupRentalPwa } from '../lib/rental/registerRentalPwa.js';
import { useRentMobile } from '../lib/rental/rentDevice.js';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import { resolveRentAppBranding } from '../lib/rental/rentAppBranding.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import {
  fetchCustomerRentalCatalog,
  fetchPublicRentalAvailability,
  fetchPublicRentalCatalog,
} from '../services/customerRentalApi.js';
import { isClientDemoFleet, withDemoRentFleet } from '../lib/rental/demoRentFleet.js';
import { enrichRentFleet, homeCategoryLabel } from '../lib/rental/rentFleetEnrichment.js';
import {
  countRentFleetByBody,
  rentHomeCategoryFilters,
} from '../lib/rental/rentVehicleCategories.js';
import { rememberRentVehicle } from '../lib/rental/rentBookingExtras.js';
import { writeRentBookingPrefs } from '../lib/rental/rentBookingSearch.js';
import RentalCatalogPanel from '../components/wallet/RentalCatalogPanel.jsx';
import RentalInstallPrompt from '../components/rental/RentalInstallPrompt.jsx';
import RentalCustomerCalendar from '../components/rental/RentalCustomerCalendar.jsx';
import RentalWalletPanel from '../components/rental/RentalWalletPanel.jsx';
import RentWalletCheckInBand from '../components/rental/RentWalletCheckInBand.jsx';
import RentGuestLandingExtras from '../components/rental/RentGuestLandingExtras.jsx';
import RentGuestHero from '../components/rental/RentGuestHero.jsx';
import RentBookingSearchBar from '../components/rental/RentBookingSearchBar.jsx';
import RentGuestTopActions from '../components/rental/RentGuestTopActions.jsx';
import RentHomeFleetCard from '../components/rental/RentHomeFleetCard.jsx';
import RentVehicleDetailSheet from '../components/rental/RentVehicleDetailSheet.jsx';
import { RentProductSection } from '../components/marketing/PlatformLandingSections.jsx';
import { isPlatformMarketingHost } from '../lib/platform/tenantHost.js';
import { officeStorageKey } from '../lib/admin/officeTenantStore.js';
import LoginPage from './LoginPage.jsx';
import '../styles/wallet-pass.css';
import '../styles/rental-pwa.css';

const PREFERRED_VEHICLE_ID_KEY = 'rent_preferred_vehicle_id_v1';

function rentFavoritesKey() {
  return officeStorageKey('rent_favorites_v1');
}

function useRentFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(rentFavoritesKey()) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(rentFavoritesKey(), JSON.stringify(favorites));
    } catch {
      /* ignore */
    }
  }, [favorites]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return { favorites, toggleFavorite };
}

function rememberPreferredVehicle(vehicle) {
  rememberRentVehicle(vehicle);
  try {
    localStorage.setItem(PREFERRED_VEHICLE_ID_KEY, String(vehicle.id));
  } catch {
    /* ignore */
  }
}

function RentalGuestPreviewApp({ onRequireLogin, onPickVehicle } = {}) {
  const isMobile = useRentMobile();
  const navigate = useNavigate();
  const [branding, setBranding] = useState(() => resolveRentAppBranding({}, { guest: true }));
  const [footerAddress, setFooterAddress] = useState('');
  const [siteAppearance, setSiteAppearance] = useState(null);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [homeFleet, setHomeFleet] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [homeCategory, setHomeCategory] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [detailVehicle, setDetailVehicle] = useState(null);
  const { favorites, toggleFavorite } = useRentFavorites();

  const goToServicesStep = (vehicle) => {
    rememberPreferredVehicle(vehicle);
    writeRentBookingPrefs({
      vehicle_id: vehicle?.id || '',
      wizard_step: 'services',
    });
    onPickVehicle?.(vehicle);
    navigate('/rent/book/services');
  };

  useEffect(() => {
    let cancelled = false;
    setFleetLoading(true);
    fetchPublicRentalCatalog()
      .then((rows) => {
        if (cancelled) return;
        // Showcase: office fleet, or Hertz-like demo cards when empty.
        setHomeFleet(enrichRentFleet(withDemoRentFleet(Array.isArray(rows) ? rows : []).slice(0, 24)));
      })
      .catch(() => {
        if (cancelled) return;
        setHomeFleet(enrichRentFleet(withDemoRentFleet([])));
      })
      .finally(() => {
        if (!cancelled) setFleetLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const brand = resolveOfficeBrand(data || {});
        setFooterAddress(String(data?.footer_address || '').trim());
        setSiteAppearance(data || null);
        setPickupLocations(
          Array.isArray(data?.rent_pickup_locations)
            ? data.rent_pickup_locations.map((x) => String(x || '').trim()).filter(Boolean)
            : [],
        );
        setBranding(
          resolveRentAppBranding(
            {
              ...(data || {}),
              footer_brand_name: data?.footer_brand_name || brand.displayName || brand.name,
              display_name: brand.displayName || brand.name,
            },
            { guest: true },
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const { cars: carCount, vans: vanCount } = useMemo(
    () => countRentFleetByBody(homeFleet),
    [homeFleet],
  );
  const showingDemoFleet = useMemo(() => isClientDemoFleet(homeFleet), [homeFleet]);
  const homeCategories = useMemo(() => rentHomeCategoryFilters(homeFleet), [homeFleet]);

  const filteredHomeFleet = homeFleet
    .filter((v) => (homeCategory ? v.category === homeCategory : true))
    .filter((v) => {
      const q = homeQuery.trim().toLowerCase();
      if (!q) return true;
      return `${v.model || ''} ${v.category || ''} ${v.category_label || ''} ${v.display_blurb || v.description || ''}`
        .toLowerCase()
        .includes(q);
    });

  const fleetSubtitle = searchActive
    ? `${filteredHomeFleet.length} διαθέσιμα για τις ημερομηνίες σου`
    : showingDemoFleet
      ? `${carCount} επιβατικά · ${vanCount} van · demo προεπισκόπηση πλατφόρμας`
      : `${carCount} επιβατικά · ${vanCount} van`;

  return (
    <div className={`rent-phone-stage${isMobile ? '' : ' rent-phone-stage--desktop'}`}>
      <div className="rent-app rent-app--guest">
        <header className="rent-topbar rent-topbar--guest">
          <button
            type="button"
            className="rent-topbar-brand"
            onClick={() => {
              /* no-op */
            }}
          >
            {branding.brandLabel}
          </button>
          <RentGuestTopActions onAccount={onRequireLogin} />
        </header>

        <main className="rent-home rent-home--guest-land">
          <RentGuestHero
            brandLabel={branding.brandLabel}
            heroKicker={branding.heroKicker}
            title={branding.title}
            titleAccent={branding.titleAccent}
            copy={branding.copy}
            carCount={carCount}
            vanCount={vanCount}
            siteAppearance={siteAppearance}
            footerAddress={footerAddress}
            pickupLocations={pickupLocations}
            onBrowseFleet={() => {
              const el = document.getElementById('rent-guest-fleet');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            onStartSearch={() => {
              document
                .getElementById('rent-guest-search')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onSelectPickup={(value) => {
              setHeroPickup(value);
              writeRentBookingPrefs({
                ...readRentBookingPrefs(),
                pickup_location: value,
                dropoff_location: value,
              });
              document
                .getElementById('rent-guest-search')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onRequireLogin={onRequireLogin}
          />

          <div id="rent-guest-search" className="rent-search-wrap rent-search-wrap--top rent-search-wrap--below-hero">
            <RentBookingSearchBar
              brandLabel={branding.brandLabel}
              footerAddress={footerAddress}
              pickupLocations={pickupLocations}
              preferredPickup={heroPickup}
              onSearch={async (prefs) => {
                writeRentBookingPrefs({ ...(prefs || {}), wizard_step: 'vehicle' });
                setSearchActive(true);
                setFleetLoading(true);
                try {
                  const rows = await fetchPublicRentalAvailability({
                    startTime: new Date(prefs.start_time).toISOString(),
                    endTime: new Date(prefs.end_time).toISOString(),
                    pickupLocation: prefs.pickup_location,
                    dropoffLocation: prefs.dropoff_location || prefs.pickup_location,
                  });
                  // Date search: never invent availability from marketing demo fleet.
                  setHomeFleet(
                    enrichRentFleet(
                      withDemoRentFleet(Array.isArray(rows) ? rows : [], { allowShowcase: false }).slice(
                        0,
                        24,
                      ),
                    ),
                  );
                } catch {
                  /* keep current catalog if availability fails */
                } finally {
                  setFleetLoading(false);
                  document
                    .getElementById('rent-guest-fleet')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            />
          </div>

          <div className="rent-home-stack rent-home-stack--landing">
            <section id="rent-guest-fleet" className="rent-land-band rent-land-band--pick" aria-label="Στόλος ενοικίασης">
              <div className="rent-land-inner">
                <header className="rent-pick-head">
                  <div className="rent-pick-head-main">
                    <h2 className="rent-pick-head-title">
                      Επιλογές ενοικίασης οχήματος
                      <span className="rent-pick-head-where">
                        για
                        <span className="rent-pick-loc">{branding.brandLabel || 'το γραφείο'}</span>
                      </span>
                    </h2>
                    <p className="rent-pick-head-sub">{fleetSubtitle}</p>
                  </div>
                  <div className="rent-pick-filters">
                    <label className="rent-pick-filter">
                      <span>Φίλτρα</span>
                      <select
                        value={homeCategory}
                        onChange={(e) => setHomeCategory(e.target.value)}
                      >
                        {homeCategories.map((c) => (
                          <option key={c || 'all'} value={c}>
                            {homeCategoryLabel(c) || 'Επίλεξε'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="rent-pick-filter rent-pick-filter--search">
                      <span>Αναζήτηση</span>
                      <input
                        type="search"
                        value={homeQuery}
                        onChange={(e) => setHomeQuery(e.target.value)}
                        placeholder="Μοντέλο…"
                      />
                    </label>
                  </div>
                </header>

                {fleetLoading ? (
                  <p className="rent-home-fleet-empty">Φόρτωση στόλου…</p>
                ) : filteredHomeFleet.length ? (
                  <div className="rent-pick-grid">
                    {filteredHomeFleet.map((v) => (
                      <RentHomeFleetCard
                        key={v.id}
                        vehicle={v}
                        favorite={favorites.includes(v.id)}
                        onToggleFavorite={() => toggleFavorite(v.id)}
                        onSelect={() => goToServicesStep(v)}
                        onOpenDetails={() => setDetailVehicle(v)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rent-home-fleet-empty">
                    {searchActive
                      ? 'Δεν υπάρχει διαθέσιμο όχημα για αυτές τις ημερομηνίες.'
                      : 'Δεν υπάρχουν διαθέσιμα οχήματα.'}
                  </p>
                )}
              </div>
            </section>

            <RentGuestLandingExtras
              brandLabel={branding.brandLabel}
              onRequireLogin={onRequireLogin}
              onStartSearch={() => {
                document
                  .getElementById('rent-guest-search')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />

            {isPlatformMarketingHost() ? <RentProductSection /> : null}
          </div>
        </main>
      </div>
      <RentVehicleDetailSheet
        vehicle={detailVehicle}
        onClose={() => setDetailVehicle(null)}
        onSelect={(v) => goToServicesStep(v)}
      />
    </div>
  );
}

function RentalAuthGate() {
  // Re-check auth after in-place login (same URL /rent).
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname || '';
  const isWalletPath = path === '/rent/wallet' || path.startsWith('/rent/wallet/');
  const continueToBooking = Boolean(
    location.state?.rentContinue ||
      location.state?.from === '/rent/book/services' ||
      location.state?.from === '/rent/book/details' ||
      location.state?.from === '/rent/book/payment',
  );
  const continueTarget =
    location.state?.from === '/rent/book/payment'
      ? '/rent/book/payment'
      : location.state?.from === '/rent/book/details'
        ? '/rent/book/details'
        : '/rent/book/services';
  const fromLookup = Boolean(location.state?.rentLookup || location.state?.openRentWallet);
  // Guests always land on the /rent hero. Wallet / book continue open login.
  const [showLogin, setShowLogin] = useState(() => continueToBooking || isWalletPath || fromLookup);
  useEffect(() => setupRentalPwa(), []);

  useEffect(() => {
    if (continueToBooking || isWalletPath || fromLookup) setShowLogin(true);
  }, [continueToBooking, isWalletPath, fromLookup]);

  useEffect(() => {
    if (getCustomerToken() && continueToBooking) {
      navigate(continueTarget, { replace: true });
    }
  }, [continueToBooking, continueTarget, navigate, location.key]);

  if (isCustomer() && !getCustomerToken()) logoutCustomer();

  if (getCustomerToken()) {
    if (continueToBooking) return null;
    return (
      <RentalAuthenticatedApp
        key={location.key}
        walletFocus={isWalletPath || fromLookup}
      />
    );
  }

  if (showLogin) {
    // Prefer dedicated green /rent/login for wallet/lookup deep-links.
    if (isWalletPath || fromLookup) {
      return (
        <Navigate
          to="/rent/login"
          replace
          state={{
            ...(location.state || {}),
            from: '/rent/wallet',
            rentEntrance: true,
          }}
        />
      );
    }
    return (
      <LoginPage
        rentEntrance
        key={continueToBooking ? 'rent-continue' : 'rent-login'}
      />
    );
  }

  return (
    <RentalGuestPreviewApp
      onRequireLogin={() =>
        navigate('/rent/login', { state: { from: '/rent/wallet', rentEntrance: true } })
      }
      onPickVehicle={() => {
        /* handled in guest */
      }}
    />
  );
}

function RentalAuthenticatedApp({ walletFocus = false } = {}) {
  const isMobile = useRentMobile();
  const location = useLocation();
  const [branding, setBranding] = useState(() => resolveRentAppBranding({}));
  const [calKey, setCalKey] = useState(0);
  const [walletKey, setWalletKey] = useState(0);
  const highlightBookingId = String(location.state?.highlightRentalBooking || '').trim();
  const openWalletFromLookup = Boolean(
    walletFocus || location.state?.openRentWallet || highlightBookingId,
  );
  const [homeFleet, setHomeFleet] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [featuredVehicle, setFeaturedVehicle] = useState(null);
  const [homeCategory, setHomeCategory] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const [detailVehicle, setDetailVehicle] = useState(null);
  const { favorites, toggleFavorite } = useRentFavorites();

  useEffect(() => setupRentalPwa(), []);

  useEffect(() => {
    if (!openWalletFromLookup) return undefined;
    const t = window.setTimeout(() => {
      setWalletKey((k) => k + 1);
      const el = document.getElementById('rent-wallet');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [openWalletFromLookup, highlightBookingId, location.key, walletFocus]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const brand = resolveOfficeBrand(data || {});
        setBranding(
          resolveRentAppBranding({
            ...(data || {}),
            footer_brand_name: data?.footer_brand_name || brand.displayName || brand.name,
            display_name: brand.displayName || brand.name,
          }),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const homeCategories = useMemo(() => rentHomeCategoryFilters(homeFleet), [homeFleet]);

  const filteredHomeFleet = homeFleet
    .filter((v) => (homeCategory ? v.category === homeCategory : true))
    .filter((v) => {
      const q = homeQuery.trim().toLowerCase();
      if (!q) return true;
      return `${v.model || ''} ${v.category || ''} ${v.category_label || ''} ${v.display_blurb || v.description || ''}`
        .toLowerCase()
        .includes(q);
    });

  useEffect(() => {
    let cancelled = false;
    setFleetLoading(true);
    fetchCustomerRentalCatalog()
      .then((rows) => {
        if (cancelled) return;
        const sliced = enrichRentFleet(withDemoRentFleet(Array.isArray(rows) ? rows : []).slice(0, 24));
        setHomeFleet(sliced);
        try {
          const preferredId = localStorage.getItem(PREFERRED_VEHICLE_ID_KEY);
          if (preferredId) {
            const found = sliced.find((v) => String(v.id) === String(preferredId));
            if (found) setFeaturedVehicle(found);
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (cancelled) return;
        setHomeFleet(enrichRentFleet(withDemoRentFleet([])));
      })
      .finally(() => {
        if (!cancelled) setFleetLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = useMemo(() => {
    const email = (getCustomerEmail() || '').toLowerCase();
    return {
      email,
      name: getCustomerName() || email.split('@')[0] || 'Πελάτης',
      picture: getCustomerPicture() || '',
    };
  }, []);

  const navigate = useNavigate();

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openWallet = () => {
    if (location.pathname !== '/rent/wallet') {
      navigate('/rent/wallet', {
        state: {
          ...(location.state || {}),
          openRentWallet: true,
        },
      });
      return;
    }
    setWalletKey((k) => k + 1);
    requestAnimationFrame(() => scrollToSection('rent-wallet'));
  };

  const pickVehicle = (v) => {
    setFeaturedVehicle(v);
    rememberPreferredVehicle(v);
    writeRentBookingPrefs({
      vehicle_id: v?.id || '',
      wizard_step: 'services',
    });
    navigate('/rent/book/services');
  };

  return (
    <div
      className={`rent-phone-stage rent-phone-stage--inline${
        isMobile ? ' rent-phone-stage--mobile-wallet' : ' rent-phone-stage--desktop'
      }`}
    >
      <div className="rent-app rent-app--inline">
        <header className="rent-topbar">
          <button
            type="button"
            className="rent-topbar-brand"
            onClick={() => scrollToSection(isMobile ? 'rent-wallet' : 'rent-home')}
          >
            {branding.brandLabel}
          </button>
          <button type="button" className="rent-btn rent-btn-wallet" onClick={openWallet}>
            <span className="material-symbols-outlined" aria-hidden>
              account_balance_wallet
            </span>
            Rent Wallet
          </button>
        </header>

        <main className="rent-main rent-main--inline">
          {!isMobile ? (
            <section id="rent-home" className="rent-inline-section" aria-label="Αρχική">
              <section className="rent-hero rent-hero--inline" aria-label="Ενοικίαση">
                <p className="rent-hero-brand">{branding.heroKicker || branding.brandLabel}</p>
                <h1 className="rent-hero-title">{branding.title}</h1>
                <p className="rent-hero-copy">{branding.copy}</p>
                <button type="button" className="rent-hero-cta" onClick={() => scrollToSection('rent-book')}>
                  <span className="material-symbols-outlined" aria-hidden>
                    search
                  </span>
                  {branding.ctaLabel}
                </button>
              </section>

              <div className="rent-home-stack">
                <RentalInstallPrompt force />
                <section className="rent-home-fleet" aria-label="Στόλος ενοικίασης">
                  <div className="rent-home-fleet-head">
                    <h2>Στόλος ενοικίασης</h2>
                    <button
                      type="button"
                      className="rent-home-fleet-link"
                      onClick={() => scrollToSection('rent-book')}
                    >
                      Δες κράτηση
                    </button>
                  </div>
                  <div className="rent-home-fleet-tools">
                    <input
                      type="search"
                      value={homeQuery}
                      onChange={(e) => setHomeQuery(e.target.value)}
                      placeholder="Αναζήτηση μοντέλου ή περιγραφής…"
                    />
                    <div className="rent-home-fleet-cats">
                      {homeCategories.map((c) => (
                        <button
                          key={c || 'all'}
                          type="button"
                          className={homeCategory === c ? 'is-active' : ''}
                          onClick={() => setHomeCategory(c)}
                        >
                          {homeCategoryLabel(c)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {fleetLoading ? (
                    <p className="rent-home-fleet-empty">Φόρτωση στόλου…</p>
                  ) : filteredHomeFleet.length ? (
                    <div className="rent-pick-grid rent-pick-grid--home">
                      {filteredHomeFleet.map((v) => (
                        <RentHomeFleetCard
                          key={v.id}
                          vehicle={v}
                          favorite={favorites.includes(v.id)}
                          onToggleFavorite={() => toggleFavorite(v.id)}
                          onSelect={() => pickVehicle(v)}
                          onOpenDetails={() => setDetailVehicle(v)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="rent-home-fleet-empty">
                      Δεν βρέθηκαν οχήματα για τα φίλτρα που έβαλες.
                    </p>
                  )}
                </section>
              </div>
            </section>
          ) : null}

          <section id="rent-wallet" className="rent-inline-section rent-inline-section--wallet">
            <RentWalletCheckInBand officeName={branding.brandLabel}>
              <div className="rent-panel rent-panel--wallet">
                <h2>My Wallet</h2>
                <p className="rent-panel-lead">
                  Οι κάρτες ενοικίασής σας — χωριστά από το My Wallet των λεωφορείων.
                </p>
                <RentalWalletPanel
                  brandLabel={branding.brandLabel}
                  passengerName={profile.name}
                  refreshKey={walletKey}
                  highlightBookingId={highlightBookingId}
                  onBookVehicle={() => scrollToSection('rent-book')}
                />
              </div>
            </RentWalletCheckInBand>
          </section>

          <section id="rent-book" className="rent-inline-section">
            <div className="rent-panel">
              <h2>Κράτηση</h2>
              <p className="rent-panel-lead">
                Επιλέξτε ημερομηνίες και όχημα — η κράτηση περνάει αμέσως στο γραφείο.
              </p>
              <RentalCatalogPanel
                mode="book"
                preferredVehicle={featuredVehicle}
                onClearPreferred={() => {
                  setFeaturedVehicle(null);
                  try {
                    localStorage.removeItem(PREFERRED_VEHICLE_ID_KEY);
                  } catch {
                    /* ignore */
                  }
                }}
                onBooked={() => {
                  setCalKey((k) => k + 1);
                  setWalletKey((k) => k + 1);
                  try {
                    localStorage.removeItem(PREFERRED_VEHICLE_ID_KEY);
                  } catch {
                    /* ignore */
                  }
                  requestAnimationFrame(() => scrollToSection('rent-wallet'));
                }}
              />
            </div>
          </section>

          <section id="rent-calendar" className="rent-inline-section">
            <div className="rent-panel">
              <h2>Ημερολόγιο</h2>
              <p className="rent-panel-lead">
                Οι κρατήσεις σας ανά μέρα — επιλέξτε ημερομηνία και δείτε την παραλαβή στον χάρτη.
              </p>
              <RentalCustomerCalendar refreshKey={calKey} />
            </div>
          </section>

          <section id="rent-account" className="rent-inline-section">
            <div className="rent-panel">
              <h2>Λογαριασμός</h2>
              <p className="rent-panel-lead">
                Στοιχεία σύνδεσης για την εφαρμογή ενοικίασης. Τα εισιτήρια λεωφορείου είναι στο My
                Wallet λεωφορείων.
              </p>
              <dl style={{ margin: 0 }}>
                <div className="rent-account-row">
                  <div>
                    <dt>Όνομα</dt>
                    <dd>{profile.name}</dd>
                  </div>
                </div>
                <div className="rent-account-row">
                  <div>
                    <dt>Email</dt>
                    <dd>{profile.email}</dd>
                  </div>
                </div>
              </dl>
              <RentalInstallPrompt force />
              <div style={{ display: 'grid', gap: '0.6rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="rent-btn rent-btn-danger rent-btn-block"
                  onClick={() => {
                    logoutCustomer();
                    window.location.assign('/');
                  }}
                >
                  Αποσύνδεση
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
      <RentVehicleDetailSheet
        vehicle={detailVehicle}
        onClose={() => setDetailVehicle(null)}
        onSelect={(v) => pickVehicle(v)}
      />
    </div>
  );
}

export default function RentalCustomerApp() {
  return <RentalAuthGate />;
}
