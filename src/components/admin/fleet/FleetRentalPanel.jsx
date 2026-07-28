/**
 * Fleet Rental desk — inventory, availability wizard, calendar, inspections.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  createRentalBooking,
  createRentalInspection,
  deleteRentalVehicle,
  fetchRentalAvailability,
  fetchRentalBookings,
  fetchRentalCalendar,
  fetchRentalInspections,
  fetchRentalLiveOverlays,
  fetchRentalSummary,
  fetchRentalVehicles,
  updateRentalBookingStatus,
  uploadRentalInspectionPhoto,
} from '../../../services/fleetRentalApi.js';
import { resolveSiteAssetUrl } from '../../../services/siteAppearanceApi.js';
import {
  ensureCustomerForRental,
  getCustomerByEmail,
  getCustomerById,
  syncCustomersFromRentalBookings,
} from '../../../lib/customers/customerStore.js';
import RentalSignaturePad from './RentalSignaturePad.jsx';
import RentalCalendarBoard from './RentalCalendarBoard.jsx';
import RentAppShareBanner from './RentAppShareBanner.jsx';
import RentPlanCardsEditor from './RentPlanCardsEditor.jsx';
import '../../../styles/rental-admin-apple.css';

const CATEGORIES = [
  { value: 'CAR', label: 'Αυτοκίνητο' },
  { value: 'VAN', label: 'Van' },
  { value: 'MINIBUS', label: 'Μινιμπάς' },
];

const TABS = [
  { id: 'clients', label: 'Πελάτες', icon: 'groups' },
  { id: 'bookings', label: 'Κρατήσεις', icon: 'event_note' },
  { id: 'overview', label: 'Επισκόπηση', icon: 'dashboard' },
  { id: 'vehicles', label: 'Στόλος', icon: 'directions_car' },
  { id: 'wizard', label: 'Νέα κράτηση', icon: 'add_circle' },
  { id: 'calendar', label: 'Ημερολόγιο', icon: 'calendar_month' },
  { id: 'inspections', label: 'Check-in / out', icon: 'fact_check' },
  { id: 'live_gps', label: 'Ζωντανά GPS', icon: 'my_location' },
  { id: 'plans', label: 'Συμβόλαια Rent', icon: 'sell' },
];

function bookingSource(b) {
  const channel = String(b?.channel || '').toUpperCase();
  if (channel === 'WALLET') return 'Wallet';
  if (channel === 'DESK') return 'Γραφείο';
  if (b?.client_email) return 'Wallet';
  return 'Γραφείο';
}

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

export default function FleetRentalPanel({
  onOpenLiveMap,
  onOpenCustomer,
  initialTab,
} = {}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() =>
    typeof initialTab === 'string' && TABS.some((t) => t.id === initialTab)
      ? initialTab
      : 'clients',
  );
  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  /** Real CRM people (CUST-*) linked to rental bookings — not booking aggregates. */
  const [clients, setClients] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [bookingFilter, setBookingFilter] = useState('ALL');
  const [clientQuery, setClientQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof initialTab === 'string' && TABS.some((t) => t.id === initialTab)) {
      setTab(initialTab);
    }
  }, [initialTab]);

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
      const [s, v, b, c, i, o] = await Promise.all([
        fetchRentalSummary(),
        fetchRentalVehicles(),
        fetchRentalBookings(),
        fetchRentalCalendar(120),
        fetchRentalInspections(),
        fetchRentalLiveOverlays().catch(() => []),
      ]);
      setSummary(s);
      setVehicles(v);
      setBookings(b);
      // Upsert CRM people from bookings — Πελάτες = φυσικά πρόσωπα, όχι μόνο κρατήσεις.
      const synced = syncCustomersFromRentalBookings(b);
      setClients(synced.people);
      setBlocks(c);
      setInspections(i);
      setOverlays(o);
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

  const filteredBookings = useMemo(() => {
    if (bookingFilter === 'ALL') return bookings;
    if (bookingFilter === 'WALLET') return bookings.filter((b) => bookingSource(b) === 'Wallet');
    if (bookingFilter === 'DESK') return bookings.filter((b) => bookingSource(b) === 'Γραφείο');
    if (bookingFilter === 'ACTIVE') {
      return bookings.filter((b) => ['CONFIRMED', 'ACTIVE'].includes(b.rental_status));
    }
    return bookings.filter((b) => b.rental_status === bookingFilter);
  }, [bookings, bookingFilter]);

  const walletBookingCount = useMemo(
    () => bookings.filter((b) => bookingSource(b) === 'Wallet').length,
    [bookings],
  );

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const hay = [c.name, c.email, c.phone, c.id, c.last_rental_vehicle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, clientQuery]);

  const openClientBookings = (client) => {
    setBookingFilter('ALL');
    setTab('bookings');
    // Keep filter soft — bookings list still shows all; user sees person via CRM card.
    if (client?.email) {
      toast.success(`Πελάτης: ${client.name || client.email}`);
    }
  };

  const openCrmProfile = (client) => {
    const person =
      (client?.id && getCustomerById(client.id)) ||
      (client?.email && getCustomerByEmail(client.email)) ||
      client;
    if (!person) {
      toast.error('Δεν βρέθηκε καρτέλα πελάτη');
      return;
    }
    if (onOpenCustomer) {
      onOpenCustomer(person);
      return;
    }
    openClientBookings(person);
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
    const email = String(wiz.client_email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Απαιτείται email πελάτη — δημιουργείται καρτέλα φυσικού προσώπου');
      return;
    }
    setBusy(true);
    try {
      const person = ensureCustomerForRental({
        name: wiz.client_name.trim(),
        email,
        phone: wiz.client_phone || '',
      });
      await createRentalBooking({
        vehicle_id: wiz.vehicle_id,
        client_id: person?.id || null,
        client_name: wiz.client_name.trim(),
        client_phone: wiz.client_phone || null,
        client_email: email,
        channel: 'DESK',
        start_time: new Date(wiz.start_time).toISOString(),
        end_time: new Date(wiz.end_time).toISOString(),
        pickup_location: wiz.pickup_location,
        dropoff_location: wiz.dropoff_location || wiz.pickup_location,
        driver_mode: wiz.driver_mode,
      });
      toast.success(
        person
          ? `Κράτηση + πελάτης ${person.id}`
          : 'Η κράτηση ενοικίασης καταχωρήθηκε',
      );
      setWiz((w) => ({
        ...w,
        step: 1,
        client_name: '',
        client_email: '',
        client_phone: '',
        suggestions: [],
        vehicle_id: '',
      }));
      setTab('clients');
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
    <div className="rental-apple-shell space-y-4 animate-in fade-in duration-300">
      <header className="rental-apple-hero">
        <div className="rental-apple-hero-inner">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="rental-apple-icon" aria-hidden>
              <span className="material-symbols-outlined">car_rental</span>
            </div>
            <div className="min-w-0">
              <h2 className="rental-apple-title">Ενοικιάσεις</h2>
              <p className="rental-apple-subtitle">
                Στόλος, κρατήσεις γραφείου &amp; Wallet, check-in/out, υπογραφή και ζωντανό GPS —
                όλα σε μία οθόνη.
              </p>
            </div>
          </div>
          <button type="button" onClick={reload} className="rental-apple-refresh">
            <span
              className={`material-symbols-outlined${loading ? ' animate-spin' : ''}`}
              aria-hidden
            >
              {loading ? 'progress_activity' : 'refresh'}
            </span>
            {loading ? 'Φόρτωση…' : 'Ανανέωση'}
          </button>
        </div>
      </header>

      <div className="rental-apple-body">
      <nav className="rental-apple-nav-wrap" aria-label="Μενού ενοικιάσεων">
        <div className="rental-apple-nav" role="tablist" aria-orientation="vertical">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rental-apple-nav-btn${tab === t.id ? ' is-active' : ''}`}
            >
              <span className="material-symbols-outlined" aria-hidden>
                {t.icon}
              </span>
              <span className="rental-apple-nav-label">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="rental-apple-main min-w-0 flex-1 space-y-4">
      {tab === 'clients' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-black/[0.06] p-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Πελάτες (φυσικά πρόσωπα)</h3>
              <p className="text-sm text-gray-500 mt-1">
                Καρτέλες CRM με κωδικό CUST — χωριστά από τις κρατήσεις ({clients.length}).
              </p>
            </div>
            <label className="block text-xs font-bold text-gray-500 min-w-[12rem] flex-1 max-w-sm">
              Αναζήτηση
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                placeholder="Όνομα, email, CUST-…"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="bg-white rounded-2xl border border-black/[0.06] divide-y divide-black/[0.05]">
            {loading ? (
              <p className="p-6 text-sm text-gray-500">Φόρτωση…</p>
            ) : filteredClients.length === 0 ? (
              <div className="p-6 space-y-2">
                <p className="text-sm font-bold text-gray-800">Δεν υπάρχουν πελάτες ακόμα</p>
                <p className="text-sm text-gray-500">
                  Με κάθε κράτηση (γραφείο ή Wallet) δημιουργείται καρτέλα προσώπου στο πελατολόγιο.
                  Απαιτείται email.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold"
                    onClick={() => setTab('wizard')}
                  >
                    Νέα κράτηση γραφείου
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border text-xs font-bold"
                    onClick={() => setTab('bookings')}
                  >
                    Δες κρατήσεις
                  </button>
                </div>
              </div>
            ) : (
              filteredClients.map((c) => (
                <article
                  key={c.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {String(c.name || '?').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.email}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </p>
                      <p className="text-[11px] font-mono text-gray-400 mt-0.5">{c.id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.rental_booking_count} ενοικιάσεις
                        {c.rental_active_count ? ` · ${c.rental_active_count} ενεργές` : ''}
                        {` · ${euro(c.rental_spent_eur)}`}
                        {c.last_rental_vehicle ? ` · ${c.last_rental_vehicle}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(c.rental_channels || []).map((ch) => (
                          <span
                            key={ch}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
                          >
                            {ch === 'WALLET' ? 'Wallet' : 'Γραφείο'}
                          </span>
                        ))}
                        {c.last_rental_status ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusChip(c.last_rental_status)}`}
                          >
                            {c.last_rental_status}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-bold text-primary"
                      onClick={() => openCrmProfile(c)}
                    >
                      Καρτέλα
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold text-gray-600"
                      onClick={() => openClientBookings(c)}
                    >
                      Κρατήσεις
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

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

          <div className="sm:col-span-2 lg:col-span-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { id: 'clients', label: 'Πελάτες ενοικίασης', copy: `${clients.length} πελάτες · γραφείο + Wallet`, icon: 'groups' },
              { id: 'bookings', label: 'Όλες οι κρατήσεις', copy: `${walletBookingCount} από Wallet · ${bookings.length} σύνολο`, icon: 'event_note' },
              { id: 'vehicles', label: 'Στόλος & τιμές', copy: 'One-way · με οδηγό · GPS device', icon: 'directions_car' },
              { id: 'wizard', label: 'Νέα κράτηση γραφείου', copy: 'Διαθεσιμότητα χωρίς double-booking', icon: 'add_circle' },
              { id: 'inspections', label: 'Check-in / out', copy: 'Selfie ζημιάς · ψηφιακή υπογραφή', icon: 'fact_check' },
              { id: 'live_gps', label: 'Ζωντανά GPS', copy: `${overlays.length} ενεργά για χάρτη`, icon: 'my_location' },
              { id: 'plans', label: 'Συμβόλαια Rent', copy: 'Επεξεργασία καρτών /grafeia', icon: 'sell' },
            ].map((hub) => (
              <button
                key={hub.id}
                type="button"
                onClick={() => setTab(hub.id)}
                className="text-left bg-white rounded-2xl border border-black/[0.06] px-4 py-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">{hub.icon}</span>
                  <p className="font-bold text-sm text-gray-900">{hub.label}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">{hub.copy}</p>
              </button>
            ))}
          </div>

          <RentAppShareBanner />

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
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-gray-900">Επόμενες κρατήσεις</h3>
              <button
                type="button"
                className="text-xs font-bold text-primary"
                onClick={() => setTab('bookings')}
              >
                Όλες
              </button>
            </div>
            {activeBookings.length === 0 ? (
              <p className="text-sm text-gray-500">Καμία ενεργή κράτηση — ξεκινήστε από «Νέα κράτηση» ή το Wallet.</p>
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
                        {` · ${bookingSource(b)}`}
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-black/[0.06] px-4 py-3">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900">Στόλος ενοικίασης</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Ανοίξτε κανονική σελίδα για όλα τα στοιχεία, περιγραφή και φωτογραφίες.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin/fleet-rental/vehicles/new')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:opacity-95"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Νέο όχημα
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/[0.06] p-8 text-center space-y-3">
              <p className="text-sm text-gray-500">Δεν υπάρχουν οχήματα ενοικίασης ακόμα.</p>
              <button
                type="button"
                onClick={() => navigate('/admin/fleet-rental/vehicles/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold"
              >
                <span className="material-symbols-outlined text-[18px]">directions_car</span>
                Προσθήκη πρώτου οχήματος
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {vehicles.map((v) => (
                <article
                  key={v.id}
                  className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden flex flex-col"
                >
                  {(v.photo_url || v.photo_urls?.[0]) ? (
                    <img
                      src={v.photo_url || v.photo_urls[0]}
                      alt=""
                      className="w-full h-36 object-cover bg-gray-50"
                    />
                  ) : (
                    <div className="w-full h-36 bg-slate-50 flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined text-4xl">directions_car</span>
                    </div>
                  )}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-gray-900 truncate">
                          {v.plate_number}{' '}
                          <span className="text-gray-400 font-semibold">· {v.model}</span>
                        </p>
                        <span
                          className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${statusChip(v.current_status)}`}
                        >
                          {v.current_status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {v.category} · {v.seating_capacity} θέσεις · {euro(v.daily_rate_eur)}/ημέρα
                        {Number(v.one_way_surcharge_eur) > 0
                          ? ` · one-way ${euro(v.one_way_surcharge_eur)}`
                          : ''}
                        {Number(v.with_driver_daily_eur) > 0
                          ? ` · οδηγός ${euro(v.with_driver_daily_eur)}/ημ`
                          : ''}
                        {` · ${v.current_mileage} km`}
                      </p>
                      {v.description ? (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{v.description}</p>
                      ) : (
                        <p className="text-xs text-amber-700/80 mt-2">Χωρίς περιγραφή για πελάτες</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1">
                        {v.photo_urls?.length || (v.photo_url ? 1 : 0)} φωτογραφίες
                      </p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="flex-1 min-w-[7rem] text-xs font-bold text-white bg-primary rounded-xl px-3 py-2.5"
                        onClick={() =>
                          navigate(`/admin/fleet-rental/vehicles/${encodeURIComponent(v.id)}/edit`)
                        }
                      >
                        Επεξεργασία
                      </button>
                      <button
                        type="button"
                        className="text-xs font-bold text-rose-600 border border-rose-100 rounded-xl px-3 py-2.5"
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
                  </div>
                </article>
              ))}
            </div>
          )}
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
                Email πελάτη *
                <input
                  type="email"
                  required
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  placeholder="για καρτέλα φυσικού προσώπου"
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

      {tab === 'bookings' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: `Όλες (${bookings.length})` },
              { id: 'ACTIVE', label: `Ενεργές (${activeBookings.length})` },
              { id: 'WALLET', label: `Wallet (${walletBookingCount})` },
              { id: 'DESK', label: 'Γραφείο' },
              { id: 'COMPLETED', label: 'Ολοκληρωμένες' },
              { id: 'CANCELLED', label: 'Ακυρωμένες' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setBookingFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  bookingFilter === f.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-black/[0.08]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-black/[0.06] divide-y divide-black/[0.05]">
            {filteredBookings.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Καμία κράτηση σε αυτό το φίλτρο.</p>
            ) : (
              filteredBookings.map((b) => (
                <article key={b.id} className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-bold text-sm text-gray-900">
                      {b.client_name} · {b.vehicle_plate || b.vehicle_model || '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatWhen(b.start_time)} → {formatWhen(b.end_time)}
                      {b.pickup_location
                        ? ` · ${b.pickup_location}${
                            b.dropoff_location && b.dropoff_location !== b.pickup_location
                              ? ` → ${b.dropoff_location}`
                              : ''
                          }`
                        : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {euro(b.total_cost)}
                      {b.driver_mode === 'WITH_DRIVER' ? ' · με οδηγό' : ' · self-drive'}
                      {b.client_email ? ` · ${b.client_email}` : ''}
                      {b.client_phone ? ` · ${b.client_phone}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {bookingSource(b)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusChip(b.rental_status)}`}>
                        {b.rental_status}
                      </span>
                      {b.pricing?.is_one_way ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          One-way
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {b.rental_status === 'CONFIRMED' ? (
                      <>
                        <button
                          type="button"
                          className="text-xs font-bold text-primary"
                          onClick={() => {
                            setInsp((s) => ({ ...s, rental_booking_id: b.id, inspection_type: 'PICKUP_CHECK' }));
                            setTab('inspections');
                          }}
                        >
                          Check-in
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-rose-600"
                          disabled={busy}
                          onClick={async () => {
                            if (!window.confirm('Ακύρωση κράτησης;')) return;
                            setBusy(true);
                            try {
                              await updateRentalBookingStatus(b.id, 'CANCELLED');
                              toast.success('Ακυρώθηκε');
                              await reload();
                            } catch (err) {
                              toast.error(err.message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Ακύρωση
                        </button>
                      </>
                    ) : null}
                    {b.rental_status === 'ACTIVE' ? (
                      <button
                        type="button"
                        className="text-xs font-bold text-primary"
                        onClick={() => {
                          setInsp((s) => ({ ...s, rental_booking_id: b.id, inspection_type: 'RETURN_CHECK' }));
                          setTab('inspections');
                        }}
                      >
                        Check-out
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'live_gps' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-black/[0.06] p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Ζωντανά GPS ενοικιάσεων</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Ενεργές κρατήσεις με πινακίδα / GPS device εμφανίζονται στον ζωντανό χάρτη ως
                «Ενοικίαση · πελάτης».
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLiveMap?.()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">map</span>
              Άνοιγμα ζωντανού χάρτη
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-black/[0.06] divide-y divide-black/[0.05]">
            {overlays.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                Καμία ενεργή ενοικίαση για overlay. Ορίστε GPS device ή πινακίδα στο όχημα και κάντε
                κράτηση.
              </p>
            ) : (
              overlays.map((o) => (
                <div key={o.booking_id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900">{o.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {o.plate_number || '—'}
                      {o.gps_device_id ? ` · device ${o.gps_device_id}` : ' · χωρίς gps_device_id'}
                      {` · ${o.rental_status}`}
                      {o.driver_mode === 'WITH_DRIVER' ? ' · με οδηγό' : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatWhen(o.start_time)} → {formatWhen(o.end_time)}
                      {o.pickup_location ? ` · ${o.pickup_location}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                      o.gps_device_id || o.plate_number
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {o.gps_device_id || o.plate_number ? 'Έτοιμο για χάρτη' : 'Χωρίς GPS'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'plans' && <RentPlanCardsEditor />}

      {tab === 'calendar' && (
        <RentalCalendarBoard
          bookings={bookings}
          blocks={blocks}
          loading={loading}
          onCancelBooking={async (bookingId) => {
            try {
              await updateRentalBookingStatus(bookingId, 'CANCELLED');
              toast.success('Ακυρώθηκε');
              await reload();
            } catch (err) {
              toast.error(err.message);
            }
          }}
        />
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
      </div>
    </div>
  );
}
