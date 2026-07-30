import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { readRentBookingPrefs, writeRentBookingPrefs } from '../../lib/rental/rentBookingSearch.js';
import { fetchSiteAppearance } from '../../services/siteAppearanceApi.js';
import RentBookingStepper from './RentBookingStepper.jsx';
import RentBookingTripSummary from './RentBookingTripSummary.jsx';
import RentBookingVehicleSidebar from './RentBookingVehicleSidebar.jsx';

/**
 * Services / coverage step after vehicle pick — teal brand, Hertz-like structure.
 * Next step navigates to /rent/book/details (does not book yet).
 * Catalog comes from office site appearance (admin: Ενοικιάσεις → Υπηρεσίες).
 */
export default function RentBookingServicesStep({ brandLabel = 'Γραφείο' } = {}) {
  const navigate = useNavigate();
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

  const toggle = (formKey) => {
    setSelection((s) => {
      const next = { ...s, [formKey]: !s[formKey] };
      writeRentBookingPrefs(next);
      return next;
    });
  };

  const goEditTrip = () => navigate('/rent#rent-guest-search');
  const goChangeVehicle = () => navigate('/rent#rent-guest-fleet');

  const onNext = () => {
    if (!vehicle?.id) {
      toast.error('Διάλεξε πρώτα όχημα από τον στόλο.');
      navigate('/rent#rent-guest-fleet');
      return;
    }
    if (!prefs.start_time || !prefs.end_time || !prefs.pickup_location) {
      toast.error('Συμπλήρωσε παραλαβή και ημερομηνίες.');
      navigate('/rent#rent-guest-search');
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
    <div className="rent-wiz">
      <header className="rent-wiz-head">
        <p className="rent-wiz-eyebrow">{brandLabel}</p>
        <h1>Επιλογή υπηρεσιών</h1>
        <RentBookingStepper activeId="services" />
      </header>

      <RentBookingTripSummary prefs={prefs} onEdit={goEditTrip} />

      {!vehicle ? (
        <div className="rent-wiz-empty">
          <p>Δεν έχει επιλεγεί όχημα ακόμα.</p>
          <Link to="/rent#rent-guest-fleet" className="rent-wiz-cta-link">
            Πήγαινε στον στόλο
          </Link>
        </div>
      ) : (
        <div className="rent-wiz-layout">
          <section className="rent-wiz-main" aria-label="Καλύψεις">
            <h2>Καλύψεις & extras</h2>
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
            <div className="rent-wiz-coverages">
              {visible.map((opt) => {
                const on = Boolean(selection[opt.formKey]);
                return (
                  <article key={opt.id} className={`rent-wiz-cover${on ? ' is-on' : ''}`}>
                    <div className="rent-wiz-cover-icon" aria-hidden>
                      <span className="material-symbols-outlined">{opt.icon}</span>
                    </div>
                    <div className="rent-wiz-cover-body">
                      <h3>{opt.title}</h3>
                      <p>{opt.blurb}</p>
                      {opt.includes?.length || opt.excludes?.length ? (
                        <ul className="rent-wiz-cover-flags">
                          {(opt.includes || []).map((t) => (
                            <li key={t} className="is-yes">
                              <span className="material-symbols-outlined">check</span>
                              {t}
                            </li>
                          ))}
                          {(opt.excludes || []).map((t) => (
                            <li key={t} className="is-no">
                              <span className="material-symbols-outlined">close</span>
                              {t}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="rent-wiz-cover-foot">
                        <strong>
                          {euroLabel(opt.eurPerDay)} <span>/ ημέρα</span>
                        </strong>
                        <button
                          type="button"
                          className="rent-wiz-cover-btn"
                          onClick={() => toggle(opt.formKey)}
                        >
                          {on ? 'Επιλεγμένο' : 'Προσθήκη'}
                        </button>
                      </div>
                    </div>
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
