import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';
import {
  DEFAULT_OFFICE_MODULES,
  fetchOfficeModules,
  shouldShowRentStorefront,
} from '../../services/officeModulesApi.js';
import { getWalletTenantId } from '../../lib/wallet/walletTenantSeal.js';

/**
 * Single native bottom dock — all My Wallet cards.
 * Replaces the old 2-tab bar that hid Κρατήσεις / Rent / Απωλ. / Εγώ.
 */
const BASE_TABS = [
  { id: 'home', to: '/wallet', tab: 'home', icon: 'confirmation_number', label: 'Εισιτήριο' },
  { id: 'bookings', to: '/wallet', tab: 'bookings', icon: 'event_note', label: 'Κρατήσεις' },
  {
    id: 'rentals',
    to: '/wallet',
    tab: 'rentals',
    icon: 'directions_car',
    label: 'Rent',
    requiresRent: true,
  },
  { id: 'lookup', to: '/my-booking', tab: null, icon: 'search', label: 'Κράτηση' },
  { id: 'lost_found', to: '/wallet', tab: 'lost_found', icon: 'support_agent', label: 'Απωλ.' },
  { id: 'account', to: '/wallet', tab: 'account', icon: 'person', label: 'Εγώ' },
];

function walletTabFromPath(pathname, search) {
  if (pathname === '/my-booking' || pathname.startsWith('/my-booking/')) return 'lookup';
  if (pathname !== '/wallet' && !pathname.startsWith('/wallet/')) return '';
  try {
    const q = new URLSearchParams(search || '');
    const tab = String(q.get('tab') || 'home').trim();
    if (['home', 'bookings', 'rentals', 'lost_found', 'account'].includes(tab)) return tab;
  } catch {
    /* ignore */
  }
  return 'home';
}

export default function WalletNativeShell() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const native = isNativeApp();
  const [rentAvailable, setRentAvailable] = useState(false);

  useEffect(() => {
    if (!native) return undefined;
    let cancelled = false;
    const tenantId = getWalletTenantId() || '';
    fetchOfficeModules(tenantId ? { tenantId } : undefined)
      .then((mods) => {
        if (!cancelled) setRentAvailable(shouldShowRentStorefront(mods));
      })
      .catch(() => {
        if (!cancelled) setRentAvailable(shouldShowRentStorefront(DEFAULT_OFFICE_MODULES));
      });
    return () => {
      cancelled = true;
    };
  }, [native]);

  const tabs = useMemo(
    () => BASE_TABS.filter((t) => !t.requiresRent || rentAvailable),
    [rentAvailable],
  );

  const activeId = walletTabFromPath(pathname, search);

  if (!native) return null;

  const authScreen =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  if (authScreen) return null;

  const onWalletSurface =
    pathname === '/wallet' ||
    pathname.startsWith('/wallet/') ||
    pathname === '/my-booking' ||
    pathname.startsWith('/my-booking/');

  if (!onWalletSurface) return null;

  // Ticket print / magic / google bridge — no dock.
  if (
    pathname.startsWith('/wallet/receipt') ||
    pathname.startsWith('/wallet/magic') ||
    pathname.startsWith('/wallet/native-google') ||
    pathname.startsWith('/ticket/')
  ) {
    return null;
  }

  return (
    <nav
      className="wallet-native-tabbar"
      aria-label="My Wallet"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        display: 'grid',
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        gap: 2,
        padding: '6px 8px calc(8px + env(safe-area-inset-bottom))',
        background: 'rgba(255,255,255,0.96)',
        borderTop: '1px solid #e2e8f0',
        backdropFilter: 'blur(12px)',
      }}
    >
      {tabs.map((tab) => {
        const active = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={active ? 'is-active' : ''}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              if (tab.id === 'lookup') {
                navigate('/my-booking', { state: { from: '/wallet' } });
                return;
              }
              const q = tab.tab && tab.tab !== 'home' ? `?tab=${tab.tab}` : '';
              navigate(`/wallet${q}`, { replace: pathname.startsWith('/wallet') });
            }}
            style={{
              appearance: 'none',
              border: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 2px',
              borderRadius: 14,
              textDecoration: 'none',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: active ? '#0f4c81' : '#64748b',
              background: active ? 'rgba(15,76,129,0.08)' : 'transparent',
              cursor: 'pointer',
              minWidth: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }} aria-hidden>
              {tab.icon}
            </span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
