import { useEffect, useState } from 'react';
import {
  WALLET_SPLASH_BRAND,
  WALLET_SPLASH_DURATION_MS,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import '../../styles/wallet-brand-splash.css';

/**
 * Generic brand splash: PoreiaGo wordmark only (no marketing copy).
 * Shown once per native app session before role home / login.
 */
export default function WalletBrandSplash({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    markWalletBrandSplashSeen();
    window.setTimeout(() => {
      onDone?.();
    }, 280);
  };

  useEffect(() => {
    const t = window.setTimeout(finish, WALLET_SPLASH_DURATION_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once auto-advance
  }, []);

  // Brand signal first: "Poreia" + accent "Go".
  const brand = WALLET_SPLASH_BRAND;
  const splitAt = brand.toLowerCase().endsWith('go') ? brand.length - 2 : brand.length;
  const brandMain = brand.slice(0, splitAt);
  const brandAccent = brand.slice(splitAt);

  return (
    <div
      className={`pg-wallet-splash${leaving ? ' pg-wallet-splash--out' : ''}`}
      role="dialog"
      aria-label={WALLET_SPLASH_BRAND}
      onClick={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      }}
      tabIndex={0}
    >
      <div className="pg-wallet-splash-mark">
        <h1 className="pg-wallet-splash-wordmark">
          {brandMain}
          <span>{brandAccent}</span>
        </h1>
      </div>
    </div>
  );
}
