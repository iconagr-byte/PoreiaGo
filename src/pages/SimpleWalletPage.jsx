import { useCallback, useEffect, useMemo, useState } from 'react';
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
  isAdmin,
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
import { loadLastPass, patchLastPassQr, saveLastPass } from '../lib/wallet/lastPassSnapshot.js';
import { setupWalletPwa } from '../lib/wallet/registerWalletPwa.js';
import { getBookingById, loadBookingsForCustomer } from '../lib/ticketing/bookingStore.js';
import { loadTrips } from '../lib/trips/tripStore.js';
import { tripCoverUrl } from '../lib/trips/tripPhotos.js';
import { isPaid, statusStyle } from '../lib/bookingDisplay.js';
import { bookingFiscalMark } from '../lib/fiscal/fiscalDisplay.js';
import PassengerTrackCTA from '../components/passenger/PassengerTrackCTA.jsx';
import CustomerSecurityPanel from '../components/wallet/CustomerSecurityPanel.jsx';
import PushNotificationsPanel from '../components/wallet/PushNotificationsPanel.jsx';
import LostFoundPanel from '../components/wallet/LostFoundPanel.jsx';
import RentalCatalogPanel from '../components/wallet/RentalCatalogPanel.jsx';
import WalletBoardingPass from '../components/wallet/WalletBoardingPass.jsx';
import WalletInstallPrompt from '../components/wallet/WalletInstallPrompt.jsx';
import WalletOfficeExcursionsPanel from '../components/wallet/WalletOfficeExcursionsPanel.jsx';
import WalletStartFeed from '../components/wallet/WalletStartFeed.jsx';
import WalletTicketDetail from '../components/wallet/WalletTicketDetail.jsx';
import OfficeBrandMark from '../components/storefront/OfficeBrandMark.jsx';
import { DEFAULT_SITE_APPEARANCE, fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import { fetchCustomerMe } from '../services/customerAuthApi.js';
import {
  DEFAULT_OFFICE_MODULES,
  fetchOfficeModules,
  shouldShowRentStorefront,
} from '../services/officeModulesApi.js';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import { useRentMobile, useRentPhone } from '../lib/rental/rentDevice.js';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';
import {
  getWalletTenantId,
  setWalletTenantId,
  WALLET_TENANT_CHANGED_EVENT,
} from '../lib/wallet/walletTenantSeal.js';
import { WALLET_TABS_BUILD_MARKER } from '../lib/wallet/walletBrandSplash.js';
import '../styles/wallet-pass.css';

const ALL_TABS = [
  { id: 'start', label: 'Αρχική', icon: 'home' },
  { id: 'home', label: 'Εισιτήριο', icon: 'confirmation_number' },
  { id: 'bookings', label: 'Κρατήσεις', icon: 'event_note' },
  { id: 'rentals', label: 'Rent', icon: 'directions_car', requiresRent: true },
  { id: 'lookup', label: 'Κράτηση', icon: 'search', nativeOnly: true },
  { id: 'account', label: 'Εγώ', icon: 'person' },
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
  return tripCoverUrl(t);
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

function WalletAuthGate() {
  if (isCustomer() && !getCustomerToken()) {
    logoutCustomer();
  }

  if (isCustomer() && getCustomerToken()) {
    return <WalletAuthenticatedApp />;
  }

  // Native Wallet app: stay in My Wallet (no driver/admin platform).
  if (!isNativeApp() && isDriver()) {
    return <Navigate to="/driver" replace />;
  }

  if (isAdmin() || (isNativeApp() && isDriver())) {
    return <Navigate to="/login" replace state={{ from: '/wallet', walletClaim: true }} />;
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

/**
 * My Wallet — boarding-pass home (authenticated shell).
 * Split from auth gate so hooks always run in a stable component tree.
 */
function WalletAuthenticatedApp() {
  const navigate = useNavigate();
  const location = useLocation();
  /** Phone / tablet compact chrome vs desktop Apple shell. */
  const isMobile = useRentMobile();
  /** Narrow phones only — full-bleed PWA chrome. */
  const isPhone = useRentPhone();
  const nativeWalletEarly = isNativeApp();
  // Native Capacitor: always phone chrome — never hide bottom cards on wide emulator.
  const isDesktop = nativeWalletEarly ? false : !isMobile;
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const q = new URLSearchParams(location.search || '');
      const tab = String(q.get('tab') || '').trim();
      if (['start', 'home', 'bookings', 'rentals', 'lost_found', 'account'].includes(tab)) {
        return tab;
      }
    } catch {
      /* ignore */
    }
    return 'start';
  });
  // lost_found is opened from Εγώ — keep it as an in-page panel, not a dock tab.
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [brandLabel, setBrandLabel] = useState('My Wallet');
  const [siteAppearance, setSiteAppearance] = useState(DEFAULT_SITE_APPEARANCE);
  const [officeModules, setOfficeModules] = useState(DEFAULT_OFFICE_MODULES);
  /** Sealed office UUID — drives logo/name fetch on native (Host=localhost). */
  const [sealedTenantId, setSealedTenantId] = useState(() => getWalletTenantId() || '');
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [showWelcome, setShowWelcome] = useState(
    () => Boolean(location.state?.fromClaim || location.state?.highlightBooking),
  );
  const [focusId, setFocusId] = useState(
    () => location.state?.highlightBooking || peekWalletFocusBooking() || null,
  );
  const [networkOffline, setNetworkOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  const [offlineSnap, setOfflineSnap] = useState(() => loadLastPass());

  const profile = useMemo(() => resolveCustomerProfile(), []);
  const email = profile.email;

  useEffect(() => {
    document.documentElement.dataset.walletSurface = isPhone
      ? 'phone'
      : isDesktop
        ? 'desktop'
        : 'tablet';
    return () => {
      delete document.documentElement.dataset.walletSurface;
    };
  }, [isPhone, isDesktop]);

  useEffect(() => setupWalletPwa(), []);

  useEffect(() => {
    const onOnline = () => setNetworkOffline(false);
    const onOffline = () => {
      setNetworkOffline(true);
      setOfflineSnap(loadLastPass());
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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
        const focus = focusId || peekWalletFocusBooking();
        if (focus && !sorted.some((b) => b.id === focus)) {
          const local = getBookingById(focus);
          if (local && String(local.email || '').toLowerCase() === email) {
            sorted.unshift(local);
          }
        }
        setBookings(sorted);
        if (!sorted.length) {
          setOfflineSnap(loadLastPass());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookings([]);
          setOfflineSnap(loadLastPass());
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBookings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email, focusId]);

  useEffect(() => {
    const syncSeal = () => setSealedTenantId(getWalletTenantId() || '');
    syncSeal();
    window.addEventListener(WALLET_TENANT_CHANGED_EVENT, syncSeal);
    return () => window.removeEventListener(WALLET_TENANT_CHANGED_EVENT, syncSeal);
  }, []);

  // Re-seal office from /auth/me when localStorage seal is missing (old sessions).
  useEffect(() => {
    if (sealedTenantId || !getCustomerToken()) return undefined;
    let cancelled = false;
    fetchCustomerMe()
      .then((me) => {
        if (cancelled) return;
        const tid = String(me?.tenant_id || me?.tenantId || '').trim();
        if (tid) {
          setWalletTenantId(tid);
          setSealedTenantId(tid);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sealedTenantId]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance(sealedTenantId ? { tenantId: sealedTenantId } : undefined)
      .then((data) => {
        if (cancelled) return;
        setSiteAppearance(data || DEFAULT_SITE_APPEARANCE);
        const brand = resolveOfficeBrand(data || {});
        const name = brand.displayName || brand.name;
        // Prefer real office name — never keep generic Γραφείο / My Wallet when API sent one.
        if (name && name !== 'Γραφείο') setBrandLabel(name);
        else if (data?.footer_brand_name) setBrandLabel(String(data.footer_brand_name));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sealedTenantId]);

  useEffect(() => {
    let cancelled = false;
    fetchOfficeModules(sealedTenantId ? { tenantId: sealedTenantId } : undefined)
      .then((mods) => {
        if (!cancelled) setOfficeModules(mods);
      })
      .catch(() => {
        if (!cancelled) setOfficeModules(DEFAULT_OFFICE_MODULES);
      });
    return () => {
      cancelled = true;
    };
  }, [sealedTenantId]);

  const nativeWallet = isNativeApp();
  // One Wallet for buses + rentals — show Rent only when the sealed office paid for it.
  // Native dock (WalletNativeShell) owns Κράτηση lookup — web keeps in-app tabs only.
  // Capacitor localhost is a marketing host; pass nativeWallet so we never force Rent demo.
  const rentAvailable = shouldShowRentStorefront(officeModules, {
    nativeWallet,
    sealedTenant: Boolean(sealedTenantId),
  });
  const tabs = useMemo(
    () =>
      ALL_TABS.filter((tab) => {
        if (tab.requiresRent && !rentAvailable) return false;
        if (tab.nativeOnly) return false; // native shell shows Κράτηση
        return true;
      }),
    [rentAvailable],
  );

  // Native shell navigates with ?tab= — keep in-app content in sync.
  useEffect(() => {
    if (!nativeWallet) return;
    try {
      const q = new URLSearchParams(location.search || '');
      const tab = String(q.get('tab') || 'start').trim();
      if (['start', 'home', 'bookings', 'rentals', 'lost_found', 'account'].includes(tab)) {
        setActiveTab(tab);
        if (tab !== 'ticket') setSelectedBookingId(null);
      }
    } catch {
      /* ignore */
    }
  }, [nativeWallet, location.search]);

  useEffect(() => {
    if (!rentAvailable && activeTab === 'rentals') {
      setActiveTab('home');
    }
  }, [rentAvailable, activeTab]);

  const featured = useMemo(
    () => pickFeaturedBooking(bookings, focusId || peekWalletFocusBooking()),
    [bookings, focusId],
  );

  const featuredCover = featured ? tripImageFor(featured) : '';
  const usingOfflinePass = !featured && Boolean(offlineSnap?.booking);
  const displayBooking = useMemo(() => {
    if (featured) return featured;
    if (!offlineSnap?.booking) return null;
    return {
      ...offlineSnap.booking,
      _offlineQrDataUrl: offlineSnap.qrDataUrl || '',
    };
  }, [featured, offlineSnap]);
  const displayCover = featured ? featuredCover : offlineSnap?.coverImage || '';
  const displayBrand = featured ? brandLabel : offlineSnap?.brandLabel || brandLabel;
  const displayPassenger = featured
    ? profile.name
    : offlineSnap?.passengerName || profile.name;

  useEffect(() => {
    if (!featured) return;
    saveLastPass({
      booking: featured,
      coverImage: featuredCover,
      brandLabel,
      passengerName: profile.name,
    });
    setOfflineSnap(loadLastPass());
  }, [featured, featuredCover, brandLabel, profile.name]);

  const handleQrChange = useCallback((payload) => {
    if (!payload?.qrValue && !payload?.qrDataUrl) return;
    patchLastPassQr({
      bookingId: payload.bookingId,
      qrValue: payload.qrValue,
      qrDataUrl: payload.qrDataUrl,
    });
    setOfflineSnap(loadLastPass());
  }, []);

  useEffect(() => {
    if (featured?.id && focusId && featured.id === focusId) {
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

  // Native Wallet app: always full-bleed phone shell (no tablet/desktop bezel).
  const stageClass = nativeWallet
    ? 'wallet-phone-stage wallet-phone-stage--phone wallet-phone-stage--native'
    : [
        'wallet-phone-stage',
        isPhone ? 'wallet-phone-stage--phone' : '',
        isDesktop ? 'wallet-phone-stage--desktop' : '',
        !isPhone && !isDesktop ? 'wallet-phone-stage--tablet' : '',
      ]
        .filter(Boolean)
        .join(' ');

  const switchTab = (id) => {
    setActiveTab(id);
    setSelectedBookingId(null);
    if (nativeWalletEarly && id !== 'ticket') {
      const q = id && id !== 'start' ? `?tab=${id}` : '';
      navigate(`/wallet${q}`, { replace: true });
    }
  };

  const homePass = (
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

      {(networkOffline || usingOfflinePass) && displayBooking ? (
        <div className="wallet-offline-banner" role="status">
          <span className="material-symbols-outlined" aria-hidden>
            wifi_off
          </span>
          <p>Χωρίς σύνδεση — εμφανίζεται το τελευταίο αποθηκευμένο εισιτήριο.</p>
        </div>
      ) : null}

      {loadingBookings && !displayBooking ? (
        <div className="wallet-pass-empty">
          <div className="wallet-pass-empty-inner">
            <p className="wallet-pass-empty-copy">Φόρτωση εισιτηρίου…</p>
          </div>
        </div>
      ) : (
        <WalletBoardingPass
          booking={displayBooking}
          coverImage={displayCover}
          brandLabel={displayBrand}
          passengerName={displayPassenger}
          onOpenDetails={openTicket}
          onBrowseTrips={() => {
            if (nativeWallet) {
              switchTab('bookings');
              return;
            }
            navigate('/');
          }}
          onQrChange={handleQrChange}
          offline={usingOfflinePass}
        />
      )}

      {featured ? <WalletInstallPrompt /> : null}
    </>
  );

  const upcomingRail = (
    <aside className="wallet-desktop-rail" aria-label="Επόμενες κρατήσεις">
      <div className="wallet-desktop-rail-card">
        <p className="wallet-desktop-rail-kicker">Γεια σας</p>
        <p className="wallet-desktop-rail-name truncate">{profile.name}</p>
        <p className="wallet-desktop-rail-email truncate">{profile.email}</p>
      </div>

      <div className="wallet-desktop-rail-card">
        <div className="wallet-desktop-rail-head">
          <h2>Επόμενες</h2>
          <button type="button" className="wallet-desktop-rail-link" onClick={() => switchTab('bookings')}>
            Όλες
          </button>
        </div>
        {otherUpcoming.length === 0 && bookings.length <= 1 ? (
          <p className="wallet-desktop-rail-empty">Δεν υπάρχουν άλλες κρατήσεις.</p>
        ) : (
          <ul className="wallet-desktop-rail-list">
            {(otherUpcoming.length ? otherUpcoming : bookings.filter((b) => b.id !== featured?.id))
              .slice(0, 5)
              .map((b) => (
                <li key={b.id}>
                  <button type="button" className="wallet-desktop-rail-item" onClick={() => openTicket(b)}>
                    <span className="wallet-desktop-rail-item-title truncate">{b.tripTitle}</span>
                    <span className="wallet-desktop-rail-item-meta">
                      {b.date}
                      {b.seat ? ` · ${b.seat}` : ''}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="wallet-desktop-rail-actions">
        {!nativeWallet ? (
          <button type="button" className="wallet-btn wallet-btn-primary wallet-btn-block" onClick={() => navigate('/')}>
            Νέα κράτηση
          </button>
        ) : null}
        <button type="button" className="wallet-btn wallet-btn-ghost wallet-btn-block" onClick={() => switchTab('account')}>
          Λογαριασμός
        </button>
      </div>
    </aside>
  );

  return (
    <div
      className={stageClass}
      data-wallet-device={nativeWallet || isPhone ? 'phone' : isDesktop ? 'desktop' : 'tablet'}
    >
      <div
        className={`wallet-app${
          nativeWallet || isPhone ? ' wallet-app--phone' : isDesktop ? ' wallet-app--desktop' : ''
        }`}
      >
        <header className="wallet-topbar">
          {nativeWallet ? (
            <span className="wallet-topbar-btn" aria-hidden style={{ visibility: 'hidden' }}>
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </span>
          ) : (
            <button type="button" className="wallet-topbar-btn" onClick={() => navigate('/')}>
              <span className="material-symbols-outlined text-[20px]" aria-hidden>
                arrow_back
              </span>
              <span className="wallet-topbar-btn-label">Αρχική</span>
            </button>
          )}
          <div className="wallet-topbar-brand">
            <OfficeBrandMark
              className="h-8"
              variant="light"
              fallbackLabel={brandLabel || 'My Wallet'}
              asLink={false}
              refreshKey={sealedTenantId}
              tenantId={sealedTenantId || undefined}
            />
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
            <span className="wallet-topbar-btn-label">Έξοδος</span>
          </button>
        </header>

        {isDesktop && !isTicketView ? (
          <nav className="wallet-nav wallet-nav--desktop" aria-label="My Wallet">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? 'is-active' : ''}
                onClick={() => switchTab(tab.id)}
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
        {activeTab === 'start' && !isTicketView ? (
          <WalletStartFeed
            appearance={siteAppearance}
            officeName={brandLabel && brandLabel !== 'My Wallet' ? brandLabel : ''}
            tenantId={sealedTenantId}
            onOpenBookings={() => switchTab('bookings')}
            onOpenTicket={() => switchTab('home')}
          />
        ) : null}

        {activeTab === 'home' && !isTicketView ? (
          isDesktop ? (
            <div className="wallet-desktop-home">
              <div className="wallet-desktop-pass-col">{homePass}</div>
              {upcomingRail}
            </div>
          ) : (
            <>
              {homePass}
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
                    onClick={() => switchTab('bookings')}
                  >
                    <span>Όλες οι κρατήσεις</span>
                    <span>{bookings.length}</span>
                  </button>
                </div>
              ) : null}
            </>
          )
        ) : null}

        {activeTab === 'bookings' && (
          <div className="wallet-stack">
            <div className="wallet-panel">
              <h2>Οι κρατήσεις μου</h2>
              <p className="wallet-panel-lead">
                {bookings.length
                  ? `${bookings.length} κρατήσεις στο λογαριασμό σας`
                  : 'Δεν υπάρχουν κρατήσεις ακόμα — επιλέξτε εκδρομή από κάτω'}
              </p>

              {bookings.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    justifyContent: 'center',
                    padding: '0.75rem 0 0.25rem',
                  }}
                >
                  <Link to="/my-booking" className="wallet-btn wallet-btn-secondary">
                    Εύρεση κράτησης
                  </Link>
                </div>
              ) : (
                <div className={`wallet-list${isDesktop ? ' wallet-list--desktop' : ''}`}>
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

            {officeModules?.trips_enabled !== false ? (
              <WalletOfficeExcursionsPanel
                tenantId={sealedTenantId}
                officeName={brandLabel && brandLabel !== 'My Wallet' ? brandLabel : ''}
              />
            ) : null}
          </div>
        )}

        {activeTab === 'rentals' && rentAvailable ? (
          <div className="wallet-stack">
            <section className="wallet-panel">
              <div className="wallet-panel-head">
                <span className="wallet-panel-head-icon" aria-hidden>
                  <span className="material-symbols-outlined">directions_car</span>
                </span>
                <div>
                  <h2>Εφαρμογή ενοικίασης</h2>
                  <p>
                    Η κράτηση οχήματος γίνεται πλέον στη dedicated εφαρμογή — εγκαταστήσιμη στην
                    αρχική οθόνη του κινητού.
                  </p>
                </div>
              </div>
              <Link to="/rent" className="wallet-btn wallet-btn-primary wallet-btn-block">
                Άνοιγμα /rent
              </Link>
            </section>
            <RentalCatalogPanel />
          </div>
        ) : null}

        {activeTab === 'lost_found' && (
          <div className="wallet-stack">
            <button
              type="button"
              className="wallet-btn wallet-btn-ghost"
              onClick={() => switchTab('account')}
              style={{ alignSelf: 'flex-start' }}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                arrow_back
              </span>
              Πίσω στον λογαριασμό
            </button>
            <LostFoundPanel bookings={bookings} />
          </div>
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
                  { icon: 'badge', label: 'Ονοματεπώνυμο', value: profile.name, tone: '' },
                  { icon: 'mail', label: 'Email', value: profile.email, tone: '' },
                  { icon: 'call', label: 'Τηλέφωνο', value: profile.phone || '—', tone: 'is-mint' },
                  {
                    icon: 'key',
                    label: 'Σύνδεση',
                    value: profile.provider === 'google' ? 'Google' : 'Email & κωδικός',
                    tone: 'is-sunset',
                  },
                ].map((row) => (
                  <div key={row.label} className="wallet-account-row">
                    <span className={`wallet-account-row-icon ${row.tone}`.trim()} aria-hidden>
                      <span className="material-symbols-outlined">{row.icon}</span>
                    </span>
                    <div>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
            <section className="wallet-panel">
              <div className="wallet-panel-head">
                <span className="wallet-panel-head-icon" aria-hidden>
                  <span className="material-symbols-outlined">support_agent</span>
                </span>
                <div>
                  <h2>Απωλεσθέντα</h2>
                  <p>Δήλωση ή αναζήτηση αντικειμένων από τις διαδρομές σας.</p>
                </div>
              </div>
              <button
                type="button"
                className="wallet-btn wallet-btn-primary wallet-btn-block"
                data-pg-wallet={WALLET_TABS_BUILD_MARKER}
                onClick={() => switchTab('lost_found')}
              >
                Άνοιγμα απωλεσθέντων
              </button>
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

        {/* Native: WalletNativeShell is the single full dock (all cards). Web/phone PWA keeps in-app nav. */}
        {!nativeWallet && !isDesktop && !isTicketView ? (
          <nav
            className="wallet-nav"
            aria-label="My Wallet"
            style={{ gridTemplateColumns: `repeat(${Math.max(tabs.length, 1)}, 1fr)` }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? 'is-active' : ''}
                onClick={() => switchTab(tab.id)}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

/**
 * My Wallet — step 1: boarding-pass home.
 */
export default function SimpleWalletPage() {
  return <WalletAuthGate />;
}
