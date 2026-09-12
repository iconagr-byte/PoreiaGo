import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FLEET_VEHICLE_CATEGORIES,
  fleetCategoryMeta,
} from '../../lib/fleet/fleetVehicleCategories.js';
import { createFleetVehicle, uploadFleetVehiclePhoto } from '../../services/platformApi.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

const AMENITY_PRESETS = [
  'Wi-Fi',
  'USB θύρες',
  'Κλιματισμός',
  'Θέρμανση',
  'Ανακλινόμενα καθίσματα',
  'WC',
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
    const meta = fleetCategoryMeta(category);
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
      toast.success(
        uploaded.length > 1
          ? `Προστέθηκαν ${uploaded.length} φωτογραφίες`
          : 'Προστέθηκε φωτογραφία',
      );
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/40">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-2xl max-h-[min(92dvh,880px)] flex-col overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.05] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-gray-900">Νέο όχημα</h3>
            <p className="mt-0.5 text-xs text-gray-500">Λεωφορείο ή van στον στόλο σου</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Κλείσιμο"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FLEET_VEHICLE_CATEGORIES.map((c) => {
              const selected = form.category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onCategory(c.id)}
                  className={`min-w-0 rounded-2xl border px-3 py-3 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-black/[0.08] text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="material-symbols-outlined mb-1 block text-[22px]">
                    {c.icon}
                  </span>
                  <span className="block text-sm font-bold leading-snug">{c.label}</span>
                  <span
                    className={`mt-0.5 block text-[11px] font-semibold ${
                      selected ? 'text-primary/80' : 'text-gray-400'
                    }`}
                  >
                    {c.seats} θέσεις
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
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
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border ${
                      url === form.public_image_url
                        ? 'border-sky-500 ring-2 ring-sky-200'
                        : 'border-black/[0.08]'
                    }`}
                  >
                    <img
                      src={resolveSiteAssetUrl(url)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-sm">
              <span className="font-bold text-gray-700">Μάρκα</span>
              <input
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 outline-none focus:border-primary"
                placeholder="Mercedes / Ford"
                value={form.make}
                onChange={(e) => setField('make', e.target.value)}
                required
              />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="font-bold text-gray-700">Μοντέλο</span>
              <input
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 outline-none focus:border-primary"
                placeholder="Tourismo / Transit"
                value={form.model}
                onChange={(e) => setField('model', e.target.value)}
                required
              />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="font-bold text-gray-700">Πινακίδα</span>
              <input
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 font-mono uppercase outline-none focus:border-primary"
                placeholder="ΧΑΗ-1234"
                value={form.plate_number}
                onChange={(e) => setField('plate_number', e.target.value)}
                required
              />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="font-bold text-gray-700">Έτος</span>
              <input
                type="number"
                min={1990}
                max={2100}
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 outline-none focus:border-primary"
                value={form.year}
                onChange={(e) => setField('year', e.target.value)}
                required
              />
            </label>
            <label className="block min-w-0 text-sm sm:col-span-2">
              <span className="font-bold text-gray-700">VIN</span>
              <input
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 font-mono uppercase outline-none focus:border-primary"
                placeholder="Τουλάχιστον 8 χαρακτήρες"
                value={form.vin}
                onChange={(e) => setField('vin', e.target.value)}
                required
                minLength={8}
              />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="font-bold text-gray-700">Χιλιόμετρα</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 outline-none focus:border-primary"
                value={form.current_odometer}
                onChange={(e) => setField('current_odometer', e.target.value)}
              />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="font-bold text-gray-700">Θέσεις</span>
              <input
                type="number"
                min={8}
                max={80}
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 outline-none focus:border-primary"
                value={form.seat_count}
                onChange={(e) => setField('seat_count', e.target.value)}
              />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="font-bold text-gray-700">Διάστημα service (km)</span>
              <input
                type="number"
                min={1000}
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 outline-none focus:border-primary"
                value={form.service_interval_km}
                onChange={(e) => setField('service_interval_km', e.target.value)}
              />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="font-bold text-gray-700">Τιμή αγοράς (€)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 outline-none focus:border-primary"
                value={form.purchase_price}
                onChange={(e) => setField('purchase_price', e.target.value)}
              />
            </label>
            <label className="block min-w-0 text-sm sm:col-span-2">
              <span className="font-bold text-gray-700">Σύντομη περιγραφή (website)</span>
              <input
                className="mt-1 w-full min-w-0 rounded-xl border border-black/[0.1] px-3 py-2 outline-none focus:border-primary"
                placeholder="π.χ. Van 9 θέσεων για transfers"
                value={form.public_summary}
                onChange={(e) => setField('public_summary', e.target.value)}
              />
            </label>
            <div className="min-w-0 sm:col-span-2">
              <div className="mb-2 text-sm font-bold text-gray-700">Παροχές</div>
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
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        on
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700'
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

        <div className="flex shrink-0 justify-end gap-2 border-t border-black/[0.05] bg-gray-50/90 px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100"
          >
            Ακύρωση
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Αποθήκευση…' : 'Προσθήκη οχήματος'}
          </button>
        </div>
      </form>
    </div>
  );
}
