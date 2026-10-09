import {
  HERO_BACKGROUND_IMAGE,
  PLATFORM_NAME,
  SERVICE_HUB,
} from '../../lib/marketing/platformCopy.js';
import '../../styles/platform-service-hub.css';

function scrollToSession(event, sessionId) {
  const el = document.getElementById(sessionId);
  if (!el) return;
  event.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    window.history.replaceState(null, '', `#${sessionId}`);
  }
}

/**
 * Marketing homepage hub — brand-first chooser: buses session vs rent session.
 */
export default function PlatformServiceHub() {
  return (
    <section className="pg-hub" aria-label={`${PLATFORM_NAME} — επιλογή υπηρεσίας`}>
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
          <h1 className="pg-hub-headline">{SERVICE_HUB.headline}</h1>
          <p className="pg-hub-support">{SERVICE_HUB.support}</p>

          <div className="pg-hub-doors" role="group" aria-label="Πόρτες υπηρεσιών">
            <a
              href="#session-buses"
              className="pg-hub-door pg-hub-door--buses"
              onClick={(e) => scrollToSession(e, 'session-buses')}
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

            <a
              href="#session-rent"
              className="pg-hub-door pg-hub-door--rent"
              onClick={(e) => scrollToSession(e, 'session-rent')}
            >
              <span className="pg-hub-door-icon material-symbols-outlined" aria-hidden>
                car_rental
              </span>
              <span className="pg-hub-door-copy">
                <strong>{SERVICE_HUB.rentLabel}</strong>
                <span>{SERVICE_HUB.rentHint}</span>
              </span>
              <span className="pg-hub-door-arrow material-symbols-outlined" aria-hidden>
                arrow_downward
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
