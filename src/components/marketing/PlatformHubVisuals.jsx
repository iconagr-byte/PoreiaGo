/** CSS product mockups for the marketing hub — no external assets. */
import MockBoardingQr from './MockBoardingQr.jsx';

export function HeroProductStage() {
  return (
    <div className="pg-hub-stage" aria-hidden>
      <div className="pg-hub-ribbon" />
      <div className="pg-hub-stage-stack">
        <div className="pg-hub-desk">
          <div className="pg-hub-desk-bar">
            <span />
            <span />
            <span />
            <em>office.poreiago.com</em>
          </div>
          <div className="pg-hub-desk-body">
            <div className="pg-hub-desk-side">
              <i />
              <i />
              <i className="is-on" />
              <i />
            </div>
            <div className="pg-hub-desk-main">
              <strong>Σήμερα · 3 εκδρομές</strong>
              <div className="pg-hub-meter">
                <span style={{ width: '78%' }} />
              </div>
              <div className="pg-hub-bars">
                {[42, 68, 55, 88, 72, 94, 61].map((h, i) => (
                  <b key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="pg-hub-desk-row">
                <span>Σαντορίνη</span>
                <em>24/28</em>
              </div>
              <div className="pg-hub-desk-row">
                <span>Μετέωρα</span>
                <em>18/20</em>
              </div>
            </div>
          </div>
        </div>

        <div className="pg-hub-phone">
          <div className="pg-hub-phone-notch" />
          <p className="pg-hub-phone-kicker">My Wallet</p>
          <strong>Εισιτήριο</strong>
          <span className="pg-hub-phone-trip">Σαντορίνη · Αύριο 07:30</span>
          <MockBoardingQr className="pg-hub-qr pg-hub-qr--mark" />
          <span className="pg-hub-phone-seat">Θέση 12A · Ελένη Κ.</span>
        </div>
      </div>
    </div>
  );
}

