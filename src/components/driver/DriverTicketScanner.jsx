import { useState, useCallback } from 'react';
import BusQrScanner from '../BusQrScanner.jsx';

function haptic(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/**
 * Boarding scanner — instant camera focus feedback + vibrate on result.
 */
export default function DriverTicketScanner({ onScan, paused = false }) {
  const [busy, setBusy] = useState(false);

  const handleScan = useCallback(
    async (raw) => {
      if (busy || paused) return;
      setBusy(true);
      try {
        const result = await onScan(raw);
        const ok = result?.result === 'SUCCESS';
        haptic(ok ? [80, 40, 80] : [200, 100, 200]);
        return result;
      } catch {
        haptic([300, 150, 300]);
      } finally {
        setTimeout(() => setBusy(false), 1500);
      }
    },
    [busy, paused, onScan],
  );

  return (
    <div className="relative">
      {busy && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 rounded-2xl">
          <span className="material-symbols-outlined text-5xl text-[#facc15] animate-spin">
            progress_activity
          </span>
        </div>
      )}
      <BusQrScanner variant="dark" paused={paused || busy} onScan={handleScan} />
    </div>
  );
}
