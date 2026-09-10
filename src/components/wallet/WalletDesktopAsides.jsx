/**
 * Desktop / tablet side columns for My Wallet home — how it works.
 */
export default function WalletDesktopAsides({ side = 'left', hasTicket = false }) {
  if (side === 'right') {
    return (
      <aside className="wallet-desk-aside wallet-desk-aside--right" aria-label="Πώς λειτουργεί">
        <p className="wallet-desk-aside-kicker">Πώς λειτουργεί</p>
        <h2 className="wallet-desk-aside-title">
          {hasTicket ? (
            <>
              Από το Wallet
              <br />
              στην επιβίβαση
            </>
          ) : (
            <>
              Τρία απλά
              <br />
              βήματα
            </>
          )}
        </h2>
        <ol className="wallet-desk-aside-steps">
          <li>
            <span className="wallet-desk-aside-step">1</span>
            <div>
              <strong>{hasTicket ? 'Ανοίξτε το εισιτήριο' : 'Κάντε κράτηση'}</strong>
              <span>
                {hasTicket
                  ? 'Το QR ανανεώνεται αυτόματα κάθε 30″.'
                  : 'Επιλέξτε εκδρομή και ολοκληρώστε πληρωμή.'}
              </span>
            </div>
          </li>
          <li>
            <span className="wallet-desk-aside-step">2</span>
            <div>
              <strong>{hasTicket ? 'Φτάστε νωρίς' : 'Αποθηκεύστε στο Wallet'}</strong>
              <span>
                {hasTicket
                  ? '15′ πριν την αναχώρηση στο σημείο επιβίβασης.'
                  : 'Με το ίδιο email της κράτησης εμφανίζεται το QR.'}
              </span>
            </div>
          </li>
          <li>
            <span className="wallet-desk-aside-step">3</span>
            <div>
              <strong>Επιβιβαστείτε με QR</strong>
              <span>Δείξτε το στον οδηγό — χωρίς χαρτί ή PDF.</span>
            </div>
          </li>
        </ol>
        {!hasTicket ? (
          <p className="wallet-desk-aside-note">
            <strong>Ήδη έχετε κωδικό;</strong> Πατήστε «Έχω ήδη κωδικό κράτησης» και συνδεθείτε με
            το email της κράτησης.
          </p>
        ) : null}
      </aside>
    );
  }

  return (
    <aside className="wallet-desk-aside wallet-desk-aside--left" aria-label="Σχετικά με το My Wallet">
      <p className="wallet-desk-aside-kicker">My Wallet · Λεωφορεία</p>
      <h2 className="wallet-desk-aside-title">
        {hasTicket ? (
          <>
            Το εισιτήριό σας,
            <br />
            πάντα μαζί σας
          </>
        ) : (
          <>
            Ένα Wallet για
            <br />
            όλα τα ταξίδια
          </>
        )}
      </h2>
      <p className="wallet-desk-aside-lead">
        {hasTicket
          ? 'Κρατήστε ανοιχτό το QR στην επιβίβαση. Μπορείτε επίσης να το αποθηκεύσετε στο κινητό ή να το στείλετε στο email σας.'
          : 'Κρατήσεις, θέση, QR επιβίβασης και ειδοποιήσεις — όλα σε μία οθόνη, στον υπολογιστή ή στο κινητό.'}
      </p>
      <ul className="wallet-desk-aside-list">
        <li>
          <span className="material-symbols-outlined" aria-hidden>
            qr_code_2
          </span>
          <div>
            <strong>Ζωντανό QR</strong>
            <span>Ανανεώνεται για ασφαλή επιβίβαση.</span>
          </div>
        </li>
        <li>
          <span className="material-symbols-outlined" aria-hidden>
            confirmation_number
          </span>
          <div>
            <strong>Όλες οι κρατήσεις</strong>
            <span>Προσεχή και παλαιά ταξίδια σε λίστα.</span>
          </div>
        </li>
        <li>
          <span className="material-symbols-outlined" aria-hidden>
            smartphone
          </span>
          <div>
            <strong>Εγκατάσταση στο κινητό</strong>
            <span>PWA — λειτουργεί και offline.</span>
          </div>
        </li>
      </ul>
    </aside>
  );
}
