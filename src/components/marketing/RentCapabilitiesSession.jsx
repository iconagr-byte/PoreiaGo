/**
 * /rent — Stripe-inspired feature bento (hero teal theme) explaining Rent capabilities.
 * Layout idea from Stripe feature cards; content + teal palette are PoreiaGo Rent.
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
      <div className="rent-stripe-viz rent-stripe-viz--calendar rent-stripe-viz--stack" aria-hidden>
        <div className="rent-stripe-float rent-stripe-float--phone">
          <header className="rent-stripe-float-chrome">
            <i />
            <i />
            <i />
            <span>Rent · Search</span>
          </header>
          <p className="rent-stripe-float-label">Παραλαβή</p>
          <strong>15 Νοε · 10:00</strong>
          <p className="rent-stripe-float-label">Επιστροφή</p>
          <strong>18 Νοε · 10:00</strong>
          <span className="rent-stripe-float-pill">Αναζήτηση</span>
        </div>
        <div className="rent-stripe-float rent-stripe-float--browser">
          <header className="rent-stripe-float-chrome">
            <i />
            <i />
            <i />
            <span>Ημερολόγιο</span>
          </header>
          <div className="rent-stripe-cal-lite">
            <div className="rent-stripe-cal-lite-head">
              <span>Νοέμβριος</span>
              <em>15–18</em>
            </div>
            <div className="rent-stripe-cal-grid">
              {Array.from({ length: 14 }).map((_, i) => (
                <i key={i} className={i >= 7 && i <= 10 ? 'is-on' : ''} />
              ))}
            </div>
            <p>Γραφείο · PoreiaGo Rent</p>
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'fleet') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--fleet rent-stripe-viz--stack" aria-hidden>
        <div className="rent-stripe-float rent-stripe-float--meter">
          <strong>Στόλος · διαθέσιμα</strong>
          <p>Ζήτηση εβδομάδας</p>
          <div className="rent-stripe-meter">
            <span style={{ width: '68%' }} />
          </div>
          <em>68% κρατημένα</em>
        </div>
        <div className="rent-stripe-float rent-stripe-float--list">
          <strong>Τιμή / ημέρα</strong>
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
          <div className="rent-stripe-bars" aria-hidden>
            <i style={{ height: '42%' }} />
            <i style={{ height: '68%' }} />
            <i style={{ height: '55%' }} />
            <i style={{ height: '82%' }} />
            <i style={{ height: '48%' }} />
            <i style={{ height: '74%' }} />
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'shield') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--shield rent-stripe-viz--center" aria-hidden>
        <div className="rent-stripe-float rent-stripe-float--shield">
          <span className="rent-stripe-float-icon material-symbols-outlined">verified_user</span>
          <strong>CDW / SCDW</strong>
          <p>Καθαροί όροι πριν την υπογραφή</p>
          <span className="rent-stripe-float-tag">Franchise εμφανές</span>
        </div>
      </div>
    );
  }
  if (kind === 'sign') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--sign rent-stripe-viz--center" aria-hidden>
        <div className="rent-stripe-float rent-stripe-float--sign">
          <p className="rent-stripe-float-kicker">Σύμβαση ενοικίασης</p>
          <strong>DEMO-SIGN</strong>
          <ul>
            <li>
              <span className="material-symbols-outlined">check_circle</span>
              CDW / SCDW
            </li>
            <li>
              <span className="material-symbols-outlined">check_circle</span>
              Κατάσταση οχήματος
            </li>
          </ul>
          <div className="rent-stripe-sign-ink">
            <svg viewBox="0 0 160 40" fill="none">
              <path
                d="M6 26 C24 8, 40 34, 58 18 S90 6, 112 24 S140 34, 154 16"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <em>Έτοιμο για υπογραφή</em>
        </div>
      </div>
    );
  }
  return (
    <div className="rent-stripe-viz rent-stripe-viz--wallet rent-stripe-viz--center" aria-hidden>
      <div className="rent-stripe-float rent-stripe-float--wallet">
        <p>My Wallet · Rent</p>
        <strong>Compact</strong>
        <span>Παραλαβή 10:00 · DEMO-RENT</span>
        <div className="rent-stripe-qr rent-stripe-qr--lg">
          {Array.from({ length: 25 }).map((_, i) => (
            <i key={i} className={i % 2 === 0 || i % 5 === 0 || i % 7 === 0 ? 'on' : ''} />
          ))}
        </div>
        <em>CDW · QR pass</em>
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
      className="rent-stripe-session rent-stripe-session--rich"
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

        <div className="rent-stripe-bento rent-stripe-bento--rich" role="list">
          {FEATURE_CARDS.map((card) => (
            <article
              key={card.id}
              className={`rent-stripe-card rent-stripe-card--rich rent-stripe-card--${card.size} rent-stripe-card--${card.tone}`}
              role="listitem"
            >
              <div className="rent-stripe-card-top">
                <h3>{card.title}</h3>
                <span className="rent-stripe-card-expand" aria-hidden>
                  <span className="material-symbols-outlined">open_in_full</span>
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
