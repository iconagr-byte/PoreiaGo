import toast from 'react-hot-toast';
import { resolveFleetAlert } from '../../services/platformApi.js';
import '../../styles/fleet-admin-apple.css';

export default function FleetAlertsPanel({
  alerts,
  onResolved,
  onSelectVehicle,
}) {
  if (!alerts?.length) {
    return (
      <div className="fleet-mgmt-apple">
        <div className="fleet-mgmt-alerts">
          <div className="fleet-mgmt-alerts__empty">
            <span className="material-symbols-outlined" aria-hidden="true">
              check_circle
            </span>
            <p>Δεν υπάρχουν ανοιχτές προειδοποιήσεις στόλου.</p>
          </div>
        </div>
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
    <div className="fleet-mgmt-apple">
      <div className="fleet-mgmt-alerts">
        <div className="fleet-mgmt-alerts__head">
          <h3>
            <span className="material-symbols-outlined" aria-hidden="true">
              notifications_active
            </span>
            Προειδοποιήσεις
            <span className="fleet-mgmt-alerts__count">{alerts.length}</span>
          </h3>
        </div>
        <ul className="fleet-mgmt-alerts__list">
          {alerts.map((alert) => {
            const sev = (alert.severity || 'warning').toLowerCase();
            const created = alert.created_at
              ? new Date(alert.created_at).toLocaleString('el-GR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : '—';

            return (
              <li key={alert.id} className="fleet-mgmt-alerts__item">
                <div className="min-w-0 flex-1">
                  <div className="fleet-mgmt-alerts__meta">
                    <span
                      className={`fleet-mgmt-alerts__sev${sev === 'urgent' ? ' is-urgent' : ''}`}
                    >
                      {sev === 'urgent' ? 'Επείγον' : 'Προειδοποίηση'}
                    </span>
                    <span className="fleet-mgmt-alerts__plate">{alert.plate_number}</span>
                    {alert.kind === 'dispatch_blocked' ? (
                      <span className="fleet-mgmt-alerts__sev">Κράτηση</span>
                    ) : null}
                  </div>
                  <p className="fleet-mgmt-alerts__title">{alert.title}</p>
                  <p className="fleet-mgmt-alerts__msg">{alert.message}</p>
                  <p className="fleet-mgmt-alerts__time">{created}</p>
                </div>
                <div className="fleet-mgmt-alerts__actions">
                  {alert.vehicle_id && alert.vehicle_id !== 'unknown' ? (
                    <button
                      type="button"
                      className="fleet-mgmt-btn"
                      onClick={() => onSelectVehicle?.(alert.vehicle_id)}
                    >
                      Όχημα
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="fleet-mgmt-btn fleet-mgmt-btn--accent"
                    onClick={() => handleResolve(alert.id)}
                  >
                    Επίλυση
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
