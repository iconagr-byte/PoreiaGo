import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRentLang, setRentLang } from '../../lib/rental/rentI18n.js';

/**
 * Guest header utilities — booking / account / language.
 * Soft chip design (not Hertz plain text + caret).
 */
export default function RentGuestTopActions({ onAccount } = {}) {
  const [lang, setLang] = useState(() => getRentLang());
  const [bookingOpen, setBookingOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!bookingOpen) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setBookingOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [bookingOpen]);

  const el = lang !== 'en';
  const bookingLabel = el ? 'Η κράτησή μου' : 'My booking';
  const findLabel = el ? 'Εύρεση κράτησης' : 'Find booking';
  const loginLabel = el ? 'Σύνδεση' : 'Sign in';
  const accountAria = el ? 'Λογαριασμός' : 'Account';

  return (
    <div className="rent-top-actions">
      <div className="rent-top-chip-wrap" ref={menuRef}>
        <button
          type="button"
          className={`rent-top-chip${bookingOpen ? ' is-open' : ''}`}
          aria-expanded={bookingOpen}
          aria-haspopup="menu"
          onClick={() => setBookingOpen((v) => !v)}
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
              to="/my-booking"
              role="menuitem"
              className="rent-top-menu-item"
              onClick={() => setBookingOpen(false)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                search
              </span>
              {findLabel}
            </Link>
            <button
              type="button"
              role="menuitem"
              className="rent-top-menu-item"
              onClick={() => {
                setBookingOpen(false);
                onAccount?.();
              }}
            >
              <span className="material-symbols-outlined" aria-hidden>
                login
              </span>
              {loginLabel}
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="rent-top-icon-btn"
        aria-label={accountAria}
        title={accountAria}
        onClick={onAccount}
      >
        <span className="material-symbols-outlined" aria-hidden>
          person
        </span>
      </button>

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
