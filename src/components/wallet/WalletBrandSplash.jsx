import { useEffect, useState } from 'react';
import {
  WALLET_SPLASH_BRAND,
  WALLET_SPLASH_DURATION_MS,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import {
  ACHILLIO_TRAVEL_NAME,
  resolveOfficeSplashBrand,
} from '../../lib/wallet/officeSplashBrand.js';
import { getWalletTenantId } from '../../lib/wallet/walletTenantSeal.js';
import {
  fetchSiteAppearance,
  loadCachedSiteAppearance,
} from '../../services/siteAppearanceApi.js';
import '../../styles/wallet-brand-splash.css';

/** Bundled Achillio seal + wordmark — matches native Android splash.png. */
const ACHILLIO_MARK_SRC = '/images/achillio-travel-mark.png';

/**
 * Native brand splash — office logo + office name when sealed branding exists
 * (e.g. Achillio Travel mark + wordmark), else PoreiaGo wordmark.
 *
 * Packaged wallet APK defaults to Achillio Travel: paint the bundled mark
 * immediately so cold start never shows Capacitor/PoreiaGo-only branding.
 */
export default function WalletBrandSplash({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const [officeLogoUrl, setOfficeLogoUrl] = useState(ACHILLIO_MARK_SRC);
  const [officeName, setOfficeName] = useState(ACHILLIO_TRAVEL_NAME);
  const [useBundledMark, setUseBundledMark] = useState(true);

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
      // Prefer live office seal + separate wordmark when API/cache has a logo URL.
      // Otherwise keep the bundled Achillio banner (logo+name in one asset).
      if (brand.hasLogo && brand.logoUrl && !/achillio-travel-mark/i.test(brand.logoUrl)) {
        setOfficeLogoUrl(brand.logoUrl);
        setOfficeName(brand.name || ACHILLIO_TRAVEL_NAME);
        setUseBundledMark(false);
      } else if (brand.name && brand.name !== ACHILLIO_TRAVEL_NAME) {
        setOfficeName(brand.name);
      }
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
      <div
        className={`pg-wallet-splash-mark${
          hasOffice ? (useBundledMark ? ' pg-wallet-splash-mark--banner' : ' pg-wallet-splash-mark--row') : ''
        }`}
      >
        {hasOffice ? (
          useBundledMark ? (
            <img
              src={officeLogoUrl || ACHILLIO_MARK_SRC}
              alt={officeName || ACHILLIO_TRAVEL_NAME}
              className="pg-wallet-splash-banner"
            />
          ) : (
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
          )
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
