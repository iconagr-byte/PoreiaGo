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
    return <span className="pg-hub-full-price is-custom">Κατόπιν συνεννόησης</span>;
  }
  const price = displayPrice(plan, 'month');
  return (
    <span className="pg-hub-full-price">
      <b>{price.label}</b>
      <small>{price.suffix}</small>
    </span>
  );
}

/**
 * Full-size minimal contracts stage: all bus plan provisions + Rent add-on features.
 */
export default function HubContractsStage() {
  const buses = AGENCY_PLANS;
  const addon = RENT_ADDON;
  const addonPrice = rentAddonDisplayPrice('month', addon);

  return (
    <div className="pg-hub-contracts-stage" id="hub-contracts">
      <header className="pg-hub-contracts-intro">
        <p className="pg-hub-contracts-kicker">{SERVICE_HUB.contractsKicker}</p>
        <h3 className="pg-hub-contracts-hook">
          {SERVICE_HUB.contractsHook}{' '}
          <span>{SERVICE_HUB.contractsHookAccent}</span>
        </h3>
        <p className="pg-hub-contracts-support">{SERVICE_HUB.contractsSupport}</p>
      </header>

      <div className="pg-hub-full-pair">
        <section className="pg-hub-full-panel pg-hub-full-panel--buses" aria-label="Συμβόλαια λεωφορείων">
          <header className="pg-hub-full-head">
            <span className="pg-hub-full-icon material-symbols-outlined" aria-hidden>
              directions_bus
            </span>
            <div>
              <p className="pg-hub-full-badge">Λεωφορεία</p>
              <h4>Συμβόλαια λεωφορείων</h4>
              <p>Starter · Professional · Enterprise — μηνιαίο ή ετήσιο</p>
            </div>
          </header>

          <div className="pg-hub-full-tiers">
            {buses.map((plan) => (
              <article
                key={plan.id}
                className={`pg-hub-full-tier${plan.highlighted ? ' is-hi' : ''}`}
              >
                <div className="pg-hub-full-tier-top">
                  <div>
                    {plan.highlighted ? <em className="pg-hub-full-pill">Προτεινόμενο</em> : null}
                    <h5>{plan.name}</h5>
                    <p>{plan.tagline}</p>
                  </div>
                  <PlanPrice plan={plan} />
                </div>
                <ul>
                  {(plan.features || []).map((feature) => (
                    <li key={feature}>
                      <span className="material-symbols-outlined" aria-hidden>
                        check
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <Link to="/grafeia" className="pg-hub-full-cta pg-hub-full-cta--buses">
            Δείτε πλάνα λεωφορείων
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </Link>
        </section>

        <section
          className="pg-hub-full-panel pg-hub-full-panel--rent"
          aria-label="Add-on Ενοικιάσεις"
        >
          <header className="pg-hub-full-head">
            <span className="pg-hub-full-icon pg-hub-full-icon--rent material-symbols-outlined" aria-hidden>
              car_rental
            </span>
            <div>
              <p className="pg-hub-full-badge pg-hub-full-badge--rent">{addon.badge}</p>
              <h4>{addon.name}</h4>
              <p>{addon.tagline}</p>
            </div>
          </header>

          <div className="pg-hub-full-addon-price">
            <b>
              +{addonPrice.label}
              <small>{addonPrice.suffix}</small>
            </b>
            <span>Πάνω σε οποιοδήποτε συμβόλαιο λεωφορείων</span>
          </div>

          <ul className="pg-hub-full-features">
            {(addon.features || []).map((feature) => (
              <li key={feature}>
                <span className="material-symbols-outlined" aria-hidden>
                  check
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <Link to="/grafeia#contracts-rent" className="pg-hub-full-cta pg-hub-full-cta--rent">
            {addon.ctaGuest || 'Προσθήκη Rent'}
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </Link>
        </section>
      </div>

      <p className="pg-hub-contracts-all">
        <Link to="/grafeia">{SERVICE_HUB.contractsAllCta}</Link>
      </p>
    </div>
  );
}
