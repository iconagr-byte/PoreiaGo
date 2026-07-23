import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSiteAppearance, resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { resolveOfficeBrand } from '../../lib/branding/officeBrand.js';
import { isTenantStorefrontHost } from '../../lib/platform/tenantHost.js';

/**
 * Office wordmark for headers — never shows PoreiaGo platform gold logo on tenant sites.
 */
export default function OfficeBrandMark({
  className = '',
  variant = 'light',
  asLink = true,
  fallbackLabel = 'Γραφείο',
}) {
  const [brand, setBrand] = useState(() => resolveOfficeBrand({}));
  const isDark = variant === 'dark';

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((appearance) => {
        if (!cancelled) setBrand(resolveOfficeBrand(appearance));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const logoSrc = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const onTenant = isTenantStorefrontHost();
  // Tenant sites: office name or «Γραφείο». Platform admin: PoreiaGo text only (never gold SVG).
  const label = brand.displayName || (onTenant ? fallbackLabel : 'PoreiaGo');

  const inner = logoSrc ? (
    <img
      src={logoSrc}
      alt={label || 'Logo'}
      className={`h-8 w-auto max-w-[180px] object-contain ${className}`}
    />
  ) : (
    <span
      className={`inline-flex items-center gap-2 font-bold tracking-tight ${
        isDark ? 'text-white' : 'text-slate-900'
      } ${className}`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
          isDark ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'
        }`}
      >
        {(label || 'Γ').charAt(0).toUpperCase()}
      </span>
      <span className="text-base">{label}</span>
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to="/" className="inline-flex shrink-0 hover:opacity-90 transition-opacity" aria-label={label || 'Αρχική'}>
      {inner}
    </Link>
  );
}
