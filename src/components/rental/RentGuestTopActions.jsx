import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRentLang, setRentLang } from '../../lib/rental/rentI18n.js';

/**
 * Guest header utilities — booking / account / language.
 * Soft chip design; account icon opens Είσοδος / Εγγραφή menu.
 */
export default function RentGuestTopActions({ onAccount } = {}) {
  const [lang, setLang] = useState(() => getRentLang());
  const [bookingOpen, setBookingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!bookingOpen && !accountOpen) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setBookingOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [bookingOpen, accountOpen]);

  const el = lang !== 'en';
  const bookingLabel = el ? 'Η κράτησή μου' : 'My booking';
  const findLabel = el ? 'Εύρεση κράτησης' : 'Find booking';
  const loginLabel = el ? 'Είσοδος' : 'Sign in';
  const registerLabel = el ? 'Εγγραφή' : 'Register';
  const accountAria = el ? 'Λογαριασμός' : 'Account';

  return (
    <div className="rent-top-actions" ref={rootRef}>
      <div className="rent-top-chip-wrap">
        <button
          type="button"
          className={`rent-top-chip${bookingOpen ? ' is-open' : ''}`}
          aria-expanded={bookingOpen}
          aria-haspopup="menu"
          onClick={() => {
            setBookingOpen((v) => !v);
            setAccountOpen(false);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden>
            confirmation_number
          </span>
          <span className="rent-top-chip-label">{bookingLabel}</span>
          <span className="material-symbols-outlined rent-top-chip-caret" aria-hidden>
            expand_more
          </span>
        </button>
        {bookingOpen ? (
          <div className="rent-top-menu" role="menu">
            <Link
              to="/rent/my-booking"
              role="menuitem"
              className="rent-top-menu-item"
              onClick={() => setBookingOpen(false)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                search
              </span>
              {findLabel}
            </Link>
          </div>
        ) : null}
      </div>

      <div className="rent-top-chip-wrap">
        <button
          type="button"
          className={`rent-top-icon-btn${accountOpen ? ' is-open' : ''}`}
          aria-label={accountAria}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          title={accountAria}
          onClick={() => {
            setAccountOpen((v) => !v);
            setBookingOpen(false);
          }}
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
              state={{ from: { pathname: '/rent' }, rentEntrance: true }}
              onClick={() => setAccountOpen(false)}
            >
              {registerLabel}
            </Link>
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
