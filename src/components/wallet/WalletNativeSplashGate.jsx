import { useEffect, useState } from 'react';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';
import {
  dismissWalletBootSplash,
  hasSeenWalletBrandSplash,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import WalletBrandSplash from './WalletBrandSplash.jsx';

function detectNativeWallet() {
  if (typeof document !== 'undefined') {
    try {
      if (document.documentElement.getAttribute('data-poreiago-app') === 'wallet') {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return isNativeApp();
}

/**
 * Capacitor cold start: show PoreiaGo Apple splash before any Wallet UI
 * (login fields or tickets). Website is unchanged.
 */
export default function WalletNativeSplashGate({ children }) {
  const [native, setNative] = useState(() => detectNativeWallet());
  const [showSplash, setShowSplash] = useState(() => {
    if (!detectNativeWallet()) return false;
    return !hasSeenWalletBrandSplash();
  });

  // Capacitor / dataset may settle one tick after first paint — catch it.
  useEffect(() => {
    if (native) return undefined;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (detectNativeWallet()) {
        setNative(true);
        if (!hasSeenWalletBrandSplash()) setShowSplash(true);
        window.clearInterval(id);
      } else if (tries >= 20) {
        window.clearInterval(id);
        dismissWalletBootSplash();
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [native]);

  // If we decided we are not native, never leave the HTML boot splash up.
  useEffect(() => {
    if (!native && !showSplash) dismissWalletBootSplash();
  }, [native, showSplash]);

  if (!native) return children;

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
