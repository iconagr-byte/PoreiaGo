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
};

export default function RentalCatalogPanel({ mode = 'full', onBooked } = {}) {
  const showBook = mode === 'full' || mode === 'book';
  const showMine = mode === 'full' || mode === 'mine';
  const bare = mode !== 'full';
  const [form, setForm] = useState(EMPTY);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
      setSelectedId(rows[0]?.id || '');
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
      await loadMine();
      if (typeof onBooked === 'function') onBooked(created);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selected = suggestions.find((v) => v.id === selectedId);

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

        <form className="wallet-form" onSubmit={search}>
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
          <button type="submit" className="wallet-btn wallet-btn-primary wallet-btn-block" disabled={busy}>
            {busy ? 'Αναζήτηση…' : 'Εύρεση διαθέσιμων'}
          </button>
        </form>
      </section>
      ) : null}

      {showBook && suggestions.length > 0 ? (
        <section className={bare ? '' : 'wallet-panel'} style={bare ? { marginTop: '1rem' } : undefined}>
          <h2>Επιλέξτε όχημα</h2>
          <p className="wallet-panel-lead">
            {suggestions.length} διαθέσιμα — δείτε φωτογραφίες και περιγραφή πριν την κράτηση.
          </p>
          <div className="rent-vehicle-list">
            {suggestions.map((v) => {
              const photos = (
                v.photo_urls?.length
                  ? v.photo_urls
                  : v.photo_url
                    ? [v.photo_url]
                    : []
              ).filter(Boolean);
              const isSelected = selectedId === v.id;
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
    </div>
  );
}
