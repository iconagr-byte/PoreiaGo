import { useEffect, useState } from 'react';
import { getRentLang } from '../../lib/rental/rentI18n.js';

const NAV_ITEMS = [
  { id: 'rent-guest-search', el: 'Αναζήτηση', en: 'Search', icon: 'search' },
  { id: 'rent-guest-fleet', el: 'Στόλος', en: 'Fleet', icon: 'directions_car' },
  { id: 'rent-guest-how', el: 'Πώς κλείνεις', en: 'How it works', icon: 'route' },
  { id: 'rent-guest-services', el: 'Υπηρεσίες', en: 'Services', icon: 'verified_user' },
];

function scrollToSection(id) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: id === 'rent-guest-search' ? 'center' : 'start' });
}

/**
 * Desktop center nav + compact mobile menu for the guest /rent topbar.
 */
export default function RentGuestNav({ lang: langProp } = {}) {
  const [lang, setLang] = useState(() => langProp || getRentLang());
  const [menuOpen, setMenuOpen] = useState(false);
  const el = (langProp || lang) !== 'en';

  useEffect(() => {
    if (langProp) setLang(langProp);
  }, [langProp]);

  useEffect(() => {
    const onLang = () => setLang(getRentLang());
    window.addEventListener('storage', onLang);
    window.addEventListener('rent-lang-change', onLang);
    return () => {
      window.removeEventListener('storage', onLang);
      window.removeEventListener('rent-lang-change', onLang);
    };
  }, []);

  const go = (id) => {
    setMenuOpen(false);
    scrollToSection(id);
  };

  return (
    <>
      <nav className="rent-guest-nav" aria-label={el ? 'Μενού ενοικίασης' : 'Rent navigation'}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="rent-guest-nav-link"
            onClick={() => go(item.id)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              {item.icon}
            </span>
            <span>{el ? item.el : item.en}</span>
          </button>
        ))}
      </nav>

      <div className="rent-guest-nav-mobile">
        <button
          type="button"
          className={`rent-top-icon-btn rent-guest-nav-toggle${menuOpen ? ' is-open' : ''}`}
          aria-label={el ? 'Μενού' : 'Menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="material-symbols-outlined" aria-hidden>
            {menuOpen ? 'close' : 'menu'}
          </span>
        </button>
        {menuOpen ? (
          <div className="rent-top-menu rent-guest-nav-sheet" role="menu">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="rent-top-menu-item"
                onClick={() => go(item.id)}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  {item.icon}
                </span>
                {el ? item.el : item.en}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
