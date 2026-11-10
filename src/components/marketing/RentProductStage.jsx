/** CSS product mockups for /rent marketing hub — fleet desk + rent Wallet pass. */

export default function RentProductStage() {
  return (
    <div className="rent-show-stage" aria-hidden>
      <div className="rent-show-ribbon" />
      <div className="rent-show-stage-stack">
        <div className="rent-show-desk">
          <div className="rent-show-desk-bar">
            <span />
            <span />
            <span />
            <em>rent.poreiago.com</em>
          </div>
          <div className="rent-show-desk-body">
            <div className="rent-show-desk-side">
              <i className="is-on" />
              <i />
              <i />
              <i />
            </div>
            <div className="rent-show-desk-main">
              <strong>Στόλος · διαθέσιμα σήμερα</strong>
              <div className="rent-show-meter">
                <span style={{ width: '72%' }} />
              </div>
              <div className="rent-show-cars">
                <div className="rent-show-car-row">
                  <span className="rent-show-car-dot" />
                  <span>Yaris Cross</span>
                  <em>€42</em>
                </div>
                <div className="rent-show-car-row">
                  <span className="rent-show-car-dot rent-show-car-dot--teal" />
                  <span>Corolla Hybrid</span>
                  <em>€48</em>
                </div>
                <div className="rent-show-car-row">
                  <span className="rent-show-car-dot rent-show-car-dot--amber" />
                  <span>Transit Van</span>
                  <em>€68</em>
                </div>
              </div>
              <div className="rent-show-desk-row">
                <span>15–18 Νοε</span>
                <em>6 οχήματα</em>
              </div>
            </div>
          </div>
        </div>

        <div className="rent-show-phone">
          <div className="rent-show-phone-notch" />
          <p className="rent-show-phone-kicker">My Wallet · Rent</p>
          <strong>Κράτηση</strong>
          <span className="rent-show-phone-trip">Compact · Παραλαβή 10:00</span>
          <div className="rent-show-qr">
            {Array.from({ length: 36 }).map((_, i) => (
              <i key={i} className={i % 3 === 0 || i % 5 === 0 ? 'on' : ''} />
            ))}
          </div>
          <span className="rent-show-phone-seat">DEMO-RENT · CDW</span>
        </div>
      </div>
    </div>
  );
}
