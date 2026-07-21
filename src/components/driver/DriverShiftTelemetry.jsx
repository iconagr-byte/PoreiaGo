import { useState } from 'react';
import { getDriverSession } from '../../lib/driver/driverSession.js';
import IosPwaGpsGuidance from './IosPwaGpsGuidance.jsx';

/**
 * GPS tab UI for an already-running shift session (session lives in parent).
 */
export default function DriverShiftTelemetry({ shift }) {
  const session = getDriverSession();
  const {
    online,
    lastPing,
    gpsError,
    manifestSummary,
    backgroundWarning,
    iosEnv,
    toggle,
    wakeLockSupported,
  } = shift;
  const [ending, setEnding] = useState(false);

  const onToggle = async () => {
    if (ending) return;
    if (online) {
      setEnding(true);
      try {
        await Promise.resolve(toggle());
      } finally {
        setEnding(false);
      }
      return;
    }
    toggle();
  };

  return (
    <section className="driver-telemetry-card space-y-4">
      <IosPwaGpsGuidance />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--driver-yellow)]">share_location</span>
            Ζωντανό GPS
          </h2>
          <p className="text-xs text-[var(--driver-muted)] mt-1 truncate">
            Βάρδια #{session?.tripId || '—'}
          </p>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
            online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-[var(--driver-muted)]'
          }`}
        >
          {ending ? 'Τερματισμός…' : online ? 'Online' : 'Offline'}
        </span>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={ending}
        className={`driver-shift-btn transition-transform active:scale-[0.98] ${
          online
            ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40'
            : 'driver-btn-primary'
        } ${ending ? 'opacity-70' : ''}`}
      >
        {ending ? 'ΕΝΗΜΕΡΩΣΗ ΧΑΡΤΗ…' : online ? 'ΤΕΛΟΣ ΒΑΡΔΙΑΣ' : 'ΕΝΑΡΞΗ ΒΑΡΔΙΑΣ'}
      </button>

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

      <p className="text-[11px] text-[var(--driver-muted)] leading-relaxed">
        Η βάρδια μένει ενεργή όταν αλλάζετε καρτέλες. Σταματά μόνο με «ΤΕΛΟΣ ΒΑΡΔΙΑΣ» — τότε
        ενημερώνονται η πλατφόρμα και ο ζωντανός χάρτης του γραφείου.
      </p>
      <p className="text-[11px] text-[var(--driver-muted)] leading-relaxed">
        Στέλνονται live: θέση, ταχύτητα, επιβάτες μετά check-in, μπαταρία &amp; αισθητήρες κινητού.
      </p>
      <p className="text-[11px] text-[var(--driver-muted)] leading-relaxed">
        {iosEnv.isIos
          ? 'iPhone: κρατήστε την εφαρμογή σε πρώτο πλάνο κατά τη βάρδια. Το GPS δεν λειτουργεί αξιόπιστα στο background.'
          : 'Κρατήστε την εφαρμογή ανοιχτή. Εγκαταστήστε από το μενού του browser «Προσθήκη στην αρχική» για PWA.'}
      </p>
    </section>
  );
}
