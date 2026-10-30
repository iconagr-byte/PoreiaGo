/**
 * Fleet vehicles board — Apple/minimal master–detail for Διαχείριση Στόλου.
 */
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FLEET_VEHICLE_CATEGORIES,
  fleetCategoryLabel,
} from '../../lib/fleet/fleetVehicleCategories.js';
import {
  updateFleetVehicle,
  uploadFleetVehiclePhoto,
} from '../../services/platformApi.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import '../../styles/fleet-admin-apple.css';

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
    return { label: 'Σε Service', tone: 'danger' };
  }
  if (serviceStatus === 'Warning') {
    return { label: 'Προειδοποίηση', tone: 'warn' };
  }
  return { label: 'Ενεργό', tone: 'ok' };
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [quickForm, setQuickForm] = useState(null);

  const selected = useMemo(
    () => vehicles.find((v) => v.id === selectedId) || null,
    [vehicles, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter === 'ok' && v.service_status !== 'OK') return false;
      if (statusFilter === 'warn' && v.service_status !== 'Warning') return false;
      if (statusFilter === 'urgent' && v.service_status !== 'Urgent') return false;
      if (!q) return true;
      const hay = `${v.make} ${v.model} ${v.plate_number} ${v.category} ${v.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, query, statusFilter]);

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
    <div className="fleet-mgmt-apple fleet-mgmt-board">
      <div className="fleet-mgmt-toolbar">
        <label className="fleet-mgmt-search">
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση πινακίδας, μάρκας, μοντέλου…"
            aria-label="Αναζήτηση στόλου"
          />
        </label>
        <div className="fleet-mgmt-filters" role="tablist" aria-label="Φίλτρο κατάστασης">
          {[
            ['all', 'Όλα'],
            ['ok', 'Ενεργά'],
            ['warn', 'Προειδοποίηση'],
            ['urgent', 'Service'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={statusFilter === id}
              className={`fleet-mgmt-filter${statusFilter === id ? ' is-on' : ''}`}
              onClick={() => setStatusFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="fleet-mgmt-hint hidden sm:block">Κλικ · επιλογή · διπλό κλικ · προφίλ</p>
      </div>

      <div className="fleet-mgmt-layout">
        <div id="fleet-vehicle-table" className="fleet-mgmt-list">
          {filtered.length === 0 ? (
            <div className="fleet-mgmt-list__empty">
              <span className="material-symbols-outlined">directions_bus</span>
              <strong>
                {vehicles.length === 0 ? 'Δεν υπάρχουν οχήματα στον στόλο' : 'Κανένα αποτέλεσμα'}
              </strong>
              <p>
                {vehicles.length === 0
                  ? 'Πρόσθεσε λεωφορείο, coach ή van για να ξεκινήσεις.'
                  : 'Δοκίμασε άλλη αναζήτηση ή φίλτρο.'}
              </p>
            </div>
          ) : (
            filtered.map((v) => {
              const meta = statusMeta(v.service_status);
              const kmLeft = Number(v.km_to_service ?? 0);
              const photo = coverUrl(v);
              const isVan = String(v.category || '').toLowerCase().includes('van');
              const selectedRow = selectedId === v.id;
              return (
                <div
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedRow}
                  onClick={() => onSelect?.(v.id)}
                  onDoubleClick={() => navigate(`/admin/fleet/${v.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(v.id);
                    }
                  }}
                  className={`fleet-mgmt-row${selectedRow ? ' is-selected' : ''}`}
                >
                  <div className="fleet-mgmt-thumb">
                    {photo ? (
                      <img src={photo} alt="" />
                    ) : (
                      <div className="fleet-mgmt-thumb__fallback">
                        <span className="material-symbols-outlined">
                          {isVan ? 'airport_shuttle' : 'directions_bus'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="fleet-mgmt-row__title">
                      {v.make} {v.model}
                    </h3>
                    <p className="fleet-mgmt-row__meta">
                      {v.plate_number} · {fleetCategoryLabel(v.category)} · {v.seat_count} θέσεις
                      {v.year ? ` · ${v.year}` : ''}
                    </p>
                    {(v.amenities || []).length > 0 ? (
                      <p className="fleet-mgmt-row__amenities">
                        {(v.amenities || []).slice(0, 5).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="fleet-mgmt-row__side">
                    <span className={`fleet-mgmt-status is-${meta.tone}`}>{meta.label}</span>
                    <div className="fleet-mgmt-row__km">
                      {Number(v.current_odometer || 0).toLocaleString('el-GR')} km
                    </div>
                    <div
                      className={`fleet-mgmt-row__service${kmLeft < 5000 ? ' is-urgent' : ''}`}
                    >
                      Service σε {kmLeft.toLocaleString('el-GR')} km
                    </div>
                    <div className="fleet-mgmt-row__actions">
                      <button
                        type="button"
                        className="fleet-mgmt-icon-btn"
                        title="Προφίλ"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/fleet/${v.id}`);
                        }}
                      >
                        <span className="material-symbols-outlined">open_in_new</span>
                      </button>
                      <button
                        type="button"
                        className="fleet-mgmt-icon-btn"
                        title="Παραμετροποίηση"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect?.(v.id);
                          openConfig(v);
                        }}
                      >
                        <span className="material-symbols-outlined">tune</span>
                      </button>
                      <button
                        type="button"
                        className="fleet-mgmt-icon-btn is-danger"
                        title="Διαγραφή"
                        disabled={deletingId === v.id}
                        onClick={(e) => onDelete?.(e, v.id, `${v.make} ${v.model}`)}
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selected ? (
          <div className="fleet-mgmt-inspector">
            <div className="fleet-mgmt-hero">
              {coverUrl(selected) ? (
                <img src={coverUrl(selected)} alt="" />
              ) : (
                <div className="fleet-mgmt-hero__empty">
                  <span className="material-symbols-outlined text-[40px] block">add_a_photo</span>
                  Χωρίς φωτογραφία ακόμα
                </div>
              )}
              <div className="fleet-mgmt-hero__fade">
                <h3>
                  {selected.make} {selected.model}
                </h3>
                <p>
                  {selected.plate_number}
                  {selected.year ? ` · ${selected.year}` : ''}
                </p>
              </div>
            </div>

            <div className="fleet-mgmt-panel">
              <div className="fleet-mgmt-cta-row">
                <button
                  type="button"
                  className="fleet-mgmt-btn fleet-mgmt-btn--primary"
                  onClick={() => openConfig(selected)}
                >
                  <span className="material-symbols-outlined">tune</span>
                  Παραμετροποίηση
                </button>
                <button
                  type="button"
                  className="fleet-mgmt-btn"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <span className="material-symbols-outlined">photo_camera</span>
                  {uploading ? 'Ανέβασμα…' : 'Φωτογραφίες'}
                </button>
                <button
                  type="button"
                  className="fleet-mgmt-btn"
                  onClick={() => navigate(`/admin/fleet/${selected.id}`)}
                >
                  <span className="material-symbols-outlined">open_in_new</span>
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
                <div className="fleet-mgmt-gallery">
                  {galleryList(selected).map((url) => {
                    const src = resolveSiteAssetUrl(url);
                    const isCover = url === selected.public_image_url;
                    return (
                      <div
                        key={url}
                        className={`fleet-mgmt-gallery__item${isCover ? ' is-cover' : ''}`}
                      >
                        <img src={src} alt="" />
                        <div className="fleet-mgmt-gallery__ops">
                          {!isCover ? (
                            <button type="button" title="Κύρια" onClick={() => setCover(url)}>
                              <span className="material-symbols-outlined">star</span>
                            </button>
                          ) : null}
                          <button type="button" title="Αφαίρεση" onClick={() => removePhoto(url)}>
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="fleet-mgmt-stats">
                <div className="fleet-mgmt-stat">
                  <div className="fleet-mgmt-stat__label">Θέσεις</div>
                  <div className="fleet-mgmt-stat__value">{selected.seat_count}</div>
                </div>
                <div className="fleet-mgmt-stat">
                  <div className="fleet-mgmt-stat__label">Κατηγορία</div>
                  <div className="fleet-mgmt-stat__value">
                    {fleetCategoryLabel(selected.category)}
                  </div>
                </div>
                <div className="fleet-mgmt-stat">
                  <div className="fleet-mgmt-stat__label">Χιλιόμετρα</div>
                  <div className="fleet-mgmt-stat__value">
                    {Number(selected.current_odometer || 0).toLocaleString('el-GR')}
                  </div>
                </div>
                <div className="fleet-mgmt-stat">
                  <div className="fleet-mgmt-stat__label">Διάστημα service</div>
                  <div className="fleet-mgmt-stat__value">
                    {(selected.service_interval_km || 15000).toLocaleString('el-GR')} km
                  </div>
                </div>
              </div>
            </div>

            <div className="fleet-mgmt-metrics">
              <div className="fleet-mgmt-metric">
                <div className="fleet-mgmt-metric__label">Κόστος 6 μήνες</div>
                <div className="fleet-mgmt-metric__value is-blue">
                  €{Number(costReport?.total || 0).toLocaleString('el-GR')}
                </div>
                <div className="fleet-mgmt-metric__lines">
                  <div>
                    <span>Συντήρηση</span>
                    <strong>
                      €{Number(costReport?.maintenance_total || 0).toLocaleString('el-GR')}
                    </strong>
                  </div>
                  <div>
                    <span>Καύσιμα</span>
                    <strong>
                      €{Number(costReport?.fuel_total || 0).toLocaleString('el-GR')}
                    </strong>
                  </div>
                  <div>
                    <span>Ασφάλιση</span>
                    <strong>
                      €{Number(costReport?.insurance_total || 0).toLocaleString('el-GR')}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="fleet-mgmt-metric">
                <div className="fleet-mgmt-metric__label">Απόσβεση</div>
                <div className="fleet-mgmt-metric__value is-green">
                  €{Number(depreciation?.estimated_book_value || 0).toLocaleString('el-GR')}
                </div>
                <div className="fleet-mgmt-metric__sub">Εκτιμώμενη λογιστική αξία</div>
                <div className="fleet-mgmt-metric__lines">
                  <div>
                    <span>Ηλικία</span>
                    <strong>{depreciation?.age_years ?? '—'} έτη</strong>
                  </div>
                  <div>
                    <span>Συντελεστής χλμ.</span>
                    <strong>{depreciation?.mileage_factor ?? '—'}</strong>
                  </div>
                </div>
              </div>
              <div className="fleet-mgmt-metric">
                <div className="fleet-mgmt-metric__label">Τελευταία service</div>
                <div className="fleet-mgmt-events">
                  {events.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="fleet-mgmt-event">
                      <strong>
                        {ev.service_type} · €{Number(ev.cost || 0).toFixed(2)}
                      </strong>
                      <span>
                        {ev.event_date} · {ev.shop_or_mechanic || '—'}
                      </span>
                    </div>
                  ))}
                  {events.length === 0 ? (
                    <p className="fleet-mgmt-metric__sub" style={{ margin: 0 }}>
                      Δεν υπάρχουν καταγεγραμμένα service.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="fleet-mgmt-panel fleet-mgmt-inspector-empty">
            <span className="material-symbols-outlined" aria-hidden="true">
              touch_app
            </span>
            <strong>Επίλεξε όχημα</strong>
            <p>Φωτογραφίες, κόστος 6 μηνών, απόσβεση και ιστορικό service εμφανίζονται εδώ.</p>
          </div>
        )}
      </div>

      {configOpen && quickForm && selected ? (
        <div className="fleet-mgmt-modal-backdrop">
          <form onSubmit={saveQuickConfig} className="fleet-mgmt-modal">
            <div className="fleet-mgmt-modal__head">
              <div>
                <h4>Παραμετροποίηση</h4>
                <p>
                  {selected.plate_number} · {selected.make} {selected.model}
                </p>
              </div>
              <button
                type="button"
                className="fleet-mgmt-icon-btn"
                onClick={() => setConfigOpen(false)}
                aria-label="Κλείσιμο"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="fleet-mgmt-form">
              {[
                ['make', 'Μάρκα'],
                ['model', 'Μοντέλο'],
                ['plate_number', 'Πινακίδα'],
                ['vin', 'VIN'],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={quickForm[key]}
                    onChange={(e) => setQuickForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={key !== 'vin'}
                  />
                </label>
              ))}
              <label>
                Κατηγορία
                <select
                  value={quickForm.category}
                  onChange={(e) => setQuickForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {FLEET_VEHICLE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Έτος
                <input
                  type="number"
                  value={quickForm.year}
                  onChange={(e) => setQuickForm((f) => ({ ...f, year: e.target.value }))}
                />
              </label>
              <label>
                Θέσεις
                <input
                  type="number"
                  min={8}
                  max={80}
                  value={quickForm.seat_count}
                  onChange={(e) => setQuickForm((f) => ({ ...f, seat_count: e.target.value }))}
                />
              </label>
              <label>
                Χιλιόμετρα
                <input
                  type="number"
                  min={0}
                  value={quickForm.current_odometer}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, current_odometer: e.target.value }))
                  }
                />
              </label>
              <label>
                Διάστημα service (km)
                <input
                  type="number"
                  min={1000}
                  value={quickForm.service_interval_km}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, service_interval_km: e.target.value }))
                  }
                />
              </label>
              <label>
                Τιμή αγοράς (€)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={quickForm.purchase_price}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, purchase_price: e.target.value }))
                  }
                />
              </label>
              <label className="is-wide">
                Περιγραφή website
                <input
                  value={quickForm.public_summary}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, public_summary: e.target.value }))
                  }
                />
              </label>
              <div className="is-wide" style={{ gridColumn: '1 / -1' }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 650,
                    color: 'var(--fm-secondary)',
                    marginBottom: '0.45rem',
                  }}
                >
                  Παροχές / ανέσεις
                </div>
                <div className="fleet-mgmt-amenity-grid">
                  {AMENITY_PRESETS.map((name) => {
                    const on = quickForm.amenities.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`fleet-mgmt-amenity${on ? ' is-on' : ''}`}
                        onClick={() => toggleAmenity(name)}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="fleet-mgmt-check is-wide">
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
            <div className="fleet-mgmt-modal__foot">
              <button
                type="button"
                className="fleet-mgmt-btn"
                onClick={() => setConfigOpen(false)}
              >
                Άκυρο
              </button>
              <button
                type="submit"
                className="fleet-mgmt-btn fleet-mgmt-btn--accent"
                disabled={quickSaving}
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
