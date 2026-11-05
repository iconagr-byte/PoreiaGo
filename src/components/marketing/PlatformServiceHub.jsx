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

            <div className="pg-hub-contracts-stage" id="hub-contracts">
              <header className="pg-hub-contracts-intro">
                <p className="pg-hub-contracts-kicker">{SERVICE_HUB.contractsKicker}</p>
                <h3 className="pg-hub-contracts-hook">
                  {SERVICE_HUB.contractsHook}{' '}
                  <span>{SERVICE_HUB.contractsHookAccent}</span>
                </h3>
                <p className="pg-hub-contracts-support">{SERVICE_HUB.contractsSupport}</p>
              </header>

              <div className="pg-hub-contracts-pair" role="list">
                <Link
                  to="/grafeia"
                  className="pg-hub-plan-card pg-hub-plan-card--buses"
                  role="listitem"
                >
                  <span className="pg-hub-plan-card-glow" aria-hidden />
                  <span className="pg-hub-plan-visual" aria-hidden>
                    <span className="pg-hub-plan-sheet pg-hub-plan-sheet--back" />
                    <span className="pg-hub-plan-sheet pg-hub-plan-sheet--front">
                      <span className="pg-hub-plan-sheet-bar" />
                      <span className="pg-hub-plan-sheet-lines">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    <span className="pg-hub-plan-mark">
                      <span className="material-symbols-outlined">directions_bus</span>
                    </span>
                  </span>
                  <span className="pg-hub-plan-body">
                    <em className="pg-hub-plan-badge">{SERVICE_HUB.busesContract.badge}</em>
                    <strong>{SERVICE_HUB.busesContract.title}</strong>
                    <span className="pg-hub-plan-hook">{SERVICE_HUB.busesContract.hook}</span>
                    <span className="pg-hub-plan-price">
                      <small>{SERVICE_HUB.busesContract.priceLabel}</small>
                      <b>{SERVICE_HUB.busesContract.price}</b>
                      <small>{SERVICE_HUB.busesContract.priceSuffix}</small>
                    </span>
                    <ul className="pg-hub-plan-points">
                      {SERVICE_HUB.busesContract.points.map((point) => (
                        <li key={point}>
                          <span className="material-symbols-outlined" aria-hidden>
                            check_circle
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                    <span className="pg-hub-plan-cta">
                      {SERVICE_HUB.busesContract.cta}
                      <span className="material-symbols-outlined" aria-hidden>
                        arrow_forward
                      </span>
                    </span>
                  </span>
                </Link>

                <Link
                  to="/grafeia#contracts-rent"
                  className="pg-hub-plan-card pg-hub-plan-card--rent"
                  role="listitem"
                >
                  <span className="pg-hub-plan-card-glow" aria-hidden />
                  <span className="pg-hub-plan-visual" aria-hidden>
                    <span className="pg-hub-plan-sheet pg-hub-plan-sheet--back pg-hub-plan-sheet--teal" />
                    <span className="pg-hub-plan-sheet pg-hub-plan-sheet--front pg-hub-plan-sheet--mint">
                      <span className="pg-hub-plan-sheet-bar" />
                      <span className="pg-hub-plan-sheet-lines">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    <span className="pg-hub-plan-mark pg-hub-plan-mark--rent">
                      <span className="material-symbols-outlined">car_rental</span>
                    </span>
                    <span className="pg-hub-plan-plus">
                      <span className="material-symbols-outlined">add</span>
                    </span>
                  </span>
                  <span className="pg-hub-plan-body">
                    <em className="pg-hub-plan-badge pg-hub-plan-badge--rent">
                      {SERVICE_HUB.rentAddonContract.badge}
                    </em>
                    <strong>{SERVICE_HUB.rentAddonContract.title}</strong>
                    <span className="pg-hub-plan-hook">{SERVICE_HUB.rentAddonContract.hook}</span>
                    <span className="pg-hub-plan-price pg-hub-plan-price--rent">
                      <small>{SERVICE_HUB.rentAddonContract.priceLabel}</small>
                      <b>{SERVICE_HUB.rentAddonContract.price}</b>
                      <small>{SERVICE_HUB.rentAddonContract.priceSuffix}</small>
                    </span>
                    <ul className="pg-hub-plan-points">
                      {SERVICE_HUB.rentAddonContract.points.map((point) => (
                        <li key={point}>
                          <span className="material-symbols-outlined" aria-hidden>
                            check_circle
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                    <span className="pg-hub-plan-cta pg-hub-plan-cta--rent">
                      {SERVICE_HUB.rentAddonContract.cta}
                      <span className="material-symbols-outlined" aria-hidden>
                        arrow_forward
                      </span>
                    </span>
                  </span>
                </Link>
              </div>

              <p className="pg-hub-contracts-all">
                <Link to="/grafeia">{SERVICE_HUB.contractsAllCta}</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
