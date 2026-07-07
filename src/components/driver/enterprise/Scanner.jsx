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

export default function Scanner() {
  const [lastResult, setLastResult] = useState(null);
  const [scanning, setScanning] = useState(true);
  const tripId = getActiveTripId();

  const handleScan = useCallback(
    async (raw) => {
      setScanning(false);
      const response = await driverCheckin({ qrRaw: raw, tripId });
      setLastResult(response);
      if (response.result === SCAN_RESULT.SUCCESS) {
        toast.success(
          `${response.passenger_name || response.passengerName} · Θέση ${response.seat_number || response.seat}`,
          { duration: 4000 },
        );
      } else {
        toast.error(response.message || 'Άκυρο εισιτήριο');
      }
      await fetchDriverManifest();
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
        <p className="text-[var(--driver-muted)] text-sm mt-1">Βάρδια #{tripId}</p>
      </div>

      <div className="driver-card p-2">
        <DriverTicketScanner onScan={handleScan} paused={!scanning} />
      </div>

      {lastResult && (
        <div
          className={`driver-card text-center text-xl font-bold ${
            success ? 'border-[#22c55e] bg-green-950/40' : 'border-red-500 bg-red-950/40'
          }`}
        >
          <span className="material-symbols-outlined text-5xl block mb-2">
            {success ? 'check_circle' : 'cancel'}
          </span>
          {lastResult.passenger_name || lastResult.passengerName || lastResult.result}
          {(lastResult.seat_number || lastResult.seat) && (
            <p className="text-lg mt-2">Θέση {lastResult.seat_number || lastResult.seat}</p>
          )}
        </div>
      )}
    </div>
  );
}
