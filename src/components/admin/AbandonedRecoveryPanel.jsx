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
        `Recovery: ${result.sent}/${result.candidates} απεστάλησαν`,
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
    <div className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.04] bg-gradient-to-r from-amber-50/80 to-white px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
            <span className="material-symbols-outlined text-[22px]">shopping_cart_checkout</span>
          </span>
          <div>
            <h3 className="font-bold text-slate-900 text-[17px]">Εγκαταλειμμένα checkouts</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-xl">
              Email/SMS μετά από {pendingMinutes ?? 60} λεπτά · αυτόματο scan κάθε ~15′
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleScan(false)}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
            {scanning ? 'Αποστολή…' : 'Recovery (κανόνας)'}
          </button>
          <button
            type="button"
            onClick={() => handleScan(true)}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
          >
            Δοκιμή άμεσα
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={loading || scanning}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            title="Ανανέωση λίστας"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-slate-500">Φόρτωση ημιτελών κρατήσεων…</p>
      ) : !carts.length ? (
        <div className="px-6 py-10 text-center">
          <span className="material-symbols-outlined text-[32px] text-slate-300">inbox</span>
          <p className="mt-2 text-sm font-medium text-slate-500">Δεν υπάρχουν ημιτελείς κρατήσεις.</p>
        </div>
      ) : (
        <ul className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto">
          {carts.map((c) => (
            <li key={c.id} className="px-5 py-3.5 text-sm sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-bold text-slate-900">{c.trip_title}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                  {c.id}
                </span>
              </div>
              <p className="mt-1 text-slate-600">
                {c.passenger_email || '—'} · θέσεις {c.seats || '—'} · €{c.amount_eur}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
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
