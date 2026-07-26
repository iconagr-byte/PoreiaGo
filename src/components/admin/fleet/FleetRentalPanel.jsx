/**
 * Fleet Rental desk — inventory, availability wizard, calendar, inspections.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createRentalBooking,
  createRentalInspection,
  createRentalVehicle,
  deleteRentalVehicle,
  fetchRentalAvailability,
  fetchRentalBookings,
  fetchRentalCalendar,
  fetchRentalInspections,
  fetchRentalSummary,
  fetchRentalVehicles,
  updateRentalBookingStatus,
  updateRentalVehicle,
  uploadRentalInspectionPhoto,
} from '../../../services/fleetRentalApi.js';
import { resolveSiteAssetUrl } from '../../../services/siteAppearanceApi.js';
import RentalSignaturePad from './RentalSignaturePad.jsx';

const CATEGORIES = [
  { value: 'CAR', label: 'Αυτοκίνητο' },
  { value: 'VAN', label: 'Van' },
  { value: 'MINIBUS', label: 'Μινιμπάς' },
];

const TABS = [
  { id: 'overview', label: 'Επισκόπηση', icon: 'dashboard' },
  { id: 'vehicles', label: 'Στόλος ενοικίασης', icon: 'directions_car' },
  { id: 'wizard', label: 'Νέα κράτηση', icon: 'add_circle' },
  { id: 'calendar', label: 'Ημερολόγιο', icon: 'calendar_month' },
  { id: 'inspections', label: 'Check-in / out', icon: 'fact_check' },
];

const EMPTY_VEHICLE = {
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
  notes: '',
};

function euro(n) {
  return `€${Number(n || 0).toFixed(2)}`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusChip(status) {
  const map = {
    AVAILABLE: 'bg-emerald-100 text-emerald-800',
    RENTED: 'bg-sky-100 text-sky-800',
    MAINTENANCE: 'bg-amber-100 text-amber-800',
    IN_TRANSIT: 'bg-violet-100 text-violet-800',
    CONFIRMED: 'bg-sky-100 text-sky-800',
    ACTIVE: 'bg-emerald-100 text-emerald-800',
    COMPLETED: 'bg-gray-100 text-gray-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
    SERVICE_DUE: 'bg-orange-100 text-orange-800',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
}

export default function FleetRentalPanel() {
  const [tab, setTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  // Wizard state
  const [wiz, setWiz] = useState({
    step: 1,
    start_time: '',
    end_time: '',
    category: '',
    min_seats: 5,
    pickup_location: 'Γραφείο',
    dropoff_location: 'Γραφείο',
    client_name: '',
    client_phone: '',
    client_email: '',
    driver_mode: 'SELF_DRIVE',
    vehicle_id: '',
    suggestions: [],
  });

  // Inspection form
  const [insp, setInsp] = useState({
    rental_booking_id: '',
    inspection_type: 'PICKUP_CHECK',
    fuel_level: 100,
    mileage: 0,
    damage_notes: '',
    inspector_name: '',
    photo_urls: [],
    signature_url: '',
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signaturePadKey, setSignaturePadKey] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [s, v, b, c, i] = await Promise.all([
        fetchRentalSummary(),
        fetchRentalVehicles(),
        fetchRentalBookings(),
        fetchRentalCalendar(45),
        fetchRentalInspections(),
      ]);
      setSummary(s);
      setVehicles(v);
      setBookings(b);
      setBlocks(c);
      setInspections(i);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης ενοικιάσεων');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeBookings = useMemo(
    () => bookings.filter((b) => ['CONFIRMED', 'ACTIVE'].includes(b.rental_status)),
    [bookings],
  );

  const saveVehicle = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...vehicleForm,
        seating_capacity: Number(vehicleForm.seating_capacity),
        current_mileage: Number(vehicleForm.current_mileage),
        daily_rate_eur: Number(vehicleForm.daily_rate_eur),
        one_way_surcharge_eur: Number(vehicleForm.one_way_surcharge_eur || 0),
        with_driver_daily_eur: Number(vehicleForm.with_driver_daily_eur || 0),
        gps_device_id: vehicleForm.gps_device_id || null,
        notes: vehicleForm.notes || null,
      };
      if (editingId) await updateRentalVehicle(editingId, body);
      else await createRentalVehicle(body);
      toast.success(editingId ? 'Το όχημα ενημερώθηκε' : 'Το όχημα προστέθηκε');
      setVehicleForm(EMPTY_VEHICLE);
      setEditingId(null);
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runAvailability = async () => {
    if (!wiz.start_time || !wiz.end_time) {
      toast.error('Επιλέξτε ημερομηνίες');
      return;
    }
    setBusy(true);
    try {
      const rows = await fetchRentalAvailability({
        startTime: new Date(wiz.start_time).toISOString(),
        endTime: new Date(wiz.end_time).toISOString(),
        category: wiz.category || undefined,
        minSeats: wiz.min_seats || undefined,
        pickupLocation: wiz.pickup_location,
        dropoffLocation: wiz.dropoff_location || wiz.pickup_location,
        driverMode: wiz.driver_mode,
      });
      setWiz((w) => ({
        ...w,
        suggestions: rows,
        vehicle_id: rows[0]?.id || '',
        step: 2,
      }));
      if (!rows.length) toast.error('Δεν βρέθηκε διαθέσιμο όχημα');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmBooking = async () => {
    if (!wiz.vehicle_id || !wiz.client_name.trim()) {
      toast.error('Επιλέξτε όχημα και πελάτη');
      return;
    }
    setBusy(true);
    try {
      await createRentalBooking({
        vehicle_id: wiz.vehicle_id,
        client_name: wiz.client_name.trim(),
        client_phone: wiz.client_phone || null,
        client_email: wiz.client_email || null,
        start_time: new Date(wiz.start_time).toISOString(),
        end_time: new Date(wiz.end_time).toISOString(),
        pickup_location: wiz.pickup_location,
        dropoff_location: wiz.dropoff_location || wiz.pickup_location,
        driver_mode: wiz.driver_mode,
      });
      toast.success('Η κράτηση ενοικίασης καταχωρήθηκε');
      setWiz((w) => ({ ...w, step: 1, client_name: '', suggestions: [], vehicle_id: '' }));
      setTab('calendar');
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDamagePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadRentalInspectionPhoto(file);
      setInsp((s) => ({
        ...s,
        photo_urls: [...(s.photo_urls || []), uploaded.url],
      }));
      toast.success('Η φωτογραφία ανέβηκε');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onSignatureCommit = async (file) => {
    setUploadingSignature(true);
    try {
      const uploaded = await uploadRentalInspectionPhoto(file);
      setInsp((s) => ({ ...s, signature_url: uploaded.url }));
      toast.success('Η υπογραφή αποθηκεύτηκε');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingSignature(false);
    }
  };

  const submitInspection = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createRentalInspection({
        ...insp,
        fuel_level: Number(insp.fuel_level),
        mileage: Number(insp.mileage),
        photo_urls: insp.photo_urls || [],
        signature_url: insp.signature_url || null,
      });
      toast.success('Η επιθεώρηση καταχωρήθηκε');
      setInsp((s) => ({
        ...s,
        damage_notes: '',
        mileage: 0,
        photo_urls: [],
        signature_url: '',
      }));
      setSignaturePadKey((k) => k + 1);
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-headline-lg text-2xl font-bold tracking-tight text-on-surface">
            Ενοικιάσεις στόλου
          </h2>
          <p className="text-on-surface-variant mt-1 max-w-2xl">
            Cars · Vans · Minibuses — διαθεσιμότητα, κράτηση, check-in/out σε ένα μενού.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="px-4 py-2 rounded-xl border border-black/[0.08] text-sm font-bold hover:bg-white"
        >
          {loading ? 'Φόρτωση…' : 'Ανανέωση'}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-colors ${
              tab === t.id
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-gray-600 border-black/[0.08] hover:border-primary/30'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Διαθέσιμα', value: summary?.available ?? '—', icon: 'check_circle', tone: 'text-emerald-600' },
            { label: 'Σε ενοικίαση', value: summary?.rented ?? '—', icon: 'key', tone: 'text-sky-600' },
            { label: 'Ενεργές κρατήσεις', value: summary?.active_bookings ?? '—', icon: 'event', tone: 'text-violet-600' },
            { label: 'Έσοδα', value: euro(summary?.revenue_eur), icon: 'payments', tone: 'text-amber-600' },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-4"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                <span className={`material-symbols-outlined text-[18px] ${card.tone}`}>{card.icon}</span>
                {card.label}
              </div>
              <p className="text-2xl font-bold mt-2 text-gray-900">{card.value}</p>
            </div>
          ))}
          {(summary?.service_alerts || []).length > 0 ? (
            <div className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-bold text-amber-900">Service alerts (χιλιόμετρα)</p>
              <ul className="mt-1 text-sm text-amber-800 space-y-0.5">
                {summary.service_alerts.map((a) => (
                  <li key={a.vehicle_id}>
                    {a.plate_number} · {a.mileage} km
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="sm:col-span-2 lg:col-span-4 bg-white rounded-2xl border border-black/[0.06] p-4">
            <h3 className="font-bold text-gray-900 mb-3">Επόμενες κρατήσεις</h3>
            {activeBookings.length === 0 ? (
              <p className="text-sm text-gray-500">Καμία ενεργή κράτηση — ξεκινήστε από «Νέα κράτηση».</p>
            ) : (
              <div className="space-y-2">
                {activeBookings.slice(0, 6).map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">
                        {b.client_name} · {b.vehicle_plate || b.vehicle_model}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatWhen(b.start_time)} → {formatWhen(b.end_time)} · {b.pickup_location}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${statusChip(b.rental_status)}`}>
                      {b.rental_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'vehicles' && (
        <div className="grid lg:grid-cols-5 gap-4">
          <form
            onSubmit={saveVehicle}
            className="lg:col-span-2 bg-white rounded-2xl border border-black/[0.06] p-4 space-y-3"
          >
            <h3 className="font-bold text-gray-900">
              {editingId ? 'Επεξεργασία οχήματος' : 'Νέο όχημα ενοικίασης'}
            </h3>
            <label className="block text-xs font-bold text-gray-500">
              Πινακίδα
              <input
                required
                className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                value={vehicleForm.plate_number}
                onChange={(e) => setVehicleForm((f) => ({ ...f, plate_number: e.target.value }))}
              />
            </label>
            <label className="block text-xs font-bold text-gray-500">
              Κατηγορία
              <select
                className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                value={vehicleForm.category}
                onChange={(e) => setVehicleForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-gray-500">
              Μοντέλο
              <input
                required
                className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                placeholder="π.χ. Mercedes Sprinter"
                value={vehicleForm.model}
                onChange={(e) => setVehicleForm((f) => ({ ...f, model: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold text-gray-500">
                Θέσεις
                <input
                  type="number"
                  min={2}
                  max={80}
                  className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                  value={vehicleForm.seating_capacity}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, seating_capacity: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                € / ημέρα
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                  value={vehicleForm.daily_rate_eur}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, daily_rate_eur: e.target.value }))}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold text-gray-500">
                One-way €
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                  value={vehicleForm.one_way_surcharge_eur}
                  onChange={(e) =>
                    setVehicleForm((f) => ({ ...f, one_way_surcharge_eur: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Με οδηγό €/ημέρα
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                  value={vehicleForm.with_driver_daily_eur}
                  onChange={(e) =>
                    setVehicleForm((f) => ({ ...f, with_driver_daily_eur: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold text-gray-500">
                Χιλιόμετρα
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                  value={vehicleForm.current_mileage}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, current_mileage: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Κατάσταση
                <select
                  className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                  value={vehicleForm.current_status}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, current_status: e.target.value }))}
                >
                  {['AVAILABLE', 'RENTED', 'MAINTENANCE', 'IN_TRANSIT'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-bold text-gray-500">
              GPS device / πινακίδα tracker
              <input
                className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-sm font-semibold"
                placeholder="π.χ. ίδια με πινακίδα στον ζωντανό χάρτη"
                value={vehicleForm.gps_device_id}
                onChange={(e) => setVehicleForm((f) => ({ ...f, gps_device_id: e.target.value }))}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold"
              >
                {editingId ? 'Αποθήκευση' : 'Προσθήκη'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="px-3 py-2.5 rounded-xl border text-sm font-bold"
                  onClick={() => {
                    setEditingId(null);
                    setVehicleForm(EMPTY_VEHICLE);
                  }}
                >
                  Άκυρο
                </button>
              ) : null}
            </div>
          </form>

          <div className="lg:col-span-3 space-y-2">
            {vehicles.length === 0 ? (
              <p className="text-sm text-gray-500 bg-white rounded-2xl border p-6">
                Δεν υπάρχουν οχήματα ενοικίασης ακόμα.
              </p>
            ) : (
              vehicles.map((v) => (
                <article
                  key={v.id}
                  className="bg-white rounded-2xl border border-black/[0.06] px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">
                      {v.plate_number}{' '}
                      <span className="text-gray-400 font-semibold">· {v.model}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {v.category} · {v.seating_capacity} θέσεις · {euro(v.daily_rate_eur)}/ημέρα
                      {Number(v.one_way_surcharge_eur) > 0
                        ? ` · one-way ${euro(v.one_way_surcharge_eur)}`
                        : ''}
                      {Number(v.with_driver_daily_eur) > 0
                        ? ` · οδηγός ${euro(v.with_driver_daily_eur)}/ημ`
                        : ''}
                      {` · ${v.current_mileage} km`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${statusChip(v.current_status)}`}>
                      {v.current_status}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-bold text-primary"
                      onClick={() => {
                        setEditingId(v.id);
                        setVehicleForm({
                          plate_number: v.plate_number,
                          category: v.category,
                          model: v.model,
                          seating_capacity: v.seating_capacity,
                          current_status: v.current_status,
                          current_mileage: v.current_mileage,
                          daily_rate_eur: v.daily_rate_eur,
                          one_way_surcharge_eur: v.one_way_surcharge_eur || 0,
                          with_driver_daily_eur: v.with_driver_daily_eur || 0,
                          gps_device_id: v.gps_device_id || '',
                          notes: v.notes || '',
                        });
                      }}
                    >
                      Επεξεργασία
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold text-rose-600"
                      onClick={async () => {
                        if (!window.confirm('Διαγραφή οχήματος;')) return;
                        try {
                          await deleteRentalVehicle(v.id);
                          toast.success('Διαγράφηκε');
                          await reload();
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      Διαγραφή
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'wizard' && (
        <div className="bg-white rounded-2xl border border-black/[0.06] p-5 max-w-3xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
            <span className={wiz.step >= 1 ? 'text-primary' : ''}>1. Ημερομηνίες</span>
            <span>→</span>
            <span className={wiz.step >= 2 ? 'text-primary' : ''}>2. Όχημα</span>
            <span>→</span>
            <span className={wiz.step >= 3 ? 'text-primary' : ''}>3. Πελάτης</span>
          </div>

          {wiz.step === 1 && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-gray-500">
                Παραλαβή
                <input
                  type="datetime-local"
                  required
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.start_time}
                  onChange={(e) => setWiz((w) => ({ ...w, start_time: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Επιστροφή
                <input
                  type="datetime-local"
                  required
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.end_time}
                  onChange={(e) => setWiz((w) => ({ ...w, end_time: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Κατηγορία
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.category}
                  onChange={(e) => setWiz((w) => ({ ...w, category: e.target.value }))}
                >
                  <option value="">Όλες</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Ελάχ. θέσεις
                <input
                  type="number"
                  min={2}
                  max={80}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.min_seats}
                  onChange={(e) => setWiz((w) => ({ ...w, min_seats: Number(e.target.value) }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Σημείο παραλαβής
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.pickup_location}
                  onChange={(e) => setWiz((w) => ({ ...w, pickup_location: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Σημείο επιστροφής
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.dropoff_location}
                  onChange={(e) => setWiz((w) => ({ ...w, dropoff_location: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500 sm:col-span-2">
                Οδηγός
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.driver_mode}
                  onChange={(e) => setWiz((w) => ({ ...w, driver_mode: e.target.value }))}
                >
                  <option value="SELF_DRIVE">Self-drive</option>
                  <option value="WITH_DRIVER">Με οδηγό PoreiaGo</option>
                </select>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={runAvailability}
                className="sm:col-span-2 py-3 rounded-xl bg-primary text-white font-bold"
              >
                Εύρεση διαθέσιμων
              </button>
            </div>
          )}

          {wiz.step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Προτάσεις με βάση θέσεις & τιμή (χωρίς double-booking).
              </p>
              {wiz.suggestions.map((v) => (
                <label
                  key={v.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 cursor-pointer ${
                    wiz.vehicle_id === v.id ? 'border-primary bg-sky-50' : 'border-black/[0.08]'
                  }`}
                >
                  <input
                    type="radio"
                    name="vehicle"
                    checked={wiz.vehicle_id === v.id}
                    onChange={() => setWiz((w) => ({ ...w, vehicle_id: v.id }))}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm">
                      {v.plate_number} · {v.model}
                    </p>
                    <p className="text-xs text-gray-500">
                      {v.category} · {v.seating_capacity} θέσεις · {v.suggested_days} ημέρες ·{' '}
                      {euro(v.suggested_total)}
                      {v.one_way_surcharge > 0 || v.driver_surcharge > 0
                        ? ` (βάση ${euro(v.base_total)}${
                            v.driver_surcharge > 0 ? ` + οδηγός ${euro(v.driver_surcharge)}` : ''
                          }${
                            v.one_way_surcharge > 0 ? ` + one-way ${euro(v.one_way_surcharge)}` : ''
                          })`
                        : ''}
                    </p>
                  </div>
                </label>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border text-sm font-bold"
                  onClick={() => setWiz((w) => ({ ...w, step: 1 }))}
                >
                  Πίσω
                </button>
                <button
                  type="button"
                  disabled={!wiz.vehicle_id}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
                  onClick={() => setWiz((w) => ({ ...w, step: 3 }))}
                >
                  Συνέχεια
                </button>
              </div>
            </div>
          )}

          {wiz.step === 3 && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-gray-500 sm:col-span-2">
                Ονοματεπώνυμο πελάτη
                <input
                  required
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.client_name}
                  onChange={(e) => setWiz((w) => ({ ...w, client_name: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Τηλέφωνο
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.client_phone}
                  onChange={(e) => setWiz((w) => ({ ...w, client_phone: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.client_email}
                  onChange={(e) => setWiz((w) => ({ ...w, client_email: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500 sm:col-span-2">
                Οδηγός
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={wiz.driver_mode}
                  onChange={(e) => setWiz((w) => ({ ...w, driver_mode: e.target.value }))}
                >
                  <option value="SELF_DRIVE">Self-drive</option>
                  <option value="WITH_DRIVER">Με οδηγό PoreiaGo</option>
                </select>
              </label>
              <div className="sm:col-span-2 flex gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border text-sm font-bold"
                  onClick={() => setWiz((w) => ({ ...w, step: 2 }))}
                >
                  Πίσω
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirmBooking}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold"
                >
                  Επιβεβαίωση κράτησης
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.05] flex items-center justify-between">
            <h3 className="font-bold">Ημερολόγιο αξιοποίησης</h3>
            <span className="text-xs text-gray-500">{blocks.length} εγγραφές</span>
          </div>
          <div className="divide-y divide-black/[0.05] max-h-[32rem] overflow-y-auto">
            {blocks.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Δεν υπάρχουν slots ακόμα.</p>
            ) : (
              blocks.map((b) => (
                <div key={b.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900">
                      {b.plate_number || '—'} · {b.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {b.kind === 'rental'
                        ? `${formatWhen(b.start_time)} → ${formatWhen(b.end_time)} · ${b.pickup_location || ''}`
                        : b.title}
                      {b.total_cost != null && b.kind === 'rental' ? ` · ${euro(b.total_cost)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${statusChip(b.status)}`}>
                      {b.status}
                    </span>
                    {b.kind === 'rental' && b.status === 'CONFIRMED' ? (
                      <button
                        type="button"
                        className="text-xs font-bold text-rose-600"
                        onClick={async () => {
                          try {
                            await updateRentalBookingStatus(b.id, 'CANCELLED');
                            toast.success('Ακυρώθηκε');
                            await reload();
                          } catch (err) {
                            toast.error(err.message);
                          }
                        }}
                      >
                        Ακύρωση
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'inspections' && (
        <div className="grid lg:grid-cols-5 gap-4">
          <form
            onSubmit={submitInspection}
            className="lg:col-span-2 bg-white rounded-2xl border p-4 space-y-3"
          >
            <h3 className="font-bold">Digital check-in / check-out</h3>
            <label className="block text-xs font-bold text-gray-500">
              Κράτηση
              <select
                required
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                value={insp.rental_booking_id}
                onChange={(e) => setInsp((s) => ({ ...s, rental_booking_id: e.target.value }))}
              >
                <option value="">Επιλέξτε…</option>
                {bookings
                  .filter((b) => ['CONFIRMED', 'ACTIVE'].includes(b.rental_status))
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.client_name} · {b.vehicle_plate} · {b.rental_status}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-gray-500">
              Τύπος
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                value={insp.inspection_type}
                onChange={(e) => setInsp((s) => ({ ...s, inspection_type: e.target.value }))}
              >
                <option value="PICKUP_CHECK">Παραλαβή (check-in)</option>
                <option value="RETURN_CHECK">Επιστροφή (check-out)</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold text-gray-500">
                Καύσιμο %
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={insp.fuel_level}
                  onChange={(e) => setInsp((s) => ({ ...s, fuel_level: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-gray-500">
                Χιλιόμετρα
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  value={insp.mileage}
                  onChange={(e) => setInsp((s) => ({ ...s, mileage: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-gray-500">
              Ζημιές / σημειώσεις
              <textarea
                rows={3}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                value={insp.damage_notes}
                onChange={(e) => setInsp((s) => ({ ...s, damage_notes: e.target.value }))}
                placeholder="π.χ. γρατζουνιά πίσω δεξιά πόρτα"
              />
            </label>
            <label className="block text-xs font-bold text-gray-500">
              Damage selfie (πριν/μετά)
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="mt-1 w-full text-sm"
                onChange={onDamagePhoto}
                disabled={uploadingPhoto || busy}
              />
            </label>
            {(insp.photo_urls || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {insp.photo_urls.map((url) => (
                  <a
                    key={url}
                    href={resolveSiteAssetUrl(url)}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-16 h-16 rounded-lg overflow-hidden border"
                  >
                    <img
                      src={resolveSiteAssetUrl(url)}
                      alt="Damage"
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : null}
            <RentalSignaturePad
              key={signaturePadKey}
              previewUrl={insp.signature_url ? resolveSiteAssetUrl(insp.signature_url) : null}
              onCommit={onSignatureCommit}
              onClear={() => setInsp((s) => ({ ...s, signature_url: '' }))}
              disabled={busy}
              busy={uploadingSignature}
            />
            <label className="block text-xs font-bold text-gray-500">
              Υπεύθυνος
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                value={insp.inspector_name}
                onChange={(e) => setInsp((s) => ({ ...s, inspector_name: e.target.value }))}
              />
            </label>
            <button
              type="submit"
              disabled={busy || uploadingPhoto || uploadingSignature}
              className="w-full py-2.5 rounded-xl bg-primary text-white font-bold"
            >
              Καταχώρηση επιθεώρησης
            </button>
          </form>
          <div className="lg:col-span-3 space-y-2">
            {inspections.length === 0 ? (
              <p className="text-sm text-gray-500 bg-white rounded-2xl border p-6">
                Καμία επιθεώρηση ακόμα.
              </p>
            ) : (
              inspections.map((i) => (
                <article key={i.id} className="bg-white rounded-2xl border px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm">
                      {i.inspection_type === 'PICKUP_CHECK' ? 'Check-in' : 'Check-out'}
                    </p>
                    <span className="text-[11px] text-gray-400">{formatWhen(i.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Καύσιμο {i.fuel_level}% · {i.mileage} km
                    {i.inspector_name ? ` · ${i.inspector_name}` : ''}
                  </p>
                  {i.damage_notes ? (
                    <p className="text-xs text-amber-800 mt-1 bg-amber-50 rounded-lg px-2 py-1">
                      {i.damage_notes}
                    </p>
                  ) : null}
                  {(i.photo_urls || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {i.photo_urls.map((url) => (
                        <a
                          key={url}
                          href={resolveSiteAssetUrl(url)}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-14 h-14 rounded-lg overflow-hidden border"
                        >
                          <img
                            src={resolveSiteAssetUrl(url)}
                            alt="Damage"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {i.signature_url ? (
                    <div className="mt-2 rounded-lg border bg-slate-50 px-2 py-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        Υπογραφή
                      </p>
                      <img
                        src={resolveSiteAssetUrl(i.signature_url)}
                        alt="Υπογραφή"
                        className="mt-1 h-12 w-full object-contain"
                      />
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
