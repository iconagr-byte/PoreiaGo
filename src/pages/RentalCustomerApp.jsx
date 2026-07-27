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
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import { fetchCustomerRentalCatalog } from '../services/customerRentalApi.js';
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

function RentalAuthGate() {
  // Re-check auth after in-place login (same URL /rent).
  const location = useLocation();
  useEffect(() => setupRentalPwa(), []);

  if (isCustomer() && !getCustomerToken()) {
    logoutCustomer();
  }

  if (isCustomer() && getCustomerToken()) {
    return <RentalAuthenticatedApp key={location.key} />;
  }

  // Share link /rent → customer login in-place (URL stays /rent, never Traefik deep-link 404).
  return <LoginPage rentEntrance />;
}

function RentalAuthenticatedApp() {
  // Land in Rent Wallet after login/register — separate from bus My Wallet.
  const [tab, setTab] = useState('wallet');
  const [brandName, setBrandName] = useState('Ενοικίαση');
  const [calKey, setCalKey] = useState(0);
  const [walletKey, setWalletKey] = useState(0);
  const [homeFleet, setHomeFleet] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [featuredVehicle, setFeaturedVehicle] = useState(null);

  useEffect(() => setupRentalPwa(), []);

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
    let cancelled = false;
    setFleetLoading(true);
    fetchCustomerRentalCatalog()
      .then((rows) => {
        if (cancelled) return;
        setHomeFleet(Array.isArray(rows) ? rows.slice(0, 12) : []);
      })
      .catch(() => {
        if (cancelled) return;
        setHomeFleet([]);
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
    <div className="rent-phone-stage">
      <div className="rent-app">
        {tab !== 'home' ? (
          <header className="rent-topbar">
            <button type="button" className="rent-topbar-brand" onClick={() => setTab('home')}>
              {brandName}
            </button>
            <button type="button" className="rent-btn rent-btn-ghost" onClick={() => setTab('book')}>
              Νέα κράτηση
            </button>
          </header>
        ) : null}

        <main className={tab === 'home' ? 'rent-home' : 'rent-main'}>
          {tab === 'home' ? (
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
                  {fleetLoading ? (
                    <p className="rent-home-fleet-empty">Φόρτωση στόλου…</p>
                  ) : homeFleet.length ? (
                    <div className="rent-home-fleet-strip">
                      {homeFleet.map((v) => {
                        const cover = v.photo_urls?.[0] || v.photo_url || '';
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
                      Δεν υπάρχουν διαθέσιμα οχήματα αυτή τη στιγμή.
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
                onClearPreferred={() => setFeaturedVehicle(null)}
                onBooked={() => {
                  setCalKey((k) => k + 1);
                  setWalletKey((k) => k + 1);
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
          {TABS.map((t) => (
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
