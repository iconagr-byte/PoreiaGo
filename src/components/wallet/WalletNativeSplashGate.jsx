import { useState } from 'react';
import { isNativeApp, isNativeDriverApp } from '../../lib/capacitor/isNativeApp.js';
import {
  hasSeenWalletBrandSplash,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import WalletBrandSplash from './WalletBrandSplash.jsx';

/**
 * Capacitor cold start: show PoreiaGo Qatar-style splash before any Wallet UI
 * (login fields or tickets). Website is unchanged. Skipped for Driver native.
 */
export default function WalletNativeSplashGate({ children }) {
  const [showSplash, setShowSplash] = useState(() => {
    if (!isNativeApp() || isNativeDriverApp()) return false;
    return !hasSeenWalletBrandSplash();
  });

  if (!isNativeApp() || isNativeDriverApp()) return children;

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
