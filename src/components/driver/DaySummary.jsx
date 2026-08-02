import { useEffect, useState } from 'react';
import { fetchDriverManifest, getDaySummaryStats } from '../../services/driverPortalApi.js';
import { getDriverSession, hasOpenDriverTrip } from '../../lib/driver/driverSession.js';
import DriverBoardingSeatMap from './DriverBoardingSeatMap.jsx';

function bookingLabel(p) {
  return p?.booking_ref || p?.booking_id || '—';
}

export default function DaySummary() {
  const [manifest, setManifest] = useState(null);
  const [stats, setStats] = useState(null);
  const session = getDriverSession();

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchDriverManifest().then((m) => {
        if (cancelled) return;
        setManifest(m);
        setStats(m ? getDaySummaryStats(m) : null);
      });
    };
    load();
    window.addEventListener('driver-manifest-updated', load);
    window.addEventListener('driver-trip-cleared', load);
    return () => {
      cancelled = true;
      window.removeEventListener('driver-manifest-updated', load);
      window.removeEventListener('driver-trip-cleared', load);
    };
  }, []);

  if (!hasOpenDriverTrip(session) || !manifest) {
    return (
      <div className="driver-card text-center py-8">
        <p className="driver-card-label">Κρατήσεις</p>
        <h2 className="text-xl font-extrabold tracking-tight mt-1">Χωρίς εκδρομή</h2>
        <p className="mt-2 text-sm font-semibold text-[var(--driver-muted)]">
          Δεν υπάρχει ανοιχτή εκδρομή — η κάτοψη λεωφορείου εμφανίζεται μόνο εδώ όταν υπάρχει
          δρομολόγιο.
        </p>
      </div>
    );
  }

  if (!stats) {
    return <p className="py-12 text-center text-[var(--driver-muted)]">Φόρτωση κρατήσεων…</p>;
  }

  const boardedList = stats.boardedPassengers || [];

  const tiles = [
    { label: 'Συνολικά χλμ', value: stats.totalKm, tone: 'gold', icon: 'straighten' },
    {
      label: 'Επιβιβασμένοι',
      value: stats.passengersBoarded,
      tone: 'white',
      icon: 'groups',
    },
  ];

  return (
    <div className="driver-stack">
      <div className="text-center py-2">
        <p className="driver-card-label">Κρατήσεις</p>
        <h2 className="text-2xl font-extrabold tracking-tight mt-1">Κάτοψη & επιβίβαση</h2>
      </div>

      {manifest ? (
        <div className="driver-card">
          <DriverBoardingSeatMap
            manifest={manifest}
            vehicleType={session?.vehicleType || manifest?.vehicle_type}
          />
        </div>
      ) : null}

      <div className="grid gap-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={`driver-card ${t.tone === 'green' ? 'driver-card-accent' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--driver-accent-soft)] border border-[var(--driver-border)] flex items-center justify-center shrink-0">
                <span
                  className={`material-symbols-outlined text-2xl ${
                    t.tone === 'gold'
                      ? 'text-[var(--driver-yellow-dim)]'
                      : t.tone === 'green'
                        ? 'text-[var(--driver-success)]'
                        : 'text-[var(--driver-accent)]'
                  }`}
                >
                  {t.icon}
                </span>
              </div>
              <div className="min-w-0">
                <p className="driver-card-label">{t.label}</p>
                <p
                  className={`text-3xl font-extrabold tabular-nums mt-0.5 ${
                    t.tone === 'gold'
                      ? 'text-[var(--driver-yellow-dim)]'
                      : t.tone === 'green'
                        ? 'text-[var(--driver-success)]'
                        : 'text-[var(--driver-text)]'
                  }`}
                >
                  {t.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="driver-card">
        <p className="driver-card-label">Επιβάτες που επιβιβάστηκαν</p>
        {boardedList.length === 0 ? (
          <p className="text-sm text-[var(--driver-muted)] mt-2">Κανένας επιβάτης ακόμα.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {boardedList.map((p) => (
              <li
                key={`${p.booking_id}-${p.passenger_name}-${p.seat_number || ''}`}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[var(--driver-text)] truncate">
                    {p.passenger_name || 'Επιβάτης'}
                  </p>
                  <p className="text-xs text-[var(--driver-muted)] mt-0.5">
                    Κράτηση {bookingLabel(p)}
                    {p.seat_number ? ` · Θέση ${p.seat_number}` : ''}
                  </p>
                </div>
                <span
                  className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[rgba(22,163,74,0.12)] text-[var(--driver-success)]"
                  aria-hidden
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
