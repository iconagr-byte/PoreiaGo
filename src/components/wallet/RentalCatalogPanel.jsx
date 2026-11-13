import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  cancelCustomerRentalBooking,
  createCustomerRentalBooking,
  fetchCustomerRentalAvailability,
  fetchCustomerRentalCatalog,
  fetchMyRentalBookings,
  fetchPublicRentalAvailability,
  fetchPublicRentalCatalog,
} from '../../services/customerRentalApi.js';
import { ensureCustomerForRental } from '../../lib/customers/customerStore.js';
import { getCustomerEmail, getCustomerName, getCustomerToken } from '../../lib/auth.js';
import { isNativeRentDemo, isSoftNativeRentDemoToken } from '../../lib/rental/nativeRentDemo.js';
import {
  defaultPickupDateTime,
  defaultReturnDateTime,
  readRentBookingPrefs,
  rentTripSearchReady,
  writeRentBookingPrefs,
} from '../../lib/rental/rentBookingSearch.js';
import { RENT_CATEGORY_OPTIONS } from '../../lib/rental/rentVehicleCategories.js';
import RentOfferCard from '../rental/RentOfferCard.jsx';
import RentVehicleDetailSheet from '../rental/RentVehicleDetailSheet.jsx';
import RentMemberCheckinSheet, { canCheckIn } from '../rental/RentMemberCheckinSheet.jsx';
import WalletRentCheckout from './WalletRentCheckout.jsx';
import { rememberRentVehicle } from '../../lib/rental/rentBookingExtras.js';

const CATEGORIES = [{ value: '', label: 'Όλες' }, ...RENT_CATEGORY_OPTIONS];

const SORT_OPTIONS = [
  { value: 'fit', label: 'Προτεινόμενα', icon: 'auto_awesome' },
  { value: 'price_asc', label: 'Τιμή ↑', icon: 'trending_down' },
  { value: 'price_desc', label: 'Τιμή ↓', icon: 'trending_up' },
  { value: 'seats_desc', label: 'Θέσεις ↓', icon: 'event_seat' },
];

const PRICE_SLIDER_MAX = 1200;
const PRICE_UNLIMITED = 9999;

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
  /** Hide legacy datetime form — trip comes from book-first search bar. */
  bookFirst = false,
  /** Bump to re-read prefs and run availability search. */
  searchTick = 0,
  brandLabel = 'Γραφείο',
  onCheckoutOpenChange,
} = {}) {
  const showBook = mode === 'full' || mode === 'book';
  const showMine = !bookFirst && (mode === 'full' || mode === 'mine');
  const bare = mode !== 'full' && !bookFirst;
  const [form, setForm] = useState(EMPTY);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sortBy, setSortBy] = useState('fit');
  /** 9999 = no price filter; slider max 1200 maps to unlimited. */
  const [priceCap, setPriceCap] = useState(9999);
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);
  const [onlyTopRated, setOnlyTopRated] = useState(false);
  const [details, setDetails] = useState(null);
  const [checkinBooking, setCheckinBooking] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [recentBooked, setRecentBooked] = useState(null);

  useEffect(() => {
    if (typeof onCheckoutOpenChange === 'function') onCheckoutOpenChange(checkoutOpen);
  }, [checkoutOpen, onCheckoutOpenChange]);
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    try {
      return localStorage.getItem('rent_reminders_enabled_v1') === '1';
    } catch {
      return false;
    }
  });

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
        start_time: raw.start_time || f.start_time,
        end_time: raw.end_time || f.end_time,
      }));
      if (raw.sortBy) setSortBy(raw.sortBy);
      if (raw.priceCap) setPriceCap(Number(raw.priceCap));
    } catch {
      /* ignore */
    }
  }, []);

  // Resume payment wizard after login wall (wallet embed path).
  useEffect(() => {
    try {
      const prefs = readRentBookingPrefs();
      if (
        prefs.wizard_pending_confirm &&
        prefs.wizard_step === 'payment' &&
        getCustomerToken() &&
        !isSoftNativeRentDemoToken()
      ) {
        setCheckoutOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const prev = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          ...prev,
          category: form.category,
          min_seats: form.min_seats,
          pickup_location: form.pickup_location,
          dropoff_location: form.dropoff_location,
          driver_mode: form.driver_mode,
          client_phone: form.client_phone,
          start_time: form.start_time,
          end_time: form.end_time,
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

  const asOfferRows = (rows) =>
    (Array.isArray(rows) ? rows : []).map((v) => ({
      ...v,
      suggested_total:
        v.suggested_total != null && v.suggested_total !== ''
          ? Number(v.suggested_total)
          : Number(v.daily_rate_eur || 0),
      suggested_days: v.suggested_days != null ? v.suggested_days : 1,
    }));

  const loadCatalogFallback = useCallback(async () => {
    try {
      let rows = [];
      try {
        rows = await fetchCustomerRentalCatalog();
      } catch {
        rows = await fetchPublicRentalCatalog();
      }
      return asOfferRows(rows);
    } catch {
      return [];
    }
  }, []);

  const runAvailability = useCallback(
    async (override = null, { quiet = false } = {}) => {
      const startDefault = defaultPickupDateTime();
      const next = {
        ...form,
        start_time: override?.start_time || form.start_time || startDefault,
        end_time:
          override?.end_time || form.end_time || defaultReturnDateTime(startDefault),
        pickup_location: override?.pickup_location || form.pickup_location || 'Γραφείο',
        dropoff_location:
          override?.dropoff_location || form.dropoff_location || form.pickup_location || 'Γραφείο',
        category: override?.category ?? form.category,
        min_seats: override?.min_seats ?? form.min_seats,
        driver_mode: override?.driver_mode || form.driver_mode || 'SELF_DRIVE',
      };
      const start = new Date(next.start_time);
      const end = new Date(next.end_time);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        if (!quiet) toast.error('Μη έγκυρες ημερομηνίες');
        return;
      }
      setForm((f) => ({ ...f, ...next }));
      setBusy(true);
      try {
        let rows = [];
        try {
          rows = await fetchCustomerRentalAvailability({
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            category: next.category || undefined,
            minSeats: next.min_seats || undefined,
            pickupLocation: next.pickup_location,
            dropoffLocation: next.dropoff_location,
            driverMode: next.driver_mode,
          });
        } catch (err) {
          // Native / sealed office — try public availability, then catalog.
          try {
            rows = await fetchPublicRentalAvailability({
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              category: next.category || undefined,
              minSeats: next.min_seats || undefined,
              pickupLocation: next.pickup_location,
              dropoffLocation: next.dropoff_location,
              driverMode: next.driver_mode,
            });
          } catch {
            if (!isNativeRentDemo()) throw err;
            rows = [];
          }
        }
        if (!rows.length) {
          rows = await loadCatalogFallback();
        }
        const offerRows = asOfferRows(rows);
        setSuggestions(offerRows);
        const preferredId = preferredVehicle?.id;
        const selected =
          preferredId && offerRows.some((v) => String(v.id) === String(preferredId))
            ? preferredId
            : offerRows[0]?.id || '';
        setSelectedId(selected);
        trackFunnel('availability_loaded', {
          count: offerRows.length,
          preferred: Boolean(preferredVehicle),
        });
        if (!offerRows.length && !quiet) toast.error('Δεν βρέθηκε διαθέσιμο όχημα');
      } catch (err) {
        const fallback = await loadCatalogFallback();
        if (fallback.length) {
          setSuggestions(fallback);
          setSelectedId(fallback[0]?.id || '');
        } else if (!quiet) {
          toast.error(err.message);
        }
      } finally {
        setBusy(false);
      }
    },
    [form, preferredVehicle, loadCatalogFallback],
  );

  const search = async (e) => {
    e?.preventDefault?.();
    if (!validateDates()) return;
    await runAvailability();
  };

  // Book-first: load offer cards as soon as the panel mounts (and on each search).
  useEffect(() => {
    if (!bookFirst) return;
    let raw = {};
    try {
      raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    } catch {
      raw = {};
    }
    const start = raw.start_time || defaultPickupDateTime();
    const patch = {
      start_time: start,
      end_time: raw.end_time || defaultReturnDateTime(start),
      pickup_location: raw.pickup_location || 'Γραφείο',
      dropoff_location: raw.dropoff_location || raw.pickup_location || 'Γραφείο',
      category: raw.category || '',
      min_seats: Number(raw.min_seats || 5),
      driver_mode: raw.driver_mode || 'SELF_DRIVE',
    };
    void runAvailability(patch, { quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookFirst, searchTick]);

  const book = async () => {
    if (!selectedId) {
      toast.error('Επιλέξτε όχημα');
      return;
    }
    if (!validateDates()) return;
    const extras = [];
    if (form.extra_insurance) extras.push('extra_insurance');
    if (form.child_seat) extras.push('child_seat');
    if (form.gps_pack) extras.push('gps_pack');
    setBusy(true);
    try {
      const created = await createCustomerRentalBooking({
        vehicle_id: selectedId,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        pickup_location: form.pickup_location,
        dropoff_location: form.dropoff_location || form.pickup_location,
        driver_mode: form.driver_mode,
        client_phone: form.client_phone || null,
        extras,
      });
      // Mirror into office CRM as a real person (same as trip checkout).
      ensureCustomerForRental({
        id: created?.client_id || undefined,
        name: getCustomerName() || '',
        email: getCustomerEmail() || '',
        phone: form.client_phone || '',
      });
      toast.success('Η κράτηση ενοικίασης καταχωρήθηκε');
      setSuggestions([]);
      setSelectedId('');
      setRecentBooked(created);
      trackFunnel('booking_created', { vehicle_id: selectedId });
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

  const startWalletCheckout = (row) => {
    if (!row?.id) return;
    const start = form.start_time || defaultPickupDateTime();
    const end = form.end_time || defaultReturnDateTime(start);
    rememberRentVehicle(row);
    writeRentBookingPrefs({
      vehicle_id: row.id,
      start_time: start,
      end_time: end,
      pickup_location: form.pickup_location || 'Γραφείο',
      dropoff_location: form.dropoff_location || form.pickup_location || 'Γραφείο',
      driver_mode: form.driver_mode || 'SELF_DRIVE',
      extra_insurance: Boolean(form.extra_insurance),
      child_seat: Boolean(form.child_seat),
      gps_pack: Boolean(form.gps_pack),
      client_phone: form.client_phone || '',
      wizard_step: 'services',
      wizard_pending_confirm: false,
    });
    if (!rentTripSearchReady()) {
      toast.error('Επίλεξε ημερομηνίες παραλαβής και επιστροφής για να συνεχίσεις.');
      window.setTimeout(() => {
        document
          .querySelector('.wallet-rent-bookfirst')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return;
    }
    setSelectedId(row.id);
    setDetails(null);
    setCheckoutOpen(true);
    trackFunnel('wallet_checkout_start', { vehicle_id: row.id });
  };

  if (checkoutOpen) {
    return (
      <WalletRentCheckout
        brandLabel={brandLabel}
        onExit={() => setCheckoutOpen(false)}
        onBooked={(booking) => {
          setCheckoutOpen(false);
          setRecentBooked(booking || null);
          setSuggestions([]);
          setSelectedId('');
          if (onClearPreferred) onClearPreferred();
          void loadMine();
          if (typeof onBooked === 'function') onBooked(booking);
        }}
      />
    );
  }

  return (
    <div className={bare ? 'rent-catalog' : 'wallet-stack'}>
      {showBook ? (
      <section className={bare ? '' : 'wallet-panel'} id={bookFirst ? 'wallet-rent-fleet' : undefined}>
        {!bare && !bookFirst ? (
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

        {!bookFirst ? (
        <form className="wallet-form" onSubmit={search}>
          <div className="rent-booking-steps" aria-label="Βήματα κράτησης">
            <span className={preferredVehicle ? 'is-done' : 'is-active'}>1. Όχημα</span>
            <span className={form.start_time && form.end_time ? 'is-done' : ''}>2. Ημερομηνίες</span>
            <span className={selectedId ? 'is-active' : ''}>3. Επιβεβαίωση</span>
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
          <button type="submit" className="wallet-btn wallet-btn-primary wallet-btn-block" disabled={busy}>
            {busy ? 'Αναζήτηση…' : 'Εύρεση διαθέσιμων'}
          </button>
          <p className="rent-cancel-policy">
            Δωρεάν ακύρωση έως 24 ώρες πριν την παραλαβή. Μετά ισχύει πολιτική γραφείου.
          </p>
        </form>
        ) : null}
        {/* Phone + extras live in the checkout wizard (services/details), not on the fleet list. */}
      </section>
      ) : null}

      {showBook && (bookFirst || suggestions.length > 0) ? (
        <section className={bare ? '' : 'wallet-panel'} style={bare ? { marginTop: '1rem' } : undefined}>
          <div className="rent-results-toolbar rent-results-toolbar--polish">
            <div>
              <h2>Οχήματα</h2>
              <p className="rent-results-count">
                {busy
                  ? 'Αναζήτηση…'
                  : sortedSuggestions.length
                    ? `${sortedSuggestions.length} διαθέσιμα`
                    : suggestions.length
                      ? 'Κανένα με αυτά τα φίλτρα'
                      : 'Επιλέξτε ημερομηνίες πάνω'}
              </p>
            </div>
          </div>
          {suggestions.length ? (
            <>
              <div
                className="rent-sort-chips"
                role="radiogroup"
                aria-label="Ταξινόμηση"
              >
                {SORT_OPTIONS.map((opt) => {
                  const active = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`rent-sort-chip${active ? ' is-active' : ''}`}
                      onClick={() => setSortBy(opt.value)}
                    >
                      <span className="material-symbols-outlined" aria-hidden>
                        {opt.icon}
                      </span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="rent-results-tools rent-results-tools--polish">
                <div className="rent-price-filter">
                  <div className="rent-price-filter-head">
                    <span className="material-symbols-outlined" aria-hidden>
                      payments
                    </span>
                    <strong>
                      {Number(priceCap) >= PRICE_SLIDER_MAX
                        ? 'Χωρίς όριο τιμής'
                        : `Έως €${Math.round(priceCap)}`}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={PRICE_SLIDER_MAX}
                    step={10}
                    value={Math.min(Number(priceCap) || PRICE_SLIDER_MAX, PRICE_SLIDER_MAX)}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setPriceCap(next >= PRICE_SLIDER_MAX ? PRICE_UNLIMITED : next);
                    }}
                    aria-label="Μέγιστη τιμή"
                  />
                </div>
                <div className="rent-filter-toggles" role="group" aria-label="Φίλτρα">
                  <button
                    type="button"
                    className={`rent-filter-toggle${onlyWithPhotos ? ' is-on' : ''}`}
                    aria-pressed={onlyWithPhotos}
                    onClick={() => setOnlyWithPhotos((v) => !v)}
                  >
                    <span className="material-symbols-outlined" aria-hidden>
                      photo_camera
                    </span>
                    Φωτογραφίες
                  </button>
                  <button
                    type="button"
                    className={`rent-filter-toggle${onlyTopRated ? ' is-on' : ''}`}
                    aria-pressed={onlyTopRated}
                    onClick={() => setOnlyTopRated((v) => !v)}
                  >
                    <span className="material-symbols-outlined" aria-hidden>
                      star
                    </span>
                    Top rated
                  </button>
                </div>
              </div>
              <div className="rent-offer-list" role="listbox" aria-label="Διαθέσιμα οχήματα">
                {sortedSuggestions.map((v, idx) => {
                  const isSelected = selectedId === v.id;
                  const listPrice = Number(v.list_total || v.compare_at_total || 0);
                  const total = Number(v.suggested_total || 0);
                  const compareAt = listPrice > total ? listPrice : null;
                  const openVehicleCard = (row) => {
                    setSelectedId(row.id);
                    setDetails(row);
                    trackFunnel('vehicle_open_details', { vehicle_id: row.id });
                  };
                  return (
                    <RentOfferCard
                      key={v.id}
                      as="button"
                      vehicle={v}
                      selected={isSelected}
                      recommended={idx === 0 && sortBy === 'fit'}
                      totalPrice={v.suggested_total}
                      compareAt={compareAt}
                      priceKicker={
                        Number(v.suggested_days) > 1
                          ? `Σύνολο · ${v.suggested_days} ημέρες`
                          : Number(v.daily_rate_eur) > 0 &&
                              Number(v.suggested_total) === Number(v.daily_rate_eur)
                            ? 'από / ημέρα'
                            : 'Συνολική τιμή'
                      }
                      ctaLabel={isSelected ? 'Επιλεγμένο' : 'Επιλογή'}
                      onSelect={() => openVehicleCard(v)}
                      onOpenDetails={openVehicleCard}
                    />
                  );
                })}
              </div>
              {!sortedSuggestions.length ? (
                <p className="wallet-rent-offer-empty">
                  Κανένα όχημα με αυτά τα φίλτρα — δοκιμάστε άλλο όριο τιμής.
                </p>
              ) : null}
            </>
          ) : (
            <p className="wallet-rent-offer-empty">
              {busy ? 'Φόρτωση οχημάτων…' : 'Δεν βρέθηκαν οχήματα για αυτές τις ημερομηνίες.'}
            </p>
          )}
          {selected && sortedSuggestions.length ? (
            <button
              id="wallet-rent-book-cta"
              type="button"
              className="wallet-btn wallet-btn-primary wallet-btn-block"
              style={{ marginTop: '0.75rem' }}
              disabled={busy}
              onClick={() => startWalletCheckout(selected)}
            >
              Συνέχεια · {euro(selected.suggested_total)}
            </button>
          ) : null}
        </section>
      ) : null}

      <RentVehicleDetailSheet
        vehicle={details}
        totalPrice={details?.suggested_total}
        days={details?.suggested_days}
        onClose={() => setDetails(null)}
        selectLabel={
          selected && selectedId === details?.id
            ? `Κράτηση τώρα · ${euro(selected.suggested_total || selected.daily_rate_eur)}`
            : 'Κράτηση τώρα'
        }
        onSelect={(row) => {
          trackFunnel('vehicle_selected_from_detail', { vehicle_id: row.id });
          startWalletCheckout(row);
        }}
      />

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
                    {canCheckIn(b) ? (
                      <button
                        type="button"
                        className="wallet-btn wallet-btn-primary"
                        onClick={() => {
                          setCheckinBooking(b);
                          trackFunnel('open_member_checkin', { booking_id: b.id });
                        }}
                      >
                        Check-in τώρα
                      </button>
                    ) : null}
                    {b.online_checkin_ready ? (
                      <span className="wallet-chip wallet-chip-ok">Check-in έτοιμο</span>
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

      <RentMemberCheckinSheet
        booking={checkinBooking}
        brandLabel={brandLabel}
        onClose={() => setCheckinBooking(null)}
        onCheckedIn={(row) => {
          setMine((list) =>
            list.map((item) => (item.id === row.id ? { ...item, ...row } : item)),
          );
          setCheckinBooking((cur) => (cur && cur.id === row.id ? { ...cur, ...row } : cur));
          trackFunnel('member_checkin_done', { booking_id: row.id });
        }}
      />

      {recentBooked ? (
        <section className={bare ? '' : 'wallet-panel'} style={bare ? { marginTop: '1rem' } : undefined}>
          <h2>Μετά την κράτηση</h2>
          <p className="wallet-panel-lead">Κράτησε υπενθύμιση για παραλαβή/επιστροφή στο κινητό σου.</p>
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
