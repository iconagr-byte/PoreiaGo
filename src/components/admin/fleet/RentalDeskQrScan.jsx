/**
 * Desk QR verify for Rent Wallet passes (`RENT:{booking_id}`).
 */
import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import BusQrScanner from '../../BusQrScanner.jsx';
import { verifyRentalQr } from '../../../services/fleetRentalApi.js';

function euro(n) {
  return `€${Number(n || 0).toFixed(2)}`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function RentalDeskQrScan({
  onCheckIn,
  onCheckOut,
  onOpenBooking,
}) {
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState(null);
  const lastCode = useRef('');

  const runVerify = useCallback(
    async (raw) => {
      const code = String(raw || '').trim();
      if (!code || busy) return;
      if (code === lastCode.current && result) return;
      setBusy(true);
      setPaused(true);
      try {
        const data = await verifyRentalQr(code);
        lastCode.current = code;
        setResult(data);
        toast.success(data.reason || 'Επαλήθευση OK');
      } catch (err) {
        setResult(null);
        toast.error(err.message || 'Αποτυχία επαλήθευσης');
        setPaused(false);
      } finally {
        setBusy(false);
      }
    },
    [busy, result],
  );

  const reset = () => {
    lastCode.current = '';
    setResult(null);
    setPaused(false);
  };

  const booking = result?.booking;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-black/[0.06] p-4 space-y-3">
        <div>
          <h3 className="font-bold text-gray-900">Σάρωση Rent Wallet</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Σκανάρετε το QR της εφαρμογής πελάτη (`RENT:…`) ή επικολλήστε τον κωδικό.
          </p>
        </div>
        <BusQrScanner
          variant="light"
          compact
          quietCamera
          paused={paused || busy}
          onScan={runVerify}
        />
        {paused ? (
          <button
            type="button"
            onClick={reset}
            className="text-xs font-bold text-primary"
          >
            Νέα σάρωση
          </button>
        ) : null}
      </div>

      {booking ? (
        <div className="bg-white rounded-2xl border border-black/[0.06] p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-gray-900">
                {booking.client_name} · {booking.vehicle_plate || booking.vehicle_model || 'Όχημα'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatWhen(booking.start_time)} → {formatWhen(booking.end_time)}
                {booking.pickup_location ? ` · ${booking.pickup_location}` : ''}
              </p>
              <p className="text-xs text-gray-500">
                {euro(booking.total_cost)}
                {booking.driver_mode === 'WITH_DRIVER' ? ' · με οδηγό' : ' · self-drive'}
                {booking.client_phone ? ` · ${booking.client_phone}` : ''}
              </p>
              <p className="text-[11px] font-mono text-gray-400 mt-1 break-all">{result.code}</p>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                result.eligible_checkin
                  ? 'bg-sky-100 text-sky-800'
                  : result.eligible_checkout
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {booking.rental_status}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{result.reason}</p>
          <div className="flex flex-wrap gap-2">
            {result.eligible_checkin ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold"
                onClick={() => onCheckIn?.(booking)}
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                Check-in
              </button>
            ) : null}
            {result.eligible_checkout ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                onClick={() => onCheckOut?.(booking)}
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Check-out
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/[0.08] text-xs font-bold text-gray-700"
              onClick={() => onOpenBooking?.(booking)}
            >
              Κρατήσεις
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/[0.08] text-xs font-bold text-gray-500"
              onClick={reset}
            >
              Καθαρισμός
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
