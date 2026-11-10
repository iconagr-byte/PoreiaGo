import { Link } from 'react-router-dom';
import '../../styles/storefront-mobile-dock.css';

function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

/**
 * Sticky bottom actions for office storefront on phones —
 * one-tap Εκδρομές / Επικοινωνία / Wallet (+ call when configured).
 */
export default function StorefrontMobileDock({
  tripsEnabled = true,
  rentEnabled = false,
  phone = '',
}) {
  const tel = phoneHref(phone);

  return (
    <nav className="sf-mobile-dock" aria-label="Γρήγορες ενέργειες">
      <div className="sf-mobile-dock__inner">
        {tripsEnabled ? (
          <a href="#search-results" className="sf-mobile-dock__item">
            <span className="material-symbols-outlined" aria-hidden>
              map
            </span>
            <span>Εκδρομές</span>
          </a>
        ) : null}
        {rentEnabled ? (
          <Link to="/rent" className="sf-mobile-dock__item">
            <span className="material-symbols-outlined" aria-hidden>
              directions_car
            </span>
            <span>Rent</span>
          </Link>
        ) : null}
        <Link to="/contact" className="sf-mobile-dock__item">
          <span className="material-symbols-outlined" aria-hidden>
            mail
          </span>
          <span>Επικοινωνία</span>
        </Link>
        {tel ? (
          <a href={tel} className="sf-mobile-dock__item sf-mobile-dock__item--accent">
            <span className="material-symbols-outlined" aria-hidden>
              call
            </span>
            <span>Κλήση</span>
          </a>
        ) : (
          <Link to="/wallet" className="sf-mobile-dock__item sf-mobile-dock__item--accent">
            <span className="material-symbols-outlined" aria-hidden>
              account_balance_wallet
            </span>
            <span>Wallet</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
