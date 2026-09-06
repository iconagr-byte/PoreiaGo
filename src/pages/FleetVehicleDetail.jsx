import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../components/AdminLayout';
import {
  fetchFleetVehicle,
  fetchMaintenanceEvents,
  updateFleetVehicle,
  uploadFleetVehiclePhoto,
} from '../services/platformApi.js';
import { resolveSiteAssetUrl } from '../services/siteAppearanceApi.js';

const CATEGORIES = ['Luxury Coach', 'Premium Express', 'Standard', 'Van'];

const AMENITY_PRESETS = [
  'Wi-Fi onboard',
  'USB θύρες',
  'USB & 220V',
  'Κλιματισμός',
  'Θέρμανση',
  'Ανακλινόμενα καθίσματα',
  'Ανακλινόμενα leather seats',
  'WC onboard',
  'Ψυγείο',
  'Mini bar',
  'Αποσκευές',
  'Ευέλικτες θέσεις',
  'Μεγάλοι αποθηκευτικοί χώροι',
];

function statusLabel(serviceStatus) {
  if (serviceStatus === 'Urgent') return 'Σε Service';
  if (serviceStatus === 'Warning') return 'Προειδοποίηση';
  return 'Ενεργό';
}

function galleryFrom(vehicle) {
  const urls = [];
  for (const u of vehicle?.gallery_urls || []) {
    if (u && !urls.includes(u)) urls.push(u);
  }
  if (vehicle?.public_image_url && !urls.includes(vehicle.public_image_url)) {
    urls.unshift(vehicle.public_image_url);
  }
  return urls.filter((u) => u && !String(u).includes('hero-bus-achillio'));
}

export default function FleetVehicleDetail() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [vehicle, setVehicle] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
        purchase_price: v.purchase_price || 0,
        amenities: Array.isArray(v.amenities) ? [...v.amenities] : [],
        public_image_url: v.public_image_url || '',
        gallery_urls: galleryFrom(v),
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
        purchase_price: Number(form.purchase_price),
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

  const onPickPhotos = async (fileList) => {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(fileList).slice(0, 8)) {
        const res = await uploadFleetVehiclePhoto(file);
        if (res?.url) uploaded.push(res.url);
      }
      if (!uploaded.length) throw new Error('Δεν ανέβηκε καμία φωτογραφία');
      const existing = galleryFrom(vehicle);
      const gallery_urls = [...existing, ...uploaded.filter((u) => !existing.includes(u))];
      const public_image_url = vehicle.public_image_url || uploaded[0];
      const updated = await updateFleetVehicle(vehicleId, { gallery_urls, public_image_url });
      setVehicle(updated);
      setForm((f) =>
        f
          ? {
              ...f,
              gallery_urls,
              public_image_url,
            }
          : f,
      );
      toast.success(
        uploaded.length > 1 ? `Προστέθηκαν ${uploaded.length} φωτογραφίες` : 'Προστέθηκε φωτογραφία',
      );
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setCover = async (url) => {
    try {
      const updated = await updateFleetVehicle(vehicleId, { public_image_url: url });
      setVehicle(updated);
      toast.success('Ορίστηκε ως κύρια φωτογραφία');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removePhoto = async (url) => {
    const next = galleryFrom(vehicle).filter((u) => u !== url);
    const public_image_url =
      vehicle.public_image_url === url ? next[0] || '' : vehicle.public_image_url || '';
    try {
      const updated = await updateFleetVehicle(vehicleId, {
        gallery_urls: next,
        public_image_url,
      });
      setVehicle(updated);
      toast.success('Η φωτογραφία αφαιρέθηκε');
    } catch (err) {
      toast.error(err.message);
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
  const cover = galleryFrom(vehicle)[0]
    ? resolveSiteAssetUrl(vehicle.public_image_url || galleryFrom(vehicle)[0])
    : '';

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
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 rounded-full border text-sm font-bold disabled:opacity-50"
        >
          {uploading ? 'Ανέβασμα…' : 'Φωτογραφίες'}
        </button>
        <button
          type="button"
          onClick={() => setEditing((x) => !x)}
          className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold"
        >
          {editing ? 'Ακύρωση' : 'Παραμετροποίηση'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onPickPhotos(e.target.files)}
        />
      </div>
    </div>
  );

  return (
    <AdminLayout activeTab="fleet" title={header}>
      <div className="max-w-container-max mx-auto pb-16 space-y-8">
        <div className="bg-white rounded-[32px] border border-black/[0.05] shadow-sm overflow-hidden">
          <div className="relative aspect-[21/9] max-h-72 bg-slate-100">
            {cover ? (
              <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[72px]">
                  {isVan ? 'airport_shuttle' : 'directions_bus'}
                </span>
              </div>
            )}
          </div>
          <div className="p-6 sm:p-8">
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
            <p className="text-sm font-mono text-gray-500 mb-4">
              {vehicle.plate_number} · ID: {vehicle.id}
            </p>

            {galleryFrom(vehicle).length > 0 ? (
              <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
                {galleryFrom(vehicle).map((url) => {
                  const src = resolveSiteAssetUrl(url);
                  const isCover = url === vehicle.public_image_url;
                  return (
                    <div
                      key={url}
                      className={`relative w-24 h-16 rounded-xl overflow-hidden border shrink-0 ${
                        isCover ? 'border-sky-500 ring-2 ring-sky-200' : 'border-black/[0.08]'
                      }`}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/40 flex items-center justify-center gap-1 transition-opacity">
                        {!isCover ? (
                          <button
                            type="button"
                            onClick={() => setCover(url)}
                            className="p-1 rounded-full bg-white/90"
                            title="Κύρια"
                          >
                            <span className="material-symbols-outlined text-[16px]">star</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removePhoto(url)}
                          className="p-1 rounded-full bg-white/90 text-rose-700"
                          title="Αφαίρεση"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

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
                  {Number(vehicle.current_odometer || 0).toLocaleString('el-GR')}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">Έτος</div>
                <div className="font-bold text-gray-900">{vehicle.year}</div>
              </div>
            </div>

            {(vehicle.amenities || []).length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {vehicle.amenities.map((a) => (
                  <span
                    key={a}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700"
                  >
                    {a}
                  </span>
                ))}
              </div>
            ) : null}

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
                <div className="font-bold text-gray-900">{kmLeft.toLocaleString('el-GR')} km</div>
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
        </div>

        {editing && form && (
          <form
            onSubmit={onSave}
            className="bg-white rounded-[32px] border p-6 grid sm:grid-cols-2 gap-4"
          >
            <h3 className="sm:col-span-2 font-bold text-lg">Παραμετροποίηση λεωφορείου</h3>
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
              Διάστημα service (km)
              <input
                type="number"
                min={1000}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.service_interval_km}
                onChange={(e) => setForm((f) => ({ ...f, service_interval_km: e.target.value }))}
              />
            </label>
            <label className="text-sm font-bold text-gray-700">
              Τιμή αγοράς (€)
              <input
                type="number"
                min={0}
                step="0.01"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.purchase_price}
                onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
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
            <div className="sm:col-span-2">
              <div className="text-sm font-bold text-gray-700 mb-2">Παροχές / ανέσεις</div>
              <div className="flex flex-wrap gap-2">
                {AMENITY_PRESETS.map((name) => {
                  const on = form.amenities.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          amenities: on
                            ? f.amenities.filter((a) => a !== name)
                            : [...f.amenities, name],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        on
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
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
