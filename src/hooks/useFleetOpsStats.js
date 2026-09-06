import { useCallback, useEffect, useState } from 'react';
import {
  fetchFleetAvailabilityBoard,
  fetchFleetCalendar,
  fetchFleetDashboard,
  fetchFleetDocuments,
  fetchFleetExpenses,
} from '../services/platformApi.js';

/**
 * Lightweight counts for fleet ops hub badges (calendar, availability, etc.).
 */
export function useFleetOpsStats({ enabled = true } = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    try {
      const [calendar, availability, documents, expenses, dashboard] = await Promise.all([
        fetchFleetCalendar(30).catch(() => []),
        fetchFleetAvailabilityBoard().catch(() => []),
        fetchFleetDocuments().catch(() => []),
        fetchFleetExpenses().catch(() => []),
        fetchFleetDashboard().catch(() => ({})),
      ]);
      const cal = Array.isArray(calendar) ? calendar : [];
      const avail = Array.isArray(availability) ? availability : [];
      const docs = Array.isArray(documents) ? documents : [];
      const exp = Array.isArray(expenses) ? expenses : [];
      setStats({
        calendarUrgent: cal.filter(
          (c) => c.severity === 'urgent' || Number(c.days_left) <= 14,
        ).length,
        calendarTotal: cal.length,
        available: avail.filter((r) => r.available).length,
        blocked: avail.filter((r) => !r.available).length,
        documents: docs.length,
        expenseTotal: exp.reduce((s, r) => s + Number(r.amount || 0), 0),
        alerts: Number(dashboard?.alerts_count || 0),
      });
    } catch (err) {
      setError(err.message || 'Αποτυχία φόρτωσης στατιστικών στόλου');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}
