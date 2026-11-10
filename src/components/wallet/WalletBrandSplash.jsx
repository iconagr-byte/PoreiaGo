import { useEffect, useState } from 'react';
import {
  WALLET_SPLASH_BRAND,
  WALLET_SPLASH_DURATION_MS,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import { resolveOfficeSplashBrand } from '../../lib/wallet/officeSplashBrand.js';
import { getWalletTenantId } from '../../lib/wallet/walletTenantSeal.js';
import {
  fetchSiteAppearance,
  loadCachedSiteAppearance,
} from '../../services/siteAppearanceApi.js';
import '../../styles/wallet-brand-splash.css';

/**
 * Native brand splash — office logo + office name when sealed branding exists
 * (e.g. Achillio Travel mark + wordmark), else PoreiaGo wordmark.
 */
export default function WalletBrandSplash({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const [officeLogoUrl, setOfficeLogoUrl] = useState('');
  const [officeName, setOfficeName] = useState('');

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    markWalletBrandSplashSeen();
    window.setTimeout(() => {
      onDone?.();
    }, 280);
  };

  useEffect(() => {
    let cancelled = false;
    const apply = (appearance) => {
      const brand = resolveOfficeSplashBrand(appearance || {});
      if (cancelled) return;
      if (brand.hasLogo) setOfficeLogoUrl(brand.logoUrl);
      if (brand.name) setOfficeName(brand.name);
    };

    // Instant paint from last sealed office cache (Capacitor Host=localhost).
    try {
      apply(loadCachedSiteAppearance());
    } catch {
      /* ignore */
    }

    const tid = String(getWalletTenantId() || '').trim();
    fetchSiteAppearance(tid ? { tenantId: tid } : undefined)
      .then((data) => {
        if (!cancelled) apply(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(finish, WALLET_SPLASH_DURATION_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once auto-advance
  }, []);

  const hasOffice = Boolean(officeLogoUrl || officeName);
  const ariaLabel = hasOffice
    ? officeName || 'Γραφείο'
    : WALLET_SPLASH_BRAND;

  // PoreiaGo fallback wordmark split.
  const brand = WALLET_SPLASH_BRAND;
  const splitAt = brand.toLowerCase().endsWith('go') ? brand.length - 2 : brand.length;
  const brandMain = brand.slice(0, splitAt);
  const brandAccent = brand.slice(splitAt);

  return (
    <div
      className={`pg-wallet-splash${leaving ? ' pg-wallet-splash--out' : ''}${
        hasOffice ? ' pg-wallet-splash--office' : ''
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
      <div className={`pg-wallet-splash-mark${hasOffice ? ' pg-wallet-splash-mark--row' : ''}`}>
        {hasOffice ? (
          <>
            {officeLogoUrl ? (
              <div className="pg-wallet-splash-logo-wrap">
                <img
                  src={officeLogoUrl}
                  alt={officeName || 'Λογότυπο γραφείου'}
                  className="pg-wallet-splash-logo"
                />
              </div>
            ) : null}
            {officeName ? (
              <p className="pg-wallet-splash-office-name">{officeName}</p>
            ) : null}
          </>
        ) : (
          <h1 className="pg-wallet-splash-wordmark">
            {brandMain}
            <span>{brandAccent}</span>
          </h1>
        )}
      </div>
    </div>
  );
}
