import { useState } from 'react';
import toast from 'react-hot-toast';
import { createFleetVehicle } from '../../services/platformApi.js';

const CATEGORIES = [
  { id: 'Luxury Coach', label: 'Luxury Coach', seats: 50 },
  { id: 'Premium Express', label: 'Premium Express', seats: 32 },
  { id: 'Standard', label: 'Standard Coach', seats: 55 },
  { id: 'Van', label: 'Van / Minibus', seats: 9 },
];

const EMPTY = {
  make: '',
  model: '',
  plate_number: '',
  year: new Date().getFullYear(),
  vin: '',
  current_odometer: 0,
  category: 'Standard',
  seat_count: 55,
  show_on_website: true,
  public_summary: '',
};

export default function AddFleetVehicleModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onCategory = (category) => {
    const meta = CATEGORIES.find((c) => c.id === category) || CATEGORIES[2];
    setForm((f) => ({ ...f, category, seat_count: meta.seats }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.make.trim() || !form.model.trim() || !form.plate_number.trim()) {
      toast.error('Συμπλήρωσε μάρκα, μοντέλο και πινακίδα');
      return;
    }
    if (!form.vin.trim() || form.vin.trim().length < 8) {
      toast.error('Το VIN πρέπει να έχει τουλάχιστον 8 χαρακτήρες');
      return;
    }
    setSaving(true);
    try {
      const vehicle = await createFleetVehicle({
        make: form.make.trim(),
        model: form.model.trim(),
        plate_number: form.plate_number.trim().toUpperCase(),
        year: Number(form.year),
        vin: form.vin.trim().toUpperCase(),
        current_odometer: Number(form.current_odometer) || 0,
        category: form.category,
        seat_count: Number(form.seat_count) || 9,
        show_on_website: Boolean(form.show_on_website),
        public_summary: form.public_summary.trim(),
      });
      toast.success(`Προστέθηκε: ${vehicle.make} ${vehicle.model}`);
      setForm(EMPTY);
      onCreated?.(vehicle);
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία προσθήκης οχήματος');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg bg-white rounded-[28px] shadow-xl border border-black/[0.06] overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-900">Νέο όχημα</h3>
            <p className="text-xs text-gray-500 mt-0.5">Λεωφορείο, coach ή van στον στόλο σου</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategory(c.id)}
                className={`rounded-2xl border px-3 py-3 text-left text-sm font-bold transition-colors ${
                  form.category === c.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-black/[0.08] text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] block mb-1">
                  {c.id === 'Van' ? 'airport_shuttle' : 'directions_bus'}
                </span>
                {c.label}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Μάρκα</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                placeholder="Mercedes / Ford"
                value={form.make}
                onChange={(e) => setField('make', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Μοντέλο</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                placeholder="Tourismo / Transit"
                value={form.model}
                onChange={(e) => setField('model', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Πινακίδα</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 font-mono uppercase"
                placeholder="ΧΑΗ-1234"
                value={form.plate_number}
                onChange={(e) => setField('plate_number', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Έτος</span>
              <input
                type="number"
                min={1990}
                max={2100}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.year}
                onChange={(e) => setField('year', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-bold text-gray-700">VIN</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 font-mono uppercase"
                placeholder="Τουλάχιστον 8 χαρακτήρες"
                value={form.vin}
                onChange={(e) => setField('vin', e.target.value)}
                required
                minLength={8}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Χιλιόμετρα</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.current_odometer}
                onChange={(e) => setField('current_odometer', e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Θέσεις</span>
              <input
                type="number"
                min={8}
                max={80}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.seat_count}
                onChange={(e) => setField('seat_count', e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-bold text-gray-700">Σύντομη περιγραφή (website)</span>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                placeholder="π.χ. Van 9 θέσεων για transfers"
                value={form.public_summary}
                onChange={(e) => setField('public_summary', e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.show_on_website}
                onChange={(e) => setField('show_on_website', e.target.checked)}
              />
              Εμφάνιση στην ιστοσελίδα γραφείου
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-black/[0.05] flex justify-end gap-2 bg-gray-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-100"
          >
            Ακύρωση
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-60"
          >
            {saving ? 'Αποθήκευση…' : 'Προσθήκη οχήματος'}
          </button>
        </div>
      </form>
    </div>
  );
}
