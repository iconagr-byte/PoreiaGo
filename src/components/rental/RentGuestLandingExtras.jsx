import { RENT_SERVICE_FEATURES, rentServiceCopy } from '../../lib/rental/rentServicesCatalog.js';
import { RENT_HOME_STEPS, RENT_HOME_TRUST } from '../../lib/rental/rentFleetEnrichment.js';

/**
 * Clean guest landing sections — Apple-like spacing and hierarchy.
 */
export default function RentGuestLandingExtras({ brandLabel = 'Γραφείο', onRequireLogin } = {}) {
  const services = RENT_SERVICE_FEATURES.slice(0, 4);

  return (
    <div className="rent-guest-extras">
      <section className="rent-apple-block" aria-label="Εγγυήσεις">
        <ul className="rent-apple-trust">
          {RENT_HOME_TRUST.map((item) => (
            <li key={item.label}>
              <span className="material-symbols-outlined" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="rent-apple-block" aria-label="Πώς λειτουργεί">
        <p className="rent-apple-eyebrow">Βήματα</p>
        <h2 className="rent-apple-title">Πώς κλείνεις</h2>
        <p className="rent-apple-lead">Από τον στόλο στο Wallet, σε τρία καθαρά βήματα.</p>
        <ol className="rent-apple-steps">
          {RENT_HOME_STEPS.map((step, idx) => (
            <li key={step.id}>
              <span className="rent-apple-step-i" aria-hidden>
                {idx + 1}
              </span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rent-apple-block" aria-label="Τι περιλαμβάνει">
        <p className="rent-apple-eyebrow">Υπηρεσία</p>
        <h2 className="rent-apple-title">Τι περιλαμβάνει</h2>
        <p className="rent-apple-lead">
          {brandLabel} — ασφάλεια και υποστήριξη μέσα από το Rent Wallet.
        </p>
        <ul className="rent-apple-rows">
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

      <section className="rent-apple-block rent-apple-block--cta" aria-label="Παραλαβή">
        <p className="rent-apple-eyebrow">Παραλαβή</p>
        <h2 className="rent-apple-title">Έτοιμοι για το δρόμο</h2>
        <p className="rent-apple-lead">
          Παραλαβή από το γραφείο, προαιρετικό one-way και έλεγχος πριν την αναχώρηση.
        </p>
        <ul className="rent-apple-checklist">
          <li>Άδεια οδήγησης και ταυτότητα / διαβατήριο</li>
          <li>Ηλικία σύμφωνα με τους όρους του γραφείου</li>
          <li>Κάρτα για εγγύηση, όπου απαιτείται</li>
        </ul>
        <button type="button" className="rent-apple-cta" onClick={onRequireLogin}>
          Σύνδεση για κράτηση
        </button>
      </section>
    </div>
  );
}
