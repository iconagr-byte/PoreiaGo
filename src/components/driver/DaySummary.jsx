import { useEffect, useState } from 'react';
import { fetchDriverManifest, getDaySummaryStats } from '../../services/driverPortalApi.js';

export default function DaySummary() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchDriverManifest().then((m) => setStats(getDaySummaryStats(m)));
  }, []);

  if (!stats) {
    return <p className="py-12 text-center text-[var(--driver-muted)]">Φόρτωση σύνοψης…</p>;
  }

  const tiles = [
    { label: 'Συνολικά χλμ', value: stats.totalKm, tone: 'gold', icon: 'straighten' },
    { label: 'Επιβιβασμένοι', value: stats.passengersBoarded, tone: 'white', icon: 'groups' },
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
            className={`driver-card flex items-center gap-4 ${
              t.tone === 'green' ? 'driver-card-accent' : ''
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-black/40 border border-[var(--driver-border)] flex items-center justify-center shrink-0">
              <span
                className={`material-symbols-outlined text-2xl ${
                  t.tone === 'gold'
                    ? 'text-[var(--driver-yellow)]'
                    : t.tone === 'green'
                      ? 'text-[var(--driver-success)]'
                      : 'text-white'
                }`}
              >
                {t.icon}
              </span>
            </div>
            <div>
              <p className="driver-card-label">{t.label}</p>
              <p
                className={`text-3xl font-extrabold tabular-nums mt-0.5 ${
                  t.tone === 'gold'
                    ? 'text-[var(--driver-yellow)]'
                    : t.tone === 'green'
                      ? 'text-[var(--driver-success)]'
                      : 'text-white'
                }`}
              >
                {t.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
