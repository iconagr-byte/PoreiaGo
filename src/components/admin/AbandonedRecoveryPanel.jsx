import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchAbandonedCarts,
  runAbandonedRecoveryScan,
} from '../../services/abandonedApi.js';

export default function AbandonedRecoveryPanel({ pendingMinutes }) {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCarts(await fetchAbandonedCarts(false));
    } catch {
      setCarts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleScan = async (immediate = false) => {
    setScanning(true);
    try {
      const result = await runAbandonedRecoveryScan({
        baseUrl: window.location.origin,
        pendingMinutes: immediate ? 0 : pendingMinutes ?? 60,
      });
      toast.success(
        `Recovery: ${result.sent}/${result.candidates} απεστάληκαν (log: backend/data/notifications.log)`,
      );
      if (result.errors?.length) {
        toast.error(result.errors.join('; '));
      }
      reload();
    } catch (e) {
      toast.error(e.message || 'Αποτυχία scan');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] shadow-sm overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">shopping_cart_checkout</span>
            Abandoned checkouts
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Email/SMS μετά από {pendingMinutes ?? 60} λεπτά · log: notifications.log · Celery beat
            κάθε 15′ (<code className="bg-gray-100 px-1 rounded">make celery-beat</code>)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleScan(false)}
            disabled={scanning}
            className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
          >
            {scanning ? 'Αποστολή…' : 'Recovery (κανόνας)'}
          </button>
          <button
            type="button"
            onClick={() => handleScan(true)}
            disabled={scanning}
            className="px-4 py-2 rounded-full border border-primary text-primary text-sm font-bold hover:bg-primary/5 disabled:opacity-60"
          >
            Δοκιμή άμεσα
          </button>
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-gray-500">Φόρτωση…</p>
      ) : !carts.length ? (
        <p className="p-6 text-sm text-gray-500 text-center">Δεν υπάρχουν ημιτελείς κράτησεις.</p>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-[280px] overflow-y-auto">
          {carts.map((c) => (
            <li key={c.id} className="px-5 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-gray-900">{c.trip_title}</span>
                <span className="text-gray-500 font-mono text-xs">{c.id}</span>
              </div>
              <p className="text-gray-600 mt-0.5">
                {c.passenger_email || '—'} · θέσεις {c.seats || '—'} · €{c.amount_eur}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                {c.recovery_sent_at
                  ? `Recovery στάλθηκε ${new Date(c.recovery_sent_at).toLocaleString('el-GR')}`
                  : 'Αναμονή recovery'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
