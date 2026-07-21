import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  isGeolocationSupported,
  startDriverGeolocationWatch,
} from '../../lib/driver/driverGeolocation.js';
import { buildDriverTelemetryPayload } from '../../lib/driver/driverTelemetryEnvelope.js';
import {
  requestMotionPermission,
  startDeviceSensorWatch,
} from '../../lib/driver/driverDeviceSensors.js';
import { createDriverTelemetryTransport } from '../../lib/driver/driverTelemetryTransport.js';
import { getDriverSession } from '../../lib/driver/driverSession.js';
import { fetchDriverManifest } from '../../services/driverPortalApi.js';
import { isWakeLockSupported, releaseWakeLock, requestWakeLock } from '../../lib/driver/wakeLock.js';
import {
  formatRateLimitedMessage,
  geolocationErrorToGreek,
  getIosGpsEnvironment,
} from '../../lib/driver/iosPwaGps.js';
import IosPwaGpsGuidance from './IosPwaGpsGuidance.jsx';
import { useIosBackgroundGpsWarning } from '../../lib/driver/useIosBackgroundGpsWarning.js';

/**
 * Mobile-first shift telemetry — Go Online toggle, GPS → WebSocket (HTTP fallback).
 */
export default function DriverShiftTelemetry({ driverName = 'Οδηγός' }) {
  const [online, setOnline] = useState(false);
  const [lastPing, setLastPing] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [manifestSummary, setManifestSummary] = useState(null);
  const iosEnv = getIosGpsEnvironment();
  const backgroundWarning = useIosBackgroundGpsWarning(online);
  const stopGeoRef = useRef(null);
  const transportRef = useRef(null);
  const wakeRef = useRef(null);
  const stopSensorsRef = useRef(null);
  const manifestRef = useRef(null);
  const sensorsRef = useRef(null);
  const linkedOnlineRef = useRef(false);
  const session = getDriverSession();

  useEffect(() => {
    return () => {
      stopGeoRef.current?.();
      stopSensorsRef.current?.();
      transportRef.current?.close();
      releaseWakeLock(wakeRef.current);
    };
  }, []);

  useEffect(() => {
    if (!online) return undefined;
    const refreshManifest = () => {
      fetchDriverManifest()
        .then((manifest) => {
          manifestRef.current = manifest;
          setManifestSummary(manifest);
        })
        .catch(() => {});
    };
    refreshManifest();
    const manifestPollId = window.setInterval(refreshManifest, 10_000);
    const onManifestUpdated = () => refreshManifest();
    window.addEventListener('driver-manifest-updated', onManifestUpdated);
    return () => {
      window.clearInterval(manifestPollId);
      window.removeEventListener('driver-manifest-updated', onManifestUpdated);
    };
  }, [online]);

  const goOffline = () => {
    stopGeoRef.current?.();
    stopGeoRef.current = null;
    stopSensorsRef.current?.();
    stopSensorsRef.current = null;
    transportRef.current?.close();
    transportRef.current = null;
    releaseWakeLock(wakeRef.current);
    wakeRef.current = null;
    linkedOnlineRef.current = false;
    setOnline(false);
    setGpsError('');
    localStorage.setItem('driver_shift_online', '0');
    window.dispatchEvent(new CustomEvent('driver-shift-online', { detail: { online: false } }));
  };

  const markOnline = () => {
    if (linkedOnlineRef.current) return;
    linkedOnlineRef.current = true;
    setOnline(true);
    localStorage.setItem('driver_shift_online', '1');
    window.dispatchEvent(new CustomEvent('driver-shift-online', { detail: { online: true } }));
    toast('Η θέση σας θα εμφανιστεί στον live χάρτη του γραφείου', {
      icon: '🗺️',
      duration: 4000,
    });
  };

  const goOnline = async () => {
    if (!isGeolocationSupported()) {
      toast.error('Το GPS δεν υποστηρίζεται σε αυτή τη συσκευή');
      return;
    }
    if (iosEnv.needsInstallGuidance) {
      toast(
        'Στο iPhone προσθέστε την εφαρμογή στην Αρχική (βλ. οδηγίες παρακάτω) για αξιόπιστο GPS.',
        { icon: '📱', duration: 6000 },
      );
    }
    try {
      await requestMotionPermission();
      let httpFallbackNotified = false;
      const conn = createDriverTelemetryTransport({
        onOpen: ({ transport } = {}) => {
          markOnline();
          if (transport === 'ws') {
            toast.success('Σύνδεση telemetry OK');
          } else if (transport === 'http' && !httpFallbackNotified) {
            httpFallbackNotified = true;
            toast.success('Σύνδεση θέσης OK');
          }
        },
        onError: () => {
          // WS errors are handled by HTTP fallback — only surface if HTTP also fails.
        },
        onClose: () => {
          if (linkedOnlineRef.current && transportRef.current?.mode === 'ws') {
            toast('Η σύνδεση telemetry διακόπηκε — συνέχεια μέσω HTTP');
          }
        },
        onMessage: (msg) => {
          if (msg.type === 'ack' && msg.ok !== false) setLastPing(new Date());
          if (msg.type === 'rate_limited') {
            toast(formatRateLimitedMessage(msg.retry_after_sec), { icon: '⏳' });
          }
          if (msg.type === 'error' && msg.detail === 'invalid_token') {
            toast.error('Η συνεδρία έληξε — συνδεθείτε ξανά');
            goOffline();
          }
        },
      });
      transportRef.current = conn;
      stopSensorsRef.current = startDeviceSensorWatch((snapshot) => {
        sensorsRef.current = snapshot;
      });
      wakeRef.current = await requestWakeLock();
      if (!isWakeLockSupported()) {
        toast('Wake Lock μη διαθέσιμο — κρατήστε την οθόνη ενεργή', { icon: 'ℹ️' });
      }

      stopGeoRef.current = startDriverGeolocationWatch({
        onPosition: (pos) => {
          const plate =
            session?.vehiclePlate ||
            session?.vehicleCode ||
            session?.busPlate ||
            `TRIP-${session?.tripId || '?'}`;
          const payload = buildDriverTelemetryPayload(pos, session, {
            driverName: session?.driverName || driverName,
            busPlate: plate,
            manifest: manifestRef.current,
            sensors: sensorsRef.current,
          });
          const sent = conn.send(payload);
          if (sent) setGpsError('');
        },
        onError: (err) => {
          setGpsError(geolocationErrorToGreek(err, { isIos: iosEnv.isIos }));
        },
      });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία σύνδεσης');
      goOffline();
    }
  };

  const toggle = () => {
    if (online) goOffline();
    else goOnline();
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
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      <button
        type="button"
        onClick={toggle}
        className={`driver-shift-btn transition-transform active:scale-[0.98] ${
          online
            ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40'
            : 'driver-btn-primary'
        }`}
      >
        {online ? 'ΤΕΛΟΣ ΒΑΡΔΙΑΣ' : 'ΕΝΑΡΞΗ ΒΑΡΔΙΑΣ'}
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
            {isWakeLockSupported() ? 'Ναι' : 'Όχι'}
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
