/**
 * Module 4 — SOS button with long-press, GPS capture, optional incident photo.
 *
 * Important: never open a competing high-accuracy getCurrentPosition while the
 * shift GPS watch is running — that can stall telemetry and look like a disconnect.
 */
import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  requestDriverGpsKeepalive,
  resolveCoordsForSos,
} from '../../../lib/driver/driverGeolocation.js';
import { reportDriverIssue, triggerSosAlert } from '../../../services/driverPortalApi.js';

const LONG_PRESS_MS = 1200;

const ISSUE_TYPES = [
  { id: 'breakdown', label: 'Βλάβη', icon: 'build' },
  { id: 'accident', label: 'Ατύχημα', icon: 'car_crash' },
  { id: 'delay', label: 'Καθυστέρηση', icon: 'schedule' },
];

export default function SOSButton() {
  const [sosSent, setSosSent] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [holding, setHolding] = useState(false);
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  const sendSos = useCallback(async () => {
    if (firedRef.current) return;
    firedRef.current = true;
    try {
      const coords = await resolveCoordsForSos();
      const res = await triggerSosAlert({
        lat: coords.lat,
        lng: coords.lng,
        accuracy_m: coords.accuracy_m,
        photoFile,
      });
      setSosSent(true);
      toast.success(res.message || 'SOS εστάλη');
      // Keep live GPS / map pin alive — SOS must never end the shift.
      requestDriverGpsKeepalive();
      window.setTimeout(() => requestDriverGpsKeepalive(), 1500);
    } catch (err) {
      firedRef.current = false;
      toast.error(err.message || 'Αποτυχία αποστολής SOS');
      requestDriverGpsKeepalive();
    }
  }, [photoFile]);

  const onPressStart = (e) => {
    // Prevent scroll / text-select / accidental sibling taps during long-press.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    firedRef.current = false;
    setHolding(true);
    timerRef.current = window.setTimeout(() => {
      setHolding(false);
      sendSos();
    }, LONG_PRESS_MS);
  };

  const onPressEnd = (e) => {
    setHolding(false);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!firedRef.current) {
      toast('Κρατήστε πατημένο για SOS', { icon: '⚠️' });
    }
  };

  const report = async (type) => {
    try {
      const coords = await resolveCoordsForSos();
      const res = await reportDriverIssue({
        type,
        lat: coords.lat,
        lng: coords.lng,
        accuracy_m: coords.accuracy_m,
        photoFile,
      });
      toast.success(`Αναφορά #${res.ticketId || res.alert_id}`);
      setShowIssues(false);
      requestDriverGpsKeepalive();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αναφοράς');
      requestDriverGpsKeepalive();
    }
  };

  return (
    <div className="driver-stack relative">
      <p className="text-xs text-[var(--driver-muted)] text-center -mt-1 mb-1">
        Το SOS ειδοποιεί το γραφείο χωρίς να διακόπτει τη βάρδια / GPS.
      </p>
      <button
        type="button"
        onPointerDown={onPressStart}
        onPointerUp={onPressEnd}
        onPointerCancel={onPressEnd}
        onContextMenu={(e) => e.preventDefault()}
        className={`driver-touch driver-btn-danger driver-sos w-full rounded-2xl min-h-[80px] text-2xl font-black select-none touch-manipulation ${
          holding ? 'scale-95 ring-4 ring-red-300' : ''
        }`}
        aria-label="SOS — κρατήστε πατημένο"
      >
        <span className="material-symbols-outlined align-middle mr-2 text-4xl">emergency</span>
        {holding ? 'ΑΠΟΣΤΟΛΗ…' : 'SOS — ΚΡΑΤΗΣΤΕ'}
      </button>

      {sosSent && (
        <p className="text-center text-red-400 text-sm font-bold">
          Σήμα εστάλη — περιμένετε επικοινωνία από το κεντρικό. Η βάρδια παραμένει ενεργή.
        </p>
      )}

      <label className="driver-touch driver-card flex items-center justify-center gap-3 cursor-pointer min-h-[64px]">
        <span className="material-symbols-outlined text-3xl text-[var(--driver-accent)]">add_a_photo</span>
        <span className="font-bold">{photoFile ? photoFile.name : 'Φωτογραφία συμβάντος (προαιρ.)'}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
        />
      </label>

      <button
        type="button"
        onClick={() => setShowIssues(!showIssues)}
        className="driver-touch w-full bg-[var(--driver-surface-raised)] border border-[var(--driver-border)] text-[var(--driver-text)] rounded-2xl min-h-[3.5rem] font-bold"
      >
        <span className="material-symbols-outlined align-middle mr-2">report</span>
        Αναφορά προβλήματος
      </button>

      {showIssues && (
        <div className="grid gap-3">
          {ISSUE_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => report(t.id)}
              className="driver-touch driver-card flex items-center gap-4 text-left w-full min-h-[64px]"
            >
              <span className="material-symbols-outlined text-4xl text-[var(--driver-accent)]">{t.icon}</span>
              <span className="text-xl font-bold">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
