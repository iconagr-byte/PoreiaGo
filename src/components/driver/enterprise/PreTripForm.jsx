/**
 * Module 2 — Pre-Trip Inspection (mandatory safety checklist).
 * Blocks shift start until all items pass.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { submitPreTripInspection } from '../../../services/driverPortalApi.js';
import { getDriverSession } from '../../../lib/driver/driverSession.js';

const ITEMS = [
  { key: 'tires', label: 'Ελαστικά / πιέσεις OK' },
  { key: 'lights', label: 'Φώτα & φανάρια' },
  { key: 'oil', label: 'Έλαιο / υγρά' },
  { key: 'cabin_cleanliness', label: 'Καθαριότητα καμπίνας' },
];

export default function PreTripForm({ onComplete }) {
  const [checked, setChecked] = useState({});
  const session = getDriverSession();

  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  const allDone = ITEMS.every((i) => checked[i.key]);

  const submit = async () => {
    const items = Object.fromEntries(ITEMS.map((i) => [i.key, checked[i.key] ? 'pass' : 'fail']));
    const res = await submitPreTripInspection(items);
    if (res.status === 'blocked') {
      toast.error('Υπάρχουν αποτυχημένα στοιχεία — επικοινωνήστε με το γραφείο');
      return;
    }
    toast.success('Έλεγχος ασφαλείας ολοκληρώθηκε');
    onComplete?.(res);
  };

  return (
    <div className="driver-stack">
      <div className="driver-card driver-card-accent">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-[var(--driver-yellow)]">
            fact_check
          </span>
          <div>
            <h2 className="text-lg font-extrabold">Έλεγχος πριν την εκκίνηση</h2>
            <p className="text-sm text-[var(--driver-muted)] mt-0.5">
              Υποχρεωτικό — βάρδια #{session?.tripId}
            </p>
          </div>
        </div>
      </div>

      {ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => toggle(item.key)}
          className={`driver-touch w-full flex items-center gap-4 p-4 rounded-2xl border text-left min-h-[72px] transition-colors ${
            checked[item.key]
              ? 'border-[var(--driver-success)]/60 bg-green-50'
              : 'border-[var(--driver-border)] bg-[var(--driver-surface)]'
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
        className="driver-touch driver-btn-primary w-full rounded-2xl min-h-[56px] text-lg disabled:opacity-40"
      >
        Start Shift / Έναρξη βάρδιας
      </button>
    </div>
  );
}
