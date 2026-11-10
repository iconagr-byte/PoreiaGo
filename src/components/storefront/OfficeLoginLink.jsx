import { Link } from 'react-router-dom';
import { isTenantStorefrontHost } from '../../lib/platform/tenantHost.js';

/**
 * Staff / office backoffice entry for tenant storefronts.
 * Only in discreet footers — never a prominent customer CTA.
 * Target: /admin/login on the office host.
 */
export default function OfficeLoginLink({
  variant = 'light',
  density = 'footer',
  onNavigate,
  className = '',
}) {
  if (typeof window !== 'undefined' && !isTenantStorefrontHost()) {
    return null;
  }

  const isDark = variant === 'dark';
  // Footer / quiet: plain text link. Header density kept for rare reuse.
  const isHeader = density === 'header';

  const base = isHeader
    ? isDark
      ? 'group inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'
      : 'group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500'
    : isDark
      ? 'inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-white/45 transition hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40'
      : 'inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-slate-400 transition hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400';

  return (
    <Link
      to="/admin/login"
      onClick={onNavigate}
      className={`${base} ${className}`.trim()}
      title="Είσοδος διαχείρισης γραφείου"
    >
      <span
        className={`material-symbols-outlined ${isHeader ? 'text-[18px]' : 'text-[14px] opacity-70'}`}
        aria-hidden
      >
        badge
      </span>
      <span>Είσοδος γραφείου</span>
    </Link>
  );
}
