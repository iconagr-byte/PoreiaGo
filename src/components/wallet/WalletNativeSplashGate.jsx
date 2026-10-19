import { useState } from 'react';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';
import {
  hasSeenWalletBrandSplash,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import WalletBrandSplash from './WalletBrandSplash.jsx';

/**
 * Capacitor cold start: show PoreiaGo Qatar-style splash before any Wallet UI
 * (login fields or tickets). Website is unchanged.
 */
export default function WalletNativeSplashGate({ children }) {
  const [showSplash, setShowSplash] = useState(() => {
    if (!isNativeApp()) return false;
    return !hasSeenWalletBrandSplash();
  });

  if (!isNativeApp()) return children;

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
