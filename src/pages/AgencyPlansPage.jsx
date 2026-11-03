import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import {
  BILLING_INTERVALS,
  DEFAULT_AGENCY_SECTION_TITLE,
  DEFAULT_RENT_SECTION_TITLE,
  RENT_ADDON,
  RENT_STANDALONE_PLAN,
  displayPrice,
  isBillablePlanId,
  listVisibleAgencyPlans,
  mergeAgencyPlanCatalog,
  mergeRentPlanCatalog,
  rentAddonDisplayPrice,
  rentStandaloneDisplayPrice,
} from '../lib/billing/planCatalog.js';
import { CAMPAIGN_TEMPLATE_COUNT } from '../lib/marketing/platformCopy.js';
import { getSaasToken } from '../services/saasApi.js';
import { fetchPublicAgencyPlanCatalog } from '../services/agencyPlanCatalogApi.js';
import { fetchPublicRentPlanCatalog } from '../services/rentPlanCatalogApi.js';
import '../styles/platform-contracts.css';

export default function AgencyPlansPage() {
  const navigate = useNavigate();
  const [interval, setInterval] = useState('month');
  const loggedIn = Boolean(getSaasToken());
  const [rentCatalog, setRentCatalog] = useState(() => mergeRentPlanCatalog(null));
  const [agencyCatalog, setAgencyCatalog] = useState(() => mergeAgencyPlanCatalog(null));

  useEffect(() => {
    let cancelled = false;
    const loadAll = () => {
      Promise.all([fetchPublicRentPlanCatalog(), fetchPublicAgencyPlanCatalog()]).then(
        ([rent, agency]) => {
          if (!cancelled) {
            setRentCatalog(rent);
            setAgencyCatalog(agency);
          }
        },
      );
    };
    loadAll();
    const onAgency = () => {
      fetchPublicAgencyPlanCatalog().then((agency) => {
        if (!cancelled) setAgencyCatalog(agency);
      });
    };
    const onRent = () => {
      fetchPublicRentPlanCatalog().then((rent) => {
        if (!cancelled) setRentCatalog(rent);
      });
    };
    window.addEventListener('agency-plan-catalog-changed', onAgency);
    window.addEventListener('rent-plan-catalog-changed', onRent);
    return () => {
      cancelled = true;
      window.removeEventListener('agency-plan-catalog-changed', onAgency);
      window.removeEventListener('rent-plan-catalog-changed', onRent);
    };
  }, []);

  const standalone = rentCatalog.standalone || RENT_STANDALONE_PLAN;
  const addon = rentCatalog.addon || RENT_ADDON;
  const agencyPlans = listVisibleAgencyPlans(agencyCatalog);
  const rentStandalonePrice = rentStandaloneDisplayPrice(interval, standalone);
  const rentAddonPrice = rentAddonDisplayPrice(interval, addon);
  const visibleCards = [standalone.visible !== false, addon.visible !== false].filter(Boolean)
    .length;

  const choosePlan = (planId) => {
    const selected = agencyPlans.find((p) => p.id === planId);
    if (
      selected?.contactSales ||
      planId === 'enterprise' ||
      (planId !== 'rent' && !isBillablePlanId(planId))
    ) {
      window.location.href = `mailto:sales@travelos.app?subject=${encodeURIComponent(
        `${selected?.name || planId} συμβόλαιο`,
      )}`;
      return;
    }
    if (loggedIn) {
      navigate('/admin', {
        state: {
          activeTab: 'settings',
          settingsSubTab: 'contracts',
          plan: planId,
          interval,
          focusRentModule: planId === 'rent',
        },
      });
      return;
    }
    navigate(`/grafeia/signup?plan=${planId}&interval=${interval}`);
  };

  const openRentAddon = () => {
    if (loggedIn) {
      navigate('/admin', {
        state: {
          activeTab: 'settings',
          settingsSubTab: 'contracts',
          interval,
          focusRentModule: true,
        },
      });
      return;
    }
    navigate(`/grafeia/signup?plan=professional&interval=${interval}&addon=rent`);
  };

  return (
    <div className="pg-contracts">
      <header className="pg-contracts-header">
        <div className="pg-contracts-header-inner">
          <PlatformBrand variant="light" />
          <nav className="pg-contracts-nav">
            <Link to="/" className="pg-contracts-nav-link">
              Αρχική
            </Link>
            <Link to="/rent" className="pg-contracts-nav-link pg-contracts-nav-link--rent">
              Υπηρεσία Rent
            </Link>
            <Link to="/admin/login" className="pg-contracts-nav-cta">
              Σύνδεση γραφείου
            </Link>
          </nav>
        </div>
      </header>

      <section className="pg-contracts-hero" aria-label="Συμβόλαια PoreiaGo">
        <div className="pg-contracts-wave" aria-hidden />
        <div className="pg-contracts-wave pg-contracts-wave--soft" aria-hidden />
        <div className="pg-contracts-orbit" aria-hidden />
        <div className="pg-contracts-orbit pg-contracts-orbit--slow" aria-hidden />

        <div className="pg-contracts-float pg-contracts-float--desk" aria-hidden>
          <div className="pg-contracts-desk">
            <div className="pg-contracts-desk-bar">
              <i />
              <i />
              <i />
            </div>
            <div className="pg-contracts-desk-body">
              <strong>Πίνακας γραφείου</strong>
              <div className="pg-contracts-meter">
                <span />
              </div>
              <div className="pg-contracts-bars">
                {[48, 72, 58, 90, 66, 84].map((h, idx) => (
                  <b key={idx} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pg-contracts-float pg-contracts-float--phone" aria-hidden>
          <div className="pg-contracts-phone">
            <span>My Wallet</span>
            <strong>QR εισιτήριο</strong>
            <div className="pg-contracts-qr">
              {Array.from({ length: 25 }).map((_, i) => (
                <i key={i} className={i % 3 === 0 || i % 5 === 0 ? 'on' : ''} />
              ))}
            </div>
          </div>
        </div>

        <div className="pg-contracts-float pg-contracts-float--chip" aria-hidden>
          <span className="material-symbols-outlined">directions_bus</span>
          Εκδρομές
        </div>
        <div className="pg-contracts-float pg-contracts-float--chip2" aria-hidden>
          <span className="material-symbols-outlined">car_rental</span>
          Rent
        </div>

        <div className="pg-contracts-hero-inner">
          <div className="pg-contracts-hero-copy">
            <span className="pg-contracts-badge">
              <span className="material-symbols-outlined" aria-hidden>
                description
              </span>
              Συμβόλαια SaaS
            </span>
            <h1>Λεωφορεία · Rent μόνο · ή και τα δύο</h1>
            <p>
              Ένα σύστημα, δικό σας brand. Core πλάνα για εκδρομές & στόλο · αυτόνομο Rent · ή add-on
              Ενοικιάσεις πάνω στα λεωφορεία.
            </p>
            <div className="pg-contracts-toggle" role="group" aria-label="Περίοδος χρέωσης">
              {Object.values(BILLING_INTERVALS).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={interval === opt.id ? 'is-on' : ''}
                  onClick={() => setInterval(opt.id)}
                >
                  {opt.label}
                  {opt.badge && interval === opt.id ? (
                    <span className="pg-contracts-toggle-badge">-17%</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="pg-contracts-main">
        <section className="pg-contracts-section">
          <h2>{agencyCatalog.sectionTitle || DEFAULT_AGENCY_SECTION_TITLE}</h2>
          <div className="pg-contracts-grid pg-contracts-grid--agency">
            {agencyPlans.map((plan) => {
              const price = displayPrice(plan, interval);
              return (
                <article
                  key={plan.id}
                  className={`pg-contracts-card${plan.highlighted ? ' pg-contracts-card--featured' : ''}`}
                >
                  {plan.highlighted ? <span className="pg-contracts-pill">Προτεινόμενο</span> : null}
                  <div className="pg-contracts-card-head">
                    <span className="material-symbols-outlined" aria-hidden>
                      {plan.icon || 'workspace_premium'}
                    </span>
                    <h3>{plan.name}</h3>
                  </div>
                  <p className="pg-contracts-card-tag">{plan.tagline}</p>
                  <div className="pg-contracts-price">
                    {plan.contactSales ? (
                      <strong style={{ fontSize: '1.45rem' }}>Κατόπιν συνεννόησης</strong>
                    ) : (
                      <>
                        <strong>
                          {price.label}
                          <em>{price.suffix}</em>
                        </strong>
                        {price.compareAt ? <s>€{price.compareAt}/έτος χωρίς έκπτωση</s> : null}
                      </>
                    )}
                  </div>
                  <ul className="pg-contracts-features">
                    {(plan.features || []).map((f) => (
                      <li key={f}>
                        <span className="material-symbols-outlined" aria-hidden>
                          check_circle
                        </span>
                        {f}
                      </li>
                    ))}
                    {addon.visible !== false ? (
                      <li className="is-addon">
                        <span className="material-symbols-outlined" aria-hidden>
                          add_circle
                        </span>
                        Προαιρετικό add-on Ενοικιάσεις (+{rentAddonPrice.label}
                        {rentAddonPrice.suffix})
                      </li>
                    ) : null}
                  </ul>
                  <button
                    type="button"
                    onClick={() => choosePlan(plan.id)}
                    className={`pg-contracts-btn${
                      plan.highlighted
                        ? ' pg-contracts-btn--sky'
                        : plan.contactSales
                          ? ''
                          : ' pg-contracts-btn--ghost'
                    }`}
                  >
                    {plan.contactSales
                      ? 'Επικοινωνία πωλήσεων'
                      : loggedIn
                        ? 'Επιλογή συμβολαίου'
                        : 'Ξεκινήστε εγγραφή'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </main>

        <section className="pg-contracts-rent-stage" aria-label="Ενοικιάσεις">
          <div className="pg-contracts-rent-wave" aria-hidden />
          <div className="pg-contracts-rent-wave pg-contracts-rent-wave--soft" aria-hidden />
          <div className="pg-contracts-rent-orbit" aria-hidden />

          <div className="pg-contracts-float pg-contracts-float--rent-key" aria-hidden>
            <span className="material-symbols-outlined">vpn_key</span>
            Digital check-in
          </div>
          <div className="pg-contracts-float pg-contracts-float--rent-map" aria-hidden>
            <span className="material-symbols-outlined">sos</span>
            SOS 24/7
          </div>
          <div className="pg-contracts-float pg-contracts-float--rent-wallet" aria-hidden>
            <div className="pg-contracts-rent-wallet">
              <span>Rent Wallet</span>
              <strong>Κράτηση ενεργή</strong>
              <em>QR · συμβόλαιο</em>
            </div>
          </div>

          <div className="pg-contracts-rent-inner">
            <header className="pg-contracts-rent-head">
              <p className="pg-contracts-rent-kicker">Rent module</p>
              <h2>{rentCatalog.sectionTitle || DEFAULT_RENT_SECTION_TITLE}</h2>
              <p>
                Αυτόνομο συμβόλαιο ή add-on πάνω στα λεωφορεία — ίδιο app, ίδιο brand, δική σας
                εμπειρία ενοικίασης.
              </p>
            </header>

            <div
              className={`pg-contracts-grid ${
                visibleCards <= 1 ? 'pg-contracts-grid--rent-1' : 'pg-contracts-grid--rent-2'
              }`}
            >
              {standalone.visible !== false ? (
                <article className="pg-contracts-card pg-contracts-card--rent pg-contracts-card--on-stage">
                  <span className="pg-contracts-card-badge">{standalone.badge}</span>
                  <h3 style={{ marginTop: '0.9rem' }}>{standalone.name}</h3>
                  <p className="pg-contracts-card-tag">{standalone.tagline}</p>
                  <div className="pg-contracts-price">
                    <strong>
                      {rentStandalonePrice.label}
                      <em>{rentStandalonePrice.suffix}</em>
                    </strong>
                  </div>
                  <ul className="pg-contracts-features">
                    {standalone.features.map((f) => (
                      <li key={f}>
                        <span className="material-symbols-outlined" aria-hidden>
                          check_circle
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => choosePlan('rent')}
                    className="pg-contracts-btn pg-contracts-btn--teal"
                  >
                    {loggedIn ? standalone.ctaLoggedIn : standalone.ctaGuest}
                  </button>
                </article>
              ) : null}

              {addon.visible !== false ? (
                <article className="pg-contracts-card pg-contracts-card--on-stage">
                  <span className="pg-contracts-card-badge pg-contracts-card-badge--dark">
                    {addon.badge}
                  </span>
                  <h3 style={{ marginTop: '0.9rem' }}>{addon.name}</h3>
                  <p className="pg-contracts-card-tag">{addon.tagline}</p>
                  <div className="pg-contracts-price">
                    <strong>
                      {rentAddonPrice.label}
                      <em>{rentAddonPrice.suffix}</em>
                    </strong>
                  </div>
                  <ul className="pg-contracts-features">
                    {addon.features.map((f) => (
                      <li key={f}>
                        <span className="material-symbols-outlined" aria-hidden>
                          check_circle
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={openRentAddon} className="pg-contracts-btn">
                    {loggedIn ? addon.ctaLoggedIn : addon.ctaGuest}
                  </button>
                  {addon.servicesLinkLabel ? (
                    <Link to="/rent" className="pg-contracts-extra-link">
                      {addon.servicesLinkLabel}
                    </Link>
                  ) : null}
                </article>
              ) : null}
            </div>

            <div className="pg-contracts-info pg-contracts-info--glass">
              <h3>
                <span className="material-symbols-outlined" aria-hidden>
                  info
                </span>
                Πώς χωρίζονται
              </h3>
              <ul>
                <li>
                  <strong>Λεωφορεία μόνο:</strong> Starter / Professional / Enterprise — η αρχική του
                  domain δείχνει εκδρομές
                </li>
                <li>
                  <strong>Rent μόνο:</strong> συμβόλαιο {standalone.name} ({rentStandalonePrice.label}
                  {rentStandalonePrice.suffix}) — η αρχική του domain δείχνει μόνο Rent, χωρίς
                  λεωφορεία
                </li>
                <li>
                  <strong>Και τα δύο:</strong> πλάνο λεωφορείων + add-on Ενοικιάσεις (
                  {rentAddonPrice.label}
                  {rentAddonPrice.suffix}) — εκδρομές και Rent στην ίδια αρχική
                </li>
                <li>
                  Email Hub με {CAMPAIGN_TEMPLATE_COUNT}+ πρότυπα · GDPR · διαχείριση από Συμβόλαιο
                </li>
              </ul>
            </div>
          </div>
        </section>
    </div>
  );
}
