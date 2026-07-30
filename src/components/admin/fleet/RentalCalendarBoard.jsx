/**
 * Rental utilization calendar — month grid + bookings sidebar + map pins.
 */
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  geocodePlaces,
  jitterLatLng,
  placesFromBookings,
  resolvePlaceSync,
} from '../../../lib/rental/geocodePlace.js';

const WEEKDAYS = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];

const STATUS_TONE = {
  RESERVED: { chip: 'bg-indigo-100 text-indigo-800', dot: '#6366f1', label: 'Κράτηση' },
  CONFIRMED: { chip: 'bg-sky-100 text-sky-800', dot: '#0ea5e9', label: 'Επιβεβαιωμένη' },
  ACTIVE: { chip: 'bg-emerald-100 text-emerald-800', dot: '#10b981', label: 'Ενεργή' },
  COMPLETED: { chip: 'bg-slate-100 text-slate-700', dot: '#64748b', label: 'Ολοκληρωμένη' },
  CANCELLED: { chip: 'bg-rose-100 text-rose-700', dot: '#f43f5e', label: 'Ακυρωμένη' },
  MAINTENANCE: { chip: 'bg-amber-100 text-amber-800', dot: '#f59e0b', label: 'Συντήρηση' },
  CLEANING: { chip: 'bg-cyan-100 text-cyan-800', dot: '#06b6d4', label: 'Καθαρισμός' },
  SERVICE_DUE: { chip: 'bg-orange-100 text-orange-800', dot: '#f97316', label: 'Service' },
};

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

function pinIcon(color, selected) {
  const size = selected ? 34 : 28;
  const html = `
    <div style="
      width:${size}px;height:${size}px;border-radius:999px;
      background:${color};border:3px solid #fff;
      box-shadow:0 6px 16px rgba(15,23,42,.28);
      display:flex;align-items:center;justify-content:center;
      transform: translateY(-2px);
    ">
      <span style="color:#fff;font-size:${selected ? 15 : 13}px;line-height:1">●</span>
    </div>`;
  return L.divIcon({
    className: 'rental-cal-pin',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitPins({ pins, focusId }) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) return;
    const focus = focusId ? pins.find((p) => p.id === focusId) : null;
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 12), { duration: 0.55 });
      return;
    }
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 11);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.35), { maxZoom: 12, animate: true });
  }, [pins, focusId, map]);
  return null;
}

function bookingTone(status) {
  return STATUS_TONE[status] || STATUS_TONE.CONFIRMED;
}

export default function RentalCalendarBoard({
  bookings = [],
  blocks = [],
  onCancelBooking,
  loading = false,
}) {
  const todayKey = dayKey(new Date());
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [geoByPlace, setGeoByPlace] = useState(() => new Map());
  const [geoBusy, setGeoBusy] = useState(false);

  const rentalBlocks = useMemo(() => {
    const fromBookings = (bookings || [])
      .filter((b) => b.rental_status !== 'CANCELLED')
      .map((b) => ({
        id: b.id,
        kind: 'rental',
        title: b.client_name || 'Πελάτης',
        plate_number: b.vehicle_plate,
        model: b.vehicle_model,
        category: b.vehicle_category,
        start_time: b.start_time,
        end_time: b.end_time,
        status: b.rental_status,
        pickup_location: b.pickup_location,
        dropoff_location: b.dropoff_location,
        total_cost: b.total_cost,
        driver_mode: b.driver_mode,
        channel: b.channel,
        client_phone: b.client_phone,
        client_email: b.client_email,
      }));

    // Prefer booking rows (richer). Fill gaps from calendar blocks.
    const ids = new Set(fromBookings.map((b) => b.id));
    const extras = (blocks || [])
      .filter((b) => b.kind === 'rental' && b.status !== 'CANCELLED' && !ids.has(b.id))
      .map((b) => ({
        id: b.id,
        kind: 'rental',
        title: b.title || 'Πελάτης',
        plate_number: b.plate_number,
        model: b.model,
        category: b.category,
        start_time: b.start_time,
        end_time: b.end_time,
        status: b.status,
        pickup_location: b.pickup_location,
        dropoff_location: b.dropoff_location,
        total_cost: b.total_cost,
      }));

    const maintenance = (blocks || [])
      .filter((b) => b.kind === 'maintenance' || b.kind === 'service_due')
      .map((b) => ({
        id: b.id,
        kind: b.kind,
        title: b.title,
        plate_number: b.plate_number,
        model: b.model,
        status: b.status,
        start_time: b.start_time,
        end_time: b.end_time,
      }));

    return [...fromBookings, ...extras, ...maintenance].sort((a, b) => {
      const ta = a.start_time ? new Date(a.start_time).getTime() : 0;
      const tb = b.start_time ? new Date(b.start_time).getTime() : 0;
      return ta - tb;
    });
  }, [bookings, blocks]);

  const monthLabel = cursor.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });

  const monthGrid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Monday-first offset
    const pad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < pad; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dayKey(new Date(year, month, day));
      const items = rentalBlocks.filter((b) => {
        if (b.kind !== 'rental') return false;
        return sameDayRange(b.start_time, b.end_time, key);
      });
      cells.push({ day, key, items });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor, rentalBlocks]);

  const monthRentals = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return rentalBlocks.filter((b) => {
      if (b.kind !== 'rental' || !b.start_time) return false;
      const start = new Date(b.start_time);
      const end = b.end_time ? new Date(b.end_time) : start;
      return start <= monthEnd && end >= monthStart;
    });
  }, [cursor, rentalBlocks]);

  const dayRentals = useMemo(
    () => monthRentals.filter((b) => sameDayRange(b.start_time, b.end_time, selectedDay)),
    [monthRentals, selectedDay],
  );

  const sidebarList = dayRentals.length ? dayRentals : monthRentals;

  const placesKey = useMemo(
    () => placesFromBookings(monthRentals).sort().join('\n'),
    [monthRentals],
  );

  useEffect(() => {
    let cancelled = false;
    const places = placesKey ? placesKey.split('\n') : [];
    if (!places.length) {
      setGeoByPlace(new Map());
      return undefined;
    }
    // Immediate sync pins (Γραφείο / πόλεις) — don't wait for Nominatim.
    const syncMap = new Map(places.map((p) => [p, resolvePlaceSync(p)]));
    setGeoByPlace(syncMap);
    setGeoBusy(true);
    geocodePlaces(places)
      .then((map) => {
        if (!cancelled) setGeoByPlace(map);
      })
      .finally(() => {
        if (!cancelled) setGeoBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [placesKey]);

  const mapPins = useMemo(() => {
    const source = dayRentals.length ? dayRentals : monthRentals;
    const pins = [];
    source.forEach((b, index) => {
      const pickup = String(b.pickup_location || '').trim() || 'Γραφείο';
      const drop = String(b.dropoff_location || '').trim();
      const pickupGeo = geoByPlace.get(pickup) || resolvePlaceSync(pickup);
      const jittered = jitterLatLng(pickupGeo.lat, pickupGeo.lng, index, source.length);
      pins.push({
        id: `${b.id}-pickup`,
        bookingId: b.id,
        lat: jittered.lat,
        lng: jittered.lng,
        kind: 'pickup',
        booking: b,
        place: pickup,
      });
      if (drop && drop.toLowerCase() !== pickup.toLowerCase()) {
        const dropGeo = geoByPlace.get(drop) || resolvePlaceSync(drop);
        pins.push({
          id: `${b.id}-drop`,
          bookingId: b.id,
          lat: dropGeo.lat,
          lng: dropGeo.lng,
          kind: 'dropoff',
          booking: b,
          place: drop,
        });
      }
    });
    return pins;
  }, [dayRentals, monthRentals, geoByPlace]);

  const routeLines = useMemo(() => {
    const byBooking = new Map();
    mapPins.forEach((p) => {
      if (!byBooking.has(p.bookingId)) byBooking.set(p.bookingId, {});
      byBooking.get(p.bookingId)[p.kind] = p;
    });
    return [...byBooking.values()]
      .filter((pair) => pair.pickup && pair.dropoff)
      .map((pair) => ({
        id: pair.pickup.bookingId,
        positions: [
          [pair.pickup.lat, pair.pickup.lng],
          [pair.dropoff.lat, pair.dropoff.lng],
        ],
        selected: pair.pickup.bookingId === selectedBookingId,
      }));
  }, [mapPins, selectedBookingId]);

  const selectedDayLabel = useMemo(() => {
    try {
      return parseDay(selectedDay).toLocaleDateString('el-GR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch {
      return selectedDay;
    }
  }, [selectedDay]);

  return (
    <div className="space-y-4">
      <div className="rounded-[26px] border border-black/[0.06] bg-white/80 backdrop-blur-xl p-4 sm:p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6e6e73]">
              Ημερολόγιο ενοικιάσεων
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight capitalize mt-0.5">
              {monthLabel}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              className="w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center"
              aria-label="Προηγούμενος μήνας"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const now = startOfMonth(new Date());
                setCursor(now);
                setSelectedDay(todayKey);
              }}
              className="px-3.5 py-2 rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Σήμερα
            </button>
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center"
              aria-label="Επόμενος μήνας"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)] gap-4">
          {/* Month grid */}
          <div className="rounded-2xl border border-white/80 bg-white/90 p-3 sm:p-4 shadow-sm">
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-slate-400 uppercase mb-2">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {monthGrid.map((cell, idx) => {
                if (!cell) {
                  return <div key={`pad-${idx}`} className="min-h-[4.75rem] rounded-xl bg-slate-50/40" />;
                }
                const count = cell.items.length;
                const isToday = cell.key === todayKey;
                const isSelected = cell.key === selectedDay;
                const hasActive = cell.items.some((i) => i.status === 'ACTIVE');
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => {
                      setSelectedDay(cell.key);
                      setSelectedBookingId(null);
                    }}
                    className={`min-h-[4.75rem] rounded-xl border p-1.5 text-left transition-all ${
                      isSelected
                        ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-200/80 shadow-sm'
                        : isToday
                          ? 'border-amber-300 bg-amber-50/70'
                          : count
                            ? 'border-sky-100 bg-sky-50/40 hover:border-teal-200'
                            : 'border-slate-100 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? 'text-teal-900' : 'text-slate-700'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {count > 0 ? (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            hasActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {count}
                        </span>
                      ) : null}
                    </div>
                    {count > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {cell.items.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            className="truncate text-[10px] font-semibold text-slate-600 leading-tight"
                            title={item.title}
                          >
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                              style={{ background: bookingTone(item.status).dot }}
                            />
                            {item.plate_number || item.title}
                          </div>
                        ))}
                        {count > 2 ? (
                          <p className="text-[10px] font-bold text-slate-400">+{count - 2}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Ενεργή
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500" /> Επιβεβαιωμένη
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full ring-2 ring-amber-300 bg-amber-50" /> Σήμερα
              </span>
              <span className="ml-auto text-slate-400">
                {monthRentals.length} κρατήσεις τον μήνα
              </span>
            </div>
          </div>

          {/* Bookings sidebar */}
          <aside className="rounded-2xl border border-white/80 bg-white/95 shadow-sm flex flex-col min-h-[22rem] max-h-[36rem]">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {dayRentals.length ? 'Κρατήσεις ημέρας' : 'Κρατήσεις μήνα'}
              </p>
              <h4 className="font-bold text-slate-900 capitalize mt-0.5">
                {dayRentals.length ? selectedDayLabel : monthLabel}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? 'Φόρτωση…'
                  : sidebarList.length
                    ? `${sidebarList.length} εγγραφές`
                    : 'Καμία κράτηση'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {!loading && sidebarList.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[24px]">event_available</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800">Άδεια μέρα</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Επιλέξτε άλλη ημερομηνία ή δημιουργήστε νέα κράτηση.
                  </p>
                </div>
              ) : (
                sidebarList.map((b) => {
                  const tone = bookingTone(b.status);
                  const selected = selectedBookingId === b.id;
                  return (
                    <div
                      key={b.id}
                      className={`px-4 py-3 transition-colors ${
                        selected ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBookingId(b.id);
                          if (b.start_time) setSelectedDay(dayKey(new Date(b.start_time)));
                        }}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-900 truncate">
                              {b.title || 'Πελάτης'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {b.plate_number || '—'}
                              {b.model ? ` · ${b.model}` : ''}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${tone.chip}`}
                          >
                            {tone.label || b.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5">
                          {formatWhen(b.start_time)} → {formatWhen(b.end_time)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          <span className="material-symbols-outlined text-[14px] align-middle mr-0.5">
                            location_on
                          </span>
                          {b.pickup_location || 'Γραφείο'}
                          {b.dropoff_location && b.dropoff_location !== b.pickup_location
                            ? ` → ${b.dropoff_location}`
                            : ''}
                          {b.total_cost != null ? ` · ${euro(b.total_cost)}` : ''}
                        </p>
                      </button>
                      {b.status === 'CONFIRMED' && typeof onCancelBooking === 'function' ? (
                        <button
                          type="button"
                          className="mt-2 text-[11px] font-bold text-rose-600 hover:underline"
                          onClick={() => onCancelBooking(b.id)}
                        >
                          Ακύρωση
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Map */}
      <div className="rounded-[26px] border border-black/[0.06] bg-white/85 backdrop-blur-xl overflow-hidden shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="px-4 py-3 border-b border-black/[0.05] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-[#1d1d1f] tracking-tight inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-[#0a7a6c] text-[22px]">map</span>
              Χάρτης κρατήσεων
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {monthRentals.length === 0
                ? `Καμία κράτηση τον ${monthLabel} — ο χάρτης γεμίζει όταν υπάρχουν κρατήσεις.`
                : dayRentals.length
                  ? `Pins για ${selectedDayLabel}`
                  : `Pins για όλες τις κρατήσεις του ${monthLabel}`}
              {geoBusy ? ' · γεωκωδικοποίηση…' : ''}
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {mapPins.length} σημεία
          </span>
        </div>
        <div className="relative h-[22rem] sm:h-[26rem] bg-slate-100">
          {mapPins.length === 0 ? (
            <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
              <div className="rounded-2xl bg-white/90 border border-slate-200 px-4 py-3 text-sm text-slate-600 shadow-sm">
                {monthRentals.length === 0
                  ? 'Δημιουργήστε κράτηση για να εμφανιστεί pin στον χάρτη.'
                  : 'Φόρτωση τοποθεσιών…'}
              </div>
            </div>
          ) : null}
          <MapContainer
            center={[38.5, 23.5]}
            zoom={6}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution="&copy; OpenStreetMap &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <FitPins pins={mapPins} focusId={selectedBookingId ? `${selectedBookingId}-pickup` : null} />
            {routeLines.map((line) => (
              <Polyline
                key={line.id}
                positions={line.positions}
                pathOptions={{
                  color: line.selected ? '#0f766e' : '#94a3b8',
                  weight: line.selected ? 4 : 2,
                  dashArray: '6 8',
                  opacity: line.selected ? 0.9 : 0.55,
                }}
              />
            ))}
            {mapPins.map((pin) => {
              const tone = bookingTone(pin.booking.status);
              const selected = pin.bookingId === selectedBookingId;
              return (
                <Marker
                  key={pin.id}
                  position={[pin.lat, pin.lng]}
                  icon={pinIcon(
                    pin.kind === 'dropoff' ? '#f59e0b' : tone.dot,
                    selected,
                  )}
                  eventHandlers={{
                    click: () => setSelectedBookingId(pin.bookingId),
                  }}
                >
                  <Popup>
                    <div className="text-sm min-w-[10rem]">
                      <p className="font-bold text-slate-900">
                        {pin.booking.title || 'Κράτηση'}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {pin.kind === 'pickup' ? 'Παραλαβή' : 'Επιστροφή'}: {pin.place}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {pin.booking.plate_number || '—'} · {formatWhen(pin.booking.start_time)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
