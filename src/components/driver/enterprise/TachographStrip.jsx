/** Compact tachograph display for driver header. */
export default function TachographStrip({
  drivingLabel,
  limitReached,
  progressPct = 0,
  isCounting = false,
  onBreak = false,
}) {
  const pct = limitReached ? 100 : Math.max(0, Math.min(100, progressPct));
  const status = limitReached
    ? 'Υποχρ. στάση!'
    : onBreak
      ? 'Διάλειμμα'
      : isCounting
        ? 'Όριο 4ω 15λ'
        : 'Σε αναμονή';

  return (
    <div className={`driver-tacho ${limitReached ? 'driver-tacho--alert' : ''}`}>
      <div className="min-w-0 flex items-center gap-3">
        <span
          className={`material-symbols-outlined text-2xl ${
            limitReached ? 'text-red-400' : 'text-[var(--driver-yellow)]'
          }`}
        >
          schedule
        </span>
        <div>
          <p className="driver-card-label">Ταχογράφος</p>
          <p className="font-mono font-extrabold text-lg tracking-tight">{drivingLabel}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="driver-tacho-progress">
          <div className="driver-tacho-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wide ${
            limitReached ? 'text-red-400' : 'text-[var(--driver-muted)]'
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
