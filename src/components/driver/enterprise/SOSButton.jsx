/**
 * Module 4 — SOS button with long-press, GPS capture, optional incident photo.
 *
 * SOS must never start a shift. It notifies the office only.
 * Prefer last known shift coords; avoid competing high-accuracy GPS requests.
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
  const [sending, setSending] = useState(false);
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  const sendSos = useCallback(async () => {
    if (firedRef.current || sending) return;
    firedRef.current = true;
    setSending(true);
    try {
      const coords = await resolveCoordsForSos();
      const res = await triggerSosAlert({
        lat: coords.lat,
        lng: coords.lng,
        accuracy_m: coords.accuracy_m,
        photoFile,
      });
      setSosSent(true);
      toast.success(res.message || 'SOS εστάλη στο γραφείο', {
        id: 'driver-sos-sent',
        duration: 4000,
      });
      // Refresh pin only if a shift is already live — never starts GPS/shift.
      requestDriverGpsKeepalive();
    } catch (err) {
      firedRef.current = false;
      toast.error(err.message || 'Αποτυχία αποστολής SOS', { id: 'driver-sos-err' });
    } finally {
      setSending(false);
      setHolding(false);
    }
  }, [photoFile, sending]);

  const onPressStart = (e) => {
    if (sending || sosSent) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    e.preventDefault?.();
    firedRef.current = false;
    setHolding(true);
    timerRef.current = window.setTimeout(() => {
      setHolding(false);
      void sendSos();
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
    if (!firedRef.current && !sending) {
      toast('Κρατήστε πατημένο για SOS', { icon: '⚠️', id: 'driver-sos-hold' });
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
    }
  };

  return (
    <div className="driver-stack relative">
      <p className="text-xs text-[var(--driver-muted)] text-center -mt-1 mb-1 leading-relaxed">
        Ειδοποιεί το γραφείο αμέσως. Δεν ξεκινά και δεν σταματά τη βάρδια / GPS.
      </p>
      <button
        type="button"
        onPointerDown={onPressStart}
        onPointerUp={onPressEnd}
        onPointerCancel={onPressEnd}
        onContextMenu={(e) => e.preventDefault()}
        disabled={sending}
        className={`driver-touch driver-btn-danger driver-sos w-full rounded-2xl min-h-[80px] text-2xl font-black select-none touch-manipulation ${
          holding ? 'scale-95 ring-4 ring-red-300' : ''
        }`}
        aria-label="SOS — κρατήστε πατημένο"
      >
        <span className="material-symbols-outlined align-middle mr-2 text-4xl">emergency</span>
        {sending ? 'ΑΠΟΣΤΟΛΗ…' : holding ? 'ΑΠΟΣΤΟΛΗ…' : 'SOS — ΚΡΑΤΗΣΤΕ'}
      </button>

      {sosSent && (
        <p className="text-center text-red-400 text-sm font-bold">
          Σήμα εστάλη στο γραφείο. Η βάρδια δεν επηρεάζεται.
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
