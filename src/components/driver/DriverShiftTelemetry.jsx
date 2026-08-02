import { useEffect, useState } from 'react';
import { getDriverSession } from '../../lib/driver/driverSession.js';
import IosPwaGpsGuidance from './IosPwaGpsGuidance.jsx';

/**
 * GPS tab UI for an already-running shift session (session lives in parent).
 */
export default function DriverShiftTelemetry({ shift }) {
  const session = getDriverSession();
  const {
    online,
    starting,
    lastPing,
    gpsError,
    manifestSummary,
    backgroundWarning,
    goOnline,
    goOffline,
    wakeLockSupported,
  } = shift;
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (!online) setConfirmEnd(false);
  }, [online]);

  useEffect(() => {
    if (!confirmEnd) return undefined;
    const id = window.setTimeout(() => setConfirmEnd(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirmEnd]);

  const busy = Boolean(starting) && !lastPing;
  const live = Boolean(online && lastPing);

  const onPrimary = () => {
    if (busy) return;
    if (!online) {
      void goOnline({ resume: false });
      return;
    }
    // Avoid accidental end when Θέση tab auto-started the shift.
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setConfirmEnd(false);
    void goOffline();
  };

  let primaryLabel = 'ΕΝΑΡΞΗ ΒΑΡΔΙΑΣ';
  let primaryClass = 'driver-btn-primary';
  if (busy) {
    primaryLabel = 'ΣΥΝΔΕΣΗ GPS…';
    primaryClass = 'driver-shift-btn--busy';
  } else if (online && confirmEnd) {
    primaryLabel = 'ΕΠΙΒΕΒΑΙΩΣΗ ΤΕΛΟΥΣ';
    primaryClass = 'bg-rose-600 text-white shadow-lg shadow-rose-900/40';
  } else if (online) {
    primaryLabel = 'ΤΕΛΟΣ ΒΑΡΔΙΑΣ';
    primaryClass = 'bg-rose-600 text-white shadow-lg shadow-rose-900/40';
  }

  return (
    <section className="driver-telemetry-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--driver-yellow)]">share_location</span>
            Ζωντανό GPS
          </h2>
          <p className="text-xs text-[var(--driver-muted)] mt-1 truncate">
            {session?.tripTitle ||
              (session?.tripId ? `Βάρδια #${session.tripId}` : 'Βάρδια')}
            {session?.destination ? ` · ${session.destination}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
            live
              ? 'bg-emerald-100 text-emerald-700'
              : online
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-[var(--driver-muted)]'
          }`}
        >
          {live ? 'Online' : online ? 'Σύνδεση…' : 'Offline'}
        </span>
      </div>

      <button
        type="button"
        onClick={onPrimary}
        disabled={busy}
        className={`driver-shift-btn transition-transform active:scale-[0.98] disabled:opacity-80 disabled:active:scale-100 ${primaryClass}`}
      >
        {primaryLabel}
      </button>

      {!online ? (
        <p className="text-xs text-[var(--driver-muted)] leading-relaxed">
          Ένα πάτημα ενεργοποιεί GPS και ενημερώνει τον live χάρτη του γραφείου. Επιτρέψτε την
          τοποθεσία αν σας το ζητήσει το τηλέφωνο.
        </p>
      ) : busy || !lastPing ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed font-semibold">
          Βάρδια ξεκίνησε — αναμονή πρώτης θέσης GPS…
        </p>
      ) : confirmEnd ? (
        <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 leading-relaxed font-semibold">
          Πατήστε ξανά «Επιβεβαίωση τέλους» για να σταματήσει το GPS.
        </p>
      ) : (
        <p className="text-xs text-emerald-700 leading-relaxed font-semibold">
          Το στίγμα σας είναι ζωντανό στον χάρτη του γραφείου.
        </p>
      )}

      {/* Keep install tips below the primary action so start stays immediate. */}
      {!online ? <IosPwaGpsGuidance /> : null}

      {gpsError ? <p className="text-sm text-rose-400">{gpsError}</p> : null}
      {backgroundWarning ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          {backgroundWarning}
        </p>
      ) : null}

      <dl className="driver-stat-grid text-sm">
        <div className="driver-stat-tile">
          <dt className="driver-card-label">Τελευταία αποστολή</dt>
          <dd className="text-[var(--driver-text)] font-mono text-sm mt-1 tabular-nums">
            {lastPing ? lastPing.toLocaleTimeString('el-GR') : '—'}
          </dd>
        </div>
        <div className="driver-stat-tile">
          <dt className="driver-card-label">Οθόνη ενεργή</dt>
          <dd className="text-[var(--driver-text)] text-sm mt-1 font-bold">
            {wakeLockSupported ? 'Ναι' : 'Όχι'}
          </dd>
        </div>
        <div className="driver-stat-tile">
          <dt className="driver-card-label">Επιβιβασμένοι</dt>
          <dd className="text-[var(--driver-text)] text-sm mt-1 font-bold tabular-nums">
            {manifestSummary?.progress_label ||
              `${manifestSummary?.boarded_passengers?.length ?? 0}/${manifestSummary?.capacity ?? '—'}`}
          </dd>
        </div>
      </dl>
    </section>
  );
}
