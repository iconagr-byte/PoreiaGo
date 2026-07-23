import { useEffect, useState } from 'react';
import { fetchDriverManifest, fetchDriverSchedule } from '../../services/driverPortalApi.js';
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
  const session = getDriverSession();

  useEffect(() => {
    fetchDriverSchedule().then(setStops);
    fetchDriverManifest().then(setManifest);
    const id = setInterval(() => fetchDriverManifest().then(setManifest), LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const boarded = manifest?.boarded_passengers?.length ?? 0;
  const total = manifest?.capacity ?? 45;
  const pct = total > 0 ? Math.min(100, Math.round((boarded / total) * 100)) : 0;

  return (
    <div className="driver-stack">
      <TelemetryStrip />

      <div className="driver-card driver-card-accent">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="driver-card-label">Σημερινό δρομολόγιο</p>
            <h2 className="text-xl font-extrabold mt-1 tracking-tight">
              {manifest?.trip_title || `Εκδρομή #${session?.tripId ?? '—'}`}
            </h2>
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
      </div>

      <div className="driver-card">
        <h3 className="font-bold text-base mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--driver-yellow)] text-[22px]">
            route
          </span>
          Χρονοδιάγραμμα
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
                </div>
              </div>
            </div>
          ))}
        </div>
        {!stops.length && (
          <p className="text-[var(--driver-muted)] py-6 text-center text-sm">
            Φόρτωση χρονοδιαγράμματος…
          </p>
        )}
      </div>
    </div>
  );
}
