import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getCustomerEmail,
  getCustomerName,
} from '../../lib/auth.js';
import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';
import {
  RENT_COVERAGE_OPTIONS,
  estimateBookingTotals,
  euroLabel,
  readCoverageCatalog,
  readExtrasSelection,
  readRentVehicleSnapshot,
  rentalDayCount,
  resolveUpsellCoverage,
  selectedExtrasLabels,
} from '../../lib/rental/rentBookingExtras.js';
import { readRentBookingPrefs, writeRentBookingPrefs } from '../../lib/rental/rentBookingSearch.js';
import { readRentNotifySettings } from '../../lib/rental/rentNotify.js';
import { fetchSiteAppearance } from '../../services/siteAppearanceApi.js';
import RentBookingStepper from './RentBookingStepper.jsx';
import RentBookingTripSummary from './RentBookingTripSummary.jsx';
import RentBookingVehicleSidebar from './RentBookingVehicleSidebar.jsx';

const EU_COUNTRIES = [
  'Ελλάδα',
  'Κύπρος',
  'Γερμανία',
  'Γαλλία',
  'Ιταλία',
  'Ισπανία',
  'Ηνωμένο Βασίλειο',
  'Άλλο',
];

function splitName(full) {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * Details / checkout step — Hertz-like layout, PoreiaGo teal theme.
 */
export default function RentBookingDetailsStep({ brandLabel = 'Γραφείο' } = {}) {
  const navigate = useNavigate();
  const prefs = useMemo(() => readRentBookingPrefs(), []);
  const snap = useMemo(() => readRentVehicleSnapshot(), []);
  const vehicle = useMemo(() => (snap ? enrichRentVehicle(snap) : null), [snap]);
  const [catalog, setCatalog] = useState(RENT_COVERAGE_OPTIONS);
  const [upsellId, setUpsellId] = useState('');
  const [selection, setSelection] = useState(() => readExtrasSelection(prefs));
  const [notify, setNotify] = useState(() => readRentNotifySettings(null));
  const named = splitName(prefs.client_first_name ? `${prefs.client_first_name} ${prefs.client_last_name || ''}` : getCustomerName());

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const { options, upsellId: preferred } = readCoverageCatalog(data);
        setCatalog(options);
        setUpsellId(preferred || '');
        const prefsNow = readRentBookingPrefs();
        setSelection(readExtrasSelection(prefsNow, options));
        const ns = readRentNotifySettings(data);
        setNotify(ns);
        const emailChosen = Object.prototype.hasOwnProperty.call(prefsNow, 'marketing_email');
        const smsChosen = Object.prototype.hasOwnProperty.call(prefsNow, 'marketing_sms');
        setForm((f) => ({
          ...f,
          marketing_email: emailChosen
            ? Boolean(prefsNow.marketing_email)
            : Boolean(ns.emailDefault && ns.emailEnabled),
          marketing_sms: smsChosen
            ? Boolean(prefsNow.marketing_sms)
            : Boolean(ns.smsDefault && ns.smsEnabled),
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [form, setForm] = useState({
    first_name: prefs.client_first_name || named.first,
    last_name: prefs.client_last_name || named.last,
    email: prefs.client_email || getCustomerEmail() || '',
    email2: prefs.client_email || getCustomerEmail() || '',
    phone: prefs.client_phone || '',
    phone_land: prefs.client_phone_land || '',
    street: prefs.client_street || '',
    street_no: prefs.client_street_no || '',
    address2: prefs.client_address2 || '',
    postal: prefs.client_postal || '',
    city: prefs.client_city || '',
    country: prefs.client_country || 'Ελλάδα',
    region: prefs.client_region || '',
    marketing_email: Boolean(prefs.marketing_email),
    marketing_sms: Boolean(prefs.marketing_sms),
  });
  const [errors, setErrors] = useState({});

  const dayCount = rentalDayCount(prefs.start_time, prefs.end_time);
  const totals = estimateBookingTotals({
    dailyRate: vehicle?.daily_rate_eur,
    days: dayCount,
    selection,
    catalog,
  });
  const selectedLabels = selectedExtrasLabels(selection, catalog);

  const upsell = useMemo(
    () => resolveUpsellCoverage(catalog, selection, upsellId),
    [selection, catalog, upsellId],
  );

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const persistForm = (nextForm = form, nextSelection = selection) => {
    writeRentBookingPrefs({
      ...nextSelection,
      wizard_step: 'details',
      client_first_name: nextForm.first_name,
      client_last_name: nextForm.last_name,
      client_email: nextForm.email,
      client_phone: nextForm.phone,
      client_phone_land: nextForm.phone_land,
      client_street: nextForm.street,
      client_street_no: nextForm.street_no,
      client_address2: nextForm.address2,
      client_postal: nextForm.postal,
      client_city: nextForm.city,
      client_country: nextForm.country,
      client_region: nextForm.region,
      marketing_email: nextForm.marketing_email,
      marketing_sms: nextForm.marketing_sms,
    });
  };

  const addUpsell = () => {
    if (!upsell) return;
    setSelection((s) => {
      const next = { ...s, [upsell.formKey]: true };
      persistForm(form, next);
      toast.success(`${upsell.title} προστέθηκε`);
      return next;
    });
  };

  const validate = () => {
    const next = {};
    if (!form.first_name.trim()) next.first_name = 'Απαιτείται';
    if (!form.last_name.trim()) next.last_name = 'Απαιτείται';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Έγκυρο email';
    }
    if (form.email.trim().toLowerCase() !== form.email2.trim().toLowerCase()) {
      next.email2 = 'Τα email δεν ταιριάζουν';
    }
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 8) {
      next.phone = 'Κινητό τηλέφωνο';
    }
    if (!form.street.trim()) next.street = 'Απαιτείται';
    if (!form.postal.trim()) next.postal = 'Απαιτείται';
    if (!form.city.trim()) next.city = 'Απαιτείται';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const goToPayment = () => {
    if (!validate()) {
      toast.error('Συμπλήρωσε τα υποχρεωτικά πεδία');
      return;
    }
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

    persistForm();
    writeRentBookingPrefs({
      ...selection,
      wizard_step: 'payment',
      wizard_pending_confirm: false,
    });
    navigate('/rent/book/payment');
  };

  return (
    <div className="rent-wiz rent-wiz--details">
      <header className="rent-wiz-head">
        <p className="rent-wiz-eyebrow">{brandLabel}</p>
        <h1>Συμπλήρωση Στοιχείων</h1>
        <RentBookingStepper activeId="details" />
      </header>

      <RentBookingTripSummary prefs={prefs} onEdit={() => navigate('/rent#rent-guest-search')} />

      {!vehicle ? (
        <div className="rent-wiz-empty">
          <p>Δεν έχει επιλεγεί όχημα ακόμα.</p>
          <Link to="/rent#rent-guest-fleet" className="rent-wiz-cta-link">
            Πήγαινε στον στόλο
          </Link>
        </div>
      ) : (
        <div className="rent-wiz-layout">
          <section className="rent-wiz-main" aria-label="Στοιχεία πελάτη">
            {upsell ? (
              <article className="rent-wiz-upsell">
                <div className="rent-wiz-upsell-copy">
                  <p className="rent-wiz-upsell-kicker">Προσφορά για σένα</p>
                  <h2>
                    Ανέβα επίπεδο προστασίας — {upsell.title} μόνο με{' '}
                    <strong>{euroLabel(upsell.eurPerDay)}</strong> / ημέρα
                  </h2>
                  <p>{upsell.blurb}</p>
                  <button type="button" className="rent-wiz-upsell-btn" onClick={addUpsell}>
                    Προσθέτω {upsell.title}
                  </button>
                </div>
                <div className="rent-wiz-upsell-visual" aria-hidden>
                  <span className="material-symbols-outlined">{upsell.icon}</span>
                </div>
              </article>
            ) : null}

            <div className="rent-wiz-form-card">
              <h2>Συμπλήρωσε τα στοιχεία σου</h2>
              <div className="rent-wiz-form-grid">
                <label className={errors.first_name ? 'has-error' : ''}>
                  <span>Όνομα *</span>
                  <input
                    value={form.first_name}
                    autoComplete="given-name"
                    onChange={(e) => setField('first_name', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                  {errors.first_name ? <em>{errors.first_name}</em> : null}
                </label>
                <label className={errors.last_name ? 'has-error' : ''}>
                  <span>Επώνυμο *</span>
                  <input
                    value={form.last_name}
                    autoComplete="family-name"
                    onChange={(e) => setField('last_name', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                  {errors.last_name ? <em>{errors.last_name}</em> : null}
                </label>
                <label className={errors.email ? 'has-error' : ''}>
                  <span>Email *</span>
                  <input
                    type="email"
                    value={form.email}
                    autoComplete="email"
                    onChange={(e) => setField('email', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                  {errors.email ? <em>{errors.email}</em> : null}
                </label>
                <label className={errors.email2 ? 'has-error' : ''}>
                  <span>Επιβεβαίωση email *</span>
                  <input
                    type="email"
                    value={form.email2}
                    autoComplete="email"
                    onChange={(e) => setField('email2', e.target.value)}
                  />
                  {errors.email2 ? <em>{errors.email2}</em> : null}
                </label>
                <label className={errors.phone ? 'has-error' : ''}>
                  <span>Κινητό *</span>
                  <input
                    type="tel"
                    value={form.phone}
                    autoComplete="tel"
                    placeholder="+30 …"
                    onChange={(e) => setField('phone', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                  {errors.phone ? <em>{errors.phone}</em> : null}
                </label>
                <label>
                  <span>Σταθερό (προαιρετικό)</span>
                  <input
                    type="tel"
                    value={form.phone_land}
                    onChange={(e) => setField('phone_land', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                </label>
              </div>
              <div className="rent-wiz-checks">
                {notify.emailEnabled ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={form.marketing_email}
                      onChange={(e) => {
                        setField('marketing_email', e.target.checked);
                        persistForm({ ...form, marketing_email: e.target.checked });
                      }}
                    />
                    {notify.emailLabel || 'Θέλω προσφορές στο email'}
                  </label>
                ) : null}
                {notify.smsEnabled ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={form.marketing_sms}
                      onChange={(e) => {
                        setField('marketing_sms', e.target.checked);
                        persistForm({ ...form, marketing_sms: e.target.checked });
                      }}
                    />
                    {notify.smsLabel || 'Θέλω ενημερώσεις SMS για την κράτηση'}
                  </label>
                ) : null}
              </div>
            </div>

            <div className="rent-wiz-form-card">
              <h2>Συμπλήρωσε τη διεύθυνσή σου</h2>
              <div className="rent-wiz-form-grid">
                <label className={`rent-wiz-span-2 ${errors.street ? 'has-error' : ''}`}>
                  <span>Οδός *</span>
                  <input
                    value={form.street}
                    autoComplete="address-line1"
                    onChange={(e) => setField('street', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                  {errors.street ? <em>{errors.street}</em> : null}
                </label>
                <label>
                  <span>Αριθμός</span>
                  <input
                    value={form.street_no}
                    onChange={(e) => setField('street_no', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                </label>
                <label>
                  <span>Διεύθυνση 2</span>
                  <input
                    value={form.address2}
                    autoComplete="address-line2"
                    onChange={(e) => setField('address2', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                </label>
                <label className={errors.postal ? 'has-error' : ''}>
                  <span>Τ.Κ. *</span>
                  <input
                    value={form.postal}
                    autoComplete="postal-code"
                    onChange={(e) => setField('postal', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                  {errors.postal ? <em>{errors.postal}</em> : null}
                </label>
                <label className={errors.city ? 'has-error' : ''}>
                  <span>Πόλη *</span>
                  <input
                    value={form.city}
                    autoComplete="address-level2"
                    onChange={(e) => setField('city', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                  {errors.city ? <em>{errors.city}</em> : null}
                </label>
                <label>
                  <span>Χώρα</span>
                  <select
                    value={form.country}
                    onChange={(e) => {
                      setField('country', e.target.value);
                      persistForm({ ...form, country: e.target.value });
                    }}
                  >
                    {EU_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Περιοχή</span>
                  <input
                    value={form.region}
                    autoComplete="address-level1"
                    onChange={(e) => setField('region', e.target.value)}
                    onBlur={() => persistForm()}
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              className="rent-wiz-next rent-wiz-next--mobile"
              onClick={goToPayment}
            >
              Συνέχεια στην πληρωμή
            </button>
          </section>

          <RentBookingVehicleSidebar
            vehicle={vehicle}
            dayCount={dayCount}
            totals={totals}
            selectedLabels={selectedLabels}
            busy={false}
            ctaLabel="Συνέχεια στην πληρωμή"
            onChangeVehicle={() => navigate('/rent#rent-guest-fleet')}
            onCta={goToPayment}
            note="Στο επόμενο βήμα επιλέγεις τρόπο πληρωμής και ολοκληρώνεις την κράτηση."
          />
        </div>
      )}
    </div>
  );
}
