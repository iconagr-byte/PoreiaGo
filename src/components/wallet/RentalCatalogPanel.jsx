import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  cancelCustomerRentalBooking,
  createCustomerRentalBooking,
  fetchCustomerRentalAvailability,
  fetchMyRentalBookings,
  uploadCustomerRentalIdDoc,
} from '../../services/customerRentalApi.js';
import { ensureCustomerForRental } from '../../lib/customers/customerStore.js';
import { getCustomerEmail, getCustomerName } from '../../lib/auth.js';
import { fetchPublicPaymentSettings } from '../../services/paymentSettingsApi.js';
import { toLegacyCheckoutShape } from '../../lib/payments/paymentSettings.js';
import {
  amountDueAtCheckout,
  computeDepositSplit,
  PAYMENT_PLAN_DEPOSIT,
  PAYMENT_PLAN_FULL,
} from '../../lib/payments/depositPayment.js';
import { getCheckoutPaymentMethods } from '../../lib/payments/bankTransfer.js';
import {
  getRentalPaymentPlans,
  paymentStatusLabel,
} from '../../lib/rental/rentalPayment.js';

const CATEGORIES = [
  { value: '', label: 'Όλες' },
  { value: 'CAR', label: 'Αυτοκίνητο' },
  { value: 'VAN', label: 'Van' },
  { value: 'MINIBUS', label: 'Μινιμπάς' },
];

function euro(n) {
  return `€${Number(n || 0).toFixed(2)}`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const EMPTY = {
  start_time: '',
  end_time: '',
  category: '',
  min_seats: 5,
  pickup_location: 'Γραφείο',
  dropoff_location: 'Γραφείο',
  driver_mode: 'SELF_DRIVE',
  client_phone: '',
  extra_insurance: false,
  child_seat: false,
  gps_pack: false,
};

const PREFS_KEY = 'rent_booking_prefs_v1';
const FUNNEL_KEY = 'rent_funnel_events_v1';
const ID_DOCS_KEY = 'rent_id_docs_v1';
const MIN_DRIVER_AGE = 21;

const EMPTY_ID = {
  id_document_url: '',
  driving_license_url: '',
  date_of_birth: '',
  license_number: '',
  license_expires_at: '',
};

function loadSavedIdDocs() {
  try {
    const raw = JSON.parse(localStorage.getItem(ID_DOCS_KEY) || '{}');
    return { ...EMPTY_ID, ...raw };
  } catch {
    return { ...EMPTY_ID };
  }
}

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function trackFunnel(step, meta = {}) {
  try {
    const list = JSON.parse(localStorage.getItem(FUNNEL_KEY) || '[]');
    list.push({ step, at: new Date().toISOString(), ...meta });
    localStorage.setItem(FUNNEL_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* ignore */
  }
}

function trustBadge(vehicleId = '') {
  let sum = 0;
  for (const ch of String(vehicleId)) sum += ch.charCodeAt(0);
  const rating = 4.4 + (sum % 6) * 0.1;
  const booked = 8 + (sum % 37);
  return { rating: Math.min(4.9, Number(rating.toFixed(1))), booked };
}

function asDateValue(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function downloadIcs(booking) {
  const title = `Rental: ${booking?.vehicle_model || 'Vehicle'} (${booking?.vehicle_plate || ''})`;
  const dtStart = new Date(booking.start_time);
  const dtEnd = new Date(booking.end_time);
  const fmt = (d) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
      d.getUTCDate(),
    ).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}${String(
      d.getUTCMinutes(),
    ).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}Z`;
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PoreiaGo Rent//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@poreiago`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(dtStart)}`,
    `DTEND:${fmt(dtEnd)}`,
    `SUMMARY:${title}`,
    `LOCATION:${booking.pickup_location || 'Office'}`,
    `DESCRIPTION:Dropoff: ${booking.dropoff_location || booking.pickup_location || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rental-${booking.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function vehiclePhotos(v) {
  return (v?.photo_urls?.length ? v.photo_urls : v?.photo_url ? [v.photo_url] : []).filter(Boolean);
}

export default function RentalCatalogPanel({
  mode = 'full',
  onBooked,
  preferredVehicle = null,
  onClearPreferred,
} = {}) {
  const showBook = mode === 'full' || mode === 'book';
  const showMine = mode === 'full' || mode === 'mine';
  const bare = mode !== 'full';
  const [form, setForm] = useState(EMPTY);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sortBy, setSortBy] = useState('fit');
  const [priceCap, setPriceCap] = useState(9999);
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);
  const [onlyTopRated, setOnlyTopRated] = useState(false);
  const [details, setDetails] = useState(null);
  const [recentBooked, setRecentBooked] = useState(null);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [paymentPlan, setPaymentPlan] = useState(PAYMENT_PLAN_FULL);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [idDocs, setIdDocs] = useState(EMPTY_ID);
  const [uploadingKind, setUploadingKind] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    try {
      return localStorage.getItem('rent_reminders_enabled_v1') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await fetchPublicPaymentSettings();
        if (!cancelled) setPaymentSettings(settings);
      } catch {
        /* offline — defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const checkoutSettings = useMemo(
    () => (paymentSettings ? toLegacyCheckoutShape(paymentSettings) : null),
    [paymentSettings],
  );
  const depositPercent = checkoutSettings?.checkout_deposit_percent ?? 30;
  const depositEnabled = checkoutSettings?.checkout_deposit_enabled !== false;
  const paymentPlans = useMemo(
    () =>
      depositEnabled
        ? getRentalPaymentPlans(depositPercent)
        : getRentalPaymentPlans(depositPercent).slice(0, 1),
    [depositEnabled, depositPercent],
  );
  const paymentMethods = useMemo(
    () => getCheckoutPaymentMethods(paymentSettings || checkoutSettings || {}),
    [paymentSettings, checkoutSettings],
  );

  useEffect(() => {
    if (!depositEnabled && paymentPlan !== PAYMENT_PLAN_FULL) {
      setPaymentPlan(PAYMENT_PLAN_FULL);
    }
  }, [depositEnabled, paymentPlan]);

  useEffect(() => {
    if (!paymentMethods.length) return;
    if (!paymentMethods.some((m) => m.id === paymentMethod)) {
      setPaymentMethod(paymentMethods[0].id);
    }
  }, [paymentMethods, paymentMethod]);

  useEffect(() => {
    setIdDocs(loadSavedIdDocs());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ID_DOCS_KEY, JSON.stringify(idDocs));
    } catch {
      /* ignore */
    }
  }, [idDocs]);

  const loadMine = useCallback(async () => {
    try {
      const rows = await fetchMyRentalBookings();
      setMine(rows);
    } catch {
      setMine([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      setForm((f) => ({
        ...f,
        category: raw.category || f.category,
        min_seats: Number(raw.min_seats || f.min_seats || 5),
        pickup_location: raw.pickup_location || f.pickup_location,
        dropoff_location: raw.dropoff_location || f.dropoff_location,
        driver_mode: raw.driver_mode || f.driver_mode,
        client_phone: raw.client_phone || f.client_phone,
      }));
      if (raw.sortBy) setSortBy(raw.sortBy);
      if (raw.priceCap) setPriceCap(Number(raw.priceCap));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          category: form.category,
          min_seats: form.min_seats,
          pickup_location: form.pickup_location,
          dropoff_location: form.dropoff_location,
          driver_mode: form.driver_mode,
          client_phone: form.client_phone,
          sortBy,
          priceCap,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [form, sortBy, priceCap]);

  useEffect(() => {
    if (!preferredVehicle) return;
    setForm((f) => ({
      ...f,
      category: f.category || preferredVehicle.category || '',
      min_seats: Math.max(Number(f.min_seats || 2), Number(preferredVehicle.seating_capacity || 2)),
    }));
  }, [preferredVehicle]);

  const validateDates = () => {
    if (!form.start_time || !form.end_time) {
      toast.error('Επιλέξτε ημερομηνίες');
      return false;
    }
    const start = new Date(form.start_time);
    const end = new Date(form.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error('Μη έγκυρες ημερομηνίες');
      return false;
    }
    if (end <= start) {
      toast.error('Η λήξη πρέπει να είναι μετά την έναρξη');
      return false;
    }
    return true;
  };

  const search = async (e) => {
    e.preventDefault();
    if (!validateDates()) return;
    setBusy(true);
    try {
      const rows = await fetchCustomerRentalAvailability({
        startTime: new Date(form.start_time).toISOString(),
        endTime: new Date(form.end_time).toISOString(),
        category: form.category || undefined,
        minSeats: form.min_seats || undefined,
        pickupLocation: form.pickup_location,
        dropoffLocation: form.dropoff_location,
        driverMode: form.driver_mode,
      });
      setSuggestions(rows);
      const preferredId = preferredVehicle?.id;
      const selected =
        preferredId && rows.some((v) => String(v.id) === String(preferredId))
          ? preferredId
          : rows[0]?.id || '';
      setSelectedId(selected);
      trackFunnel('availability_loaded', { count: rows.length, preferred: Boolean(preferredVehicle) });
      if (!rows.length) toast.error('Δεν βρέθηκε διαθέσιμο όχημα');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadIdDoc = async (kind, file) => {
    if (!file) return;
    setUploadingKind(kind);
    try {
      const data = await uploadCustomerRentalIdDoc(file, kind);
      setIdDocs((prev) => ({
        ...prev,
        ...(kind === 'id_card'
          ? { id_document_url: data.url }
          : { driving_license_url: data.url }),
      }));
      trackFunnel('id_doc_uploaded', { kind });
      toast.success(kind === 'id_card' ? 'Ταυτότητα ανέβηκε' : 'Δίπλωμα ανέβηκε');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingKind('');
    }
  };

  const validateIdentity = () => {
    if (form.driver_mode !== 'SELF_DRIVE') return true;
    if (!idDocs.id_document_url) {
      toast.error('Ανεβάστε φωτογραφία ταυτότητας ή διαβατηρίου');
      return false;
    }
    if (!idDocs.driving_license_url) {
      toast.error('Ανεβάστε φωτογραφία διπλώματος');
      return false;
    }
    if (!idDocs.date_of_birth) {
      toast.error('Συμπληρώστε ημερομηνία γέννησης');
      return false;
    }
    const age = ageFromDob(idDocs.date_of_birth);
    if (age == null || age < MIN_DRIVER_AGE) {
      toast.error(`Ελάχιστη ηλικία οδηγού: ${MIN_DRIVER_AGE} ετών`);
      return false;
    }
    if (!idDocs.license_number.trim()) {
      toast.error('Συμπληρώστε αριθμό διπλώματος');
      return false;
    }
    if (!idDocs.license_expires_at) {
      toast.error('Συμπληρώστε λήξη διπλώματος');
      return false;
    }
    const expiry = new Date(`${idDocs.license_expires_at}T23:59:59`);
    const end = new Date(form.end_time);
    if (Number.isFinite(expiry.getTime()) && Number.isFinite(end.getTime()) && expiry < end) {
      toast.error('Το δίπλωμα λήγει πριν το τέλος της ενοικίασης');
      return false;
    }
    return true;
  };

  const book = async () => {
    if (!selectedId) {
      toast.error('Επιλέξτε όχημα');
      return;
    }
    if (!validateDates()) return;
    if (!validateIdentity()) return;
    if (!paymentMethods.length) {
      toast.error('Δεν υπάρχουν διαθέσιμοι τρόποι πληρωμής');
      return;
    }
    setBusy(true);
    try {
      if (paymentMethod === 'card' || paymentMethod === 'paypal' || paymentMethod === 'apple') {
        // Demo card capture — same pattern as ticket checkout (no live gateway yet).
        await new Promise((r) => setTimeout(r, 900));
      }
      const identity =
        form.driver_mode === 'SELF_DRIVE'
          ? {
              id_document_url: idDocs.id_document_url,
              driving_license_url: idDocs.driving_license_url,
              date_of_birth: idDocs.date_of_birth,
              license_number: idDocs.license_number.trim(),
              license_expires_at: idDocs.license_expires_at,
            }
          : {};
      const created = await createCustomerRentalBooking({
        vehicle_id: selectedId,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        pickup_location: form.pickup_location,
        dropoff_location: form.dropoff_location || form.pickup_location,
        driver_mode: form.driver_mode,
        client_phone: form.client_phone || null,
        extras: {
          extra_insurance: Boolean(form.extra_insurance),
          child_seat: Boolean(form.child_seat),
          gps_pack: Boolean(form.gps_pack),
        },
        payment_plan: paymentPlan,
        payment_method: paymentMethod,
        deposit_percent: depositPercent,
        ...identity,
      });
      // Mirror into office CRM as a real person (same as trip checkout).
      ensureCustomerForRental({
        id: created?.client_id || undefined,
        name: getCustomerName() || '',
        email: getCustomerEmail() || '',
        phone: form.client_phone || '',
      });
      const payNote =
        created?.payment_status === 'pending'
          ? ' · εκκρεμεί πληρωμή'
          : created?.payment_status === 'partial'
            ? ' · προκαταβολή καταχωρήθηκε'
            : '';
      const idNote =
        form.driver_mode === 'SELF_DRIVE' ? ' · εκκρεμεί έλεγχος ταυτότητας' : '';
      toast.success(`Η κράτηση καταχωρήθηκε${payNote}${idNote}. Στάλθηκε email επιβεβαίωσης.`);
      setSuggestions([]);
      setSelectedId('');
      setRecentBooked(created);
      trackFunnel('booking_created', {
        vehicle_id: selectedId,
        payment_plan: paymentPlan,
        payment_method: paymentMethod,
        has_id: Boolean(identity.id_document_url),
      });
      if (onClearPreferred) onClearPreferred();
      await loadMine();
      if (typeof onBooked === 'function') onBooked(created);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selected = suggestions.find((v) => v.id === selectedId);

  const sortedSuggestions = [...suggestions]
    .filter((v) => Number(v.suggested_total || 0) <= Number(priceCap || 999999))
    .filter((v) => (onlyWithPhotos ? vehiclePhotos(v).length > 0 : true))
    .filter((v) => (onlyTopRated ? trustBadge(v.id).rating >= 4.7 : true))
    .sort((a, b) => {
      if (sortBy === 'price_asc') return Number(a.suggested_total || 0) - Number(b.suggested_total || 0);
      if (sortBy === 'price_desc') return Number(b.suggested_total || 0) - Number(a.suggested_total || 0);
      if (sortBy === 'seats_desc') return Number(b.seating_capacity || 0) - Number(a.seating_capacity || 0);
      return Number(b.fit_score || 0) - Number(a.fit_score || 0);
    });

  const nights = (() => {
    try {
      const start = new Date(form.start_time);
      const end = new Date(form.end_time);
      const diff = Math.max(0, end.getTime() - start.getTime());
      return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return 1;
    }
  })();
  const extrasTotal =
    (form.extra_insurance ? 12 * nights : 0) + (form.child_seat ? 7 * nights : 0) + (form.gps_pack ? 5 * nights : 0);
  const selectedTotal = Number(selected?.suggested_total || 0) + extrasTotal;
  const paySplit = computeDepositSplit(selectedTotal, depositPercent);
  const dueNow = amountDueAtCheckout(selectedTotal, paymentPlan, depositPercent);
  const isDepositPlan = depositEnabled && paymentPlan === PAYMENT_PLAN_DEPOSIT;

  const cancelBooking = async (bookingId) => {
    if (!window.confirm('Ακύρωση κράτησης ενοικίασης;')) return;
    setBusy(true);
    try {
      await cancelCustomerRentalBooking(bookingId);
      toast.success('Η κράτηση ακυρώθηκε');
      await loadMine();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={bare ? 'rent-catalog' : 'wallet-stack'}>
      {showBook ? (
      <section className={bare ? '' : 'wallet-panel'}>
        {!bare ? (
        <div className="wallet-panel-head">
          <span className="wallet-panel-head-icon" aria-hidden>
            <span className="material-symbols-outlined">directions_car</span>
          </span>
          <div>
            <h2>Ενοικίαση</h2>
            <p>Βρείτε διαθέσιμο όχημα και κλείστε άμεσα από το κινητό.</p>
          </div>
        </div>
        ) : null}

        {preferredVehicle ? (
          <div className="rent-picked-vehicle">
            <div className="rent-picked-vehicle-media">
              {vehiclePhotos(preferredVehicle)[0] ? (
                <img
                  src={vehiclePhotos(preferredVehicle)[0]}
                  alt={preferredVehicle.model || 'Όχημα'}
                  loading="lazy"
                />
              ) : (
                <span className="material-symbols-outlined">directions_car</span>
              )}
            </div>
            <div className="rent-picked-vehicle-body">
              <p className="rent-picked-vehicle-label">Επιλεγμένο από στόλο</p>
              <strong>
                {preferredVehicle.model}{' '}
                {preferredVehicle.category ? `· ${preferredVehicle.category}` : ''}
              </strong>
              <span>
                {preferredVehicle.seating_capacity || '—'} θέσεις · από{' '}
                {euro(preferredVehicle.daily_rate_eur)}/ημέρα
              </span>
            </div>
            {onClearPreferred ? (
              <button
                type="button"
                className="rent-btn rent-btn-ghost"
                onClick={() => onClearPreferred()}
              >
                Αλλαγή
              </button>
            ) : null}
          </div>
        ) : null}

        <form className="wallet-form" onSubmit={search}>
          <div className="rent-booking-steps" aria-label="Βήματα κράτησης">
            <span className={preferredVehicle || selectedId ? 'is-done' : 'is-active'}>1. Όχημα</span>
            <span className={form.start_time && form.end_time ? 'is-done' : ''}>2. Ημερομηνίες</span>
            <span
              className={
                idDocs.id_document_url && idDocs.driving_license_url ? 'is-done' : 'is-active'
              }
            >
              3. Ταυτότητα
            </span>
            <span className={selectedId ? 'is-active' : ''}>4. Πληρωμή</span>
          </div>
          <div className="wallet-field">
            <label htmlFor="rent-start">Παραλαβή *</label>
            <input
              id="rent-start"
              type="datetime-local"
              required
              className="wallet-input"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
            />
          </div>
          <div className="wallet-field">
            <label htmlFor="rent-end">Επιστροφή *</label>
            <input
              id="rent-end"
              type="datetime-local"
              required
              className="wallet-input"
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
            />
          </div>
          <div className="wallet-field">
            <label htmlFor="rent-cat">Κατηγορία</label>
            <select
              id="rent-cat"
              className="wallet-select"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value || 'all'} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="wallet-field">
            <label htmlFor="rent-seats">Ελάχ. θέσεις</label>
            <input
              id="rent-seats"
              type="number"
              min={2}
              max={80}
              className="wallet-input"
              value={form.min_seats}
              onChange={(e) => setForm((f) => ({ ...f, min_seats: Number(e.target.value) }))}
            />
          </div>
          <div className="wallet-field">
            <label htmlFor="rent-pickup">Σημείο παραλαβής</label>
            <input
              id="rent-pickup"
              className="wallet-input"
              value={form.pickup_location}
              onChange={(e) => setForm((f) => ({ ...f, pickup_location: e.target.value }))}
            />
          </div>
          <div className="wallet-field">
            <label htmlFor="rent-drop">Σημείο επιστροφής</label>
            <input
              id="rent-drop"
              className="wallet-input"
              value={form.dropoff_location}
              onChange={(e) => setForm((f) => ({ ...f, dropoff_location: e.target.value }))}
            />
            {form.pickup_location.trim() &&
            form.dropoff_location.trim() &&
            form.pickup_location.trim().toLowerCase() !== form.dropoff_location.trim().toLowerCase() ? (
              <p className="wallet-field-hint">One-way — προστίθεται επιπλέον χρέωση αν ισχύει.</p>
            ) : null}
          </div>
          <div className="wallet-field">
            <label htmlFor="rent-driver">Οδηγός</label>
            <select
              id="rent-driver"
              className="wallet-select"
              value={form.driver_mode}
              onChange={(e) => setForm((f) => ({ ...f, driver_mode: e.target.value }))}
            >
              <option value="SELF_DRIVE">Self-drive</option>
              <option value="WITH_DRIVER">Με οδηγό</option>
            </select>
          </div>
          <div className="wallet-field">
            <label htmlFor="rent-phone">Τηλέφωνο (προαιρετικό)</label>
            <input
              id="rent-phone"
              className="wallet-input"
              value={form.client_phone}
              onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
            />
          </div>
          <div className="wallet-field">
            <label>Extras</label>
            <div className="rent-extras">
              <label>
                <input
                  type="checkbox"
                  checked={form.extra_insurance}
                  onChange={(e) => setForm((f) => ({ ...f, extra_insurance: e.target.checked }))}
                />
                Extra insurance (+€12/ημέρα)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.child_seat}
                  onChange={(e) => setForm((f) => ({ ...f, child_seat: e.target.checked }))}
                />
                Παιδικό κάθισμα (+€7/ημέρα)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.gps_pack}
                  onChange={(e) => setForm((f) => ({ ...f, gps_pack: e.target.checked }))}
                />
                GPS pack (+€5/ημέρα)
              </label>
            </div>
            {extrasTotal > 0 ? (
              <p className="wallet-field-hint">Εκτίμηση extras: {euro(extrasTotal)} για {nights} ημέρες</p>
            ) : null}
          </div>
          {form.driver_mode === 'SELF_DRIVE' ? (
            <div className="rent-id-panel">
              <h3>Ταυτότητα & δίπλωμα</h3>
              <p className="wallet-field-hint">
                Απαιτείται για self-drive · ελάχιστη ηλικία {MIN_DRIVER_AGE}. Τα έγγραφα ελέγχονται από το γραφείο.
              </p>
              <div className="rent-id-uploads">
                <label className={`rent-id-upload${idDocs.id_document_url ? ' is-done' : ''}`}>
                  <span className="material-symbols-outlined" aria-hidden>
                    badge
                  </span>
                  <span>
                    <strong>Ταυτότητα / Διαβατήριο</strong>
                    <small>{idDocs.id_document_url ? 'Ανέβηκε' : 'Φωτογραφία ή κάμερα'}</small>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={Boolean(uploadingKind)}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      uploadIdDoc('id_card', file);
                    }}
                  />
                </label>
                <label className={`rent-id-upload${idDocs.driving_license_url ? ' is-done' : ''}`}>
                  <span className="material-symbols-outlined" aria-hidden>
                    credit_card
                  </span>
                  <span>
                    <strong>Δίπλωμα οδήγησης</strong>
                    <small>{idDocs.driving_license_url ? 'Ανέβηκε' : 'Φωτογραφία ή κάμερα'}</small>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={Boolean(uploadingKind)}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      uploadIdDoc('driving_license', file);
                    }}
                  />
                </label>
              </div>
              {uploadingKind ? <p className="wallet-field-hint">Ανέβασμα…</p> : null}
              {(idDocs.id_document_url || idDocs.driving_license_url) && (
                <div className="rent-id-previews">
                  {idDocs.id_document_url ? (
                    <img src={idDocs.id_document_url} alt="Ταυτότητα" />
                  ) : null}
                  {idDocs.driving_license_url ? (
                    <img src={idDocs.driving_license_url} alt="Δίπλωμα" />
                  ) : null}
                </div>
              )}
              <div className="rent-id-fields">
                <div className="wallet-field">
                  <label htmlFor="rent-dob">Ημερομηνία γέννησης *</label>
                  <input
                    id="rent-dob"
                    type="date"
                    className="wallet-input"
                    value={idDocs.date_of_birth}
                    onChange={(e) => setIdDocs((d) => ({ ...d, date_of_birth: e.target.value }))}
                  />
                </div>
                <div className="wallet-field">
                  <label htmlFor="rent-lic-no">Αριθμός διπλώματος *</label>
                  <input
                    id="rent-lic-no"
                    className="wallet-input"
                    value={idDocs.license_number}
                    onChange={(e) => setIdDocs((d) => ({ ...d, license_number: e.target.value }))}
                    placeholder="π.χ. ΑΒ123456"
                  />
                </div>
                <div className="wallet-field">
                  <label htmlFor="rent-lic-exp">Λήξη διπλώματος *</label>
                  <input
                    id="rent-lic-exp"
                    type="date"
                    className="wallet-input"
                    value={idDocs.license_expires_at}
                    onChange={(e) => setIdDocs((d) => ({ ...d, license_expires_at: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="wallet-field-hint">Με οδηγό — δεν απαιτείται δίπλωμα πελάτη.</p>
          )}
          <button type="submit" className="wallet-btn wallet-btn-primary wallet-btn-block" disabled={busy}>
            {busy ? 'Αναζήτηση…' : 'Εύρεση διαθέσιμων'}
          </button>
          <p className="rent-cancel-policy">
            Δωρεάν ακύρωση έως 24 ώρες πριν την παραλαβή. Μετά ισχύει πολιτική γραφείου.
          </p>
        </form>
      </section>
      ) : null}

      {showBook && suggestions.length > 0 ? (
        <section className={bare ? '' : 'wallet-panel'} style={bare ? { marginTop: '1rem' } : undefined}>
          <h2>Επιλέξτε όχημα</h2>
          <p className="wallet-panel-lead">
            {sortedSuggestions.length} από {suggestions.length} διαθέσιμα — δείτε φωτογραφίες και περιγραφή πριν την
            κράτηση.
          </p>
          <div className="rent-results-tools">
            <label>
              Sort
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="fit">Προτεινόμενα</option>
                <option value="price_asc">Τιμή ↑</option>
                <option value="price_desc">Τιμή ↓</option>
                <option value="seats_desc">Θέσεις ↓</option>
              </select>
            </label>
            <label>
              Max €{Math.round(priceCap)}
              <input
                type="range"
                min={50}
                max={1200}
                step={10}
                value={priceCap}
                onChange={(e) => setPriceCap(Number(e.target.value))}
              />
            </label>
            <label className="rent-check-inline">
              <input
                type="checkbox"
                checked={onlyWithPhotos}
                onChange={(e) => setOnlyWithPhotos(e.target.checked)}
              />
              Με φωτογραφίες
            </label>
            <label className="rent-check-inline">
              <input
                type="checkbox"
                checked={onlyTopRated}
                onChange={(e) => setOnlyTopRated(e.target.checked)}
              />
              Top rated
            </label>
          </div>
          <div className="rent-vehicle-list">
            {sortedSuggestions.map((v) => {
              const photos = vehiclePhotos(v);
              const isSelected = selectedId === v.id;
              const trust = trustBadge(v.id);
              return (
                <label
                  key={v.id}
                  className={`rent-vehicle-card${isSelected ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="rent-vehicle"
                    className="rent-vehicle-radio"
                    checked={isSelected}
                    onChange={() => setSelectedId(v.id)}
                  />
                  <div className="rent-vehicle-media">
                    {photos.length ? (
                      <div className="rent-vehicle-gallery" aria-label="Φωτογραφίες οχήματος">
                        {photos.slice(0, 4).map((url) => (
                          <img key={url} src={url} alt="" loading="lazy" />
                        ))}
                      </div>
                    ) : (
                      <div className="rent-vehicle-placeholder" aria-hidden>
                        <span className="material-symbols-outlined">directions_car</span>
                      </div>
                    )}
                  </div>
                  <div className="rent-vehicle-body">
                    <div className="rent-vehicle-title-row">
                      <h3>
                        {v.model}
                        <span className="rent-vehicle-cat">{v.category}</span>
                      </h3>
                      <p className="rent-vehicle-price">{euro(v.suggested_total)}</p>
                    </div>
                    <p className="rent-vehicle-meta">
                      {v.seating_capacity} θέσεις · {v.suggested_days} ημέρες · από{' '}
                      {euro(v.daily_rate_eur)}/ημέρα
                    </p>
                    <p className="rent-vehicle-trust">
                      ⭐ {trust.rating} · {trust.booked} κρατήσεις τον μήνα
                    </p>
                    {v.description ? (
                      <p className="rent-vehicle-desc">{v.description}</p>
                    ) : (
                      <p className="rent-vehicle-desc is-muted">
                        Χωρίς αναλυτική περιγραφή — επικοινωνήστε με το γραφείο για λεπτομέρειες.
                      </p>
                    )}
                    {(v.one_way_surcharge > 0 || v.driver_surcharge > 0) && (
                      <p className="wallet-booking-mono">
                        Βάση {euro(v.base_total)}
                        {v.driver_surcharge > 0 ? ` · οδηγός ${euro(v.driver_surcharge)}` : ''}
                        {v.one_way_surcharge > 0 ? ` · one-way ${euro(v.one_way_surcharge)}` : ''}
                      </p>
                    )}
                    <button
                      type="button"
                      className="rent-vehicle-more"
                      onClick={(e) => {
                        e.preventDefault();
                        setDetails(v);
                        trackFunnel('vehicle_open_details', { vehicle_id: v.id });
                      }}
                    >
                      Λεπτομέρειες
                    </button>
                  </div>
                </label>
              );
            })}
          </div>
          {selected ? (
            <div className="rent-pay-panel">
              <h3>Πληρωμή</h3>
              <p className="wallet-panel-lead">
                Σύνολο {euro(selectedTotal)}
                {extrasTotal > 0 ? ` (βάση ${euro(selected.suggested_total)} + extras ${euro(extrasTotal)})` : ''}
              </p>
              {depositEnabled ? (
                <div className="rent-pay-plans" role="radiogroup" aria-label="Πλάνο πληρωμής">
                  {paymentPlans.map((plan) => {
                    const amount =
                      plan.id === PAYMENT_PLAN_DEPOSIT ? paySplit.depositAmount : paySplit.total;
                    const active = paymentPlan === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        className={`rent-pay-plan${active ? ' is-active' : ''}`}
                        aria-pressed={active}
                        onClick={() => setPaymentPlan(plan.id)}
                      >
                        <span className="material-symbols-outlined" aria-hidden>
                          {plan.icon}
                        </span>
                        <span>
                          <strong>{plan.label}</strong>
                          <small>{plan.description}</small>
                        </span>
                        <em>{euro(amount)}</em>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="rent-pay-methods" role="radiogroup" aria-label="Τρόπος πληρωμής">
                {paymentMethods.map((m) => {
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`rent-pay-method${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => setPaymentMethod(m.id)}
                    >
                      <span className="material-symbols-outlined" aria-hidden>
                        {m.icon}
                      </span>
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {isDepositPlan ? (
                <p className="rent-pay-hint">
                  Πληρώνετε τώρα {euro(dueNow)} ({paySplit.depositPercent}%). Υπόλοιπο{' '}
                  {euro(paySplit.balanceDue)} στην παραλαβή.
                </p>
              ) : (
                <p className="rent-pay-hint">Πληρωμή τώρα: {euro(dueNow)}</p>
              )}
              {paymentMethod === 'bank_transfer' ? (
                <p className="rent-pay-hint">
                  Με τραπεζική μεταφορά η κράτηση δεσμεύεται · θα λάβετε IBAN και αιτιολογία στο email
                  επιβεβαίωσης.
                </p>
              ) : null}
              <button
                type="button"
                className="wallet-btn wallet-btn-primary wallet-btn-block"
                style={{ marginTop: '0.75rem' }}
                disabled={busy}
                onClick={book}
              >
                {busy
                  ? 'Ολοκλήρωση…'
                  : paymentMethod === 'bank_transfer'
                    ? `Κράτηση · κατάθεση ${euro(dueNow)}`
                    : `Πληρωμή ${euro(dueNow)} · Κράτηση`}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {details ? (
        <div className="rent-sheet-backdrop" role="dialog" aria-modal="true">
          <div className="rent-sheet">
            <div className="rent-sheet-head">
              <h3>{details.model}</h3>
              <button type="button" className="rent-btn rent-btn-ghost" onClick={() => setDetails(null)}>
                Κλείσιμο
              </button>
            </div>
            <div className="rent-sheet-gallery">
              {vehiclePhotos(details).length ? (
                vehiclePhotos(details).map((url) => <img key={url} src={url} alt={details.model || 'Vehicle'} loading="lazy" />)
              ) : (
                <div className="rent-vehicle-placeholder">
                  <span className="material-symbols-outlined">directions_car</span>
                </div>
              )}
            </div>
            <div className="rent-sheet-body">
              <p>
                {details.category} · {details.seating_capacity} θέσεις
              </p>
              <p>Από {euro(details.daily_rate_eur)}/ημέρα</p>
              <p>{details.description || 'Καθαρό, ασφαλές και έτοιμο για παραλαβή.'}</p>
              <button
                type="button"
                className="wallet-btn wallet-btn-primary wallet-btn-block"
                onClick={() => {
                  setSelectedId(details.id);
                  setDetails(null);
                }}
              >
                Επιλογή οχήματος
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showMine ? (
      <section className={bare ? '' : 'wallet-panel'} style={bare && mode === 'full' ? { marginTop: '1rem' } : undefined}>
        {!bare ? <h2>Οι ενοικιάσεις μου</h2> : null}
        <p className="wallet-panel-lead">
          {loading ? 'Φόρτωση…' : mine.length ? `${mine.length} κρατήσεις` : 'Καμία κράτηση ακόμα'}
        </p>
        {mine.length > 0 ? (
          <div className="wallet-list">
            {mine.map((b) => (
              <article key={b.id} className="wallet-booking-card">
                <div className="wallet-booking-body">
                  <h3>
                    {b.vehicle_model || 'Όχημα'} · {b.vehicle_plate || '—'}
                  </h3>
                  <p>
                    {formatWhen(b.start_time)} → {formatWhen(b.end_time)}
                  </p>
                  <p className="wallet-booking-mono">
                    {b.pickup_location}
                    {b.dropoff_location && b.dropoff_location !== b.pickup_location
                      ? ` → ${b.dropoff_location}`
                      : ''}
                    {` · ${euro(b.total_cost)} · ${b.rental_status}`}
                    {b.payment_label ? ` · ${b.payment_label}` : ''}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <span
                      className={`wallet-chip ${
                        b.rental_status === 'ACTIVE'
                          ? 'wallet-chip-ok'
                          : b.rental_status === 'CANCELLED'
                            ? 'wallet-chip-muted'
                            : 'wallet-chip-warn'
                      }`}
                    >
                      {b.driver_mode === 'WITH_DRIVER' ? 'Με οδηγό' : 'Self-drive'}
                    </span>
                    {paymentStatusLabel(b.payment_status) ? (
                      <span
                        className={`wallet-chip ${
                          b.payment_status === 'paid'
                            ? 'wallet-chip-ok'
                            : b.payment_status === 'partial'
                              ? 'wallet-chip-warn'
                              : 'wallet-chip-muted'
                        }`}
                      >
                        {paymentStatusLabel(b.payment_status)}
                        {Number(b.balance_due) > 0 ? ` · υπόλ. ${euro(b.balance_due)}` : ''}
                      </span>
                    ) : null}
                    {b.id_verification_status && b.id_verification_status !== 'not_required' ? (
                      <span
                        className={`wallet-chip ${
                          b.id_verification_status === 'verified'
                            ? 'wallet-chip-ok'
                            : b.id_verification_status === 'rejected'
                              ? 'wallet-chip-muted'
                              : 'wallet-chip-warn'
                        }`}
                      >
                        {b.id_verification_status === 'verified'
                          ? 'Ταυτότητα OK'
                          : b.id_verification_status === 'rejected'
                            ? 'Απορρίφθηκε'
                            : 'Έλεγχος ταυτότητας'}
                      </span>
                    ) : null}
                    {b.rental_status === 'CONFIRMED' ? (
                      <button
                        type="button"
                        className="wallet-btn wallet-btn-danger"
                        disabled={busy}
                        onClick={() => cancelBooking(b.id)}
                      >
                        Ακύρωση
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
      ) : null}

      {recentBooked ? (
        <section className={bare ? '' : 'wallet-panel'} style={bare ? { marginTop: '1rem' } : undefined}>
          <h2>Μετά την κράτηση</h2>
          <p className="wallet-panel-lead">
            Στάλθηκε email επιβεβαίωσης
            {recentBooked.payment_label ? ` · ${recentBooked.payment_label}` : ''}.
            {Number(recentBooked.balance_due) > 0
              ? ` Υπόλοιπο στην παραλαβή: ${euro(recentBooked.balance_due)}.`
              : ''}{' '}
            Κράτησε υπενθύμιση για παραλαβή/επιστροφή στο κινητό σου.
          </p>
          <div className="rent-postbook-actions">
            <button
              type="button"
              className="rent-btn rent-btn-ghost"
              onClick={() => {
                downloadIcs(recentBooked);
                toast.success('Έγινε λήψη ημερολογίου (.ics)');
                trackFunnel('download_ics', { booking_id: recentBooked.id });
              }}
            >
              Προσθήκη στο ημερολόγιο
            </button>
            <button
              type="button"
              className="rent-btn rent-btn-ghost"
              onClick={async () => {
                try {
                  if (typeof Notification === 'undefined') {
                    toast.error('Το browser δεν υποστηρίζει υπενθυμίσεις');
                    return;
                  }
                  const perm = await Notification.requestPermission();
                  if (perm !== 'granted') {
                    toast.error('Δεν δόθηκε άδεια ειδοποιήσεων');
                    return;
                  }
                  localStorage.setItem('rent_reminders_enabled_v1', '1');
                  setRemindersEnabled(true);
                  new Notification('Rent reminder ενεργό', {
                    body: 'Θα λαμβάνεις υπενθύμιση όταν ανοίγεις το Rent Wallet πριν την παραλαβή.',
                  });
                  trackFunnel('enable_reminders');
                } catch {
                  toast.error('Αποτυχία ενεργοποίησης υπενθύμισης');
                }
              }}
            >
              {remindersEnabled ? 'Υπενθυμίσεις ενεργές' : 'Ενεργοποίηση υπενθύμισης'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
