import { RENT_SERVICE_FEATURES, rentServiceCopy } from '../../lib/rental/rentServicesCatalog.js';
import { RENT_HOME_STEPS, RENT_HOME_TRUST } from '../../lib/rental/rentFleetEnrichment.js';

/**
 * Guest landing body — same section rhythm as platform bus landing, rent-adapted.
 */
export default function RentGuestLandingExtras({ brandLabel = 'Γραφείο', onRequireLogin } = {}) {
  const services = RENT_SERVICE_FEATURES.slice(0, 4);

  return (
    <div className="rent-land">
      <section className="rent-land-band rent-land-band--mist" aria-label="Εγγυήσεις">
        <div className="rent-land-inner">
          <header className="rent-land-head">
            <p className="rent-land-eyebrow">Γιατί εμάς</p>
            <h2 className="rent-land-title">
              Ό,τι χρειάζεσαι για μια ήρεμη ενοικίαση.
              <span className="rent-land-muted"> Built-in.</span>
            </h2>
            <p className="rent-land-sub">Ασφάλεια, υποστήριξη και εργαλεία μέσα στο Rent Wallet.</p>
          </header>
          <div className="rent-land-cards">
            {RENT_HOME_TRUST.map((item) => (
              <article key={item.label} className="rent-land-card">
                <div className="rent-land-card-icon" aria-hidden>
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <h3>{item.label}</h3>
                <p>
                  {item.label === 'Ασφάλεια CDW'
                    ? 'Καθαρή εξήγηση κάλυψης πριν την υπογραφή.'
                    : item.label === 'Υποστήριξη γραφείου'
                      ? 'Το γραφείο δίπλα σου πριν και κατά τη διαδρομή.'
                      : item.label === 'Οδική βοήθεια 24/7'
                        ? 'Τηλέφωνο και QR κάρτα πάνω στο pass.'
                        : 'Checklist στο mobile πριν φύγεις.'}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rent-land-band rent-land-band--dark" aria-label="Πώς λειτουργεί">
        <div className="rent-land-inner">
          <header className="rent-land-head rent-land-head--center">
            <h2 className="rent-land-title rent-land-title--light">Πώς κλείνεις</h2>
            <p className="rent-land-sub rent-land-sub--light">Τρία βήματα · από τον στόλο στο Wallet</p>
          </header>
          <ol className="rent-land-steps">
            {RENT_HOME_STEPS.map((step, idx) => (
              <li key={step.id}>
                <span className="rent-land-step-num" aria-hidden>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
          <div className="rent-land-center">
            <button type="button" className="rent-land-btn rent-land-btn--sky" onClick={onRequireLogin}>
              Σύνδεση για κράτηση
              <span className="material-symbols-outlined" aria-hidden>
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="rent-land-band rent-land-band--mist" aria-label="Τι περιλαμβάνει">
        <div className="rent-land-inner">
          <header className="rent-land-head">
            <p className="rent-land-eyebrow">Υπηρεσία</p>
            <h2 className="rent-land-title">Τι περιλαμβάνει η ενοικίαση</h2>
            <p className="rent-land-sub">
              {brandLabel} — SOS, οδική βοήθεια και καθαρή ασφάλεια στο Wallet.
            </p>
          </header>
          <div className="rent-land-cards rent-land-cards--2">
            {services.map((feature) => {
              const { title, copy } = rentServiceCopy(feature, 'el');
              return (
                <article key={feature.id} className="rent-land-card">
                  <div className="rent-land-card-icon" aria-hidden>
                    <span className="material-symbols-outlined">{feature.icon}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rent-land-band rent-land-band--teal" aria-label="Παραλαβή">
        <div className="rent-land-inner rent-land-teal-grid">
          <div>
            <span className="rent-land-chip">
              <span className="material-symbols-outlined" aria-hidden>
                car_rental
              </span>
              Παραλαβή & επιστροφή
            </span>
            <h2 className="rent-land-title rent-land-title--light">Έτοιμοι για το δρόμο</h2>
            <p className="rent-land-sub rent-land-sub--teal">
              Παραλαβή από το γραφείο, προαιρετικό one-way και έλεγχος πριν την αναχώρηση.
            </p>
            <ul className="rent-land-checks">
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
            <div className="rent-land-actions">
              <button type="button" className="rent-land-btn rent-land-btn--white" onClick={onRequireLogin}>
                Σύνδεση για κράτηση
                <span className="material-symbols-outlined" aria-hidden>
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
          <aside className="rent-land-aside">
            <p className="rent-land-aside-kicker">Rent Wallet</p>
            <h3>Η κράτησή σου σε μία κάρτα</h3>
            <p>Ημερομηνίες, παραλαβή, SOS και οδική βοήθεια — όλα στο Wallet μετά τη σύνδεση.</p>
          </aside>
        </div>
      </section>
    </div>
  );
}
