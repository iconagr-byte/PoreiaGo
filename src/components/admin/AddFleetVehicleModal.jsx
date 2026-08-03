import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { createFleetVehicle, uploadFleetVehiclePhoto } from '../../services/platformApi.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

const CATEGORIES = [
  { id: 'Luxury Coach', label: 'Luxury Coach', seats: 50 },
  { id: 'Premium Express', label: 'Premium Express', seats: 32 },
  { id: 'Standard', label: 'Standard Coach', seats: 55 },
  { id: 'Van', label: 'Van / Minibus', seats: 9 },
];

const AMENITY_PRESETS = [
  'Wi-Fi onboard',
  'USB θύρες',
  'Κλιματισμός',
  'Θέρμανση',
  'Ανακλινόμενα καθίσματα',
  'WC onboard',
  'Ψυγείο',
  'Αποσκευές',
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
  service_interval_km: 15000,
  purchase_price: 100000,
  amenities: ['Κλιματισμός', 'USB θύρες'],
  public_image_url: '',
  gallery_urls: [],
};

export default function AddFleetVehicleModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  if (!open) return null;

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onCategory = (category) => {
    const meta = CATEGORIES.find((c) => c.id === category) || CATEGORIES[2];
    setForm((f) => ({ ...f, category, seat_count: meta.seats }));
  };

  const onPickPhotos = async (fileList) => {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(fileList).slice(0, 6)) {
        const res = await uploadFleetVehiclePhoto(file);
        if (res?.url) uploaded.push(res.url);
      }
      if (!uploaded.length) throw new Error('Δεν ανέβηκε καμία φωτογραφία');
      setForm((f) => {
        const gallery_urls = [...(f.gallery_urls || []), ...uploaded];
        return {
          ...f,
          gallery_urls,
          public_image_url: f.public_image_url || uploaded[0],
        };
      });
      toast.success(uploaded.length > 1 ? `Προστέθηκαν ${uploaded.length} φωτογραφίες` : 'Προστέθηκε φωτογραφία');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
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
        service_interval_km: Number(form.service_interval_km) || 15000,
        purchase_price: Number(form.purchase_price) || 0,
        amenities: form.amenities || [],
        public_image_url: form.public_image_url || '',
        gallery_urls: form.gallery_urls || [],
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">Φωτογραφίες</span>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="text-xs font-bold text-sky-700 hover:underline disabled:opacity-50"
              >
                {uploading ? 'Ανέβασμα…' : '+ Προσθήκη'}
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
            {form.gallery_urls?.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {form.gallery_urls.map((url) => (
                  <div
                    key={url}
                    className={`relative w-20 h-14 rounded-xl overflow-hidden border shrink-0 ${
                      url === form.public_image_url
                        ? 'border-sky-500 ring-2 ring-sky-200'
                        : 'border-black/[0.08]'
                    }`}
                  >
                    <img
                      src={resolveSiteAssetUrl(url)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                      onClick={() =>
                        setForm((f) => {
                          const gallery_urls = f.gallery_urls.filter((u) => u !== url);
                          return {
                            ...f,
                            gallery_urls,
                            public_image_url:
                              f.public_image_url === url
                                ? gallery_urls[0] || ''
                                : f.public_image_url,
                          };
                        })
                      }
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:bg-slate-50"
              >
                Σύρε ή επίλεξε φωτογραφίες του λεωφορείου
              </button>
            )}
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
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Διάστημα service (km)</span>
              <input
                type="number"
                min={1000}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.service_interval_km}
                onChange={(e) => setField('service_interval_km', e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Τιμή αγοράς (€)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.purchase_price}
                onChange={(e) => setField('purchase_price', e.target.value)}
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
            <div className="sm:col-span-2">
              <div className="text-sm font-bold text-gray-700 mb-2">Παροχές</div>
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
