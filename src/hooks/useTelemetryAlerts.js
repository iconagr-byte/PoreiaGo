import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchTelemetryAlerts } from '../services/telemetryApi.js';
import { buildWsUrl } from '../lib/wsUrl.js';

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

export function useTelemetryAlerts({ tenantId = DEMO_TENANT, limit = 50, enabled = true } = {}) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const mergeAlert = useCallback((row) => {
    setAlerts((prev) => {
      if (prev.some((a) => a.id === row.id)) return prev;
      return [row, ...prev].slice(0, limit);
    });
    const type = String(row.alert_type || '').toUpperCase();
    if (type === 'SOS') {
      toast.error(row.message || 'SOS από οδηγό!', {
        duration: 12000,
        icon: '🚨',
      });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('SOS — PoreiaGo', {
          body: row.message || 'Εκτάκτως σήμα από οδηγό',
          tag: `sos-${row.id}`,
          requireInteraction: true,
        });
      }
    } else if (type === 'DRIVER_ONLINE') {
      toast.success(row.message || 'Οδηγός ξεκίνησε βάρδια', {
        duration: 5000,
        id: `driver-online-${row.id}`,
      });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('Έναρξη βάρδιας — PoreiaGo', {
            body: row.message || 'Οδηγός ξεκίνησε βάρδια',
            tag: `driver-online-${row.id}`,
            requireInteraction: true,
          });
        } catch {
          /* ignore */
        }
      }
    } else if (type === 'DRIVER_OFFLINE') {
      toast(row.message || 'Οδηγός έκλεισε βάρδια', {
        duration: 5000,
        icon: '🛑',
        id: `driver-offline-${row.id}`,
      });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('Τέλος βάρδιας — PoreiaGo', {
            body: row.message || 'Οδηγός έκλεισε βάρδια',
            tag: `driver-offline-${row.id}`,
          });
        } catch {
          /* ignore */
        }
      }
    }
  }, [limit]);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const rows = await fetchTelemetryAlerts({ limit });
      setAlerts(rows);
    } finally {
      setLoading(false);
    }
  }, [enabled, limit]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();

    const qs = `?tenant_id=${tenantId}`;
    const url = buildWsUrl(`/ws/admin/telemetry/alerts${qs}`);
    let closed = false;
    let reconnectTimer;

    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setWsConnected(true);

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === 'alerts_snapshot' && Array.isArray(data.alerts)) {
              setAlerts(data.alerts.slice(0, limit));
              setLoading(false);
            } else if (data.type === 'telemetry_alert') {
              mergeAlert(data);
            }
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (!closed) reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => setWsConnected(false);
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();
    const poll = setInterval(load, 30000);

    return () => {
      closed = true;
      clearInterval(poll);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [enabled, tenantId, limit, load, mergeAlert]);

  return { alerts, loading, wsConnected, refresh: load };
}
