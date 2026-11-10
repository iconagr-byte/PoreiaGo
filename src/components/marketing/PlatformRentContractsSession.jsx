/**
 * /rent — digital contracts session (hook + signature graphic + what it does).
 */
import { RENT_CONTRACTS_SESSION } from '../../lib/marketing/platformCopy.js';
import '../../styles/platform-service-sessions.css';

function renderHook(hook, accent) {
  if (!accent || !hook.includes(accent)) return hook;
  const [before, after] = hook.split(accent);
  return (
    <>
      {before}
      <em className="pg-rent-contracts-hook-accent">{accent}</em>
      {after}
    </>
  );
}

export default function PlatformRentContractsSession() {
  const v = RENT_CONTRACTS_SESSION.visual;

  const scrollToFleet = (e) => {
    const el = document.getElementById('rent-guest-fleet');
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section
      id={RENT_CONTRACTS_SESSION.id}
      className="pg-session pg-session--rent-contracts"
      aria-labelledby="rent-contracts-session-hook"
    >
      <div className="pg-rent-contracts-atmosphere" aria-hidden>
        <div className="pg-rent-contracts-atmosphere-glow" />
        <div className="pg-rent-contracts-orb pg-rent-contracts-orb--a" />
        <div className="pg-rent-contracts-orb pg-rent-contracts-orb--b" />
      </div>

      <div className="pg-rent-contracts-layout">
        <div className="pg-session-intro pg-session-intro--rent-contracts">
          <p
            className="pg-session-kicker pg-rent-contracts-rise"
            style={{ '--pg-rise-delay': '0ms' }}
          >
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>
              contract
            </span>
            {RENT_CONTRACTS_SESSION.kicker}
          </p>
          <h2
            id="rent-contracts-session-hook"
            className="pg-session-hook pg-rent-contracts-rise"
            style={{ '--pg-rise-delay': '70ms' }}
          >
            {renderHook(RENT_CONTRACTS_SESSION.hook, RENT_CONTRACTS_SESSION.hookAccent)}
          </h2>
          <p
            className="pg-session-support pg-rent-contracts-rise"
            style={{ '--pg-rise-delay': '130ms' }}
          >
            {RENT_CONTRACTS_SESSION.support}
          </p>

          <ul
            className="pg-rent-contracts-points pg-rent-contracts-rise"
            style={{ '--pg-rise-delay': '190ms' }}
            aria-label="Τι περιλαμβάνει το ψηφιακό συμβόλαιο"
          >
            {RENT_CONTRACTS_SESSION.points.map((point) => (
              <li key={point.label}>
                <span className="pg-rent-contracts-point-icon material-symbols-outlined" aria-hidden>
                  {point.icon}
                </span>
                <div>
                  <strong>{point.label}</strong>
                  {point.detail ? <span>{point.detail}</span> : null}
                </div>
              </li>
            ))}
          </ul>

          <a
            href={RENT_CONTRACTS_SESSION.ctaHref}
            className="pg-session-cta pg-session-cta--rent-contracts pg-rent-contracts-rise"
            style={{ '--pg-rise-delay': '260ms' }}
            onClick={scrollToFleet}
          >
            {RENT_CONTRACTS_SESSION.ctaLabel}
            <span className="material-symbols-outlined" aria-hidden>
              arrow_upward
            </span>
          </a>
        </div>

        <div
          className="pg-rent-contracts-visual pg-rent-contracts-rise"
          style={{ '--pg-rise-delay': '160ms' }}
          aria-hidden
        >
          <div className="pg-rent-contracts-doc">
            <div className="pg-rent-contracts-doc-seal">
              <span className="material-symbols-outlined">verified</span>
            </div>
            <header className="pg-rent-contracts-doc-head">
              <p className="pg-rent-contracts-doc-kicker">{v.title}</p>
              <p className="pg-rent-contracts-doc-plate">{v.plate}</p>
            </header>
            <ul className="pg-rent-contracts-doc-terms">
              {v.terms.map((term) => (
                <li key={term}>
                  <span className="material-symbols-outlined" aria-hidden>
                    check_circle
                  </span>
                  {term}
                </li>
              ))}
            </ul>
            <div className="pg-rent-contracts-doc-sign">
              <p className="pg-rent-contracts-doc-sign-label">Υπογραφή πελάτη</p>
              <div className="pg-rent-contracts-doc-ink">
                <svg viewBox="0 0 180 48" fill="none" aria-hidden>
                  <path
                    className="pg-rent-contracts-ink-path"
                    d="M8 30 C28 8, 42 42, 62 22 S96 6, 118 28 S148 40, 172 18"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="pg-rent-contracts-doc-status">
                <span className="material-symbols-outlined" aria-hidden>
                  draw
                </span>
                {v.status}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
