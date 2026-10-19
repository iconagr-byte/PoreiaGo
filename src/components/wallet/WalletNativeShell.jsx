import { NavLink, useLocation } from 'react-router-dom';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';

/**
 * Bottom chrome outside authenticated My Wallet.
 * On /wallet the in-app wallet-nav already shows all cards
 * (Εισιτήριο, Κρατήσεις, Rent, Απωλ., Εγώ) — do not cover them.
 */
const TABS = [
  { to: '/wallet', end: false, icon: 'confirmation_number', label: 'Εισιτήρια' },
  { to: '/my-booking', end: false, icon: 'search', label: 'Κράτηση' },
];

export default function WalletNativeShell() {
  const { pathname } = useLocation();
  const native = isNativeApp();

  if (!native) return null;

  const authScreen =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  if (authScreen) return null;

  // Authenticated wallet has its own full tab bar — never overlay it.
  if (pathname === '/wallet' || pathname.startsWith('/wallet/')) {
    return null;
  }

  const hide =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/driver') ||
    pathname.startsWith('/rent') ||
    pathname.startsWith('/partner') ||
    pathname.startsWith('/grafeia') ||
    pathname.startsWith('/sign/') ||
    pathname.startsWith('/select-seat') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/trip/');

  if (hide) return null;

  return (
    <nav
      className="wallet-native-tabbar"
      aria-label="PoreiaGo Wallet"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        display: 'grid',
        gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
        gap: 4,
        padding: '8px 12px calc(8px + env(safe-area-inset-bottom))',
        background: 'rgba(255,255,255,0.96)',
        borderTop: '1px solid #e2e8f0',
        backdropFilter: 'blur(12px)',
      }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          style={({ isActive }) => {
            const active =
              isActive ||
              (tab.to === '/wallet' && pathname.startsWith('/wallet'));
            return {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 4px',
              borderRadius: 14,
              textDecoration: 'none',
              fontSize: 11,
              fontWeight: 700,
              color: active ? '#0f4c81' : '#64748b',
              background: active ? 'rgba(15,76,129,0.08)' : 'transparent',
            };
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
            {tab.icon}
          </span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
