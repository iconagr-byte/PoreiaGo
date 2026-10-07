import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { clearTelemetryAlert, fetchTelemetryAlerts } from '../services/telemetryApi.js';
import { buildWsUrl } from '../lib/wsUrl.js';
import { getSaasToken } from '../services/saasApi.js';
import { LIVE_REFRESH_MS } from '../lib/liveRefresh.js';

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

export function useTelemetryAlerts({ tenantId = DEMO_TENANT, limit = 50, enabled = true } = {}) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const dropAlert = useCallback((alertId) => {
    const id = String(alertId || '').trim();
    if (!id) return;
    setAlerts((prev) => prev.filter((a) => String(a.id) !== id));
  }, []);

  const clearAlert = useCallback(
    async (alertId) => {
      const id = String(alertId || '').trim();
      if (!id) throw new Error('Λείπει alert id');
      const data = await clearTelemetryAlert(id);
      dropAlert(id);
      toast.success(data.message || 'Ο συναγερμός απενεργοποιήθηκε', {
        id: `sos-cleared-${id}`,
        duration: 4000,
      });
      return data;
    },
    [dropAlert],
  );

  const mergeAlert = useCallback((row) => {
    setAlerts((prev) => {
      if (prev.some((a) => a.id === row.id)) return prev;
      return [row, ...prev].slice(0, limit);
    });
    const type = String(row.alert_type || '').toUpperCase();
    // Click sound + inbox are handled by AdminNotificationBell (BackOffice header).
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
    } else if (type === 'DRIVER_ONLINE' || type === 'DRIVER_OFFLINE') {
      // Floating banner + chime: AdminNotificationBell only (one nice label).
      // Keep OS notification if the user granted permission.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const online = type === 'DRIVER_ONLINE';
          new Notification(
            online ? 'Έναρξη βάρδιας — PoreiaGo' : 'Τέλος βάρδιας — PoreiaGo',
            {
              body:
                row.message ||
                (online ? 'Οδηγός ξεκίνησε βάρδια' : 'Οδηγός έκλεισε βάρδια'),
              tag: `${online ? 'driver-online' : 'driver-offline'}-${row.id}`,
              requireInteraction: true,
            },
          );
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

    const url = buildWsUrl('/ws/admin/telemetry/alerts', {
      tenant_id: tenantId,
      token: getSaasToken() || '',
    });
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
            } else if (data.type === 'telemetry_alert_cleared') {
              dropAlert(data.id);
            } else if (data.type === 'telemetry_alert') {
              if (data.event === 'cleared' || data.cleared_at) {
                dropAlert(data.id);
              } else {
                mergeAlert(data);
              }
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
    const poll = setInterval(load, LIVE_REFRESH_MS);

    return () => {
      closed = true;
      clearInterval(poll);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [enabled, tenantId, limit, load, mergeAlert, dropAlert]);

  return { alerts, loading, wsConnected, refresh: load, clearAlert, dropAlert };
}
