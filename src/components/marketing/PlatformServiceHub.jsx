import { Link } from 'react-router-dom';
import {
  HERO_BACKGROUND_IMAGE,
  PLATFORM_NAME,
  SERVICE_HUB,
} from '../../lib/marketing/platformCopy.js';
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
 * Marketing homepage — hero hook (how it works) first;
 * Λεωφορεία / Ενοικιάσεις chooser sits below the fold.
 */
export default function PlatformServiceHub() {
  return (
    <>
      <section className="pg-hub" aria-label={`${PLATFORM_NAME} — αρχική`}>
        <div className="pg-hub-media" aria-hidden>
          <img src={HERO_BACKGROUND_IMAGE} alt="" />
          <div className="pg-hub-media-veil" />
        </div>
        <div className="pg-hub-glow" aria-hidden />

        <div className="pg-hub-inner">
          <div className="pg-hub-copy">
            <p className="pg-hub-brand">
              <span className="pg-hub-brand-accent">{PLATFORM_NAME}</span>
            </p>
            <h1 className="pg-hub-headline">
              {SERVICE_HUB.hook}{' '}
              <span className="pg-hub-headline-accent">{SERVICE_HUB.hookAccent}</span>
            </h1>
            <p className="pg-hub-support">{SERVICE_HUB.support}</p>

            <div className="pg-hub-cta">
              <a
                href="#how-poreiago-works"
                className="pg-hub-cta-primary"
                onClick={(e) => scrollToId(e, 'how-poreiago-works')}
              >
                {SERVICE_HUB.primaryCta}
                <span className="material-symbols-outlined" aria-hidden>
                  arrow_downward
                </span>
              </a>
              <Link to="/grafeia" className="pg-hub-cta-secondary">
                {SERVICE_HUB.secondaryCta}
              </Link>
            </div>
          </div>
        </div>

        <a
          href="#how-poreiago-works"
          className="pg-hub-scroll"
          onClick={(e) => scrollToId(e, 'how-poreiago-works')}
          aria-label="Μετάβαση στο πώς δουλεύει"
        >
          <span className="material-symbols-outlined" aria-hidden>
            expand_more
          </span>
        </a>
      </section>

      <section
        id="how-poreiago-works"
        className="pg-hub-flow"
        aria-label="Πώς δουλεύει το PoreiaGo"
      >
        <div className="pg-hub-flow-inner">
          <header className="pg-hub-flow-intro">
            <p className="pg-hub-flow-kicker">Πώς δουλεύει</p>
            <h2 className="pg-hub-flow-title">Τρία βήματα · καθαρή ροή</h2>
          </header>

          <ol className="pg-hub-flow-steps">
            {SERVICE_HUB.flow.map((item, index) => (
              <li key={item.step} className="pg-hub-flow-step">
                <span className="pg-hub-flow-num" aria-hidden>
                  {item.step}
                </span>
                {index < SERVICE_HUB.flow.length - 1 ? (
                  <span className="pg-hub-flow-rail" aria-hidden />
                ) : null}
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>

          <div className="pg-hub-choose" id="choose-service">
            <p className="pg-hub-flow-kicker">{SERVICE_HUB.chooseKicker}</p>
            <h2 className="pg-hub-choose-title">{SERVICE_HUB.chooseTitle}</h2>
            <p className="pg-hub-choose-support">{SERVICE_HUB.chooseSupport}</p>

            <div className="pg-hub-doors" role="group" aria-label="Πόρτες υπηρεσιών">
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
          </div>
        </div>
      </section>
    </>
  );
}
