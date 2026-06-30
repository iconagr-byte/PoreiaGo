import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTripEta } from '../services/passengerEtaApi.js';
import { buildWsUrl } from '../lib/wsUrl.js';

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

/**
 * Live ETA — WebSocket push (primary) + HTTP poll fallback.
 */
export function useLiveEta(tripId, { syncIntervalSec = 60, enabled = true, tenantId = DEMO_TENANT } = {}) {
  const [eta, setEta] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const targetMsRef = useRef(null);
  const wsRef = useRef(null);
  const pingRef = useRef(null);

  const applySnapshot = useCallback((snap) => {
    if (!snap || snap.type === 'pong') return;
    if (snap.type && snap.type !== 'eta_update' && !snap.eta_seconds) return;
    setEta(snap);
    const now = Date.now();
    const nextTarget = now + snap.eta_seconds * 1000;
    const prev = targetMsRef.current;
    if (!prev || Math.abs(nextTarget - prev) > 120_000) {
      targetMsRef.current = nextTarget;
    } else {
      targetMsRef.current = prev + (nextTarget - prev) * 0.35;
    }
    setSecondsRemaining(Math.max(0, Math.round((targetMsRef.current - now) / 1000)));
    setLoading(false);
    setError(null);
  }, []);

  const sync = useCallback(async () => {
    if (!tripId || !enabled) return;
    try {
      const snap = await fetchTripEta(tripId, tenantId);
      applySnapshot(snap);
    } catch (e) {
      if (!wsConnected) setError(e.message || 'ETA unavailable');
    } finally {
      setLoading(false);
    }
  }, [tripId, enabled, applySnapshot, tenantId, wsConnected]);

  useEffect(() => {
    if (!tripId || !enabled) return undefined;

    sync();

    const qs = tenantId ? `?tenant_id=${tenantId}` : '';
    const url = buildWsUrl(`/ws/passenger/eta/${tripId}${qs}`);
    let closed = false;
    let reconnectTimer;

    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          setError(null);
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send('ping');
          }, 25000);
        };

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            applySnapshot(data);
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (pingRef.current) clearInterval(pingRef.current);
          if (!closed) reconnectTimer = setTimeout(connect, 4000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();
    const poll = setInterval(sync, syncIntervalSec * 1000);

    return () => {
      closed = true;
      clearInterval(poll);
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [tripId, enabled, tenantId, syncIntervalSec, sync, applySnapshot]);

  useEffect(() => {
    if (!enabled || targetMsRef.current == null) return undefined;
    const tick = setInterval(() => {
      const sec = Math.max(0, Math.round((targetMsRef.current - Date.now()) / 1000));
      setSecondsRemaining(sec);
    }, 1000);
    return () => clearInterval(tick);
  }, [enabled, eta]);

  const displayMinutes = secondsRemaining != null ? Math.max(1, Math.ceil(secondsRemaining / 60)) : null;

  return {
    eta,
    secondsRemaining,
    displayMinutes,
    displayText:
      secondsRemaining != null && secondsRemaining < 60
        ? `Άφιξη σε ${secondsRemaining} δευτ.`
        : displayMinutes != null
          ? `Άφιξη σε ${displayMinutes} λεπτά`
          : null,
    loading,
    error,
    wsConnected,
    refresh: sync,
  };
}
