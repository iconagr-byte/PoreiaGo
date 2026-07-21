/**
 * Driver shift GPS session — lives for the whole Command Center lifecycle
 * (survives tab changes). Only stops on explicit end-shift / logout.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  isGeolocationSupported,
  startDriverGeolocationWatch,
} from './driverGeolocation.js';
import { buildDriverTelemetryPayload } from './driverTelemetryEnvelope.js';
import {
  requestMotionPermission,
  startDeviceSensorWatch,
} from './driverDeviceSensors.js';
import { createDriverTelemetryTransport } from './driverTelemetryTransport.js';
import { getDriverSession } from './driverSession.js';
import { fetchDriverManifest } from '../../services/driverPortalApi.js';
import { isWakeLockSupported, releaseWakeLock, requestWakeLock } from './wakeLock.js';
import {
  formatRateLimitedMessage,
  geolocationErrorToGreek,
  getIosGpsEnvironment,
} from './iosPwaGps.js';
import { useIosBackgroundGpsWarning } from './useIosBackgroundGpsWarning.js';

const SHIFT_KEY = 'driver_shift_online';

function setShiftFlag(online) {
  localStorage.setItem(SHIFT_KEY, online ? '1' : '0');
  window.dispatchEvent(new CustomEvent('driver-shift-online', { detail: { online } }));
}

export function isDriverShiftOnline() {
  return localStorage.getItem(SHIFT_KEY) === '1';
}

export function useDriverShiftSession({ driverName = 'Οδηγός', enabled = true } = {}) {
  const [online, setOnline] = useState(() => isDriverShiftOnline());
  const [lastPing, setLastPing] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [manifestSummary, setManifestSummary] = useState(null);
  const [starting, setStarting] = useState(false);

  const iosEnv = getIosGpsEnvironment();
  const backgroundWarning = useIosBackgroundGpsWarning(online && enabled);

  const stopGeoRef = useRef(null);
  const transportRef = useRef(null);
  const wakeRef = useRef(null);
  const stopSensorsRef = useRef(null);
  const manifestRef = useRef(null);
  const sensorsRef = useRef(null);
  const linkedOnlineRef = useRef(false);
  const runningRef = useRef(false);
  const driverNameRef = useRef(driverName);
  const resumeAttemptedRef = useRef(false);
  driverNameRef.current = driverName;

  const stopRuntime = useCallback(() => {
    stopGeoRef.current?.();
    stopGeoRef.current = null;
    stopSensorsRef.current?.();
    stopSensorsRef.current = null;
    transportRef.current?.close();
    transportRef.current = null;
    releaseWakeLock(wakeRef.current);
    wakeRef.current = null;
    runningRef.current = false;
    linkedOnlineRef.current = false;
  }, []);

  const goOffline = useCallback(
    ({ silent = false } = {}) => {
      stopRuntime();
      setOnline(false);
      setGpsError('');
      setStarting(false);
      setShiftFlag(false);
      if (!silent) {
        toast('Η βάρδια τερματίστηκε', { icon: '🛑', duration: 2500 });
      }
    },
    [stopRuntime],
  );

  const markOnline = useCallback(() => {
    linkedOnlineRef.current = true;
    setOnline(true);
    setStarting(false);
    setShiftFlag(true);
  }, []);

  const goOnline = useCallback(async () => {
    if (!enabled) return;
    if (runningRef.current) return;
    if (!isGeolocationSupported()) {
      toast.error('Το GPS δεν υποστηρίζεται σε αυτή τη συσκευή');
      return;
    }

    const session = getDriverSession();
    if (!session?.accessToken) {
      toast.error('Η συνεδρία έληξε — συνδεθείτε ξανά');
      setShiftFlag(false);
      setOnline(false);
      return;
    }

    if (iosEnv.needsInstallGuidance) {
      toast(
        'Στο iPhone προσθέστε την εφαρμογή στην Αρχική (βλ. οδηγίες παρακάτω) για αξιόπιστο GPS.',
        { icon: '📱', duration: 6000 },
      );
    }

    setStarting(true);
    runningRef.current = true;

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
        onError: () => {},
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
            goOffline({ silent: true });
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
          const liveSession = getDriverSession();
          const plate =
            liveSession?.vehiclePlate ||
            liveSession?.vehicleCode ||
            liveSession?.busPlate ||
            `TRIP-${liveSession?.tripId || '?'}`;
          const payload = buildDriverTelemetryPayload(pos, liveSession, {
            driverName: liveSession?.driverName || driverNameRef.current,
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

      // Keep UI on «ΤΕΛΟΣ ΒΑΡΔΙΑΣ» across tab switches before first ack.
      markOnline();
      toast('Η θέση σας θα εμφανιστεί στον live χάρτη του γραφείου', {
        icon: '🗺️',
        duration: 4000,
        id: 'driver-shift-map-hint',
      });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία σύνδεσης');
      goOffline({ silent: true });
    }
  }, [enabled, goOffline, iosEnv.isIos, iosEnv.needsInstallGuidance, markOnline]);

  // Pause GPS while gated (login / pre-trip) but keep the shift flag so
  // tab changes and returning from the safety gate do not end the shift.
  // Explicit end is only goOffline() (Τέλος βάρδιας / logout).
  useEffect(() => {
    if (!enabled) {
      resumeAttemptedRef.current = false;
      stopRuntime();
      setStarting(false);
      return undefined;
    }
    if (!resumeAttemptedRef.current && isDriverShiftOnline() && !runningRef.current) {
      resumeAttemptedRef.current = true;
      void goOnline();
    }
    return undefined;
  }, [enabled, goOnline, stopRuntime]);

  // Tear down GPS runtime on full unmount; do not clear the shift flag
  // (refresh / remount resumes from localStorage).
  useEffect(() => {
    return () => {
      stopRuntime();
    };
  }, [stopRuntime]);

  useEffect(() => {
    if (!online || !enabled) return undefined;
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
  }, [online, enabled]);

  const toggle = useCallback(() => {
    if (online || starting || runningRef.current) goOffline();
    else goOnline();
  }, [online, starting, goOffline, goOnline]);

  return {
    online: online || starting,
    starting,
    lastPing,
    gpsError,
    manifestSummary,
    backgroundWarning,
    iosEnv,
    goOnline,
    goOffline,
    toggle,
    wakeLockSupported: isWakeLockSupported(),
  };
}
