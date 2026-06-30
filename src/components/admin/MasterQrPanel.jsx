import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { loadTrips, getTripById } from '../../lib/trips/tripStore.js';
import { issueMasterQr, getMasterQrPngUrl, fetchFleetDrivers } from '../../services/platformApi.js';
import { syncTripsToPostgres } from '../../services/tripsSyncApi.js';
import BusPwaInstallGuide from './BusPwaInstallGuide.jsx';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium transition-colors focus:bg-white focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15';

export default function MasterQrPanel() {
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [issued, setIssued] = useState(null);
  const [loading, setLoading] = useState(false);
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

  const onIssue = useCallback(async (e) => {
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
          toast('Postgres offline — Master QR θα είναι τοπικό JSON', { icon: 'ℹ️' });
        }
      }
      const result = await issueMasterQr({
        tripId: id,
        driverId: driverId.trim() || undefined,
      });
      setIssued(result);
      toast.success(
        result.source === 'postgres'
          ? 'Master QR εκδόθηκε (SaaS / Postgres)'
          : 'Master QR εκδόθηκε (τοπικό demo)',
      );
    } catch (err) {
      toast.error(err.message || 'Αποτυχία έκδοσης');
    } finally {
      setLoading(false);
    }
  }, [tripId, driverId, trips]);

  const expiresLabel = issued?.expires_at
    ? new Date(issued.expires_at * 1000).toLocaleString('el-GR')
    : null;

  return (
    <div className="relative overflow-hidden bg-white rounded-[24px] border border-black/[0.06] shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-indigo-400" />

      <div className="p-6 sm:p-7 space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[26px]">qr_code_2</span>
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-gray-900 text-lg tracking-tight">
              Master QR (ταμπλό λεωφορείου)
            </h4>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              Ο οδηγός σκανάρει στο{' '}
              <code className="bg-primary/8 text-primary px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold">
                /driver
              </code>{' '}
              ή ανοίγει magic link{' '}
              <code className="bg-primary/8 text-primary px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold">
                /driver/auth
              </code>{' '}
              — χωρίς username/password.
            </p>
          </div>
        </div>

        <form onSubmit={onIssue} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <label className="block">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Εκδρομή</span>
            <select value={tripId} onChange={(e) => setTripId(e.target.value)} className={inputClass}>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Οδηγός (προαιρ.)
            </span>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className={inputClass}
              disabled={driversLoading}
            >
              <option value="">— Χωρίς συγκεκριμένο οδηγό —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.license_plate || d.vehicle_code
                    ? ` · ${d.license_plate || d.vehicle_code}`
                    : ''}
                </option>
              ))}
            </select>
            {driversLoading ? (
              <p className="text-[10px] text-gray-400 mt-1">Φόρτωση οδηγών…</p>
            ) : drivers.length === 0 ? (
              <p className="text-[10px] text-amber-600 mt-1">
                Δεν βρέθηκαν ενεργοί οδηγοί — προσθέστε από Διαχείριση Οδηγών
              </p>
            ) : null}
          </label>
          <button
            type="submit"
            disabled={loading}
            className="h-[46px] rounded-full bg-primary text-white font-bold text-sm px-7 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">
              {loading ? 'hourglass_empty' : 'qr_code_scanner'}
            </span>
            {loading ? 'Έκδοση…' : 'Έκδοση QR'}
          </button>
        </form>

        <BusPwaInstallGuide />

        {issued && (
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start pt-6 border-t border-gray-100">
            <div className="relative bg-white p-5 rounded-2xl border-2 border-dashed border-primary/25 shadow-inner">
              <div className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-bold uppercase tracking-wider text-primary">
                Σκανάρισμα
              </div>
              <QRCode value={issued.auth_url || issued.qr_content} size={180} />
            </div>
            <div className="flex-1 space-y-3 text-sm w-full">
              <div className="flex flex-wrap gap-2">
                <a
                  href={getMasterQrPngUrl(issued.trip_id, {
                    driverId: issued.driver_id || driverId.trim() || undefined,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-primary text-white hover:bg-primary/90"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Λήψη PNG
                </a>
              </div>
              {issued.source && (
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                    issued.source === 'postgres'
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {issued.source === 'postgres' ? 'cloud_done' : 'storage'}
                  </span>
                  {issued.source === 'postgres' ? 'Postgres (SaaS)' : 'Τοπικό JSON'}
                </span>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Trip</div>
                  <div className="font-bold text-gray-900 mt-0.5">#{issued.trip_id}</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Λήξη</div>
                  <div className="font-bold text-gray-900 mt-0.5">{expiresLabel}</div>
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Magic link</div>
                <code className="text-xs bg-white px-2 py-1 rounded-lg border border-gray-100 break-all">
                  {issued.auth_url || issued.qr_content}
                </code>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Manifest URL</div>
                <code className="text-xs bg-white px-2 py-1 rounded-lg border border-gray-100 break-all">
                  {issued.manifest_url}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
