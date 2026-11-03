/** CSS product mockups for the marketing hub — no external assets. */

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
          <div className="pg-hub-qr">
            {Array.from({ length: 36 }).map((_, i) => (
              <i key={i} className={i % 3 === 0 || i % 7 === 0 ? 'on' : ''} />
            ))}
          </div>
          <span className="pg-hub-phone-seat">Θέση 12A · Ελένη Κ.</span>
        </div>
      </div>
    </div>
  );
}

export function FlowVisual({ kind }) {
  if (kind === 'book') {
    return (
      <div className="pg-flow-viz pg-flow-viz--book" aria-hidden>
        <div className="pg-flow-phone-mini">
          <span>Κράτηση</span>
          <strong>€48</strong>
          <em>Επιβεβαίωση</em>
        </div>
        <div className="pg-flow-ticket">
          <b />
          <span>QR ready</span>
        </div>
      </div>
    );
  }
  if (kind === 'run') {
    return (
      <div className="pg-flow-viz pg-flow-viz--run" aria-hidden>
        <div className="pg-flow-map">
          <span className="pg-flow-pin" />
          <span className="pg-flow-trail" />
        </div>
        <div className="pg-flow-live">
          <i />
          Live GPS
        </div>
      </div>
    );
  }
  return (
    <div className="pg-flow-viz pg-flow-viz--office" aria-hidden>
      <div className="pg-flow-brand-card">
        <b>PG</b>
        <span>Το brand σας</span>
        <em>www.γραφείο.gr</em>
      </div>
      <div className="pg-flow-check">
        <span className="material-symbols-outlined">check</span>
        Έτοιμο
      </div>
    </div>
  );
}
