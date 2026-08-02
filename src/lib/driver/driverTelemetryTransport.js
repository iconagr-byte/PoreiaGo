import { createDriverTelemetrySocket } from './driverTelemetryWs.js';
import { postDriverTelemetryLocation } from '../../services/driverPortalApi.js';

/**
 * Driver GPS transport — HTTP is authoritative for the office live map.
 *
 * The admin map polls GET /fleet/live every ~1s while pins are active.
 * WebSockets behind Traefik/nginx often "open" as zombies and never deliver
 * frames. Prefer HTTP on every GPS tick; keep WS as a best-effort bonus.
 */
export function createDriverTelemetryTransport({
  onMessage,
  onOpen,
  onClose,
  onError,
  onTransport,
} = {}) {
  let mode = 'http'; // http | ws (ws = HTTP + optional WS bonus)
  let closed = false;
  let wsConn = null;
  let httpInFlight = false;
  let pendingPayload = null;
  let lastPayload = null;
  let lastHttpErrorAt = 0;
  let lastAckAt = 0;
  let opened = false;

  const markAck = (msg) => {
    if (msg?.type === 'ack' || msg?.ok === true) {
      lastAckAt = Date.now();
    }
  };

  const notifyOpen = (transport, reason) => {
    if (opened && transport === 'http') return;
    opened = true;
    onTransport?.(transport, reason);
    onOpen?.({ transport });
  };

  const postHttp = (payload) => {
    if (closed || !payload) return false;
    if (httpInFlight) {
      pendingPayload = payload;
      return true;
    }
    httpInFlight = true;
    postDriverTelemetryLocation(payload)
      .then((msg) => {
        markAck(msg);
        notifyOpen('http', 'http_ok');
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
          postHttp(next);
        }
      });
    return true;
  };

  // Best-effort WS — never required for the office pin.
  try {
    wsConn = createDriverTelemetrySocket({
      onOpen: () => {
        if (closed) return;
        mode = 'ws';
        notifyOpen('ws', 'ws_open');
        if (lastPayload) {
          try {
            wsConn?.send(lastPayload);
          } catch {
            /* ignore */
          }
        }
      },
      onClose: (ev) => {
        if (closed) return;
        if (mode === 'ws') {
          mode = 'http';
          onClose?.(ev);
        }
      },
      onError: (ev) => {
        if (closed) return;
        onError?.(ev);
        mode = 'http';
      },
      onMessage: (msg) => {
        markAck(msg);
        onMessage?.(msg);
      },
    });
  } catch {
    wsConn = null;
    mode = 'http';
  }

  return {
    get mode() {
      return mode;
    },
    get lastAckAt() {
      return lastAckAt;
    },
    send(payload) {
      if (closed) return false;
      lastPayload = payload;
      // Authoritative path for /fleet/live
      postHttp(payload);
      // Optional low-latency fan-out
      if (mode === 'ws' && wsConn) {
        try {
          wsConn.send(payload);
        } catch {
          /* ignore */
        }
      }
      return true;
    },
    close() {
      closed = true;
      pendingPayload = null;
      lastPayload = null;
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
