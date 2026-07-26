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

const ADMIN_PREVIEW_KEY = 'rent_admin_preview_v1';

function readAdminPreview() {
  try {
    return sessionStorage.getItem(ADMIN_PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

function RentalGateCard({ title, body, children }) {
  return (
    <div className="rent-gate">
      <div className="rent-gate-card">
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="rent-gate-actions">{children}</div>
      </div>
    </div>
  );
}

function RentalAuthGate() {
  const [adminPreview, setAdminPreview] = useState(readAdminPreview);

  if (isCustomer() && !getCustomerToken()) {
    logoutCustomer();
  }

  if (isCustomer() && getCustomerToken()) {
    return <RentalAuthenticatedApp />;
  }

  if (isDriver()) {
    return (
      <RentalGateCard
        title="Ενοικίαση"
        body="Συνδεδεμένοι ως οδηγός — η εφαρμογή είναι για πελάτες."
      >
        <Link to="/driver" className="rent-gate-btn-primary">
          Driver Portal
        </Link>
        <Link to="/login" state={{ from: '/rent' }} className="rent-gate-btn-ghost">
          Σύνδεση πελάτη
        </Link>
      </RentalGateCard>
    );
  }

  if (isAdmin() && adminPreview) {
    return (
      <RentalAuthenticatedApp
        adminPreview
        onExitAdminPreview={() => {
          try {
            sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
          } catch {
            /* ignore */
          }
          setAdminPreview(false);
        }}
      />
    );
  }

  if (isAdmin()) {
    return (
      <RentalGateCard
        title="Ενοικίαση"
        body="Είστε συνδεδεμένοι ως γραφείο. Δείτε την εφαρμογή πελατών ή συνδεθείτε ως πελάτης για πραγματική κράτηση."
      >
        <button
          type="button"
          className="rent-gate-btn-primary"
          onClick={() => {
            try {
              sessionStorage.setItem(ADMIN_PREVIEW_KEY, '1');
            } catch {
              /* ignore */
            }
            setAdminPreview(true);
          }}
        >
          Προβολή εφαρμογής
        </button>
        <Link to="/login" state={{ from: '/rent' }} className="rent-gate-btn-secondary">
          Σύνδεση πελάτη
        </Link>
        <Link to="/admin" className="rent-gate-btn-ghost">
          Πίσω στο γραφείο
        </Link>
      </RentalGateCard>
    );
  }

  return <Navigate to="/login" replace state={{ from: '/rent' }} />;
}

function RentalAuthenticatedApp({ adminPreview = false, onExitAdminPreview } = {}) {
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
      {adminPreview ? (
        <div className="rent-preview-banner" role="status">
          <span>Προβολή γραφείου — για πραγματική κράτηση χρειάζεται σύνδεση πελάτη.</span>
          <button
            type="button"
            className="rent-btn rent-btn-ghost"
            style={{ minHeight: '2rem', padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}
            onClick={onExitAdminPreview}
          >
            Κλείσιμο
          </button>
        </div>
      ) : null}
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
