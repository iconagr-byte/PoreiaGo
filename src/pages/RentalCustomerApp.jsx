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
import '../styles/rental-pwa.css';

const TABS = [
  { id: 'home', label: 'Αρχική', icon: 'home' },
  { id: 'book', label: 'Κράτηση', icon: 'directions_car' },
  { id: 'mine', label: 'Οι δικές μου', icon: 'event_available' },
  { id: 'account', label: 'Λογαριασμός', icon: 'person' },
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
          <Link to="/admin" className="rent-btn rent-btn-ghost" style={{ color: '#f7fbfa', borderColor: 'rgba(247,251,250,.35)' }}>
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
  const [brandName, setBrandName] = useState('Ενοικίαση');

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
                Cars, vans και μινιμπάς — διαθεσιμότητα σε πραγματικό χρόνο από το κινητό.
              </p>
              <button type="button" className="rent-hero-cta" onClick={() => setTab('book')}>
                <span className="material-symbols-outlined" aria-hidden>
                  search
                </span>
                Βρες όχημα
              </button>
            </section>
            <div className="rent-main" style={{ paddingTop: '1rem' }}>
              <RentalInstallPrompt />
            </div>
          </>
        ) : null}

        {tab === 'book' ? (
          <div className="rent-panel">
            <h2>Κράτηση</h2>
            <p className="rent-panel-lead">Επιλέξτε ημερομηνίες και όχημα — η κράτηση περνάει αμέσως στο γραφείο.</p>
            <RentalCatalogPanel mode="book" />
          </div>
        ) : null}

        {tab === 'mine' ? (
          <div className="rent-panel">
            <h2>Οι ενοικιάσεις μου</h2>
            <p className="rent-panel-lead">Ενεργές και προηγούμενες κρατήσεις σας.</p>
            <RentalCatalogPanel mode="mine" />
          </div>
        ) : null}

        {tab === 'account' ? (
          <div className="rent-panel">
            <h2>Λογαριασμός</h2>
            <p className="rent-panel-lead">Στοιχεία σύνδεσης για την εφαρμογή ενοικίασης.</p>
            <dl style={{ margin: 0, display: 'grid', gap: '0.75rem' }}>
              <div>
                <dt style={{ fontSize: '0.75rem', color: '#5a7270', fontWeight: 700 }}>Όνομα</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 700 }}>{profile.name}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.75rem', color: '#5a7270', fontWeight: 700 }}>Email</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 700 }}>{profile.email}</dd>
              </div>
            </dl>
            <RentalInstallPrompt />
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
