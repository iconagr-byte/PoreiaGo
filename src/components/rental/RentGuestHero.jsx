import {
  RENT_GUEST_HERO,
  RENT_GUEST_HERO_IMAGE,
  rentGuestHeroStats,
} from '../../lib/rental/rentGuestHero.js';
import { readPageSlider } from '../../lib/homepage/pageSlider.js';
import SiteHeroSlider from '../shared/SiteHeroSlider.jsx';

/**
 * Full-bleed photo hero for guest /rent — mirrors platform bus landing form.
 * Uses page slider when rent_slider_* is enabled in site appearance.
 */
export default function RentGuestHero({
  brandLabel = 'Ενοικίαση',
  title,
  titleAccent,
  copy,
  carCount = 0,
  vanCount = 0,
  siteAppearance,
  onBrowseFleet,
  onStartSearch,
  onRequireLogin,
} = {}) {
  const headline = String(title || '').trim() || RENT_GUEST_HERO.title;
  const accent = String(titleAccent || '').trim() || RENT_GUEST_HERO.titleAccent;
  const subtitle = String(copy || '').trim();
  const stats = rentGuestHeroStats({ carCount, vanCount });
  const slider = readPageSlider(siteAppearance, 'rent');
  const startSearch =
    typeof onStartSearch === 'function'
      ? onStartSearch
      : () => {
          document.getElementById('rent-guest-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

  return (
    <section className="rent-hero rent-hero--landing" aria-label="Ενοικίαση">
      <div className="rent-hero-media" aria-hidden={!slider.enabled}>
        {slider.enabled ? (
          <SiteHeroSlider
            slides={slider.slides}
            autoplay={slider.autoplay}
            intervalSec={slider.interval_sec}
            options={slider.options}
            variant="media"
            accent="rent"
            ariaLabel="Hero slider ενοικιάσεων"
            className="rent-hero-slider"
          />
        ) : (
          <img src={RENT_GUEST_HERO_IMAGE} alt="" />
        )}
        <div className="rent-hero-shade rent-hero-shade--x" />
        <div className="rent-hero-shade rent-hero-shade--y" />
        <div className="rent-hero-glow" />
        <div className="rent-hero-grid" />
      </div>

      <div className="rent-hero-landing-inner">
        <p className="rent-hero-brand rent-hero-brand--landing">{brandLabel}</p>

        <h1 className="rent-hero-landing-title">
          {headline}{' '}
          <span className="rent-hero-accent">{accent}</span>
        </h1>

        {subtitle ? <p className="rent-hero-landing-copy">{subtitle}</p> : null}

        <div className="rent-hero-actions">
          <button type="button" className="rent-hero-cta rent-hero-cta--primary" onClick={startSearch}>
            Ξεκίνα αναζήτηση
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </button>
          <button type="button" className="rent-hero-cta rent-hero-cta--teal" onClick={onBrowseFleet}>
            <span className="material-symbols-outlined" aria-hidden>
              directions_car
            </span>
            Δες τον στόλο
          </button>
        </div>

        <p className="rent-hero-tagline">{RENT_GUEST_HERO.tagline}</p>

        <div className="rent-hero-stats">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rent-hero-stat${s.accent ? ' rent-hero-stat--accent' : ''}`}
            >
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
