import { Link } from 'react-router-dom';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { officeLogoImageStyle, resolveOfficeBrand } from '../../lib/branding/officeBrand.js';

export default function StorefrontBrand({ siteAppearance, variant = 'dark', className = '' }) {
  const isDark = variant === 'dark';
  const brand = resolveOfficeBrand(siteAppearance);
  const logoUrl = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const logoStyle = officeLogoImageStyle(siteAppearance);
  const isGeneric = !brand.displayName;
  const name = brand.displayName || brand.name;

  return (
    <Link
      to="/"
      className={`group inline-flex items-center gap-2.5 shrink-0 transition-opacity hover:opacity-95 ${className}`}
      aria-label={name}
    >
      {logoUrl ? (
        <>
          <img src={logoUrl} alt="" style={logoStyle} className="object-contain" />
          {brand.showName && (
            <span
              className={`font-bold text-[17px] leading-none tracking-[-0.02em] ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {brand.displayName}
            </span>
          )}
        </>
      ) : (
        <>
          <span
            className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[12px] text-[15px] font-bold tracking-tight shadow-[0_8px_20px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-[1.03] ${
              isDark
                ? 'bg-gradient-to-br from-sky-400 via-cyan-500 to-teal-700 text-white'
                : 'bg-gradient-to-br from-sky-500 via-cyan-600 to-teal-800 text-white'
            }`}
            aria-hidden
          >
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
            <span className="relative">{name.charAt(0).toUpperCase()}</span>
          </span>
          <span className="min-w-0">
            <span
              className={`block truncate text-[17px] font-bold leading-none tracking-[-0.02em] ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {name}
            </span>
            {isGeneric ? (
              <span
                className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.08em] ${
                  isDark ? 'text-white/55' : 'text-slate-500'
                }`}
              >
                Ταξιδιωτικό γραφείο
              </span>
            ) : null}
          </span>
        </>
      )}
    </Link>
  );
}
