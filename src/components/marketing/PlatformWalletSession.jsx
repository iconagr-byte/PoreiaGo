/**
 * Buses homepage — My Wallet session (hook + pass graphic + what it does).
 */
import { Link } from 'react-router-dom';
import { WALLET_SESSION } from '../../lib/marketing/platformCopy.js';
import '../../styles/platform-service-sessions.css';

function renderHook(hook, accent) {
  if (!accent || !hook.includes(accent)) return hook;
  const [before, after] = hook.split(accent);
  return (
    <>
      {before}
      <em className="pg-wallet-hook-accent">{accent}</em>
      {after}
    </>
  );
}

export default function PlatformWalletSession() {
  const v = WALLET_SESSION.visual;

  return (
    <section
      id={WALLET_SESSION.id}
      className="pg-session pg-session--wallet"
      aria-labelledby="wallet-session-hook"
    >
      <div className="pg-wallet-atmosphere" aria-hidden>
        <div className="pg-wallet-atmosphere-glow" />
        <div className="pg-wallet-atmosphere-orb pg-wallet-atmosphere-orb--a" />
        <div className="pg-wallet-atmosphere-orb pg-wallet-atmosphere-orb--b" />
      </div>

      <div className="pg-wallet-layout">
        <div className="pg-session-intro pg-session-intro--wallet">
          <p className="pg-session-kicker pg-wallet-rise" style={{ '--pg-rise-delay': '0ms' }}>
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>
              account_balance_wallet
            </span>
            {WALLET_SESSION.kicker}
          </p>
          <h2
            id="wallet-session-hook"
            className="pg-session-hook pg-wallet-rise"
            style={{ '--pg-rise-delay': '70ms' }}
          >
            {renderHook(WALLET_SESSION.hook, WALLET_SESSION.hookAccent)}
          </h2>
          <p className="pg-session-support pg-wallet-rise" style={{ '--pg-rise-delay': '130ms' }}>
            {WALLET_SESSION.support}
          </p>

          <ul
            className="pg-wallet-points pg-wallet-rise"
            style={{ '--pg-rise-delay': '190ms' }}
            aria-label="Τι κάνει το My Wallet"
          >
            {WALLET_SESSION.points.map((point) => (
              <li key={point.label}>
                <span className="pg-wallet-point-icon material-symbols-outlined" aria-hidden>
                  {point.icon}
                </span>
                <div>
                  <strong>{point.label}</strong>
                  {point.detail ? <span>{point.detail}</span> : null}
                </div>
              </li>
            ))}
          </ul>

          <Link
            to={WALLET_SESSION.ctaTo}
            className="pg-session-cta pg-session-cta--wallet pg-wallet-rise"
            style={{ '--pg-rise-delay': '260ms' }}
          >
            {WALLET_SESSION.ctaLabel}
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </Link>
        </div>

        <div
          className="pg-wallet-visual pg-wallet-rise"
          style={{ '--pg-rise-delay': '160ms' }}
          aria-hidden
        >
          <div className="pg-wallet-phone">
            <div className="pg-wallet-phone-bezel">
              <div className="pg-wallet-phone-notch" />
              <div className="pg-wallet-phone-screen">
                <p className="pg-wallet-phone-kicker">My Wallet</p>
                <div className="pg-wallet-pass-stack">
                  <article className="pg-wallet-pass pg-wallet-pass--back">
                    <span className="pg-wallet-pass-route">Θεσ/νίκη → Βόλος</span>
                    <span className="pg-wallet-pass-meta">Θέση 4C</span>
                  </article>
                  <article className="pg-wallet-pass pg-wallet-pass--mid">
                    <span className="pg-wallet-pass-route">Ρόδος · ημερήσια</span>
                    <span className="pg-wallet-pass-meta">Θέση 8B</span>
                  </article>
                  <article className="pg-wallet-pass pg-wallet-pass--front">
                    <div className="pg-wallet-pass-top">
                      <span className="pg-wallet-pass-badge">{v.status}</span>
                      <span className="material-symbols-outlined" aria-hidden>
                        confirmation_number
                      </span>
                    </div>
                    <p className="pg-wallet-pass-route-lg">{v.route}</p>
                    <div className="pg-wallet-pass-row">
                      <span>{v.when}</span>
                      <span>{v.seat}</span>
                    </div>
                    <div className="pg-wallet-pass-qr" />
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
