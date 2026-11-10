/**
 * /rent platform marketing hub — homepage-style light hero + rent product graphics.
 */
import { RENT_SHOWCASE_HUB } from '../../lib/marketing/platformCopy.js';
import RentProductStage from './RentProductStage.jsx';
import '../../styles/rent-marketing-showcase.css';

function scrollToId(event, id) {
  const el = document.getElementById(id.replace(/^#/, ''));
  if (!el) return;
  event.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    window.history.replaceState(null, '', id.startsWith('#') ? id : `#${id}`);
  }
}

export default function RentShowcaseHub({ brandLabel = '' } = {}) {
  const brand = String(brandLabel || '').trim();
  const showOfficeBrand = brand && !/^poreiago/i.test(brand);

  return (
    <section className="rent-show-hub" aria-label="PoreiaGo Rent — παρουσίαση">
      <div className="rent-show-hub-inner">
        <div className="rent-show-hub-copy">
          <p className="rent-show-hub-micro">{RENT_SHOWCASE_HUB.micro}</p>
          <h1 className="rent-show-hub-headline">
            <span className="rent-show-hub-brand">
              {showOfficeBrand ? brand : RENT_SHOWCASE_HUB.brand}
              {!showOfficeBrand ? (
                <span className="rent-show-hub-brand-accent"> {RENT_SHOWCASE_HUB.brandAccent}</span>
              ) : null}
            </span>
            {RENT_SHOWCASE_HUB.hook}{' '}
            <span className="rent-show-hub-headline-accent">{RENT_SHOWCASE_HUB.hookLine2}</span>
          </h1>
          <p className="rent-show-hub-support">{RENT_SHOWCASE_HUB.support}</p>

          <div className="rent-show-hub-cta">
            <a
              href={RENT_SHOWCASE_HUB.primaryHref}
              className="rent-show-hub-cta-primary"
              onClick={(e) => scrollToId(e, RENT_SHOWCASE_HUB.primaryHref)}
            >
              {RENT_SHOWCASE_HUB.primaryCta}
              <span className="material-symbols-outlined" aria-hidden>
                arrow_downward
              </span>
            </a>
            <a
              href={RENT_SHOWCASE_HUB.secondaryHref}
              className="rent-show-hub-cta-secondary"
              onClick={(e) => scrollToId(e, RENT_SHOWCASE_HUB.secondaryHref)}
            >
              {RENT_SHOWCASE_HUB.secondaryCta}
            </a>
          </div>
        </div>

        <RentProductStage />
      </div>
    </section>
  );
}
