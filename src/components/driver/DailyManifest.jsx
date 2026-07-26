import { useEffect, useState } from 'react';
import {
  fetchDriverManifest,
  fetchDriverSchedule,
  fetchDriverTrip,
} from '../../services/driverPortalApi.js';
import { getDriverSession } from '../../lib/driver/driverSession.js';
import TelemetryStrip from './TelemetryStrip.jsx';
import { LIVE_REFRESH_MS } from '../../lib/liveRefresh.js';

const STATUS_LABEL = {
  completed: 'Ολοκληρώθηκε',
  current: 'Τώρα',
  upcoming: 'Επόμενο',
};

export default function DailyManifest() {
  const [stops, setStops] = useState([]);
  const [manifest, setManifest] = useState(null);
  const [tripMeta, setTripMeta] = useState(null);
  const session = getDriverSession();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [trip, apiStops, man] = await Promise.all([
        fetchDriverTrip().catch(() => null),
        fetchDriverSchedule().catch(() => []),
        fetchDriverManifest().catch(() => null),
      ]);
      if (cancelled) return;
      setTripMeta(trip);
      const schedule = (trip?.stops?.length ? trip.stops : null) || apiStops || session?.schedule || [];
      setStops(schedule);
      setManifest(man);
    };

    load();
    const id = setInterval(() => {
      fetchDriverManifest().then((m) => {
        if (!cancelled) setManifest(m);
      });
    }, LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [session?.tripId]);

  const boarded = manifest?.boarded_passengers?.length ?? 0;
  const total = manifest?.capacity ?? tripMeta?.total_seats ?? 45;
  const pct = total > 0 ? Math.min(100, Math.round((boarded / total) * 100)) : 0;
  const title =
    manifest?.trip_title ||
    tripMeta?.trip_title ||
    session?.tripTitle ||
    `Εκδρομή #${session?.tripId ?? '—'}`;
  const destination =
    manifest?.destination || tripMeta?.destination || session?.destination || '';
  const meetingPoint =
    manifest?.meeting_point || tripMeta?.meeting_point || session?.meetingPoint || '';

  return (
    <div className="driver-stack">
      <TelemetryStrip />

      <div className="driver-card driver-card-accent">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="driver-card-label">Σημερινό δρομολόγιο</p>
            <h2 className="text-xl font-extrabold mt-1 tracking-tight">{title}</h2>
            {destination ? (
              <p className="text-sm font-bold text-[var(--driver-muted)] mt-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[var(--driver-yellow)]">
                  location_on
                </span>
                {destination}
              </p>
            ) : null}
            {meetingPoint ? (
              <p className="text-xs text-[var(--driver-muted)] mt-1">
                Συνάντηση: {meetingPoint}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 w-11 h-11 rounded-xl bg-[var(--driver-yellow-soft)] border border-[var(--driver-yellow)]/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[var(--driver-yellow)]">groups</span>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            <p className="text-3xl font-extrabold text-[var(--driver-yellow)] tabular-nums">
              {boarded}
              <span className="text-lg text-[var(--driver-muted)] font-bold">/{total}</span>
            </p>
            <p className="text-xs text-[var(--driver-muted)] font-semibold mt-0.5">επιβιβασμένοι</p>
          </div>
          <p className="text-sm font-bold text-[var(--driver-muted)]">{pct}%</p>
        </div>
        <div className="driver-boarding-bar">
          <div className="driver-boarding-fill" style={{ width: `${pct}%` }} />
        </div>
        {(manifest?.boarded_passengers || []).length > 0 ? (
          <ul className="mt-3 pt-3 border-t border-[var(--driver-border)] space-y-2">
            {manifest.boarded_passengers.map((p) => (
              <li key={`${p.booking_id}-${p.passenger_name}`} className="text-sm">
                <p className="font-bold truncate">{p.passenger_name || 'Επιβάτης'}</p>
                <p className="text-xs text-[var(--driver-muted)] mt-0.5">
                  Κράτηση {p.booking_ref || p.booking_id || '—'}
                  {p.seat_number ? ` · Θέση ${p.seat_number}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
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
