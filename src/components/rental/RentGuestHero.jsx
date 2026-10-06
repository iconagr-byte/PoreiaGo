import { useMemo } from 'react';
import {
  RENT_GUEST_HERO,
  RENT_GUEST_HERO_IMAGE,
  resolveRentGuestHeroBenefits,
} from '../../lib/rental/rentGuestHero.js';
import { readPageSlider } from '../../lib/homepage/pageSlider.js';
import SiteHeroSlider from '../shared/SiteHeroSlider.jsx';
import RentBrandMark from './RentBrandMark.jsx';

/**
 * Full-bleed guest /rent hero — Rentalcars-style: headline, trust checks, search in-hero.
 * No stays/flights nav — rent only.
 */
export default function RentGuestHero({
  brandLabel = 'Poreiago Rent',
  logoUrl = '',
  brandSubtitle = '',
  logoHeightPx,
  logoMaxWidthPx,
  logoRadiusPx,
  logoPaddingPx,
  logoBgMode,
  logoShadow,
  heroStyle = 'coastal',
  heroImageUrl = '',
  title,
  titleAccent,
  copy,
  benefits: benefitsProp,
  siteAppearance,
  children,
} = {}) {
  const headline = String(title || '').trim() || RENT_GUEST_HERO.title;
  const accent = String(titleAccent || '').trim() || RENT_GUEST_HERO.titleAccent;
  const subtitle = String(copy || '').trim();
  const benefits = useMemo(
    () => resolveRentGuestHeroBenefits(benefitsProp),
    [benefitsProp],
  );
  const slider = readPageSlider(siteAppearance, 'rent');

  const heroMode = String(heroStyle || 'coastal').trim().toLowerCase() || 'coastal';
  const photoSrc = String(heroImageUrl || '').trim() || RENT_GUEST_HERO_IMAGE;

  return (
    <section
      className={`rent-hero rent-hero--landing rent-hero--booking rent-hero--${heroMode}`}
      data-rent-hero={heroMode}
      aria-label="Ενοικίαση"
    >
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
          <img
            key={photoSrc}
            src={photoSrc}
            alt=""
            width={3840}
            height={2160}
            decoding="async"
            fetchPriority="high"
          />
        )}
        <div className="rent-hero-shade rent-hero-shade--x" />
        <div className="rent-hero-shade rent-hero-shade--y" />
        <div className="rent-hero-shade rent-hero-shade--bluefade" aria-hidden />
        <div className="rent-hero-shade rent-hero-shade--booking" />
      </div>

      <div className="rent-hero-landing-inner rent-hero-booking-inner">
        <div className="rent-hero-booking-brand">
          <RentBrandMark
            label={brandLabel}
            logoUrl={logoUrl}
            showName
            subtitle={brandSubtitle}
            variant="onDark"
            logoHeightPx={logoHeightPx}
            logoMaxWidthPx={logoMaxWidthPx}
            logoRadiusPx={logoRadiusPx}
            logoPaddingPx={logoPaddingPx}
            logoBgMode={logoBgMode}
            logoShadow={logoShadow}
          />
        </div>

        <h1 className="rent-hero-landing-title rent-hero-booking-title">
          <span className="rent-hero-title-main">{headline}</span>
          {accent ? <span className="rent-hero-accent">{accent}</span> : null}
        </h1>

        {subtitle ? <p className="rent-hero-landing-copy rent-hero-booking-copy">{subtitle}</p> : null}

        {benefits.length ? (
          <ul className="rent-hero-benefits" aria-label="Πλεονεκτήματα">
            {benefits.map((item) => (
              <li key={item}>
                <span className="material-symbols-outlined" aria-hidden>
                  check_circle
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {children ? <div className="rent-hero-search-slot">{children}</div> : null}
      </div>
    </section>
  );
}
