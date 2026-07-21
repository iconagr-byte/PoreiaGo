import { useCallback, useEffect, useState } from 'react';
import { QRCode } from 'react-qr-code';
import toast from 'react-hot-toast';
import { loadTrips, getTripById } from '../../lib/trips/tripStore.js';
import { issueMasterQr, getMasterQrPngUrl, fetchFleetDrivers, notifyDriverShiftPush } from '../../services/platformApi.js';
import { syncTripsToPostgres } from '../../services/tripsSyncApi.js';
import BusPwaInstallGuide from './BusPwaInstallGuide.jsx';

const fieldClass =
  'mt-1.5 w-full rounded-[12px] border border-zinc-200/80 bg-zinc-50 px-3.5 py-2.5 text-[14px] font-medium text-zinc-900 transition-colors focus:bg-white focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/5';

export default function MasterQrPanel({ compact = false }) {
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [issued, setIssued] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(true);

  useEffect(() => {
    const all = loadTrips();
    setTrips(all);
    if (all.length && !tripId) {
      setTripId(String(all[0].id));
    }
    syncTripsToPostgres(all).catch(() => {});
  }, [tripId]);

  useEffect(() => {
    let cancelled = false;
    setDriversLoading(true);
    fetchFleetDrivers('active')
      .then((rows) => {
        if (!cancelled) setDrivers(Array.isArray(rows) ? rows : []);
      })
      .finally(() => {
        if (!cancelled) setDriversLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onIssue = useCallback(
    async (e) => {
      e.preventDefault();
      const id = Number(tripId);
      if (!Number.isFinite(id) || id <= 0) {
        toast.error('Επιλέξτε εκδρομή');
        return;
      }
      setLoading(true);
      try {
        const trip = getTripById(id) || trips.find((t) => Number(t.id) === id);
        if (trip) {
          const sync = await syncTripsToPostgres([trip]);
          if (!sync.postgres_available) {
            toast('Postgres offline — τοπικό QR', { icon: 'ℹ️' });
          }
        }
        const result = await issueMasterQr({
          tripId: id,
          driverId: driverId.trim() || undefined,
        });
        setIssued(result);
        toast.success('Το Master QR εκδόθηκε');
      } catch (err) {
        toast.error(err.message || 'Αποτυχία έκδοσης');
      } finally {
        setLoading(false);
      }
    },
    [tripId, driverId, trips],
  );

  const onNotifyDriverPush = useCallback(async () => {
    const id = Number(tripId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Επιλέξτε εκδρομή');
      return;
    }
    const trip = getTripById(id) || trips.find((t) => Number(t.id) === id);
    setPushLoading(true);
    try {
      const result = await notifyDriverShiftPush({
        tripId: id,
        driverId: driverId.trim() || undefined,
        tripTitle: trip?.title,
        message: trip?.title ? `${trip.title} — πάτα για σύνδεση στη βάρδια` : undefined,
      });
      if (result.push?.reason === 'no_driver_subscriptions') {
        toast.error('Ο οδηγός δεν έχει ενεργοποιήσει push στο /driver', { duration: 7000 });
      } else if (result.ok) {
        toast.success(`Push στάλθηκε · ${result.push?.sent || 0}`);
        setIssued({
          trip_id: result.trip_id,
          auth_url: result.auth_url,
          expires_at: result.expires_at,
          driver_id: driverId.trim() || undefined,
        });
      } else if (result.push?.reason === 'vapid_not_configured') {
        toast.error('Ρυθμίστε WEB_PUSH_VAPID_* στο server');
      } else {
        toast.error('Αποτυχία αποστολής push');
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία push');
    } finally {
      setPushLoading(false);
    }
  }, [tripId, driverId, trips]);

  const expiresLabel = issued?.expires_at
    ? new Date(issued.expires_at * 1000).toLocaleString('el-GR')
    : null;

  return (
    <div className="h-full rounded-[22px] bg-white/80 backdrop-blur-xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-6 sm:p-7 flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          Ταμπλό
        </p>
        <h3 className="mt-1 text-[19px] font-semibold tracking-tight text-zinc-900">Master QR</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-500 tracking-tight">
          Εναλλακτική είσοδος χωρίς κωδικό — σάρωση στο{' '}
          <span className="font-medium text-zinc-700">/driver</span>.
        </p>
      </div>

      <form onSubmit={onIssue} className="space-y-3">
        <label className="block">
          <span className="text-[12px] font-medium text-zinc-500">Εκδρομή</span>
          <select value={tripId} onChange={(e) => setTripId(e.target.value)} className={fieldClass}>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.id} — {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-zinc-500">Οδηγός (προαιρετικά)</span>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className={fieldClass}
            disabled={driversLoading}
          >
            <option value="">Χωρίς συγκεκριμένο οδηγό</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.license_plate || d.vehicle_code
                  ? ` · ${d.license_plate || d.vehicle_code}`
                  : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-[12px] bg-zinc-900 text-white text-[14px] font-semibold hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              {loading ? 'progress_activity' : 'qr_code_2'}
            </span>
            {loading ? 'Έκδοση…' : 'Έκδοση QR'}
          </button>
          <button
            type="button"
            disabled={pushLoading}
            onClick={onNotifyDriverPush}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-[12px] bg-zinc-100 text-zinc-800 text-[14px] font-semibold hover:bg-zinc-200/80 disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              {pushLoading ? 'progress_activity' : 'notifications'}
            </span>
            Push
          </button>
        </div>
      </form>

      {!compact ? <BusPwaInstallGuide /> : null}

      {issued ? (
        <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
          <div className="rounded-[18px] bg-zinc-50 p-4 border border-zinc-100 shrink-0">
            <QRCode value={issued.auth_url || issued.qr_content} size={148} bgColor="transparent" />
          </div>
          <div className="flex-1 w-full min-w-0 space-y-3 text-[13px]">
            <div className="flex flex-wrap gap-2">
              <a
                href={getMasterQrPngUrl(issued.trip_id, {
                  driverId: issued.driver_id || driverId.trim() || undefined,
                })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[11px] bg-zinc-900 text-white text-[13px] font-semibold hover:bg-zinc-800"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Λήψη PNG
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[12px] bg-zinc-50 px-3 py-2.5 border border-zinc-100">
                <div className="text-[11px] text-zinc-400">Trip</div>
                <div className="font-semibold text-zinc-900 mt-0.5">#{issued.trip_id}</div>
              </div>
              <div className="rounded-[12px] bg-zinc-50 px-3 py-2.5 border border-zinc-100">
                <div className="text-[11px] text-zinc-400">Λήξη</div>
                <div className="font-semibold text-zinc-900 mt-0.5 truncate">{expiresLabel}</div>
              </div>
            </div>
            <div className="rounded-[12px] bg-zinc-50 px-3 py-2.5 border border-zinc-100">
              <div className="text-[11px] text-zinc-400 mb-1">Magic link</div>
              <code className="text-[11px] break-all text-zinc-600">
                {issued.auth_url || issued.qr_content}
              </code>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
