/**
 * Module 5 — Tachograph-Lite fatigue tracker.
 * Counts continuous duty time only while GPS shift is online («Έναρξη βάρδιας»).
 * Pauses on break / end-shift; warns at 4h15m.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const DRIVING_LIMIT_MS = (4 * 60 + 15) * 60 * 1000; // 4h 15m
const STORAGE_KEY = 'driver_tachograph_v1';
const WARN_TITLE = 'Υποχρεωτική στάση';
const WARN_BODY = 'Required Rest Stop in 15 minutes';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { day: todayKey(), drivingMs: 0, warned: false };
    const parsed = JSON.parse(raw);
    if (parsed?.day !== todayKey()) {
      return { day: todayKey(), drivingMs: 0, warned: false };
    }
    return {
      day: parsed.day,
      drivingMs: Math.max(0, Number(parsed.drivingMs) || 0),
      warned: Boolean(parsed.warned),
    };
  } catch {
    return { day: todayKey(), drivingMs: 0, warned: false };
  }
}

function writeStored({ drivingMs, warned }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        day: todayKey(),
        drivingMs: Math.max(0, Number(drivingMs) || 0),
        warned: Boolean(warned),
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export function useTachograph({ active = false, onBreak = false } = {}) {
  const initial = readStored();
  const [drivingMs, setDrivingMs] = useState(initial.drivingMs);
  const [warned, setWarned] = useState(initial.warned);
  const intervalRef = useRef(null);

  // Counting runs only while the GPS shift is active («Έναρξη βάρδιας»).
  const isCounting = active && !onBreak;

  useEffect(() => {
    writeStored({ drivingMs, warned });
  }, [drivingMs, warned]);

  useEffect(() => {
    if (!isCounting) {
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
  }, [isCounting]);

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

  const resetBreak = useCallback(() => {
    setDrivingMs(0);
    setWarned(false);
    writeStored({ drivingMs: 0, warned: false });
  }, []);

  const hours = Math.floor(drivingMs / 3600000);
  const minutes = Math.floor((drivingMs % 3600000) / 60000);
  const seconds = Math.floor((drivingMs % 60000) / 1000);
  const limitReached = drivingMs >= DRIVING_LIMIT_MS;
  const progressPct = Math.min(100, Math.round((drivingMs / DRIVING_LIMIT_MS) * 100));

  return {
    drivingMs,
    drivingLabel: `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    limitReached,
    progressPct,
    warned,
    resetBreak,
    isCounting,
    restDueInMs: Math.max(0, DRIVING_LIMIT_MS - drivingMs),
  };
}

export default useTachograph;
