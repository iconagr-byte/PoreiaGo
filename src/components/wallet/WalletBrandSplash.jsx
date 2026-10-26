import { useEffect, useState } from 'react';
import {
  WALLET_SPLASH_BRAND,
  WALLET_SPLASH_DURATION_MS,
  WALLET_SPLASH_HOOK,
  WALLET_SPLASH_SUPPORT,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import '../../styles/wallet-brand-splash.css';

/**
 * Native account splash — office logo when available, else PoreiaGo wordmark.
 * Shown on Capacitor cold start and after login while the account home loads.
 */
export default function WalletBrandSplash({
  onDone,
  officeLogoUrl = '',
  officeName = '',
  hook = WALLET_SPLASH_HOOK,
  support = WALLET_SPLASH_SUPPORT,
  durationMs = WALLET_SPLASH_DURATION_MS,
}) {
  const [leaving, setLeaving] = useState(false);
  const hasOfficeLogo = Boolean(officeLogoUrl);

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    markWalletBrandSplashSeen();
    window.setTimeout(() => {
      onDone?.();
    }, 280);
  };

  useEffect(() => {
    const t = window.setTimeout(finish, Math.max(1600, Number(durationMs) || WALLET_SPLASH_DURATION_MS));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once auto-advance
  }, []);

  const brand = officeName || WALLET_SPLASH_BRAND;
  const splitAt = !hasOfficeLogo && brand.toLowerCase().endsWith('go') ? brand.length - 2 : brand.length;
  const brandMain = brand.slice(0, splitAt);
  const brandAccent = brand.slice(splitAt);
  const ariaLabel = hasOfficeLogo
    ? `${officeName || 'Γραφείο'} — ${hook}`
    : `${WALLET_SPLASH_BRAND} — ${hook}`;

  return (
    <div
      className={`pg-wallet-splash${leaving ? ' pg-wallet-splash--out' : ''}${
        hasOfficeLogo ? ' pg-wallet-splash--office' : ''
      }`}
      role="dialog"
      aria-label={ariaLabel}
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
        {hasOfficeLogo ? (
          <>
            <div className="pg-wallet-splash-logo-wrap">
              <img
                src={officeLogoUrl}
                alt={officeName || 'Λογότυπο γραφείου'}
                className="pg-wallet-splash-logo"
              />
            </div>
            {officeName ? <p className="pg-wallet-splash-office-name">{officeName}</p> : null}
          </>
        ) : (
          <h1 className="pg-wallet-splash-wordmark">
            {brandMain}
            <span>{brandAccent}</span>
          </h1>
        )}
        <hr className="pg-wallet-splash-rule" aria-hidden />
        <p className="pg-wallet-splash-hook">{hook}</p>
        <p className="pg-wallet-splash-support">{support}</p>
      </div>
      <p className="pg-wallet-splash-hint">Αγγίξτε για συνέχεια</p>
    </div>
  );
}
