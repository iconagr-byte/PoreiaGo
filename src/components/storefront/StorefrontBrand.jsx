import { Link } from 'react-router-dom';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

export default function StorefrontBrand({ siteAppearance, variant = 'dark', className = '' }) {
  const isDark = variant === 'dark';
  const logoUrl = siteAppearance?.logo_url ? resolveSiteAssetUrl(siteAppearance.logo_url) : '';
  const name = siteAppearance?.footer_brand_name || 'PoreiaGo';

  return (
    <Link
      to="/storefront"
      className={`inline-flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity ${className}`}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-10 w-auto max-w-[160px] object-contain" />
      ) : (
        <>
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm shadow-lg ${
              isDark
                ? 'bg-gradient-to-br from-sky-400 to-indigo-600 text-white'
                : 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white'
            }`}
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="flex flex-col leading-none">
            <span className={`font-bold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {name}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.14em] mt-0.5 ${
                isDark ? 'text-white/50' : 'text-slate-500'
              }`}
            >
              Travel
            </span>
          </span>
        </>
      )}
    </Link>
  );
}
