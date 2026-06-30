import { useEffect, useState } from 'react';
import { fetchDriverTripTelemetry } from '../../services/telemetryApi.js';

export default function TelemetryStrip() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = () => fetchDriverTripTelemetry().then(setStats);
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  if (!stats) return null;

  const idleMin = Math.floor(stats.idle_seconds / 60);
  const idling = stats.is_currently_idling;

  return (
    <div className={`driver-card ${idling ? 'border-amber-500/60' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[var(--driver-yellow)] text-[22px]">speed</span>
        <span className="driver-card-label">Τηλεμετρία</span>
        {idling && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-amber-400 animate-pulse">
            Στάση
          </span>
        )}
      </div>
      <div className="driver-stat-grid">
        <div className="driver-stat-tile">
          <p className="text-[11px] text-[var(--driver-muted)] font-semibold">Χρόνος αναμονής</p>
          <p className="value value-gold tabular-nums">{idleMin}′</p>
        </div>
        <div className="driver-stat-tile">
          <p className="text-[11px] text-[var(--driver-muted)] font-semibold">Εξοικ. καυσίμου</p>
          <p className="value value-green tabular-nums">{stats.estimated_fuel_saved_liters} L</p>
        </div>
      </div>
    </div>
  );
}
