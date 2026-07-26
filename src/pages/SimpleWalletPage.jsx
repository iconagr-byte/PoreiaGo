import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { getCustomerByEmail } from '../lib/customers/customerStore.js';
import {
  getCustomerEmail,
  getCustomerToken,
  getCustomerName,
  getCustomerPicture,
  getAuthProvider,
  isCustomer,
  isDriver,
  logoutCustomer,
} from '../lib/auth.js';
import {
  clearWalletFocusBooking,
  getWalletClaim,
  peekWalletFocusBooking,
  setWalletFocusBooking,
  walletClaimAuthPath,
  walletClaimNavState,
} from '../lib/wallet/walletClaim.js';
import { getBookingById, loadBookingsForCustomer } from '../lib/ticketing/bookingStore.js';
import { loadTrips } from '../lib/trips/tripStore.js';
import { isPaid, statusStyle } from '../lib/bookingDisplay.js';
import { bookingFiscalMark } from '../lib/fiscal/fiscalDisplay.js';
import PassengerTrackCTA from '../components/passenger/PassengerTrackCTA.jsx';
import CustomerSecurityPanel from '../components/wallet/CustomerSecurityPanel.jsx';
import PushNotificationsPanel from '../components/wallet/PushNotificationsPanel.jsx';
import LostFoundPanel from '../components/wallet/LostFoundPanel.jsx';
import WalletBoardingPass from '../components/wallet/WalletBoardingPass.jsx';
import WalletTicketDetail from '../components/wallet/WalletTicketDetail.jsx';
import OfficeBrandMark from '../components/storefront/OfficeBrandMark.jsx';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import '../styles/wallet-pass.css';

const TABS = [
  { id: 'home', label: 'Εισιτήριο', icon: 'confirmation_number' },
  { id: 'bookings', label: 'Κρατήσεις', icon: 'event_note' },
  { id: 'lost_found', label: 'Απωλεσθέντα', icon: 'support_agent' },
  { id: 'account', label: 'Λογαριασμός', icon: 'person' },
];

function resolveCustomerProfile() {
  const email = (getCustomerEmail() || '').toLowerCase();
  const stored = getCustomerByEmail(email);
  return {
    email,
    name: getCustomerName() || stored?.name || email.split('@')[0] || 'Πελάτης',
    picture: getCustomerPicture() || stored?.picture || '',
    provider: getAuthProvider() || stored?.authProvider || 'email',
    joinDate: stored?.joinDate ?? '—',
    id: stored?.id ?? null,
    phone: stored?.phone ?? '',
  };
}

function loadMyBookings(email) {
  if (!email) return Promise.resolve([]);
  return loadBookingsForCustomer(email);
}

function tripImageFor(booking) {
  const trips = loadTrips();
  const t =
    trips.find((x) => x.id === booking.tripId) ||
    trips.find((x) => x.title === booking.tripTitle);
  return t?.image || '/images/hero-bus-achillio.png';
}

function pickFeaturedBooking(bookings, highlightId) {
  if (!bookings.length) return null;
  if (highlightId) {
    const hit = bookings.find((b) => b.id === highlightId);
    if (hit) return hit;
  }
  const now = new Date();
  const upcoming = bookings
    .filter((b) => b.status !== 'Ακυρωμένη')
    .filter((b) => !b.date || new Date(`${b.date}T23:59:59`) >= now)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  if (upcoming.length) {
    return upcoming.find((b) => isPaid(b)) || upcoming[0];
  }
  return [...bookings].sort(
    (a, b) => new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0),
  )[0];
}

/**
 * My Wallet — step 1: boarding-pass home.
 */
export default function SimpleWalletPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('home');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [brandLabel, setBrandLabel] = useState('My Wallet');
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [showWelcome, setShowWelcome] = useState(
    () => Boolean(location.state?.fromClaim || location.state?.highlightBooking),
  );
  const [focusId, setFocusId] = useState(
    () => location.state?.highlightBooking || peekWalletFocusBooking() || null,
  );

  if (!isCustomer() || !getCustomerToken()) {
    if (isCustomer() && !getCustomerToken()) {
      logoutCustomer();
    }
    if (isDriver()) {
      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-on-surface-variant">
            Συνδεδεμένοι ως οδηγός — το Wallet είναι για πελάτες.
          </p>
          <Link
            to="/driver"
            className="px-6 py-3 rounded-full bg-emerald-600 text-white font-bold text-sm"
          >
            Driver Portal
          </Link>
        </div>
      );
    }
    const claim = getWalletClaim();
    if (claim) {
      return (
        <Navigate
          to={walletClaimAuthPath({ preferLogin: false })}
          replace
          state={walletClaimNavState(claim)}
        />
      );
    }
    return <Navigate to="/login" replace state={{ from: '/wallet', walletClaim: true }} />;
  }

  const profile = useMemo(() => resolveCustomerProfile(), []);
  const email = profile.email;

  useEffect(() => {
    const fromNav = location.state?.highlightBooking;
    if (fromNav) {
      setWalletFocusBooking(fromNav);
      setFocusId(fromNav);
      setShowWelcome(true);
      setSelectedBookingId(null);
      setActiveTab('home');
    }
  }, [location.state?.highlightBooking, location.state?.fromClaim]);

  useEffect(() => {
    let cancelled = false;
    setLoadingBookings(true);
    loadMyBookings(email)
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0),
        );
        // Include locally stored focus booking even if sync is slow.
        const focus = focusId || peekWalletFocusBooking();
        if (focus && !sorted.some((b) => b.id === focus)) {
          const local = getBookingById(focus);
          if (local && String(local.email || '').toLowerCase() === email) {
            sorted.unshift(local);
          }
        }
        setBookings(sorted);
      })
      .finally(() => {
        if (!cancelled) setLoadingBookings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email, focusId]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const brand = resolveOfficeBrand(data || {});
        const name = brand.displayName || brand.name;
        if (name) setBrandLabel(name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = useMemo(
    () => pickFeaturedBooking(bookings, focusId || peekWalletFocusBooking()),
    [bookings, focusId],
  );

  useEffect(() => {
    if (featured?.id && focusId && featured.id === focusId) {
      // Keep focus for refresh, but drop welcome after first successful paint window.
      const t = window.setTimeout(() => setShowWelcome(false), 8000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [featured?.id, focusId]);

  const selectedBooking =
    bookings.find((b) => b.id === selectedBookingId) ||
    (selectedBookingId ? getBookingById(selectedBookingId) : null);
  const isTicketView = activeTab === 'ticket' && selectedBooking;

  const openTicket = (booking) => {
    setSelectedBookingId(booking.id);
    setActiveTab('ticket');
  };

  const handleBookingUpdated = (updated) => {
    if (!updated?.id) return;
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
  };

  const otherUpcoming = bookings.filter(
    (b) =>
      b.id !== featured?.id &&
      b.status !== 'Ακυρωμένη' &&
      b.date &&
      new Date(`${b.date}T23:59:59`) >= new Date(),
  );

  return (
    <div className="wallet-app">
      <header className="wallet-topbar">
        <button type="button" className="wallet-topbar-btn" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined text-[20px]" aria-hidden>
            arrow_back
          </span>
          Αρχική
        </button>
        <div className="wallet-topbar-brand">
          <OfficeBrandMark className="h-8" variant="light" fallbackLabel="My Wallet" asLink={false} />
        </div>
        <button
          type="button"
          className="wallet-topbar-btn"
          onClick={() => {
            logoutCustomer();
            navigate('/login', { replace: true, state: { from: '/wallet' } });
          }}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden>
            logout
          </span>
          Έξοδος
        </button>
      </header>

      {!isTicketView ? (
        <nav className="wallet-nav" aria-label="My Wallet">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedBookingId(null);
              }}
            >
              <span className="material-symbols-outlined" aria-hidden>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>
      ) : null}

      <main className="wallet-main">
        {activeTab === 'home' && !isTicketView ? (
          <>
            {showWelcome && featured ? (
              <div className="wallet-welcome" role="status">
                <span className="material-symbols-outlined" aria-hidden>
                  check_circle
                </span>
                <div>
                  <p className="wallet-welcome-title">Το εισιτήριό σας είναι έτοιμο</p>
                  <p className="wallet-welcome-copy">Δείξτε το QR στον οδηγό κατά την επιβίβαση.</p>
                </div>
                <button
                  type="button"
                  className="wallet-welcome-dismiss"
                  onClick={() => {
                    setShowWelcome(false);
                    clearWalletFocusBooking();
                  }}
                  aria-label="Κλείσιμο"
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    close
                  </span>
                </button>
              </div>
            ) : null}

            {loadingBookings && !featured ? (
              <div className="wallet-pass-empty">
                <div className="wallet-pass-empty-inner">
                  <p className="wallet-pass-empty-copy">Φόρτωση εισιτηρίου…</p>
                </div>
              </div>
            ) : (
              <WalletBoardingPass
                booking={featured}
                coverImage={featured ? tripImageFor(featured) : ''}
                brandLabel={brandLabel}
                passengerName={profile.name}
                onOpenDetails={openTicket}
                onBrowseTrips={() => navigate('/')}
              />
            )}
            {otherUpcoming.length > 0 || bookings.length > 1 ? (
              <div className="wallet-home-more">
                {otherUpcoming.slice(0, 2).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="wallet-home-more-btn"
                    onClick={() => openTicket(b)}
                  >
                    <span className="truncate pr-2">{b.tripTitle}</span>
                    <span>
                      {b.date}
                      {b.seat ? ` · ${b.seat}` : ''}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="wallet-home-more-btn"
                  onClick={() => setActiveTab('bookings')}
                >
                  <span>Όλες οι κρατήσεις</span>
                  <span>{bookings.length}</span>
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {activeTab === 'bookings' && (
          <div className="wallet-stack">
            <div className="wallet-panel">
              <h2>Οι κρατήσεις μου</h2>
              <p className="wallet-panel-lead">
                {bookings.length
                  ? `${bookings.length} κρατήσεις στο λογαριασμό σας`
                  : 'Δεν υπάρχουν κρατήσεις ακόμα'}
              </p>

              {bookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <Link to="/" className="wallet-btn wallet-btn-primary">
                    Κράτηση εκδρομής
                  </Link>
                </div>
              ) : (
                <div className="wallet-list">
                  {bookings.map((b) => {
                    const st = statusStyle(b);
                    const paid = isPaid(b);
                    return (
                      <article key={b.id} className="wallet-booking-card">
                        <div
                          className="wallet-booking-cover"
                          style={{ backgroundImage: `url(${tripImageFor(b)})` }}
                        >
                          <div className="wallet-booking-cover-shade" />
                          <div className="wallet-booking-cover-copy">
                            <h3>{b.tripTitle}</h3>
                            <span
                              className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.className}`}
                            >
                              {b.status}
                            </span>
                          </div>
                        </div>
                        <div className="wallet-booking-body">
                          <p>
                            {b.date} · {b.time || '—'} · θέση <strong>{b.seat}</strong>
                          </p>
                          <p className="wallet-booking-mono">
                            {b.pnr || b.id}
                            {bookingFiscalMark(b) ? ` · MARK ${bookingFiscalMark(b)}` : ''}
                          </p>
                          {b.tripId && paid ? (
                            <div style={{ marginTop: '0.5rem' }}>
                              <PassengerTrackCTA booking={b} compact showEta={false} />
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openTicket(b)}
                            className="wallet-btn wallet-btn-primary wallet-btn-block"
                            style={{ marginTop: '0.75rem' }}
                          >
                            Προβολή εισιτηρίου
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'lost_found' && (
          <LostFoundPanel profile={profile} bookings={bookings} />
        )}

        {activeTab === 'account' && (
          <div className="wallet-stack">
            <section className="wallet-panel">
              <div className="wallet-panel-head">
                <span className="wallet-panel-head-icon" aria-hidden>
                  <span className="material-symbols-outlined">person</span>
                </span>
                <div>
                  <h2>Λογαριασμός</h2>
                  <p>Στοιχεία σύνδεσης και προφίλ επιβάτη.</p>
                </div>
              </div>
              <dl className="wallet-account-rows">
                {[
                  { icon: 'badge', label: 'Ονοματεπώνυμο', value: profile.name },
                  { icon: 'mail', label: 'Email', value: profile.email },
                  { icon: 'call', label: 'Τηλέφωνο', value: profile.phone || '—' },
                  {
                    icon: 'key',
                    label: 'Σύνδεση',
                    value: profile.provider === 'google' ? 'Google' : 'Email & κωδικός',
                  },
                ].map((row) => (
                  <div key={row.label} className="wallet-account-row">
                    <span className="material-symbols-outlined" aria-hidden>
                      {row.icon}
                    </span>
                    <div>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
            <PushNotificationsPanel email={profile.email} />
            <CustomerSecurityPanel email={profile.email} authProvider={profile.provider} />
          </div>
        )}

        {isTicketView && (
          <WalletTicketDetail
            booking={selectedBooking}
            coverImage={tripImageFor(selectedBooking)}
            brandLabel={brandLabel}
            passengerName={profile.name}
            onBookingUpdated={handleBookingUpdated}
            onBack={() => {
              setActiveTab('home');
              setSelectedBookingId(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
