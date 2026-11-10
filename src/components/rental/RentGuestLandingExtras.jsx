import { RENT_SERVICE_FEATURES, rentServiceCopy } from '../../lib/rental/rentServicesCatalog.js';
import { RENT_HOME_STEPS, RENT_HOME_TRUST } from '../../lib/rental/rentFleetEnrichment.js';
import '../../styles/rent-marketing-showcase.css';

const TRUST_COPY = {
  'Ασφάλεια CDW': 'Καθαρή εξήγηση κάλυψης πριν την υπογραφή.',
  'Υποστήριξη γραφείου': 'Το γραφείο δίπλα σου πριν και κατά τη διαδρομή.',
  'Οδική βοήθεια 24/7': 'Τηλέφωνο και QR κάρτα πάνω στο pass.',
  'Έλεγχος πριν την αναχώρηση': 'Checklist στο mobile πριν φύγεις.',
};

const TRUST_TONE = ['teal', 'sky', 'mint', 'cyan'];
const TRUST_VISUAL = ['shield', 'chat', 'sos', 'check'];

function TrustVisual({ kind }) {
  if (kind === 'chat') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--chat" aria-hidden>
        <div className="rent-stripe-bubbles">
          <span>Γραφείο εδώ</span>
          <span className="is-reply">Παραλαβή στις 10:00;</span>
          <span>Ναι — όλα έτοιμα</span>
        </div>
      </div>
    );
  }
  if (kind === 'sos') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--sos" aria-hidden>
        <div className="rent-stripe-sos">
          <span className="material-symbols-outlined">health_and_safety</span>
          <strong>24/7</strong>
          <p>Οδική βοήθεια στο pass</p>
        </div>
      </div>
    );
  }
  if (kind === 'check') {
    return (
      <div className="rent-stripe-viz rent-stripe-viz--check" aria-hidden>
        <div className="rent-stripe-check">
          <ul>
            <li className="is-done">Καύσιμο</li>
            <li className="is-done">Χιλιόμετρα</li>
            <li>Φωτογραφίες</li>
          </ul>
        </div>
      </div>
    );
  }
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

/**
 * Guest landing body — Stripe-inspired feature bands (hero teal theme).
 */
export default function RentGuestLandingExtras({
  brandLabel = 'Γραφείο',
  onRequireLogin,
  onStartSearch,
} = {}) {
  const services = RENT_SERVICE_FEATURES.slice(0, 4);
  const startSearch =
    typeof onStartSearch === 'function'
      ? onStartSearch
      : () => {
          document
            .getElementById('rent-guest-search')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

  return (
    <div className="rent-land rent-land--stripe">
      <section className="rent-stripe-session" aria-label="Εγγυήσεις">
        <div className="rent-stripe-inner">
          <header className="rent-stripe-head">
            <p className="rent-stripe-kicker">Γιατί εμάς</p>
            <h2 className="rent-stripe-title">
              Ό,τι χρειάζεσαι για μια ήρεμη ενοικίαση.
            </h2>
            <p className="rent-stripe-sub">
              Ασφάλεια, υποστήριξη και εργαλεία μέσα στο My Wallet — built-in.
            </p>
          </header>

          <div className="rent-stripe-bento rent-stripe-bento--trust" role="list">
            {RENT_HOME_TRUST.map((item, i) => (
              <article
                key={item.label}
                className={`rent-stripe-card rent-stripe-card--quarter rent-stripe-card--${TRUST_TONE[i] || 'teal'}`}
                role="listitem"
              >
                <div className="rent-stripe-card-top">
                  <h3>{item.label}</h3>
                  <span className="rent-stripe-card-expand material-symbols-outlined" aria-hidden>
                    open_in_full
                  </span>
                </div>
                <p className="rent-stripe-card-copy">{TRUST_COPY[item.label] || ''}</p>
                <TrustVisual kind={TRUST_VISUAL[i] || 'shield'} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="rent-guest-how" className="rent-stripe-session rent-stripe-session--how" aria-label="Πώς λειτουργεί">
        <div className="rent-stripe-inner">
          <header className="rent-stripe-head rent-stripe-head--center">
            <h2 className="rent-stripe-title">Πώς κλείνεις</h2>
            <p className="rent-stripe-sub">Τρία βήματα · από τον στόλο στο Wallet</p>
          </header>

          <ol className="rent-stripe-steps">
            {RENT_HOME_STEPS.map((step, idx) => (
              <li key={step.id} className="rent-stripe-step">
                <span className="rent-stripe-step-num" aria-hidden>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="rent-stripe-step-icon material-symbols-outlined" aria-hidden>
                  {step.icon}
                </span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>

          <div className="rent-stripe-cta-wrap">
            <button type="button" className="rent-stripe-cta" onClick={startSearch}>
              Ξεκίνα αναζήτηση
              <span className="material-symbols-outlined" aria-hidden>
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </section>

      <section id="rent-guest-services" className="rent-stripe-session" aria-label="Τι περιλαμβάνει">
        <div className="rent-stripe-inner">
          <header className="rent-stripe-head">
            <p className="rent-stripe-kicker">Υπηρεσία</p>
            <h2 className="rent-stripe-title">Τι περιλαμβάνει η ενοικίαση</h2>
            <p className="rent-stripe-sub">
              {brandLabel} — SOS, οδική βοήθεια και καθαρή ασφάλεια στο Wallet.
            </p>
          </header>

          <div className="rent-stripe-bento rent-stripe-bento--services" role="list">
            {services.map((feature, i) => {
              const { title, copy } = rentServiceCopy(feature, 'el');
              const tones = ['sky', 'teal', 'mint', 'cyan'];
              return (
                <article
                  key={feature.id}
                  className={`rent-stripe-card rent-stripe-card--half rent-stripe-card--${tones[i] || 'teal'}`}
                  role="listitem"
                >
                  <div className="rent-stripe-card-top">
                    <h3>{title}</h3>
                    <span className="rent-stripe-card-expand material-symbols-outlined" aria-hidden>
                      {feature.icon || 'open_in_full'}
                    </span>
                  </div>
                  <p className="rent-stripe-card-copy">{copy}</p>
                  <div className="rent-stripe-viz rent-stripe-viz--soft" aria-hidden>
                    <span className="material-symbols-outlined">{feature.icon}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rent-stripe-session rent-stripe-session--cta" aria-label="Παραλαβή">
        <div className="rent-stripe-inner rent-stripe-cta-band">
          <div>
            <p className="rent-stripe-kicker">Παραλαβή & επιστροφή</p>
            <h2 className="rent-stripe-title">Έτοιμοι για το δρόμο</h2>
            <p className="rent-stripe-sub">
              Παραλαβή από τα σημεία του γραφείου, προαιρετικό one-way και έλεγχος πριν την αναχώρηση.
            </p>
            <ul className="rent-stripe-checks">
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  check_circle
                </span>
                Άδεια οδήγησης και ταυτότητα / διαβατήριο
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  check_circle
                </span>
                Ηλικία σύμφωνα με τους όρους του γραφείου
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden>
                  check_circle
                </span>
                Κάρτα για εγγύηση, όπου απαιτείται
              </li>
            </ul>
            <div className="rent-stripe-actions">
              <button type="button" className="rent-stripe-cta" onClick={startSearch}>
                Ξεκίνα αναζήτηση
                <span className="material-symbols-outlined" aria-hidden>
                  arrow_forward
                </span>
              </button>
              {typeof onRequireLogin === 'function' ? (
                <button
                  type="button"
                  className="rent-stripe-cta rent-stripe-cta--secondary"
                  onClick={onRequireLogin}
                >
                  Έχεις ήδη λογαριασμό;
                </button>
              ) : null}
            </div>
          </div>
          <aside className="rent-stripe-wallet-aside" aria-hidden>
            <p>My Wallet</p>
            <strong>Η κράτησή σου σε μία κάρτα</strong>
            <span>Ημερομηνίες · παραλαβή · SOS</span>
            <div className="rent-stripe-qr rent-stripe-qr--lg">
              {Array.from({ length: 25 }).map((_, i) => (
                <i key={i} className={i % 2 === 0 || i % 5 === 0 ? 'on' : ''} />
              ))}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
