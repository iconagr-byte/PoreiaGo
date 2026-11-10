import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AGENCY_PLANS,
  BILLING_INTERVALS,
  displayPrice,
  listVisibleAgencyPlans,
} from '../../lib/billing/planCatalog.js';
import { CAMPAIGN_TEMPLATE_COUNT, PLATFORM_NAME } from '../../lib/marketing/platformCopy.js';
import { fetchPublicAgencyPlanCatalog } from '../../services/agencyPlanCatalogApi.js';
import '../../styles/platform-landing-rest.css';

export default function AgencyPlansHook({ variant = 'hero' }) {
  const [plans, setPlans] = useState(() => listVisibleAgencyPlans(AGENCY_PLANS));

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchPublicAgencyPlanCatalog()
        .then((data) => {
          if (!cancelled) setPlans(listVisibleAgencyPlans(data));
        })
        .catch(() => {});
    };
    load();
    const onChange = () => load();
    window.addEventListener('agency-plan-catalog-changed', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('agency-plan-catalog-changed', onChange);
    };
  }, []);

  const priced = plans.filter((p) => !p.contactSales);
  const pro = priced.find((p) => p.highlighted) || priced[0] || AGENCY_PLANS[1];
  const price = displayPrice(pro, 'month');

  if (variant === 'compact') {
    return (
      <Link
        to="/grafeia"
        className="group flex items-center gap-3 px-4 py-2.5 rounded-full bg-sky-600/90 hover:bg-sky-500 text-white text-sm font-bold border border-sky-400/40 shadow-lg transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">storefront</span>
        Γραφείο ταξιδιών;
        <span className="text-sky-100 group-hover:text-white">
          Συμβόλαια από {price.label}
          {price.suffix}
        </span>
        <span className="material-symbols-outlined text-[16px] opacity-80">arrow_forward</span>
      </Link>
    );
  }

  return (
    <>
      <div className="pg-plans-wave" aria-hidden />
      <div className="pg-plans-wave pg-plans-wave--soft" aria-hidden />
      <div className="pg-plans-orbit" aria-hidden />

      <div id="agency-saas" className="pg-plans-inner">
        <div className="pg-plans-panel pg-plans-glass">
          <div className="pg-plans-copy">
            <p className="pg-plans-kicker">Πλατφόρμα {PLATFORM_NAME} · για ταξιδιωτικά γραφεία</p>
            <h2 id="agency-saas-title">
              Ψηφιοποιήστε το γραφείο σας — κρατήσεις, στόλος, GPS, χρεώσεις σε έναν πίνακα
            </h2>
            <p>
              Επιλέξτε <strong>μηνιαίο ή ετήσιο συμβόλαιο</strong> και στείλτε καμπάνιες με{' '}
              {CAMPAIGN_TEMPLATE_COUNT} έτοιμα email πρότυπα.
            </p>
            <div className="pg-plans-actions">
              <Link to="/grafeia/signup" className="pg-plans-btn pg-plans-btn--primary">
                Εγγραφή γραφείου
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 20 }}>
                  arrow_forward
                </span>
              </Link>
              <Link to="/grafeia" className="pg-plans-btn pg-plans-btn--ghost">
                Συμβόλαια & τιμές
              </Link>
            </div>
          </div>

          <div className="pg-plans-tiers">
            {priced.slice(0, 4).map((plan) => {
              const m = displayPrice(plan, 'month');
              const y = displayPrice(plan, 'year');
              return (
                <div
                  key={plan.id}
                  className={`pg-plans-tier${plan.highlighted ? ' pg-plans-tier--hi' : ''}`}
                >
                  <div>
                    <p className="pg-plans-tier-name">{plan.name}</p>
                    <p className="pg-plans-tier-tag">{plan.tagline}</p>
                  </div>
                  <div className="pg-plans-tier-price">
                    <p>
                      {m.label}
                      <span>{m.suffix}</span>
                    </p>
                    {y.amount != null ? (
                      <em>
                        ή {y.label}
                        {y.suffix} · {BILLING_INTERVALS.year.badge}
                      </em>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
