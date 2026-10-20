import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';
import {
  DEFAULT_OFFICE_MODULES,
  fetchOfficeModules,
  shouldShowRentStorefront,
} from '../../services/officeModulesApi.js';
import {
  getWalletTenantId,
  WALLET_TENANT_CHANGED_EVENT,
} from '../../lib/wallet/walletTenantSeal.js';

/**
 * Single native bottom dock — My Wallet cards.
 * Απωλεσθέντα lives inside Εγώ (account), not on the dock.
 */
const BASE_TABS = [
  { id: 'start', to: '/wallet', tab: 'start', icon: 'home', label: 'Αρχική' },
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
  { id: 'account', to: '/wallet', tab: 'account', icon: 'person', label: 'Εγώ' },
];

function walletTabFromPath(pathname, search) {
  // Booking lookup (/my-booking) is linked from Κρατήσεις — not a dock tab.
  if (pathname === '/my-booking' || pathname.startsWith('/my-booking/')) return '';
  if (pathname !== '/wallet' && !pathname.startsWith('/wallet/')) return '';
  try {
    const q = new URLSearchParams(search || '');
    const tab = String(q.get('tab') || 'start').trim();
    // lost_found opens from Εγώ — highlight account when deep-linked.
    if (tab === 'lost_found') return 'account';
    if (['start', 'home', 'bookings', 'rentals', 'account'].includes(tab)) return tab;
  } catch {
    /* ignore */
  }
  return 'start';
}

export default function WalletNativeShell() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const native = isNativeApp();
  const [rentAvailable, setRentAvailable] = useState(false);
  const [sealedTenantId, setSealedTenantId] = useState(() => getWalletTenantId() || '');

  useEffect(() => {
    if (!native) return undefined;
    const syncSeal = () => setSealedTenantId(getWalletTenantId() || '');
    syncSeal();
    window.addEventListener('storage', syncSeal);
    window.addEventListener(WALLET_TENANT_CHANGED_EVENT, syncSeal);
    return () => {
      window.removeEventListener('storage', syncSeal);
      window.removeEventListener(WALLET_TENANT_CHANGED_EVENT, syncSeal);
    };
  }, [native]);

  useEffect(() => {
    if (!native) return undefined;
    let cancelled = false;
    // Default hidden until modules resolve — never flash Rent for unpaid offices.
    setRentAvailable(false);
    fetchOfficeModules(sealedTenantId ? { tenantId: sealedTenantId } : undefined)
      .then((mods) => {
        if (!cancelled) {
          setRentAvailable(
            shouldShowRentStorefront(mods, {
              nativeWallet: true,
              sealedTenant: Boolean(sealedTenantId),
            }),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRentAvailable(
            shouldShowRentStorefront(DEFAULT_OFFICE_MODULES, {
              nativeWallet: true,
              sealedTenant: Boolean(sealedTenantId),
            }),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [native, sealedTenantId]);

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
              const q = tab.tab && tab.tab !== 'start' ? `?tab=${tab.tab}` : '';
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
