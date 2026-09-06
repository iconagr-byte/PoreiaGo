import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCustomerToken, isCustomer } from '../../lib/auth.js';
import StorefrontBrand from './StorefrontBrand.jsx';
import OfficeLoginLink from './OfficeLoginLink.jsx';
import { isTenantStorefrontHost } from '../../lib/platform/tenantHost.js';

const HEADER_STYLES = {
  glass_dark: {
    wrap: 'fixed top-0 w-full z-50 border-b transition-[background-color,border-color,box-shadow] duration-300',
    wrapTop: 'border-white/10 bg-slate-950/35 backdrop-blur-lg',
    wrapScrolled: 'border-white/15 bg-slate-950/85 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.25)]',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-20 flex items-center justify-between gap-4',
    variant: 'dark',
    demoOffset: 'top-20',
  },
  solid_light: {
    wrap: 'fixed top-0 w-full z-50 border-b transition-[background-color,box-shadow] duration-300',
    wrapTop: 'border-black/[0.06] bg-white/95 backdrop-blur-md',
    wrapScrolled: 'border-black/[0.08] bg-white shadow-md',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-20 flex items-center justify-between gap-4',
    variant: 'light',
    demoOffset: 'top-20',
  },
  transparent_minimal: {
    wrap: 'fixed top-0 w-full z-50 transition-[background-color,border-color] duration-300 border-b',
    wrapTop: 'border-transparent bg-transparent',
    wrapScrolled: 'border-white/10 bg-slate-950/80 backdrop-blur-xl',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-16 flex items-center justify-between gap-4',
    variant: 'dark',
    demoOffset: 'top-16',
  },
  bordered_elegant: {
    wrap: 'fixed top-0 w-full z-50 bg-white border-b-2 border-slate-200',
    wrapTop: '',
    wrapScrolled: 'shadow-sm',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-[72px] flex items-center justify-between gap-4',
    variant: 'light',
    demoOffset: 'top-[72px]',
  },
  floating_pill: {
    wrap: 'fixed top-4 left-0 right-0 z-50 px-4 md:px-8 pointer-events-none',
    wrapTop: '',
    wrapScrolled: '',
    inner:
      'max-w-3xl mx-auto h-14 px-6 flex items-center justify-between gap-4 rounded-full bg-white/90 backdrop-blur-xl shadow-lg border border-black/[0.06] pointer-events-auto',
    variant: 'light',
    demoOffset: 'top-24',
  },
  gradient_bar: {
    wrap: 'fixed top-0 w-full z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 shadow-lg',
    wrapTop: '',
    wrapScrolled: '',
    inner: 'max-w-container-max mx-auto px-margin-desktop h-16 flex items-center justify-between gap-4',
    variant: 'dark',
    demoOffset: 'top-16',
  },
};

export function getHeaderDemoOffset(templateId) {
  return HEADER_STYLES[templateId]?.demoOffset || HEADER_STYLES.glass_dark.demoOffset;
}

function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function hasWalletSession() {
  return Boolean(isCustomer() && getCustomerToken());
}

export default function StorefrontHeader({
  siteAppearance,
  templateId = 'glass_dark',
  tripsEnabled = true,
  rentEnabled = false,
}) {
  const style = HEADER_STYLES[templateId] || HEADER_STYLES.glass_dark;
  const isDark = style.variant === 'dark';
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletReady, setWalletReady] = useState(() =>
    typeof window !== 'undefined' ? hasWalletSession() : false,
  );

  const phone = String(siteAppearance?.footer_contact_phone || '').trim();
  const showFleet = tripsEnabled && siteAppearance?.show_fleet_section !== false;
  const tel = phoneHref(phone);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sync = () => setWalletReady(hasWalletSession());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navLink = isDark
    ? 'text-sm font-semibold text-white/80 hover:text-white transition-colors'
    : 'text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors';

  const walletCta = isDark
    ? 'inline-flex items-center gap-1.5 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-bold shadow-sm hover:bg-white/90 transition-colors'
    : 'inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors';

  const phoneLink = isDark
    ? 'hidden lg:inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white transition-colors'
    : 'hidden lg:inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors';

  const menuBtn = isDark
    ? 'md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white'
    : 'md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.08] bg-black/[0.03] text-slate-800';

  const showOfficeLogin =
    typeof window !== 'undefined' ? isTenantStorefrontHost() : false;

  const wrapClass = `${style.wrap} ${scrolled ? style.wrapScrolled : style.wrapTop}`.trim();

  const closeMenu = () => setMenuOpen(false);

  const walletLink = walletReady
    ? { to: '/wallet' }
    : { to: '/login', state: { from: '/wallet', walletClaim: true } };

  return (
    <header className={wrapClass}>
      <div className={style.inner}>
        <StorefrontBrand siteAppearance={siteAppearance} variant={style.variant} />

        <nav className="hidden md:flex items-center gap-4 lg:gap-5" aria-label="Κύριο μενού">
          {tripsEnabled ? (
            <a href="#search-results" className={navLink}>
              Εκδρομές
            </a>
          ) : null}
          {rentEnabled ? (
            <Link to="/rent" className={navLink}>
              Rent
            </Link>
          ) : null}
          {rentEnabled ? (
            <a href="#rent-services" className={navLink}>
              Υπηρεσίες
            </a>
          ) : null}
          {showFleet ? (
            <a href="#our-fleet" className={navLink}>
              Στόλος
            </a>
          ) : null}
          <a href="#contact" className={navLink}>
            Επικοινωνία
          </a>
          {tripsEnabled ? (
            <Link to="/my-booking" className={navLink}>
              Η κράτησή μου
            </Link>
          ) : null}
          {tel ? (
            <a href={tel} className={phoneLink} aria-label={`Τηλέφωνο ${phone}`}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                call
              </span>
              <span className="tabular-nums tracking-tight">{phone}</span>
            </a>
          ) : null}
          {showOfficeLogin ? (
            <OfficeLoginLink variant={style.variant} density="header" />
          ) : null}
          <Link
            to={walletLink.to}
            state={walletLink.state}
            className={walletCta}
            title={walletReady ? 'Άνοιγμα My Wallet' : 'Σύνδεση στο My Wallet'}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              account_balance_wallet
            </span>
            My Wallet
          </Link>
        </nav>

        <div className="flex md:hidden items-center gap-2">
          {showOfficeLogin ? (
            <OfficeLoginLink
              variant={style.variant}
              density="header"
              className="!px-2.5 !py-1.5 !text-xs !gap-1"
            />
          ) : null}
          <Link
            to={walletLink.to}
            state={walletLink.state}
            className={`${walletCta} !px-3 !py-1.5 !text-xs`}
            aria-label="My Wallet"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              account_balance_wallet
            </span>
            Wallet
          </Link>
          <button
            type="button"
            className={menuBtn}
            aria-expanded={menuOpen}
            aria-controls="storefront-mobile-menu"
            aria-label={menuOpen ? 'Κλείσιμο μενού' : 'Άνοιγμα μενού'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden>
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="storefront-mobile-menu"
          className={`md:hidden border-t ${
            isDark ? 'border-white/10 bg-slate-950/95 text-white' : 'border-black/[0.06] bg-white text-slate-900'
          }`}
        >
          <nav className="max-w-container-max mx-auto px-margin-desktop py-4 flex flex-col gap-1" aria-label="Μενού κινητού">
            {tripsEnabled ? (
              <a href="#search-results" onClick={closeMenu} className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-black/5">
                Εκδρομές
              </a>
            ) : null}
            {rentEnabled ? (
              <Link to="/rent" onClick={closeMenu} className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-black/5">
                Rent
              </Link>
            ) : null}
            {rentEnabled ? (
              <a href="#rent-services" onClick={closeMenu} className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-black/5">
                Υπηρεσίες
              </a>
            ) : null}
            {showFleet ? (
              <a href="#our-fleet" onClick={closeMenu} className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-black/5">
                Στόλος
              </a>
            ) : null}
            <a href="#contact" onClick={closeMenu} className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-black/5">
              Επικοινωνία
            </a>
            {tel ? (
              <a href={tel} onClick={closeMenu} className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-black/5 inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  call
                </span>
                {phone}
              </a>
            ) : null}
            <Link
              to={walletLink.to}
              state={walletLink.state}
              onClick={closeMenu}
              className="rounded-xl px-3 py-3 text-sm font-bold hover:bg-black/5 inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                account_balance_wallet
              </span>
              My Wallet
            </Link>
            {tripsEnabled ? (
              <Link
                to="/my-booking"
                onClick={closeMenu}
                className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-black/5"
              >
                Η κράτησή μου
              </Link>
            ) : null}
            {showOfficeLogin ? (
              <div className="pt-2 mt-1 border-t border-black/[0.06]">
                <OfficeLoginLink
                  variant={isDark ? 'dark' : 'light'}
                  density="header"
                  onNavigate={closeMenu}
                  className="w-full justify-center"
                />
              </div>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
