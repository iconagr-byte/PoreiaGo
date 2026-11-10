import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAdminSiteAppearance,
  fetchSiteAppearance,
  loadCachedSiteAppearance,
  resolveSiteAssetUrl,
} from '../../services/siteAppearanceApi.js';
import {
  officeLogoImageStyle,
  resolveOfficeBrand,
  clampLogoHeight,
} from '../../lib/branding/officeBrand.js';
import { isTenantStorefrontHost } from '../../lib/platform/tenantHost.js';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';
import { OFFICE_BRAND_CHANGED_EVENT } from '../admin/OfficeLogoChangeModal.jsx';
import { WALLET_TENANT_CHANGED_EVENT } from '../../lib/wallet/walletTenantSeal.js';

function normalizeAppearance(data) {
  if (
    data?.data &&
    typeof data.data === 'object' &&
    !data.footer_brand_name &&
    !data.logo_url
  ) {
    return data.data;
  }
  return data || {};
}

function isOfficeUploadLogo(url) {
  const value = String(url || '').trim();
  return (
    value.startsWith('/api/site/office-assets/') ||
    value.startsWith('/api/site/assets/') ||
    value.startsWith('data:image/')
  );
}

/**
 * Prefer server appearance, but keep a freshly uploaded office logo from cache
 * when the GET still returns empty (persist lag / scrub race).
 */
function mergeWithCachedLogo(serverAppearance = {}) {
  const next = { ...serverAppearance };
  if (isOfficeUploadLogo(next.logo_url)) return next;
  const cached = loadCachedSiteAppearance() || {};
  if (isOfficeUploadLogo(cached.logo_url)) {
    next.logo_url = cached.logo_url;
    if (cached.tenant_slug && !next.tenant_slug) next.tenant_slug = cached.tenant_slug;
  }
  return next;
}

/**
 * Office wordmark for headers — never shows PoreiaGo platform gold logo on tenant sites.
 *
 * preferAdmin: use JWT/tenant appearance (BackOffice sidebar). Public host fetch can
 * miss postgres branding when the admin UI runs on the platform domain.
 */
function isGenericOfficeLabel(value) {
  const v = String(value || '').trim();
  return (
    !v ||
    v === 'Γραφείο' ||
    v === 'PoreiaGo' ||
    v === 'My Wallet' ||
    /^aerostride$/i.test(v)
  );
}

export default function OfficeBrandMark({
  className = '',
  variant = 'light',
  asLink = true,
  fallbackLabel = 'Γραφείο',
  /**
   * Preferred office name from the parent (wallet already resolved branding).
   * Wins over appearance generics so compact/native top bars always show text.
   */
  officeName = '',
  refreshKey = 0,
  preferAdmin = false,
  /** Sealed wallet office UUID — Capacitor Host=localhost needs this for logo. */
  tenantId = '',
  /** Optional minimum height for admin sidebar / drawers (px). */
  minHeightPx,
  /**
   * Mobile / Capacitor top bar: cap logo so website header sizes (48–96px)
   * do not overflow the wallet chrome. Native always uses compact.
   */
  compact = false,
}) {
  const [appearance, setAppearance] = useState({});
  const [brand, setBrand] = useState(() => resolveOfficeBrand({}));
  const [imgBroken, setImgBroken] = useState(false);
  const isDark = variant === 'dark';
  const sealedTenantId = String(tenantId || '').trim();
  const useCompact = Boolean(compact) || isNativeApp();

  useEffect(() => {
    let cancelled = false;
    const apply = (raw) => {
      const next = mergeWithCachedLogo(normalizeAppearance(raw));
      setAppearance(next);
      setBrand(resolveOfficeBrand(next));
      setImgBroken(false);
    };
    const load = () => {
      const loader = preferAdmin
        ? fetchAdminSiteAppearance()
        : fetchSiteAppearance(sealedTenantId ? { tenantId: sealedTenantId } : undefined);
      loader
        .then((data) => {
          if (cancelled) return;
          apply(data);
        })
        .catch(() => {
          if (cancelled) return;
          const cached = loadCachedSiteAppearance();
          if (cached) apply(cached);
        });
    };
    load();
    const onChanged = (event) => {
      const patch = event?.detail;
      if (patch && typeof patch === 'object') {
        setAppearance((prev) => {
          const next = mergeWithCachedLogo({ ...prev, ...patch });
          setBrand(resolveOfficeBrand(next));
          setImgBroken(false);
          return next;
        });
      }
      // Re-fetch so Postgres wins once persist completes.
      load();
    };
    const onWalletTenant = () => load();
    window.addEventListener(OFFICE_BRAND_CHANGED_EVENT, onChanged);
    window.addEventListener(WALLET_TENANT_CHANGED_EVENT, onWalletTenant);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFICE_BRAND_CHANGED_EVENT, onChanged);
      window.removeEventListener(WALLET_TENANT_CHANGED_EVENT, onWalletTenant);
    };
  }, [refreshKey, preferAdmin, sealedTenantId]);

  const logoSrc = !imgBroken && brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const onTenant = isTenantStorefrontHost();
  // Prefer parent officeName (wallet seal) → appearance → fallbackLabel.
  const propOfficeName = String(officeName || '').trim();
  const resolvedName =
    (!isGenericOfficeLabel(propOfficeName) ? propOfficeName : '') ||
    brand.displayName ||
    (!isGenericOfficeLabel(brand.name) ? brand.name : '');
  const label =
    resolvedName ||
    (!isGenericOfficeLabel(fallbackLabel) ? fallbackLabel : '') ||
    brand.name ||
    (onTenant ? 'Γραφείο' : 'PoreiaGo');
  const resolvedHeight =
    !useCompact && minHeightPx != null
      ? Math.max(clampLogoHeight(appearance.logo_height_px), clampLogoHeight(minHeightPx))
      : undefined;
  const logoStyle = officeLogoImageStyle(
    resolvedHeight != null ? { ...appearance, logo_height_px: resolvedHeight } : appearance,
    { compact: useCompact },
  );
  // Respect admin «εμφάνιση ονόματος» (default on). Compact wallet used to hide
  // the name whenever a logo image existed — customers only saw an icon mark.
  const nameOptOut = appearance.logo_show_name === false;
  const showName = !nameOptOut && !isGenericOfficeLabel(label);

  const compactLogoStyle =
    useCompact && showName
      ? {
          ...logoStyle,
          height: '28px',
          maxHeight: '28px',
          maxWidth: '72px',
        }
      : logoStyle;

  const inner = logoSrc ? (
    <span
      className={`inline-flex items-center min-w-0 ${useCompact ? 'gap-1.5' : 'gap-2'} ${className}`}
    >
      <img
        src={logoSrc}
        alt={label || 'Logo'}
        style={compactLogoStyle}
        className={`object-contain shrink-0${useCompact ? ' office-brand-mark__logo--compact' : ''}${
          useCompact && showName ? ' office-brand-mark__logo--with-name' : ''
        }`}
        onError={() => setImgBroken(true)}
      />
      {showName && (
        <span
          className={`font-bold tracking-tight truncate min-w-0 ${
            useCompact ? 'text-[0.8125rem] leading-tight max-w-[9.5rem]' : 'text-base'
          } ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          {label}
        </span>
      )}
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-2 font-bold tracking-tight ${
        isDark ? 'text-white' : 'text-slate-900'
      } ${className}`}
    >
      <span
        className={`flex items-center justify-center rounded-lg text-xs font-bold ${
          useCompact
            ? 'h-7 w-7 text-[11px]'
            : minHeightPx != null
              ? 'h-11 w-11 text-sm'
              : 'h-8 w-8'
        } ${isDark ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'}`}
      >
        {(label || 'Γ').charAt(0).toUpperCase()}
      </span>
      <span
        className={
          useCompact ? 'text-sm truncate max-w-[9rem]' : minHeightPx != null ? 'text-lg' : 'text-base'
        }
      >
        {label}
      </span>
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to="/" className="inline-flex shrink-0 hover:opacity-90 transition-opacity" aria-label={label || 'Αρχική'}>
      {inner}
    </Link>
  );
}
