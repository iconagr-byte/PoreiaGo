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
import { clearNativeRoleHome } from '../lib/capacitor/nativeRoleHome.js';
import { clearPreferRentLookup } from '../lib/rental/preferRentLookup.js';
import {
  clearNativeRentDemo,
  isNativeRentDemo,
} from '../lib/rental/nativeRentDemo.js';
import {
  clearWalletFocusBooking,
  getWalletClaim,
  peekWalletFocusBooking,
  setWalletFocusBooking,
  walletClaimAuthPath,
  walletClaimNavState,
} from '../lib/wallet/walletClaim.js';
import { loadLastPass, patchLastPassQr, saveLastPass, clearLastPass } from '../lib/wallet/lastPassSnapshot.js';
import { setupWalletPwa } from '../lib/wallet/registerWalletPwa.js';
import {
  dismissWalletPass,
  loadDismissedWalletPassIds,
} from '../lib/wallet/walletPassLifecycle.js';
import { deleteMyBookingOnServer } from '../services/customerBookingsApi.js';
import { notifyBookingsChanged } from '../lib/ticketing/bookingSyncEvents.js';
import {
  getBookingById,
  loadBookingsForCustomer,
  removeBookingFromStore,
} from '../lib/ticketing/bookingStore.js';
import {
  expandWalletTickets,
  selectWalletPassBookings,
  sortWalletBookingsByDeparture,
} from '../lib/ticketing/bookingPassengers.js';
import { loadTrips } from '../lib/trips/tripStore.js';
import { bookingCoverUrl } from '../lib/trips/tripPhotos.js';
import { isPaid, statusStyle } from '../lib/bookingDisplay.js';
import { bookingFiscalMark } from '../lib/fiscal/fiscalDisplay.js';
import CustomerSecurityPanel from '../components/wallet/CustomerSecurityPanel.jsx';
import PushNotificationsPanel from '../components/wallet/PushNotificationsPanel.jsx';
import LostFoundPanel from '../components/wallet/LostFoundPanel.jsx';
import RentalCatalogPanel from '../components/wallet/RentalCatalogPanel.jsx';
import WalletRentBookHome from '../components/wallet/WalletRentBookHome.jsx';
import WalletAccountMenu from '../components/wallet/WalletAccountMenu.jsx';
import WalletRentSection from '../components/wallet/WalletRentSection.jsx';
import WalletBoardingPass from '../components/wallet/WalletBoardingPass.jsx';
import WalletInstallPrompt from '../components/wallet/WalletInstallPrompt.jsx';
import WalletMorePanel from '../components/wallet/WalletMorePanel.jsx';
import WalletNotificationBell from '../components/wallet/WalletNotificationBell.jsx';
import WalletStartFeed from '../components/wallet/WalletStartFeed.jsx';
import WalletTicketDetail from '../components/wallet/WalletTicketDetail.jsx';
import WalletDesignPreview from '../components/wallet/WalletDesignPreview.jsx';
import RentalWalletPanel from '../components/rental/RentalWalletPanel.jsx';
import OfficeBrandMark from '../components/storefront/OfficeBrandMark.jsx';
import {
  DEFAULT_SITE_APPEARANCE,
  fetchSiteAppearance,
  resolveSiteAssetUrl,
} from '../services/siteAppearanceApi.js';
import { fetchCustomerMe } from '../services/customerAuthApi.js';
import {
  DEFAULT_OFFICE_MODULES,
  fetchOfficeModules,
  isRentOnlyModules,
  shouldShowRentStorefront,
} from '../services/officeModulesApi.js';
import { fetchPublicOfficeTrips } from '../services/officeTripsApi.js';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import { resolveOfficeSplashBrand } from '../lib/wallet/officeSplashBrand.js';
import { useRentMobile, useRentPhone } from '../lib/rental/rentDevice.js';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';
import {
  getWalletTenantId,
  setWalletTenantId,
  WALLET_TENANT_CHANGED_EVENT,
} from '../lib/wallet/walletTenantSeal.js';
import {
  getCachedWalletOfficeTrips,
  rememberWalletOfficeTrips,
} from '../lib/wallet/walletOfficeTrips.js';
import '../styles/wallet-pass.css';
import '../styles/rental-pwa.css';

/** Match native Wallet bottom bar: Αρχική · Εισιτήριο · Κρατήσεις · [Ενοικιάσεις] · Περισσότερα.
 * Desktop → left sidebar; phone → bottom dock.
 * Rent passes live in the same shell (tab rentals) — not a second /rent/wallet app.
 * Account / Lost & Found / logout live in the header person menu. */
const ALL_TABS = [
  { id: 'home', label: 'Αρχική', icon: 'home' },
  { id: 'pass', label: 'Εισιτήριο', icon: 'confirmation_number' },
  { id: 'bookings', label: 'Κρατήσεις', icon: 'event_note' },
  { id: 'rentals', label: 'Ενοικιάσεις', icon: 'directions_car' },
  { id: 'more', label: 'Περισσότερα', icon: 'travel_explore' },
];

/** Native rent demo / rent-only office — no bus chrome; Κρατήσεις = rent only. */
const RENT_ONLY_TABS = [
  { id: 'rentals', label: 'Ενοικιάσεις', icon: 'directions_car' },
  { id: 'bookings', label: 'Κρατήσεις', icon: 'event_note' },
  { id: 'account', label: 'Λογαριασμός', icon: 'person' },
];

function tabIsActive(activeTab, tabId) {
  return activeTab === tabId;
}

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

function pickFeaturedBooking(bookings, highlightId, dismissedIds = []) {
  if (!bookings.length) return null;
  if (highlightId) {
    const hit = bookings.find((b) => b.id === highlightId);
    if (hit) return hit;
  }
  // Same calendar-first order as Εισιτήριο vertical stack (earliest first).
  const selected = selectWalletPassBookings(bookings, { dismissedIds });
  return selected[0] || null;
}

function WalletAuthGate() {
  const location = useLocation();
  const walletReturn =
    `/wallet${location.search || ''}` || '/wallet';

  // Design studio iframe (/wallet?preview=1) — show Αρχική, not login.
  let previewMode = false;
  try {
    previewMode = new URLSearchParams(location.search || '').get('preview') === '1';
  } catch {
    previewMode = false;
  }
  if (previewMode) {
    return <WalletDesignPreview />;
  }

  if (isCustomer() && !getCustomerToken()) {
    logoutCustomer();
  }

  // Native rent demo: soft local session opens My Wallet → Ενοικιάσεις.
  if (isCustomer() && getCustomerToken()) {
    return <WalletAuthenticatedApp />;
  }
  if (isNativeApp() && isNativeRentDemo()) {
    return <WalletAuthenticatedApp />;
  }

  // Driver accounts belong on /driver (unified native + web).
  if (isDriver()) {
    return <Navigate to="/driver" replace />;
  }

  if (isAdmin()) {
    return (
      <Navigate to="/login" replace state={{ from: walletReturn, walletClaim: true }} />
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

  return (
    <Navigate to="/login" replace state={{ from: walletReturn, walletClaim: true }} />
  );
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
  const isDesktop = !isMobile;
  const [activeTab, setActiveTab] = useState('home');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [dismissedPassIds, setDismissedPassIds] = useState(() => loadDismissedWalletPassIds());
  const [brandLabel, setBrandLabel] = useState('My Wallet');
  const [siteAppearance, setSiteAppearance] = useState(DEFAULT_SITE_APPEARANCE);
  const [officeModules, setOfficeModules] = useState(DEFAULT_OFFICE_MODULES);
  /** Sealed office UUID — drives logo/name fetch on native (Host=localhost). */
  const [sealedTenantId, setSealedTenantId] = useState(() => getWalletTenantId() || '');
  const [officeTrips, setOfficeTrips] = useState(() =>
    getCachedWalletOfficeTrips(getWalletTenantId() || ''),
  );
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

  const [profileTick, setProfileTick] = useState(0);
  /** Bump when book-first «Δες οχήματα» runs — drives RentalCatalogPanel search. */
  const [rentSearchTick, setRentSearchTick] = useState(0);
  /** Deep-link into CustomerSecurityPanel action from the account sheet. */
  const [securityFocus, setSecurityFocus] = useState(null);
  const profile = useMemo(() => resolveCustomerProfile(), [profileTick]);
  const email = profile.email;
  const officeBrand = useMemo(() => resolveOfficeBrand(siteAppearance || {}), [siteAppearance]);
  const officeLogoUrl = useMemo(
    () => (officeBrand.hasLogo ? resolveSiteAssetUrl(officeBrand.logoUrl) : ''),
    [officeBrand],
  );

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
    let tab = location.state?.walletTab;
    if (!tab) {
      try {
        tab = new URLSearchParams(location.search || '').get('tab') || '';
      } catch {
        tab = '';
      }
    }
    if (
      tab === 'account' ||
      tab === 'bookings' ||
      tab === 'home' ||
      tab === 'rentals' ||
      tab === 'pass' ||
      tab === 'more' ||
      tab === 'lost_found'
    ) {
      setActiveTab(tab);
      setSelectedBookingId(null);
    }
  }, [location.state?.walletTab, location.search]);

  useEffect(() => {
    let cancelled = false;
    const applyList = (list, { silent = false } = {}) => {
      if (cancelled) return;
      // Κρατήσεις + pass feeds: earliest excursion first (date+time).
      let sorted = sortWalletBookingsByDeparture(list);
      const focus = focusId || peekWalletFocusBooking();
      const dismissed = new Set(loadDismissedWalletPassIds().map(String));
      if (focus && !sorted.some((b) => b.id === focus) && !dismissed.has(String(focus))) {
        const local = getBookingById(focus);
        const localAliases = [local?.id, local?.saasBookingId, local?.pnr]
          .filter(Boolean)
          .map(String);
        const locallyRemoved = localAliases.some((a) => dismissed.has(a));
        if (
          local &&
          !locallyRemoved &&
          String(local.email || '').toLowerCase() === email
        ) {
          sorted = sortWalletBookingsByDeparture([...sorted, local]);
        }
      }
      setBookings(sorted);
      if (!sorted.length) {
        setOfflineSnap(loadLastPass());
      }
      if (!silent) setLoadingBookings(false);
    };

    setLoadingBookings(true);
    loadMyBookings(email)
      .then((list) => applyList(list))
      .catch(() => {
        if (!cancelled) {
          setBookings([]);
          setOfflineSnap(loadLastPass());
          setLoadingBookings(false);
        }
      });

    // Desktop ↔ wallet live sync: re-pull Postgres truth when tab is focused.
    const refresh = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      loadMyBookings(email)
        .then((list) => applyList(list, { silent: true }))
        .catch(() => {});
    };
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', refresh);
    const poll = window.setInterval(refresh, 20000);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(poll);
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
        // Splash helper recovers Achillio Travel when name fields are blank.
        const splashName = resolveOfficeSplashBrand(data || {}).name || '';
        const name = brand.displayName || splashName || brand.name;
        // Prefer real office name — never keep generic Γραφείο / My Wallet when API sent one.
        if (name && name !== 'Γραφείο') setBrandLabel(name);
        else if (data?.footer_brand_name) setBrandLabel(String(data.footer_brand_name));
        else if (splashName) setBrandLabel(splashName);
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

  // Published office catalog for pass/booking covers. On tenant hosts loadTrips()
  // is empty by design — covers must come from /api/site/trips (sealed tenant).
  useEffect(() => {
    let cancelled = false;
    fetchPublicOfficeTrips(sealedTenantId ? { tenantId: sealedTenantId } : undefined)
      .then((trips) => {
        if (cancelled) return;
        const list = Array.isArray(trips) ? trips : [];
        rememberWalletOfficeTrips(list, sealedTenantId || null);
        setOfficeTrips(list);
      })
      .catch(() => {
        if (!cancelled) setOfficeTrips(getCachedWalletOfficeTrips(sealedTenantId || ''));
      });
    return () => {
      cancelled = true;
    };
  }, [sealedTenantId]);

  const nativeWallet = isNativeApp();
  // Rent only with active contract — native localhost must not unlock marketing demo Rent
  // (Achillio Travel stays bus-only even on Capacitor).
  const rentAvailable = shouldShowRentStorefront(officeModules, {
    native: nativeWallet,
  });
  const rentOnlyShell = Boolean(isNativeRentDemo() || isRentOnlyModules(officeModules));
  const tabs = useMemo(() => {
    if (rentOnlyShell) return RENT_ONLY_TABS;
    return rentAvailable ? ALL_TABS : ALL_TABS.filter((t) => t.id !== 'rentals');
  }, [rentAvailable, rentOnlyShell]);

  useEffect(() => {
    if (rentOnlyShell) {
      const allowed = new Set(['rentals', 'bookings', 'account', 'lost_found']);
      if (!allowed.has(activeTab)) setActiveTab('rentals');
      return;
    }
    if (!rentAvailable && activeTab === 'rentals') {
      setActiveTab('home');
    }
  }, [rentAvailable, rentOnlyShell, activeTab]);

  const handleLogout = () => {
    logoutCustomer();
    clearNativeRoleHome();
    try {
      clearPreferRentLookup();
      clearNativeRentDemo();
    } catch {
      /* ignore */
    }
    navigate('/login', { replace: true, state: { from: '/wallet' } });
  };

  const openRentWallet = () => {
    setActiveTab('rentals');
    setSelectedBookingId(null);
  };

  const highlightRentalBookingId = String(
    location.state?.highlightRentalBooking || '',
  ).trim();

  const tripCatalog = useMemo(() => {
    let local = [];
    try {
      local = loadTrips();
    } catch {
      local = [];
    }
    const cached = getCachedWalletOfficeTrips(sealedTenantId || '');
    const byId = new Map();
    for (const t of [...local, ...cached, ...officeTrips]) {
      if (!t || t.id == null) continue;
      byId.set(Number(t.id), t);
    }
    return Array.from(byId.values());
  }, [officeTrips, sealedTenantId]);

  const coverForBooking = useCallback(
    (booking) => bookingCoverUrl(booking, tripCatalog),
    [tripCatalog],
  );

  const featured = useMemo(
    () =>
      pickFeaturedBooking(
        bookings,
        focusId || peekWalletFocusBooking(),
        dismissedPassIds,
      ),
    [bookings, focusId, dismissedPassIds],
  );

  const featuredCover = featured ? coverForBooking(featured) : '';
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

  /**
   * Delete ticket everywhere — Postgres office booking + this Wallet.
   * Desktop «Κρατήσεις ανά Ταξίδι» drops it on the next live sync.
   */
  const handleRemovePass = useCallback(
    async (booking) => {
      if (!booking) return;
      const aliases = [
        booking.id,
        booking.saasBookingId,
        booking.pnr,
        booking.ticketRef,
      ].filter(Boolean);
      if (!aliases.length) return;
      // Prefer UUID, then local B- id, then PNR — retry so Contabo TEXT PKs still match.
      const deleteKeys = [
        booking.saasBookingId,
        booking.id,
        booking.pnr,
        booking.ticketRef,
      ]
        .filter(Boolean)
        .map(String);
      const uniqueKeys = [...new Set(deleteKeys)];
      let deleted = false;
      let lastErr = null;
      for (const deleteKey of uniqueKeys) {
        try {
          await deleteMyBookingOnServer(deleteKey);
          deleted = true;
          break;
        } catch (err) {
          lastErr = err;
          const msg = String(err?.message || '');
          if (/404|not found|δεν βρέθηκε/i.test(msg)) {
            continue;
          }
          // 503 / ownership / network — stop and surface the error.
          throw err;
        }
      }
      if (!deleted && lastErr) {
        const msg = String(lastErr?.message || '');
        if (!/404|not found|δεν βρέθηκε/i.test(msg)) {
          throw lastErr;
        }
      }
      // Drop every alias from localStorage so the 20s poll cannot reinject it.
      for (const alias of aliases) {
        removeBookingFromStore(alias);
      }
      const next = dismissWalletPass(aliases);
      setDismissedPassIds(next);
      setBookings((prev) =>
        prev.filter((b) => {
          const keys = [b.id, b.saasBookingId, b.pnr, b.ticketRef]
            .filter(Boolean)
            .map(String);
          return !aliases.map(String).some((a) => keys.includes(a));
        }),
      );
      notifyBookingsChanged({
        reason: 'wallet-delete',
        bookingId: booking.id,
      });
      const snap = loadLastPass();
      const snapId = snap?.booking?.id;
      const snapAliases = [
        snap?.booking?.id,
        snap?.booking?.saasBookingId,
        snap?.booking?.pnr,
      ]
        .filter(Boolean)
        .map(String);
      if (
        snapId &&
        (aliases.map(String).includes(String(snapId)) ||
          snapAliases.some((a) => aliases.map(String).includes(a)))
      ) {
        clearLastPass();
        setOfflineSnap(null);
      }
      if (focusId && aliases.map(String).includes(String(focusId))) {
        clearWalletFocusBooking();
        setFocusId(null);
      }
      setSelectedBookingId(null);
      setActiveTab('pass');
    },
    [focusId],
  );

  /**
   * All wallet tickets for Εισιτήριο vertical stack and the «Επόμενες» rail.
   * Must not collapse to featured-only when trip dates are past — that left the
   * rail showing 2 other bookings while the center showed a single hero.
   * Expired trips stay visible (after active) until the customer removes the pass.
   */
  const passBookings = useMemo(() => {
    if (usingOfflinePass && displayBooking) return [displayBooking];
    const selected = selectWalletPassBookings(bookings, {
      dismissedIds: dismissedPassIds,
    });
    if (selected.length) return selected;
    if (featured) return [featured];
    if (displayBooking) return [displayBooking];
    return [];
  }, [bookings, featured, displayBooking, usingOfflinePass, dismissedPassIds]);

  const passTickets = useMemo(
    () => expandWalletTickets(passBookings, { passengerName: displayPassenger }),
    [passBookings, displayPassenger],
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
  };

  const openAccountSecurity = (action = null) => {
    setSecurityFocus(action || 'panel');
    switchTab('account');
    requestAnimationFrame(() => {
      document.getElementById('wallet-security')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const handleNotifOpen = (item) => {
    if (item?.bookingId) {
      const hit = bookings.find((b) => b.id === item.bookingId) || getBookingById(item.bookingId);
      const type = String(item.type || '');
      if (
        hit &&
        (item.tab === 'pass' || type.includes('fiscal') || type.includes('trip'))
      ) {
        openTicket(hit);
        return;
      }
    }
    if (item?.tab === 'bookings') switchTab('bookings');
    else if (item?.tab === 'pass') switchTab('pass');
    else if (item?.tab === 'more') switchTab('more');
    else if (item?.tab === 'account') switchTab('account');
    else if (item?.url && item.url !== '/wallet' && !String(item.url).startsWith('/wallet')) {
      window.location.assign(item.url);
    }
  };

  const onNavTabClick = (tab) => {
    if (tab.route) {
      navigate(tab.route);
      return;
    }
    switchTab(tab.id);
  };

  /** Desktop: keep trips inside Wallet Αρχική (sealed office). Storefront `/` is secondary. */
  const openOfficeTrips = () => {
    switchTab('home');
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const el = document.getElementById('wallet-upcoming-trips');
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  };

  const homeFeed = (
    <WalletStartFeed
      appearance={siteAppearance}
      officeName={brandLabel && brandLabel !== 'My Wallet' ? brandLabel : ''}
      tenantId={sealedTenantId}
      onOpenTicket={() => switchTab('pass')}
      onBrowseAllTrips={openOfficeTrips}
    />
  );

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
          bookings={passBookings}
          coverImage={displayCover}
          brandLabel={displayBrand}
          passengerName={displayPassenger}
          onOpenDetails={openTicket}
          onBrowseTrips={
            nativeWallet || isDesktop ? openOfficeTrips : () => navigate('/')
          }
          onOpenTrip={(trip) => {
            if (!trip?.id) {
              openOfficeTrips();
              return;
            }
            navigate(`/select-seat/${trip.id}`, {
              state: { fromWallet: true, officeTrip: trip },
            });
          }}
          onQrChange={handleQrChange}
          offline={usingOfflinePass}
          layout={isDesktop ? 'desktop' : 'phone'}
          featuredTrips={!displayBooking && isDesktop ? officeTrips : []}
          tripImageFor={coverForBooking}
        />
      )}

      {featured ? <WalletInstallPrompt /> : null}
    </>
  );

  /** Per-seat passes for the rail — same expansion as the Apple Wallet vertical stack. */
  const railTickets = passTickets.slice(0, 8);
  const railEmpty = railTickets.length === 0;

  const upcomingRail = (
    <aside className="wallet-desktop-rail" aria-label="Λογαριασμός και επόμενες">
      <div className="wallet-desktop-rail-hello">
        <p className="wallet-desktop-rail-kicker">Γεια σας</p>
        <p className="wallet-desktop-rail-name truncate">{profile.name}</p>
        <p className="wallet-desktop-rail-email truncate">{profile.email}</p>
      </div>

      <div className="wallet-desktop-rail-panel">
        <div className="wallet-desktop-rail-head">
          <h2>{railEmpty ? 'Επόμενο βήμα' : 'Επόμενες'}</h2>
          {!railEmpty ? (
            <button
              type="button"
              className="wallet-desktop-rail-link"
              onClick={() => switchTab('bookings')}
            >
              Όλες
            </button>
          ) : null}
        </div>
        {railEmpty ? (
          <ul className="wallet-desktop-rail-steps">
            <li>
              <button
                type="button"
                className="wallet-desktop-rail-step"
                onClick={() => (nativeWallet ? switchTab('bookings') : openOfficeTrips())}
              >
                <span className="wallet-desktop-rail-step-num">1</span>
                <span>
                  <strong>Επιλέξτε εκδρομή</strong>
                  <em>Από την Αρχική του Wallet</em>
                </span>
              </button>
            </li>
            <li>
              <Link to="/my-booking" className="wallet-desktop-rail-step">
                <span className="wallet-desktop-rail-step-num">2</span>
                <span>
                  <strong>Ή εισάγετε κωδικό</strong>
                  <em>Αν έχετε ήδη κράτηση</em>
                </span>
              </Link>
            </li>
          </ul>
        ) : (
          <ul className="wallet-desktop-rail-list">
            {railTickets.map((ticket) => {
              const seat = ticket.passenger?.seat || ticket.booking.seat || '';
              return (
                <li key={ticket.key}>
                  <button
                    type="button"
                    className="wallet-desktop-rail-item"
                    onClick={() => openTicket(ticket.booking)}
                  >
                    <span className="wallet-desktop-rail-item-title truncate">
                      {ticket.booking.tripTitle}
                    </span>
                    <span className="wallet-desktop-rail-item-meta">
                      {ticket.booking.date}
                      {seat ? ` · ${seat}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="wallet-desktop-rail-actions">
        {!nativeWallet ? (
          <button
            type="button"
            className="wallet-btn wallet-btn-primary wallet-btn-block"
            onClick={() => (railEmpty ? openOfficeTrips() : navigate('/'))}
          >
            {railEmpty ? 'Δείτε εκδρομές' : 'Νέα κράτηση'}
          </button>
        ) : null}
        <button
          type="button"
          className="wallet-btn wallet-btn-ghost wallet-btn-block"
          onClick={() => switchTab('account')}
        >
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
          <WalletAccountMenu
            profile={profile}
            officeLogoUrl={officeLogoUrl}
            officeName={
              officeBrand.displayName ||
              (brandLabel && brandLabel !== 'My Wallet' ? brandLabel : '')
            }
            rentAvailable={rentAvailable && !rentOnlyShell}
            onOpenAccount={() => switchTab('account')}
            onOpenSecurity={() => openAccountSecurity()}
            onOpenLostFound={
              rentOnlyShell ? undefined : () => switchTab('lost_found')
            }
            onOpenRent={rentOnlyShell ? undefined : openRentWallet}
            onLogout={handleLogout}
          />
          <div className="wallet-topbar-brand">
            <OfficeBrandMark
              className="h-7 max-w-[14.5rem]"
              variant="light"
              officeName={
                officeBrand.displayName ||
                (brandLabel && brandLabel !== 'My Wallet' ? brandLabel : '')
              }
              fallbackLabel={brandLabel || 'My Wallet'}
              asLink={false}
              refreshKey={sealedTenantId}
              tenantId={sealedTenantId}
              compact={Boolean(nativeWallet || isPhone)}
            />
          </div>
          <WalletNotificationBell
            email={profile.email}
            bookings={bookings}
            onOpenItem={handleNotifOpen}
          />
        </header>

        <div className={isDesktop ? 'wallet-desktop-shell' : 'wallet-body-shell'}>
        {isDesktop && !isTicketView ? (
          <nav
            className="wallet-nav wallet-nav--desktop"
            aria-label="My Wallet"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={tabIsActive(activeTab, tab.id) ? 'is-active' : ''}
                onClick={() => onNavTabClick(tab)}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  {tab.icon}
                </span>
                <span className="wallet-nav-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        ) : null}

        <main className="wallet-main">
        {!rentOnlyShell && activeTab === 'home' && !isTicketView ? (
          isDesktop ? (
            <div className="wallet-desktop-home">
              <div className="wallet-desktop-pass-col">
                {homeFeed}
                {rentAvailable ? (
                  <div className="wallet-stack" style={{ marginTop: '1rem' }}>
                    <WalletRentSection compact onOpenRentals={openRentWallet} />
                  </div>
                ) : null}
              </div>
              {upcomingRail}
            </div>
          ) : (
            <>
              {homeFeed}
              {rentAvailable ? (
                <div className="wallet-stack" style={{ marginTop: '0.85rem' }}>
                  <WalletRentSection compact onOpenRentals={openRentWallet} />
                </div>
              ) : null}
            </>
          )
        ) : null}

        {!rentOnlyShell && activeTab === 'pass' && !isTicketView ? (
          isDesktop ? (
            <div className="wallet-desktop-home">
              <div className="wallet-desktop-pass-col">{homePass}</div>
              {upcomingRail}
            </div>
          ) : (
            homePass
          )
        ) : null}

        {activeTab === 'bookings' && (
          <div className="wallet-stack">
            {rentAvailable ? <WalletRentSection onOpenRentals={openRentWallet} /> : null}
            {!rentOnlyShell ? (
              <div className="wallet-panel">
                <h2>Κρατήσεις λεωφορείου</h2>
                <p className="wallet-panel-lead">
                  {bookings.length
                    ? `${bookings.length} εισιτήρια στο λογαριασμό σας`
                    : 'Δεν υπάρχουν εισιτήρια ακόμα'}
                </p>

                {bookings.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '1.5rem 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      className="wallet-btn wallet-btn-primary"
                      onClick={openOfficeTrips}
                    >
                      Κράτηση εκδρομής
                    </button>
                    {nativeWallet ? (
                      <Link to="/my-booking" className="wallet-btn wallet-btn-ghost">
                        Εύρεση κράτησης
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <div className={`wallet-list${isDesktop ? ' wallet-list--desktop' : ''}`}>
                    {bookings.map((b) => {
                      const st = statusStyle(b);
                      const cover = coverForBooking(b);
                      return (
                        <article key={b.id} className="wallet-booking-card">
                          <div
                            className="wallet-booking-cover"
                            style={cover ? { backgroundImage: `url(${cover})` } : undefined}
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
            ) : null}
          </div>
        )}

        {activeTab === 'rentals' && rentAvailable ? (
          <div className="wallet-stack wallet-stack--rent-book">
            <WalletRentBookHome
              siteAppearance={siteAppearance}
              welcomeName={profile.name}
              onSearch={() => {
                setRentSearchTick((n) => n + 1);
                window.setTimeout(() => {
                  document
                    .getElementById('wallet-rent-fleet')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 80);
              }}
            />

            {/* Offer cards always under the book panel (auto-load on mount). */}
            <RentalCatalogPanel
              mode="full"
              bookFirst
              searchTick={rentSearchTick}
            />

            <section className="wallet-panel wallet-panel--rent-passes">
              <div className="wallet-panel-head">
                <span className="wallet-panel-head-icon" aria-hidden>
                  <span className="material-symbols-outlined">directions_car</span>
                </span>
                <div>
                  <h2>Οι ενοικιάσεις μου</h2>
                  <p>Κάρτες οχήματος στο My Wallet.</p>
                </div>
              </div>
              <RentalWalletPanel
                brandLabel={brandLabel}
                passengerName={profile.name}
                highlightBookingId={highlightRentalBookingId}
                onBookVehicle={() => {
                  document
                    .getElementById('wallet-rent-fleet')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            </section>
          </div>
        ) : null}

        {!rentOnlyShell && activeTab === 'more' && !isTicketView ? (
          <WalletMorePanel
            bookings={bookings}
            brandLabel={brandLabel}
            nativeWallet={nativeWallet}
            onOpenBookings={() => switchTab('bookings')}
            onOpenPass={() => switchTab('pass')}
            onBookTrip={openOfficeTrips}
          />
        ) : null}

        {activeTab === 'lost_found' && (
          <LostFoundPanel
            bookings={bookings}
            onBack={() => switchTab('account')}
          />
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
                  <p>Δήλωση αντικειμένου που ξεχάσατε στο λεωφορείο.</p>
                </div>
              </div>
              <button
                type="button"
                className="wallet-btn wallet-btn-ghost wallet-btn-block"
                onClick={() => switchTab('lost_found')}
              >
                Άνοιγμα απωλεσθέντων
              </button>
            </section>
            {rentAvailable ? (
              <section className="wallet-panel">
                <div className="wallet-panel-head">
                  <span className="wallet-panel-head-icon" aria-hidden>
                    <span className="material-symbols-outlined">directions_car</span>
                  </span>
                  <div>
                    <h2>Ενοικιάσεις</h2>
                    <p>Κάρτες οχήματος και κατάλογος στο ίδιο My Wallet.</p>
                  </div>
                </div>
                <div className="wallet-rent-actions">
                  <button
                    type="button"
                    className="wallet-btn wallet-btn-primary wallet-btn-block"
                    onClick={openRentWallet}
                  >
                    Οι ενοικιάσεις μου
                  </button>
                  <Link to="/rent" className="wallet-btn wallet-btn-ghost wallet-btn-block">
                    Βρες όχημα
                  </Link>
                </div>
              </section>
            ) : null}
            <PushNotificationsPanel email={profile.email} />
            <CustomerSecurityPanel
              email={profile.email}
              authProvider={profile.provider}
              initialAction={
                securityFocus && securityFocus !== 'panel' ? securityFocus : null
              }
              onEmailChanged={() => setProfileTick((n) => n + 1)}
            />
            <button
              type="button"
              className="wallet-btn wallet-btn-danger wallet-btn-block"
              onClick={handleLogout}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                logout
              </span>
              Έξοδος
            </button>
          </div>
        )}

        {isTicketView && (
          <WalletTicketDetail
            booking={selectedBooking}
            coverImage={coverForBooking(selectedBooking)}
            brandLabel={brandLabel}
            passengerName={profile.name}
            onBookingUpdated={handleBookingUpdated}
            onRemovePass={handleRemovePass}
            onBack={() => {
              setActiveTab('pass');
              setSelectedBookingId(null);
            }}
          />
        )}
        </main>
        </div>

        {!isDesktop && !isTicketView ? (
          <nav
            className="wallet-nav"
            aria-label="My Wallet"
            style={{ '--wallet-nav-cols': tabs.length }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={tabIsActive(activeTab, tab.id) ? 'is-active' : ''}
                onClick={() => onNavTabClick(tab)}
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
