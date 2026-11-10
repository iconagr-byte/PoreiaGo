import { Link } from 'react-router-dom';
import {
  AGENCY_PLANS,
  RENT_ADDON,
  displayPrice,
  rentAddonDisplayPrice,
} from '../../lib/billing/planCatalog.js';
import { SERVICE_HUB } from '../../lib/marketing/platformCopy.js';

function PlanPrice({ plan }) {
  if (plan.contactSales || plan.monthlyEur == null) {
    return <span className="pg-apple-price is-custom">Κατόπιν συνεννόησης</span>;
  }
  const price = displayPrice(plan, 'month');
  return (
    <span className="pg-apple-price">
      <b>{price.label}</b>
      <small>{price.suffix}</small>
    </span>
  );
}

/**
 * Apple-aesthetic contracts stage — bus tiers + Rent add-on.
 */
export default function HubContractsStage() {
  const buses = AGENCY_PLANS;
  const addon = RENT_ADDON;
  const addonPrice = rentAddonDisplayPrice('month', addon);

  return (
    <div className="pg-apple-contracts" id="hub-contracts">
      <header className="pg-apple-contracts-intro">
        <p className="pg-apple-eyebrow">{SERVICE_HUB.contractsKicker}</p>
        <h3 className="pg-apple-title">
          {SERVICE_HUB.contractsHook}
          <br />
          <span>{SERVICE_HUB.contractsHookAccent}</span>
        </h3>
        <p className="pg-apple-lead">{SERVICE_HUB.contractsSupport}</p>
      </header>

      <section className="pg-apple-panel" aria-label="Συμβόλαια λεωφορείων">
        <header className="pg-apple-panel-head">
          <span className="pg-apple-glyph" aria-hidden>
            <span className="material-symbols-outlined">directions_bus</span>
          </span>
          <div>
            <p className="pg-apple-label">Λεωφορεία</p>
            <h4>Συμβόλαια λεωφορείων</h4>
            <p>Starter · Professional · Enterprise — μηνιαίο ή ετήσιο</p>
          </div>
        </header>

        <div className="pg-apple-tiers">
          {buses.map((plan) => (
            <article
              key={plan.id}
              className={`pg-apple-tier${plan.highlighted ? ' is-featured' : ''}`}
            >
              {plan.highlighted ? <em className="pg-apple-chip">Προτεινόμενο</em> : null}
              <h5>{plan.name}</h5>
              <p className="pg-apple-tier-tag">{plan.tagline}</p>
              <PlanPrice plan={plan} />
              <ul className="pg-apple-list">
                {(plan.features || []).map((feature) => (
                  <li key={feature}>
                    <span className="material-symbols-outlined" aria-hidden>
                      check_circle
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="pg-apple-actions">
          <Link to="/grafeia" className="pg-apple-btn pg-apple-btn--blue">
            Δείτε πλάνα λεωφορείων
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </Link>
        </div>
      </section>

      <section className="pg-apple-panel pg-apple-panel--rent" aria-label="Add-on Ενοικιάσεις">
        <header className="pg-apple-panel-head">
          <span className="pg-apple-glyph pg-apple-glyph--mint" aria-hidden>
            <span className="material-symbols-outlined">car_rental</span>
          </span>
          <div>
            <p className="pg-apple-label pg-apple-label--mint">{addon.badge}</p>
            <h4>{addon.name}</h4>
            <p>{addon.tagline}</p>
          </div>
        </header>

        <div className="pg-apple-price-card">
          <span className="pg-apple-price pg-apple-price--mint">
            <b>+{addonPrice.label}</b>
            <small>{addonPrice.suffix}</small>
          </span>
          <span className="pg-apple-price-note">Πάνω σε οποιοδήποτε συμβόλαιο λεωφορείων</span>
        </div>

        <ul className="pg-apple-list">
          {(addon.features || []).map((feature) => (
            <li key={feature}>
              <span className="material-symbols-outlined" aria-hidden>
                check_circle
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <div className="pg-apple-actions">
          <Link to="/grafeia#contracts-rent" className="pg-apple-btn pg-apple-btn--mint">
            {addon.ctaGuest || 'Προσθήκη Rent'}
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </Link>
        </div>
      </section>

      <p className="pg-apple-footnote">
        <Link to="/grafeia">{SERVICE_HUB.contractsAllCta}</Link>
      </p>
    </div>
  );
}
