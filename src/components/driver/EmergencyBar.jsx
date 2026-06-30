import { useState } from 'react';
import { reportDriverIssue, triggerSos } from '../../services/driverPortalApi.js';
import toast from 'react-hot-toast';

const ISSUE_TYPES = [
  { id: 'breakdown', label: 'Βλάβη', icon: 'build' },
  { id: 'accident', label: 'Ατύχημα', icon: 'car_crash' },
  { id: 'delay', label: 'Καθυστέρηση', icon: 'schedule' },
];

export default function EmergencyBar() {
  const [showIssues, setShowIssues] = useState(false);
  const [sosSent, setSosSent] = useState(false);

  const handleSos = async () => {
    if (!window.confirm('Εκτάκτως SOS προς το κεντρικό γραφείο;')) return;
    const res = await triggerSos();
    setSosSent(true);
    toast.success(res.message);
  };

  const report = async (type) => {
    const res = await reportDriverIssue({ type, at: new Date().toISOString() });
    toast.success(`Αναφορά καταχωρήθηκε #${res.ticketId}`);
    setShowIssues(false);
  };

  return (
    <div className="p-4 pb-28 space-y-4">
      <button type="button" onClick={handleSos} className="driver-touch driver-btn-danger driver-sos w-full rounded-2xl">
        <span className="material-symbols-outlined align-middle mr-2 text-3xl">emergency</span>
        SOS / PANIC
      </button>
      {sosSent && <p className="text-center text-red-400 text-sm">Σήμα εστάλη — περιμένετε επικοινωνία</p>}

      <button
        type="button"
        onClick={() => setShowIssues(!showIssues)}
        className="driver-touch w-full bg-neutral-800 border-2 border-neutral-600 text-white rounded-2xl"
      >
        <span className="material-symbols-outlined align-middle mr-2">report</span>
        Αναφορά προβλήματος
      </button>

      {showIssues && (
        <div className="grid gap-3">
          {ISSUE_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => report(t.id)}
              className="driver-touch driver-card flex items-center gap-4 text-left w-full"
            >
              <span className="material-symbols-outlined text-4xl text-[#facc15]">{t.icon}</span>
              <span className="text-xl font-bold">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
