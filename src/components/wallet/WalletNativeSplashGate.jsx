import { useEffect, useState } from 'react';
import { isNativeApp, isNativeDriverApp } from '../../lib/capacitor/isNativeApp.js';
import { hideNativeSplash } from '../../lib/capacitor/hideNativeSplash.js';
import {
  WALLET_SPLASH_DURATION_MS,
  hasSeenWalletBrandSplash,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import WalletBrandSplash from './WalletBrandSplash.jsx';

/** Absolute ceiling so splash never blocks the role router forever. */
const SPLASH_FAILSAFE_MS = WALLET_SPLASH_DURATION_MS + 2000;

/**
 * Capacitor cold start: show PoreiaGo brand splash once, then the role home
 * (wallet / driver / rent / login) from NativeUnifiedBoot.
 *
 * Skipped for website and legacy driver-only APK (com.poreiago.driver).
 * Unified app (VITE_NATIVE_APP=app|wallet) always gets the brand splash on
 * cold start — including when early boot rewrote `/` → `/driver`.
 */
export default function WalletNativeSplashGate({ children }) {
  const skip = !isNativeApp() || isNativeDriverApp();

  const [showSplash, setShowSplash] = useState(() => {
    if (skip) return false;
    return !hasSeenWalletBrandSplash();
  });

  // Hand off: Android Theme.SplashScreen → React brand splash (or app UI).
  useEffect(() => {
    void hideNativeSplash();
  }, [showSplash, skip]);

  // Failsafe: never leave the user on a stuck splash.
  useEffect(() => {
    if (skip || !showSplash) return undefined;
    const t = window.setTimeout(() => {
      markWalletBrandSplashSeen();
      setShowSplash(false);
      void hideNativeSplash();
    }, SPLASH_FAILSAFE_MS);
    return () => window.clearTimeout(t);
  }, [skip, showSplash]);

  if (skip) return children;

  if (showSplash) {
    return (
      <WalletBrandSplash
        onDone={() => {
          markWalletBrandSplashSeen();
          setShowSplash(false);
          void hideNativeSplash();
        }}
      />
    );
  }

  return children;
}
