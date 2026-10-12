import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';

const TABS = [
  { to: '/', end: true, icon: 'directions_bus', label: 'Λεωφορεία' },
  { to: '/wallet', end: false, icon: 'confirmation_number', label: 'Εισιτήρια' },
  { to: '/my-booking', end: false, icon: 'search', label: 'Κράτηση' },
];

/**
 * Bottom chrome for the Capacitor Wallet Android app (buses + ticket).
 * Hidden on web / rent / driver / admin routes.
 */
export default function WalletNativeShell() {
  const { pathname } = useLocation();
  const native = isNativeApp();

  useEffect(() => {
    if (!native) return;
    document.documentElement.dataset.poreiagoApp = 'wallet';
    return () => {
      delete document.documentElement.dataset.poreiagoApp;
    };
  }, [native]);

  if (!native) return null;

  const hide =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/driver') ||
    pathname.startsWith('/rent') ||
    pathname.startsWith('/partner') ||
    pathname.startsWith('/grafeia') ||
    pathname.startsWith('/sign/');

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
        gridTemplateColumns: 'repeat(3, 1fr)',
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
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '6px 4px',
            borderRadius: 14,
            textDecoration: 'none',
            fontSize: 11,
            fontWeight: 700,
            color: isActive ? '#0f4c81' : '#64748b',
            background: isActive ? 'rgba(15,76,129,0.08)' : 'transparent',
          })}
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
