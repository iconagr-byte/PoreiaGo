import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isNativeApp, isNativeDriverApp } from '../../lib/capacitor/isNativeApp.js';
import {
  hasSeenWalletBrandSplash,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import WalletBrandSplash from './WalletBrandSplash.jsx';

function isDriverSurface(pathname) {
  const p = pathname || '/';
  return p === '/driver' || p.startsWith('/driver/');
}

/**
 * Capacitor cold start: show PoreiaGo splash before customer Wallet / Rent UI.
 * Skipped for legacy driver-only APK and when already on /driver.
 * Website unchanged.
 */
export default function WalletNativeSplashGate({ children }) {
  const location = useLocation();
  const skip =
    !isNativeApp() || isNativeDriverApp() || isDriverSurface(location.pathname);

  const [showSplash, setShowSplash] = useState(() => {
    if (skip) return false;
    return !hasSeenWalletBrandSplash();
  });

  if (skip) return children;

  if (showSplash) {
    return (
      <WalletBrandSplash
        onDone={() => {
          markWalletBrandSplashSeen();
          setShowSplash(false);
        }}
      />
    );
  }

  return children;
}
