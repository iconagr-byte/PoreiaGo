import { Link } from 'react-router-dom';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { resolveOfficeBrand } from '../../lib/branding/officeBrand.js';

export default function StorefrontBrand({ siteAppearance, variant = 'dark', className = '' }) {
  const isDark = variant === 'dark';
  const brand = resolveOfficeBrand(siteAppearance);
  const logoUrl = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';

  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity ${className}`}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={brand.name} className="h-10 w-auto max-w-[180px] object-contain" />
      ) : (
        <>
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm shadow-lg ${
              isDark
                ? 'bg-gradient-to-br from-sky-400 to-indigo-600 text-white'
                : 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white'
            }`}
          >
            {brand.name.charAt(0).toUpperCase()}
          </span>
          <span className={`font-bold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {brand.name}
          </span>
        </>
      )}
    </Link>
  );
}
