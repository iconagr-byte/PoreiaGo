import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAdminSiteAppearance,
  fetchSiteAppearance,
  loadCachedSiteAppearance,
  resolveSiteAssetUrl,
} from '../../services/siteAppearanceApi.js';
import { officeLogoImageStyle, resolveOfficeBrand, clampLogoHeight } from '../../lib/branding/officeBrand.js';
import { isTenantStorefrontHost } from '../../lib/platform/tenantHost.js';
import { OFFICE_BRAND_CHANGED_EVENT } from '../admin/OfficeLogoChangeModal.jsx';

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
export default function OfficeBrandMark({
  className = '',
  variant = 'light',
  asLink = true,
  fallbackLabel = 'Γραφείο',
  refreshKey = 0,
  preferAdmin = false,
  /** Optional minimum height for admin sidebar / drawers (px). */
  minHeightPx,
}) {
  const [appearance, setAppearance] = useState({});
  const [brand, setBrand] = useState(() => resolveOfficeBrand({}));
  const [imgBroken, setImgBroken] = useState(false);
  const isDark = variant === 'dark';

  useEffect(() => {
    let cancelled = false;
    const apply = (raw) => {
      const next = mergeWithCachedLogo(normalizeAppearance(raw));
      setAppearance(next);
      setBrand(resolveOfficeBrand(next));
      setImgBroken(false);
    };
    const load = () => {
      const loader = preferAdmin ? fetchAdminSiteAppearance() : fetchSiteAppearance();
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
    window.addEventListener(OFFICE_BRAND_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFICE_BRAND_CHANGED_EVENT, onChanged);
    };
  }, [refreshKey, preferAdmin]);

  const logoSrc = !imgBroken && brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const onTenant = isTenantStorefrontHost();
  const label = brand.displayName || brand.name || fallbackLabel || (onTenant ? 'Γραφείο' : 'PoreiaGo');
  const resolvedHeight =
    minHeightPx != null
      ? Math.max(clampLogoHeight(appearance.logo_height_px), clampLogoHeight(minHeightPx))
      : undefined;
  const logoStyle = officeLogoImageStyle(
    resolvedHeight != null ? { ...appearance, logo_height_px: resolvedHeight } : appearance,
  );

  const inner = logoSrc ? (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoSrc}
        alt={label || 'Logo'}
        style={logoStyle}
        className="object-contain"
        onError={() => setImgBroken(true)}
      />
      {brand.showName && (
        <span className={`font-bold tracking-tight text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {brand.displayName || brand.name}
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
          minHeightPx != null ? 'h-11 w-11 text-sm' : 'h-8 w-8'
        } ${isDark ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'}`}
      >
        {(label || 'Γ').charAt(0).toUpperCase()}
      </span>
      <span className={minHeightPx != null ? 'text-lg' : 'text-base'}>{label}</span>
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to="/" className="inline-flex shrink-0 hover:opacity-90 transition-opacity" aria-label={label || 'Αρχική'}>
      {inner}
    </Link>
  );
}
