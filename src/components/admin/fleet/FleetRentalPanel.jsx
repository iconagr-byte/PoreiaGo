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
import RentalPaperworkDesk from './RentalPaperworkDesk.jsx';
import RentalDeskBookingWizard from './RentalDeskBookingWizard.jsx';
import RentAppBrandingEditor from './RentAppBrandingEditor.jsx';
import RentPickupLocationsEditor from './RentPickupLocationsEditor.jsx';
import RentCoverageExtrasEditor from './RentCoverageExtrasEditor.jsx';
import RentNotificationsEditor from './RentNotificationsEditor.jsx';
import RentDocumentsPanel from './RentDocumentsPanel.jsx';
import RentExpensesPanel from './RentExpensesPanel.jsx';
import RentAvailabilityPanel from './RentAvailabilityPanel.jsx';
import RentalFocusedInspectionModal from './RentalFocusedInspectionModal.jsx';
import { RENT_DESK_TABS, sanitizeRentDeskTab } from '../../../lib/admin/rentDeskNav.js';
import { resolveOfficeBrand } from '../../../lib/branding/officeBrand.js';
import { fetchAdminSiteAppearance } from '../../../services/siteAppearanceApi.js';
import {
  groupVehiclesByRentCategory,
  rentCategoryLabel,
  RENT_CATEGORY_OPTIONS,
} from '../../../lib/rental/rentVehicleCategories.js';
import { LIVE_REFRESH_MS } from '../../../lib/liveRefresh.js';
import '../../../styles/rental-admin-apple.css';

const TABS = RENT_DESK_TABS;

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
    CLEANING: 'bg-cyan-100 text-cyan-800',
    IN_TRANSIT: 'bg-violet-100 text-violet-800',
    RESERVED: 'bg-indigo-100 text-indigo-800',
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
  activeTab: controlledTab,
  onTabChange,
  hideSideNav = false,
} = {}) {
  const navigate = useNavigate();
  const isControlled = typeof controlledTab === 'string' && typeof onTabChange === 'function';
  const [internalTab, setInternalTab] = useState(() =>
    sanitizeRentDeskTab(typeof initialTab === 'string' ? initialTab : 'clients'),
  );
  const tab = isControlled ? sanitizeRentDeskTab(controlledTab) : internalTab;
  const setTab = (next) => {
    const safe = sanitizeRentDeskTab(next);
    if (isControlled) onTabChange(safe);
    else setInternalTab(safe);
  };
  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  /** Real CRM people (CUST-*) linked to rental bookings — not booking aggregates. */
  const [clients, setClients] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [bookingFilter, setBookingFilter] = useState('ALL');
  const [bookingQuery, setBookingQuery] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const vehicleGroups = useMemo(() => {
    const groups = groupVehiclesByRentCategory(vehicles);
    if (vehicleCategoryFilter === 'ALL') return groups;
    return groups.filter((g) => g.id === vehicleCategoryFilter);
  }, [vehicles, vehicleCategoryFilter]);

  useEffect(() => {
    if (isControlled) return;
    if (typeof initialTab === 'string') {
      setInternalTab(sanitizeRentDeskTab(initialTab));
    }
  }, [initialTab, isControlled]);

  // Wizard state
  const [wiz, setWiz] = useState({
    step: 1,
    start_time: '',
    end_time: '',
    category: '',
    min_seats: 2,
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
  const [officeName, setOfficeName] = useState('Γραφείο ενοικιάσεων');
  const [paperworkFocusId, setPaperworkFocusId] = useState(null);
  /** Focused check-in/out for one booking — not the bulk inspections desk. */
  const [focusedInspection, setFocusedInspection] = useState(null); // { bookingId, type }
  const [inspTypeFilter, setInspTypeFilter] = useState(''); // '' | PICKUP_CHECK | RETURN_CHECK
  const [inspQuery, setInspQuery] = useState('');
  const [expandedInspIds, setExpandedInspIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    fetchAdminSiteAppearance()
      .then((appearance) => {
        if (cancelled) return;
        const brand = resolveOfficeBrand(appearance || {});
        if (brand?.name) setOfficeName(brand.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const openFocusedInspection = (bookingId, inspectionType = 'PICKUP_CHECK') => {
    if (!bookingId) return;
    setFocusedInspection({
      bookingId,
      type: inspectionType === 'RETURN_CHECK' ? 'RETURN_CHECK' : 'PICKUP_CHECK',
    });
  };

  /** From paperwork / agreement — open the single-customer sheet, not bulk desk. */
  const openPaperworkCheckIn = (bookingId, inspectionType = 'PICKUP_CHECK') => {
    openFocusedInspection(bookingId, inspectionType);
  };

  const focusedBooking = useMemo(() => {
    if (!focusedInspection?.bookingId) return null;
    return (bookings || []).find((b) => b.id === focusedInspection.bookingId) || null;
  }, [bookings, focusedInspection]);

  const openPaperwork = (bookingId) => {
    setPaperworkFocusId(bookingId || null);
    setTab('paperwork');
  };

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

  // Soft live refresh on paperwork / inspections — signatures from tablet or remote
  // must appear without a full page reload.
  useEffect(() => {
    if (tab !== 'paperwork' && tab !== 'inspections' && !focusedInspection) return undefined;
    let cancelled = false;
    const softReload = async () => {
      try {
        const [b, i] = await Promise.all([fetchRentalBookings(), fetchRentalInspections()]);
        if (cancelled) return;
        setBookings(b);
        setInspections(i);
      } catch {
        /* keep last good snapshot */
      }
    };
    softReload();
    const id = window.setInterval(softReload, LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tab, focusedInspection]);

  const activeBookings = useMemo(
    () => bookings.filter((b) => ['CONFIRMED', 'ACTIVE'].includes(b.rental_status)),
    [bookings],
  );

  const bookingById = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      if (b?.id) map.set(b.id, b);
    }
    return map;
  }, [bookings]);

  const filteredInspections = useMemo(() => {
    const needle = inspQuery.trim().toLowerCase();
    return (inspections || []).filter((i) => {
      if (inspTypeFilter && i.inspection_type !== inspTypeFilter) return false;
      if (!needle) return true;
      const booking = bookingById.get(i.rental_booking_id);
      const blob = [
        i.inspector_name,
        i.damage_notes,
        i.inspection_type,
        booking?.client_name,
        booking?.vehicle_plate,
        booking?.vehicle_model,
        officeName,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return blob.includes(needle);
    });
  }, [inspections, inspTypeFilter, inspQuery, bookingById, officeName]);

  const toggleInspExpand = (id) => {
    setExpandedInspIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (bookingFilter === 'WALLET') list = list.filter((b) => bookingSource(b) === 'Wallet');
    else if (bookingFilter === 'DESK') list = list.filter((b) => bookingSource(b) === 'Γραφείο');
    else if (bookingFilter === 'ACTIVE') {
      list = list.filter((b) => ['CONFIRMED', 'ACTIVE'].includes(b.rental_status));
    } else if (bookingFilter !== 'ALL') {
      list = list.filter((b) => b.rental_status === bookingFilter);
    }
    const needle = bookingQuery.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((b) => {
      const blob = [
        b.client_name,
        b.client_email,
        b.client_phone,
        b.vehicle_plate,
        b.vehicle_model,
        b.pickup_location,
        b.dropoff_location,
        b.rental_status,
        b.payment_status,
        bookingSource(b),
        officeName,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return blob.includes(needle);
    });
  }, [bookings, bookingFilter, bookingQuery, officeName]);

  const walletBookingCount = useMemo(
    () => bookings.filter((b) => bookingSource(b) === 'Wallet').length,
    [bookings],
  );

  const deskBookingCount = useMemo(
    () => bookings.filter((b) => bookingSource(b) === 'Γραφείο').length,
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
      const booking = await createRentalBooking({
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
      toast.success('Η κράτηση καταχωρήθηκε — άνοιξε Χαρτούρα για υπογραφή');
      setWiz({
        step: 1,
        start_time: '',
        end_time: '',
        category: '',
        min_seats: 2,
        pickup_location: 'Γραφείο',
        dropoff_location: 'Γραφείο',
        client_name: '',
        client_phone: '',
        client_email: '',
        driver_mode: 'SELF_DRIVE',
        vehicle_id: '',
        suggestions: [],
      });
      await reload();
      if (booking?.id) openPaperwork(booking.id);
      else setTab('paperwork');
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
      {focusedInspection && focusedBooking ? (
        <RentalFocusedInspectionModal
          booking={focusedBooking}
          inspectionType={focusedInspection.type}
          officeName={officeName}
          onClose={() => setFocusedInspection(null)}
          onSaved={async () => {
            setFocusedInspection(null);
            await reload();
          }}
          onToast={(kind, message) => {
            if (kind === 'error') toast.error(message);
            else toast.success(message);
          }}
        />
      ) : null}
      <header className="rental-apple-hero">
        <div className="rental-apple-hero-inner">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="rental-apple-icon" aria-hidden>
              <span className="material-symbols-outlined">car_rental</span>
            </div>
            <div className="min-w-0">
              <h2 className="rental-apple-title">Ενοικιάσεις</h2>
              <p className="rental-apple-subtitle">
                Στόλος, κρατήσεις, χαρτούρα συμβολαίων, check-in/out με υπογραφή — GPS μόνο από
                συσκευή στο όχημα (όχι από το κινητό του πελάτη).
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

      <div className={`rental-apple-body${hideSideNav ? ' is-sidebar-driven' : ''}`}>
      {!hideSideNav && (
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
      )}

      <div className="rental-apple-main min-w-0 flex-1 space-y-4">
      {tab === 'clients' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-black/[0.06] p-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Πελάτες ενοικιάσεων</h3>
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
            { label: 'Έτοιμα για κράτηση', value: summary?.bookable ?? summary?.available ?? '—', icon: 'event_available', tone: 'text-emerald-600' },
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
              { id: 'paperwork', label: 'Χαρτούρα συμβολαίων', copy: 'Συμβάσεις · υπογραφές · εκτύπωση PDF', icon: 'description' },
              {
                id: 'payments_settings',
                label: 'Ρυθμίσεις → Πληρωμές',
                copy: 'Προκαταβολή · κάρτα · τράπεζα · μετρητά (ίδιο μενού γραφείου)',
                icon: 'payments',
                designHref: '/admin?tab=settings&sub=payments',
              },
              { id: 'pickups', label: 'Σημεία παραλαβής', copy: 'Γραφείο · αεροδρόμιο · λιμάνι στο /rent', icon: 'location_on' },
              { id: 'branding', label: 'Εμφάνιση /rent', copy: 'Σχεδιασμός σελίδων → Ενοικιάσεις', icon: 'palette', designHref: '/admin?tab=settings&sub=homepage&page=rent' },
              { id: 'vehicles', label: 'Οχήματα ενοικίασης', copy: 'One-way · με οδηγό · GPS device', icon: 'directions_car' },
              { id: 'availability', label: 'Διαθεσιμότητα στόλου', copy: `${summary?.bookable ?? '—'} έτοιμα · ΚΤΕΟ & ασφάλεια`, icon: 'event_available' },
              { id: 'documents', label: 'Έγγραφα οχημάτων', copy: `${summary?.documents_total ?? 0} αρχεία · άδειες / ΚΤΕΟ`, icon: 'folder_managed' },
              { id: 'expenses', label: 'Έξοδα στόλου', copy: `${euro(summary?.expenses_eur)} καταχωρημένα`, icon: 'local_gas_station' },
              { id: 'wizard', label: 'Νέα κράτηση γραφείου', copy: 'Διαθεσιμότητα χωρίς double-booking', icon: 'add_circle' },
              { id: 'inspections', label: 'Check-in / out', copy: 'Selfie ζημιάς · ψηφιακή υπογραφή', icon: 'fact_check' },
              {
                id: 'live_gps',
                label: 'GPS στόλου',
                copy: `${overlays.filter((o) => o.gps_device_id || o.plate_number).length} με συσκευή/πινακίδα`,
                icon: 'my_location',
              },
              { id: 'plans', label: 'Κάρτες τιμών', copy: 'Τιμές marketing στη σελίδα /grafeia', icon: 'sell' },
            ].map((hub) => (
              <button
                key={hub.id}
                type="button"
                onClick={() => {
                  if (hub.designHref) {
                    navigate(hub.designHref);
                    return;
                  }
                  setTab(hub.id);
                }}
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

          {(summary?.compliance_alerts || []).length > 0 ? (
            <div className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-rose-900">ΚΤΕΟ / ασφάλεια — προσεχείς λήξεις</p>
                <button
                  type="button"
                  className="text-xs font-bold text-rose-800 hover:underline"
                  onClick={() => setTab('availability')}
                >
                  Διαθεσιμότητα
                </button>
              </div>
              <ul className="mt-1 text-sm text-rose-900/80 space-y-0.5">
                {summary.compliance_alerts.slice(0, 6).map((a) => (
                  <li key={`${a.vehicle_id}-${a.kind}`}>
                    {a.plate_number} · {a.kind === 'kteo' ? 'ΚΤΕΟ' : 'Ασφάλεια'} ·{' '}
                    {a.days_left < 0 ? `ληγμένο ${Math.abs(a.days_left)}η` : `σε ${a.days_left}η`} ·{' '}
                    {a.due_date}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
                Κατηγορίες όπως στα μεγάλα γραφεία (Mini · Economy · Compact · SUV · Van…).
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
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setVehicleCategoryFilter('ALL')}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                    vehicleCategoryFilter === 'ALL'
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                  }`}
                >
                  Όλες ({vehicles.length})
                </button>
                {groupVehiclesByRentCategory(vehicles).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setVehicleCategoryFilter(g.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                      vehicleCategoryFilter === g.id
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    {g.label} ({g.count})
                  </button>
                ))}
              </div>

              {vehicleGroups.map((group) => (
                <section key={group.id} className="space-y-3">
                  <div className="flex items-start gap-3 px-1">
                    <span className="material-symbols-outlined text-teal-700 mt-0.5">
                      {group.icon}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900">
                        {group.label}{' '}
                        <span className="text-slate-400 font-semibold text-sm">
                          · {group.shortLabel}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">{group.blurb}</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.vehicles.map((v) => (
                      <article
                        key={v.id}
                        className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden flex flex-col"
                      >
                        {v.photo_url || v.photo_urls?.[0] ? (
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
                            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800/80 mt-1">
                              {rentCategoryLabel(v.category)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                              {v.seating_capacity} θέσεις · {euro(v.daily_rate_eur)}/ημέρα
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
                                navigate(
                                  `/admin/fleet-rental/vehicles/${encodeURIComponent(v.id)}/edit`,
                                )
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
                </section>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'wizard' && (
        <RentalDeskBookingWizard
          wiz={wiz}
          setWiz={setWiz}
          busy={busy}
          onSearchAvailability={runAvailability}
          onConfirm={confirmBooking}
          onCancel={() => setTab('bookings')}
        />
      )}

      {tab === 'bookings' && (
        <div className="space-y-3">
          <div className="rounded-[22px] border border-black/[0.06] bg-white/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-[1.05rem] font-bold tracking-tight text-[#1d1d1f]">
                  Κρατήσεις ενοικίασης
                </h3>
                <p className="mt-0.5 text-[0.8125rem] tracking-tight text-[#6e6e73]">
                  {filteredBookings.length} εμφανίζονται · {bookings.length} σύνολο · {officeName}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 rounded-full bg-[#f5f5f7] p-1">
                {[
                  { id: 'ALL', label: `Όλες (${bookings.length})` },
                  { id: 'ACTIVE', label: `Ενεργές (${activeBookings.length})` },
                  { id: 'RESERVED', label: 'Πληρωμή' },
                  { id: 'WALLET', label: `Wallet (${walletBookingCount})` },
                  { id: 'DESK', label: `Γραφείο (${deskBookingCount})` },
                  { id: 'COMPLETED', label: 'Ολοκλ.' },
                  { id: 'CANCELLED', label: 'Ακυρ.' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setBookingFilter(f.id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-tight transition ${
                      bookingFilter === f.id
                        ? 'bg-[#1d1d1f] text-white shadow-sm'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative mt-3">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#86868b]">
                search
              </span>
              <input
                type="search"
                value={bookingQuery}
                onChange={(e) => setBookingQuery(e.target.value)}
                placeholder="Αναζήτηση πελάτη / πινακίδας / τηλεφώνου / γραφείου…"
                className="w-full rounded-full border border-black/[0.08] bg-[#f5f5f7] py-2.5 pl-9 pr-3 text-sm tracking-tight text-[#1d1d1f] outline-none focus:border-[#0a7a6c]/40 focus:bg-white"
              />
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="rounded-[22px] border border-black/[0.06] bg-white p-8 text-center">
              <span className="material-symbols-outlined text-[32px] text-[#c7c7cc]">
                event_note
              </span>
              <p className="mt-2 text-sm tracking-tight text-[#6e6e73]">
                {bookings.length === 0
                  ? 'Καμία κράτηση ακόμα.'
                  : 'Κανένα αποτέλεσμα για τα φίλτρα.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {filteredBookings.map((b) => {
                const source = bookingSource(b);
                const isWallet = source === 'Wallet';
                const plate = b.vehicle_plate || b.vehicle_model || '—';
                const pickup = b.pickup_location || officeName;
                const dropoff =
                  b.dropoff_location && b.dropoff_location !== b.pickup_location
                    ? b.dropoff_location
                    : null;
                const payPending =
                  String(b.payment_status || '').toUpperCase() === 'PENDING' ||
                  b.rental_status === 'RESERVED';
                return (
                  <article
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    title="Διπλό κλικ για άνοιγμα χαρτούρας"
                    onDoubleClick={() => openPaperwork(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openPaperwork(b.id);
                      }
                    }}
                    className="overflow-hidden rounded-[18px] border border-black/[0.07] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition hover:border-black/[0.12] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] cursor-pointer select-none"
                  >
                    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-stretch sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-white ${
                            isWallet ? 'bg-[#0071e3]' : 'bg-[#0a7a6c]'
                          }`}
                          title={source}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {isWallet ? 'account_balance_wallet' : 'storefront'}
                          </span>
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[0.95rem] font-bold tracking-tight text-[#1d1d1f]">
                                {b.client_name || 'Πελάτης'}
                              </p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] tracking-tight text-[#6e6e73]">
                                <span className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-[#1d1d1f]">
                                  <span className="material-symbols-outlined text-[15px] text-[#86868b]">
                                    directions_car
                                  </span>
                                  {plate}
                                </span>
                                <span className="text-[#d2d2d7]">·</span>
                                <span>
                                  {b.driver_mode === 'WITH_DRIVER' ? 'Με οδηγό' : 'Self-drive'}
                                </span>
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-[1.05rem] font-bold tabular-nums tracking-tight text-[#1d1d1f]">
                                {euro(b.total_cost)}
                              </span>
                              {payPending ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-tight text-amber-800">
                                  {b.payment_status || 'PENDING'}
                                </span>
                              ) : b.payment_status ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-tight text-emerald-800">
                                  {b.payment_status}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] tracking-tight text-[#6e6e73]">
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px] text-[#86868b]">
                                calendar_month
                              </span>
                              {formatWhen(b.start_time)}
                              <span className="text-[#c7c7cc]">→</span>
                              {formatWhen(b.end_time)}
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <span className="material-symbols-outlined text-[15px] text-[#86868b]">
                                location_on
                              </span>
                              <span className="truncate">
                                {pickup}
                                {dropoff ? ` → ${dropoff}` : ''}
                              </span>
                            </span>
                          </div>

                          {(b.client_email || b.client_phone) && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] tracking-tight text-[#86868b]">
                              {b.client_email ? (
                                <span className="inline-flex min-w-0 items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">mail</span>
                                  <span className="truncate">{b.client_email}</span>
                                </span>
                              ) : null}
                              {b.client_phone ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">call</span>
                                  {b.client_phone}
                                </span>
                              ) : null}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-tight ${
                                isWallet
                                  ? 'bg-[#0071e3]/10 text-[#0071e3]'
                                  : 'bg-[#0a7a6c]/12 text-[#0a7a6c]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {isWallet ? 'account_balance_wallet' : 'storefront'}
                              </span>
                              {source}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-tight ${statusChip(
                                b.rental_status,
                              )}`}
                            >
                              {b.rental_status}
                            </span>
                            {b.pricing?.is_one_way ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold tracking-tight text-amber-800">
                                One-way
                              </span>
                            ) : null}
                            <span className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-[10px] font-semibold tracking-tight text-[#6e6e73]">
                              {officeName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex shrink-0 flex-wrap items-center gap-2 border-t border-black/[0.05] pt-3 sm:w-[9.5rem] sm:flex-col sm:items-stretch sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-1 rounded-full border border-black/[0.08] bg-[#f5f5f7] px-3 py-2 text-[11px] font-semibold tracking-tight text-[#1d1d1f] transition hover:bg-white"
                          onClick={() => openPaperwork(b.id)}
                        >
                          <span className="material-symbols-outlined text-[15px]">description</span>
                          Χαρτούρα
                        </button>
                        {b.rental_status === 'RESERVED' ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-1 rounded-full bg-[#0a7a6c] px-3 py-2 text-[11px] font-semibold tracking-tight text-white transition hover:bg-[#08665b] disabled:opacity-45"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await updateRentalBookingStatus(b.id, 'CONFIRMED');
                                  toast.success('Πληρωμή επιβεβαιώθηκε');
                                  await reload();
                                } catch (err) {
                                  toast.error(err.message);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              <span className="material-symbols-outlined text-[15px]">payments</span>
                              Επιβεβαίωση
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold tracking-tight text-rose-600 transition hover:bg-rose-50 disabled:opacity-45"
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
                        {b.rental_status === 'CONFIRMED' ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-1 rounded-full bg-[#0a7a6c] px-3 py-2 text-[11px] font-semibold tracking-tight text-white transition hover:bg-[#08665b]"
                              onClick={() => openFocusedInspection(b.id, 'PICKUP_CHECK')}
                            >
                              <span className="material-symbols-outlined text-[15px]">login</span>
                              Check-in
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold tracking-tight text-rose-600 transition hover:bg-rose-50 disabled:opacity-45"
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
                            className="inline-flex items-center justify-center gap-1 rounded-full bg-[#0071e3] px-3 py-2 text-[11px] font-semibold tracking-tight text-white transition hover:bg-[#0062c4]"
                            onClick={() => openFocusedInspection(b.id, 'RETURN_CHECK')}
                          >
                            <span className="material-symbols-outlined text-[15px]">logout</span>
                            Check-out
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'live_gps' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-black/[0.06] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 max-w-2xl">
              <h3 className="font-bold text-gray-900">GPS στόλου ενοικίασης</h3>
              <p className="text-sm text-gray-500 mt-1">
                Ζωντανή θέση μόνο από <strong>συσκευή GPS / πινακίδα στο όχημα</strong> — ποτέ από το
                κινητό του πελάτη. Δεν ζητάμε opt-in τοποθεσίας από τον ενοικιαστή.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Στον χάρτη εμφανίζεται «Ενοικίαση · πινακίδα» (όχι ονοματεπώνυμο πελάτη).
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
              <div className="p-6 space-y-2">
                <p className="text-sm font-semibold text-gray-800">Κανένα όχημα με ενεργό GPS overlay</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Ορίστε <strong>GPS device</strong> (και πινακίδα) στην καρτέλα οχήματος ενοικίασης,
                  μετά κάντε ενεργή κράτηση. Ο πελάτης δεν χρειάζεται να ανοίξει τοποθεσία στο
                  τηλέφωνό του.
                </p>
              </div>
            ) : (
              overlays.map((o) => {
                const fleetId = o.plate_number
                  ? o.plate_number
                  : o.gps_device_id
                    ? `device ${o.gps_device_id}`
                    : 'Όχημα χωρίς ταυτότητα GPS';
                const ready = Boolean(o.gps_device_id || o.plate_number);
                return (
                  <div
                    key={o.booking_id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900">Ενοικίαση · {fleetId}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {o.gps_device_id
                          ? `Συσκευή ${o.gps_device_id}`
                          : 'Χωρίς GPS device — μόνο πινακίδα'}
                        {` · ${o.rental_status}`}
                        {o.driver_mode === 'WITH_DRIVER' ? ' · με οδηγό' : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatWhen(o.start_time)} → {formatWhen(o.end_time)}
                        {o.pickup_location ? ` · ${o.pickup_location}` : ''}
                        {o.client_name ? ` · κράτηση: ${o.client_name}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                        o.gps_device_id
                          ? 'bg-emerald-100 text-emerald-800'
                          : ready
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {o.gps_device_id
                        ? 'Συσκευή GPS'
                        : ready
                          ? 'Πινακίδα'
                          : 'Χωρίς GPS'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'plans' && <RentPlanCardsEditor />}

      {tab === 'documents' && <RentDocumentsPanel />}

      {tab === 'expenses' && <RentExpensesPanel />}

      {tab === 'availability' && (
        <RentAvailabilityPanel
          onOpenVehicles={() => setTab('vehicles')}
          onOpenWizard={() => setTab('wizard')}
        />
      )}

      {tab === 'services' && <RentCoverageExtrasEditor />}

      {tab === 'notifications' && <RentNotificationsEditor />}

      {tab === 'pickups' && <RentPickupLocationsEditor />}

      {tab === 'branding' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setTab('pickups')}
            className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-900 text-sm font-bold hover:bg-teal-100"
          >
            <span className="material-symbols-outlined text-[18px]">location_on</span>
            Σημεία παραλαβής →
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin?tab=settings&sub=homepage&page=rent')}
            className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-900 text-sm font-bold hover:bg-teal-100"
          >
            <span className="material-symbols-outlined text-[18px]">web</span>
            Σχεδιασμός σελίδων → Ενοικιάσεις
          </button>
          <RentAppBrandingEditor />
        </div>
      )}

      {tab === 'paperwork' && (
        <RentalPaperworkDesk
          bookings={bookings}
          vehicles={vehicles}
          inspections={inspections}
          loading={loading}
          officeName={officeName}
          initialBookingId={paperworkFocusId}
          onOpenCheckIn={openPaperworkCheckIn}
          onOpenWizard={() => setTab('wizard')}
          onConsumedFocus={() => setPaperworkFocusId(null)}
          onBookingUpdated={(updated) => {
            if (!updated?.id) return;
            setBookings((prev) => {
              const exists = prev.some((b) => b.id === updated.id);
              if (exists) {
                return prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b));
              }
              return [updated, ...prev];
            });
            void reload();
          }}
          onInspectionsUpdated={(fresh, bookingId) => {
            if (!bookingId || !Array.isArray(fresh)) return;
            setInspections((prev) => {
              const others = (prev || []).filter((i) => i.rental_booking_id !== bookingId);
              return [...fresh, ...others];
            });
          }}
          onToast={(kind, message) => {
            if (kind === 'error') toast.error(message);
            else toast.success(message);
          }}
        />
      )}

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
        <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
          <form
            onSubmit={submitInspection}
            className="lg:col-span-2 space-y-3 rounded-[22px] border border-black/[0.07] bg-white/90 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.045)] backdrop-blur sm:p-5"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#0a7a6c] text-white">
                <span className="material-symbols-outlined text-[20px]">fact_check</span>
              </span>
              <div className="min-w-0">
                <h3 className="text-[1.05rem] font-bold tracking-tight text-[#1d1d1f]">
                  Digital check-in / out
                </h3>
                <p className="mt-0.5 text-[0.8125rem] tracking-tight text-[#6e6e73]">
                  {officeName} · καύσιμο, χλμ., ζημιές και υπογραφή πελάτη
                </p>
              </div>
            </div>

            <label className="block text-[11px] font-semibold tracking-tight text-[#86868b]">
              Κράτηση
              <select
                required
                className="mt-1 w-full rounded-2xl border border-black/[0.08] bg-[#f5f5f7] px-3 py-2.5 text-sm font-semibold tracking-tight text-[#1d1d1f] outline-none focus:border-[#0a7a6c]/40 focus:bg-white"
                value={insp.rental_booking_id}
                onChange={(e) => setInsp((s) => ({ ...s, rental_booking_id: e.target.value }))}
              >
                <option value="">Επιλέξτε…</option>
                {activeBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.client_name} · {b.vehicle_plate} · {b.rental_status}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-1 rounded-full bg-[#f5f5f7] p-1">
              {[
                { id: 'PICKUP_CHECK', label: 'Παραλαβή' },
                { id: 'RETURN_CHECK', label: 'Επιστροφή' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setInsp((s) => ({ ...s, inspection_type: opt.id }))}
                  className={`rounded-full px-3 py-2 text-xs font-semibold tracking-tight transition ${
                    insp.inspection_type === opt.id
                      ? 'bg-[#1d1d1f] text-white shadow-sm'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-semibold tracking-tight text-[#86868b]">
                Καύσιμο %
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded-2xl border border-black/[0.08] bg-[#f5f5f7] px-3 py-2.5 text-sm font-semibold tabular-nums text-[#1d1d1f] outline-none focus:bg-white"
                  value={insp.fuel_level}
                  onChange={(e) => setInsp((s) => ({ ...s, fuel_level: e.target.value }))}
                />
              </label>
              <label className="block text-[11px] font-semibold tracking-tight text-[#86868b]">
                Χιλιόμετρα
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-2xl border border-black/[0.08] bg-[#f5f5f7] px-3 py-2.5 text-sm font-semibold tabular-nums text-[#1d1d1f] outline-none focus:bg-white"
                  value={insp.mileage}
                  onChange={(e) => setInsp((s) => ({ ...s, mileage: e.target.value }))}
                />
              </label>
            </div>

            <label className="block text-[11px] font-semibold tracking-tight text-[#86868b]">
              Ζημιές / σημειώσεις
              <textarea
                rows={3}
                className="mt-1 w-full rounded-2xl border border-black/[0.08] bg-[#f5f5f7] px-3 py-2.5 text-sm font-semibold tracking-tight text-[#1d1d1f] outline-none focus:bg-white"
                value={insp.damage_notes}
                onChange={(e) => setInsp((s) => ({ ...s, damage_notes: e.target.value }))}
                placeholder="π.χ. γρατζουνιά πίσω δεξιά πόρτα"
              />
            </label>

            <label className="block text-[11px] font-semibold tracking-tight text-[#86868b]">
              Φωτογραφία ζημιάς
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
                    className="block h-16 w-16 overflow-hidden rounded-xl border border-black/[0.06]"
                  >
                    <img
                      src={resolveSiteAssetUrl(url)}
                      alt="Damage"
                      className="h-full w-full object-cover"
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

            <label className="block text-[11px] font-semibold tracking-tight text-[#86868b]">
              Υπεύθυνος γραφείου
              <input
                className="mt-1 w-full rounded-2xl border border-black/[0.08] bg-[#f5f5f7] px-3 py-2.5 text-sm font-semibold tracking-tight text-[#1d1d1f] outline-none focus:bg-white"
                value={insp.inspector_name}
                onChange={(e) => setInsp((s) => ({ ...s, inspector_name: e.target.value }))}
                placeholder="Όνομα υπαλλήλου"
              />
            </label>

            <button
              type="submit"
              disabled={busy || uploadingPhoto || uploadingSignature}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold tracking-tight text-white transition hover:bg-black disabled:opacity-45"
            >
              <span className="material-symbols-outlined text-[18px]">
                {busy ? 'progress_activity' : 'save'}
              </span>
              {busy ? 'Αποθήκευση…' : 'Καταχώρηση επιθεώρησης'}
            </button>
          </form>

          <div className="lg:col-span-3 space-y-3">
            <div className="rounded-[22px] border border-black/[0.06] bg-white/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[1.05rem] font-bold tracking-tight text-[#1d1d1f]">
                    Ιστορικό επιθεωρήσεων
                  </h3>
                  <p className="mt-0.5 text-[0.8125rem] tracking-tight text-[#6e6e73]">
                    {filteredInspections.length} από {inspections.length} · {officeName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 rounded-full bg-[#f5f5f7] p-1">
                  {[
                    { id: '', label: 'Όλα' },
                    { id: 'PICKUP_CHECK', label: 'Check-in' },
                    { id: 'RETURN_CHECK', label: 'Check-out' },
                  ].map((f) => (
                    <button
                      key={f.id || 'all'}
                      type="button"
                      onClick={() => setInspTypeFilter(f.id)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-tight transition ${
                        inspTypeFilter === f.id
                          ? 'bg-[#1d1d1f] text-white'
                          : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative mt-3">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#86868b]">
                  search
                </span>
                <input
                  type="search"
                  value={inspQuery}
                  onChange={(e) => setInspQuery(e.target.value)}
                  placeholder="Αναζήτηση πελάτη / πινακίδας / υπευθύνου…"
                  className="w-full rounded-full border border-black/[0.08] bg-[#f5f5f7] py-2.5 pl-9 pr-3 text-sm tracking-tight text-[#1d1d1f] outline-none focus:border-[#0a7a6c]/40 focus:bg-white"
                />
              </div>
            </div>

            {filteredInspections.length === 0 ? (
              <div className="rounded-[22px] border border-black/[0.06] bg-white p-8 text-center">
                <span className="material-symbols-outlined text-[32px] text-[#c7c7cc]">
                  fact_check
                </span>
                <p className="mt-2 text-sm tracking-tight text-[#6e6e73]">
                  {inspections.length === 0
                    ? 'Καμία επιθεώρηση ακόμα.'
                    : 'Κανένα αποτέλεσμα για τα φίλτρα.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {filteredInspections.map((i) => {
                  const booking = bookingById.get(i.rental_booking_id);
                  const isPickup = i.inspection_type === 'PICKUP_CHECK';
                  const expanded = expandedInspIds.has(i.id);
                  const hasExtras =
                    Boolean(i.signature_url) ||
                    Boolean(i.damage_notes) ||
                    (i.photo_urls || []).length > 0;
                  return (
                    <article
                      key={i.id}
                      className="overflow-hidden rounded-[18px] border border-black/[0.07] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
                    >
                      <button
                        type="button"
                        onClick={() => hasExtras && toggleInspExpand(i.id)}
                        className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left ${
                          hasExtras ? 'hover:bg-[#fafafa]' : 'cursor-default'
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
                              isPickup ? 'bg-[#0a7a6c]' : 'bg-[#0071e3]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {isPickup ? 'login' : 'logout'}
                            </span>
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold tracking-tight text-[#1d1d1f]">
                                {isPickup ? 'Check-in' : 'Check-out'}
                              </span>
                              <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-semibold tracking-tight text-[#6e6e73]">
                                {formatWhen(i.created_at)}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[0.84rem] font-semibold tracking-tight text-[#1d1d1f]">
                              {booking?.client_name || 'Κράτηση'}
                              {booking?.vehicle_plate ? (
                                <span className="font-mono text-[12px] font-medium text-[#6e6e73]">
                                  {' '}
                                  · {booking.vehicle_plate}
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-[12px] tracking-tight text-[#6e6e73]">
                              Καύσιμο {i.fuel_level ?? '—'}% · {Number(i.mileage || 0).toLocaleString('el-GR')} km
                              {i.inspector_name ? ` · ${i.inspector_name}` : ''}
                              {' · '}
                              {officeName}
                            </p>
                          </div>
                        </div>
                        {hasExtras ? (
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[#6e6e73] transition ${
                              expanded ? 'rotate-180' : ''
                            }`}
                            aria-hidden
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              expand_more
                            </span>
                          </span>
                        ) : null}
                      </button>

                      {expanded && hasExtras ? (
                        <div className="space-y-2.5 border-t border-black/[0.04] bg-[#fafafa] px-4 py-3">
                          {i.damage_notes ? (
                            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs tracking-tight text-amber-900 ring-1 ring-amber-100">
                              {i.damage_notes}
                            </p>
                          ) : null}
                          {(i.photo_urls || []).length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {i.photo_urls.map((url) => (
                                <a
                                  key={url}
                                  href={resolveSiteAssetUrl(url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-14 w-14 overflow-hidden rounded-xl border border-black/[0.06] bg-white"
                                >
                                  <img
                                    src={resolveSiteAssetUrl(url)}
                                    alt="Damage"
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                          {i.signature_url ? (
                            <div className="rounded-xl border border-black/[0.06] bg-white px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#86868b]">
                                Υπογραφή πελάτη
                              </p>
                              <img
                                src={resolveSiteAssetUrl(i.signature_url)}
                                alt="Υπογραφή"
                                className="mt-1 h-14 w-full object-contain"
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
