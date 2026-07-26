/**
 * Customer rental calendar — month grid, day bookings, map pins.
 */
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchMyRentalBookings, cancelCustomerRentalBooking } from '../../services/customerRentalApi.js';
import { geocodePlaces } from '../../lib/rental/geocodePlace.js';
import toast from 'react-hot-toast';

const WEEKDAYS = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];

function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDay(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDayRange(startIso, endIso, key) {
  if (!startIso) return false;
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  if (Number.isNaN(start.getTime())) return false;
  const day = parseDay(key);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  const rangeEnd = Number.isNaN(end.getTime()) ? start : end;
  return start <= dayEnd && rangeEnd >= dayStart;
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

function pinIcon(selected) {
  const size = selected ? 32 : 26;
  const html = `<div style="width:${size}px;height:${size}px;border-radius:999px;background:#0a7a6c;border:3px solid #fff;box-shadow:0 6px 16px rgba(15,23,42,.28)"></div>`;
  return L.divIcon({
    className: 'rent-cal-pin',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitPins({ pins, focusId }) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) return;
    const focus = focusId ? pins.find((p) => p.id === focusId) : null;
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 12), { duration: 0.5 });
      return;
    }
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 11);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.35), { maxZoom: 12 });
  }, [pins, focusId, map]);
  return null;
}

export default function RentalCustomerCalendar({ refreshKey = 0 }) {
  const todayKey = dayKey(new Date());
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [selectedId, setSelectedId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [geoByPlace, setGeoByPlace] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMyRentalBookings()
      .then((rows) => {
        if (!cancelled) setBookings(rows.filter((b) => b.rental_status !== 'CANCELLED'));
      })
      .catch(() => {
        if (!cancelled) setBookings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const monthLabel = cursor.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });

  const monthBookings = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return bookings.filter((b) => {
      if (!b.start_time) return false;
      const s = new Date(b.start_time);
      const e = b.end_time ? new Date(b.end_time) : s;
      return s <= end && e >= start;
    });
  }, [bookings, cursor]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const pad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < pad; i += 1) out.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dayKey(new Date(year, month, day));
      const items = monthBookings.filter((b) => sameDayRange(b.start_time, b.end_time, key));
      out.push({ day, key, items });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor, monthBookings]);

  const dayBookings = useMemo(
    () => monthBookings.filter((b) => sameDayRange(b.start_time, b.end_time, selectedDay)),
    [monthBookings, selectedDay],
  );

  const list = dayBookings.length ? dayBookings : monthBookings;

  const placesKey = useMemo(() => {
    const places = [
      ...new Set(
        monthBookings
          .flatMap((b) => [b.pickup_location, b.dropoff_location])
          .map((p) => String(p || '').trim())
          .filter(Boolean),
      ),
    ].sort();
    return places.join('\n');
  }, [monthBookings]);

  useEffect(() => {
    let cancelled = false;
    const places = placesKey ? placesKey.split('\n') : [];
    if (!places.length) {
      setGeoByPlace(new Map());
      return undefined;
    }
    geocodePlaces(places).then((map) => {
      if (!cancelled) setGeoByPlace(map);
    });
    return () => {
      cancelled = true;
    };
  }, [placesKey]);

  const pins = useMemo(() => {
    const source = dayBookings.length ? dayBookings : monthBookings;
    return source
      .map((b) => {
        const place = String(b.pickup_location || '').trim() || 'Γραφείο';
        const geo = geoByPlace.get(place);
        if (!geo) return null;
        return { id: b.id, lat: geo.lat, lng: geo.lng, booking: b, place };
      })
      .filter(Boolean);
  }, [dayBookings, monthBookings, geoByPlace]);

  const cancelBooking = async (id) => {
    if (!window.confirm('Ακύρωση κράτησης;')) return;
    setBusy(true);
    try {
      await cancelCustomerRentalBooking(id);
      toast.success('Ακυρώθηκε');
      setBookings((rows) => rows.filter((b) => b.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="rent-cal-month">
        <h3>{monthLabel}</h3>
        <div className="rent-cal-nav">
          <button type="button" aria-label="Προηγούμενος" onClick={() => setCursor((c) => addMonths(c, -1))}>
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            type="button"
            aria-label="Σήμερα"
            onClick={() => {
              setCursor(startOfMonth(new Date()));
              setSelectedDay(todayKey);
            }}
          >
            <span className="material-symbols-outlined">today</span>
          </button>
          <button type="button" aria-label="Επόμενος" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="rent-cal-layout">
        <div>
          <div className="rent-cal-weekdays">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="rent-cal-grid">
            {cells.map((cell, idx) => {
              if (!cell) return <div key={`p-${idx}`} className="rent-cal-cell is-empty" />;
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`rent-cal-cell${cell.key === todayKey ? ' is-today' : ''}${
                    cell.key === selectedDay ? ' is-selected' : ''
                  }`}
                  onClick={() => {
                    setSelectedDay(cell.key);
                    setSelectedId(null);
                  }}
                >
                  <div className="rent-cal-day">{cell.day}</div>
                  {cell.items.length ? <div className="rent-cal-dot" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rent-cal-side">
          <p className="rent-panel-lead" style={{ marginBottom: 0 }}>
            {loading
              ? 'Φόρτωση…'
              : dayBookings.length
                ? `${dayBookings.length} κράτηση(εις) την επιλεγμένη μέρα`
                : monthBookings.length
                  ? `${monthBookings.length} τον μήνα — επιλέξτε μέρα`
                  : 'Καμία κράτηση ακόμα'}
          </p>
          {list.map((b) => (
            <div
              key={b.id}
              className={`rent-cal-card${selectedId === b.id ? ' is-selected' : ''}`}
            >
              <button
                type="button"
                style={{
                  appearance: 'none',
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                }}
                onClick={() => {
                  setSelectedId(b.id);
                  if (b.start_time) setSelectedDay(dayKey(new Date(b.start_time)));
                }}
              >
                <strong>
                  {b.vehicle_model || 'Όχημα'} · {b.vehicle_plate || '—'}
                </strong>
                <span>
                  {formatWhen(b.start_time)} → {formatWhen(b.end_time)}
                </span>
                <span>
                  {b.pickup_location || 'Γραφείο'}
                  {b.dropoff_location && b.dropoff_location !== b.pickup_location
                    ? ` → ${b.dropoff_location}`
                    : ''}
                  {` · ${b.rental_status}`}
                </span>
              </button>
              {b.rental_status === 'CONFIRMED' ? (
                <button
                  type="button"
                  disabled={busy}
                  style={{
                    marginTop: '0.45rem',
                    appearance: 'none',
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    color: '#ff3b30',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => cancelBooking(b.id)}
                >
                  Ακύρωση
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rent-cal-map" aria-label="Χάρτης κρατήσεων">
        {pins.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: '#6e6e73',
              fontSize: '0.85rem',
              padding: '1rem',
              textAlign: 'center',
            }}
          >
            Ο χάρτης εμφανίζει τις τοποθεσίες παραλαβής των κρατήσεών σας.
          </div>
        ) : (
          <MapContainer center={[38.5, 23.5]} zoom={6} scrollWheelZoom={false}>
            <TileLayer
              attribution="&copy; OpenStreetMap &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <FitPins pins={pins} focusId={selectedId} />
            {pins.map((pin) => (
              <Marker
                key={pin.id}
                position={[pin.lat, pin.lng]}
                icon={pinIcon(pin.id === selectedId)}
                eventHandlers={{ click: () => setSelectedId(pin.id) }}
              >
                <Popup>
                  <strong>{pin.booking.vehicle_model || 'Κράτηση'}</strong>
                  <br />
                  {pin.place}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
