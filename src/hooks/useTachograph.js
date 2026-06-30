/**
 * Module 5 — Tachograph-Lite fatigue tracker.
 * Warns at 4h15m continuous online driving without a break.
 */
import { useEffect, useRef, useState } from 'react';

const DRIVING_LIMIT_MS = (4 * 60 + 15) * 60 * 1000; // 4h 15m
const WARN_TITLE = 'Υποχρεωτική στάση';
const WARN_BODY = 'Required Rest Stop in 15 minutes';

export function useTachograph({ online = false, onBreak = false } = {}) {
  const [drivingMs, setDrivingMs] = useState(0);
  const [warned, setWarned] = useState(false);
  const intervalRef = useRef(null);
  const drivingRef = useRef(false);

  const isDriving = online && !onBreak;

  useEffect(() => {
    drivingRef.current = isDriving;
  }, [isDriving]);

  useEffect(() => {
    if (!isDriving) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return undefined;
    }

    intervalRef.current = window.setInterval(() => {
      setDrivingMs((ms) => ms + 1000);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isDriving]);

  useEffect(() => {
    if (warned || drivingMs < DRIVING_LIMIT_MS) return;

    setWarned(true);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(WARN_TITLE, { body: WARN_BODY, tag: 'tachograph-rest' });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(WARN_TITLE, { body: WARN_BODY, tag: 'tachograph-rest' });
        }
      });
    }
  }, [drivingMs, warned]);

  const resetBreak = () => {
    setDrivingMs(0);
    setWarned(false);
  };

  const hours = Math.floor(drivingMs / 3600000);
  const minutes = Math.floor((drivingMs % 3600000) / 60000);
  const seconds = Math.floor((drivingMs % 60000) / 1000);
  const limitReached = drivingMs >= DRIVING_LIMIT_MS;

  return {
    drivingMs,
    drivingLabel: `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    limitReached,
    warned,
    resetBreak,
    restDueInMs: Math.max(0, DRIVING_LIMIT_MS - drivingMs),
  };
}

export default useTachograph;
