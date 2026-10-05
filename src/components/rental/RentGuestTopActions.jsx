import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRentLang, setRentLang } from '../../lib/rental/rentI18n.js';
import { markPreferRentLookup } from '../../lib/rental/preferRentLookup.js';

const QUICK_NAV = [
  { id: 'rent-guest-search', el: 'Αναζήτηση', en: 'Search' },
  { id: 'rent-guest-fleet', el: 'Στόλος', en: 'Fleet' },
  { id: 'rent-guest-how', el: 'Πώς κλείνεις', en: 'How it works' },
];

const NAV_ITEMS = [
  { id: 'rent-guest-search', el: 'Αναζήτηση', en: 'Search', icon: 'search' },
  { id: 'rent-guest-fleet', el: 'Στόλος', en: 'Fleet', icon: 'directions_car' },
  { id: 'rent-guest-how', el: 'Πώς κλείνεις', en: 'How it works', icon: 'route' },
  { id: 'rent-guest-services', el: 'Υπηρεσίες', en: 'Services', icon: 'verified_user' },
];

function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: id === 'rent-guest-search' ? 'center' : 'start' });
}

/**
 * Guest header — Menu (left, beside brand) + quick links / lang / Sign in / My Wallet.
 * Pass `brand` to place the logo immediately after the menu control.
 * My Wallet always opens /rent/wallet — never bus /my-booking.
 */
export default function RentGuestTopActions({
  brand = null,
  onAccount,
  onFindVehicle,
  phone = '',
} = {}) {
  const [lang, setLang] = useState(() => getRentLang());
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);
  const menuBtnRef = useRef(null);
  const tel = phoneHref(phone);

  useEffect(() => {
    markPreferRentLookup();
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuBtnRef.current?.focus?.();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const el = lang !== 'en';
  const menuLabel = el ? 'Μενού' : 'Menu';
  const bookingLabel = el ? 'Η κράτησή μου' : 'My booking';
  const findLabel = el ? 'Βρες όχημα' : 'Find a car';
  const walletLabel = 'My Wallet';
  const loginLabel = el ? 'Είσοδος' : 'Sign in';
  const registerLabel = el ? 'Εγγραφή' : 'Register';
  const walletTitle = el ? 'My Wallet ενοικιάσεων' : 'Rent My Wallet';
  const supportLabel = el ? 'Κλήση' : 'Call';
  const checkInHint = 'Online check-in';
  const browseKicker = el ? 'Περιήγηση' : 'Browse';
  const accountKicker = el ? 'Λογαριασμός' : 'Account';

  const switchLang = (next) => {
    const value = setRentLang(next);
    setLang(value);
    try {
      window.dispatchEvent(new Event('rent-lang-change'));
    } catch {
      /* ignore */
    }
  };

  const close = () => setMenuOpen(false);

  const goSection = (id) => {
    close();
    scrollToSection(id);
  };

  const menu = (
    <div className="rent-top-chip-wrap rent-top-chip-wrap--left" ref={rootRef}>
      <button
        ref={menuBtnRef}
        type="button"
        className={`rent-top-chip rent-top-chip--menu${menuOpen ? ' is-open' : ''}`}
        aria-label={menuLabel}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title={menuLabel}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span className="material-symbols-outlined" aria-hidden>
          {menuOpen ? 'close' : 'menu'}
        </span>
        <span className="rent-top-chip-label">{menuLabel}</span>
      </button>
      {menuOpen ? (
        <div className="rent-top-menu rent-top-menu--guest rent-top-menu--left" role="menu">
          <p className="rent-top-menu-kicker">{browseKicker}</p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="rent-top-menu-item"
              onClick={() => goSection(item.id)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                {item.icon}
              </span>
              {el ? item.el : item.en}
            </button>
          ))}

          <div className="rent-top-menu-sep" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="rent-top-menu-item"
            onClick={() => {
              close();
              if (typeof onFindVehicle === 'function') onFindVehicle();
              else scrollToSection('rent-guest-search');
            }}
          >
            <span className="material-symbols-outlined" aria-hidden>
              travel_explore
            </span>
            {findLabel}
          </button>
          <a
            href="/rent/my-booking"
            role="menuitem"
            className="rent-top-menu-item"
            onClick={close}
          >
            <span className="material-symbols-outlined" aria-hidden>
              confirmation_number
            </span>
            {bookingLabel}
          </a>
          <span className="rent-top-menu-item rent-top-menu-item--static" role="menuitem">
            <span className="rent-top-trust-dot" aria-hidden />
            {checkInHint}
          </span>
          {tel ? (
            <a href={tel} role="menuitem" className="rent-top-menu-item" onClick={close}>
              <span className="material-symbols-outlined" aria-hidden>
                call
              </span>
              {supportLabel}
            </a>
          ) : null}

          <div className="rent-top-menu-sep" role="separator" />
          <p className="rent-top-menu-kicker">{accountKicker}</p>
          <button
            type="button"
            role="menuitem"
            className="rent-top-menu-item"
            onClick={() => {
              close();
              onAccount?.();
            }}
          >
            <span className="material-symbols-outlined" aria-hidden>
              login
            </span>
            {loginLabel}
          </button>
          <Link
            to="/rent/register"
            role="menuitem"
            className="rent-top-menu-item"
            state={{ from: { pathname: '/rent/wallet' }, rentEntrance: true }}
            onClick={close}
          >
            <span className="material-symbols-outlined" aria-hidden>
              person_add
            </span>
            {registerLabel}
          </Link>

          <a href="/rent/wallet" role="menuitem" className="rent-top-menu-cta" onClick={close}>
            <span className="material-symbols-outlined" aria-hidden>
              account_balance_wallet
            </span>
            {walletLabel}
          </a>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="rent-topbar-start">
        {menu}
        {brand}
      </div>

      <div className="rent-top-actions">
        <nav className="rent-top-quick" aria-label={el ? 'Γρήγορη πλοήγηση' : 'Quick navigation'}>
          {QUICK_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="rent-top-quick-link"
              onClick={() => scrollToSection(item.id)}
            >
              {el ? item.el : item.en}
            </button>
          ))}
        </nav>

        <div className="rent-top-lang" role="group" aria-label={el ? 'Γλώσσα' : 'Language'}>
          <button
            type="button"
            className={lang === 'el' ? 'is-active' : ''}
            aria-pressed={lang === 'el'}
            onClick={() => switchLang('el')}
          >
            ΕΛ
          </button>
          <button
            type="button"
            className={lang === 'en' ? 'is-active' : ''}
            aria-pressed={lang === 'en'}
            onClick={() => switchLang('en')}
          >
            EN
          </button>
        </div>

        {tel ? (
          <a
            href={tel}
            className="rent-top-icon-btn rent-top-icon-btn--soft"
            aria-label={supportLabel}
            title={supportLabel}
          >
            <span className="material-symbols-outlined" aria-hidden>
              call
            </span>
          </a>
        ) : null}

        <button
          type="button"
          className="rent-top-icon-btn rent-top-icon-btn--soft"
          aria-label={loginLabel}
          title={loginLabel}
          onClick={() => onAccount?.()}
        >
          <span className="material-symbols-outlined" aria-hidden>
            person
          </span>
        </button>

        <a
          href="/rent/wallet"
          className="rent-top-chip rent-top-chip--wallet"
          title={walletTitle}
          aria-label={walletTitle}
        >
          <span className="material-symbols-outlined" aria-hidden>
            account_balance_wallet
          </span>
          <span className="rent-top-chip-wallet-label">{walletLabel}</span>
        </a>
      </div>
    </>
  );
}
