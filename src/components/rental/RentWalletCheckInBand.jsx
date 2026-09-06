/**
 * Hertz-style Online Check-In band: promo left + 3 steps right, My Wallet in the center.
 */

export default function RentWalletCheckInBand({ children, officeName = '' }) {
  const office = String(officeName || '').trim() || 'το γραφείο μας';

  return (
    <div className="rent-wallet-checkin">
      <aside
        className="rent-wallet-checkin-aside rent-wallet-checkin-aside--left"
        aria-label="Online Check-In"
      >
        <p className="rent-wallet-checkin-kicker">Online Check-In</p>
        <h3 className="rent-wallet-checkin-title">
          Γλιτώστε χρόνο στην παραλαβή του οχήματός σας
        </h3>
        <p className="rent-wallet-checkin-lead">
          Στο {office} θέλουμε η εμπειρία ενοικίασης να είναι όσο πιο απλή και άνετη γίνεται.
          Συμπληρώστε τα στοιχεία σας στη φόρμα Online Check-In από το My Wallet — όπου κι αν
          βρίσκεστε, πριν φτάσετε στο σημείο παραλαβής — και αποφύγετε αναμονή στο γκισέ.
        </p>
      </aside>

      <div className="rent-wallet-checkin-center">{children}</div>

      <aside
        className="rent-wallet-checkin-aside rent-wallet-checkin-aside--right"
        aria-label="3 απλά βήματα"
      >
        <p className="rent-wallet-checkin-kicker">3 απλά βήματα</p>
        <ol className="rent-wallet-checkin-steps">
          <li>
            <span className="rent-wallet-checkin-chevron" aria-hidden>
              »
            </span>
            <span>
              Ανοίξτε το My Wallet και βρείτε την κράτησή σας με τον αριθμό κράτησης και το
              επώνυμό σας.
            </span>
          </li>
          <li>
            <span className="rent-wallet-checkin-chevron" aria-hidden>
              »
            </span>
            <span>Συμπληρώστε τα στοιχεία σας στη φόρμα Online Check-In.</span>
          </li>
          <li>
            <span className="rent-wallet-checkin-chevron" aria-hidden>
              »
            </span>
            <span>
              Στο γραφείο δείξτε το QR της κράτησης, το δίπλωμα οδήγησης και την ταυτότητα ή το
              διαβατήριό σας — και παραλάβετε το κλειδί.
            </span>
          </li>
        </ol>
      </aside>
    </div>
  );
}
