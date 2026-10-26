import { useEffect, useState } from 'react';
import { isNativeApp, isNativeDriverApp } from '../../lib/capacitor/isNativeApp.js';
import { hideNativeSplash } from '../../lib/capacitor/hideNativeSplash.js';
import {
  WALLET_SPLASH_DURATION_MS,
  hasSeenWalletBrandSplash,
  markWalletBrandSplashSeen,
} from '../../lib/wallet/walletBrandSplash.js';
import { resolveOfficeSplashBrand } from '../../lib/wallet/officeSplashBrand.js';
import { fetchSiteAppearance } from '../../services/siteAppearanceApi.js';
import { getDriverSession } from '../../lib/driver/driverSession.js';
import { getWalletTenantId } from '../../lib/wallet/walletTenantSeal.js';
import WalletBrandSplash from './WalletBrandSplash.jsx';

/** Absolute ceiling so splash never blocks the role router forever. */
const SPLASH_FAILSAFE_MS = WALLET_SPLASH_DURATION_MS + 2800;

/**
 * Capacitor cold start: office-logo splash (when brand loads), then role home.
 * Skipped for website and legacy driver-only APK.
 */
export default function WalletNativeSplashGate({ children }) {
  const skip = !isNativeApp() || isNativeDriverApp();

  const [showSplash, setShowSplash] = useState(() => {
    if (skip) return false;
    return !hasSeenWalletBrandSplash();
  });
  const [officeLogoUrl, setOfficeLogoUrl] = useState('');
  const [officeName, setOfficeName] = useState('');

  useEffect(() => {
    void hideNativeSplash();
  }, [showSplash, skip]);

  useEffect(() => {
    if (skip || !showSplash) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const driverTid = String(getDriverSession()?.tenantId || '').trim();
        const sealedTid = String(getWalletTenantId() || '').trim();
        const tenantId = driverTid || sealedTid;
        const appearance = await fetchSiteAppearance(
          tenantId ? { tenantId } : undefined,
        );
        if (cancelled) return;
        const brand = resolveOfficeSplashBrand(appearance);
        if (brand.hasLogo) setOfficeLogoUrl(brand.logoUrl);
        if (brand.name) setOfficeName(brand.name);
      } catch {
        /* keep PoreiaGo fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skip, showSplash]);

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
        officeLogoUrl={officeLogoUrl}
        officeName={officeName}
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
