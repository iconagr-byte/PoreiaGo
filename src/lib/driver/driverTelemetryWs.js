import { buildWsUrl } from '../wsUrl.js';
import { getDriverSession } from './driverSession.js';

/**
 * Driver telemetry WebSocket — /ws/telemetry/ingress?token=
 */
export function createDriverTelemetrySocket({ onMessage, onOpen, onClose, onError } = {}) {
  const session = getDriverSession();
  const token = session?.accessToken;
  if (!token) {
    throw new Error('Driver session required');
  }

  const url = `${buildWsUrl('/ws/telemetry/ingress')}?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  const pending = [];

  ws.onopen = () => {
    while (pending.length) {
      const payload = pending.shift();
      try {
        ws.send(JSON.stringify(payload));
      } catch {
        /* drop */
      }
    }
    onOpen?.();
  };
  ws.onclose = (ev) => onClose?.(ev);
  ws.onerror = (ev) => onError?.(ev);
  ws.onmessage = (ev) => {
    try {
      onMessage?.(JSON.parse(ev.data));
    } catch {
      onMessage?.({ raw: ev.data });
    }
  };

  return {
    socket: ws,
    send(payload) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        return true;
      }
      if (ws.readyState === WebSocket.CONNECTING) {
        pending.push(payload);
        if (pending.length > 20) pending.shift();
        return false;
      }
      return false;
    },
    close() {
      pending.length = 0;
      ws.close();
    },
    ping() {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    },
    get readyState() {
      return ws.readyState;
    },
  };
}
