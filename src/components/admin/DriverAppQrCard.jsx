import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCode } from 'react-qr-code';
import toast from 'react-hot-toast';
import { getDriverLoginUrl } from '../../lib/driver/driverPwaUrl.js';
import { loadTrips, getTripById } from '../../lib/trips/tripStore.js';
import { issueMasterQr, getMasterQrPngUrl, notifyDriverShiftPush } from '../../services/platformApi.js';
import { syncTripsToPostgres } from '../../services/tripsSyncApi.js';

/**
 * QR στην καρτέλα οδηγού — μόνιμο link εισόδου + έκδοση Master QR βάρδιας.
 */
export default function DriverAppQrCard({ driver, assignedTrips = [] }) {
  const loginUrl = useMemo(
    () => getDriverLoginUrl({ username: driver?.email || driver?.license_no }),
    [driver?.email, driver?.license_no],
  );

  const tripOptions = useMemo(() => {
    const assigned = Array.isArray(assignedTrips) ? assignedTrips : [];
    if (assigned.length) return assigned;
    return loadTrips();
  }, [assignedTrips]);

  const [tripId, setTripId] = useState('');
  const [issued, setIssued] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

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

  const copyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(loginUrl);
      toast.success('Το link αντιγράφηκε');
    } catch {
      toast.error('Αποτυχία αντιγραφής');
    }
  };

  const shareWhatsApp = () => {
    const name = driver?.name || 'οδηγέ';
    const text = `PoreiaGo — είσοδος εφαρμογής για ${name}:\n${loginUrl}\n\nΌνομα χρήστη: ${driver?.email || '—'}\n(Ο κωδικός στέλνεται χωριστά από το γραφείο.)`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const onIssueMaster = useCallback(async () => {
    const id = Number(tripId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Επιλέξτε εκδρομή για Master QR');
      return;
    }
    if (!driver?.id) {
      toast.error('Λείπει το id οδηγού');
      return;
    }
    setLoading(true);
    try {
      const trip = getTripById(id) || tripOptions.find((t) => Number(t.id) === id);
      if (trip) {
        const sync = await syncTripsToPostgres([trip]);
        if (!sync.postgres_available) {
          toast('Postgres offline — τοπικό QR', { icon: 'ℹ️' });
        }
      }
      const result = await issueMasterQr({ tripId: id, driverId: driver.id });
      setIssued(result);
      toast.success('Master QR εκδόθηκε για αυτόν τον οδηγό');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία έκδοσης QR');
    } finally {
      setLoading(false);
    }
  }, [tripId, driver?.id, tripOptions]);

  const onPushMaster = useCallback(async () => {
    const id = Number(tripId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Επιλέξτε εκδρομή');
      return;
    }
    const trip = getTripById(id) || tripOptions.find((t) => Number(t.id) === id);
    setPushLoading(true);
    try {
      const result = await notifyDriverShiftPush({
        tripId: id,
        driverId: driver.id,
        tripTitle: trip?.title,
        message: trip?.title
          ? `${trip.title} — πάτα για σύνδεση στη βάρδια`
          : 'Πάτα για σύνδεση στη βάρδια',
      });
      if (result.push?.reason === 'no_driver_subscriptions') {
        toast.error('Ο οδηγός δεν έχει ενεργοποιήσει push στο /driver', { duration: 7000 });
      } else if (result.ok) {
        toast.success(`Push στάλθηκε · ${result.push?.sent || 0}`);
        setIssued({
          trip_id: result.trip_id,
          auth_url: result.auth_url,
          expires_at: result.expires_at,
          driver_id: driver.id,
        });
      } else {
        toast.error('Αποτυχία αποστολής push');
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία push');
    } finally {
      setPushLoading(false);
    }
  }, [tripId, driver?.id, tripOptions]);

  const copyMasterLink = async () => {
    const url = issued?.auth_url || issued?.qr_content;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Το Master QR link αντιγράφηκε');
    } catch {
      toast.error('Αποτυχία αντιγραφής');
    }
  };

  const expiresLabel = issued?.expires_at
    ? new Date(issued.expires_at * 1000).toLocaleString('el-GR')
    : null;

  return (
    <section
      id="driver-qr"
      className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-black/[0.05]">
        <h3 className="font-bold text-lg flex items-center gap-2 text-on-surface">
          <span className="material-symbols-outlined text-primary">qr_code_2</span>
          QR εφαρμογής οδηγού
        </h3>
        <p className="text-sm text-on-surface-variant mt-1">
          Δείτε το QR εδώ και στείλτε το στον οδηγό — ανοίγει την εφαρμογή με προ-συμπληρωμένο όνομα χρήστη.
        </p>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col items-center sm:items-start gap-4">
          <div className="rounded-[20px] bg-white border border-black/[0.06] p-4 shadow-sm">
            <QRCode value={loginUrl} size={168} bgColor="#ffffff" fgColor="#0f172a" />
          </div>
          <div className="w-full min-w-0 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              Μόνιμο link εισόδου
            </p>
            <p className="text-xs font-mono text-on-surface break-all bg-surface-container-low rounded-xl px-3 py-2">
              {loginUrl}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={copyLoginLink}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-primary text-white text-sm font-bold hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                Αντιγραφή
              </button>
              <button
                type="button"
                onClick={shareWhatsApp}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-emerald-600 text-white text-sm font-bold hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                WhatsApp
              </button>
              <a
                href={loginUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-black/[0.08] text-sm font-bold text-on-surface hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                Άνοιγμα
              </a>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Ο κωδικός δεν μπαίνει στο QR — στείλτε τον χωριστά (ή ορίστε τον στην ενότητα λογαριασμού παραπάνω).
            </p>
          </div>
        </div>

        <div className="rounded-[20px] bg-sky-50/80 border border-sky-100 p-5 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Master QR βάρδιας</p>
            <p className="text-sm text-sky-900/80 mt-1 leading-snug">
              Προαιρετικά: one-tap είσοδος για συγκεκριμένη εκδρομή (λήγει μετά από ~24ώρες).
            </p>
          </div>

          {tripOptions.length === 0 ? (
            <p className="text-sm text-sky-900/70">
              Δεν υπάρχουν εκδρομές ακόμα — δημιουργήστε μία για να εκδώσετε Master QR.
            </p>
          ) : (
            <>
              <label className="block text-sm">
                <span className="font-bold text-sky-950">Εκδρομή</span>
                <select
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  {tripOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.id} — {t.title || 'Εκδρομή'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={onIssueMaster}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-sky-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {loading ? 'progress_activity' : 'qr_code_2'}
                  </span>
                  {loading ? 'Έκδοση…' : 'Έκδοση Master QR'}
                </button>
                <button
                  type="button"
                  disabled={pushLoading || !driver?.id}
                  onClick={onPushMaster}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-white border border-sky-200 text-sky-950 text-sm font-bold hover:bg-sky-100/60 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {pushLoading ? 'progress_activity' : 'notifications'}
                  </span>
                  Push στον οδηγό
                </button>
              </div>
            </>
          )}

          {issued ? (
            <div className="pt-3 border-t border-sky-200/80 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
              <div className="rounded-[16px] bg-white p-3 border border-sky-100 shrink-0">
                <QRCode value={issued.auth_url || issued.qr_content} size={132} bgColor="#ffffff" />
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                {expiresLabel ? (
                  <p className="text-xs text-sky-800">Λήξη: {expiresLabel}</p>
                ) : null}
                <p className="text-[11px] font-mono break-all text-sky-950/80">
                  {issued.auth_url || issued.qr_content}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyMasterLink}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-full bg-white border border-sky-200 text-xs font-bold"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    Αντιγραφή
                  </button>
                  <a
                    href={getMasterQrPngUrl(issued.trip_id || tripId, { driverId: driver.id })}
                    download={`master-qr-${driver.id}.png`}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-full bg-white border border-sky-200 text-xs font-bold"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    PNG
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
