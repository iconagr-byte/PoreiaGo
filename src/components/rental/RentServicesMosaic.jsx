/**
 * Coastal story panes under /rent fleet — office-configurable, not a Hertz clone.
 */
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { resolveRentServicesMosaic } from '../../lib/rental/rentServicesMosaic.js';

function paneTone(index) {
  const tones = ['lagoon', 'foam', 'ink', 'sand'];
  return tones[index % tones.length];
}

export default function RentServicesMosaic({ appearance = {} } = {}) {
  const mosaic = resolveRentServicesMosaic(appearance);
  if (!mosaic.enabled || !mosaic.cards.length) return null;

  return (
    <section
      id="rent-services-mosaic"
      className="rent-svc-mosaic"
      aria-labelledby="rent-svc-mosaic-title"
    >
      <div className="rent-svc-mosaic-inner">
        <header className="rent-svc-mosaic-head">
          {mosaic.kicker ? <p className="rent-svc-mosaic-kicker">{mosaic.kicker}</p> : null}
          <h2 id="rent-svc-mosaic-title" className="rent-svc-mosaic-title">
            {mosaic.title}
          </h2>
          {mosaic.lead ? <p className="rent-svc-mosaic-lead">{mosaic.lead}</p> : null}
        </header>

        <ul className="rent-svc-mosaic-grid">
          {mosaic.cards.map((card, index) => {
            const src = card.image_url ? resolveSiteAssetUrl(card.image_url) : '';
            const tone = paneTone(index);
            const indexLabel = String(index + 1).padStart(2, '0');
            const isExternal = /^https?:\/\//i.test(card.href);
            return (
              <li key={card.id} className={`rent-svc-pane rent-svc-pane--${tone}`}>
                <a
                  className="rent-svc-pane-link"
                  href={card.href}
                  {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <div className="rent-svc-pane-media" aria-hidden>
                    {src ? (
                      <img src={src} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <div className="rent-svc-pane-fallback">
                        <span className="material-symbols-outlined">{card.icon || 'spa'}</span>
                      </div>
                    )}
                    <span className="rent-svc-pane-index">{indexLabel}</span>
                  </div>
                  <div className="rent-svc-pane-copy">
                    <h3>{card.title}</h3>
                    {card.subtitle ? <p>{card.subtitle}</p> : null}
                    <span className="rent-svc-pane-cta">
                      Μάθετε περισσότερα
                      <span className="material-symbols-outlined" aria-hidden>
                        arrow_forward
                      </span>
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
