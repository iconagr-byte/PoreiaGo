import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { mockFleet } from '../../data/mockData.js';
import AdminLayout from '../../components/AdminLayout.jsx';
import { loadTrips } from '../../lib/trips/tripStore.js';
import {
  fetchDriverHistory,
  fetchFleetDriver,
  updateFleetDriver,
  uploadDriverPhoto,
} from '../../services/platformApi.js';
import ImageDropField from '../../components/admin/ImageDropField.jsx';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

const STATUS_LABELS = {
  active: 'Ενεργός',
  inactive: 'Ανενεργός',
  on_leave: 'Άδεια',
  suspended: 'Αναστολή',
};

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  on_leave: 'bg-amber-50 text-amber-800 border-amber-100',
  suspended: 'bg-rose-50 text-rose-700 border-rose-100',
};

const HISTORY_TABS = [
  { id: 'timeline', label: 'Χρονολόγιο', icon: 'history' },
  { id: 'logins', label: 'Συνδέσεις', icon: 'login' },
  { id: 'shifts', label: 'Βάρδιες', icon: 'schedule' },
  { id: 'km', label: 'Χιλιόμετρα', icon: 'straighten' },
];

function safetyRingColor(score) {
  if (score >= 90) return 'text-emerald-500';
  if (score >= 75) return 'text-amber-500';
  return 'text-rose-500';
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('el-GR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('el-GR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function formatDuration(min) {
  if (min == null || Number.isNaN(Number(min))) return '—';
  const m = Math.max(0, Math.round(Number(min)));
  if (m < 60) return `${m} λεπτά`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} ώρ. ${rem} λεπ.` : `${h} ώρ.`;
}

function loginMethodLabel(method, kind) {
  if (kind === 'login_master_qr' || method === 'master_qr') return 'Master QR';
  return 'Κωδικός';
}

function timelineLabel(item) {
  switch (item?.kind) {
    case 'login':
      return 'Σύνδεση με κωδικό';
    case 'login_master_qr':
      return 'Σύνδεση με Master QR';
    case 'shift_start':
      return 'Έναρξη βάρδιας';
    case 'shift_end':
      return 'Τέλος βάρδιας';
    default:
      return item?.kind || 'Συμβάν';
  }
}

function timelineIcon(kind) {
  switch (kind) {
    case 'login':
    case 'login_master_qr':
      return 'login';
    case 'shift_start':
      return 'play_circle';
    case 'shift_end':
      return 'stop_circle';
    default:
      return 'history';
  }
}

function InfoTile({ icon, label, value, sub, highlight }) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-4 border border-black/[0.04]">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-[22px]">{icon}</span>
        <div className="min-w-0">
          <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-0.5">
            {label}
          </div>
          <div className={`text-sm font-bold truncate ${highlight || 'text-on-surface'}`}>
            {value}
          </div>
          {sub && <div className="text-xs text-on-surface-variant mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function DriverDetailPage() {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appPassword, setAppPassword] = useState('');
  const [appPasswordConfirm, setAppPasswordConfirm] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyTab, setHistoryTab] = useState('timeline');

  const reloadDriver = async () => {
    const d = await fetchFleetDriver(driverId);
    setDriver(d);
    setPhotoUrl(d?.photo_url || '');
    return d;
  };

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setHistoryLoading(true);
      const [d, h] = await Promise.all([
        fetchFleetDriver(driverId),
        fetchDriverHistory(driverId).catch(() => null),
      ]);
      if (!cancelled) {
        setDriver(d);
        setPhotoUrl(d?.photo_url || '');
        setHistory(h);
        setLoading(false);
        setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId, navigate]);

  const saveAppAccount = async (e) => {
    e.preventDefault();
    if (!appPassword && photoUrl === (driver?.photo_url || '')) {
      toast.error('Δεν υπάρχουν αλλαγές');
      return;
    }
    if (appPassword) {
      if (appPassword.length < 4) {
        toast.error('Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες');
        return;
      }
      if (appPassword !== appPasswordConfirm) {
        toast.error('Οι κωδικοί δεν ταιριάζουν');
        return;
      }
    }
    setSavingAccount(true);
    try {
      const patch = { photo_url: photoUrl.trim() || null };
      if (appPassword) patch.password = appPassword;
      await updateFleetDriver(driverId, patch);
      await reloadDriver();
      setAppPassword('');
      setAppPasswordConfirm('');
      toast.success('Ο λογαριασμός εφαρμογής ενημερώθηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSavingAccount(false);
    }
  };

  const assignedTrips = useMemo(() => {
    if (!driver) return [];
    return loadTrips().filter(
      (t) =>
        t.driverId === driver.id ||
        t.driverName === driver.name ||
        (driver.license_plate && t.vehiclePlate === driver.license_plate),
    );
  }, [driver]);

  const fleetVehicle = useMemo(() => {
    if (!driver?.license_plate) return null;
    return mockFleet.find(
      (f) =>
        f.licensePlate === driver.license_plate ||
        f.id === driver.vehicle_code,
    );
  }, [driver]);

  const header = (
    <div className="flex items-center gap-3 w-full">
      <button
        type="button"
        onClick={() =>
          navigate('/admin', { state: { activeTab: 'drivers' } })
        }
        className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high transition-colors shrink-0"
        aria-label="Επιστροφή"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 className="font-headline-md font-bold flex items-center gap-2 min-w-0 flex-1">
        <span className="material-symbols-outlined text-primary">badge</span>
        <span className="truncate">Προφίλ Οδηγού</span>
      </h1>
      {driverId && (
        <button
          type="button"
          onClick={() => navigate(`/admin/drivers/${driverId}/edit`)}
          className="shrink-0 px-4 py-2 rounded-full bg-primary text-white text-sm font-bold inline-flex items-center gap-1.5 hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          Επεξεργασία
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <AdminLayout activeTab="settings" title={header}>
        <p className="text-on-surface-variant">Φόρτωση προφίλ…</p>
      </AdminLayout>
    );
  }

  if (!driver) {
    return (
      <AdminLayout activeTab="settings" title={header}>
        <div className="max-w-lg mx-auto text-center py-16 bg-white rounded-[32px] border shadow-sm">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">person_off</span>
          <p className="text-on-surface-variant mb-4">Δεν βρέθηκε ο οδηγός.</p>
          <Link
            to="/admin"
            state={{ activeTab: 'drivers' }}
            className="text-primary font-bold hover:underline"
          >
            Επιστροφή στη λίστα οδηγών
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const safety = driver.safety_score ?? 100;
  const licenseDays = driver.days_until_license_expiry;
  const licenseUrgent = licenseDays != null && licenseDays < 30;
  const summary = history?.summary || {};
  const displayKm =
    summary.display_total_km ?? summary.gps_total_km ?? driver.total_km ?? 0;

  return (
    <AdminLayout activeTab="settings" title={header}>
      <div className="max-w-5xl mx-auto pb-16 space-y-6">
        <div className="bg-surface-container-lowest rounded-[32px] border border-black/[0.05] shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            <div className="flex flex-col items-center md:items-start shrink-0">
              {driver.photo_url ? (
                <img
                  src={resolveSiteAssetUrl(driver.photo_url)}
                  alt=""
                  className="w-24 h-24 rounded-3xl object-cover shadow-inner border border-primary/10"
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary flex items-center justify-center shadow-inner border border-primary/10">
                  <span className="material-symbols-outlined text-[48px]">person</span>
                </div>
              )}
              <div className="mt-4 relative w-20 h-20 mx-auto md:mx-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-100"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={safetyRingColor(safety)}
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${safety}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-lg font-bold ${safetyRingColor(safety)}`}>{safety}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Safety</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <h2 className="text-2xl md:text-3xl font-bold text-on-surface">{driver.name}</h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    STATUS_STYLES[driver.status] || STATUS_STYLES.inactive
                  }`}
                >
                  {STATUS_LABELS[driver.status] || driver.status}
                </span>
              </div>
              <p className="text-sm font-mono text-on-surface-variant mb-6">
                Άδεια: {driver.license_no}
                {driver.license_plate && (
                  <span className="mx-2 text-gray-300">·</span>
                )}
                {driver.license_plate && (
                  <span className="text-primary font-bold">{driver.license_plate}</span>
                )}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface-container-low rounded-2xl p-4 text-center md:text-left">
                  <div className="text-xs text-on-surface-variant font-bold uppercase mb-1">
                    Εκδρομές
                  </div>
                  <div className="text-xl font-bold text-on-surface">
                    {(summary.trips_completed ?? driver.trips_completed)?.toLocaleString('el-GR') ?? 0}
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-2xl p-4 text-center md:text-left">
                  <div className="text-xs text-on-surface-variant font-bold uppercase mb-1">Km</div>
                  <div className="text-xl font-bold text-on-surface">
                    {Number(displayKm || 0).toLocaleString('el-GR')}
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-2xl p-4 text-center md:text-left">
                  <div className="text-xs text-on-surface-variant font-bold uppercase mb-1">
                    Υπόλοιπο
                  </div>
                  <div className="text-xl font-bold text-emerald-600">
                    €{Number(driver.current_balance || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-2xl p-4 text-center md:text-left">
                  <div className="text-xs text-on-surface-variant font-bold uppercase mb-1">
                    Βαθμολογία
                  </div>
                  <div className="text-xl font-bold text-amber-600">
                    {driver.avg_rating ? `${driver.avg_rating.toFixed(1)} ★` : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoTile icon="mail" label="Email" value={driver.email} />
          <InfoTile icon="phone" label="Τηλέφωνο" value={driver.phone || '—'} />
          <InfoTile
            icon="calendar_today"
            label="Έναρξη απασχόλησης"
            value={formatDate(driver.hiring_date)}
          />
          <InfoTile
            icon="payments"
            label="Αμοιβή"
            value={`€${driver.salary_per_km}/km`}
            sub={`€${driver.salary_per_trip} ανά εκδρομή`}
          />
          <InfoTile
            icon="id_card"
            label="Λήξη άδειας οδήγησης"
            value={formatDate(driver.license_expires_at)}
            sub={
              licenseDays != null
                ? `${licenseDays} ημέρες απομένουν`
                : undefined
            }
            highlight={licenseUrgent ? 'text-rose-600' : undefined}
          />
          <InfoTile
            icon="directions_bus"
            label="Όχημα"
            value={driver.license_plate || driver.vehicle_code || '—'}
            sub={driver.vehicle_code && driver.vehicle_code !== driver.license_plate ? driver.vehicle_code : undefined}
          />
        </div>

        <section className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-black/[0.05] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2 text-on-surface">
                <span className="material-symbols-outlined text-primary">history</span>
                Πλήρες ιστορικό
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Συνδέσεις, βάρδιες και χιλιόμετρα από GPS / εφαρμογή
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant">
                {summary.login_count ?? 0} συνδέσεις
              </span>
              <span className="px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant">
                {summary.shift_count ?? 0} βάρδιες
              </span>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary">
                {Number(displayKm || 0).toLocaleString('el-GR')} km
              </span>
            </div>
          </div>

          <div className="px-4 pt-4 flex flex-wrap gap-2 border-b border-black/[0.04]">
            {HISTORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistoryTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  historyTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {historyLoading ? (
            <p className="text-sm text-on-surface-variant text-center py-12">Φόρτωση ιστορικού…</p>
          ) : !history ? (
            <p className="text-sm text-on-surface-variant text-center py-12">
              Δεν ήταν δυνατή η φόρτωση του ιστορικού.
            </p>
          ) : (
            <>
              {historyTab === 'timeline' && (
                <ul className="divide-y divide-black/[0.05]">
                  {(history.timeline || []).length === 0 ? (
                    <li className="text-sm text-on-surface-variant text-center py-12">
                      Δεν υπάρχουν ακόμα καταγραφές. Θα εμφανιστούν μετά από συνδέσεις και βάρδιες.
                    </li>
                  ) : (
                    (history.timeline || []).map((item) => (
                      <li key={item.id || `${item.kind}-${item.at}`} className="px-6 py-4 flex gap-3">
                        <span className="material-symbols-outlined text-primary text-[22px] mt-0.5">
                          {timelineIcon(item.kind)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-on-surface">{timelineLabel(item)}</div>
                          <div className="text-xs text-on-surface-variant mt-0.5">
                            {formatDateTime(item.at)}
                            {item.trip_id != null ? ` · Δρομολόγιο #${item.trip_id}` : ''}
                            {item.km != null
                              ? ` · ${Number(item.km).toLocaleString('el-GR')} km`
                              : ''}
                            {item.duration_min != null
                              ? ` · ${formatDuration(item.duration_min)}`
                              : ''}
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              )}

              {historyTab === 'logins' && (
                <ul className="divide-y divide-black/[0.05]">
                  {(history.logins || []).length === 0 ? (
                    <li className="text-sm text-on-surface-variant text-center py-12">
                      Καμία καταγεγραμμένη σύνδεση ακόμα.
                    </li>
                  ) : (
                    (history.logins || []).map((row) => (
                      <li
                        key={row.id}
                        className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-on-surface">
                            {loginMethodLabel(row.method, row.type)}
                          </div>
                          <div className="text-xs text-on-surface-variant mt-0.5">
                            {formatDateTime(row.at)}
                            {row.trip_id != null ? ` · Δρομολόγιο #${row.trip_id}` : ''}
                          </div>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-50 text-sky-800">
                          Login
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              )}

              {historyTab === 'shifts' && (
                <ul className="divide-y divide-black/[0.05]">
                  {(history.shifts || []).length === 0 ? (
                    <li className="text-sm text-on-surface-variant text-center py-12">
                      Καμία καταγεγραμμένη βάρδια ακόμα.
                    </li>
                  ) : (
                    (history.shifts || []).map((row) => (
                      <li
                        key={row.shift_id}
                        className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-on-surface">
                            {row.status === 'open' ? 'Βάρδια σε εξέλιξη' : 'Ολοκληρωμένη βάρδια'}
                          </div>
                          <div className="text-xs text-on-surface-variant mt-0.5">
                            Έναρξη: {formatDateTime(row.started_at)}
                            {row.ended_at ? ` · Τέλος: ${formatDateTime(row.ended_at)}` : ''}
                            {row.trip_id != null ? ` · Δρομολόγιο #${row.trip_id}` : ''}
                          </div>
                          <div className="text-xs text-on-surface-variant mt-1">
                            Διάρκεια: {formatDuration(row.duration_min)}
                            {row.km != null
                              ? ` · ${Number(row.km).toLocaleString('el-GR')} km`
                              : ''}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full ${
                            row.status === 'open'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-surface-container-low text-on-surface-variant'
                          }`}
                        >
                          {row.status === 'open' ? 'Ανοιχτή' : 'Κλειστή'}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              )}

              {historyTab === 'km' && (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-6 py-5 border-b border-black/[0.04]">
                    <div className="rounded-2xl bg-surface-container-low p-4">
                      <div className="text-[11px] font-bold uppercase text-on-surface-variant">
                        Σύνολο (εμφάνιση)
                      </div>
                      <div className="text-xl font-bold text-on-surface mt-1">
                        {Number(displayKm || 0).toLocaleString('el-GR')} km
                      </div>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-4">
                      <div className="text-[11px] font-bold uppercase text-on-surface-variant">
                        Από GPS
                      </div>
                      <div className="text-xl font-bold text-on-surface mt-1">
                        {Number(summary.gps_total_km || 0).toLocaleString('el-GR')} km
                      </div>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-4">
                      <div className="text-[11px] font-bold uppercase text-on-surface-variant">
                        Από βάρδιες
                      </div>
                      <div className="text-xl font-bold text-on-surface mt-1">
                        {Number(summary.shift_km_total || 0).toLocaleString('el-GR')} km
                      </div>
                    </div>
                  </div>
                  <ul className="divide-y divide-black/[0.05]">
                    {(history.km_by_trip || []).length === 0 ? (
                      <li className="text-sm text-on-surface-variant text-center py-12">
                        Δεν υπάρχουν ακόμη GPS διαδρομές για αυτόν τον οδηγό.
                      </li>
                    ) : (
                      (history.km_by_trip || []).map((row) => (
                        <li
                          key={`${row.trip_id}-${row.first_at}`}
                          className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-bold text-on-surface">
                              Δρομολόγιο #{row.trip_id}
                            </div>
                            <div className="text-xs text-on-surface-variant mt-0.5">
                              {formatDateTime(row.first_at)} → {formatDateTime(row.last_at)}
                              {row.point_count ? ` · ${row.point_count} σημεία` : ''}
                            </div>
                          </div>
                          <div className="text-sm font-bold text-primary">
                            {Number(row.distance_km || 0).toLocaleString('el-GR')} km
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        <section className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-black/[0.05] flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-lg flex items-center gap-2 text-on-surface">
              <span className="material-symbols-outlined text-primary">smartphone</span>
              Λογαριασμός εφαρμογής λεωφορείου
            </h3>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                driver.has_password
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              {driver.has_password ? 'Έχει κωδικό' : 'Χωρίς κωδικό'}
            </span>
          </div>
          <form onSubmit={saveAppAccount} className="p-6 space-y-4">
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Ο οδηγός μπαίνει στην εφαρμογή στο{' '}
              <a href="/driver" target="_blank" rel="noreferrer" className="text-primary font-bold underline">
                /driver
              </a>{' '}
              με email, αριθμό άδειας ή πινακίδα και τον κωδικό που ορίζετε εδώ.
            </p>
            <div className="rounded-2xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-sky-700 mb-1">
                Όνομα χρήστη
              </div>
              <div className="font-mono font-bold text-sky-950 break-all">{driver.email}</div>
              <div className="text-xs text-sky-800/80 mt-1">
                Εναλλακτικά: {driver.license_no}
                {driver.license_plate ? ` · ${driver.license_plate}` : ''}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="font-bold text-on-surface">Νέος κωδικός</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder={driver.has_password ? 'Αφήστε κενό για να μείνει ίδιος' : 'Ορίστε κωδικό'}
                  className="mt-1 w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-on-surface">Επιβεβαίωση</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={appPasswordConfirm}
                  onChange={(e) => setAppPasswordConfirm(e.target.value)}
                  placeholder="Επαναλάβετε τον κωδικό"
                  className="mt-1 w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>
            <ImageDropField
              label="Φωτογραφία οδηγού"
              hint="Σύρετε φωτογραφία εδώ ή πατήστε για επιλογή"
              value={photoUrl}
              onChange={setPhotoUrl}
              onUpload={uploadDriverPhoto}
              disabled={savingAccount}
            />
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
                disabled={savingAccount}
                className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
              >
                {savingAccount ? 'Αποθήκευση…' : 'Αποθήκευση λογαριασμού'}
              </button>
              <a
                href="/driver"
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-full border border-black/[0.08] text-sm font-bold text-on-surface hover:bg-surface-container-low inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                Δοκιμή εφαρμογής
              </a>
            </div>
          </form>
        </section>

        {fleetVehicle && (
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[28px]">airport_shuttle</span>
              <div>
                <div className="text-sm font-bold text-on-surface">{fleetVehicle.name}</div>
                <div className="text-xs text-on-surface-variant">
                  Σύνδεση με όχημα στον στόλο · {fleetVehicle.licensePlate}
                </div>
              </div>
            </div>
            <Link
              to={`/admin/fleet/${fleetVehicle.id}`}
              className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Προφίλ οχήματος
            </Link>
          </div>
        )}

        <section className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between gap-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-on-surface">
              <span className="material-symbols-outlined text-primary">route</span>
              Ανατεθειμένες εκδρομές
            </h3>
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full">
              {assignedTrips.length}
            </span>
          </div>
          {assignedTrips.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-12">
              Δεν υπάρχουν εκδρομές με αυτόν τον οδηγό.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.05]">
              {assignedTrips.map((trip) => (
                <li key={trip.id}>
                  <Link
                    to={`/admin/trips/${trip.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-surface-container-low transition-colors"
                  >
                    <div>
                      <div className="font-bold text-on-surface">{trip.title}</div>
                      <div className="text-xs text-on-surface-variant mt-0.5">
                        {trip.departureTime
                          ? new Date(trip.departureTime).toLocaleString('el-GR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                        {trip.vehicleType && ` · ${trip.vehicleType}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-primary">
                        €{Number(trip.price || 0).toFixed(2)}
                      </span>
                      <span className="material-symbols-outlined text-gray-400 text-[20px]">
                        chevron_right
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
