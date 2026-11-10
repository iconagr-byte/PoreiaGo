/**
 * Public marketing block for Rent safety / trip services.
 * Visible without an active booking — guest home, /rent/services, account help.
 */
import { RENT_SERVICE_FEATURES, rentServiceCopy } from '../../lib/rental/rentServicesCatalog.js';
import { getRentLang, t } from '../../lib/rental/rentI18n.js';

export default function RentalServicesShowcase({
  compact = false,
  onCta,
  ctaLabel,
  showCta = true,
} = {}) {
  const lang = getRentLang();
  const heading = t('services_title', lang);
  const lead = t('services_lead', lang);

  return (
    <section
      className={`rent-services${compact ? ' rent-services--compact' : ''}`}
      aria-label={heading}
    >
      <div className="rent-services-head">
        <span className="rent-services-kicker">{t('services_kicker', lang)}</span>
        <h2 className="rent-services-title">{heading}</h2>
        <p className="rent-services-lead">{lead}</p>
      </div>

      <ul className="rent-services-list">
        {RENT_SERVICE_FEATURES.map((feature) => {
          const copy = rentServiceCopy(feature, lang);
          return (
            <li key={feature.id} className="rent-services-item">
              <span className="rent-services-icon" aria-hidden>
                <span className="material-symbols-outlined">{feature.icon}</span>
              </span>
              <div className="rent-services-copy">
                <strong>{copy.title}</strong>
                <p>{copy.copy}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {showCta && typeof onCta === 'function' ? (
        <button type="button" className="rent-services-cta" onClick={onCta}>
          <span className="material-symbols-outlined" aria-hidden>
            directions_car
          </span>
          {ctaLabel || t('services_cta', lang)}
        </button>
      ) : null}
    </section>
  );
}
