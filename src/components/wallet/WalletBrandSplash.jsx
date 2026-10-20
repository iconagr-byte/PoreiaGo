import { useEffect, useState } from 'react';
import {
  WALLET_SPLASH_BRAND,
  WALLET_SPLASH_BUILD_MARKER,
  WALLET_SPLASH_DURATION_MS,
  WALLET_SPLASH_HOOK,
  WALLET_SPLASH_SUPPORT,
  dismissWalletBootSplash,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import '../../styles/wallet-brand-splash.css';

/** Travel path mark — soft arc + destination pin on Apple-blue squircle. */
function PoreiaGoGlyph() {
  return (
    <span className="pg-wallet-splash-glyph-wrap" aria-hidden>
      <span className="pg-wallet-splash-glyph">
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M6.5 25.5c5.2-9.2 11.6-13.8 18.8-14.6"
            stroke="#fff"
            strokeWidth="2.35"
            strokeLinecap="round"
          />
          <circle cx="27.2" cy="10.2" r="2.55" fill="#fff" />
          <path
            d="M8.2 27.2h12.6c1.85 0 2.95-2 1.95-3.5l-1.7-2.55"
            stroke="#fff"
            strokeWidth="2.35"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
          <circle cx="27.2" cy="10.2" r="1.05" fill="#0071e3" opacity="0.35" />
        </svg>
      </span>
    </span>
  );
}

/**
 * Apple-aesthetic brand splash: soft white, PoreiaGo wordmark, quality hook.
 * Capacitor cold start only (see WalletNativeSplashGate).
 */
export default function WalletBrandSplash({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    markWalletBrandSplashSeen();
    window.setTimeout(() => {
      onDone?.();
    }, 380);
  };

  useEffect(() => {
    // Hand off from HTML boot splash (painted before React) to this screen.
    dismissWalletBootSplash();
    const t = window.setTimeout(finish, WALLET_SPLASH_DURATION_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once auto-advance
  }, []);

  const brand = WALLET_SPLASH_BRAND;
  const splitAt = brand.toLowerCase().endsWith('go') ? brand.length - 2 : brand.length;
  const brandMain = brand.slice(0, splitAt);
  const brandAccent = brand.slice(splitAt);

  return (
    <div
      className={`pg-wallet-splash${leaving ? ' pg-wallet-splash--out' : ''}`}
      role="dialog"
      aria-label={`${WALLET_SPLASH_BRAND} — ${WALLET_SPLASH_HOOK}`}
      onClick={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      }}
      tabIndex={0}
    >
      <div className="pg-wallet-splash-mark" data-pg-splash={WALLET_SPLASH_BUILD_MARKER}>
        <PoreiaGoGlyph />
        <h1 className="pg-wallet-splash-wordmark">
          {brandMain}
          <span>{brandAccent}</span>
        </h1>
        <hr className="pg-wallet-splash-rule" aria-hidden />
        <p className="pg-wallet-splash-hook">{WALLET_SPLASH_HOOK}</p>
        <p className="pg-wallet-splash-support">{WALLET_SPLASH_SUPPORT}</p>
        <div className="pg-wallet-splash-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
      <p className="pg-wallet-splash-hint">Πατήστε για συνέχεια</p>
    </div>
  );
}
