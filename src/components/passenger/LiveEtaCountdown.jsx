import { useLiveEta } from '../../hooks/useLiveEta.js';

const TRAFFIC_STYLES = {
  light: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  moderate: 'bg-sky-50 text-sky-700 border-sky-200',
  heavy: 'bg-amber-50 text-amber-800 border-amber-200',
  severe: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function LiveEtaCountdown({ tripId, className = '' }) {
  const { eta, displayText, loading, error, secondsRemaining, wsConnected } = useLiveEta(tripId);

  if (!tripId) return null;

  const trafficClass = TRAFFIC_STYLES[eta?.traffic_level] || TRAFFIC_STYLES.moderate;

  return (
    <section
      className={`rounded-[28px] border border-black/[0.06] bg-gradient-to-br from-primary/5 via-white to-white p-6 shadow-sm ${className}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest mb-2">
            <span className="material-symbols-outlined text-[18px] animate-pulse">directions_bus</span>
            Live ETA
            {wsConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Συνδεδεμένο live" />
            )}
          </div>
          {loading && !displayText ? (
            <p className="text-gray-400 text-sm">Φόρτωση ώρας άφιξης…</p>
          ) : error ? (
            <p className="text-rose-600 text-sm">{error}</p>
          ) : (
            <>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 tabular-nums">{displayText}</p>
              <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                Επόμενη στάση: {eta?.next_stop_name || '—'}
              </p>
            </>
          )}
        </div>

        {eta?.traffic_label && (
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${trafficClass}`}
          >
            <span className="material-symbols-outlined text-[16px]">traffic</span>
            {eta.traffic_label}
          </span>
        )}
      </div>

      {secondsRemaining != null && secondsRemaining > 0 && (
        <div className="mt-5">
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${Math.min(100, Math.max(8, 100 - (secondsRemaining / Math.max(eta?.eta_seconds || 1, 1)) * 100))}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            {wsConnected ? 'Live push · ' : 'Polling · '}
            κίνηση σε πραγματικό χρόνο
          </p>
        </div>
      )}
    </section>
  );
}
