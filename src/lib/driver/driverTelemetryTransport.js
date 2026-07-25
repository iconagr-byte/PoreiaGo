import { createDriverTelemetrySocket } from './driverTelemetryWs.js';
import { postDriverTelemetryLocation } from '../../services/driverPortalApi.js';

/**
 * Driver GPS transport — prefer WebSocket, always keep an HTTP heartbeat so the
 * admin live map still gets pins when WS is open-but-dead (common behind proxies).
 *
 * Admin map is HTTP-poll primary (`ενημέρωση 5s`). If we only send over a zombie
 * WebSocket, the office sees "0 ενεργά" forever while the driver looks online.
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
  let staleCheckTimer = null;
  let httpInFlight = false;
  let pendingPayload = null;
  let lastPayload = null;
  let lastHttpErrorAt = 0;
  let lastHttpSentAt = 0;
  let lastAckAt = 0;

  const markAck = (msg) => {
    if (msg?.type === 'ack' || msg?.ok === true) {
      lastAckAt = Date.now();
    }
  };

  const postHttp = (payload, { force = false } = {}) => {
    if (closed || !payload) return false;
    const now = Date.now();
    // Dual-write at most every 8s while WS is primary (keeps Redis / live fleet warm).
    if (!force && mode === 'ws' && now - lastHttpSentAt < 8000) {
      return false;
    }
    if (httpInFlight) {
      pendingPayload = payload;
      return true;
    }
    httpInFlight = true;
    lastHttpSentAt = now;
    postDriverTelemetryLocation(payload)
      .then((msg) => {
        markAck(msg);
        if (mode === 'connecting') {
          mode = 'http';
          onTransport?.('http', 'http_ok');
          onOpen?.({ transport: 'http' });
        }
        onMessage?.(msg);
      })
      .catch((err) => {
        const t = Date.now();
        if (t - lastHttpErrorAt > 5000) {
          lastHttpErrorAt = t;
          onError?.(err instanceof Error ? err : new Error('http_telemetry_failed'));
          onMessage?.({
            type: 'error',
            detail: err?.message || 'http_telemetry_failed',
          });
        }
      })
      .finally(() => {
        httpInFlight = false;
        if (pendingPayload && !closed) {
          const next = pendingPayload;
          pendingPayload = null;
          postHttp(next, { force: mode !== 'ws' });
        }
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
        // Immediately warm HTTP so the first pin does not wait for the next GPS tick.
        if (lastPayload) postHttp(lastPayload, { force: true });
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
        markAck(msg);
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
        // Dual-write HTTP heartbeat so /fleet/live (HTTP poll) always sees the pin.
        postHttp(payload);
        return ok;
      }
      if (mode === 'http' || mode === 'connecting') {
        postHttp(payload, { force: true });
        return true;
      }
      return false;
    },
    close() {
      closed = true;
      pendingPayload = null;
      lastPayload = null;
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
