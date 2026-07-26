import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout.jsx';
import {
  createRentalVehicle,
  fetchRentalVehicles,
  updateRentalVehicle,
  uploadRentalInspectionPhoto,
} from '../../services/fleetRentalApi.js';

const CATEGORIES = [
  { value: 'CAR', label: 'Αυτοκίνητο' },
  { value: 'VAN', label: 'Van' },
  { value: 'MINIBUS', label: 'Μινιμπάς' },
];

const STATUSES = [
  { value: 'AVAILABLE', label: 'Διαθέσιμο' },
  { value: 'RENTED', label: 'Σε ενοικίαση' },
  { value: 'MAINTENANCE', label: 'Συντήρηση' },
  { value: 'IN_TRANSIT', label: 'Μετακίνηση' },
];

const EMPTY = {
  plate_number: '',
  category: 'VAN',
  model: '',
  seating_capacity: 9,
  current_status: 'AVAILABLE',
  current_mileage: 0,
  daily_rate_eur: 80,
  one_way_surcharge_eur: 0,
  with_driver_daily_eur: 0,
  gps_device_id: '',
  photo_url: '',
  photo_urls: [],
  description: '',
  notes: '',
};

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15';

const backState = { activeTab: 'fleet_rental', fleetRentalTab: 'vehicles' };

/**
 * Full-page create / edit for rental fleet vehicles + photos.
 * Routes: /admin/fleet-rental/vehicles/new
 *         /admin/fleet-rental/vehicles/:vehicleId/edit
 */
export default function RentalVehicleFormPage() {
  const { vehicleId } = useParams();
  const isEdit = Boolean(vehicleId);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin' && !localStorage.getItem('saas_access_token')) {
      navigate('/admin/login');
      return undefined;
    }
    if (!isEdit) return undefined;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchRentalVehicles();
        const v = rows.find((row) => String(row.id) === String(vehicleId));
        if (cancelled) return;
        if (!v) {
          toast.error('Δεν βρέθηκε το όχημα');
          navigate('/admin', { state: backState });
          return;
        }
        setForm({
          plate_number: v.plate_number || '',
          category: v.category || 'VAN',
          model: v.model || '',
          seating_capacity: v.seating_capacity ?? 9,
          current_status: v.current_status || 'AVAILABLE',
          current_mileage: v.current_mileage ?? 0,
          daily_rate_eur: v.daily_rate_eur ?? 80,
          one_way_surcharge_eur: v.one_way_surcharge_eur ?? 0,
          with_driver_daily_eur: v.with_driver_daily_eur ?? 0,
          gps_device_id: v.gps_device_id || '',
          photo_url: v.photo_url || '',
          photo_urls: v.photo_urls?.length
            ? v.photo_urls
            : v.photo_url
              ? [v.photo_url]
              : [],
          description: v.description || '',
          notes: v.notes || '',
        });
      } catch (err) {
        if (!cancelled) {
          toast.error(err.message || 'Αποτυχία φόρτωσης');
          navigate('/admin', { state: backState });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vehicleId, isEdit, navigate]);

  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!String(form.plate_number || '').trim()) {
      toast.error('Συμπληρώστε πινακίδα');
      return;
    }
    if (!String(form.model || '').trim()) {
      toast.error('Συμπληρώστε μοντέλο');
      return;
    }

    const body = {
      ...form,
      plate_number: String(form.plate_number).trim().toUpperCase(),
      model: String(form.model).trim(),
      seating_capacity: Number(form.seating_capacity) || 0,
      current_mileage: Number(form.current_mileage) || 0,
      daily_rate_eur: Number(form.daily_rate_eur) || 0,
      one_way_surcharge_eur: Number(form.one_way_surcharge_eur || 0),
      with_driver_daily_eur: Number(form.with_driver_daily_eur || 0),
      gps_device_id: form.gps_device_id?.trim() || null,
      photo_url: form.photo_url || form.photo_urls?.[0] || null,
      photo_urls: form.photo_urls || [],
      description: form.description?.trim() || null,
      notes: form.notes?.trim() || null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateRentalVehicle(vehicleId, body);
        toast.success('Το όχημα ενημερώθηκε');
      } else {
        await createRentalVehicle(body);
        toast.success('Το όχημα προστέθηκε στον στόλο');
      }
      navigate('/admin', { state: backState });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const addPhotos = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setUploadingPhoto(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const row = await uploadRentalInspectionPhoto(file);
        if (row?.url) uploaded.push(row.url);
      }
      if (!uploaded.length) throw new Error('Δεν ανέβηκε καμία φωτογραφία');
      setForm((f) => {
        const next = [...(f.photo_urls || []), ...uploaded].slice(0, 12);
        return {
          ...f,
          photo_urls: next,
          photo_url: f.photo_url || next[0] || '',
        };
      });
      toast.success(uploaded.length === 1 ? 'Η φωτογραφία ανέβηκε' : `${uploaded.length} φωτογραφίες ανέβηκαν`);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const header = (
    <div className="flex items-center gap-3 w-full min-w-0">
      <button
        type="button"
        onClick={() => navigate('/admin', { state: backState })}
        className="w-10 h-10 shrink-0 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high transition-colors"
        aria-label="Επιστροφή"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 className="font-headline-md font-bold flex items-center gap-2 min-w-0 truncate">
        <span className="material-symbols-outlined text-primary shrink-0">
          {isEdit ? 'edit' : 'directions_car'}
        </span>
        <span className="truncate">
          {isEdit ? 'Επεξεργασία οχήματος ενοικίασης' : 'Νέο όχημα ενοικίασης'}
        </span>
      </h1>
    </div>
  );

  if (loading) {
    return (
      <AdminLayout activeTab="fleet" title={header}>
        <p className="text-on-surface-variant">Φόρτωση…</p>
      </AdminLayout>
    );
  }

  const actions = (
    <div className="flex gap-3">
      <button
        type="submit"
        form="rental-vehicle-form"
        disabled={saving || uploadingPhoto}
        className="flex-1 sm:flex-none px-6 py-3.5 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-60"
      >
        {saving ? 'Αποθήκευση…' : isEdit ? 'Αποθήκευση' : 'Προσθήκη στον στόλο'}
      </button>
      <Link
        to="/admin"
        state={backState}
        className="px-5 py-3.5 rounded-2xl border border-gray-200 bg-white font-bold text-gray-700 hover:bg-gray-50 text-center"
      >
        Άκυρο
      </Link>
    </div>
  );

  return (
    <AdminLayout activeTab="fleet" title={header} footer={actions}>
      <form
        id="rental-vehicle-form"
        onSubmit={save}
        className="max-w-4xl mx-auto space-y-5 pb-8"
      >
        <section className="bg-white rounded-[24px] border border-black/[0.06] p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">badge</span>
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-gray-900">Στοιχεία οχήματος</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Πινακίδα, κατηγορία και μοντέλο όπως εμφανίζονται στους πελάτες στο /rent.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm sm:col-span-1">
              <span className="font-bold text-gray-800">Πινακίδα *</span>
              <input
                required
                className={inputClass}
                value={form.plate_number}
                onChange={setField('plate_number')}
                placeholder="π.χ. ΙΝΧ 1234"
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-800">Κατηγορία *</span>
              <select className={inputClass} value={form.category} onChange={setField('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-bold text-gray-800">Μοντέλο *</span>
              <input
                required
                className={inputClass}
                value={form.model}
                onChange={setField('model')}
                placeholder="π.χ. Mercedes Sprinter"
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-800">Θέσεις</span>
              <input
                type="number"
                min={2}
                max={80}
                className={inputClass}
                value={form.seating_capacity}
                onChange={setField('seating_capacity')}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-800">Κατάσταση</span>
              <select
                className={inputClass}
                value={form.current_status}
                onChange={setField('current_status')}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-800">Χιλιόμετρα</span>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.current_mileage}
                onChange={setField('current_mileage')}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-800">GPS device / πινακίδα tracker</span>
              <input
                className={inputClass}
                value={form.gps_device_id}
                onChange={setField('gps_device_id')}
                placeholder="π.χ. ίδια με πινακίδα στον ζωντανό χάρτη"
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-[24px] border border-black/[0.06] p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-gray-900">Τιμολόγηση</h2>
              <p className="text-sm text-gray-500 mt-0.5">Ημερήσια τιμή, one-way και επιβάρυνση με οδηγό.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="font-bold text-gray-800">€ / ημέρα</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={form.daily_rate_eur}
                onChange={setField('daily_rate_eur')}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-800">One-way €</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={form.one_way_surcharge_eur}
                onChange={setField('one_way_surcharge_eur')}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-800">Με οδηγό €/ημέρα</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={form.with_driver_daily_eur}
                onChange={setField('with_driver_daily_eur')}
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-[24px] border border-black/[0.06] p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">description</span>
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-gray-900">Περιγραφή για πελάτες</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Φαίνεται στην εφαρμογή /rent όταν κλείνουν όχημα.
              </p>
            </div>
          </div>
          <label className="block text-sm">
            <span className="font-bold text-gray-800">Δημόσια περιγραφή</span>
            <textarea
              rows={5}
              className={`${inputClass} resize-y min-h-[8rem]`}
              value={form.description}
              onChange={setField('description')}
              placeholder="π.χ. Αυτόματο, A/C, Bluetooth, ιδανικό για οικογένεια ή μεταφορές…"
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-gray-800">Εσωτερικές σημειώσεις γραφείου</span>
            <textarea
              rows={3}
              className={`${inputClass} resize-y`}
              value={form.notes}
              onChange={setField('notes')}
              placeholder="Μόνο για το γραφείο — δεν φαίνεται στους πελάτες"
            />
          </label>
        </section>

        <section className="bg-white rounded-[24px] border border-black/[0.06] p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">photo_library</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-base sm:text-lg text-gray-900">Φωτογραφίες οχήματος</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Έως 12 φωτογραφίες. Η πρώτη χρησιμοποιείται ως κάλυμμα στο /rent.
              </p>
            </div>
          </div>

          {(form.photo_urls || []).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {form.photo_urls.map((url, idx) => (
                <div
                  key={url}
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-black/[0.06] bg-gray-50"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {idx === 0 ? (
                    <span className="absolute left-2 top-2 text-[10px] font-bold uppercase tracking-wide bg-black/70 text-white px-2 py-0.5 rounded-full">
                      Κάλυμμα
                    </span>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 p-2 flex gap-1 bg-gradient-to-t from-black/60 to-transparent">
                    {idx !== 0 ? (
                      <button
                        type="button"
                        className="flex-1 text-[11px] font-bold bg-white/95 text-gray-900 rounded-lg py-1.5"
                        onClick={() =>
                          setForm((f) => {
                            const next = [...(f.photo_urls || [])];
                            const [picked] = next.splice(idx, 1);
                            next.unshift(picked);
                            return { ...f, photo_urls: next, photo_url: next[0] || '' };
                          })
                        }
                      >
                        Κάλυμμα
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="flex-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg py-1.5"
                      onClick={() =>
                        setForm((f) => {
                          const next = (f.photo_urls || []).filter((u) => u !== url);
                          return {
                            ...f,
                            photo_urls: next,
                            photo_url: f.photo_url === url ? next[0] || '' : f.photo_url,
                          };
                        })
                      }
                    >
                      Αφαίρεση
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center">
              Δεν υπάρχουν φωτογραφίες ακόμα. Προσθέστε τουλάχιστον μία για καλύτερη εμφάνιση στο /rent.
            </p>
          )}

          <label className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 w-full min-h-[3.25rem] px-4 py-3 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] text-primary font-bold cursor-pointer hover:bg-primary/[0.06] transition-colors">
            <span className="material-symbols-outlined text-[22px]">add_a_photo</span>
            <span>{uploadingPhoto ? 'Ανέβασμα…' : 'Προσθήκη φωτογραφιών'}</span>
            <span className="text-xs font-semibold text-primary/70">JPG, PNG · έως 12</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploadingPhoto || saving || (form.photo_urls || []).length >= 12}
              onChange={async (e) => {
                const list = e.target.files;
                e.target.value = '';
                await addPhotos(list);
              }}
            />
          </label>
        </section>
      </form>
    </AdminLayout>
  );
}
