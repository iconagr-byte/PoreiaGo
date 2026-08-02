import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchDriverManifest,
  fetchDriverSchedule,
  fetchDriverTrip,
} from '../../services/driverPortalApi.js';
import {
  getDriverSession,
  hasOpenDriverTrip,
} from '../../lib/driver/driverSession.js';
import { LIVE_REFRESH_MS } from '../../lib/liveRefresh.js';

const STATUS_LABEL = {
  completed: 'Ολοκληρώθηκε',
  current: 'Τώρα',
  upcoming: 'Επόμενο',
};

function passengerKey(p, i) {
  return `${p?.booking_id || p?.booking_ref || 'p'}-${p?.seat_number || ''}-${i}`;
}

function formatTime(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (!s) return '';
  // "08:30", "08:30:00", ISO — show HH:MM when possible
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return s;
}

function PassengerRow({ passenger, tone = 'waiting' }) {
  const name = passenger?.passenger_name || 'Επιβάτης';
  const seat = passenger?.seat_number;
  const phone = passenger?.phone;
  const ref = passenger?.booking_ref || passenger?.booking_id;
  const boardedAt = formatTime(passenger?.boarded_at);
  const icon = tone === 'boarded' ? 'check_circle' : 'person';
  const iconClass =
    tone === 'boarded' ? 'text-[var(--driver-success)]' : 'text-[var(--driver-yellow)]';

  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-[var(--driver-border)] last:border-0">
      <span className={`material-symbols-outlined text-[22px] mt-0.5 shrink-0 ${iconClass}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold truncate text-sm text-slate-900">{name}</p>
        <p className="text-xs text-[var(--driver-muted)] mt-0.5 leading-relaxed">
          {seat ? `Θέση ${seat}` : 'Χωρίς θέση'}
          {ref ? ` · ${ref}` : ''}
          {boardedAt ? ` · ${boardedAt}` : ''}
        </p>
        {phone ? (
          <a
            href={`tel:${String(phone).replace(/\s+/g, '')}`}
            className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-[var(--driver-accent)]"
          >
            <span className="material-symbols-outlined text-[14px]">call</span>
            {phone}
          </a>
        ) : null}
      </div>
    </li>
  );
}

export default function DailyManifest() {
  const [stops, setStops] = useState([]);
  const [manifest, setManifest] = useState(null);
  const [tripMeta, setTripMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const session = getDriverSession();
  const inflightRef = useRef(false);

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    if (!silent) setLoading(true);
    setError('');
    try {
      const [trip, apiStops, man] = await Promise.all([
        fetchDriverTrip().catch(() => null),
        fetchDriverSchedule().catch(() => []),
        fetchDriverManifest().catch(() => null),
      ]);
      if (!trip && !man) {
        setTripMeta(null);
        setManifest(null);
        setStops([]);
        setError('');
      } else {
        setTripMeta(trip);
        const schedule =
          (trip?.stops?.length ? trip.stops : null) ||
          apiStops ||
          [];
        setStops(schedule);
        setManifest(man);
      }
    } catch {
      setError('Αποτυχία φόρτωσης ταξιδιού. Δοκιμάστε ξανά.');
    } finally {
      inflightRef.current = false;
      setLoading(false);
    }
  }, []);

  const refreshManifest = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const man = await fetchDriverManifest().catch(() => null);
      setManifest(man);
      if (!man && !hasOpenDriverTrip()) {
        setTripMeta(null);
        setStops([]);
      }
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadAll();
    };
    run();

    const id = setInterval(() => {
      if (!cancelled) refreshManifest();
    }, LIVE_REFRESH_MS);

    const onUpdated = () => {
      if (!cancelled) refreshManifest();
    };
    const onCleared = () => {
      if (cancelled) return;
      setTripMeta(null);
      setManifest(null);
      setStops([]);
      setLoading(false);
    };
    window.addEventListener('driver-manifest-updated', onUpdated);
    window.addEventListener('driver-trip-cleared', onCleared);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('driver-manifest-updated', onUpdated);
      window.removeEventListener('driver-trip-cleared', onCleared);
    };
  }, [session?.tripId, loadAll, refreshManifest]);

  const boardedList = manifest?.boarded_passengers || [];
  const waitingList = manifest?.missing_passengers || [];
  const boarded = manifest?.boarded_count ?? boardedList.length;
  const booked = manifest?.booked_count ?? boarded + waitingList.length;
  const total = manifest?.capacity ?? tripMeta?.total_seats ?? Math.max(booked, 1);
  const pct =
    total > 0
      ? Math.min(100, Math.round((boarded / total) * 100))
      : 0;

  const title =
    manifest?.trip_title ||
    tripMeta?.trip_title ||
    session?.tripTitle ||
    (session?.tripId ? `Εκδρομή #${session.tripId}` : 'Χωρίς ταξίδι');
  const destination =
    manifest?.destination || tripMeta?.destination || session?.destination || '';
  const meetingPoint =
    manifest?.meeting_point || tripMeta?.meeting_point || session?.meetingPoint || '';
  const departure = formatTime(tripMeta?.departure_time);
  const arrival = formatTime(tripMeta?.arrival_time);
  const vehicle =
    session?.vehiclePlate || session?.vehicleCode
      ? [session?.vehicleCode, session?.vehiclePlate].filter(Boolean).join(' · ')
      : '';

  if (loading && !manifest && !tripMeta) {
    return (
      <div className="driver-stack">
        <div className="driver-card driver-card-accent">
          <p className="driver-card-label">Σημερινό δρομολόγιο</p>
          <p className="mt-3 text-sm font-semibold text-[var(--driver-muted)]">
            Φόρτωση ταξιδιού και πελατών…
          </p>
          <div className="driver-boarding-bar mt-4">
            <div className="driver-boarding-fill" style={{ width: '28%' }} />
          </div>
        </div>
      </div>
    );
  }

  // Only show excursion + bus map when office opened / assigned a real trip.
  const hasTrip = Boolean(
    hasOpenDriverTrip(session) && (tripMeta?.trip_id || manifest?.trip_id),
  );

  if (!hasTrip) {
    return (
      <div className="driver-stack">
        <div className="driver-card driver-card-accent">
          <p className="driver-card-label">Σημερινό δρομολόγιο</p>
          <h2 className="text-xl font-extrabold mt-1 tracking-tight">Χωρίς εκδρομή</h2>
          <p className="mt-2 text-sm font-semibold text-[var(--driver-muted)] leading-relaxed">
            Δεν φορτώνεται εκδρομή ούτε κάτοψη λεωφορείου μέχρι το γραφείο να ανοίξει /
            αναθέσει δρομολόγιο (Master QR ή ανάθεση).
          </p>
          <button
            type="button"
            onClick={() => loadAll({ silent: false })}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--driver-yellow-soft)] border border-[var(--driver-yellow)]/30 px-3 py-2 text-sm font-bold"
          >
            <span className="material-symbols-outlined text-[var(--driver-yellow)] text-[20px]">
              refresh
            </span>
            Έλεγχος ξανά
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="driver-stack">
      <div className="driver-card driver-card-accent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="driver-card-label">Σημερινό δρομολόγιο</p>
            <h2 className="text-xl font-extrabold mt-1 tracking-tight break-words">{title}</h2>
            {destination ? (
              <p className="text-sm font-bold text-[var(--driver-muted)] mt-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[var(--driver-yellow)]">
                  location_on
                </span>
                {destination}
              </p>
            ) : null}
            {meetingPoint ? (
              <p className="text-xs text-[var(--driver-muted)] mt-1.5 flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px] shrink-0">flag</span>
                <span>
                  Συνάντηση: <span className="font-semibold text-slate-700">{meetingPoint}</span>
                </span>
              </p>
            ) : null}
            {(departure || arrival) && (
              <p className="text-xs text-[var(--driver-muted)] mt-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                {departure ? `Αναχώρηση ${departure}` : ''}
                {departure && arrival ? ' · ' : ''}
                {arrival ? `Άφιξη ${arrival}` : ''}
              </p>
            )}
            {vehicle ? (
              <p className="text-xs text-[var(--driver-muted)] mt-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">directions_bus</span>
                {vehicle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => loadAll({ silent: false })}
            className="shrink-0 w-11 h-11 rounded-xl bg-[var(--driver-yellow-soft)] border border-[var(--driver-yellow)]/30 flex items-center justify-center"
            aria-label="Ανανέωση ταξιδιού"
            title="Ανανέωση"
          >
            <span className="material-symbols-outlined text-[var(--driver-yellow)]">refresh</span>
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            <p className="text-3xl font-extrabold text-[var(--driver-yellow)] tabular-nums">
              {boarded}
              <span className="text-lg text-[var(--driver-muted)] font-bold">/{total}</span>
            </p>
            <p className="text-xs text-[var(--driver-muted)] font-semibold mt-0.5">
              επιβιβασμένοι · {booked} κρατήσεις
            </p>
          </div>
          <p className="text-sm font-bold text-[var(--driver-muted)]">{pct}%</p>
        </div>
        <div className="driver-boarding-bar">
          <div className="driver-boarding-fill" style={{ width: `${pct}%` }} />
        </div>

        {error ? (
          <p className="mt-3 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {error}
          </p>
        ) : null}
      </div>

      <div className="driver-card">
        <h3 className="font-bold text-base mb-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--driver-yellow)] text-[22px]">
              hourglass_top
            </span>
            Αναμονή επιβίβασης
          </span>
          <span className="text-sm font-extrabold tabular-nums text-[var(--driver-muted)]">
            {waitingList.length}
          </span>
        </h3>
        {waitingList.length ? (
          <ul className="mt-1">
            {waitingList.map((p, i) => (
              <PassengerRow key={passengerKey(p, i)} passenger={p} tone="waiting" />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--driver-muted)] py-4 text-center">
            {manifest
              ? 'Όλοι οι επιβάτες έχουν επιβιβαστεί ή δεν υπάρχουν κρατήσεις.'
              : 'Φόρτωση πελατών…'}
          </p>
        )}
      </div>

      <div className="driver-card">
        <h3 className="font-bold text-base mb-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--driver-success)] text-[22px]">
              groups
            </span>
            Επιβιβασμένοι
          </span>
          <span className="text-sm font-extrabold tabular-nums text-[var(--driver-muted)]">
            {boardedList.length}
          </span>
        </h3>
        {boardedList.length ? (
          <ul className="mt-1">
            {boardedList.map((p, i) => (
              <PassengerRow key={passengerKey(p, i)} passenger={p} tone="boarded" />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--driver-muted)] py-4 text-center">
            Κανένας επιβιβασμένος ακόμα.
          </p>
        )}
      </div>

      <div className="driver-card">
        <h3 className="font-bold text-base mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--driver-yellow)] text-[22px]">
            route
          </span>
          Χρονοδιάγραμμα
          {stops.some((s) => s.hybrid) ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--driver-muted)]">
              Hybrid
            </span>
          ) : null}
        </h3>
        <div className="driver-timeline">
          {stops.map((stop, i) => (
            <div
              key={`${stop.time}-${i}`}
              className={`driver-timeline-item ${stop.status === 'current' ? 'current' : ''} ${
                stop.status === 'completed' ? 'completed' : ''
              }`}
            >
              <div className="driver-timeline-time">{stop.time}</div>
              <div>
                <div className="driver-timeline-stop">{stop.stop}</div>
                <div className="driver-timeline-status">
                  {STATUS_LABEL[stop.status] || stop.status}
                  {stop.delayMinutes ? ` · +${stop.delayMinutes}′` : ''}
                </div>
                {stop.lat && stop.lng ? (
                  <a
                    className="text-xs font-bold underline mt-1 inline-block text-[var(--driver-yellow)]"
                    href={`https://www.google.com/maps?q=${encodeURIComponent(`${stop.lat},${stop.lng}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GPS pickup
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {!stops.length && (
          <p className="text-[var(--driver-muted)] py-6 text-center text-sm">
            Δεν υπάρχει χρονοδιάγραμμα για αυτή την εκδρομή ακόμα.
          </p>
        )}
      </div>
    </div>
  );
}
