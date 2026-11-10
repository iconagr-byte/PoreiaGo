/**
 * Module 1 — E-Manifest QR Scanner (passenger check-in).
 * Uses native camera via BusQrScanner / html5-qrcode.
 */
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import DriverTicketScanner from '../DriverTicketScanner.jsx';
import { driverCheckin, fetchDriverManifest } from '../../../services/driverPortalApi.js';
import { getActiveTripId } from '../../../lib/driver/driverSession.js';
import { SCAN_RESULT } from '../../../lib/ticketing/constants.js';

function bookingLabel(result) {
  return result?.booking_ref || result?.booking_id || '—';
}

export default function Scanner() {
  const [lastResult, setLastResult] = useState(null);
  const [boardedPassengers, setBoardedPassengers] = useState([]);
  const [boardedCount, setBoardedCount] = useState(0);
  const [scanning, setScanning] = useState(true);
  const tripId = getActiveTripId();

  const applyManifest = (man) => {
    const list = man?.boarded_passengers || [];
    setBoardedPassengers(list);
    setBoardedCount(man?.boarded_count ?? list.length);
  };

  const handleScan = useCallback(
    async (raw) => {
      setScanning(false);
      if (!tripId) {
        const response = {
          result: SCAN_RESULT.FAILURE,
          message: 'Δεν υπάρχει ανοιχτή εκδρομή — περιμένετε ανάθεση από το γραφείο.',
          ok: false,
        };
        setLastResult(response);
        toast.error(response.message);
        setTimeout(() => setScanning(true), 1800);
        return response;
      }
      const response = await driverCheckin({ qrRaw: raw, tripId });
      setLastResult(response);
      if (response.result === SCAN_RESULT.SUCCESS) {
        const names = (response.boarded_passengers || []).map((p) => p.passenger_name).filter(Boolean);
        const count = response.boarded_count ?? names.length;
        toast.success(
          `${response.passenger_name || response.passengerName} · Κράτηση ${bookingLabel(response)} · ${count} επιβ.`,
          { duration: 4500 },
        );
        if (response.boarded_passengers) {
          applyManifest({
            boarded_passengers: response.boarded_passengers,
            boarded_count: response.boarded_count,
          });
        }
      } else {
        toast.error(response.message || 'Άκυρο εισιτήριο');
      }
      try {
        const man = await fetchDriverManifest();
        applyManifest(man);
      } catch {
        /* keep check-in payload */
      }
      window.dispatchEvent(new CustomEvent('driver-manifest-updated'));
      setTimeout(() => setScanning(true), 1800);
      return response;
    },
    [tripId],
  );

  const success = lastResult?.result === SCAN_RESULT.SUCCESS;

  return (
    <div className="driver-stack">
      <div className="text-center pb-1">
        <p className="driver-card-label">E-Manifest</p>
        <h2 className="text-xl font-extrabold tracking-tight">Σάρωση εισιτηρίων</h2>
        <p className="text-[var(--driver-muted)] text-sm mt-1">
          {tripId ? `Βάρδια #${tripId}` : 'Χωρίς ανοιχτή εκδρομή'}
        </p>
      </div>

      {!tripId ? (
        <div className="driver-card text-center">
          <p className="text-sm font-semibold text-[var(--driver-muted)] leading-relaxed">
            Δεν μπορείτε να σαρώσετε εισιτήρια πριν το γραφείο ανοίξει / αναθέσει εκδρομή
            (Master QR ή ανάθεση δρομολογίου).
          </p>
        </div>
      ) : (
      <div className="driver-card p-2">
        <DriverTicketScanner onScan={handleScan} paused={!scanning} />
      </div>
      )}

      {lastResult && (
        <div
          className={`driver-card text-center ${
            success ? 'border-[#22c55e] bg-green-950/40' : 'border-red-500 bg-red-950/40'
          }`}
        >
          <span className="material-symbols-outlined text-5xl block mb-2">
            {success ? 'check_circle' : 'cancel'}
          </span>
          <p className="text-xl font-bold">
            {lastResult.passenger_name || lastResult.passengerName || lastResult.result}
          </p>
          {success ? (
            <>
              <p className="text-sm font-bold text-[var(--driver-muted)] mt-2">
                Κράτηση {bookingLabel(lastResult)}
                {(lastResult.seat_number || lastResult.seat)
                  ? ` · Θέση ${lastResult.seat_number || lastResult.seat}`
                  : ''}
              </p>
              <p className="text-lg font-extrabold mt-3 text-[var(--driver-yellow)] tabular-nums">
                {boardedCount} επιβιβασμένοι
              </p>
            </>
          ) : (
            <p className="text-sm mt-2 text-[var(--driver-muted)]">{lastResult.message}</p>
          )}
        </div>
      )}

      {boardedPassengers.length > 0 ? (
        <div className="driver-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-bold text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--driver-yellow)] text-[22px]">
                groups
              </span>
              Επιβιβασμένοι
            </h3>
            <span className="text-sm font-extrabold tabular-nums text-[var(--driver-yellow)]">
              {boardedCount}
            </span>
          </div>
          <ul className="divide-y divide-[var(--driver-border)]">
            {boardedPassengers.map((p) => (
              <li
                key={`${p.booking_id}-${p.passenger_name}`}
                className="py-2.5 flex items-start justify-between gap-2 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 text-left">
                  <p className="font-bold text-sm truncate">{p.passenger_name || 'Επιβάτης'}</p>
                  <p className="text-xs text-[var(--driver-muted)] mt-0.5">
                    Κράτηση {p.booking_ref || p.booking_id || '—'}
                    {p.seat_number ? ` · Θέση ${p.seat_number}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
