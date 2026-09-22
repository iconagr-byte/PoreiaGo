import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRentLang, setRentLang } from '../../lib/rental/rentI18n.js';
import { markPreferRentLookup } from '../../lib/rental/preferRentLookup.js';

function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

/**
 * Guest header — find booking / support / account / language / Rent My Wallet.
 * My Wallet always opens /rent/wallet — never bus /my-booking.
 */
export default function RentGuestTopActions({
  onAccount,
  onFindVehicle,
  phone = '',
} = {}) {
  const [lang, setLang] = useState(() => getRentLang());
  const [accountOpen, setAccountOpen] = useState(false);
  const rootRef = useRef(null);
  const tel = phoneHref(phone);

  useEffect(() => {
    markPreferRentLookup();
  }, []);

  useEffect(() => {
    if (!accountOpen) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [accountOpen]);

  const el = lang !== 'en';
  const bookingLabel = el ? 'Η κράτησή μου' : 'My booking';
  const findLabel = el ? 'Βρες όχημα' : 'Find a car';
  const walletLabel = 'My Wallet';
  const loginLabel = el ? 'Είσοδος' : 'Sign in';
  const registerLabel = el ? 'Εγγραφή' : 'Register';
  const accountAria = el ? 'Λογαριασμός' : 'Account';
  const walletTitle = el ? 'My Wallet ενοικιάσεων' : 'Rent My Wallet';
  const supportLabel = el ? 'Κλήση' : 'Call';
  const checkInHint = el ? 'Online check-in' : 'Online check-in';

  const switchLang = (next) => {
    const value = setRentLang(next);
    setLang(value);
    try {
      window.dispatchEvent(new Event('rent-lang-change'));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rent-top-actions" ref={rootRef}>
      <span className="rent-top-trust" title={checkInHint}>
        <span className="rent-top-trust-dot" aria-hidden />
        <span className="rent-top-trust-label">{checkInHint}</span>
      </span>

      {tel ? (
        <a
          href={tel}
          className="rent-top-chip rent-top-chip--ghost"
          title={el ? 'Τηλέφωνο γραφείου' : 'Office phone'}
        >
          <span className="material-symbols-outlined" aria-hidden>
            call
          </span>
          <span className="rent-top-chip-label">{supportLabel}</span>
        </a>
      ) : null}

      {typeof onFindVehicle === 'function' ? (
        <button
          type="button"
          className="rent-top-chip rent-top-chip--cta"
          onClick={onFindVehicle}
          title={findLabel}
        >
          <span className="material-symbols-outlined" aria-hidden>
            search
          </span>
          <span className="rent-top-chip-label">{findLabel}</span>
        </button>
      ) : null}

      <a
        href="/rent/my-booking"
        className="rent-top-chip"
        title={el ? 'Εύρεση κράτησης ενοικίασης' : 'Find rent booking'}
      >
        <span className="material-symbols-outlined" aria-hidden>
          confirmation_number
        </span>
        <span className="rent-top-chip-label">{bookingLabel}</span>
      </a>

      <div className="rent-top-chip-wrap">
        <button
          type="button"
          className={`rent-top-icon-btn${accountOpen ? ' is-open' : ''}`}
          aria-label={accountAria}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          title={accountAria}
          onClick={() => setAccountOpen((v) => !v)}
        >
          <span className="material-symbols-outlined" aria-hidden>
            person
          </span>
        </button>
        {accountOpen ? (
          <div className="rent-top-menu rent-top-menu--account" role="menu">
            <p className="rent-top-menu-kicker">{el ? 'Λογαριασμός Rent' : 'Rent account'}</p>
            <button
              type="button"
              role="menuitem"
              className="rent-top-menu-item"
              onClick={() => {
                setAccountOpen(false);
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
              onClick={() => setAccountOpen(false)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                person_add
              </span>
              {registerLabel}
            </Link>
            <a
              href="/rent/wallet"
              role="menuitem"
              className="rent-top-menu-item"
              onClick={() => setAccountOpen(false)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                account_balance_wallet
              </span>
              My Wallet
            </a>
          </div>
        ) : null}
      </div>

      <div className="rent-top-lang" role="group" aria-label={el ? 'Γλώσσα' : 'Language'}>
        <button
          type="button"
          className={lang === 'el' ? 'is-active' : ''}
          onClick={() => switchLang('el')}
        >
          ΕΛ
        </button>
        <button
          type="button"
          className={lang === 'en' ? 'is-active' : ''}
          onClick={() => switchLang('en')}
        >
          EN
        </button>
      </div>

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
  );
}
