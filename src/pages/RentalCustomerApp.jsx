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
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import { fetchCustomerRentalCatalog, fetchPublicRentalCatalog } from '../services/customerRentalApi.js';
import { withDemoRentFleet } from '../lib/rental/demoRentFleet.js';
import RentalCatalogPanel from '../components/wallet/RentalCatalogPanel.jsx';
import RentalInstallPrompt from '../components/rental/RentalInstallPrompt.jsx';
import RentalCustomerCalendar from '../components/rental/RentalCustomerCalendar.jsx';
import RentalWalletPanel from '../components/rental/RentalWalletPanel.jsx';
import LoginPage from './LoginPage.jsx';
import '../styles/wallet-pass.css';
import '../styles/rental-pwa.css';

const TABS = [
  { id: 'home', label: 'Αρχική', icon: 'home' },
  { id: 'book', label: 'Κράτηση', icon: 'directions_car' },
  { id: 'calendar', label: 'Ημερολόγιο', icon: 'calendar_month' },
  { id: 'wallet', label: 'Wallet', icon: 'account_balance_wallet' },
  { id: 'account', label: 'Εγώ', icon: 'person' },
];

/** Mobile Rent app = Wallet-first (no fleet home gallery). */
const MOBILE_TABS = TABS.filter((t) => t.id !== 'home');

const HOME_CATEGORIES = ['', 'CAR', 'VAN', 'MINIBUS'];

const PREFERRED_VEHICLE_ID_KEY = 'rent_preferred_vehicle_id_v1';

function RentalGuestPreviewApp({ onRequireLogin, onPickVehicle } = {}) {
  const isMobile = useRentMobile();
  const [brandName, setBrandName] = useState('Ενοικίαση');
  const [homeFleet, setHomeFleet] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [homeCategory, setHomeCategory] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rent_favorites_v1') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let cancelled = false;
    setFleetLoading(true);
    fetchPublicRentalCatalog()
      .then((rows) => {
        if (cancelled) return;
        setHomeFleet(withDemoRentFleet(Array.isArray(rows) ? rows : []).slice(0, 12));
      })
      .catch(() => {
        if (cancelled) return;
        setHomeFleet(withDemoRentFleet([]));
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
        const office = brand.displayName || 'Γραφείο';
        setBrandName(`${office} Rent`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('rent_favorites_v1', JSON.stringify(favorites));
    } catch {
      /* ignore */
    }
  }, [favorites]);

  const filteredHomeFleet = homeFleet
    .filter((v) => (homeCategory ? v.category === homeCategory : true))
    .filter((v) => {
      const q = homeQuery.trim().toLowerCase();
      if (!q) return true;
      return `${v.model || ''} ${v.category || ''}`.toLowerCase().includes(q);
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
            {brandName}
          </button>
          <button type="button" className="rent-btn rent-btn-ghost" onClick={onRequireLogin}>
            Κράτηση
          </button>
        </header>

        <main className="rent-home">
          <section className="rent-hero" aria-label="Ενοικίαση">
            <p className="rent-hero-brand">{brandName}</p>
            <h1 className="rent-hero-title">Δες τον στόλο πριν κλείσεις</h1>
            <p className="rent-hero-copy">
              Περιήγηση οχημάτων χωρίς σύνδεση — για κράτηση χρειάζεται είσοδος.
            </p>
            <button type="button" className="rent-hero-cta" onClick={onRequireLogin}>
              <span className="material-symbols-outlined" aria-hidden>
                lock
              </span>
              Σύνδεση για κράτηση
            </button>
          </section>

          <div className="rent-home-stack">
            <div className="rent-panel" style={{ padding: '0.9rem 1.0rem' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--rent-ink)' }}>
                Στόλος ενοικίασης
              </h2>
              <p className="rent-panel-lead" style={{ marginBottom: '0.75rem' }}>
                Διάλεξε όχημα για προεπιλογή — μετά θα σε πάει στο login.
              </p>

              <div className="rent-home-fleet-tools">
                <input
                  type="search"
                  value={homeQuery}
                  onChange={(e) => setHomeQuery(e.target.value)}
                  placeholder="Αναζήτηση μοντέλου…"
                />
                <div className="rent-home-fleet-cats">
                  {HOME_CATEGORIES.map((c) => (
                    <button
                      key={c || 'all'}
                      type="button"
                      className={homeCategory === c ? 'is-active' : ''}
                      onClick={() => setHomeCategory(c)}
                    >
                      {c || 'Όλα'}
                    </button>
                  ))}
                </div>
              </div>

              {fleetLoading ? (
                <p className="rent-home-fleet-empty">Φόρτωση στόλου…</p>
              ) : filteredHomeFleet.length ? (
                <div className="rent-home-fleet-strip">
                  {filteredHomeFleet.map((v) => {
                    const cover = v.photo_urls?.[0] || v.photo_url || '';
                    const isFav = favorites.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className="rent-home-fleet-card"
                        onClick={() => {
                          try {
                            localStorage.setItem(PREFERRED_VEHICLE_ID_KEY, String(v.id));
                          } catch {
                            /* ignore */
                          }
                          onPickVehicle?.(v);
                          onRequireLogin?.();
                        }}
                      >
                        <span
                          className="rent-home-fleet-fav"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFavorites((prev) => (isFav ? prev.filter((id) => id !== v.id) : [...prev, v.id]));
                          }}
                        >
                          <span className="material-symbols-outlined" aria-hidden>
                            {isFav ? 'favorite' : 'favorite_border'}
                          </span>
                        </span>
                        <div className="rent-home-fleet-media">
                          {cover ? <img src={cover} alt={v.model || 'Όχημα'} loading="lazy" /> : <span className="material-symbols-outlined">directions_car</span>}
                        </div>
                        <div className="rent-home-fleet-body">
                          <strong>{v.model || 'Όχημα'}</strong>
                          <span>
                            {v.seating_capacity || '—'} θέσεις · από €{Number(v.daily_rate_eur || 0).toFixed(0)}/ημέρα
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rent-home-fleet-empty">Δεν βρέθηκαν οχήματα για τα φίλτρα.</p>
              )}
            </div>
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
  const navTabs = isMobile ? MOBILE_TABS : TABS;
  // Land in Rent Wallet after login/register — separate from bus My Wallet.
  // Mobile app is Wallet-only home; desktop may open book if a fleet pick is pending.
  const [tab, setTab] = useState(() => {
    if (isRentMobileViewport()) return 'wallet';
    try {
      return localStorage.getItem(PREFERRED_VEHICLE_ID_KEY) ? 'book' : 'wallet';
    } catch {
      return 'wallet';
    }
  });
  const [brandName, setBrandName] = useState('Ενοικίαση');
  const [calKey, setCalKey] = useState(0);
  const [walletKey, setWalletKey] = useState(0);
  const [homeFleet, setHomeFleet] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [featuredVehicle, setFeaturedVehicle] = useState(null);
  const [homeCategory, setHomeCategory] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rent_favorites_v1') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => setupRentalPwa(), []);

  useEffect(() => {
    // Mobile: never stay on fleet "home" — app surface is Wallet.
    if (isMobile && tab === 'home') setTab('wallet');
  }, [isMobile, tab]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const brand = resolveOfficeBrand(data || {});
        const office = brand.displayName || 'Γραφείο';
        setBrandName(`${office} Rent`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('rent_favorites_v1', JSON.stringify(favorites));
    } catch {
      /* ignore */
    }
  }, [favorites]);

  const filteredHomeFleet = homeFleet
    .filter((v) => (homeCategory ? v.category === homeCategory : true))
    .filter((v) => {
      const q = homeQuery.trim().toLowerCase();
      if (!q) return true;
      return `${v.model || ''} ${v.category || ''}`.toLowerCase().includes(q);
    });

  useEffect(() => {
    let cancelled = false;
    setFleetLoading(true);
    fetchCustomerRentalCatalog()
      .then((rows) => {
        if (cancelled) return;
        const sliced = withDemoRentFleet(Array.isArray(rows) ? rows : []).slice(0, 12);
        setHomeFleet(sliced);
        // Desktop: if user came from guest fleet pick, open booking.
        // Mobile app stays on Wallet (fleet lives on the office homepage).
        if (isRentMobileViewport()) return;
        try {
          const preferredId = localStorage.getItem(PREFERRED_VEHICLE_ID_KEY);
          if (preferredId) {
            const found = sliced.find((v) => String(v.id) === String(preferredId));
            if (found) {
              setFeaturedVehicle(found);
              setTab('book');
            }
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (cancelled) return;
        setHomeFleet(withDemoRentFleet([]));
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

  return (
    <div className={`rent-phone-stage${isMobile ? ' rent-phone-stage--mobile-wallet' : ' rent-phone-stage--desktop'}`}>
      <div className="rent-app">
        {tab !== 'home' ? (
          <header className="rent-topbar">
            <button
              type="button"
              className="rent-topbar-brand"
              onClick={() => setTab(isMobile ? 'wallet' : 'home')}
            >
              {brandName}
            </button>
            <button type="button" className="rent-btn rent-btn-ghost" onClick={() => setTab('book')}>
              Νέα κράτηση
            </button>
          </header>
        ) : null}

        <main className={tab === 'home' ? 'rent-home' : 'rent-main'}>
          {tab === 'home' && !isMobile ? (
            <>
              <section className="rent-hero" aria-label="Ενοικίαση">
                <p className="rent-hero-brand">{brandName}</p>
                <h1 className="rent-hero-title">Το όχημά σας, σε λίγα βήματα</h1>
                <p className="rent-hero-copy">
                  Κράτηση, ημερολόγιο και χάρτης παραλαβής — εγκαταστήστε την εφαρμογή στο κινητό.
                </p>
                <button type="button" className="rent-hero-cta" onClick={() => setTab('book')}>
                  <span className="material-symbols-outlined" aria-hidden>
                    search
                  </span>
                  Βρες όχημα
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
                      onClick={() => setTab('book')}
                    >
                      Δες όλα
                    </button>
                  </div>
                  <div className="rent-home-fleet-tools">
                    <input
                      type="search"
                      value={homeQuery}
                      onChange={(e) => setHomeQuery(e.target.value)}
                      placeholder="Αναζήτηση μοντέλου…"
                    />
                    <div className="rent-home-fleet-cats">
                      {HOME_CATEGORIES.map((c) => (
                        <button
                          key={c || 'all'}
                          type="button"
                          className={homeCategory === c ? 'is-active' : ''}
                          onClick={() => setHomeCategory(c)}
                        >
                          {c || 'Όλα'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {fleetLoading ? (
                    <p className="rent-home-fleet-empty">Φόρτωση στόλου…</p>
                  ) : filteredHomeFleet.length ? (
                    <div className="rent-home-fleet-strip">
                      {filteredHomeFleet.map((v) => {
                        const cover = v.photo_urls?.[0] || v.photo_url || '';
                        const isFav = favorites.includes(v.id);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            className="rent-home-fleet-card"
                            onClick={() => {
                              setFeaturedVehicle(v);
                              setTab('book');
                            }}
                          >
                            <span
                              className="rent-home-fleet-fav"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setFavorites((prev) =>
                                  prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id],
                                );
                              }}
                            >
                              <span className="material-symbols-outlined" aria-hidden>
                                {isFav ? 'favorite' : 'favorite_border'}
                              </span>
                            </span>
                            <div className="rent-home-fleet-media">
                              {cover ? (
                                <img src={cover} alt={v.model || 'Όχημα'} loading="lazy" />
                              ) : (
                                <span className="material-symbols-outlined">directions_car</span>
                              )}
                            </div>
                            <div className="rent-home-fleet-body">
                              <strong>{v.model || 'Όχημα'}</strong>
                              <span>
                                {v.seating_capacity || '—'} θέσεις · από €{Number(v.daily_rate_eur || 0).toFixed(0)}
                                /ημέρα
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rent-home-fleet-empty">
                      Δεν βρέθηκαν οχήματα για τα φίλτρα που έβαλες.
                    </p>
                  )}
                </section>
                <div className="rent-quick">
                  <button type="button" onClick={() => setTab('calendar')}>
                    <span className="material-symbols-outlined" aria-hidden>
                      calendar_month
                    </span>
                    <span className="rent-quick-label">Ημερολόγιο</span>
                    <span className="rent-quick-meta">Μέρες & χάρτης</span>
                  </button>
                  <button type="button" onClick={() => setTab('wallet')}>
                    <span className="material-symbols-outlined" aria-hidden>
                      account_balance_wallet
                    </span>
                    <span className="rent-quick-label">Rent Wallet</span>
                    <span className="rent-quick-meta">Κάρτες ενοικίασης</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {tab === 'book' ? (
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
                  setTab('wallet');
                }}
              />
            </div>
          ) : null}

          {tab === 'calendar' ? (
            <div className="rent-panel">
              <h2>Ημερολόγιο</h2>
              <p className="rent-panel-lead">
                Οι κρατήσεις σας ανά μέρα — επιλέξτε ημερομηνία και δείτε την παραλαβή στον χάρτη.
              </p>
              <RentalCustomerCalendar refreshKey={calKey} />
            </div>
          ) : null}

          {tab === 'wallet' ? (
            <div className="rent-panel rent-panel--wallet">
              <h2>Rent Wallet</h2>
              <p className="rent-panel-lead">
                Οι κάρτες ενοικίασής σας — χωριστά από το My Wallet των λεωφορείων.
              </p>
              <RentalWalletPanel
                brandLabel={`${brandName}`}
                passengerName={profile.name}
                refreshKey={walletKey}
                onBookVehicle={() => setTab('book')}
              />
            </div>
          ) : null}

          {tab === 'account' ? (
            <div className="rent-panel">
              <h2>Λογαριασμός</h2>
              <p className="rent-panel-lead">
                Στοιχεία σύνδεσης για την εφαρμογή ενοικίασης. Τα εισιτήρια λεωφορείου είναι στο My
                Wallet.
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
                  className="rent-btn rent-btn-ghost rent-btn-block"
                  onClick={() => setTab('wallet')}
                >
                  Άνοιγμα Rent Wallet
                </button>
                <button
                  type="button"
                  className="rent-btn rent-btn-danger rent-btn-block"
                  onClick={() => {
                    logoutCustomer();
                    // Office public homepage — not the admin dashboard.
                    window.location.assign('/');
                  }}
                >
                  Αποσύνδεση
                </button>
              </div>
            </div>
          ) : null}
        </main>

        <nav className="rent-nav" aria-label="Ενοικίαση">
          {navTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'is-active' : ''}
              onClick={() => setTab(t.id)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function RentalCustomerApp() {
  return <RentalAuthGate />;
}
