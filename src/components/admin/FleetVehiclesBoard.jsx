/**
 * Fleet vehicles board — photo cards, live inspector, quick config & gallery.
 */
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  updateFleetVehicle,
  uploadFleetVehiclePhoto,
} from '../../services/platformApi.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

const AMENITY_PRESETS = [
  'Wi-Fi onboard',
  'USB θύρες',
  'USB & 220V',
  'Κλιματισμός',
  'Θέρμανση',
  'Ανακλινόμενα καθίσματα',
  'WC onboard',
  'Ψυγείο',
  'Mini bar',
  'Αποσκευές',
  'Ευέλικτες θέσεις',
];

function statusMeta(serviceStatus) {
  if (serviceStatus === 'Urgent') {
    return { label: 'Σε Service', chip: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (serviceStatus === 'Warning') {
    return { label: 'Προειδοποίηση', chip: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  return { label: 'Ενεργό', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
}

function coverUrl(vehicle) {
  const raw =
    vehicle?.public_image_url ||
    (Array.isArray(vehicle?.gallery_urls) && vehicle.gallery_urls[0]) ||
    '';
  if (!raw || raw.includes('hero-bus-achillio')) return '';
  return resolveSiteAssetUrl(raw);
}

function galleryList(vehicle) {
  const urls = [];
  for (const u of vehicle?.gallery_urls || []) {
    if (u && !urls.includes(u)) urls.push(u);
  }
  if (vehicle?.public_image_url && !urls.includes(vehicle.public_image_url)) {
    urls.unshift(vehicle.public_image_url);
  }
  return urls.filter((u) => u && !String(u).includes('hero-bus-achillio'));
}

export default function FleetVehiclesBoard({
  vehicles = [],
  selectedId = null,
  onSelect,
  onDelete,
  deletingId = null,
  costReport = null,
  depreciation = null,
  events = [],
  onVehicleUpdated,
}) {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const selected = useMemo(
    () => vehicles.find((v) => v.id === selectedId) || null,
    [vehicles, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => {
      const hay = `${v.make} ${v.model} ${v.plate_number} ${v.category} ${v.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, query]);

  const [quickForm, setQuickForm] = useState(null);

  const openConfig = (vehicle) => {
    setQuickForm({
      make: vehicle.make || '',
      model: vehicle.model || '',
      plate_number: vehicle.plate_number || '',
      category: vehicle.category || 'Standard',
      year: vehicle.year || new Date().getFullYear(),
      seat_count: vehicle.seat_count || 49,
      current_odometer: vehicle.current_odometer || 0,
      service_interval_km: vehicle.service_interval_km || 15000,
      purchase_price: vehicle.purchase_price || 0,
      vin: vehicle.vin || '',
      public_summary: vehicle.public_summary || '',
      show_on_website: Boolean(vehicle.show_on_website),
      amenities: Array.isArray(vehicle.amenities) ? [...vehicle.amenities] : [],
    });
    setConfigOpen(true);
  };

  const saveQuickConfig = async (e) => {
    e.preventDefault();
    if (!selected?.id || !quickForm) return;
    setQuickSaving(true);
    try {
      const updated = await updateFleetVehicle(selected.id, {
        ...quickForm,
        year: Number(quickForm.year),
        seat_count: Number(quickForm.seat_count),
        current_odometer: Number(quickForm.current_odometer),
        service_interval_km: Number(quickForm.service_interval_km),
        purchase_price: Number(quickForm.purchase_price),
      });
      onVehicleUpdated?.(updated);
      setConfigOpen(false);
      toast.success('Το λεωφορείο ενημερώθηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setQuickSaving(false);
    }
  };

  const onPickPhotos = async (fileList) => {
    if (!selected?.id || !fileList?.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(fileList).slice(0, 8)) {
        const res = await uploadFleetVehiclePhoto(file);
        if (res?.url) uploaded.push(res.url);
      }
      if (!uploaded.length) throw new Error('Δεν ανέβηκε καμία φωτογραφία');
      const existing = galleryList(selected);
      const gallery_urls = [...existing, ...uploaded.filter((u) => !existing.includes(u))];
      const public_image_url = selected.public_image_url || uploaded[0];
      const updated = await updateFleetVehicle(selected.id, {
        gallery_urls,
        public_image_url,
      });
      onVehicleUpdated?.(updated);
      toast.success(uploaded.length > 1 ? `Προστέθηκαν ${uploaded.length} φωτογραφίες` : 'Προστέθηκε φωτογραφία');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setCover = async (url) => {
    if (!selected?.id || !url) return;
    try {
      const updated = await updateFleetVehicle(selected.id, { public_image_url: url });
      onVehicleUpdated?.(updated);
      toast.success('Ορίστηκε ως κύρια φωτογραφία');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    }
  };

  const removePhoto = async (url) => {
    if (!selected?.id || !url) return;
    const next = galleryList(selected).filter((u) => u !== url);
    const public_image_url =
      selected.public_image_url === url ? next[0] || '' : selected.public_image_url || '';
    try {
      const updated = await updateFleetVehicle(selected.id, {
        gallery_urls: next,
        public_image_url,
      });
      onVehicleUpdated?.(updated);
      toast.success('Η φωτογραφία αφαιρέθηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    }
  };

  const toggleAmenity = (name) => {
    setQuickForm((f) => {
      if (!f) return f;
      const has = f.amenities.includes(name);
      return {
        ...f,
        amenities: has ? f.amenities.filter((a) => a !== name) : [...f.amenities, name],
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative flex-1 min-w-[14rem] max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση πινακίδας, μάρκας, μοντέλου…"
            className="w-full rounded-2xl border border-black/[0.08] bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-slate-400"
          />
        </label>
        <p className="text-xs text-slate-500">
          Κλικ για ανάλυση · διπλό κλικ για πλήρες προφίλ
        </p>
      </div>

      <div
        id="fleet-vehicle-table"
        className="bg-white rounded-[28px] border border-black/[0.06] shadow-sm overflow-hidden"
      >
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">
              directions_bus
            </span>
            <p className="font-bold text-slate-900 mb-1">
              {vehicles.length === 0 ? 'Δεν υπάρχουν οχήματα στον στόλο' : 'Κανένα αποτέλεσμα'}
            </p>
            <p className="text-sm text-slate-500">
              {vehicles.length === 0
                ? 'Πρόσθεσε λεωφορείο, coach ή van για να ξεκινήσεις.'
                : 'Δοκίμασε άλλη αναζήτηση.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((v) => {
              const meta = statusMeta(v.service_status);
              const kmLeft = Number(v.km_to_service ?? 0);
              const photo = coverUrl(v);
              const isVan = String(v.category || '').toLowerCase().includes('van');
              const selectedRow = selectedId === v.id;
              const expenses =
                Number(v.fuel_cost_total || 0) + Number(v.insurance_cost_total || 0);
              return (
                <li key={v.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect?.(v.id)}
                    onDoubleClick={() => navigate(`/admin/fleet/${v.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSelect?.(v.id);
                    }}
                    className={`flex flex-wrap items-center gap-4 px-4 sm:px-5 py-4 cursor-pointer transition-colors ${
                      selectedRow ? 'bg-sky-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl overflow-hidden bg-slate-100 border border-black/[0.05] shrink-0">
                      {photo ? (
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sky-700">
                          <span className="material-symbols-outlined text-[28px]">
                            {isVan ? 'airport_shuttle' : 'directions_bus'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-[12rem]">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">
                          {v.make} {v.model}
                        </h3>
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          {v.category} · {v.seat_count} θέσεις
                        </span>
                      </div>
                      <p className="text-sm font-mono text-slate-500 mt-0.5">
                        {v.plate_number} · {v.year || '—'}
                      </p>
                      {(v.amenities || []).length > 0 ? (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {(v.amenities || []).slice(0, 4).join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    <div className="w-28 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 border ${meta.chip}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {meta.label}
                      </span>
                    </div>
                    <div className="w-28 text-right hidden sm:block">
                      <div className="font-bold text-slate-900 tabular-nums">
                        {Number(v.current_odometer || 0).toLocaleString('el-GR')} km
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${
                          kmLeft < 5000 ? 'text-rose-600 font-bold' : 'text-slate-500'
                        }`}
                      >
                        Service σε {kmLeft.toLocaleString('el-GR')} km
                      </div>
                    </div>
                    <div className="w-24 text-right hidden md:block">
                      <div className="font-bold text-emerald-600 text-sm">+€0</div>
                      <div className="font-bold text-rose-500 text-xs">
                        -€{expenses.toLocaleString('el-GR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/fleet/${v.id}`);
                        }}
                        className="p-2 rounded-full text-slate-600 hover:bg-white border border-transparent hover:border-black/[0.06]"
                        title="Προφίλ & παραμετροποίηση"
                      >
                        <span className="material-symbols-outlined text-[20px]">tune</span>
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === v.id}
                        onClick={(e) => onDelete?.(e, v.id, `${v.make} ${v.model}`)}
                        className="p-2 rounded-full text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        title="Διαγραφή"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-5 bg-white rounded-[28px] border border-black/[0.06] overflow-hidden shadow-sm">
            <div className="relative aspect-[16/10] bg-slate-100">
              {coverUrl(selected) ? (
                <img
                  src={coverUrl(selected)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="material-symbols-outlined text-[48px]">add_a_photo</span>
                  <p className="text-sm font-semibold">Χωρίς φωτογραφία ακόμα</p>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 pt-12">
                <h3 className="text-white font-bold text-lg drop-shadow">
                  {selected.make} {selected.model}
                </h3>
                <p className="text-white/85 text-sm font-mono">{selected.plate_number}</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openConfig(selected)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-900 text-white text-sm font-bold"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  Παραμετροποίηση
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-slate-200 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  {uploading ? 'Ανέβασμα…' : 'Φωτογραφίες'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/fleet/${selected.id}`)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-slate-200 text-sm font-bold text-slate-800 hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  Πλήρες προφίλ
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
              {galleryList(selected).length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {galleryList(selected).map((url) => {
                    const src = resolveSiteAssetUrl(url);
                    const isCover = url === selected.public_image_url;
                    return (
                      <div
                        key={url}
                        className={`relative w-20 h-14 rounded-xl overflow-hidden border shrink-0 ${
                          isCover ? 'border-sky-500 ring-2 ring-sky-200' : 'border-black/[0.08]'
                        }`}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/40 flex items-center justify-center gap-1 transition-opacity">
                          {!isCover ? (
                            <button
                              type="button"
                              title="Κύρια"
                              onClick={() => setCover(url)}
                              className="p-1 rounded-full bg-white/90 text-slate-800"
                            >
                              <span className="material-symbols-outlined text-[16px]">star</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            title="Αφαίρεση"
                            onClick={() => removePhoto(url)}
                            className="p-1 rounded-full bg-white/90 text-rose-700"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Θέσεις
                  </div>
                  <div className="font-bold text-slate-900 mt-0.5">{selected.seat_count}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Κατηγορία
                  </div>
                  <div className="font-bold text-slate-900 mt-0.5">{selected.category}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Χιλιόμετρα
                  </div>
                  <div className="font-bold text-slate-900 mt-0.5 tabular-nums">
                    {Number(selected.current_odometer || 0).toLocaleString('el-GR')}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Διάστημα service
                  </div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {(selected.service_interval_km || 15000).toLocaleString('el-GR')} km
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-[24px] border border-black/[0.06] p-5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Αναφορά κόστους (6 μήνες)
              </div>
              <div className="text-2xl font-bold text-sky-700 mb-3 tabular-nums">
                €{Number(costReport?.total || 0).toLocaleString('el-GR')}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Συντήρηση</span>
                  <span className="font-semibold tabular-nums">
                    €{Number(costReport?.maintenance_total || 0).toLocaleString('el-GR')}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Καύσιμα</span>
                  <span className="font-semibold tabular-nums">
                    €{Number(costReport?.fuel_total || 0).toLocaleString('el-GR')}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Ασφάλιση</span>
                  <span className="font-semibold tabular-nums">
                    €{Number(costReport?.insurance_total || 0).toLocaleString('el-GR')}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-[24px] border border-black/[0.06] p-5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Απόσβεση
              </div>
              <div className="text-2xl font-bold text-emerald-600 mb-1 tabular-nums">
                €{Number(depreciation?.estimated_book_value || 0).toLocaleString('el-GR')}
              </div>
              <div className="text-sm text-slate-500">Εκτιμώμενη λογιστική αξία</div>
              <div className="mt-3 text-sm text-slate-700">
                Ηλικία:{' '}
                <span className="font-semibold">{depreciation?.age_years ?? '—'} έτη</span>
              </div>
              <div className="text-sm text-slate-700">
                Συντελεστής χλμ.:{' '}
                <span className="font-semibold">{depreciation?.mileage_factor ?? '—'}</span>
              </div>
            </div>
            <div className="bg-white rounded-[24px] border border-black/[0.06] p-5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Τελευταία service
              </div>
              <div className="space-y-2 max-h-44 overflow-auto">
                {events.slice(0, 5).map((ev) => (
                  <div key={ev.id} className="rounded-xl bg-slate-50 p-2.5">
                    <div className="text-sm font-semibold text-slate-900">
                      {ev.service_type} · €{Number(ev.cost || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {ev.event_date} · {ev.shop_or_mechanic || '—'}
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Δεν υπάρχουν καταγεγραμμένα service events.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {configOpen && quickForm && selected ? (
        <div className="fixed inset-0 z-[220] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={saveQuickConfig}
            className="bg-white w-full sm:max-w-2xl sm:rounded-[28px] rounded-t-[28px] max-h-[92vh] overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 bg-white border-b border-black/[0.06] px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h4 className="font-bold text-lg text-slate-900">Παραμετροποίηση λεωφορείου</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selected.plate_number} · {selected.make} {selected.model}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3">
              {[
                ['make', 'Μάρκα'],
                ['model', 'Μοντέλο'],
                ['plate_number', 'Πινακίδα'],
                ['vin', 'VIN'],
              ].map(([key, label]) => (
                <label key={key} className="text-sm font-bold text-slate-700">
                  {label}
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
                    value={quickForm[key]}
                    onChange={(e) => setQuickForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={key !== 'vin'}
                  />
                </label>
              ))}
              <label className="text-sm font-bold text-slate-700">
                Κατηγορία
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
                  value={quickForm.category}
                  onChange={(e) => setQuickForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {['Luxury Coach', 'Premium Express', 'Standard', 'Van'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">
                Έτος
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
                  value={quickForm.year}
                  onChange={(e) => setQuickForm((f) => ({ ...f, year: e.target.value }))}
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Θέσεις
                <input
                  type="number"
                  min={8}
                  max={80}
                  className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
                  value={quickForm.seat_count}
                  onChange={(e) => setQuickForm((f) => ({ ...f, seat_count: e.target.value }))}
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Χιλιόμετρα
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
                  value={quickForm.current_odometer}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, current_odometer: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Διάστημα service (km)
                <input
                  type="number"
                  min={1000}
                  className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
                  value={quickForm.service_interval_km}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, service_interval_km: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Τιμή αγοράς (€)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
                  value={quickForm.purchase_price}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, purchase_price: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm font-bold text-slate-700 sm:col-span-2">
                Περιγραφή website
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
                  value={quickForm.public_summary}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, public_summary: e.target.value }))
                  }
                />
              </label>
              <div className="sm:col-span-2">
                <div className="text-sm font-bold text-slate-700 mb-2">Παροχές / ανέσεις</div>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_PRESETS.map((name) => {
                    const on = quickForm.amenities.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleAmenity(name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                          on
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={quickForm.show_on_website}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, show_on_website: e.target.checked }))
                  }
                />
                Εμφάνιση στην ιστοσελίδα
              </label>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-black/[0.06] px-5 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="px-4 py-2 rounded-full border text-sm font-bold"
              >
                Άκυρο
              </button>
              <button
                type="submit"
                disabled={quickSaving}
                className="px-5 py-2 rounded-full bg-sky-700 text-white text-sm font-bold disabled:opacity-50"
              >
                {quickSaving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
