import { Link } from 'react-router-dom';
import { isTenantStorefrontHost } from '../../lib/platform/tenantHost.js';

/**
 * Staff / office backoffice entry — shown on tenant storefronts (e.g. Achillio Travel).
 * Kept out of PoreiaGo marketing so the SaaS homepage stays product-first.
 */
export default function OfficeLoginLink({
  variant = 'dark',
  density = 'header',
  onNavigate,
  className = '',
}) {
  if (typeof window !== 'undefined' && !isTenantStorefrontHost()) {
    return null;
  }

  const isDark = variant === 'dark';
  const isHeader = density === 'header';

  const base = isHeader
    ? isDark
      ? 'group inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition duration-300 hover:border-white/45 hover:bg-white/18 hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'
      : 'group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-800 shadow-sm transition duration-300 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500'
    : isDark
      ? 'inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/12 hover:text-white'
      : 'inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-black/[0.12] hover:text-slate-900';

  return (
    <Link
      to="/admin/login"
      onClick={onNavigate}
      className={`${base} ${className}`.trim()}
      title="Σύνδεση διαχείρισης γραφείου"
    >
      <span
        className={`material-symbols-outlined ${isHeader ? 'text-[18px]' : 'text-[16px]'} ${
          isHeader ? 'transition-transform duration-300 group-hover:scale-110' : ''
        }`}
        aria-hidden
      >
        badge
      </span>
      <span className="tracking-tight">Σύνδεση γραφείου</span>
      {isHeader ? (
        <span
          className={`material-symbols-outlined text-[16px] opacity-70 transition-transform duration-300 group-hover:translate-x-0.5 ${
            isDark ? 'text-white/80' : 'text-slate-500'
          }`}
          aria-hidden
        >
          arrow_forward
        </span>
      ) : null}
    </Link>
  );
}
