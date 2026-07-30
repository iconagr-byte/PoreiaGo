import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAdminSiteAppearance,
  fetchSiteAppearance,
  resolveSiteAssetUrl,
} from '../../services/siteAppearanceApi.js';
import { officeLogoImageStyle, resolveOfficeBrand } from '../../lib/branding/officeBrand.js';
import { isTenantStorefrontHost } from '../../lib/platform/tenantHost.js';
import { OFFICE_BRAND_CHANGED_EVENT } from '../admin/OfficeLogoChangeModal.jsx';

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
}) {
  const [appearance, setAppearance] = useState({});
  const [brand, setBrand] = useState(() => resolveOfficeBrand({}));
  const isDark = variant === 'dark';

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const loader = preferAdmin ? fetchAdminSiteAppearance() : fetchSiteAppearance();
      loader
        .then((data) => {
          if (cancelled) return;
          // fetchAdminSiteAppearance may return a nested `{ data }` from older callers —
          // normalise to the appearance object.
          const next =
            data?.data && typeof data.data === 'object' && !data.footer_brand_name && !data.logo_url
              ? data.data
              : data || {};
          setAppearance(next);
          setBrand(resolveOfficeBrand(next));
        })
        .catch(() => {});
    };
    load();
    const onChanged = () => load();
    window.addEventListener(OFFICE_BRAND_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFICE_BRAND_CHANGED_EVENT, onChanged);
    };
  }, [refreshKey, preferAdmin]);

  const logoSrc = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const onTenant = isTenantStorefrontHost();
  const label = brand.displayName || brand.name || fallbackLabel || (onTenant ? 'Γραφείο' : 'PoreiaGo');
  const logoStyle = officeLogoImageStyle(appearance);

  const inner = logoSrc ? (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={logoSrc} alt={label || 'Logo'} style={logoStyle} className="object-contain" />
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
