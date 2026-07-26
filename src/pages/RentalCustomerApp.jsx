import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  getCustomerEmail,
  getCustomerName,
  getCustomerPicture,
  getCustomerToken,
  isAdmin,
  isCustomer,
  isDriver,
  logoutCustomer,
} from '../lib/auth.js';
import { setupRentalPwa } from '../lib/rental/registerRentalPwa.js';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import RentalCatalogPanel from '../components/wallet/RentalCatalogPanel.jsx';
import RentalInstallPrompt from '../components/rental/RentalInstallPrompt.jsx';
import RentalCustomerCalendar from '../components/rental/RentalCustomerCalendar.jsx';
import '../styles/wallet-pass.css';
import '../styles/rental-pwa.css';

const TABS = [
  { id: 'home', label: 'Αρχική', icon: 'home' },
  { id: 'book', label: 'Κράτηση', icon: 'directions_car' },
  { id: 'calendar', label: 'Ημερολόγιο', icon: 'calendar_month' },
  { id: 'mine', label: 'Κρατήσεις', icon: 'event_available' },
  { id: 'account', label: 'Εγώ', icon: 'person' },
];

function RentalAuthGate() {
  if (isCustomer() && !getCustomerToken()) {
    logoutCustomer();
  }

  if (isCustomer() && getCustomerToken()) {
    return <RentalAuthenticatedApp />;
  }

  if (isDriver()) {
    return (
      <div className="rent-gate">
        <h1>Ενοικίαση</h1>
        <p>Συνδεδεμένοι ως οδηγός — η εφαρμογή είναι για πελάτες.</p>
        <Link to="/driver" className="rent-btn rent-btn-primary">
          Driver Portal
        </Link>
      </div>
    );
  }

  if (isAdmin()) {
    return (
      <div className="rent-gate">
        <h1>Ενοικίαση</h1>
        <p>Συνδεδεμένοι ως γραφείο. Συνδεθείτε ως πελάτης για δοκιμή κράτησης.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center' }}>
          <Link
            to="/admin"
            className="rent-btn rent-btn-ghost"
            style={{ color: '#f5f5f7', borderColor: 'rgba(245,245,247,.35)' }}
          >
            Dashboard
          </Link>
          <Link to="/login" state={{ from: '/rent' }} className="rent-btn rent-btn-primary">
            Σύνδεση πελάτη
          </Link>
        </div>
      </div>
    );
  }

  return <Navigate to="/login" replace state={{ from: '/rent' }} />;
}

function RentalAuthenticatedApp() {
  const [tab, setTab] = useState('home');
  const [mineView, setMineView] = useState('list');
  const [brandName, setBrandName] = useState('Ενοικίαση');
  const [calKey, setCalKey] = useState(0);

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

  const profile = useMemo(() => {
    const email = (getCustomerEmail() || '').toLowerCase();
    return {
      email,
      name: getCustomerName() || email.split('@')[0] || 'Πελάτης',
      picture: getCustomerPicture() || '',
    };
  }, []);

  return (
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

      <main className={tab === 'home' ? '' : 'rent-main'}>
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
            <div className="rent-main rent-home-stack">
              <RentalInstallPrompt force />
              <div className="rent-quick">
                <button type="button" onClick={() => setTab('calendar')}>
                  <span className="material-symbols-outlined" aria-hidden>
                    calendar_month
                  </span>
                  <span className="rent-quick-label">Ημερολόγιο</span>
                  <span className="rent-quick-meta">Μέρες & χάρτης</span>
                </button>
                <button type="button" onClick={() => setTab('mine')}>
                  <span className="material-symbols-outlined" aria-hidden>
                    event_available
                  </span>
                  <span className="rent-quick-label">Οι κρατήσεις μου</span>
                  <span className="rent-quick-meta">Ιστορικό & ακύρωση</span>
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
              onBooked={() => {
                setCalKey((k) => k + 1);
                setTab('calendar');
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

        {tab === 'mine' ? (
          <div className="rent-panel">
            <h2>Κρατήσεις</h2>
            <p className="rent-panel-lead">Ενεργές και προηγούμενες ενοικιάσεις σας.</p>
            <div className="rent-segment" role="tablist" aria-label="Προβολή κρατήσεων">
              <button
                type="button"
                role="tab"
                aria-selected={mineView === 'list'}
                className={mineView === 'list' ? 'is-active' : ''}
                onClick={() => setMineView('list')}
              >
                Λίστα
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mineView === 'calendar'}
                className={mineView === 'calendar' ? 'is-active' : ''}
                onClick={() => setMineView('calendar')}
              >
                Ημερολόγιο
              </button>
            </div>
            {mineView === 'list' ? (
              <RentalCatalogPanel mode="mine" />
            ) : (
              <RentalCustomerCalendar refreshKey={calKey} />
            )}
          </div>
        ) : null}

        {tab === 'account' ? (
          <div className="rent-panel">
            <h2>Λογαριασμός</h2>
            <p className="rent-panel-lead">Στοιχεία σύνδεσης και εγκατάσταση εφαρμογής.</p>
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
              <Link to="/wallet" className="rent-btn rent-btn-ghost rent-btn-block">
                My Wallet (εισιτήρια)
              </Link>
              <button
                type="button"
                className="rent-btn rent-btn-danger rent-btn-block"
                onClick={() => {
                  logoutCustomer();
                  window.location.assign('/login');
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
  );
}

export default function RentalCustomerApp() {
  return <RentalAuthGate />;
}
