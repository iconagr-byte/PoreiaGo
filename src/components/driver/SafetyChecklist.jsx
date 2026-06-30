import { useState } from 'react';
import { submitSafetyChecklist } from '../../services/driverPortalApi.js';
import { getDriverSession } from '../../lib/driver/driverSession.js';
import toast from 'react-hot-toast';

const ITEMS = [
  { key: 'tires', label: 'Ελαστικά / πιέσεις OK' },
  { key: 'sanitized', label: 'Απολύμανση εσωτερικού' },
  { key: 'fire_ext', label: 'Πυροσβεστήρας' },
  { key: 'first_aid', label: 'Φαρμακείο' },
  { key: 'exits', label: 'Έξοδοι κινδύνου' },
  { key: 'lights', label: 'Φώτα & A/C' },
];

export default function SafetyChecklist({ onComplete }) {
  const [checked, setChecked] = useState({});
  const session = getDriverSession();

  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  const allDone = ITEMS.every((i) => checked[i.key]);

  const submit = async () => {
    const items = Object.fromEntries(ITEMS.map((i) => [i.key, checked[i.key] ? 'pass' : 'fail']));
    await submitSafetyChecklist(null, items);
    toast.success('Έλεγχος ασφαλείας ολοκληρώθηκε');
    onComplete?.();
  };

  return (
    <div className="p-4 pb-28 space-y-4">
      <div className="driver-card border-amber-500">
        <h2 className="text-xl font-bold text-[#facc15]">Υποχρεωτικός έλεγχος</h2>
        <p className="text-neutral-400 mt-2">Πριν εκκινήσετε — Trip #{session?.tripId}</p>
      </div>

      {ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => toggle(item.key)}
          className={`driver-touch w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left ${
            checked[item.key] ? 'border-[#22c55e] bg-green-950/30' : 'border-neutral-600 bg-neutral-900'
          }`}
        >
          <span className="material-symbols-outlined text-4xl">
            {checked[item.key] ? 'check_box' : 'check_box_outline_blank'}
          </span>
          <span className="text-lg font-bold">{item.label}</span>
        </button>
      ))}

      <button
        type="button"
        disabled={!allDone}
        onClick={submit}
        className="driver-touch driver-btn-primary w-full rounded-2xl disabled:opacity-40"
      >
        Ολοκλήρωση & εκκίνηση
      </button>
    </div>
  );
}
