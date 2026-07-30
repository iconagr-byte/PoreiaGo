import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRentLang, setRentLang } from '../../lib/rental/rentI18n.js';

/**
 * Guest header — booking / account / language.
 * «Η κράτησή μου» is a hard link to Rent Wallet only — never bus /my-booking.
 */
export default function RentGuestTopActions({ onAccount } = {}) {
  const [lang, setLang] = useState(() => getRentLang());
  const [accountOpen, setAccountOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('poreiago_prefer_rent_lookup_v1', '1');
    } catch {
      /* ignore */
    }
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
  const loginLabel = el ? 'Είσοδος' : 'Sign in';
  const registerLabel = el ? 'Εγγραφή' : 'Register';
  const accountAria = el ? 'Λογαριασμός' : 'Account';

  return (
    <div className="rent-top-actions" ref={rootRef}>
      {/* Direct navigation — no submenu that could point at bus /my-booking */}
      <a href="/rent/wallet" className="rent-top-chip" title="Rent Wallet">
        <span className="material-symbols-outlined" aria-hidden>
          account_balance_wallet
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
            <button
              type="button"
              role="menuitem"
              className="rent-top-menu-item"
              onClick={() => {
                setAccountOpen(false);
                onAccount?.();
              }}
            >
              {loginLabel}
            </button>
            <Link
              to="/rent/register"
              role="menuitem"
              className="rent-top-menu-item"
              state={{ from: { pathname: '/rent/wallet' }, rentEntrance: true }}
              onClick={() => setAccountOpen(false)}
            >
              {registerLabel}
            </Link>
            <a
              href="/rent/my-booking"
              role="menuitem"
              className="rent-top-menu-item"
              onClick={() => setAccountOpen(false)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                search
              </span>
              {el ? 'Εύρεση κράτησης Rent' : 'Find rent booking'}
            </a>
          </div>
        ) : null}
      </div>

      <div className="rent-top-lang" role="group" aria-label={el ? 'Γλώσσα' : 'Language'}>
        <button
          type="button"
          className={lang === 'el' ? 'is-active' : ''}
          onClick={() => setLang(setRentLang('el'))}
        >
          ΕΛ
        </button>
        <button
          type="button"
          className={lang === 'en' ? 'is-active' : ''}
          onClick={() => setLang(setRentLang('en'))}
        >
          EN
        </button>
      </div>
    </div>
  );
}
