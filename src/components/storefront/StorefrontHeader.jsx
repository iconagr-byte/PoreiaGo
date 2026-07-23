import { Link } from 'react-router-dom';
import StorefrontBrand from './StorefrontBrand.jsx';

const HEADER_STYLES = {
  glass_dark: {
    wrap: 'fixed top-0 w-full z-50 border-b border-white/10 bg-slate-950/40 backdrop-blur-lg',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-20 flex items-center justify-between gap-4',
    variant: 'dark',
    demoOffset: 'top-20',
  },
  solid_light: {
    wrap: 'fixed top-0 w-full z-50 border-b border-black/[0.06] bg-white/95 backdrop-blur-md shadow-sm',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-20 flex items-center justify-between gap-4',
    variant: 'light',
    demoOffset: 'top-20',
  },
  transparent_minimal: {
    wrap: 'fixed top-0 w-full z-50 bg-transparent',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-16 flex items-center justify-between gap-4',
    variant: 'dark',
    demoOffset: 'top-16',
  },
  bordered_elegant: {
    wrap: 'fixed top-0 w-full z-50 bg-white border-b-2 border-slate-200',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-[72px] flex items-center justify-between gap-4',
    variant: 'light',
    demoOffset: 'top-[72px]',
  },
  floating_pill: {
    wrap: 'fixed top-4 left-0 right-0 z-50 px-4 md:px-8 pointer-events-none',
    inner:
      'max-w-3xl mx-auto h-14 px-6 flex items-center justify-between gap-4 rounded-full bg-white/90 backdrop-blur-xl shadow-lg border border-black/[0.06] pointer-events-auto',
    variant: 'light',
    demoOffset: 'top-24',
  },
  gradient_bar: {
    wrap: 'fixed top-0 w-full z-50 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 shadow-lg',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-16 flex items-center justify-between gap-4',
    variant: 'dark',
    demoOffset: 'top-16',
  },
};

export function getHeaderDemoOffset(templateId) {
  return HEADER_STYLES[templateId]?.demoOffset || HEADER_STYLES.glass_dark.demoOffset;
}

export default function StorefrontHeader({ siteAppearance, templateId = 'glass_dark' }) {
  const style = HEADER_STYLES[templateId] || HEADER_STYLES.glass_dark;
  const isDark = style.variant === 'dark';
  const navLink = isDark
    ? 'text-sm font-bold text-white/75 hover:text-white transition-colors'
    : 'text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors';
  const officeLink = isDark
    ? 'inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors'
    : 'inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-black/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-black/[0.06] hover:text-slate-800 transition-colors';

  return (
    <header className={style.wrap}>
      <div className={style.inner}>
        <StorefrontBrand siteAppearance={siteAppearance} variant={style.variant} />
        {/* Office public site — no platform back-link */}
        <nav className="flex items-center gap-3 sm:gap-4" aria-label="Κύριο μενού">
          <a href="#search-results" className={`hidden sm:inline ${navLink}`}>
            Εκδρομές
          </a>
          <Link to="/my-booking" className={navLink}>
            Η κράτησή μου
          </Link>
          <Link to="/admin/login" className={officeLink} title="Σύνδεση για το γραφείο">
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              admin_panel_settings
            </span>
            Σύνδεση γραφείου
          </Link>
        </nav>
      </div>
    </header>
  );
}
