import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PlatformBrand from './PlatformBrand.jsx';
import '../../styles/platform-marketing-header.css';

const BUS_LINKS = [
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
    href: '#features',
    label: 'Λειτουργίες',
    hint: 'GPS, QR, πίνακας, email',
    icon: 'apps',
  },
];

/**
 * PoreiaGo marketing homepage header — buses vs rent clearly separated.
 */
export default function PlatformMarketingHeader() {
  const [busOpen, setBusOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const busMenuId = useId();
  const busWrapRef = useRef(null);

  useEffect(() => {
    if (!busOpen) return undefined;
    const onDoc = (e) => {
      if (busWrapRef.current && !busWrapRef.current.contains(e.target)) {
        setBusOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setBusOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [busOpen]);

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
    setBusOpen(false);
    setMobileOpen(false);
  };

  return (
    <header className="pm-header">
      <div className="pm-header-inner">
        <PlatformBrand variant="dark" />

        <nav className="pm-nav" aria-label="Κύριο μενού">
          <div className="pm-nav-cluster pm-nav-cluster--bus" ref={busWrapRef}>
            <button
              type="button"
              className={`pm-nav-trigger${busOpen ? ' is-open' : ''}`}
              aria-expanded={busOpen}
              aria-controls={busMenuId}
              aria-haspopup="menu"
              onClick={() => setBusOpen((o) => !o)}
            >
              <span className="material-symbols-outlined pm-nav-trigger-icon" aria-hidden>
                directions_bus
              </span>
              <span>Λεωφορεία</span>
              <span className="material-symbols-outlined pm-nav-chevron" aria-hidden>
                expand_more
              </span>
            </button>
            {busOpen ? (
              <div id={busMenuId} className="pm-nav-dropdown" role="menu">
                <p className="pm-nav-dropdown-kicker">Υπηρεσίες λεωφορείου</p>
                {BUS_LINKS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className="pm-nav-dropdown-item"
                    onClick={closeAll}
                  >
                    <span className="material-symbols-outlined" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="pm-nav-dropdown-copy">
                      <strong>{item.label}</strong>
                      <span>{item.hint}</span>
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <span className="pm-nav-rule" aria-hidden />

          <div className="pm-nav-cluster pm-nav-cluster--rent">
            <Link to="/rent" className="pm-nav-rent" onClick={closeAll}>
              <span className="material-symbols-outlined" aria-hidden>
                car_rental
              </span>
              Ενοικιάσεις
            </Link>
          </div>

          <a href="#pricing" className="pm-nav-link" onClick={closeAll}>
            Τιμές
          </a>
        </nav>

        <div className="pm-header-actions">
          <Link to="/admin/login" className="pm-header-login">
            Σύνδεση
          </Link>
          <Link to="/grafeia" className="pm-header-cta">
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
                  open_in_new
                </span>
                <span>
                  <strong>Σελίδα ενοικιάσεων</strong>
                  <em>Στόλος αυτοκινήτων · /rent</em>
                </span>
              </Link>
            </section>

            <a href="#pricing" className="pm-mobile-link" onClick={closeAll}>
              <span className="material-symbols-outlined" aria-hidden>
                payments
              </span>
              <span>
                <strong>Τιμές</strong>
                <em>Συμβόλαια πλατφόρμας</em>
              </span>
            </a>

            <div className="pm-mobile-footer">
              <Link to="/admin/login" className="pm-mobile-login" onClick={closeAll}>
                Σύνδεση γραφείου
              </Link>
              <Link to="/grafeia" className="pm-header-cta pm-mobile-cta" onClick={closeAll}>
                Συμβόλαια
                <span className="material-symbols-outlined" aria-hidden>
                  arrow_forward
                </span>
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
