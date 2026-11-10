import { newClientId } from '../../../lib/hybrid/costYieldCalculator.js';
import { formatMoney } from '../../../lib/currency/multiCurrency.js';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400';

function emptyRoom(overrides = {}) {
  return {
    id: newClientId('room'),
    room_number: '',
    room_type: 'twin',
    passenger_name: '',
    hotel_name: '',
    notes: '',
    ...overrides,
  };
}

function emptyExtra(overrides = {}) {
  return {
    id: newClientId('xtra'),
    passenger_name: '',
    type: 'insurance',
    label: '',
    amount: 0,
    currency: 'EUR',
    notes: '',
    ...overrides,
  };
}

const EXTRA_TYPES = [
  { value: 'insurance', label: 'Ασφάλεια' },
  { value: 'seat', label: 'Θέα / έξτρα θέση' },
  { value: 'child_seat', label: 'Παιδικό κάθισμα' },
  { value: 'luggage', label: 'Έξτρα αποσκευή' },
  { value: 'other', label: 'Άλλο' },
];

export default function HybridRoomingExtras({ formData, setFormData }) {
  const rooms = formData.roomingList || [];
  const extras = formData.passengerExtras || [];
  const currency = formData.currency || 'EUR';

  const patch = (partial) => setFormData((prev) => ({ ...prev, ...partial }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Rooming list</p>
          <button
            type="button"
            onClick={() => patch({ roomingList: [...rooms, emptyRoom({ hotel_name: formData.destination || '' })] })}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
          >
            + Δωμάτιο
          </button>
        </div>
        {rooms.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-4 border border-dashed border-slate-200 rounded-xl">
            Προσθέστε δωμάτια ξενοδοχείου δίπλα στο manifest.
          </p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((r) => (
              <li key={r.id} className="grid sm:grid-cols-5 gap-2 rounded-xl border border-slate-200 p-2">
                <input className={fieldClass} placeholder="Hotel" value={r.hotel_name || ''} onChange={(e) => patch({ roomingList: rooms.map((x) => (x.id === r.id ? { ...x, hotel_name: e.target.value } : x)) })} />
                <input className={fieldClass} placeholder="Δωμάτιο" value={r.room_number || ''} onChange={(e) => patch({ roomingList: rooms.map((x) => (x.id === r.id ? { ...x, room_number: e.target.value } : x)) })} />
                <select className={fieldClass} value={r.room_type || 'twin'} onChange={(e) => patch({ roomingList: rooms.map((x) => (x.id === r.id ? { ...x, room_type: e.target.value } : x)) })}>
                  <option value="single">Single</option>
                  <option value="twin">Twin</option>
                  <option value="double">Double</option>
                  <option value="triple">Triple</option>
                  <option value="family">Family</option>
                </select>
                <input className={fieldClass} placeholder="Επιβάτης" value={r.passenger_name || ''} onChange={(e) => patch({ roomingList: rooms.map((x) => (x.id === r.id ? { ...x, passenger_name: e.target.value } : x)) })} />
                <button type="button" className="text-rose-600 text-xs font-bold" onClick={() => patch({ roomingList: rooms.filter((x) => x.id !== r.id) })}>Διαγραφή</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Insurance / extras</p>
          <button
            type="button"
            onClick={() => patch({ passengerExtras: [...extras, emptyExtra({ currency })] })}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
          >
            + Extra
          </button>
        </div>
        {extras.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-4 border border-dashed border-slate-200 rounded-xl">
            Ασφάλεια, παιδικό κάθισμα, θέα κ.λπ. ανά επιβάτη.
          </p>
        ) : (
          <ul className="space-y-2">
            {extras.map((ex) => (
              <li key={ex.id} className="grid sm:grid-cols-5 gap-2 rounded-xl border border-slate-200 p-2">
                <input className={fieldClass} placeholder="Επιβάτης" value={ex.passenger_name || ''} onChange={(e) => patch({ passengerExtras: extras.map((x) => (x.id === ex.id ? { ...x, passenger_name: e.target.value } : x)) })} />
                <select className={fieldClass} value={ex.type} onChange={(e) => patch({ passengerExtras: extras.map((x) => (x.id === ex.id ? { ...x, type: e.target.value } : x)) })}>
                  {EXTRA_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input className={fieldClass} placeholder="Περιγραφή" value={ex.label || ''} onChange={(e) => patch({ passengerExtras: extras.map((x) => (x.id === ex.id ? { ...x, label: e.target.value } : x)) })} />
                <input type="number" min="0" step="0.01" className={fieldClass} value={ex.amount ?? 0} onChange={(e) => patch({ passengerExtras: extras.map((x) => (x.id === ex.id ? { ...x, amount: e.target.value } : x)) })} />
                <button type="button" className="text-rose-600 text-xs font-bold" onClick={() => patch({ passengerExtras: extras.filter((x) => x.id !== ex.id) })}>Διαγραφή</button>
              </li>
            ))}
          </ul>
        )}
        {extras.length > 0 ? (
          <p className="text-xs text-slate-500">
            Σύνολο extras:{' '}
            {formatMoney(
              extras.reduce((s, e) => s + (Number(e.amount) || 0), 0),
              currency,
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
