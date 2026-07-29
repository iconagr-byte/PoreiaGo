import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getCustomerEmail,
  getCustomerName,
  getCustomerPicture,
  getCustomerToken,
  isCustomer,
  logoutCustomer,
} from '../lib/auth.js';
import { setupRentalPwa } from '../lib/rental/registerRentalPwa.js';
import {
  isRentMobileViewport,
  useRentMobile,
} from '../lib/rental/rentDevice.js';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import { resolveRentAppBranding } from '../lib/rental/rentAppBranding.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import { fetchCustomerRentalCatalog, fetchPublicRentalCatalog } from '../services/customerRentalApi.js';
import { withDemoRentFleet } from '../lib/rental/demoRentFleet.js';
import { enrichRentFleet, homeCategoryLabel } from '../lib/rental/rentFleetEnrichment.js';
import RentalCatalogPanel from '../components/wallet/RentalCatalogPanel.jsx';
import RentalInstallPrompt from '../components/rental/RentalInstallPrompt.jsx';
import RentalCustomerCalendar from '../components/rental/RentalCustomerCalendar.jsx';
import RentalWalletPanel from '../components/rental/RentalWalletPanel.jsx';
import RentGuestLandingExtras from '../components/rental/RentGuestLandingExtras.jsx';
import RentGuestHero from '../components/rental/RentGuestHero.jsx';
import RentHomeFleetCard from '../components/rental/RentHomeFleetCard.jsx';
import LoginPage from './LoginPage.jsx';
import '../styles/wallet-pass.css';
import '../styles/rental-pwa.css';

const HOME_CATEGORIES = ['', 'CAR', 'VAN', 'MINIBUS'];

const PREFERRED_VEHICLE_ID_KEY = 'rent_preferred_vehicle_id_v1';

function useRentFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rent_favorites_v1') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('rent_favorites_v1', JSON.stringify(favorites));
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
  try {
    localStorage.setItem(PREFERRED_VEHICLE_ID_KEY, String(vehicle.id));
  } catch {
    /* ignore */
  }
}

function RentalGuestPreviewApp({ onRequireLogin, onPickVehicle } = {}) {
  const isMobile = useRentMobile();
  const [branding, setBranding] = useState(() => resolveRentAppBranding({}, { guest: true }));
  const [homeFleet, setHomeFleet] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [homeCategory, setHomeCategory] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const { favorites, toggleFavorite } = useRentFavorites();

  useEffect(() => {
    let cancelled = false;
    setFleetLoading(true);
    fetchPublicRentalCatalog()
      .then((rows) => {
        if (cancelled) return;
        setHomeFleet(enrichRentFleet(withDemoRentFleet(Array.isArray(rows) ? rows : []).slice(0, 12)));
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

  const carCount = homeFleet.filter((v) => String(v.category || '').toUpperCase() === 'CAR').length;
  const vanCount = homeFleet.filter((v) => String(v.category || '').toUpperCase() === 'VAN').length;

  const filteredHomeFleet = homeFleet
    .filter((v) => (homeCategory ? v.category === homeCategory : true))
    .filter((v) => {
      const q = homeQuery.trim().toLowerCase();
      if (!q) return true;
      return `${v.model || ''} ${v.category || ''} ${v.display_blurb || v.description || ''}`
        .toLowerCase()
        .includes(q);
    });

  return (
    <div className={`rent-phone-stage${isMobile ? '' : ' rent-phone-stage--desktop'}`}>
      <div className="rent-app rent-app--guest">
        <header className="rent-topbar">
          <button
            type="button"
            className="rent-topbar-brand"
            onClick={() => {
              /* no-op */
            }}
          >
            {branding.brandLabel}
          </button>
          <button type="button" className="rent-btn rent-btn-ghost" onClick={onRequireLogin}>
            Κράτηση
          </button>
        </header>

        <main className="rent-home">
          <RentGuestHero
            brandLabel={branding.brandLabel}
            title={branding.title}
            titleAccent={branding.titleAccent}
            copy={branding.copy}
            carCount={carCount}
            vanCount={vanCount}
            onBrowseFleet={() => {
              const el = document.getElementById('rent-guest-fleet');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            onRequireLogin={onRequireLogin}
          />

          <div className="rent-home-stack rent-home-stack--landing">
            <section id="rent-guest-fleet" className="rent-land-band rent-land-band--mist" aria-label="Στόλος ενοικίασης">
              <div className="rent-land-inner">
                <header className="rent-land-head">
                  <p className="rent-land-eyebrow">Στόλος</p>
                  <h2 className="rent-land-title">Επιλέξτε όχημα</h2>
                  <p className="rent-land-sub">
                    {carCount} επιβατικά · {vanCount} van. Η κράτηση ανοίγει μετά τη σύνδεση.
                  </p>
                </header>

                <div className="rent-home-fleet-tools rent-apple-tools rent-land-tools">
                  <input
                    type="search"
                    value={homeQuery}
                    onChange={(e) => setHomeQuery(e.target.value)}
                    placeholder="Αναζήτηση…"
                  />
                  <div className="rent-home-fleet-cats rent-apple-cats">
                    {HOME_CATEGORIES.map((c) => (
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
                  <div className="rent-fleet-rail rent-fleet-rail--land">
                    {filteredHomeFleet.map((v) => (
                      <RentHomeFleetCard
                        key={v.id}
                        vehicle={v}
                        favorite={favorites.includes(v.id)}
                        onToggleFavorite={() => toggleFavorite(v.id)}
                        onSelect={() => {
                          rememberPreferredVehicle(v);
                          onPickVehicle?.(v);
                          onRequireLogin?.();
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rent-home-fleet-empty">Δεν βρέθηκαν οχήματα για τα φίλτρα.</p>
                )}
              </div>
            </section>

            <RentGuestLandingExtras brandLabel={branding.brandLabel} onRequireLogin={onRequireLogin} />
          </div>
        </main>
      </div>
    </div>
  );
}

function RentalAuthGate() {
  // Re-check auth after in-place login (same URL /rent).
  const location = useLocation();
  const isMobile = useRentMobile();
  // Mobile app = Wallet entrance. Desktop guests may browse fleet first.
  const [showLogin, setShowLogin] = useState(() => isRentMobileViewport());
  useEffect(() => setupRentalPwa(), []);

  useEffect(() => {
    if (isMobile) setShowLogin(true);
  }, [isMobile]);

  if (isCustomer() && !getCustomerToken()) logoutCustomer();

  if (getCustomerToken()) return <RentalAuthenticatedApp key={location.key} />;

  if (showLogin || isMobile) return <LoginPage rentEntrance />;

  return (
    <RentalGuestPreviewApp
      onRequireLogin={() => setShowLogin(true)}
      onPickVehicle={() => {
        /* handled in guest */
      }}
    />
  );
}

function RentalAuthenticatedApp() {
  const isMobile = useRentMobile();
  const [branding, setBranding] = useState(() => resolveRentAppBranding({}));
  const [calKey, setCalKey] = useState(0);
  const [walletKey, setWalletKey] = useState(0);
  const [homeFleet, setHomeFleet] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [featuredVehicle, setFeaturedVehicle] = useState(null);
  const [homeCategory, setHomeCategory] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const { favorites, toggleFavorite } = useRentFavorites();

  useEffect(() => setupRentalPwa(), []);

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

  const filteredHomeFleet = homeFleet
    .filter((v) => (homeCategory ? v.category === homeCategory : true))
    .filter((v) => {
      const q = homeQuery.trim().toLowerCase();
      if (!q) return true;
      return `${v.model || ''} ${v.category || ''} ${v.display_blurb || v.description || ''}`
        .toLowerCase()
        .includes(q);
    });

  useEffect(() => {
    let cancelled = false;
    setFleetLoading(true);
    fetchCustomerRentalCatalog()
      .then((rows) => {
        if (cancelled) return;
        const sliced = enrichRentFleet(withDemoRentFleet(Array.isArray(rows) ? rows : []).slice(0, 12));
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

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openWallet = () => {
    setWalletKey((k) => k + 1);
    requestAnimationFrame(() => scrollToSection('rent-wallet'));
  };

  const pickVehicle = (v) => {
    setFeaturedVehicle(v);
    try {
      localStorage.setItem(PREFERRED_VEHICLE_ID_KEY, String(v.id));
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => scrollToSection('rent-book'));
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
            My Wallet
          </button>
        </header>

        <main className="rent-main rent-main--inline">
          {!isMobile ? (
            <section id="rent-home" className="rent-inline-section" aria-label="Αρχική">
              <section className="rent-hero rent-hero--inline" aria-label="Ενοικίαση">
                <p className="rent-hero-brand">{branding.brandLabel}</p>
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
                      {HOME_CATEGORIES.map((c) => (
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
                    <div className="rent-fleet-rail">
                      {filteredHomeFleet.map((v) => (
                        <RentHomeFleetCard
                          key={v.id}
                          vehicle={v}
                          favorite={favorites.includes(v.id)}
                          onToggleFavorite={() => toggleFavorite(v.id)}
                          onSelect={() => pickVehicle(v)}
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

          <section id="rent-wallet" className="rent-inline-section">
            <div className="rent-panel rent-panel--wallet">
              <h2>My Wallet</h2>
              <p className="rent-panel-lead">
                Οι κάρτες ενοικίασής σας — χωριστά από το My Wallet των λεωφορείων.
              </p>
              <RentalWalletPanel
                brandLabel={branding.brandLabel}
                passengerName={profile.name}
                refreshKey={walletKey}
                onBookVehicle={() => scrollToSection('rent-book')}
              />
            </div>
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
    </div>
  );
}

export default function RentalCustomerApp() {
  return <RentalAuthGate />;
}
