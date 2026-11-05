import { Link } from 'react-router-dom';
import { PLATFORM_NAME, SERVICE_HUB } from '../../lib/marketing/platformCopy.js';
import { HeroProductStage } from './PlatformHubVisuals.jsx';
import '../../styles/platform-service-hub.css';

function scrollToId(event, id) {
  const el = document.getElementById(id);
  if (!el) return;
  event.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    window.history.replaceState(null, '', `#${id}`);
  }
}

/**
 * Marketing homepage — Stripe-inspired light hero + how-it-works visuals;
 * Λεωφορεία / Ενοικιάσεις chooser sits below the fold.
 */
export default function PlatformServiceHub() {
  return (
    <>
      <section className="pg-hub" aria-label={`${PLATFORM_NAME} — αρχική`}>
        <div className="pg-hub-inner">
          <div className="pg-hub-copy">
            <p className="pg-hub-micro">{SERVICE_HUB.micro}</p>
            <h1 className="pg-hub-headline">
              <span className="pg-hub-brand-line">{PLATFORM_NAME}</span>
              {SERVICE_HUB.hook}{' '}
              <span className="pg-hub-headline-accent">{SERVICE_HUB.hookLine2}</span>
            </h1>
            <p className="pg-hub-support">{SERVICE_HUB.support}</p>

            <div className="pg-hub-cta">
              <Link to="/grafeia" className="pg-hub-cta-primary">
                {SERVICE_HUB.primaryCta}
                <span className="material-symbols-outlined" aria-hidden>
                  arrow_forward
                </span>
              </Link>
              <a
                href="#choose-service"
                className="pg-hub-cta-secondary"
                onClick={(e) => scrollToId(e, 'choose-service')}
              >
                {SERVICE_HUB.secondaryCta}
              </a>
            </div>
          </div>

          <HeroProductStage />
        </div>
      </section>

      <section
        id="choose-service"
        className="pg-hub-flow"
        aria-label="Υπηρεσίες PoreiaGo"
      >
        <div className="pg-hub-flow-inner">
          <div className="pg-hub-choose">
            <h2 className="pg-hub-choose-title">{SERVICE_HUB.chooseTitle}</h2>
            <p className="pg-hub-choose-support">{SERVICE_HUB.chooseSupport}</p>

            <div className="pg-hub-doors" role="group" aria-label="Υπηρεσίες">
              <a
                href="#session-buses"
                className="pg-hub-door pg-hub-door--buses"
                onClick={(e) => scrollToId(e, 'session-buses')}
              >
                <span className="pg-hub-door-icon material-symbols-outlined" aria-hidden>
                  directions_bus
                </span>
                <span className="pg-hub-door-copy">
                  <strong>{SERVICE_HUB.busesLabel}</strong>
                  <span>{SERVICE_HUB.busesHint}</span>
                </span>
                <span className="pg-hub-door-arrow material-symbols-outlined" aria-hidden>
                  arrow_downward
                </span>
              </a>

              <Link to="/rent" className="pg-hub-door pg-hub-door--rent">
                <span className="pg-hub-door-icon material-symbols-outlined" aria-hidden>
                  car_rental
                </span>
                <span className="pg-hub-door-copy">
                  <strong>{SERVICE_HUB.rentLabel}</strong>
                  <span>{SERVICE_HUB.rentHint}</span>
                </span>
                <span className="pg-hub-door-arrow material-symbols-outlined" aria-hidden>
                  arrow_forward
                </span>
              </Link>
            </div>

            <Link to="/grafeia" className="pg-hub-contracts">
              <span className="pg-hub-contracts-glow" aria-hidden />
              <span className="pg-hub-contracts-doc" aria-hidden>
                <span className="pg-hub-contracts-doc-seal">
                  <span className="material-symbols-outlined">verified</span>
                </span>
                <span className="pg-hub-contracts-doc-lines">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="pg-hub-contracts-doc-tag">€</span>
              </span>
              <span className="pg-hub-contracts-copy">
                <strong>{SERVICE_HUB.contractsCta}</strong>
                <span>{SERVICE_HUB.contractsHint}</span>
                <span className="pg-hub-contracts-chips">
                  {SERVICE_HUB.contractsChips.map((chip) => (
                    <em key={chip}>{chip}</em>
                  ))}
                </span>
              </span>
              <span className="pg-hub-contracts-go" aria-hidden>
                <span className="material-symbols-outlined">arrow_forward</span>
              </span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
