import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BusQrScanner from '../components/BusQrScanner.jsx';
import OfficeBrandMark from '../components/storefront/OfficeBrandMark.jsx';
import toast, { Toaster } from 'react-hot-toast';
import {
  adminScanTicket,
  ensureDriverSession,
  fetchBoardingManifest,
  downloadOfflineManifest,
  flushOfflineScanQueue,
} from '../services/ticketingApi.js';
import { SCAN_RESULT } from '../lib/ticketing/constants.js';
import { LIVE_REFRESH_MS } from '../lib/liveRefresh.js';

export default function DriverScan() {
  const navigate = useNavigate();
  const [tripId, setTripId] = useState(1);
  const [manifest, setManifest] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [tab, setTab] = useState('scan');

  const refreshManifest = useCallback(async () => {
    try {
      const data = await fetchBoardingManifest(tripId);
      setManifest(data);
    } catch {
      /* backend offline */
    }
  }, [tripId]);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin' && role !== 'driver') {
      navigate('/admin/login');
      return;
    }
    ensureDriverSession();
    flushOfflineScanQueue().catch(() => {});
    refreshManifest();
    const id = setInterval(refreshManifest, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [navigate, refreshManifest]);

  const handleScan = useCallback(
    async (detected) => {
      if (!detected?.length || !scanning) return;
      const raw = detected[0].rawValue;
      setScanning(false);

      const response = await adminScanTicket({ qr: raw, tripId });
      setLastResult(response);

      if (response.result === SCAN_RESULT.SUCCESS) {
        toast.success(`${response.passenger_name} · Θέση ${response.seat_number}`, {
          duration: 5000,
        });
        if (response.special_requirements?.needs_assistance) {
          toast('⚠️ Χρειάζεται βοήθεια', { icon: '♿' });
        }
        if (response.special_requirements?.allergies?.length) {
          toast(`Αλλεργίες: ${response.special_requirements.allergies.join(', ')}`, {
            icon: '⚕️',
          });
        }
      } else {
        toast.error(response.message || 'Άκυρο εισιτήριο');
      }

      await refreshManifest();
      setTimeout(() => setScanning(true), 2000);
    },
    [scanning, tripId, refreshManifest],
  );

  const handleOfflinePki = async () => {
    try {
      const pack = await downloadOfflineManifest(tripId);
      localStorage.setItem('offline_pki_manifest', JSON.stringify(pack));
      toast.success('PKI manifest αποθηκεύτηκε τοπικά');
    } catch {
      toast.error('Αποτυχία λήψης PKI manifest');
    }
  };

  const successScan = lastResult?.result === SCAN_RESULT.SUCCESS;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Hero header — matches site branding */}
      <header className="relative overflow-hidden border-b border-black/[0.05]">
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary/90 to-slate-800"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(184,195,255,0.2) 0%, transparent 40%)',
          }}
          aria-hidden
        />
        <div className="relative max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <OfficeBrandMark className="h-10 w-auto min-w-[120px] drop-shadow-lg" variant="dark" asLink={false} />
            <div className="h-10 w-px bg-white/20 hidden sm:block" />
            <div>
              <h1 className="text-white font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-300">qr_code_scanner</span>
                Driver Scanner
              </h1>
              <p className="text-white/70 text-xs mt-0.5">Σάρωση εισιτηρίων & live boarding</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="self-start sm:self-center flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-white text-sm font-bold hover:bg-white/25 backdrop-blur-sm border border-white/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Admin
          </button>
        </div>
      </header>

      <div className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-6 flex-1 flex flex-col gap-6">
        {/* Trip controls */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-black/[0.05] shadow-level-2 px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">route</span>
            </div>
            <label className="text-sm">
              <span className="font-bold text-on-surface-variant text-xs uppercase tracking-wider block mb-1">
                Trip ID
              </span>
              <input
                type="number"
                value={tripId}
                onChange={(e) => setTripId(Number(e.target.value))}
                className="w-20 px-3 py-2 rounded-xl bg-surface-container-low border border-black/[0.06] font-bold text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleOfflinePki}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-white text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">offline_pin</span>
            PKI Offline Pack
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-surface-container-low rounded-2xl p-1.5 flex gap-1 shadow-inner border border-black/[0.04]">
          <button
            type="button"
            onClick={() => setTab('scan')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              tab === 'scan'
                ? 'bg-white text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
            Scan
          </button>
          <button
            type="button"
            onClick={() => setTab('manifest')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              tab === 'manifest'
                ? 'bg-white text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">groups</span>
            Live Boarding
          </button>
        </div>

        {tab === 'manifest' && (
          <div className="space-y-5 overflow-y-auto flex-1 pb-8">
            {manifest ? (
              <>
                <div className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-level-2 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <span className="material-symbols-outlined">trending_up</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-500">Πρόοδος επιβίβασης</div>
                      <div className="text-3xl font-bold text-emerald-600">{manifest.progress_label}</div>
                    </div>
                  </div>
                  <div className="h-3 bg-surface-container-low rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${manifest.progress_percent}%` }}
                    />
                  </div>
                </div>

                {manifest.alerts?.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 text-sm px-4 py-3 rounded-2xl border ${
                      a.level === 'warning'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-blue-50 text-blue-900 border-blue-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] shrink-0">
                      {a.level === 'warning' ? 'warning' : 'info'}
                    </span>
                    {a.text}
                  </div>
                ))}

                <section className="bg-white rounded-[28px] border border-black/[0.05] shadow-sm p-6">
                  <h3 className="font-bold text-rose-600 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">person_off</span>
                    Missing (No-Shows) — {manifest.missing_passengers?.length ?? 0}
                  </h3>
                  <ul className="space-y-3">
                    {manifest.missing_passengers?.length ? (
                      manifest.missing_passengers.map((p) => (
                        <li
                          key={p.booking_id}
                          className="bg-rose-50/80 rounded-2xl p-4 border border-rose-100"
                        >
                          <div className="font-bold text-gray-900">{p.passenger_name}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            Θέση {p.seat_number} · {p.phone}
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-500 py-4 text-center">Όλοι οι επιβάτες έχουν επιβιβαστεί</li>
                    )}
                  </ul>
                </section>

                <section className="bg-white rounded-[28px] border border-black/[0.05] shadow-sm p-6">
                  <h3 className="font-bold text-emerald-700 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">how_to_reg</span>
                    Boarded
                  </h3>
                  <ul className="space-y-2">
                    {manifest.boarded_passengers?.map((p) => (
                      <li
                        key={p.booking_id}
                        className="flex justify-between items-center py-3 px-4 rounded-xl bg-emerald-50/60 border border-emerald-100"
                      >
                        <span className="font-medium text-gray-900">{p.passenger_name}</span>
                        <span className="text-sm font-bold text-emerald-700 bg-white px-3 py-1 rounded-full">
                          Θέση {p.seat_number}
                        </span>
                      </li>
                    ))}
                    {!manifest.boarded_passengers?.length && (
                      <li className="text-sm text-gray-500 py-4 text-center">Κανένας επιβιβασμένος ακόμα</li>
                    )}
                  </ul>
                </section>
              </>
            ) : (
              <div className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] p-12 text-center">
                <span className="material-symbols-outlined text-4xl text-gray-300 mb-3">cloud_off</span>
                <p className="text-on-surface-variant text-sm">
                  Το manifest δεν είναι διαθέσιμο (backend offline). Συνεχίστε με σάρωση QR.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'scan' && (
          <div className="flex flex-col lg:flex-row gap-6 flex-1 pb-8">
            <div className="flex-1 bg-surface-container-lowest rounded-[32px] border border-black/[0.05] shadow-level-2 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined">qr_code_2</span>
                </div>
                <div>
                  <h2 className="font-bold text-lg">Σάρωση εισιτηρίου</h2>
                  <p className="text-xs text-on-surface-variant">Κεντράρετε το QR μέσα στο πλαίσιο</p>
                </div>
              </div>
              <div className="w-full max-w-lg mx-auto">
                {scanning ? (
                  <BusQrScanner
                    variant="light"
                    paused={!scanning}
                    onScan={(raw) => handleScan([{ rawValue: raw }])}
                  />
                ) : (
                  <div className="min-h-[300px] rounded-2xl bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
                    <span className="material-symbols-outlined text-5xl text-primary animate-spin">
                      progress_activity
                    </span>
                    <p className="text-sm font-medium">Επεξεργασία σάρωσης…</p>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-80 shrink-0 space-y-4">
              {lastResult ? (
                <div
                  className={`rounded-[28px] p-6 text-center text-white shadow-level-2 border ${
                    successScan
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 border-emerald-400/30'
                      : 'bg-gradient-to-br from-rose-500 to-rose-700 border-rose-400/30'
                  }`}
                >
                  <span className="material-symbols-outlined text-5xl mb-3 block">
                    {successScan ? 'check_circle' : 'cancel'}
                  </span>
                  <div className="text-lg font-bold uppercase tracking-wide opacity-90">
                    {lastResult.result}
                  </div>
                  {lastResult.passenger_name && (
                    <p className="text-xl font-bold mt-2">{lastResult.passenger_name}</p>
                  )}
                  {lastResult.seat_number && (
                    <p className="mt-1 text-white/90">Θέση {lastResult.seat_number}</p>
                  )}
                  {lastResult.special_requirements?.notes && (
                    <p className="text-sm mt-3 px-2 py-2 rounded-xl bg-black/15">
                      {lastResult.special_requirements.notes}
                    </p>
                  )}
                  {lastResult.elapsed_ms != null && (
                    <p className="text-xs mt-3 opacity-70">{lastResult.elapsed_ms} ms</p>
                  )}
                </div>
              ) : (
                <div className="rounded-[28px] p-6 bg-surface-container-low border border-black/[0.05] text-center">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">contactless</span>
                  <p className="text-sm text-on-surface-variant">
                    Σαρώστε ένα εισιτήριο για να εμφανιστούν τα στοιχεία επιβάτη εδώ.
                  </p>
                </div>
              )}

              <div className="rounded-[28px] p-5 bg-primary/5 border border-primary/15">
                <h3 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">tips_and_updates</span>
                  Συμβουλές
                </h3>
                <ul className="text-xs text-on-surface-variant space-y-2 leading-relaxed">
                  <li>· Κρατήστε σταθερό το τηλέφωνο 20–30 cm από το QR</li>
                  <li>· Χρησιμοποιήστε καλό φωτισμό ή flash</li>
                  <li>· Χωρίς κάμερα: επικόλληση κωδικού παρακάτω</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <Toaster
        position="top-center"
        toastOptions={{
          className: 'font-medium',
          style: {
            borderRadius: '16px',
            background: '#1e293b',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}
