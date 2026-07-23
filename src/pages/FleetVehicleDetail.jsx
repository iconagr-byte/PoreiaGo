import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../components/AdminLayout';
import {
  fetchFleetVehicle,
  fetchMaintenanceEvents,
  updateFleetVehicle,
} from '../services/platformApi.js';

const CATEGORIES = ['Luxury Coach', 'Premium Express', 'Standard', 'Van'];

function statusLabel(serviceStatus) {
  if (serviceStatus === 'Urgent') return 'Σε Service';
  if (serviceStatus === 'Warning') return 'Προειδοποίηση';
  return 'Ενεργό';
}

export default function FleetVehicleDetail() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const v = await fetchFleetVehicle(vehicleId);
      if (!v) {
        setVehicle(null);
        return;
      }
      setVehicle(v);
      setForm({
        make: v.make || '',
        model: v.model || '',
        plate_number: v.plate_number || '',
        year: v.year || new Date().getFullYear(),
        vin: v.vin || '',
        category: v.category || 'Standard',
        seat_count: v.seat_count || 49,
        current_odometer: v.current_odometer || 0,
        legal_deadline: v.legal_deadline || '',
        insurance_due_date: v.insurance_due_date || '',
        public_summary: v.public_summary || '',
        show_on_website: Boolean(v.show_on_website),
        service_interval_km: v.service_interval_km || 15000,
      });
      const ev = await fetchMaintenanceEvents(vehicleId);
      setEvents(ev);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης');
      setVehicle(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin' && !localStorage.getItem('saas_access_token')) {
      navigate('/admin/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, navigate]);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateFleetVehicle(vehicleId, {
        ...form,
        year: Number(form.year),
        seat_count: Number(form.seat_count),
        current_odometer: Number(form.current_odometer),
        service_interval_km: Number(form.service_interval_km),
        legal_deadline: form.legal_deadline || null,
        insurance_due_date: form.insurance_due_date || null,
      });
      setVehicle(updated);
      setEditing(false);
      toast.success('Το προφίλ ενημερώθηκε');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">Φόρτωση προφίλ…</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-on-surface-variant mb-4">Δεν βρέθηκε όχημα με ID {vehicleId}</p>
          <Link to="/admin" state={{ activeTab: 'fleet' }} className="text-primary font-bold">
            Επιστροφή στον Στόλο
          </Link>
        </div>
      </div>
    );
  }

  const isVan = String(vehicle.category || '').toLowerCase().includes('van');
  const kmLeft = Number(vehicle.km_to_service ?? 0);
  const threshold = Number(vehicle.next_service_threshold || vehicle.current_odometer || 1);
  const serviceProgress = Math.max(
    0,
    Math.min(100, (Number(vehicle.current_odometer || 0) / threshold) * 100),
  );

  const header = (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/admin', { state: { activeTab: 'fleet' } })}
          className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high transition-colors"
          aria-label="Επιστροφή στον στόλο"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-md font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            {isVan ? 'airport_shuttle' : 'directions_bus'}
          </span>
          Προφίλ Οχήματος
        </h1>
      </div>
      <button
        type="button"
        onClick={() => setEditing((x) => !x)}
        className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold"
      >
        {editing ? 'Ακύρωση' : 'Επεξεργασία'}
      </button>
    </div>
  );

  return (
    <AdminLayout activeTab="fleet" title={header}>
      <div className="max-w-container-max mx-auto pb-16 space-y-8">
        <div className="bg-white rounded-[32px] border border-black/[0.05] shadow-sm p-8">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-28 h-28 rounded-2xl bg-surface-container-low text-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[56px]">
                {isVan ? 'airport_shuttle' : 'directions_bus'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {vehicle.make} {vehicle.model}
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                    vehicle.service_status === 'OK'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {statusLabel(vehicle.service_status)}
                </span>
              </div>
              <p className="text-sm font-mono text-gray-500 mb-6">
                {vehicle.plate_number} · ID: {vehicle.id}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Κατηγορία</div>
                  <div className="font-bold text-gray-900">{vehicle.category}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Θέσεις</div>
                  <div className="font-bold text-gray-900">{vehicle.seat_count}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Χιλιόμετρα</div>
                  <div className="font-bold text-gray-900">
                    {Number(vehicle.current_odometer || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Έτος</div>
                  <div className="font-bold text-gray-900">{vehicle.year}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-surface-container-low rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase mb-1">ΚΤΕΟ</div>
              <div className="font-bold text-gray-900">{vehicle.legal_deadline || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase mb-1">Ασφάλεια</div>
              <div className="font-bold text-gray-900">{vehicle.insurance_due_date || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase mb-1">Τελευταίο service</div>
              <div className="font-bold text-gray-900">{vehicle.last_service_date || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase mb-1">Έως επόμενο</div>
              <div className="font-bold text-gray-900">{kmLeft.toLocaleString()} km</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
              <span>Πρόοδος προς service</span>
              <span>{Math.round(serviceProgress)}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${kmLeft < 2000 ? 'bg-rose-500' : 'bg-primary'}`}
                style={{ width: `${serviceProgress}%` }}
              />
            </div>
          </div>
        </div>

        {editing && form && (
          <form
            onSubmit={onSave}
            className="bg-white rounded-[32px] border p-6 grid sm:grid-cols-2 gap-4"
          >
            <h3 className="sm:col-span-2 font-bold text-lg">Επεξεργασία στοιχείων</h3>
            {[
              ['make', 'Μάρκα'],
              ['model', 'Μοντέλο'],
              ['plate_number', 'Πινακίδα'],
              ['vin', 'VIN'],
            ].map(([key, label]) => (
              <label key={key} className="text-sm font-bold text-gray-700">
                {label}
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  required={key !== 'vin'}
                />
              </label>
            ))}
            <label className="text-sm font-bold text-gray-700">
              Κατηγορία
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-gray-700">
              Έτος
              <input
                type="number"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              />
            </label>
            <label className="text-sm font-bold text-gray-700">
              Θέσεις
              <input
                type="number"
                min={8}
                max={80}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.seat_count}
                onChange={(e) => setForm((f) => ({ ...f, seat_count: e.target.value }))}
              />
            </label>
            <label className="text-sm font-bold text-gray-700">
              Χιλιόμετρα
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.current_odometer}
                onChange={(e) => setForm((f) => ({ ...f, current_odometer: e.target.value }))}
              />
            </label>
            <label className="text-sm font-bold text-gray-700">
              ΚΤΕΟ έως
              <input
                type="date"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.legal_deadline || ''}
                onChange={(e) => setForm((f) => ({ ...f, legal_deadline: e.target.value }))}
              />
            </label>
            <label className="text-sm font-bold text-gray-700">
              Ασφάλεια έως
              <input
                type="date"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.insurance_due_date || ''}
                onChange={(e) => setForm((f) => ({ ...f, insurance_due_date: e.target.value }))}
              />
            </label>
            <label className="text-sm font-bold text-gray-700 sm:col-span-2">
              Περιγραφή website
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.public_summary}
                onChange={(e) => setForm((f) => ({ ...f, public_summary: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.show_on_website}
                onChange={(e) => setForm((f) => ({ ...f, show_on_website: e.target.checked }))}
              />
              Εμφάνιση στην ιστοσελίδα
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση αλλαγών'}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-[32px] border p-6">
          <h3 className="font-bold text-lg mb-4">Ιστορικό service</h3>
          <div className="space-y-3">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="font-bold text-gray-900">
                  {ev.service_type} · €{Number(ev.cost || 0).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {ev.event_date} · {ev.mileage?.toLocaleString?.() || ev.mileage} km ·{' '}
                  {ev.shop_or_mechanic || '—'}
                </div>
                {ev.description && <p className="text-sm text-gray-600 mt-2">{ev.description}</p>}
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-sm text-gray-500">Δεν υπάρχουν καταγεγραμμένα συμβάντα.</p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
