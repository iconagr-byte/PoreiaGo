import { useDeferredValue, useEffect, useMemo, useState } from 'react';
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
import { resolveRentTheme, rentThemeStyleVars } from '../lib/rental/rentThemes.js';
import {
  isStorefrontPreviewMode,
  readHomepagePreviewDraft,
} from '../lib/homepage/homepagePreview.js';
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
import {
  EMPTY_RENT_FLEET_FILTERS,
  applyRentFleetFilters,
  rentFleetFiltersActive,
} from '../lib/rental/rentFleetFilters.js';
import {
  readRentVehicleSnapshot,
  rememberRentVehicle,
} from '../lib/rental/rentBookingExtras.js';
import {
  navigateToRentDateSearch,
  readRentBookingPrefs,
  rentTripSearchReady,
  writeRentBookingPrefs,
} from '../lib/rental/rentBookingSearch.js';
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
import RentFleetFilterSidebar from '../components/rental/RentFleetFilterSidebar.jsx';
import RentVehicleDetailSheet from '../components/rental/RentVehicleDetailSheet.jsx';
import RentBrandMark from '../components/rental/RentBrandMark.jsx';
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
  const [heroPickup, setHeroPickup] = useState(() => {
    try {
      return String(readRentBookingPrefs()?.pickup_location || '').trim();
    } catch {
      return '';
    }
  });
  const [homeFleet, setHomeFleet] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [homeCategory, setHomeCategory] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const deferredHomeQuery = useDeferredValue(homeQuery);
  const [fleetSort, setFleetSort] = useState('default');
  const [fleetFilters, setFleetFilters] = useState(() => ({ ...EMPTY_RENT_FLEET_FILTERS }));
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
    if (!rentTripSearchReady()) {
      navigateToRentDateSearch(navigate, {
        message:
          'Σχεδόν έτοιμο — επίλεξε ημερομηνίες παραλαβής και επιστροφής για να συνεχίσεις με αυτό το όχημα.',
      });
      return;
    }
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
        // Design studio draft (?preview=1) overlays live appearance for theme preview.
        const draft = isStorefrontPreviewMode() ? readHomepagePreviewDraft() : null;
        const appearance = { ...(data || {}), ...(draft || {}) };
        const brand = resolveOfficeBrand(appearance);
        setFooterAddress(String(appearance?.footer_address || '').trim());
        setSiteAppearance(appearance);
        setPickupLocations(
          Array.isArray(appearance?.rent_pickup_locations)
            ? appearance.rent_pickup_locations.map((x) => String(x || '').trim()).filter(Boolean)
            : [],
        );
        setBranding(
          resolveRentAppBranding(
            {
              ...appearance,
              footer_brand_name: appearance?.footer_brand_name || brand.displayName || '',
              display_name: brand.displayName || '',
              logo_url: appearance?.logo_url || brand.logoUrl || '',
              logo_show_name: brand.showName,
            },
            { guest: true },
          ),
        );
      })
      .catch(() => {
        if (cancelled) return;
        if (!isStorefrontPreviewMode()) return;
        const draft = readHomepagePreviewDraft();
        if (!draft) return;
        setSiteAppearance(draft);
        setBranding(resolveRentAppBranding(draft, { guest: true }));
      });
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

  const categoryCounts = useMemo(() => {
    const counts = { '': homeFleet.length };
    for (const v of homeFleet) {
      const id = String(v.category || '');
      if (!id) continue;
      counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [homeFleet]);

  const categoryScopedFleet = useMemo(
    () =>
      homeFleet
        .filter((v) => (homeCategory ? v.category === homeCategory : true))
        .filter((v) => {
          const q = deferredHomeQuery.trim().toLowerCase();
          if (!q) return true;
          return `${v.model || ''} ${v.category || ''} ${v.category_label || ''} ${v.display_blurb || v.description || ''}`
            .toLowerCase()
            .includes(q);
        }),
    [homeFleet, homeCategory, deferredHomeQuery],
  );

  const sidebarFiltersActive = rentFleetFiltersActive(fleetFilters);
  const clearAllFleetFilters = () => {
    setHomeCategory('');
    setHomeQuery('');
    setFleetSort('default');
    setFleetFilters({ ...EMPTY_RENT_FLEET_FILTERS });
  };

  const filteredHomeFleet = useMemo(() => {
    const rows = applyRentFleetFilters(categoryScopedFleet, fleetFilters);

    if (fleetSort === 'price_asc' || fleetSort === 'price_desc') {
      const dir = fleetSort === 'price_asc' ? 1 : -1;
      return [...rows].sort((a, b) => {
        const pa = Number(a?.daily_rate_eur);
        const pb = Number(b?.daily_rate_eur);
        const aOk = Number.isFinite(pa);
        const bOk = Number.isFinite(pb);
        if (!aOk && !bOk) return 0;
        if (!aOk) return 1;
        if (!bOk) return -1;
        return (pa - pb) * dir;
      });
    }
    return rows;
  }, [categoryScopedFleet, fleetFilters, fleetSort]);

  const fleetSubtitle = searchActive
    ? `${filteredHomeFleet.length} διαθέσιμα για τις ημερομηνίες σου`
    : showingDemoFleet
      ? `${carCount} επιβατικά · ${vanCount} van · demo προεπισκόπηση`
      : `${carCount} επιβατικά · ${vanCount} van`;

  const rentTheme = useMemo(() => resolveRentTheme(siteAppearance || {}), [siteAppearance]);
  const rentThemeVars = useMemo(
    () => rentThemeStyleVars(siteAppearance || {}),
    [siteAppearance],
  );

  return (
    <div className={`rent-phone-stage${isMobile ? '' : ' rent-phone-stage--desktop'}`}>
      <div
        className="rent-app rent-app--guest"
        data-rent-theme={rentTheme.themeId}
        data-rent-hero={rentTheme.heroStyle}
        data-rent-fleet={rentTheme.fleetLayout}
        data-rent-card={rentTheme.fleetCard}
        style={rentThemeVars}
      >
        <header
          className={`rent-topbar rent-topbar--guest${
            branding.headerCompact || rentTheme.headerCompact ? ' rent-topbar--compact' : ''
          }`}
        >
          <div className="rent-topbar-row">
            <RentGuestTopActions
              brand={
                <button
                  type="button"
                  className="rent-topbar-brand"
                  aria-label={branding.brandLabel}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <RentBrandMark
                    label={branding.brandLabel}
                    logoUrl={branding.logoUrl}
                    showName={branding.showName}
                    subtitle={branding.brandSubtitle}
                    logoHeightPx={branding.logoHeightPx}
                    logoMaxWidthPx={branding.logoMaxWidthPx}
                    logoRadiusPx={branding.logoRadiusPx}
                    logoPaddingPx={branding.logoPaddingPx}
                    logoBgMode={branding.logoBgMode}
                    logoShadow={branding.logoShadow}
                    compact={branding.headerCompact}
                  />
                </button>
              }
              onAccount={onRequireLogin}
              phone={String(siteAppearance?.footer_contact_phone || '').trim()}
              onFindVehicle={() => {
                document
                  .getElementById('rent-guest-search')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          </div>
        </header>

        <main className="rent-home rent-home--guest-land">
          <RentGuestHero
            brandLabel={branding.brandLabel}
            logoUrl={branding.logoUrl}
            brandSubtitle={branding.brandSubtitle}
            logoHeightPx={branding.logoHeightPx}
            logoMaxWidthPx={branding.logoMaxWidthPx}
            logoRadiusPx={branding.logoRadiusPx}
            logoPaddingPx={branding.logoPaddingPx}
            logoBgMode={branding.logoBgMode}
            logoShadow={branding.logoShadow}
            heroStyle={rentTheme.heroStyle}
            title={branding.title}
            titleAccent={branding.titleAccent}
            copy={branding.copy}
            benefits={branding.benefits}
            siteAppearance={siteAppearance}
          >
            <RentBookingSearchBar
              variant="hero"
              brandLabel={branding.brandLabel}
              footerAddress={footerAddress}
              pickupLocations={pickupLocations}
              preferredPickup={heroPickup}
              showDropoffToggle={branding.searchLayout?.showDropoffToggle !== false}
              showPromo={branding.searchLayout?.showPromo !== false}
              submitLabel={branding.searchLayout?.submitLabel}
              onSearch={async (prefs) => {
                const prior = readRentBookingPrefs();
                const resumeServices =
                  prior.wizard_step === 'services' &&
                  Boolean(prior.vehicle_id || readRentVehicleSnapshot()?.id);
                writeRentBookingPrefs({
                  ...(prefs || {}),
                  wizard_step: resumeServices ? 'services' : 'vehicle',
                });
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
                  if (resumeServices) {
                    navigate('/rent/book/services');
                    return;
                  }
                  document
                    .getElementById('rent-guest-fleet')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            />
          </RentGuestHero>

          <div className="rent-home-stack rent-home-stack--landing">
            {/* Filters sit in a left page column — outside the car-results frame. */}
            <div id="rent-guest-fleet" className="rent-fleet-shell">
              <RentFleetFilterSidebar
                vehicles={categoryScopedFleet}
                filters={fleetFilters}
                onChange={setFleetFilters}
              />

              <section className="rent-land-band rent-land-band--pick" aria-label="Στόλος ενοικίασης">
                <div className="rent-land-inner rent-land-inner--pick">
                  <header className="rent-pick-head">
                    <div className="rent-pick-head-main">
                      <p className="rent-pick-eyebrow">Στόλος</p>
                      <h2 className="rent-pick-head-title">
                        Επίλεξε όχημα
                        <span className="rent-pick-count">{filteredHomeFleet.length}</span>
                      </h2>
                      <p className="rent-pick-head-sub">{fleetSubtitle}</p>
                      {homeCategory || homeQuery || sidebarFiltersActive ? (
                        <div className="rent-pick-head-meta">
                          <button
                            type="button"
                            className="rent-pick-active-chip"
                            onClick={clearAllFleetFilters}
                          >
                            <span className="material-symbols-outlined" aria-hidden>
                              filter_alt_off
                            </span>
                            Καθαρισμός φίλτρων
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="rent-pick-toolbar">
                      <div className="rent-pick-cats" role="tablist" aria-label="Κατηγορία">
                        {homeCategories.map((c) => (
                          <button
                            key={c || 'all'}
                            type="button"
                            role="tab"
                            aria-selected={homeCategory === c}
                            className={`rent-pick-cat${homeCategory === c ? ' is-active' : ''}`}
                            onClick={() => setHomeCategory(c)}
                          >
                            <span>{homeCategoryLabel(c)}</span>
                            <span className="rent-pick-cat-count">{categoryCounts[c] ?? 0}</span>
                          </button>
                        ))}
                      </div>

                      <div className="rent-pick-filters">
                        <label className="rent-pick-filter rent-pick-filter--search">
                          <span className="material-symbols-outlined" aria-hidden>
                            search
                          </span>
                          <input
                            type="search"
                            value={homeQuery}
                            onChange={(e) => setHomeQuery(e.target.value)}
                            placeholder="Αναζήτηση μοντέλου…"
                            aria-label="Αναζήτηση οχήματος"
                          />
                          {homeQuery ? (
                            <button
                              type="button"
                              className="rent-pick-search-clear"
                              aria-label="Καθαρισμός αναζήτησης"
                              onClick={(e) => {
                                e.preventDefault();
                                setHomeQuery('');
                              }}
                            >
                              <span className="material-symbols-outlined" aria-hidden>
                                close
                              </span>
                            </button>
                          ) : null}
                        </label>
                        <label className="rent-pick-filter rent-pick-filter--sort">
                          <span className="visually-hidden">Ταξινόμηση</span>
                          <select
                            value={fleetSort}
                            onChange={(e) => setFleetSort(e.target.value)}
                            aria-label="Ταξινόμηση"
                          >
                            <option value="default">Προεπιλογή</option>
                            <option value="price_asc">Τιμή ↑</option>
                            <option value="price_desc">Τιμή ↓</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </header>

                  {fleetLoading ? (
                    <p className="rent-home-fleet-empty">Φόρτωση στόλου…</p>
                  ) : filteredHomeFleet.length ? (
                    <div
                      className={`rent-pick-grid rent-pick-grid--${String(rentTheme.fleetLayout || 'rent_grid_three').replace(/_/g, '-')}`}
                    >
                      {filteredHomeFleet.map((v, index) => (
                        <RentHomeFleetCard
                          key={v.id}
                          vehicle={v}
                          favorite={favorites.includes(v.id)}
                          onToggleFavorite={() => toggleFavorite(v.id)}
                          onSelect={() => goToServicesStep(v)}
                          onOpenDetails={() => setDetailVehicle(v)}
                          templateId={rentTheme.fleetCard}
                          featured={rentTheme.fleetLayout === 'rent_featured' && index === 0}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rent-pick-empty">
                      <span className="material-symbols-outlined" aria-hidden>
                        directions_car
                      </span>
                      <p>
                        {searchActive
                          ? 'Δεν υπάρχει διαθέσιμο όχημα για αυτές τις ημερομηνίες.'
                          : 'Δεν βρέθηκαν οχήματα με αυτά τα φίλτρα.'}
                      </p>
                      {homeCategory || homeQuery || sidebarFiltersActive ? (
                        <button
                          type="button"
                          className="rent-pick-empty-reset"
                          onClick={clearAllFleetFilters}
                        >
                          Καθαρισμός φίλτρων
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </section>
            </div>

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
            footer_brand_name: data?.footer_brand_name || brand.displayName || '',
            display_name: brand.displayName || '',
            logo_url: data?.logo_url || brand.logoUrl || '',
            logo_show_name: brand.showName,
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
    if (!rentTripSearchReady()) {
      navigateToRentDateSearch(navigate, {
        message:
          'Σχεδόν έτοιμο — επίλεξε ημερομηνίες παραλαβής και επιστροφής για να συνεχίσεις με αυτό το όχημα.',
      });
      return;
    }
    navigate('/rent/book/services');
  };

  return (
    <div
      className={`rent-phone-stage rent-phone-stage--inline${
        isMobile ? ' rent-phone-stage--mobile-wallet' : ' rent-phone-stage--desktop'
      }`}
    >
      <div className="rent-app rent-app--inline">
        <header
          className={`rent-topbar${branding.headerCompact ? ' rent-topbar--compact' : ''}`}
        >
          <button
            type="button"
            className="rent-topbar-brand"
            aria-label={branding.brandLabel}
            onClick={() => scrollToSection(isMobile ? 'rent-wallet' : 'rent-home')}
          >
            <RentBrandMark
              label={branding.brandLabel}
              logoUrl={branding.logoUrl}
              showName={branding.showName}
              subtitle={branding.brandSubtitle}
              logoHeightPx={branding.logoHeightPx}
              logoMaxWidthPx={branding.logoMaxWidthPx}
              logoRadiusPx={branding.logoRadiusPx}
              logoPaddingPx={branding.logoPaddingPx}
              logoBgMode={branding.logoBgMode}
              logoShadow={branding.logoShadow}
              compact={branding.headerCompact}
            />
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
                <div className="rent-hero-brand">
                  <RentBrandMark
                    label={branding.brandLabel}
                    logoUrl={branding.logoUrl}
                    showName={branding.showName}
                    subtitle={branding.brandSubtitle}
                    logoHeightPx={branding.logoHeightPx}
                    logoMaxWidthPx={branding.logoMaxWidthPx}
                    logoRadiusPx={branding.logoRadiusPx}
                    logoPaddingPx={branding.logoPaddingPx}
                    logoBgMode={branding.logoBgMode}
                    logoShadow={branding.logoShadow}
                  />
                </div>
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
