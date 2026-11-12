import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCustomerToken } from '../../lib/auth.js';
import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';
import {
  RENT_COVERAGE_OPTIONS,
  estimateBookingTotals,
  euroLabel,
  readCoverageCatalog,
  readExtrasSelection,
  readRentVehicleSnapshot,
  rentalDayCount,
  selectedExtrasLabels,
  visibleCoverageOptions,
} from '../../lib/rental/rentBookingExtras.js';
import {
  navigateToRentDateSearch,
  readRentBookingPrefs,
  rentTripSearchReady,
  writeRentBookingPrefs,
} from '../../lib/rental/rentBookingSearch.js';
import { createEmbeddedWizardNavigate } from '../../lib/rental/rentWizardEmbed.js';
import { fetchSiteAppearance } from '../../services/siteAppearanceApi.js';
import RentBookingStepper from './RentBookingStepper.jsx';
import RentBookingTripSummary from './RentBookingTripSummary.jsx';
import RentBookingVehicleSidebar from './RentBookingVehicleSidebar.jsx';
import RentWizardLink from './RentWizardLink.jsx';

/**
 * Services / coverage step — protection-package cards with PoreiaGo hooks.
 * Catalog comes from office site appearance (admin: Ενοικιάσεις → Υπηρεσίες).
 */
export default function RentBookingServicesStep({ brandLabel = 'Γραφείο', onWizardNav } = {}) {
  const routerNavigate = useNavigate();
  const navigate = useMemo(
    () => createEmbeddedWizardNavigate(routerNavigate, onWizardNav),
    [routerNavigate, onWizardNav],
  );
  const prefs = useMemo(() => readRentBookingPrefs(), []);
  const snap = useMemo(() => readRentVehicleSnapshot(), []);
  const vehicle = useMemo(() => (snap ? enrichRentVehicle(snap) : null), [snap]);
  const [catalog, setCatalog] = useState(RENT_COVERAGE_OPTIONS);
  const [included, setIncluded] = useState([]);
  const [selection, setSelection] = useState(() => readExtrasSelection(prefs));
  const resumed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const { options, included: inc } = readCoverageCatalog(data);
        setCatalog(options);
        setIncluded(inc);
        setSelection(readExtrasSelection(readRentBookingPrefs(), options));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const dayCount = rentalDayCount(prefs.start_time, prefs.end_time);
  const totals = estimateBookingTotals({
    dailyRate: vehicle?.daily_rate_eur,
    days: dayCount,
    selection,
    catalog,
  });
  const selectedLabels = selectedExtrasLabels(selection, catalog);
  const visible = visibleCoverageOptions(catalog);
  const hasRecommended = visible.some((o) => o.recommended);

  const toggle = (formKey) => {
    setSelection((s) => {
      const next = { ...s, [formKey]: !s[formKey] };
      writeRentBookingPrefs(next);
      return next;
    });
  };

  const goEditTrip = () =>
    navigateToRentDateSearch(navigate, {
      message: 'Μπορείς να αλλάξεις ημερομηνίες παραλαβής και επιστροφής εδώ.',
    });
  const goChangeVehicle = () => navigate('/rent#rent-guest-fleet');

  useEffect(() => {
    if (rentTripSearchReady(prefs)) return;
    navigateToRentDateSearch(navigate, {
      replace: true,
      message: 'Επίλεξε ημερομηνίες παραλαβής και επιστροφής για να συνεχίσεις την κράτηση.',
    });
  }, [navigate, prefs]);

  const onNext = () => {
    if (!vehicle?.id) {
      toast.error('Διάλεξε πρώτα όχημα από τον στόλο.');
      navigate('/rent#rent-guest-fleet');
      return;
    }
    if (!rentTripSearchReady(prefs)) {
      navigateToRentDateSearch(navigate, {
        message: 'Επίλεξε ημερομηνίες παραλαβής και επιστροφής για να συνεχίσεις.',
      });
      return;
    }
    writeRentBookingPrefs({
      ...selection,
      wizard_step: 'details',
      wizard_pending_confirm: false,
      vehicle_id: vehicle?.id || prefs.vehicle_id || '',
    });
    navigate('/rent/book/details');
  };

  useEffect(() => {
    if (resumed.current) return;
    const p = readRentBookingPrefs();
    if (p.wizard_pending_confirm && getCustomerToken() && (p.wizard_step === 'payment' || p.wizard_step === 'details')) {
      resumed.current = true;
      navigate(p.wizard_step === 'payment' ? '/rent/book/payment' : '/rent/book/details', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="rent-wiz rent-wiz--protect">
      <header className="rent-wiz-head">
        <p className="rent-wiz-eyebrow">{brandLabel}</p>
        <h1>Καλύψεις & extras</h1>
        <RentBookingStepper activeId="services" />
      </header>

      <RentBookingTripSummary prefs={prefs} onEdit={goEditTrip} />

      {!vehicle ? (
        <div className="rent-wiz-empty">
          <p>Δεν έχει επιλεγεί όχημα ακόμα.</p>
          <RentWizardLink
            to="/rent#rent-guest-fleet"
            onWizardNav={onWizardNav}
            className="rent-wiz-cta-link"
          >
            Πήγαινε στον στόλο
          </RentWizardLink>
        </div>
      ) : (
        <div className="rent-wiz-layout">
          <section className="rent-wiz-main" aria-label="Καλύψεις">
            <p className="rent-protect-hook">
              Χιλιάδες ταξιδιώτες επιλέγουν προστασία πριν φύγουν από το γραφείο — ξεκίνα ήρεμα.
            </p>
            <p className="rent-wiz-lead">
              Πρόσθεσε ό,τι χρειάζεσαι για το ταξίδι. Το σύνολο ενημερώνεται ζωντανά δίπλα.
            </p>
            {included.length ? (
              <ul className="rent-wiz-included" aria-label="Πάντα συμπεριλαμβάνονται">
                {included.map((item) => (
                  <li key={item}>
                    <span className="material-symbols-outlined" aria-hidden>
                      check_circle
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="rent-wiz-coverages rent-protect-grid">
              {visible.map((opt, idx) => {
                const on = Boolean(selection[opt.formKey]);
                const recommended = Boolean(opt.recommended) || (!hasRecommended && idx === 0);
                return (
                  <article
                    key={opt.id}
                    className={`rent-protect-card${on ? ' is-on' : ''}${
                      recommended ? ' is-recommended' : ''
                    }`}
                  >
                    {recommended ? (
                      <span className="rent-protect-badge">
                        <span className="material-symbols-outlined" aria-hidden>
                          star
                        </span>
                        Προτεινόμενο
                      </span>
                    ) : null}

                    <div className="rent-protect-top">
                      <div className="rent-protect-copy">
                        <h3>{opt.title}</h3>
                        <p className="rent-protect-coverline">
                          {opt.coverLine || 'Τι κερδίζεις:'}
                        </p>
                      </div>
                      <div className="rent-protect-visual" aria-hidden>
                        <span className="material-symbols-outlined">{opt.icon}</span>
                      </div>
                    </div>

                    {opt.blurb ? <p className="rent-protect-blurb">{opt.blurb}</p> : null}

                    {opt.includes?.length || opt.excludes?.length ? (
                      <ul className="rent-protect-flags">
                        {(opt.includes || []).map((t) => (
                          <li key={t} className="is-yes">
                            <span className="material-symbols-outlined" aria-hidden>
                              check_circle
                            </span>
                            {t}
                          </li>
                        ))}
                        {(opt.excludes || []).map((t) => (
                          <li key={t} className="is-no">
                            <span className="material-symbols-outlined" aria-hidden>
                              cancel
                            </span>
                            {t}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="rent-protect-foot">
                      <div className="rent-protect-price">
                        <strong>
                          {euroLabel(opt.eurPerDay)}
                          <span>/ ημέρα</span>
                        </strong>
                        {opt.socialProof ? (
                          <p className="rent-protect-proof">
                            <span className="rent-protect-dot" aria-hidden />
                            {opt.socialProof}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="rent-protect-btn"
                        aria-pressed={on}
                        onClick={() => toggle(opt.formKey)}
                      >
                        {on ? (
                          <>
                            <span className="material-symbols-outlined" aria-hidden>
                              check
                            </span>
                            Επιλεγμένο
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined" aria-hidden>
                              add
                            </span>
                            Προσθήκη
                          </>
                        )}
                      </button>
                    </div>

                    {recommended && opt.testimonial?.quote ? (
                      <blockquote className="rent-protect-quote">
                        <div className="rent-protect-stars" aria-label="5 αστέρια">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className="material-symbols-outlined" aria-hidden>
                              star
                            </span>
                          ))}
                        </div>
                        <p>
                          <strong>{opt.testimonial.name || 'Πελάτης'}</strong>
                          {opt.testimonial.role ? (
                            <span className="rent-protect-verified">{opt.testimonial.role}</span>
                          ) : null}
                        </p>
                        <p className="rent-protect-quote-text">«{opt.testimonial.quote}»</p>
                      </blockquote>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <RentBookingVehicleSidebar
            vehicle={vehicle}
            dayCount={dayCount}
            totals={totals}
            selectedLabels={selectedLabels}
            ctaLabel="Επόμενο βήμα"
            onChangeVehicle={goChangeVehicle}
            onCta={onNext}
          />
        </div>
      )}
    </div>
  );
}
