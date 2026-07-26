import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCode } from 'react-qr-code';
import toast from 'react-hot-toast';
import { loadTrips, getTripById } from '../../lib/trips/tripStore.js';
import { issueMasterQr, getMasterQrPngUrl } from '../../services/platformApi.js';
import { syncTripsToPostgres } from '../../services/tripsSyncApi.js';

/**
 * Passwordless driver login QR for the driver profile account section.
 * Issues a Master QR bound to this driver + a selected trip.
 */
export default function DriverLoginQrPanel({ driverId, driverName, assignedTrips = [] }) {
  const allTrips = useMemo(() => loadTrips(), []);
  const tripOptions = useMemo(() => {
    if (assignedTrips.length) return assignedTrips;
    return allTrips;
  }, [assignedTrips, allTrips]);

  const [tripId, setTripId] = useState('');
  const [issued, setIssued] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tripOptions.length) {
      setTripId('');
      return;
    }
    setTripId((prev) => {
      if (prev && tripOptions.some((t) => String(t.id) === String(prev))) return prev;
      return String(tripOptions[0].id);
    });
  }, [tripOptions]);

  useEffect(() => {
    setIssued(null);
  }, [driverId]);

  const onIssue = useCallback(
    async (e) => {
      e?.preventDefault?.();
      const id = Number(tripId);
      if (!driverId) {
        toast.error('Λείπει ο οδηγός');
        return;
      }
      if (!Number.isFinite(id) || id <= 0) {
        toast.error('Επιλέξτε εκδρομή για το QR σύνδεσης');
        return;
      }
      setLoading(true);
      try {
        const trip = getTripById(id) || tripOptions.find((t) => Number(t.id) === id);
        if (trip) {
          syncTripsToPostgres([trip]).catch(() => {});
        }
        const result = await issueMasterQr({
          tripId: id,
          driverId,
          preferAdmin: true,
        });
        setIssued({ ...result, driver_id: driverId });
        toast.success('QR σύνδεσης χωρίς κωδικό έτοιμο');
      } catch (err) {
        toast.error(err.message || 'Αποτυχία έκδοσης QR');
      } finally {
        setLoading(false);
      }
    },
    [tripId, driverId, tripOptions],
  );

  const copyLink = async () => {
    const url = issued?.auth_url || issued?.qr_content;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Ο σύνδεσμος αντιγράφηκε');
    } catch {
      toast.error('Αποτυχία αντιγραφής');
    }
  };

  const expiresLabel = issued?.expires_at
    ? new Date(issued.expires_at * 1000).toLocaleString('el-GR')
    : null;

  const authUrl = issued?.auth_url || issued?.qr_content || '';

  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-[26px] shrink-0">qr_code_2</span>
        <div className="min-w-0">
          <h4 className="font-bold text-on-surface text-sm sm:text-base">
            Σύνδεση χωρίς κωδικό
          </h4>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 leading-relaxed">
            Εκδώστε QR για τον οδηγό
            {driverName ? (
              <>
                {' '}
                <span className="font-semibold text-on-surface">{driverName}</span>
              </>
            ) : null}
            . Σκανάρει στο τηλέφωνο και μπαίνει στο{' '}
            <span className="font-semibold text-on-surface">/driver</span> χωρίς password.
          </p>
        </div>
      </div>

      {!tripOptions.length ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
          Δεν υπάρχει εκδρομή για δέσμευση QR. Δημιουργήστε ή αναθέστε μία εκδρομή στον οδηγό, μετά
          εκδώστε το QR εδώ.
        </p>
      ) : (
        <form onSubmit={onIssue} className="space-y-3">
          <label className="block text-sm">
            <span className="font-bold text-on-surface">Εκδρομή βάρδιας</span>
            <select
              value={tripId}
              onChange={(e) => {
                setTripId(e.target.value);
                setIssued(null);
              }}
              className="mt-1 w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/15"
            >
              {tripOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={loading || !tripId}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">
              {loading ? 'progress_activity' : 'qr_code_2'}
            </span>
            {loading ? 'Έκδοση…' : issued ? 'Νέο QR' : 'Έκδοση QR σύνδεσης'}
          </button>
        </form>
      )}

      {issued && authUrl ? (
        <div className="pt-3 border-t border-primary/10 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
          <div className="rounded-2xl bg-white p-3 border border-black/[0.06] shrink-0 shadow-sm">
            <QRCode value={authUrl} size={148} bgColor="#ffffff" />
          </div>
          <div className="flex-1 w-full min-w-0 space-y-2.5 text-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-white text-xs font-bold hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Αντιγραφή link
              </button>
              <a
                href={getMasterQrPngUrl(issued.trip_id, { driverId })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-black/[0.08] bg-white text-xs font-bold text-on-surface hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Λήψη PNG
              </a>
              <a
                href={authUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-black/[0.08] bg-white text-xs font-bold text-on-surface hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Άνοιγμα
              </a>
            </div>
            {expiresLabel ? (
              <p className="text-xs text-on-surface-variant">
                Λήξη: <span className="font-semibold text-on-surface">{expiresLabel}</span>
              </p>
            ) : null}
            <div className="rounded-xl bg-white border border-black/[0.06] px-3 py-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant mb-1">
                Magic link
              </div>
              <code className="text-[11px] break-all text-on-surface/80 leading-snug">{authUrl}</code>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
