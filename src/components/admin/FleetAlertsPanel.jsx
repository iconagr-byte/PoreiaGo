import toast from 'react-hot-toast';
import { resolveFleetAlert } from '../../services/platformApi.js';

const SEVERITY_STYLES = {
  urgent: 'bg-rose-100 text-rose-800 border-rose-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
};

export default function FleetAlertsPanel({
  alerts,
  onResolved,
  onSelectVehicle,
}) {
  if (!alerts?.length) {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.05] p-6 text-center text-sm text-gray-500">
        <span className="material-symbols-outlined text-[32px] text-emerald-500 block mb-2">check_circle</span>
        Δεν υπάρχουν ανοιχτές προειδοποιήσεις στόλου.
      </div>
    );
  }

  const handleResolve = async (alertId) => {
    try {
      await resolveFleetAlert(alertId);
      toast.success('Η ειδοποίηση επιλύθηκε');
      onResolved?.();
    } catch (e) {
      toast.error(e.message || 'Αποτυχία επίλυσης');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-600">notifications_active</span>
          Προειδοποιήσεις στόλου
          <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </h3>
      </div>
      <ul className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
        {alerts.map((alert) => {
          const sev = (alert.severity || 'warning').toLowerCase();
          const style = SEVERITY_STYLES[sev] || SEVERITY_STYLES.warning;
          const created = alert.created_at
            ? new Date(alert.created_at).toLocaleString('el-GR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })
            : '—';

          return (
            <li key={alert.id} className="p-4 hover:bg-gray-50/80 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${style}`}>
                      {sev}
                    </span>
                    <span className="text-xs font-mono text-gray-500">{alert.plate_number}</span>
                    {alert.kind === 'dispatch_blocked' && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        Κράτηση
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{alert.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{created}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {alert.vehicle_id && alert.vehicle_id !== 'unknown' && (
                    <button
                      type="button"
                      onClick={() => onSelectVehicle?.(alert.vehicle_id)}
                      className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-bold hover:bg-gray-100"
                    >
                      Όχημα
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleResolve(alert.id)}
                    className="px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold hover:opacity-90"
                  >
                    Επίλυση
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
