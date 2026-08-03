import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { createFleetDriver, fetchFleetDrivers } from '../../services/platformApi.js';
import { fileToTripCoverDataUrl, TRIP_COVER_ACCEPT } from '../../lib/trips/tripImage.js';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import LocationPicker from './LocationPicker.jsx';
import HybridCostCalculator from './hybrid/HybridCostCalculator.jsx';
import HybridPassengerManifest from './hybrid/HybridPassengerManifest.jsx';
import HybridCrewEditor from './hybrid/HybridCrewEditor.jsx';
import HybridRoomingExtras from './hybrid/HybridRoomingExtras.jsx';
import HybridSupplierCosts from './hybrid/HybridSupplierCosts.jsx';
import HybridRebookWhatsApp from './hybrid/HybridRebookWhatsApp.jsx';
import {
  MARKET_DOMESTIC,
  MARKET_INTERNATIONAL,
  MARKET_LABELS,
} from '../../lib/trips/tripMarket.js';

const redIcon = L.divIcon({
  className: 'custom-red-pin',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" stroke="white" stroke-width="1.5" class="w-10 h-10 drop-shadow-lg" style="margin-top:-20px; margin-left:-8px;">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});
L.Marker.prototype.options.icon = redIcon;

const DURATION_PRESETS = ['Ημιημερήσια', 'Ημερήσια', '2 ημέρες', '3 ημέρες', 'Weekend', 'Πολυήμερη'];
const BADGE_PRESETS = ['Προτεινόμενη', 'Νέα', 'Last seats', 'Early bird'];
const HIGHLIGHT_SUGGESTIONS = ['Ξενάγηση', 'Γεύμα', 'Wi‑Fi', 'A/C', 'USB φόρτιση', 'Ασφάλεια'];

const VEHICLE_TYPE_OPTIONS = [
  { value: 'Luxury Coach', label: 'Luxury Coach (50 θέσεις)' },
  { value: 'Premium Express', label: 'Premium Express (30 θέσεις)' },
  { value: 'VIP Minibus', label: 'VIP Minibus (15 θέσεις)' },
];

const emptyFleetRow = () => ({
  driverId: '',
  driverName: '',
  vehicleType: 'Luxury Coach',
  vehiclePlate: '',
  vehicleCode: '',
});

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400';

function Section({ icon, title, hint, children, action }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/80">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-slate-500">{icon}</span>
            {title}
          </h3>
          {hint ? <p className="text-xs text-slate-500 mt-0.5">{hint}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-slate-400 mt-1">{hint}</span> : null}
    </label>
  );
}

/** Minimal inline create — name only (optional phone / plate). */
function QuickAddDriverPanel({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    const clean = name.trim();
    if (clean.length < 2) {
      toast.error('Γράψτε το όνομα του οδηγού');
      return;
    }
    setBusy(true);
    try {
      const stamp = Date.now().toString(36).slice(-6);
      const slug =
        clean
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '')
          .slice(0, 14) || 'driver';
      const created = await createFleetDriver({
        name: clean,
        license_no: `TMP${stamp}`.toUpperCase().slice(0, 12),
        phone: phone.trim(),
        email: `${slug}.${stamp}@drivers.poreiago.com`,
        status: 'active',
        license_plate: plate.trim() || null,
        vehicle_code: plate.trim() || null,
        password: 'driver123',
        hiring_date: new Date().toISOString().slice(0, 10),
      });
      toast.success('Ο οδηγός προστέθηκε — μπορείτε να συμπληρώσετε στοιχεία αργότερα στους Οδηγούς');
      onCreated?.(created);
      setName('');
      setPhone('');
      setPlate('');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία δημιουργίας οδηγού');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 space-y-3">
      <p className="text-xs font-bold text-teal-900">Νέος οδηγός (μόνο όνομα αρκεί)</p>
      <div className="grid sm:grid-cols-3 gap-2">
        <input
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Όνομα επώνυμο *"
          autoFocus
          minLength={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <input
          className={fieldClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Τηλέφωνο (προαιρετικό)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
        />
        <input
          className={`${fieldClass} font-mono`}
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="Πινακίδα (προαιρετικό)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          {busy ? 'Αποθήκευση…' : 'Προσθήκη οδηγού'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-xl border text-xs font-bold text-slate-600"
        >
          Άκυρο
        </button>
      </div>
    </div>
  );
}

export default function TripForm({
  formData,
  setFormData,
  activeStopId,
  setActiveStopId,
  onSubmit,
  onCancel,
  isEdit,
  saving = false,
  tripId = null,
}) {
  const [drivers, setDrivers] = useState([]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [highlightDraft, setHighlightDraft] = useState('');
  const [quickAddFor, setQuickAddFor] = useState(null); // 'primary' | number index | null

  useEffect(() => {
    fetchFleetDrivers().then(setDrivers);
  }, []);

  useEffect(() => {
    if (!drivers.length || formData.driverId) return;
    const byName = drivers.find((d) => d.name === formData.driverName);
    const byPlate =
      formData.vehiclePlate && drivers.find((d) => d.license_plate === formData.vehiclePlate);
    const match = byName || byPlate;
    if (match) {
      setFormData((prev) => ({ ...prev, driverId: match.id }));
    }
  }, [drivers, formData.driverId, formData.driverName, formData.vehiclePlate, setFormData]);

  const patch = (partial) => setFormData((prev) => ({ ...prev, ...partial }));
  const assignableDrivers = drivers.filter((d) => ['active', 'on_leave'].includes(d.status));
  const highlights = Array.isArray(formData.highlights) ? formData.highlights : [];
  const isInternational = formData.market === MARKET_INTERNATIONAL;
  const isDraft = formData.status === 'draft';

  const handleDriverChange = (driverId, list = drivers) => {
    if (!driverId) {
      patch({ driverId: '', driverName: '', vehiclePlate: '', vehicleCode: '' });
      return;
    }
    const driver = list.find((d) => d.id === driverId);
    if (!driver) return;
    patch({
      driverId: driver.id,
      driverName: driver.name,
      vehiclePlate: driver.license_plate || formData.vehiclePlate || '',
      vehicleCode: driver.vehicle_code || formData.vehicleCode || '',
    });
  };

  const additionalFleet = Array.isArray(formData.additionalFleet) ? formData.additionalFleet : [];

  const setAdditionalFleet = (next) => patch({ additionalFleet: next });

  const addFleetUnit = () => {
    setAdditionalFleet([...additionalFleet, emptyFleetRow()]);
    setQuickAddFor(additionalFleet.length);
  };

  /** Extra coach/plate row without opening the quick-add driver form. */
  const addVehicleUnit = () => {
    setAdditionalFleet([...additionalFleet, emptyFleetRow()]);
    setQuickAddFor(null);
  };

  const onQuickDriverCreated = async (created, target) => {
    let list = drivers;
    try {
      list = await fetchFleetDrivers();
    } catch {
      /* keep current list */
    }
    if (created?.id && !list.some((d) => d.id === created.id)) {
      list = [...list, created];
    }
    setDrivers(list);
    const id = created?.id;
    if (!id) {
      setQuickAddFor(null);
      return;
    }
    if (target === 'primary') {
      handleDriverChange(id, list);
    } else if (typeof target === 'number') {
      assignAdditionalDriver(target, id, list);
    }
    setQuickAddFor(null);
  };

  const updateAdditionalFleet = (index, partial) => {
    setAdditionalFleet(
      additionalFleet.map((row, i) => (i === index ? { ...row, ...partial } : row)),
    );
  };

  const assignAdditionalDriver = (index, driverId, list = drivers) => {
    if (!driverId) {
      updateAdditionalFleet(index, {
        driverId: '',
        driverName: '',
        vehiclePlate: '',
        vehicleCode: '',
      });
      return;
    }
    const driver = list.find((d) => d.id === driverId);
    if (!driver) return;
    updateAdditionalFleet(index, {
      driverId: driver.id,
      driverName: driver.name,
      vehiclePlate: driver.license_plate || additionalFleet[index]?.vehiclePlate || '',
      vehicleCode: driver.vehicle_code || additionalFleet[index]?.vehicleCode || '',
    });
  };

  const removeAdditionalFleet = (index) => {
    setAdditionalFleet(additionalFleet.filter((_, i) => i !== index));
  };

  const usedDriverIds = new Set(
    [formData.driverId, ...additionalFleet.map((r) => r.driverId)].filter(Boolean),
  );

  const handleAddStop = () => {
    const newId = Date.now();
    patch({
      stops: [
        ...(formData.stops || []),
        { id: newId, name: '', lat: 38.0, lng: 23.0, time: '12:00', image: null, description: '' },
      ],
    });
    setActiveStopId(newId);
  };

  const handleRemoveStop = (id) => {
    patch({ stops: formData.stops.filter((s) => s.id !== id) });
    if (activeStopId === id) setActiveStopId(null);
  };

  const handleUpdateStop = (id, field, value) => {
    patch({
      stops: formData.stops.map((s) =>
        s.id === id
          ? { ...s, [field]: field === 'lat' || field === 'lng' ? parseFloat(value) : value }
          : s,
      ),
    });
  };

  const handleCoverImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      toast.error('Το αρχείο είναι πολύ μεγάλο (μέγ. 12MB)');
      return;
    }
    setCoverUploading(true);
    try {
      const dataUrl = await fileToTripCoverDataUrl(file);
      patch({ image: dataUrl });
      toast.success('Η φωτογραφία ενημερώθηκε');
    } catch (err) {
      toast.error(
        err.message?.includes('large')
          ? 'Η εικόνα είναι πολύ μεγάλη — δοκιμάστε μικρότερο αρχείο'
          : 'Αποτυχία ανεβάσματος εικόνας',
      );
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  };

  const addHighlight = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return;
    if (highlights.some((h) => h.toLowerCase() === value.toLowerCase())) {
      setHighlightDraft('');
      return;
    }
    patch({ highlights: [...highlights, value] });
    setHighlightDraft('');
  };

  const removeHighlight = (value) => {
    patch({ highlights: highlights.filter((h) => h !== value) });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => patch({ status: 'published' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              !isDraft ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Δημοσιευμένη
          </button>
          <button
            type="button"
            onClick={() => patch({ status: 'draft' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              isDraft ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Πρόχειρο
          </button>
          <button
            type="button"
            onClick={() => patch({ featured: !formData.featured })}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              formData.featured
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">star</span>
            Προτεινόμενη
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {isDraft ? 'Δεν εμφανίζεται στο storefront' : 'Εμφανίζεται στην αρχική'}
        </p>
      </div>

      <Section icon="info" title="Βασικά στοιχεία" hint="Τίτλος, αγορά και περιγραφή για το storefront.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Αγορά">
            <select
              value={formData.market || MARKET_DOMESTIC}
              onChange={(e) =>
                patch({
                  market: e.target.value,
                  ...(e.target.value === MARKET_DOMESTIC ? { destination: '' } : {}),
                })
              }
              className={fieldClass}
            >
              <option value={MARKET_DOMESTIC}>{MARKET_LABELS[MARKET_DOMESTIC]}</option>
              <option value={MARKET_INTERNATIONAL}>{MARKET_LABELS[MARKET_INTERNATIONAL]}</option>
            </select>
          </Field>
          {isInternational ? (
            <Field label="Προορισμός">
              <input
                type="text"
                value={formData.destination || ''}
                onChange={(e) => patch({ destination: e.target.value })}
                className={fieldClass}
                placeholder="π.χ. Παρίσι, Γαλλία"
              />
            </Field>
          ) : (
            <Field label="Διάρκεια">
              <select
                value={formData.durationLabel || 'Ημερήσια'}
                onChange={(e) => patch({ durationLabel: e.target.value })}
                className={fieldClass}
              >
                {DURATION_PRESETS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label="Όνομα εκδρομής">
          <input
            required
            type="text"
            value={formData.title}
            onChange={(e) => patch({ title: e.target.value })}
            className={fieldClass}
            placeholder="π.χ. Ημερήσια στα Μετέωρα"
          />
        </Field>

        <Field label="Περιγραφή" hint="Εμφανίζεται στη σελίδα λεπτομερειών.">
          <textarea
            rows={4}
            value={formData.description}
            onChange={(e) => patch({ description: e.target.value })}
            className={`${fieldClass} resize-y min-h-[96px]`}
            placeholder="Περιγράψτε την εμπειρία…"
          />
        </Field>

        {isInternational && (
          <Field label="Διάρκεια">
            <select
              value={formData.durationLabel || 'Ημερήσια'}
              onChange={(e) => patch({ durationLabel: e.target.value })}
              className={fieldClass}
            >
              {DURATION_PRESETS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        )}
      </Section>

      <Section icon="photo_camera" title="Εικόνα & κάρτα" hint="Η φωτογραφία εμφανίζεται στην αρχική σελίδα.">
        <div className="grid lg:grid-cols-[220px_1fr] gap-5">
          <div
            className={`relative h-44 rounded-xl overflow-hidden border border-dashed flex items-center justify-center ${
              formData.image ? 'border-slate-200' : 'border-slate-300 bg-slate-50'
            }`}
          >
            {formData.image ? (
              <img src={formData.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400">
                <span className="material-symbols-outlined text-[28px] opacity-50">image</span>
                <span className="text-xs font-medium">Χωρίς εικόνα</span>
              </div>
            )}
            {coverUploading && (
              <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-slate-700">
                  progress_activity
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer hover:bg-slate-800">
                <span className="material-symbols-outlined text-[18px]">upload</span>
                {formData.image ? 'Αλλαγή' : 'Ανέβασμα'}
                <input
                  type="file"
                  accept={TRIP_COVER_ACCEPT}
                  className="hidden"
                  disabled={coverUploading}
                  onChange={handleCoverImageUpload}
                />
              </label>
              {formData.image && (
                <button
                  type="button"
                  onClick={() => patch({ image: '' })}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50"
                >
                  Αφαίρεση
                </button>
              )}
            </div>

            <Field label="Κείμενο στην κάρτα" hint="Μικρό hook πάνω στην εικόνα.">
              <input
                type="text"
                value={formData.hook || ''}
                onChange={(e) => patch({ hook: e.target.value })}
                className={fieldClass}
                placeholder="π.χ. Ανακαλύψτε τη μαγεία των βράχων"
              />
            </Field>

            <Field label="Badge στην κάρτα">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => patch({ badge: '' })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    !formData.badge ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  Κανένα
                </button>
                {BADGE_PRESETS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => patch({ badge: b })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      formData.badge === b
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.badge || ''}
                onChange={(e) => patch({ badge: e.target.value })}
                className={fieldClass}
                placeholder="Ή γράψτε δικό σας…"
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section icon="schedule" title="Ημερομηνίες & σημείο" hint="Αναχώρηση, άφιξη και meeting point.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Αναχώρηση">
            <input
              required
              type="datetime-local"
              value={formData.departureTime}
              onChange={(e) => patch({ departureTime: e.target.value })}
              className={fieldClass}
            />
          </Field>
          <Field label="Άφιξη / επιστροφή" hint="Προαιρετικό">
            <input
              type="datetime-local"
              value={formData.arrivalTime || ''}
              onChange={(e) => patch({ arrivalTime: e.target.value })}
              className={fieldClass}
            />
          </Field>
          <Field label="Σημείο συνάντησης" className="sm:col-span-2">
            <input
              type="text"
              value={formData.meetingPoint || ''}
              onChange={(e) => patch({ meetingPoint: e.target.value })}
              className={fieldClass}
              placeholder="π.χ. Πλατεία Συντάγματος, στάση μετρό"
            />
          </Field>
        </div>
      </Section>

      <Section icon="payments" title="Τιμές & θέσεις">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Τιμή ενηλίκου (€)">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => patch({ price: e.target.value })}
              className={fieldClass}
            />
          </Field>
          <Field label="Παιδική τιμή (€)" hint="Κενό = ίδια με ενήλικα">
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.childPrice ?? ''}
              onChange={(e) => patch({ childPrice: e.target.value })}
              className={fieldClass}
              placeholder="προαιρετικό"
            />
          </Field>
          <Field label="Διαθέσιμες θέσεις">
            <input
              required
              type="number"
              min="0"
              value={formData.availableSeats}
              onChange={(e) => patch({ availableSeats: e.target.value })}
              className={fieldClass}
            />
          </Field>
          <Field label="Συνολική χωρητικότητα">
            <input
              type="number"
              min="0"
              value={formData.totalSeats || formData.availableSeats || ''}
              onChange={(e) => patch({ totalSeats: e.target.value })}
              className={fieldClass}
            />
          </Field>
        </div>
      </Section>

      <Section
        icon="checklist"
        title="Παροχές / highlights"
        hint="Εμφανίζονται ως tags στη σελίδα εκδρομής."
      >
        <div className="flex flex-wrap gap-1.5">
          {HIGHLIGHT_SUGGESTIONS.map((s) => {
            const on = highlights.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => (on ? removeHighlight(s) : addHighlight(s))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                  on
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={highlightDraft}
            onChange={(e) => setHighlightDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addHighlight(highlightDraft);
              }
            }}
            className={fieldClass}
            placeholder="Προσθήκη παροχής + Enter"
          />
          <button
            type="button"
            onClick={() => addHighlight(highlightDraft)}
            className="shrink-0 px-4 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200"
          >
            Προσθήκη
          </button>
        </div>
        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {highlights.map((h) => (
              <span
                key={h}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                {h}
                <button
                  type="button"
                  onClick={() => removeHighlight(h)}
                  className="text-slate-400 hover:text-rose-600"
                  aria-label={`Αφαίρεση ${h}`}
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section
        icon="badge"
        title="Οδηγοί & λεωφορεία"
        hint="Προσθέστε οδηγό ή όχημα — το ένα δεν απαιτεί το άλλο."
        action={
          <Link
            to="/admin"
            state={{ activeTab: 'drivers' }}
            className="text-xs font-bold text-sky-700 hover:underline"
          >
            Διαχείριση οδηγών
          </Link>
        }
      >
        <div className="space-y-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Κύριος οδηγός
              </p>
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                #1
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Field label="Οδηγός">
                  <select
                    value={formData.driverId || ''}
                    onChange={(e) => {
                      handleDriverChange(e.target.value);
                      setQuickAddFor(null);
                    }}
                    className={fieldClass}
                  >
                    <option value="">— Επιλέξτε οδηγό —</option>
                    {assignableDrivers
                      .filter((d) => d.id === formData.driverId || !usedDriverIds.has(d.id))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                          {d.license_plate || d.vehicle_code
                            ? ` · ${d.license_plate || d.vehicle_code}`
                            : ''}
                          {d.status === 'on_leave' ? ' (άδεια)' : ''}
                        </option>
                      ))}
                  </select>
                </Field>
                {quickAddFor === 'primary' ? (
                  <QuickAddDriverPanel
                    onCreated={(created) => onQuickDriverCreated(created, 'primary')}
                    onCancel={() => setQuickAddFor(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuickAddFor('primary')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    + Νέος οδηγός
                  </button>
                )}
              </div>
              <Field label="Τύπος οχήματος" hint="Προαιρετικό">
                <select
                  value={formData.vehicleType}
                  onChange={(e) => patch({ vehicleType: e.target.value })}
                  className={fieldClass}
                >
                  {VEHICLE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Πινακίδα" hint="Προαιρετικό">
                <input
                  type="text"
                  value={formData.vehiclePlate || ''}
                  onChange={(e) => patch({ vehiclePlate: e.target.value })}
                  className={`${fieldClass} font-mono`}
                  placeholder="π.χ. XAH-4021"
                />
              </Field>
            </div>
          </article>

          {additionalFleet.map((row, index) => (
            <article
              key={`fleet-extra-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {row.driverId || row.driverName ? 'Επιπλέον οδηγός' : 'Επιπλέον όχημα'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    #{index + 2}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      removeAdditionalFleet(index);
                      setQuickAddFor((cur) =>
                        cur === index ? null : typeof cur === 'number' && cur > index ? cur - 1 : cur,
                      );
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Αφαίρεση
                  </button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Field label="Οδηγός">
                    <select
                      value={row.driverId || ''}
                      onChange={(e) => {
                        assignAdditionalDriver(index, e.target.value);
                        setQuickAddFor(null);
                      }}
                      className={fieldClass}
                    >
                      <option value="">— Επιλέξτε οδηγό —</option>
                      {assignableDrivers
                        .filter((d) => d.id === row.driverId || !usedDriverIds.has(d.id))
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                            {d.license_plate || d.vehicle_code
                              ? ` · ${d.license_plate || d.vehicle_code}`
                              : ''}
                            {d.status === 'on_leave' ? ' (άδεια)' : ''}
                          </option>
                        ))}
                    </select>
                  </Field>
                  {quickAddFor === index ? (
                    <QuickAddDriverPanel
                      onCreated={(created) => onQuickDriverCreated(created, index)}
                      onCancel={() => setQuickAddFor(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setQuickAddFor(index)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900"
                    >
                      <span className="material-symbols-outlined text-[16px]">person_add</span>
                      + Νέος οδηγός
                    </button>
                  )}
                </div>
                <Field label="Τύπος οχήματος" hint="Προαιρετικό">
                  <select
                    value={row.vehicleType || 'Luxury Coach'}
                    onChange={(e) => updateAdditionalFleet(index, { vehicleType: e.target.value })}
                    className={fieldClass}
                  >
                    {VEHICLE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Πινακίδα" hint="Προαιρετικό">
                  <input
                    type="text"
                    value={row.vehiclePlate || ''}
                    onChange={(e) => updateAdditionalFleet(index, { vehiclePlate: e.target.value })}
                    className={`${fieldClass} font-mono`}
                    placeholder="π.χ. XAH-4021"
                  />
                </Field>
              </div>
            </article>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addFleetUnit}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-700 hover:border-teal-500 hover:text-teal-800 hover:bg-teal-50/50"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Προσθήκη οδηγού
            </button>
            <button
              type="button"
              onClick={addVehicleUnit}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-700 hover:border-teal-500 hover:text-teal-800 hover:bg-teal-50/50"
            >
              <span className="material-symbols-outlined text-[18px]">directions_bus</span>
              Προσθήκη οχήματος
            </button>
          </div>
        </div>
      </Section>

      <Section
        icon="groups"
        title="Πλήρωμα εκδρομής"
        hint="Tour leader, οδηγός και ξεναγός για το hybrid πρόγραμμα."
      >
        <HybridCrewEditor formData={formData} setFormData={setFormData} />
      </Section>

      <Section
        icon="calculate"
        title="Αυτόματο κόστος & yield"
        hint="Συγκεντρώνει fuel/rental ground + group PNR και προτείνει τιμή ανά άτομο."
      >
        <HybridCostCalculator formData={formData} setFormData={setFormData} />
      </Section>

      <Section
        icon="airline_seat_recline_extra"
        title="Ενιαίο manifest (λεωφορείο + πτήση)"
        hint="Χαρτογράφηση θέσης λεωφορείου, θέσης πτήσης και PNR/ticket ανά επιβάτη."
        action={
          tripId ? (
            <a
              href={`/tour-leader/${tripId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[16px]">luggage</span>
              Tour leader
            </a>
          ) : null
        }
      >
        <HybridPassengerManifest formData={formData} setFormData={setFormData} tripId={tripId} />
      </Section>

      <Section
        icon="bed"
        title="Rooming & extras"
        hint="Δωμάτια ξενοδοχείου και ασφάλεια / έξτρα ανά επιβάτη."
      >
        <HybridRoomingExtras formData={formData} setFormData={setFormData} />
      </Section>

      <Section
        icon="receipt_long"
        title="Supplier cost sheets"
        hint="Κόστος αεροπορικής / λεωφορείου / ξενοδοχείου με αναφορά αρχείου."
      >
        <HybridSupplierCosts formData={formData} setFormData={setFormData} />
      </Section>

      <Section
        icon="sms"
        title="Rebook & WhatsApp templates"
        hint="Πρόταση εναλλακτικής πτήσης και εγκεκριμένα πρότυπα μηνυμάτων."
      >
        <HybridRebookWhatsApp formData={formData} setFormData={setFormData} tripId={tripId} />
      </Section>

      <Section
        icon="route"
        title="Διαδρομή & στάσεις"
        hint="Κάντε κλικ στον χάρτη για να ορίσετε τοποθεσία."
        action={
          <button
            type="button"
            onClick={handleAddStop}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Νέα στάση
          </button>
        }
      >
        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            {(formData.stops || []).length === 0 ? (
              <p className="text-sm text-slate-500 italic py-8 text-center border border-dashed border-slate-200 rounded-xl">
                Δεν έχουν προστεθεί στάσεις ακόμα.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {formData.stops.map((stop, index) => (
                  <div
                    key={stop.id}
                    onClick={() => setActiveStopId(stop.id)}
                    className={`rounded-xl border p-3 cursor-pointer transition ${
                      activeStopId === stop.id
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                          activeStopId === stop.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        required
                        value={stop.name}
                        onChange={(e) => handleUpdateStop(stop.id, 'name', e.target.value)}
                        className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                        placeholder="Όνομα στάσης"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="time"
                        required
                        value={stop.time}
                        onChange={(e) => handleUpdateStop(stop.id, 'time', e.target.value)}
                        className="w-[7.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveStop(stop.id);
                        }}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="h-[360px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <MapContainer center={[38.5, 23.0]} zoom={6} className="h-full w-full">
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <LocationPicker activeStopId={activeStopId} setFormData={setFormData} />
              {(formData.stops || []).map((stop) => (
                <Marker key={stop.id} position={[stop.lat, stop.lng]} />
              ))}
            </MapContainer>
          </div>
        </div>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100"
        >
          Ακύρωση
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">
            {saving ? 'hourglass_empty' : 'save'}
          </span>
          {saving ? 'Αποθήκευση…' : isEdit ? 'Αποθήκευση αλλαγών' : 'Δημιουργία εκδρομής'}
        </button>
      </div>
    </form>
  );
}
