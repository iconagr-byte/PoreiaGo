import { RENT_SERVICE_FEATURES, rentServiceCopy } from '../../lib/rental/rentServicesCatalog.js';
import { RENT_HOME_STEPS, RENT_HOME_TRUST } from '../../lib/rental/rentFleetEnrichment.js';

/**
 * Marketing sections below the guest fleet — how it works, trust, included services.
 */
export default function RentGuestLandingExtras({ brandLabel = 'Γραφείο', onRequireLogin } = {}) {
  const services = RENT_SERVICE_FEATURES.slice(0, 4);

  return (
    <div className="rent-guest-extras">
      <section className="rent-panel rent-guest-trust" aria-label="Εγγυήσεις">
        <ul className="rent-guest-trust-list">
          {RENT_HOME_TRUST.map((item) => (
            <li key={item.label}>
              <span className="material-symbols-outlined" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rent-panel" aria-label="Πώς λειτουργεί">
        <h2 className="rent-guest-section-title">Πώς κλείνεις</h2>
        <p className="rent-panel-lead">Τρία απλά βήματα από τον στόλο μέχρι το Rent Wallet.</p>
        <ol className="rent-guest-steps">
          {RENT_HOME_STEPS.map((step, idx) => (
            <li key={step.id}>
              <span className="rent-guest-step-num" aria-hidden>
                {idx + 1}
              </span>
              <span className="material-symbols-outlined rent-guest-step-icon" aria-hidden>
                {step.icon}
              </span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rent-panel" aria-label="Τι περιλαμβάνει">
        <h2 className="rent-guest-section-title">Τι περιλαμβάνει η ενοικίαση</h2>
        <p className="rent-panel-lead">
          {brandLabel}: ασφάλεια, οδική βοήθεια και εργαλεία ταξιδιού μέσα από το Wallet.
        </p>
        <ul className="rent-guest-services">
          {services.map((feature) => {
            const { title, copy } = rentServiceCopy(feature, 'el');
            return (
              <li key={feature.id}>
                <span className="material-symbols-outlined" aria-hidden>
                  {feature.icon}
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rent-panel rent-guest-pickup" aria-label="Παραλαβή">
        <h2 className="rent-guest-section-title">Παραλαβή & επιστροφή</h2>
        <p className="rent-panel-lead">
          Παραλαβή από το γραφείο, με δυνατότητα one-way επιστροφής και επιλογής με οδηγό.
          Πριν την αναχώρηση γίνεται έλεγχος οχήματος και επεξήγηση κάλυψης ασφάλειας.
        </p>
        <ul className="rent-guest-pickup-points">
          <li>Άδεια οδήγησης και ταυτότητα / διαβατήριο</li>
          <li>Ηλικία σύμφωνα με τους όρους του γραφείου</li>
          <li>Πιστωτική/χρεωστική για εγγύηση όπου απαιτείται</li>
        </ul>
        <button type="button" className="rent-hero-cta rent-guest-bottom-cta" onClick={onRequireLogin}>
          <span className="material-symbols-outlined" aria-hidden>
            lock_open
          </span>
          Σύνδεση και κράτηση
        </button>
      </section>
    </div>
  );
}
