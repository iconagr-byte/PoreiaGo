import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';
import {
  isNativeDriverApp,
  isNativeUnifiedApp,
  markNativeAppShell,
  markNativeRoleSurface,
  NATIVE_APP_UNIFIED,
} from '../../lib/capacitor/nativeAppId.js';
import {
  isUnifiedNativeAppPath,
  rememberNativeRoleHome,
  resolveNativeRole,
  resolveNativeRoleHomePath,
  NATIVE_ROLE_DRIVER,
  NATIVE_ROLE_RENT,
  NATIVE_ROLE_WALLET,
} from '../../lib/capacitor/nativeRoleHome.js';

function roleFromPath(pathname) {
  const p = pathname || '/';
  if (p === '/driver' || p.startsWith('/driver/')) return NATIVE_ROLE_DRIVER;
  if (p === '/rent' || p.startsWith('/rent/')) return NATIVE_ROLE_RENT;
  if (p === '/wallet' || p.startsWith('/wallet/') || p === '/login' || p === '/register') {
    return NATIVE_ROLE_WALLET;
  }
  return resolveNativeRole() || NATIVE_ROLE_WALLET;
}

/**
 * One Capacitor install (com.poreiago.wallet): route by account role.
 * Skipped for legacy driver-only APK (com.poreiago.driver).
 * Web / PWA unchanged.
 */
export default function NativeUnifiedBoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = isNativeApp() && isNativeUnifiedApp() && !isNativeDriverApp();

  useEffect(() => {
    if (!active) return;
    markNativeAppShell(NATIVE_APP_UNIFIED);
    return () => {
      try {
        if (document.documentElement.dataset.poreiagoApp === NATIVE_APP_UNIFIED) {
          delete document.documentElement.dataset.poreiagoApp;
        }
      } catch {
        /* ignore */
      }
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const role = roleFromPath(location.pathname);
    markNativeRoleSurface(role);
    // Persist last customer/driver surface for the next cold start.
    if (role === NATIVE_ROLE_DRIVER || role === NATIVE_ROLE_WALLET || role === NATIVE_ROLE_RENT) {
      const p = location.pathname || '/';
      if (
        p === '/driver' ||
        p.startsWith('/driver/') ||
        p === '/wallet' ||
        p.startsWith('/wallet/') ||
        p === '/rent' ||
        p.startsWith('/rent/')
      ) {
        rememberNativeRoleHome(role);
      }
    }
  }, [active, location.pathname]);

  useEffect(() => {
    if (!active) return;
    const path = location.pathname || '/';
    if (isUnifiedNativeAppPath(path)) return;
    navigate(resolveNativeRoleHomePath(), { replace: true });
  }, [active, location.pathname, navigate]);

  if (active && !isUnifiedNativeAppPath(location.pathname)) {
    return <Navigate to={resolveNativeRoleHomePath()} replace />;
  }

  return null;
}
