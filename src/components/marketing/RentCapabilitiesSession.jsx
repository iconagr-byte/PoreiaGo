/**
 * /rent — Stripe-inspired feature bento (hero teal theme) explaining Rent capabilities.
 */
import { RENT_CAPABILITIES_SESSION } from '../../lib/marketing/platformCopy.js';
import '../../styles/rent-marketing-showcase.css';

const FEATURE_CARDS = [
  {
    id: 'search',
    title: 'Αναζήτηση ημερομηνιών σε μία γραμμή',
    tone: 'teal',
    size: 'wide',
    visual: 'calendar',
  },
  {
    id: 'fleet',
    title: 'Στόλος γραφείου με καθαρή τιμή/ημέρα',
    tone: 'sky',
    size: 'tall',
    visual: 'fleet',
  },
  {
    id: 'cover',
    title: 'Ασφάλεια CDW πριν την πληρωμή',
    tone: 'mint',
    size: 'third',
    visual: 'shield',
  },
  {
    id: 'sign',
    title: 'Ψηφιακό συμβόλαιο χωρίς χαρτί',
    tone: 'cyan',
    size: 'third',
    visual: 'sign',
  },
  {
    id: 'wallet',
    title: 'QR pass στο My Wallet',
    tone: 'deep',
    size: 'third',
    visual: 'wallet',
  },
];

function CardVisual({ kind }) {
  if (kind === 'calendar') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--calendar" aria-hidden>
        <div className="rent-stripe-cal">
          <header>
            <span>Νοέμβριος</span>
            <em>15–18</em>
          </header>
          <div className="rent-stripe-cal-grid">
            {Array.from({ length: 14 }).map((_, i) => (
              <i key={i} className={i >= 7 && i <= 10 ? 'is-on' : ''} />
            ))}
          </div>
          <p>Παραλαβή · Γραφείο 10:00</p>
        </div>
      </div>
    );
  }
  if (kind === 'fleet') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--fleet" aria-hidden>
        <div className="rent-stripe-fleet">
          <strong>Διαθέσιμα σήμερα</strong>
          <ul>
            <li>
              <span className="dot dot--sky" />
              Yaris Cross <em>€42</em>
            </li>
            <li>
              <span className="dot dot--teal" />
              Corolla Hybrid <em>€48</em>
            </li>
            <li>
              <span className="dot dot--amber" />
              Transit Van <em>€68</em>
            </li>
          </ul>
        </div>
      </div>
    );
  }
  if (kind === 'shield') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--shield" aria-hidden>
        <div className="rent-stripe-shield">
          <span className="material-symbols-outlined">verified_user</span>
          <strong>CDW / SCDW</strong>
          <p>Καθαροί όροι πριν την υπογραφή</p>
        </div>
      </div>
    );
  }
  if (kind === 'sign') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--sign" aria-hidden>
        <div className="rent-stripe-sign">
          <p>Σύμβαση ενοικίασης</p>
          <svg viewBox="0 0 160 40" fill="none">
            <path
              d="M6 26 C24 8, 40 34, 58 18 S90 6, 112 24 S140 34, 154 16"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
          <em>Έτοιμο για υπογραφή</em>
        </div>
      </div>
    );
  }
  return (
    <div className="rent-stripe-viz rent-stripe-viz--wallet" aria-hidden>
      <div className="rent-stripe-phone">
        <p>My Wallet · Rent</p>
        <strong>Compact</strong>
        <span>Παραλαβή 10:00</span>
        <div className="rent-stripe-qr">
          {Array.from({ length: 25 }).map((_, i) => (
            <i key={i} className={i % 2 === 0 || i % 7 === 0 ? 'on' : ''} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RentCapabilitiesSession() {
  const scrollToSearch = (e) => {
    const el = document.getElementById('rent-guest-search');
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section
      id={RENT_CAPABILITIES_SESSION.id}
      className="rent-stripe-session"
      aria-labelledby="rent-cap-hook"
    >
      <div className="rent-stripe-inner">
        <header className="rent-stripe-head">
          <p className="rent-stripe-kicker">{RENT_CAPABILITIES_SESSION.kicker}</p>
          <h2 id="rent-cap-hook" className="rent-stripe-title">
            {RENT_CAPABILITIES_SESSION.hook}
          </h2>
          <p className="rent-stripe-sub">{RENT_CAPABILITIES_SESSION.support}</p>
        </header>

        <div className="rent-stripe-bento" role="list">
          {FEATURE_CARDS.map((card) => (
            <article
              key={card.id}
              className={`rent-stripe-card rent-stripe-card--${card.size} rent-stripe-card--${card.tone}`}
              role="listitem"
            >
              <div className="rent-stripe-card-top">
                <h3>{card.title}</h3>
                <span className="rent-stripe-card-expand material-symbols-outlined" aria-hidden>
                  open_in_full
                </span>
              </div>
              <CardVisual kind={card.visual} />
            </article>
          ))}
        </div>

        <div className="rent-stripe-cta-wrap">
          <a
            href={RENT_CAPABILITIES_SESSION.ctaHref}
            className="rent-stripe-cta"
            onClick={scrollToSearch}
          >
            {RENT_CAPABILITIES_SESSION.ctaLabel}
            <span className="material-symbols-outlined" aria-hidden>
              arrow_upward
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
