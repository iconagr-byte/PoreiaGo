import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PlatformBrand from './PlatformBrand.jsx';
import '../../styles/platform-marketing-header.css';

const BUS_LINKS = [
  {
    href: '#session-buses',
    label: 'Εκδρομές & λεωφορεία',
    hint: 'Κρατήσεις, GPS, στόλος',
    icon: 'directions_bus',
  },
  {
    href: '#platform-trips',
    label: 'Εκδρομές',
    hint: 'Κάρτες ταξιδιών & κρατήσεις',
    icon: 'map',
  },
  {
    href: '#our-fleet',
    label: 'Στόλος',
    hint: 'Λεωφορεία γραφείου',
    icon: 'directions_bus',
  },
  {
    href: '#session-wallet',
    label: 'My Wallet',
    hint: 'QR εισιτήριο στο κινητό',
    icon: 'account_balance_wallet',
  },
  {
    href: '#features',
    label: 'Λειτουργίες',
    hint: 'GPS, QR, πίνακας, email',
    icon: 'apps',
  },
];

/**
 * PoreiaGo marketing homepage header — slim chrome.
 * Λεωφορεία / Ενοικιάσεις live below the hero (service hub), not in the top bar.
 */
export default function PlatformMarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const closeAll = () => {
    setMobileOpen(false);
  };

  return (
    <header className="pm-header pm-header--light">
      <div className="pm-header-inner">
        <PlatformBrand variant="light" />

        <nav className="pm-nav pm-nav--slim" aria-label="Κύριο μενού">
          <a href="#choose-service" className="pm-nav-quiet" onClick={closeAll}>
            Υπηρεσίες
          </a>
        </nav>

        <div className="pm-header-actions">
          <Link to="/admin/login" className="pm-header-login">
            Σύνδεση
          </Link>
          <Link
            to="/wallet"
            className="pm-header-cta pm-header-cta--wallet"
            onClick={closeAll}
          >
            <span className="material-symbols-outlined" aria-hidden>
              account_balance_wallet
            </span>
            My Wallet
          </Link>
          <Link to="/grafeia" className="pm-header-cta pm-header-cta--contracts">
            Συμβόλαια
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </Link>
          <button
            type="button"
            className="pm-header-menu-btn"
            aria-expanded={mobileOpen}
            aria-controls="pm-mobile-panel"
            aria-label={mobileOpen ? 'Κλείσιμο μενού' : 'Άνοιγμα μενού'}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              {mobileOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="pm-mobile-panel" className="pm-mobile">
          <nav className="pm-mobile-nav" aria-label="Μενού κινητού">
            <section className="pm-mobile-section">
              <p className="pm-mobile-label">
                <span className="material-symbols-outlined" aria-hidden>
                  info
                </span>
                Ξεκινήστε εδώ
              </p>
              <a href="#choose-service" className="pm-mobile-link" onClick={closeAll}>
                <span className="material-symbols-outlined" aria-hidden>
                  door_open
                </span>
                <span>
                  <strong>Διαλέξτε υπηρεσία</strong>
                  <em>Λεωφορεία ή Ενοικιάσεις</em>
                </span>
              </a>
            </section>

            <section className="pm-mobile-section">
              <p className="pm-mobile-label">
                <span className="material-symbols-outlined" aria-hidden>
                  directions_bus
                </span>
                Λεωφορεία
              </p>
              {BUS_LINKS.map((item) => (
                <a key={item.href} href={item.href} className="pm-mobile-link" onClick={closeAll}>
                  <span className="material-symbols-outlined" aria-hidden>
                    {item.icon}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <em>{item.hint}</em>
                  </span>
                </a>
              ))}
            </section>

            <section className="pm-mobile-section pm-mobile-section--rent">
              <p className="pm-mobile-label">
                <span className="material-symbols-outlined" aria-hidden>
                  car_rental
                </span>
                Ενοικιάσεις
              </p>
              <Link to="/rent" className="pm-mobile-link pm-mobile-link--rent" onClick={closeAll}>
                <span className="material-symbols-outlined" aria-hidden>
                  car_rental
                </span>
                <span>
                  <strong>Ενοικιάσεις οχημάτων</strong>
                  <em>Ασφάλεια · οδική βοήθεια · συμβόλαιο</em>
                </span>
              </Link>
              <Link to="/rent" className="pm-mobile-link pm-mobile-link--rent" onClick={closeAll}>
                <span className="material-symbols-outlined" aria-hidden>
                  open_in_new
                </span>
                <span>
                  <strong>Σελίδα ενοικιάσεων</strong>
                  <em>Πλήρης εμπειρία · /rent</em>
                </span>
              </Link>
            </section>

            <div className="pm-mobile-footer">
              <Link to="/admin/login" className="pm-mobile-login" onClick={closeAll}>
                Σύνδεση γραφείου
              </Link>
              <Link
                to="/wallet"
                className="pm-header-cta pm-header-cta--wallet pm-mobile-cta"
                onClick={closeAll}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  account_balance_wallet
                </span>
                My Wallet
              </Link>
              <Link to="/grafeia" className="pm-mobile-login" onClick={closeAll}>
                Συμβόλαια
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
