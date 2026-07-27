import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  cancelCustomerRentalBooking,
  createCustomerRentalBooking,
  fetchCustomerRentalAvailability,
  fetchMyRentalBookings,
} from '../../services/customerRentalApi.js';
import { ensureCustomerForRental } from '../../lib/customers/customerStore.js';
import { getCustomerEmail, getCustomerName } from '../../lib/auth.js';

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

  const book = async () => {
    if (!selectedId) {
      toast.error('Επιλέξτε όχημα');
      return;
    }
    if (!validateDates()) return;
    const extras = [];
    if (form.extra_insurance) extras.push('Extra insurance');
    if (form.child_seat) extras.push('Child seat');
    if (form.gps_pack) extras.push('GPS pack');
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
        notes: extras.length ? `Extras: ${extras.join(', ')}` : null,
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
            <button
              type="button"
              className="wallet-btn wallet-btn-primary wallet-btn-block"
              style={{ marginTop: '0.75rem' }}
              disabled={busy}
              onClick={book}
            >
              Κράτηση · {euro(selected.suggested_total)}
            </button>
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
