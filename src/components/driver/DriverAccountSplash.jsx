import { useEffect, useState } from 'react';
import {
  WALLET_SPLASH_DURATION_MS,
} from '../../lib/wallet/walletBrandSplash.js';
import { resolveOfficeSplashBrand } from '../../lib/wallet/officeSplashBrand.js';
import { fetchSiteAppearance } from '../../services/siteAppearanceApi.js';
import '../../styles/wallet-brand-splash.css';

const SEEN_KEY = 'pg_driver_account_splash_v1';

function splashKey(driverId, tenantId) {
  return `${SEEN_KEY}:${String(tenantId || '')}:${String(driverId || '')}`;
}

export function hasSeenDriverAccountSplash(session) {
  if (typeof window === 'undefined' || !session?.driverId) return true;
  try {
    return sessionStorage.getItem(splashKey(session.driverId, session.tenantId)) === '1';
  } catch {
    return false;
  }
}

export function markDriverAccountSplashSeen(session) {
  if (typeof window === 'undefined' || !session?.driverId) return;
  try {
    sessionStorage.setItem(splashKey(session.driverId, session.tenantId), '1');
  } catch {
    /* ignore */
  }
}

/** Clear so the next login shows the office splash again. */
export function clearDriverAccountSplashSeen(session) {
  if (typeof window === 'undefined') return;
  try {
    if (session?.driverId) {
      sessionStorage.removeItem(splashKey(session.driverId, session.tenantId));
      return;
    }
    const prefix = `${SEEN_KEY}:`;
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Brief office-logo splash when the driver account home mounts (native / PWA).
 */
export default function DriverAccountSplash({ session, onDone }) {
  const [leaving, setLeaving] = useState(false);
  const [officeLogoUrl, setOfficeLogoUrl] = useState('');
  const [officeName, setOfficeName] = useState('');
  const driverName = String(session?.driverName || '').trim() || 'Οδηγός';

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    markDriverAccountSplashSeen(session);
    window.setTimeout(() => onDone?.(), 260);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tid = String(session?.tenantId || '').trim();
        const appearance = await fetchSiteAppearance(tid ? { tenantId: tid } : undefined);
        if (cancelled) return;
        const brand = resolveOfficeSplashBrand(appearance);
        if (brand.hasLogo) setOfficeLogoUrl(brand.logoUrl);
        if (brand.name) setOfficeName(brand.name);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.tenantId]);

  useEffect(() => {
    const t = window.setTimeout(finish, WALLET_SPLASH_DURATION_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  return (
    <div
      className={`pg-wallet-splash pg-wallet-splash--office pg-wallet-splash--driver${
        leaving ? ' pg-wallet-splash--out' : ''
      }`}
      role="dialog"
      aria-label={`${officeName || 'Εφαρμογή οδηγού'} — ${driverName}`}
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
        {officeLogoUrl ? (
          <div className="pg-wallet-splash-logo-wrap">
            <img
              src={officeLogoUrl}
              alt={officeName || 'Λογότυπο'}
              className="pg-wallet-splash-logo"
            />
          </div>
        ) : (
          <div className="pg-wallet-splash-logo-wrap pg-wallet-splash-logo-wrap--icon" aria-hidden>
            <span className="material-symbols-outlined">directions_bus</span>
          </div>
        )}
        {officeName ? <p className="pg-wallet-splash-office-name">{officeName}</p> : null}
        <hr className="pg-wallet-splash-rule" aria-hidden />
        <p className="pg-wallet-splash-hook">Καλώς ήρθες, {driverName}</p>
        <p className="pg-wallet-splash-support">
          Βάρδια, GPS και επιβάτες — έτοιμα στο κινητό σου.
        </p>
      </div>
      <p className="pg-wallet-splash-hint">Αγγίξτε για συνέχεια</p>
    </div>
  );
}
