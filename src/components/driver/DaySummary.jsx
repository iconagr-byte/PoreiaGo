import { useEffect, useState } from 'react';
import { fetchDriverManifest, getDaySummaryStats } from '../../services/driverPortalApi.js';

function bookingLabel(p) {
  return p?.booking_ref || p?.booking_id || '—';
}

export default function DaySummary() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchDriverManifest().then((m) => {
        if (!cancelled) setStats(getDaySummaryStats(m));
      });
    };
    load();
    window.addEventListener('driver-manifest-updated', load);
    return () => {
      cancelled = true;
      window.removeEventListener('driver-manifest-updated', load);
    };
  }, []);

  if (!stats) {
    return <p className="py-12 text-center text-[var(--driver-muted)]">Φόρτωση σύνοψης…</p>;
  }

  const boardedList = stats.boardedPassengers || [];

  const tiles = [
    { label: 'Συνολικά χλμ', value: stats.totalKm, tone: 'gold', icon: 'straighten' },
    {
      label: 'Επιβιβασμένοι',
      value: stats.passengersBoarded,
      tone: 'white',
      icon: 'groups',
      names: boardedList,
    },
    {
      label: 'Ημερήσια αμοιβή',
      value: `€${stats.dailyEarnings.toFixed(2)}`,
      tone: 'green',
      icon: 'payments',
    },
  ];

  return (
    <div className="driver-stack">
      <div className="text-center py-2">
        <p className="driver-card-label">Τέλος βάρδιας</p>
        <h2 className="text-2xl font-extrabold tracking-tight mt-1">Σύνοψη ημέρας</h2>
      </div>

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

            {Array.isArray(t.names) ? (
              <div className="mt-3 pt-3 border-t border-[var(--driver-border)]">
                {t.names.length === 0 ? (
                  <p className="text-sm text-[var(--driver-muted)]">Κανένας επιβάτης ακόμα.</p>
                ) : (
                  <ul className="space-y-2">
                    {t.names.map((p) => (
                      <li
                        key={`${p.booking_id}-${p.passenger_name}`}
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
