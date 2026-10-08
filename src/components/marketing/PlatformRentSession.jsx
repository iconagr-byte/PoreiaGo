/**
 * Marketing homepage — rent session (hook + clear info + car preview → /rent).
 */
import { Link } from 'react-router-dom';
import { DEMO_RENT_FLEET, rentCategoryLabel } from '../../lib/rental/demoRentFleet.js';
import { RENT_SESSION } from '../../lib/marketing/platformCopy.js';
import '../../styles/platform-service-sessions.css';

const PREVIEW_CARS = DEMO_RENT_FLEET.slice(0, 3);

export default function PlatformRentSession() {
  return (
    <section id={RENT_SESSION.id} className="pg-session pg-session--rent" aria-labelledby="rent-session-hook">
      <div className="pg-session-intro">
        <p className="pg-session-kicker">
          <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>
            car_rental
          </span>
          {RENT_SESSION.kicker}
        </p>
        <h2 id="rent-session-hook" className="pg-session-hook">
          {RENT_SESSION.hook}
        </h2>
        <p className="pg-session-support">{RENT_SESSION.support}</p>
        <ul className="pg-session-points">
          {RENT_SESSION.points.map((point) => (
            <li key={point.label}>
              <span className="material-symbols-outlined" aria-hidden>
                {point.icon}
              </span>
              {point.label}
            </li>
          ))}
        </ul>
        <Link to={RENT_SESSION.ctaTo} className="pg-session-cta pg-session-cta--rent">
          {RENT_SESSION.ctaLabel}
          <span className="material-symbols-outlined" aria-hidden>
            arrow_forward
          </span>
        </Link>
      </div>

      <div className="pg-session-preview">
        <div className="pg-session-rent-grid" role="list" aria-label="Δείγμα στόλου ενοικιάσεων">
          {PREVIEW_CARS.map((car) => (
            <Link
              key={car.id}
              to="/rent"
              className="pg-session-rent-card"
              role="listitem"
              aria-label={`${car.model} — από €${car.daily_rate_eur}/ημέρα`}
            >
              <img src={car.photo_url} alt="" loading="lazy" />
              <div className="pg-session-rent-card-body">
                <span className="pg-session-rent-card-cat">{rentCategoryLabel(car.category)}</span>
                <strong>{car.model}</strong>
                <span className="pg-session-rent-card-meta">{car.seating_capacity} θέσεις</span>
                <p className="pg-session-rent-card-price">
                  από €{car.daily_rate_eur}
                  <span> /ημέρα</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
