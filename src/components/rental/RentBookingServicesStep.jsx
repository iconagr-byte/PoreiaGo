import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getCustomerEmail,
  getCustomerName,
  getCustomerToken,
} from '../../lib/auth.js';
import { ensureCustomerForRental } from '../../lib/customers/customerStore.js';
import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';
import {
  RENT_BOOKING_STEPS,
  RENT_COVERAGE_OPTIONS,
  RENT_INCLUDED_DEFAULTS,
  estimateBookingTotals,
  euroLabel,
  formatRentWhen,
  readExtrasSelection,
  readRentVehicleSnapshot,
  rentalDayCount,
  selectedExtrasLabels,
} from '../../lib/rental/rentBookingExtras.js';
import { readRentBookingPrefs, writeRentBookingPrefs } from '../../lib/rental/rentBookingSearch.js';
import { createCustomerRentalBooking } from '../../services/customerRentalApi.js';

function Stepper({ activeId = 'services' }) {
  const activeIdx = RENT_BOOKING_STEPS.findIndex((s) => s.id === activeId);
  return (
    <ol className="rent-wiz-steps" aria-label="Βήματα κράτησης">
      {RENT_BOOKING_STEPS.map((step, idx) => {
        const done = idx < activeIdx;
        const active = idx === activeIdx;
        return (
          <li
            key={step.id}
            className={`rent-wiz-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
          >
            <span className="rent-wiz-step-dot" aria-hidden>
              {done ? (
                <span className="material-symbols-outlined">check</span>
              ) : active ? (
                <span className="rent-wiz-step-pulse" />
              ) : null}
            </span>
            <span className="rent-wiz-step-label">
              Βήμα {idx + 1}: {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TripSummary({ prefs, onEdit }) {
  const cards = [
    {
      icon: 'location_on',
      title: 'Πού θα παραλάβεις;',
      value: prefs.pickup_location || '—',
    },
    {
      icon: 'calendar_month',
      title: 'Πότε θα παραλάβεις;',
      value: formatRentWhen(prefs.start_time),
    },
    {
      icon: 'location_on',
      title: 'Πού θα παραδώσεις;',
      value: prefs.dropoff_location || prefs.pickup_location || '—',
    },
    {
      icon: 'calendar_month',
      title: 'Πότε θα παραδώσεις;',
      value: formatRentWhen(prefs.end_time),
    },
  ];

  return (
    <div className="rent-wiz-trip">
      <div className="rent-wiz-trip-grid">
        {cards.map((c) => (
          <article key={c.title} className="rent-wiz-trip-card">
            <span className="material-symbols-outlined" aria-hidden>
              {c.icon}
            </span>
            <div>
              <p>{c.title}</p>
              <strong>{c.value}</strong>
            </div>
          </article>
        ))}
      </div>
      <button type="button" className="rent-wiz-edit" onClick={onEdit}>
        <span className="material-symbols-outlined" aria-hidden>
          edit_note
        </span>
        Αλλάζω στοιχεία
      </button>
    </div>
  );
}

/**
 * Services / coverage step after vehicle pick — teal brand, Hertz-like structure.
 */
export default function RentBookingServicesStep({ brandLabel = 'Γραφείο' } = {}) {
  const navigate = useNavigate();
  const prefs = useMemo(() => readRentBookingPrefs(), []);
  const snap = useMemo(() => readRentVehicleSnapshot(), []);
  const vehicle = useMemo(() => (snap ? enrichRentVehicle(snap) : null), [snap]);
  const [selection, setSelection] = useState(() => readExtrasSelection(prefs));
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  const dayCount = rentalDayCount(prefs.start_time, prefs.end_time);
  const totals = estimateBookingTotals({
    dailyRate: vehicle?.daily_rate_eur,
    days: dayCount,
    selection,
  });
  const selectedLabels = selectedExtrasLabels(selection);

  const toggle = (formKey) => {
    setSelection((s) => {
      const next = { ...s, [formKey]: !s[formKey] };
      writeRentBookingPrefs(next);
      return next;
    });
  };

  const goEditTrip = () => navigate('/rent#rent-guest-search');
  const goChangeVehicle = () => navigate('/rent#rent-guest-fleet');

  const confirmBooking = async () => {
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
    if (!getCustomerToken()) {
      writeRentBookingPrefs({ ...selection, wizard_pending_confirm: true });
      navigate('/rent', { state: { from: '/rent/book/services', rentContinue: true } });
      return;
    }

    // Client-only showcase cards (API empty) — allow full UI walkthrough.
    if (/^demo-rent-(car|van)-/i.test(String(vehicle.id))) {
      writeRentBookingPrefs({ wizard_pending_confirm: false, wizard_step: 'done', ...selection });
      toast.success('Demo κράτηση — έτσι φαίνεται η ροή του γραφείου.');
      navigate('/rent');
      return;
    }

    setBusy(true);
    try {
      await ensureCustomerForRental({
        email: getCustomerEmail(),
        name: getCustomerName(),
      }).catch(() => null);

      const extras = Object.entries(selection)
        .filter(([, on]) => on)
        .map(([key]) => key);
      const booking = await createCustomerRentalBooking({
        vehicle_id: vehicle.id,
        start_time: new Date(prefs.start_time).toISOString(),
        end_time: new Date(prefs.end_time).toISOString(),
        pickup_location: prefs.pickup_location,
        dropoff_location: prefs.dropoff_location || prefs.pickup_location,
        driver_mode: prefs.driver_mode || 'SELF_DRIVE',
        client_phone: prefs.client_phone || undefined,
        extras,
      });
      writeRentBookingPrefs({ wizard_pending_confirm: false, wizard_step: 'done' });
      toast.success(
        booking?.reference_code
          ? `Κράτηση έτοιμη · ${booking.reference_code}`
          : 'Η κράτηση καταχωρήθηκε',
      );
      navigate('/rent', { state: { rentBookedAt: Date.now(), highlightBooking: booking?.id } });
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία κράτησης');
    } finally {
      setBusy(false);
    }
  };

  const onNext = () => {
    writeRentBookingPrefs({
      ...selection,
      wizard_step: 'details',
      vehicle_id: vehicle?.id || prefs.vehicle_id || '',
    });
    confirmBooking();
  };

  useEffect(() => {
    if (autoTried.current) return;
    const pending = Boolean(readRentBookingPrefs().wizard_pending_confirm);
    if (pending && getCustomerToken() && vehicle?.id) {
      autoTried.current = true;
      confirmBooking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id]);

  return (
    <div className="rent-wiz">
      <header className="rent-wiz-head">
        <p className="rent-wiz-eyebrow">{brandLabel}</p>
        <h1>Επιλογή υπηρεσιών</h1>
        <Stepper activeId="services" />
      </header>

      <TripSummary prefs={prefs} onEdit={goEditTrip} />

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
            <div className="rent-wiz-coverages">
              {RENT_COVERAGE_OPTIONS.map((opt) => {
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

          <aside className="rent-wiz-side" aria-label="Σύνοψη κράτησης">
            <div className="rent-wiz-side-card">
              <div className="rent-wiz-side-top">
                <h2>Το όχημά μου</h2>
                <button type="button" onClick={goChangeVehicle}>
                  <span className="material-symbols-outlined" aria-hidden>
                    swap_horiz
                  </span>
                  Άλλο όχημα
                </button>
              </div>

              <div className="rent-wiz-vehicle">
                <div>
                  <h3>
                    {vehicle.model}
                    {vehicle.similar_label ? <em> {vehicle.similar_label}</em> : null}
                  </h3>
                  <p>{[vehicle.group_code, vehicle.size_label].filter(Boolean).join(' · ')}</p>
                  <ul className="rent-wiz-vehicle-specs">
                    <li>
                      <span className="material-symbols-outlined">group</span>
                      {vehicle.seats_label || '—'}
                    </li>
                    <li>
                      <span className="material-symbols-outlined">luggage</span>
                      {vehicle.luggage_label || '—'}
                    </li>
                    <li>
                      <span className="material-symbols-outlined">ac_unit</span>
                      {vehicle.ac_label || 'A/C'}
                    </li>
                    <li>
                      <span className="material-symbols-outlined">settings</span>
                      {vehicle.transmission || '—'}
                    </li>
                  </ul>
                </div>
                {vehicle.photo_url ? (
                  <img src={vehicle.photo_url} alt={vehicle.model || 'Όχημα'} />
                ) : null}
              </div>

              <div className="rent-wiz-includes">
                <h4>Η ενοικίαση περιλαμβάνει</h4>
                <ul>
                  {RENT_INCLUDED_DEFAULTS.map((t) => (
                    <li key={t}>
                      <span className="material-symbols-outlined">check_circle</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rent-wiz-selected">
                <h4>Επιλεγμένες υπηρεσίες</h4>
                {selectedLabels.length ? (
                  <ul>
                    {selectedLabels.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Δεν προστέθηκαν υπηρεσίες</p>
                )}
              </div>

              <div className="rent-wiz-total">
                <div>
                  <span>Συνολικό κόστος</span>
                  <small>
                    {dayCount} ημέρ. · όχημα {euroLabel(totals.vehicle)}
                    {totals.extras > 0 ? ` · extras ${euroLabel(totals.extras)}` : ''}
                  </small>
                </div>
                <strong>{euroLabel(totals.total)}</strong>
              </div>

              <button type="button" className="rent-wiz-next" disabled={busy} onClick={onNext}>
                {busy ? 'Καταχώρηση…' : 'Επόμενο βήμα'}
              </button>
              <p className="rent-wiz-note">
                Το σύνολο (όχημα + extras) καταχωρείται στην κράτηση του γραφείου.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
