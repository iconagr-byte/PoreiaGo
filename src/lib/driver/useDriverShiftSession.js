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
import { LIVE_REFRESH_MS } from '../liveRefresh.js';
import { createDriverTelemetryTransport } from './driverTelemetryTransport.js';
import { getDriverSession, saveDriverSession } from './driverSession.js';
import { endDriverShift, fetchDriverManifest, startDriverShift } from '../../services/driverPortalApi.js';
import { isWakeLockSupported, releaseWakeLock, requestWakeLock } from './wakeLock.js';
import {
  formatRateLimitedMessage,
  geolocationErrorToGreek,
  getIosGpsEnvironment,
} from './iosPwaGps.js';
import { useIosBackgroundGpsWarning } from './useIosBackgroundGpsWarning.js';

const SHIFT_KEY = 'driver_shift_online';
const AUTOSTART_GPS_KEY = 'driver_autostart_gps';

function setShiftFlag(online) {
  localStorage.setItem(SHIFT_KEY, online ? '1' : '0');
  window.dispatchEvent(new CustomEvent('driver-shift-online', { detail: { online } }));
}

export function isDriverShiftOnline() {
  return localStorage.getItem(SHIFT_KEY) === '1';
}

/** Call after Master QR / password login so GPS starts without a second tap. */
export function requestDriverGpsAutostart() {
  try {
    sessionStorage.setItem(AUTOSTART_GPS_KEY, '1');
  } catch {
    /* ignore */
  }
}

function peekDriverGpsAutostart() {
  try {
    return sessionStorage.getItem(AUTOSTART_GPS_KEY) === '1';
  } catch {
    return false;
  }
}

function clearDriverGpsAutostart() {
  try {
    sessionStorage.removeItem(AUTOSTART_GPS_KEY);
  } catch {
    /* ignore */
  }
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
  const gotGpsFixRef = useRef(false);
  const gotAckRef = useRef(false);
  const driverNameRef = useRef(driverName);
  const enabledRef = useRef(enabled);
  const startingRef = useRef(false);
  driverNameRef.current = driverName;
  enabledRef.current = enabled;

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
    gotGpsFixRef.current = false;
    gotAckRef.current = false;
    startingRef.current = false;
  }, []);

  const goOffline = useCallback(
    async ({ silent = false } = {}) => {
      clearDriverGpsAutostart();
      try {
        const ended = await endDriverShift();
        const push = ended?.notify?.push;
        if (push?.sent > 0) {
          console.info('[shift] end push sent', push.sent);
        } else if (push) {
          console.warn('[shift] end push result', push);
        }
      } catch (err) {
        console.warn('[shift] end notify failed, retrying', err);
        try {
          await endDriverShift();
        } catch (err2) {
          console.warn('[shift] end notify retry failed', err2);
        }
      }

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
    startingRef.current = false;
    setOnline(true);
    setStarting(false);
    setShiftFlag(true);
  }, []);

  const sendPosition = useCallback((pos, conn) => {
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
      tripTitle: manifestRef.current?.trip_title || liveSession?.tripTitle,
    });
    const sent = conn.send(payload);
    if (sent) {
      gotGpsFixRef.current = true;
      setGpsError('');
      // lastPing updates on server ack — provisional tick so UI shows activity
      setLastPing((prev) => prev || new Date());
    }
    return sent;
  }, []);

  /**
   * @param {{ resume?: boolean }} [opts]
   * resume=true: keep the shift flag even if GPS fails to restart (tab remount / brief gate).
   */
  const goOnline = useCallback(
    async ({ resume = false } = {}) => {
      if (!enabledRef.current) return false;
      if (runningRef.current || startingRef.current) return false;
      if (!isGeolocationSupported()) {
        if (!resume) toast.error('Το GPS δεν υποστηρίζεται σε αυτή τη συσκευή');
        return false;
      }

      const session = getDriverSession();
      if (!session?.accessToken) {
        if (!resume) {
          toast.error('Η συνεδρία έληξε — συνδεθείτε ξανά');
          setShiftFlag(false);
          setOnline(false);
        }
        return false;
      }

      if (!resume && iosEnv.needsInstallGuidance) {
        toast(
          'Στο iPhone προσθέστε την εφαρμογή στην Αρχική (βλ. οδηγίες παρακάτω) για αξιόπιστο GPS.',
          { icon: '📱', duration: 6000 },
        );
      }

      startingRef.current = true;
      setStarting(true);
      setOnline(true);
      setShiftFlag(true);
      runningRef.current = true;

      // CRITICAL: arm geolocation BEFORE any await — iOS drops permission without a
      // synchronous getCurrentPosition/watchPosition in the user-gesture stack.
      let httpFallbackNotified = false;
      const conn = createDriverTelemetryTransport({
        onOpen: ({ transport } = {}) => {
          markOnline();
          if (resume) return;
          if (transport === 'ws') {
            toast.success('Σύνδεση telemetry OK');
          } else if (transport === 'http' && !httpFallbackNotified) {
            httpFallbackNotified = true;
            toast.success('Σύνδεση θέσης OK');
          }
        },
        onError: (err) => {
          const msg = err?.message || 'Αποτυχία αποστολής θέσης';
          if (msg === 'http_telemetry_failed' || msg.includes('telemetry')) {
            setGpsError('Αποτυχία αποστολής θέσης στον server — ελέγξτε σύνδεση / ξανασυνδεθείτε');
          }
        },
        onClose: () => {
          if (linkedOnlineRef.current && transportRef.current?.mode === 'ws') {
            toast('Η σύνδεση telemetry διακόπηκε — συνέχεια μέσω HTTP');
          }
        },
        onMessage: (msg) => {
          if (msg.type === 'ack' && msg.ok !== false) {
            gotAckRef.current = true;
            setLastPing(new Date());
            setGpsError('');
            clearDriverGpsAutostart();
          }
          if (msg.type === 'rate_limited') {
            toast(formatRateLimitedMessage(msg.retry_after_sec), { icon: '⏳' });
          }
          if (msg.type === 'error') {
            if (msg.detail === 'invalid_token') {
              toast.error('Η συνεδρία έληξε — συνδεθείτε ξανά');
              goOffline({ silent: true });
            } else {
              setGpsError(String(msg.detail || msg.message || 'Σφάλμα telemetry'));
            }
          }
        },
      });
      transportRef.current = conn;

      // Start GPS watch immediately (no await above this line except none).
      stopGeoRef.current = startDriverGeolocationWatch({
        onPosition: (pos) => sendPosition(pos, conn),
        onError: (err) => {
          setGpsError(geolocationErrorToGreek(err, { isIos: iosEnv.isIos }));
        },
      });

      // Kick an immediate fix so the office map gets a pin ASAP.
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => sendPosition(pos, conn),
          (err) => {
            setGpsError(geolocationErrorToGreek(err, { isIos: iosEnv.isIos }));
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
        );
      } catch {
        /* ignore */
      }

      markOnline();
      if (!resume) {
        toast('Η θέση σας θα εμφανιστεί στον live χάρτη του γραφείου', {
          icon: '🗺️',
          duration: 4000,
          id: 'driver-shift-map-hint',
        });
      }

      // Non-critical side work AFTER GPS is armed.
      window.setTimeout(() => {
        if (!linkedOnlineRef.current || gotGpsFixRef.current) return;
        setGpsError(
          'Δεν ελήφθη ακόμα θέση GPS — ελέγξτε άδεια τοποθεσίας και ότι το GPS του κινητού είναι ανοιχτό',
        );
      }, 10000);

      window.setTimeout(() => {
        if (!linkedOnlineRef.current || gotAckRef.current) return;
        if (gotGpsFixRef.current) {
          setGpsError(
            'Η θέση ελήφθη στο κινητό αλλά δεν επιβεβαιώθηκε από τον server — δοκιμάστε ξανά «Έναρξη βάρδιας»',
          );
        }
      }, 18000);

      if (!resume) {
        startDriverShift()
          .then((started) => {
            const push = started?.notify?.push;
            if (push?.reason === 'no_admin_subscriptions' || (push && push.sent === 0 && push.attempted === 0)) {
              console.warn('[shift] office push: no admin subscriptions', push);
            } else if (push?.sent > 0) {
              console.info('[shift] office push sent', push.sent);
            }
          })
          .catch((err) => console.warn('[shift] start notify failed', err));
      }

      requestMotionPermission()
        .then(() => {
          stopSensorsRef.current = startDeviceSensorWatch((snapshot) => {
            sensorsRef.current = snapshot;
          });
        })
        .catch(() => {});

      requestWakeLock()
        .then((lock) => {
          wakeRef.current = lock;
          if (!resume && !isWakeLockSupported()) {
            toast('Wake Lock μη διαθέσιμο — κρατήστε την οθόνη ενεργή', { icon: 'ℹ️' });
          }
        })
        .catch(() => {});

      return true;
    },
    [goOffline, iosEnv.isIos, iosEnv.needsInstallGuidance, markOnline, sendPosition],
  );

  // Keep GPS running while the driver shell is active. Tab changes must not end the shift.
  useEffect(() => {
    if (!enabled) {
      stopRuntime();
      setStarting(false);
      return undefined;
    }

    const ensureRunning = () => {
      const wantAutostart = peekDriverGpsAutostart();
      if (!isDriverShiftOnline() && !wantAutostart) return;
      setOnline(true);
      if (!runningRef.current && !startingRef.current) {
        void goOnline({ resume: isDriverShiftOnline() && !wantAutostart });
      }
    };

    ensureRunning();
    const retryId = window.setInterval(ensureRunning, LIVE_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') ensureRunning();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ensureRunning);

    return () => {
      window.clearInterval(retryId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ensureRunning);
      // Do NOT stopRuntime here — Strict Mode remount would kill GPS.
      // Teardown only when enabled flips false (above) or goOffline/logout.
    };
  }, [enabled, goOnline, stopRuntime]);

  useEffect(() => {
    if (!online || !enabled) return undefined;
    const refreshManifest = () => {
      fetchDriverManifest()
        .then((manifest) => {
          manifestRef.current = manifest;
          setManifestSummary(manifest);
          if (manifest?.trip_title) {
            const session = getDriverSession();
            if (session && session.tripTitle !== manifest.trip_title) {
              saveDriverSession({ ...session, tripTitle: manifest.trip_title });
            }
          }
        })
        .catch(() => {});
    };
    refreshManifest();
    const manifestPollId = window.setInterval(refreshManifest, LIVE_REFRESH_MS);
    const onManifestUpdated = () => refreshManifest();
    window.addEventListener('driver-manifest-updated', onManifestUpdated);
    return () => {
      window.clearInterval(manifestPollId);
      window.removeEventListener('driver-manifest-updated', onManifestUpdated);
    };
  }, [online, enabled]);

  const toggle = useCallback(() => {
    if (online || starting || runningRef.current || isDriverShiftOnline()) {
      void goOffline();
    } else {
      // User tap — best chance for iOS permission prompt.
      void goOnline({ resume: false });
    }
  }, [online, starting, goOffline, goOnline]);

  return {
    online: online || starting || isDriverShiftOnline(),
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
