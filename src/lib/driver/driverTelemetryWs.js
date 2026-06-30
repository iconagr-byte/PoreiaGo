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

  ws.onopen = () => onOpen?.();
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
      }
    },
    close() {
      ws.close();
    },
    ping() {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    },
  };
}
