import { createDriverTelemetrySocket } from './driverTelemetryWs.js';
import { postDriverTelemetryLocation } from '../../services/driverPortalApi.js';

/**
 * Driver GPS transport — prefer WebSocket, fall back to HTTP POST when WS is blocked.
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
      onMessage: (msg) => onMessage?.(msg),
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

  return {
    get mode() {
      return mode;
    },
    send(payload) {
      if (closed) return false;
      if (mode === 'ws' && wsConn) {
        return wsConn.send(payload);
      }
      if (mode === 'http' || mode === 'connecting') {
        if (httpInFlight) return false;
        httpInFlight = true;
        postDriverTelemetryLocation(payload)
          .then((msg) => {
            if (mode === 'connecting') {
              mode = 'http';
              onTransport?.('http', 'http_ok');
              onOpen?.({ transport: 'http' });
            }
            onMessage?.(msg);
          })
          .catch(() => {
            const now = Date.now();
            if (now - lastHttpErrorAt > 8000) {
              lastHttpErrorAt = now;
              onError?.(new Error('http_telemetry_failed'));
            }
          })
          .finally(() => {
            httpInFlight = false;
          });
        return true;
      }
      return false;
    },
    close() {
      closed = true;
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
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
