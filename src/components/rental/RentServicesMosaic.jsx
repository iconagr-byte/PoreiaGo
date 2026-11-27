/**
 * Coastal story panes under /rent fleet — office-configurable, not a Hertz clone.
 * Cards open a detail sheet (when body is set) and follow the configured link.
 * In ?preview=1, a Builder chip opens Page Studio for photos + copy.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import {
  followRentServicesMosaicHref,
  resolveRentServicesMosaic,
} from '../../lib/rental/rentServicesMosaic.js';
import {
  PreviewBuilderControl,
  usePreviewDesignMode,
} from '../storefront/preview/PreviewDesignMode.jsx';

function paneTone(index) {
  const tones = ['lagoon', 'foam', 'ink', 'sand'];
  return tones[index % tones.length];
}

export default function RentServicesMosaic({ appearance = {} } = {}) {
  const navigate = useNavigate();
  const preview = usePreviewDesignMode();
  const liveAppearance = preview?.form || appearance;
  const mosaic = resolveRentServicesMosaic(liveAppearance);
  const [openCard, setOpenCard] = useState(null);
  const previewMode = Boolean(preview?.enabled);

  if ((!mosaic.enabled || !mosaic.cards.length) && !previewMode) return null;

  const goHref = (href) => {
    followRentServicesMosaicHref(href, { navigate });
  };

  const onCardActivate = (card) => {
    if (card.body) {
      setOpenCard(card);
      return;
    }
    goHref(card.href);
  };

  return (
    <section
      id="rent-services-mosaic"
      className={`rent-svc-mosaic${mosaic.enabled ? '' : ' is-preview-hidden'}`}
      aria-labelledby="rent-svc-mosaic-title"
      data-pdw-editable="copy"
    >
      <div className="rent-svc-mosaic-inner">
        <header className="rent-svc-mosaic-head">
          <div className="rent-svc-mosaic-head-row">
            <div className="rent-svc-mosaic-head-copy min-w-0 flex-1">
              {mosaic.kicker ? <p className="rent-svc-mosaic-kicker">{mosaic.kicker}</p> : null}
              <h2 id="rent-svc-mosaic-title" className="rent-svc-mosaic-title">
                {mosaic.title}
              </h2>
              {mosaic.lead ? <p className="rent-svc-mosaic-lead">{mosaic.lead}</p> : null}
            </div>
            <PreviewBuilderControl
              sectionId="copy"
              label="Υπηρεσίες γραφείου"
              buttonLabel="Builder"
              variant="inline"
              instanceId="rent-services-mosaic"
              className="rent-svc-mosaic-builder"
            />
          </div>
        </header>

        {!mosaic.enabled && previewMode ? (
          <p className="rent-svc-mosaic-preview-note">
            Η ενότητα είναι κρυφή στο live /rent — άνοιξε Builder για να την ενεργοποιήσεις.
          </p>
        ) : null}

        <ul className="rent-svc-mosaic-grid">
          {mosaic.cards.map((card, index) => {
            const src = card.image_url ? resolveSiteAssetUrl(card.image_url) : '';
            const tone = paneTone(index);
            const indexLabel = String(index + 1).padStart(2, '0');
            return (
              <li key={card.id} className={`rent-svc-pane rent-svc-pane--${tone}`}>
                <button
                  type="button"
                  className="rent-svc-pane-link"
                  onClick={() => onCardActivate(card)}
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
                      {card.cta_label}
                      <span className="material-symbols-outlined" aria-hidden>
                        arrow_forward
                      </span>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {openCard ? (
        <div
          className="rent-svc-detail"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rent-svc-detail-title"
          onClick={() => setOpenCard(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpenCard(null);
          }}
        >
          <div
            className="rent-svc-detail-card"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="rent-svc-detail-close"
              aria-label="Κλείσιμο"
              onClick={() => setOpenCard(null)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                close
              </span>
            </button>
            {openCard.image_url ? (
              <div className="rent-svc-detail-media" aria-hidden>
                <img
                  src={resolveSiteAssetUrl(openCard.image_url)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : null}
            <div className="rent-svc-detail-body">
              <h3 id="rent-svc-detail-title">{openCard.title}</h3>
              {openCard.subtitle ? <p className="rent-svc-detail-lead">{openCard.subtitle}</p> : null}
              {openCard.body ? <p className="rent-svc-detail-text">{openCard.body}</p> : null}
              <button
                type="button"
                className="rent-svc-detail-cta"
                onClick={() => {
                  const href = openCard.href;
                  setOpenCard(null);
                  goHref(href);
                }}
              >
                {openCard.cta_label}
                <span className="material-symbols-outlined" aria-hidden>
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
