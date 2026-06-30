import { useTelemetryAlerts } from '../../hooks/useTelemetryAlerts.js';

const ALERT_STYLES = {
  ROUTE_DEVIATION: {
    icon: 'wrong_location',
    className: 'bg-rose-50 border-rose-200 text-rose-800',
    label: 'Απόκλιση διαδρομής',
  },
  HARSH_BRAKING: {
    icon: 'warning',
    className: 'bg-amber-50 border-amber-200 text-amber-900',
    label: 'Απότομο φρενάρισμα',
  },
  HARSH_ACCELERATION: {
    icon: 'speed',
    className: 'bg-orange-50 border-orange-200 text-orange-900',
    label: 'Απότομη επιτάχυνση',
  },
  HARSH_CORNERING: {
    icon: 'turn_sharp_right',
    className: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    label: 'Σφιχτή στροφή',
  },
  SPEEDING: {
    icon: 'traffic',
    className: 'bg-purple-50 border-purple-200 text-purple-900',
    label: 'Υπερβολική ταχύτητα',
  },
  IDLE: {
    icon: 'hourglass_empty',
    className: 'bg-gray-50 border-gray-200 text-gray-700',
    label: 'Ρελαντί',
  },
  DRIVER_ONLINE: {
    icon: 'sensors',
    className: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    label: 'Οδηγός online',
  },
  DRIVER_OFFLINE: {
    icon: 'portable_wifi_off',
    className: 'bg-slate-50 border-slate-200 text-slate-700',
    label: 'Οδηγός offline',
  },
  SOS: {
    icon: 'emergency',
    className: 'bg-red-100 border-red-500 text-red-900 animate-pulse',
    label: 'SOS / PANIC',
  },
  BREAKDOWN: {
    icon: 'build',
    className: 'bg-orange-50 border-orange-300 text-orange-900',
    label: 'Βλάβη οχήματος',
  },
  ACCIDENT: {
    icon: 'car_crash',
    className: 'bg-rose-100 border-rose-400 text-rose-900',
    label: 'Ατύχημα',
  },
  DELAY: {
    icon: 'schedule',
    className: 'bg-amber-50 border-amber-300 text-amber-900',
    label: 'Καθυστέρηση',
  },
};

function styleFor(type) {
  return ALERT_STYLES[type] || {
    icon: 'notifications',
    className: 'bg-sky-50 border-sky-200 text-sky-900',
    label: type,
  };
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function TelemetryAlertsPanel() {
  const { alerts, loading, wsConnected } = useTelemetryAlerts();

  return (
    <section className="bg-white rounded-[28px] border border-black/[0.06] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500">shield</span>
            Ασφάλεια & Telematics
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Αποκλίσεις διαδρομής · οδηγική συμπεριφορά · live
          </p>
        </div>
        <div className="flex items-center gap-2">
          {wsConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live WS
            </span>
          ) : (
            <span className="text-xs text-gray-400 font-medium">Polling fallback</span>
          )}
          <span className="text-xs font-bold text-gray-500">{alerts.length} ειδοποιήσεις</span>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
        {loading && alerts.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">Φόρτωση ειδοποιήσεων…</p>
        ) : alerts.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">
            Καμία ενεργή ειδοποίηση. Στείλτε GPS ή harsh event για δοκιμή.
          </p>
        ) : (
          alerts.map((a) => {
            const st = styleFor(a.alert_type);
            const meta = a.metadata || {};
            return (
              <article key={a.id} className={`px-6 py-4 border-l-4 ${st.className.split(' ')[1]?.replace('border-', 'border-l-') || 'border-l-gray-300'}`}>
                <div className="flex gap-3">
                  <span className={`material-symbols-outlined shrink-0 mt-0.5 ${st.className.includes('rose') ? 'text-rose-600' : 'text-amber-600'}`}>
                    {st.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${st.className}`}>
                        {st.label}
                      </span>
                      <span className="text-xs text-gray-400">{formatTime(a.created_at)}</span>
                    </div>
                    <p className="font-medium text-gray-900 mt-1">{a.message}</p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">
                      {a.vehicle_id?.slice(0, 8)}…
                      {a.trip_id != null && ` · trip ${a.trip_id}`}
                      {meta.distance_outside_m != null && ` · +${Math.round(meta.distance_outside_m)}m`}
                      {meta.lat != null && meta.lng != null && (
                        <>
                          {` · GPS ${Number(meta.lat).toFixed(4)}, ${Number(meta.lng).toFixed(4)}`}
                          {meta.accuracy_m != null && ` (±${Math.round(meta.accuracy_m)}m)`}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
