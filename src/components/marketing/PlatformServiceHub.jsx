import { Link } from 'react-router-dom';
import {
  HERO_BACKGROUND_IMAGE,
  PLATFORM_NAME,
  SERVICE_HUB,
} from '../../lib/marketing/platformCopy.js';
import '../../styles/platform-service-hub.css';

/**
 * Marketing homepage hub — brand-first chooser: buses ops vs rent storefront.
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
            <a href="#platform-ops" className="pg-hub-door pg-hub-door--buses">
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
  );
}
