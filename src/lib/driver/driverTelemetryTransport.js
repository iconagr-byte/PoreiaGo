import { createDriverTelemetrySocket } from './driverTelemetryWs.js';
import { postDriverTelemetryLocation } from '../../services/driverPortalApi.js';

/**
 * Driver GPS transport — prefer WebSocket, always keep an HTTP heartbeat so the
 * admin live map still gets pins when WS is open-but-dead (common behind proxies).
 */
export function createDriverTelemetryTransport({
  onMessage,
  onOpen,
  onClose,
  onError,
  onTransport,
} = {}) {
  let mode = 'connecting'; // connecting | ws | http
  let closed = false;
  let wsConn = null;
  let fallbackTimer = null;
  let httpInFlight = false;
  let lastHttpErrorAt = 0;
  let lastHttpSentAt = 0;
  let lastAckAt = 0;
  let lastPayload = null;
  let staleCheckTimer = null;

  const postHttp = (payload, { force = false } = {}) => {
    if (closed || !payload) return false;
    const now = Date.now();
    // Dual-write at most every 8s while WS is primary (keeps Redis warm).
    if (!force && mode === 'ws' && now - lastHttpSentAt < 8000) return false;
    if (httpInFlight) return false;
    httpInFlight = true;
    lastHttpSentAt = now;
    postDriverTelemetryLocation(payload)
      .then((msg) => {
        lastAckAt = Date.now();
        if (mode === 'connecting') {
          mode = 'http';
          onTransport?.('http', 'http_ok');
          onOpen?.({ transport: 'http' });
        }
        onMessage?.(msg);
      })
      .catch(() => {
        const t = Date.now();
        if (t - lastHttpErrorAt > 8000) {
          lastHttpErrorAt = t;
          onError?.(new Error('http_telemetry_failed'));
        }
      })
      .finally(() => {
        httpInFlight = false;
      });
    return true;
  };

  const useHttp = (reason) => {
    if (closed || mode === 'http') return;
    mode = 'http';
    try {
      wsConn?.close();
    } catch {
      /* ignore */
    }
    wsConn = null;
    onTransport?.('http', reason);
    onOpen?.({ transport: 'http' });
    if (lastPayload) postHttp(lastPayload, { force: true });
  };

  try {
    wsConn = createDriverTelemetrySocket({
      onOpen: () => {
        if (closed) return;
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        mode = 'ws';
        lastAckAt = Date.now();
        onTransport?.('ws');
        onOpen?.({ transport: 'ws' });
      },
      onClose: (ev) => {
        if (closed) return;
        if (mode === 'ws') {
          onClose?.(ev);
          useHttp('ws_closed');
        }
      },
      onError: (ev) => {
        if (closed) return;
        onError?.(ev);
        useHttp('ws_error');
      },
      onMessage: (msg) => {
        if (msg?.type === 'ack' || msg?.ok) lastAckAt = Date.now();
        onMessage?.(msg);
      },
    });
  } catch (err) {
    useHttp(err?.message || 'ws_unavailable');
  }

  // If Upgrade never completes (proxy 404), switch to HTTP quickly.
  fallbackTimer = window.setTimeout(() => {
    if (!closed && mode === 'connecting') {
      useHttp('ws_timeout');
    }
  }, 2500);

  // Open-but-dead WS → fall back to HTTP so the office map still updates.
  staleCheckTimer = window.setInterval(() => {
    if (closed || mode !== 'ws' || !lastPayload) return;
    if (Date.now() - lastAckAt > 15000) {
      useHttp('ws_stale_ack');
    }
  }, 5000);

  return {
    get mode() {
      return mode;
    },
    send(payload) {
      if (closed) return false;
      lastPayload = payload;
      if (mode === 'ws' && wsConn) {
        const ok = wsConn.send(payload);
        // Dual-write HTTP heartbeat so Redis/live fleet stays warm across workers.
        postHttp(payload);
        return ok;
      }
      if (mode === 'http' || mode === 'connecting') {
        return postHttp(payload, { force: true });
      }
      return false;
    },
    close() {
      closed = true;
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (staleCheckTimer) {
        window.clearInterval(staleCheckTimer);
        staleCheckTimer = null;
      }
      try {
        wsConn?.close();
      } catch {
        /* ignore */
      }
      wsConn = null;
    },
    ping() {
      if (mode === 'ws') wsConn?.ping();
    },
  };
}
