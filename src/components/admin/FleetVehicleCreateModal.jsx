import { useMemo, useState } from 'react';

export const FLEET_VEHICLE_CATEGORIES = [
  { value: 'Standard', label: 'Λεωφορείο · Standard', seats: 55 },
  { value: 'Luxury Coach', label: 'Λεωφορείο · Luxury Coach', seats: 50 },
  { value: 'Premium Express', label: 'Λεωφορείο · Premium Express', seats: 32 },
  { value: 'Van', label: 'Van', seats: 9 },
  { value: 'VIP Minibus', label: 'Minibus · VIP', seats: 16 },
];

const emptyForm = () => ({
  make: '',
  model: '',
  plate_number: '',
  year: new Date().getFullYear(),
  vin: '',
  category: 'Standard',
  seat_count: 55,
  current_odometer: 0,
});

export function fleetVehicleIcon(category) {
  const c = String(category || '').toLowerCase();
  if (c.includes('van') || c.includes('minibus')) return 'airport_shuttle';
  return 'directions_bus';
}

/**
 * Modal for creating a fleet vehicle (bus / van / minibus).
 */
export default function FleetVehicleCreateModal({ open, onClose, onSubmit, saving = false }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const categoryMeta = useMemo(
    () => FLEET_VEHICLE_CATEGORIES.find((c) => c.value === form.category) || FLEET_VEHICLE_CATEGORIES[0],
    [form.category],
  );

  if (!open) return null;

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCategory = (value) => {
    const meta = FLEET_VEHICLE_CATEGORIES.find((c) => c.value === value);
    setForm((prev) => ({
      ...prev,
      category: value,
      seat_count: meta?.seats ?? prev.seat_count,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({
        make: form.make.trim(),
        model: form.model.trim(),
        plate_number: form.plate_number.trim().toUpperCase(),
        year: Number(form.year),
        vin: form.vin.trim().toUpperCase(),
        category: form.category,
        seat_count: Number(form.seat_count),
        current_odometer: Number(form.current_odometer || 0),
      });
      setForm(emptyForm());
    } catch (err) {
      setError(err.message || 'Αποτυχία εισαγωγής');
    }
  };

  return (
    <div className="fixed inset-0 z-[210] bg-black/40 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[24px] p-6 w-full max-w-2xl space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-bold text-gray-900">Εισαγωγή οχήματος</h4>
            <p className="text-sm text-gray-500 mt-0.5">Λεωφορείο, van ή minibus στον στόλο</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError('');
              onClose();
            }}
            className="text-gray-500 hover:text-gray-900"
            aria-label="Κλείσιμο"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm font-medium text-gray-700 md:col-span-2">
            Τύπος οχήματος
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.category}
              onChange={(e) => handleCategory(e.target.value)}
              disabled={saving}
            >
              {FLEET_VEHICLE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Μάρκα
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.make}
              onChange={(e) => setField('make', e.target.value)}
              placeholder="π.χ. Mercedes"
              required
              minLength={2}
              disabled={saving}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Μοντέλο
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.model}
              onChange={(e) => setField('model', e.target.value)}
              placeholder={categoryMeta.value === 'Van' ? 'π.χ. Sprinter' : 'π.χ. Tourismo'}
              required
              disabled={saving}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Πινακίδα
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 font-mono uppercase"
              value={form.plate_number}
              onChange={(e) => setField('plate_number', e.target.value)}
              placeholder="π.χ. XAH-4021"
              required
              minLength={4}
              disabled={saving}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Έτος
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="number"
              min={1990}
              max={2100}
              value={form.year}
              onChange={(e) => setField('year', e.target.value)}
              required
              disabled={saving}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            VIN
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 font-mono uppercase"
              value={form.vin}
              onChange={(e) => setField('vin', e.target.value)}
              placeholder="Τουλάχιστον 8 χαρακτήρες"
              required
              minLength={8}
              disabled={saving}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Θέσεις
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="number"
              min={2}
              max={80}
              value={form.seat_count}
              onChange={(e) => setField('seat_count', e.target.value)}
              required
              disabled={saving}
            />
          </label>
          <label className="text-sm font-medium text-gray-700 md:col-span-2">
            Τρέχοντα χιλιόμετρα
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="number"
              min={0}
              value={form.current_odometer}
              onChange={(e) => setField('current_odometer', e.target.value)}
              disabled={saving}
            />
          </label>
        </div>

        {error ? (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setError('');
              onClose();
            }}
            className="px-4 py-2 rounded-full border font-bold text-sm"
            disabled={saving}
          >
            Άκυρο
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-primary text-white font-bold text-sm disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση οχήματος'}
          </button>
        </div>
      </form>
    </div>
  );
}
