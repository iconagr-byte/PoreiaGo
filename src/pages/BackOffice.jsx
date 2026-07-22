import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { mockFleet } from '../data/mockData';
import { fetchAllLostItems, updateLostItemStatus } from '../services/lostItemsApi.js';
import { loadAllCustomers, getCustomerByEmail } from '../lib/customers/customerStore.js';
import { loadBookings, cancelBooking } from '../lib/ticketing/bookingStore.js';
import { patchAdminBooking } from '../services/adminBookingsApi.js';
import { loadMergedBookings } from '../lib/ticketing/bookingMerge.js';
import { adminScanTicket, ensureDriverSession } from '../services/ticketingApi.js';
import { SCAN_RESULT } from '../lib/ticketing/constants.js';
import BookingDetailPanel from '../components/booking/BookingDetailPanel.jsx';
import RecordCashPaymentModal from '../components/admin/RecordCashPaymentModal.jsx';
import FiscalMarkCell from '../components/admin/FiscalMarkCell.jsx';
import toast, { Toaster } from 'react-hot-toast';
import BusQrScanner from '../components/BusQrScanner.jsx';
import FleetLiveMapWebSocket from '../components/admin/FleetLiveMapWebSocket.jsx';
import FleetRouteHistory from '../components/admin/FleetRouteHistory.jsx';
import FleetKpisDashboard from '../components/admin/FleetKpisDashboard.jsx';
import ActiveDriversList from '../components/admin/ActiveDriversList.jsx';
import { FleetTelemetryProvider } from '../context/FleetTelemetryContext.jsx';
import ImpersonationBanner from '../components/admin/ImpersonationBanner.jsx';
import SettingsHub from '../components/admin/SettingsHub.jsx';
import CustomerBookingCard from '../components/admin/CustomerBookingCard.jsx';
import { isPaid, isConfirmed, canRecordCashPayment } from '../lib/bookingDisplay.js';
import { recordCashPayment } from '../lib/ticketing/bookingStore.js';
import { DEFAULT_PAYMENT_SECURITY } from '../lib/payments/paymentSecurity.js';
import { deleteTrip as removeTripFromStore, loadTrips, getTripById } from '../lib/trips/tripStore.js';
import { ticketPrintPath } from '../lib/ticketing/printTicket.js';
import {
  getTripMarket,
  MARKET_DOMESTIC,
  MARKET_INTERNATIONAL,
  MARKET_LABELS,
} from '../lib/trips/tripMarket.js';
import {
  createMaintenanceEvent,
  fetchFleetAlerts,
  fetchFleetCostReport,
  fetchFleetDashboard,
  fetchFleetDepreciation,
  deleteFleetVehicle,
  fetchFleetVehicles,
  fetchMaintenanceEvents,
  scanFleetAlerts,
  uploadMaintenanceAttachment,
} from '../services/platformApi.js';
import { clearSaasSession, getSaasToken } from '../services/saasApi.js';
import { DEFAULT_TENANT_SETTINGS_TAB, DEFAULT_PLATFORM_TAB, sanitizeSettingsSubTab } from '../lib/admin/settingsTabs.js';
import { isSaasSuperAdmin, isSaasTokenExpired } from '../lib/saasJwt.js';
import { exportTripManifestPdf } from '../lib/manifest/exportManifestPdf.js';
import FleetAlertsPanel from '../components/admin/FleetAlertsPanel.jsx';
import EmailHub from '../components/admin/email/EmailHub.jsx';
import EmailTemplatesPage from '../components/admin/email/EmailTemplatesPage.jsx';
import { applyStitchTemplate } from '../lib/email/stitchTemplates.js';
import DriversHub from '../components/admin/DriversHub.jsx';
import SortableSidebarNav from '../components/admin/SortableSidebarNav.jsx';
import DashboardKpiCard from '../components/admin/DashboardKpiCard.jsx';
import TemplateSearch from '../components/admin/TemplateSearch.jsx';
import { avatarColorClass } from '../lib/admin/avatarColors.js';
import { computeDashboardKpis } from '../lib/admin/dashboardKpis.js';

function bookingStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('επιβεβ') || s.includes('confirm')) {
    return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80';
  }
  if (s.includes('εκκρεμ') || s.includes('pending')) {
    return 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80';
  }
  if (s.includes('ολοκληρ') || s.includes('complete') || s.includes('checked')) {
    return 'bg-sky-50 text-sky-900 ring-1 ring-sky-200/80';
  }
  if (s.includes('ακυρ') || s.includes('cancel')) {
    return 'bg-rose-50 text-rose-800 ring-1 ring-rose-200/80';
  }
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80';
}

export default function BackOffice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('tab');
    return fromQuery || location.state?.activeTab || 'dashboard';
  });
  const [settingsSubTab, setSettingsSubTab] = useState(() => {
    const fromState = location.state?.settingsSubTab || location.state?.platformTab;
    if (fromState) return sanitizeSettingsSubTab(fromState, isSaasSuperAdmin());
    return isSaasSuperAdmin() ? DEFAULT_PLATFORM_TAB : DEFAULT_TENANT_SETTINGS_TAB;
  });
  const [trips, setTrips] = useState(() => loadTrips());
  const [routesMarket, setRoutesMarket] = useState(MARKET_DOMESTIC);
  const [lostItems, setLostItems] = useState([]);
  const [lostItemsLoading, setLostItemsLoading] = useState(false);
  const [bookings, setBookings] = useState(() => loadBookings());
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [scanFlash, setScanFlash] = useState(null);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab) setActiveTab(tab === 'live_tracking' ? 'fleet_live_map' : tab);
  }, [location.search]);

  // Legacy «Live GPS (poll)» → Ζωντανός Χάρτης (ένα μενού, όχι διπλό).
  useEffect(() => {
    if (activeTab === 'live_tracking') setActiveTab('fleet_live_map');
  }, [activeTab]);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    const token = getSaasToken();
    if (role !== 'admin' || !token) {
      navigate('/admin/login');
      return;
    }
    if (isSaasTokenExpired(token)) {
      clearSaasSession();
      localStorage.removeItem('userRole');
      navigate('/admin/login', { replace: true, state: { reason: 'session_expired' } });
      return;
    }
    ensureDriverSession();
  }, [navigate]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
    if (location.state?.settingsSubTab || location.state?.platformTab) {
      setSettingsSubTab(
        sanitizeSettingsSubTab(
          location.state.settingsSubTab || location.state.platformTab,
          isSaasSuperAdmin(),
        ),
      );
    }
    if (location.state?.activeTab === 'email') {
      setEmailIntent({
        hubTab: location.state.emailHubTab || 'mailbox',
        ...(location.state?.emailCompose ? { compose: location.state.emailCompose } : {}),
      });
    }
    if (
      location.state?.routesMarket === MARKET_DOMESTIC ||
      location.state?.routesMarket === MARKET_INTERNATIONAL
    ) {
      setRoutesMarket(location.state.routesMarket);
    }
    setTrips(loadTrips());
  }, [location.state?.activeTab, location.state?.settingsSubTab, location.state?.routesMarket, location.key]);

  useEffect(() => {
    if (activeTab !== 'bookings' && activeTab !== 'dashboard') return;
    let cancelled = false;
    setBookingsLoading(true);
    loadMergedBookings()
      .then((merged) => {
        if (!cancelled) setBookings(merged);
      })
      .finally(() => {
        if (!cancelled) setBookingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, location.key]);

  useEffect(() => {
    if (activeTab !== 'lost_found') return;
    let cancelled = false;
    setLostItemsLoading(true);
    fetchAllLostItems()
      .then((items) => {
        if (!cancelled) setLostItems(items);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.message);
          setLostItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLostItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, location.key]);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cashPaymentBooking, setCashPaymentBooking] = useState(null);
  const [cashPaymentSaving, setCashPaymentSaving] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [expandedTripBookings, setExpandedTripBookings] = useState(null);
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [fleetCards, setFleetCards] = useState(null);
  const [fleetAlerts, setFleetAlerts] = useState([]);
  const [selectedFleetVehicleId, setSelectedFleetVehicleId] = useState(null);
  const [fleetVehicleEvents, setFleetVehicleEvents] = useState([]);
  const [fleetCostReport, setFleetCostReport] = useState(null);
  const [fleetDepreciation, setFleetDepreciation] = useState(null);
  const [emailIntent, setEmailIntent] = useState(null);

  useEffect(() => {
    const bookingId = location.state?.bookingId;
    const bookingPnr = location.state?.bookingPnr;
    if (location.state?.activeTab !== 'bookings' || (!bookingId && !bookingPnr)) return;
    const found = bookings.find(
      (b) =>
        (bookingId && b.id === bookingId) ||
        (bookingPnr && (b.pnr === bookingPnr || b.id === bookingPnr)),
    );
    if (found) setSelectedBooking(found);
  }, [
    location.state?.activeTab,
    location.state?.bookingId,
    location.state?.bookingPnr,
    bookings,
  ]);

  const openEmailHub = ({ to = '', subject = '', hubTab = 'mailbox' } = {}) => {
    setSelectedBooking(null);
    setSelectedCustomer(null);
    const toAddr = String(to).trim();
    const subj = String(subject).trim();
    setEmailIntent({
      hubTab,
      ...(toAddr || subj ? { compose: { to: toAddr, subject: subj } } : {}),
    });
    setActiveTab('email');
  };

  const goToEmailMailbox = () => {
    setEmailIntent({ hubTab: 'mailbox' });
    setActiveTab('email');
  };

  const useEmailTemplate = (tpl) => {
    if (!tpl) return;
    const draft = applyStitchTemplate(tpl);
    setEmailIntent({ hubTab: 'marketing', initialDraft: draft });
    setActiveTab('email');
    toast.success(`Φορτώθηκε το πρότυπο «${tpl.name}» — νέα καμπάνια`);
  };

  const openEmailFromBooking = (booking) => {
    if (!booking) return;
    const title = booking.tripTitle || 'Κράτηση';
    openEmailHub({
      to: booking.email,
      subject: `${title} — #${booking.id || booking.pnr || ''}`.replace(/—\s*$/, '').trim(),
    });
  };

  const openCustomerProfile = (booking) => {
    if (!booking) return;
    const fromMock = getCustomerByEmail(booking.email) ||
      loadAllCustomers().find(
        (c) =>
          c.id === booking.customerId ||
          (booking.customerName && c.name === booking.customerName),
      );
    const customer = fromMock || {
      id: booking.customerId || `guest-${booking.email || booking.id}`,
      name: booking.customerName || 'Άγνωστος πελάτης',
      email: booking.email || '',
      points: 0,
      tier: 'Silver',
      joinDate: '—',
    };
    setSelectedBooking(null);
    setSelectedCustomer(customer);
    setActiveTab('customers');
  };

  const openBookingTicket = (booking) => {
    setSelectedCustomer(null);
    setActiveTab('bookings');
    setSelectedBooking(booking);
  };

  const applyBookingUpdate = (updated) => {
    if (!updated?.id) return;
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
    setSelectedBooking((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  };

  const handleQuickCashPayment = async (payload) => {
    if (!cashPaymentBooking) return;
    setCashPaymentSaving(true);
    try {
      const updated = await recordCashPayment(cashPaymentBooking.id, payload);
      applyBookingUpdate(updated);
      toast.success('Η είσπραξη μετρητών καταχωρήθηκε');
      setCashPaymentBooking(null);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία καταχώρησης μετρητών');
    } finally {
      setCashPaymentSaving(false);
    }
  };

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    vehicle_id: '',
    mileage: '',
    service_type: 'έλεγχος',
    description: '',
    cost: '',
    shop_or_mechanic: '',
    parts_replaced: '',
    driver_name: '',
  });
  const [serviceFiles, setServiceFiles] = useState([]);
  const [deletingFleetId, setDeletingFleetId] = useState(null);

  const reloadFleetData = async (nextSelectedId) => {
    const [vehicles, cards, alerts] = await Promise.all([
      fetchFleetVehicles(),
      fetchFleetDashboard(),
      fetchFleetAlerts(true),
    ]);
    setFleetVehicles(vehicles);
    setFleetCards(cards);
    setFleetAlerts(alerts);
    const pickId =
      nextSelectedId && vehicles.some((v) => v.id === nextSelectedId)
        ? nextSelectedId
        : vehicles[0]?.id || null;
    setSelectedFleetVehicleId(pickId);
    if (pickId) {
      setServiceForm((prev) => ({ ...prev, vehicle_id: pickId }));
    }
  };

  const handleDeleteFleetVehicle = async (e, vehicleId, vehicleLabel) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Διαγραφή οχήματος «${vehicleLabel}» (${vehicleId}); Η ενέργεια δεν αναιρείται.`,
      )
    ) {
      return;
    }
    setDeletingFleetId(vehicleId);
    try {
      await deleteFleetVehicle(vehicleId);
      const remainingId =
        selectedFleetVehicleId === vehicleId ? null : selectedFleetVehicleId;
      await reloadFleetData(remainingId);
      toast.success('Το όχημα διαγράφηκε');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingFleetId(null);
    }
  };

  useEffect(() => {
    if (activeTab !== 'fleet') return;
    Promise.all([fetchFleetVehicles(), fetchFleetDashboard(), fetchFleetAlerts(true)])
      .then(([vehicles, cards, alerts]) => {
        setFleetVehicles(vehicles);
        setFleetCards(cards);
        setFleetAlerts(alerts);
        if (vehicles.length) {
          const firstId = selectedFleetVehicleId || vehicles[0].id;
          setSelectedFleetVehicleId(firstId);
          setServiceForm((prev) => ({ ...prev, vehicle_id: firstId }));
        }
      })
      .catch(() => {
        /* fallback to local mock data */
      });
  }, [activeTab, selectedFleetVehicleId]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || fleetVehicles.length) return;
    fetchFleetVehicles()
      .then(setFleetVehicles)
      .catch(() => {});
  }, [activeTab, fleetVehicles.length]);

  useEffect(() => {
    if (activeTab !== 'fleet') return;
    if (!selectedFleetVehicleId) return;
    const toIso = (d) => d.toISOString().slice(0, 10);
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    Promise.all([
      fetchMaintenanceEvents(selectedFleetVehicleId),
      fetchFleetCostReport(selectedFleetVehicleId, toIso(start), toIso(end)),
      fetchFleetDepreciation(selectedFleetVehicleId),
    ])
      .then(([events, costs, depreciation]) => {
        setFleetVehicleEvents(events);
        setFleetCostReport(costs);
        setFleetDepreciation(depreciation);
      })
      .catch(() => {
        setFleetVehicleEvents([]);
        setFleetCostReport(null);
        setFleetDepreciation(null);
      });
  }, [activeTab, selectedFleetVehicleId]);

  const handleDeleteTrip = (id) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την εκδρομή;')) {
      removeTripFromStore(id);
      setTrips(loadTrips());
    }
  };

  const dashboardKpis = useMemo(
    () => computeDashboardKpis({ bookings, trips, fleetVehicles }),
    [bookings, trips, fleetVehicles],
  );

  const renderDashboard = () => (
    <div className="space-y-stack-lg pb-stack-lg">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
          Dashboard Overview
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        <DashboardKpiCard
          label="Συνολικά Έσοδα"
          value={dashboardKpis.totalRevenue}
          icon="payments"
          tone="emerald"
        />
        <DashboardKpiCard
          label="Ενεργές Κρατήσεις"
          value={dashboardKpis.activeBookings}
          icon="confirmation_number"
          tone="sky"
        />
        <DashboardKpiCard
          label="Στόλος Ενεργός"
          value={dashboardKpis.fleetStatus}
          icon="directions_bus"
          tone="violet"
        />
        <DashboardKpiCard
          label="Αναχωρήσεις Σήμερα"
          value={dashboardKpis.todayDepartures}
          icon="schedule"
          tone="amber"
        />
      </div>

      <div className="bg-white rounded-[24px] shadow-level-2 card-inner-border border border-sky-100/60 flex flex-col min-w-0 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-black/[0.05] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-headline-md text-lg sm:text-xl text-on-surface font-bold tracking-tight">
                Πρόσφατες Κρατήσεις
              </h3>
              <p className="text-sm text-on-surface-variant mt-0.5">
                {bookings.length} {bookings.length === 1 ? 'κράτηση' : 'κρατήσεις'}
                <span className="hidden sm:inline text-on-surface-variant/70"> · διπλό κλικ για λεπτομέρειες</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className="text-sm font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              Όλες
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[880px]">
              <thead>
                <tr className="bg-surface-container-low/60">
                  <th className="w-[92px] pl-4 sm:pl-5 pr-2 py-3.5 text-left text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    ID
                  </th>
                  <th className="w-[22%] px-3 py-3.5 text-left text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Πελάτης
                  </th>
                  <th className="w-[34%] px-3 py-3.5 text-left text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Δρομολόγιο
                  </th>
                  <th className="w-[118px] px-3 py-3.5 text-left text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Ημερομηνία
                  </th>
                  <th className="w-[132px] px-3 py-3.5 text-left text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Κατάσταση
                  </th>
                  <th className="w-[120px] px-3 py-3.5 text-left text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    MARK
                  </th>
                  <th className="w-[96px] pr-2 pl-2 py-3.5 text-right text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Ποσό
                  </th>
                  <th className="w-[108px] pr-4 sm:pr-5 pl-2 py-3.5 text-right text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Ενέργειες
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {bookings.map((booking) => {
                  const customer = booking.customerName || booking.user || '—';
                  const route = booking.tripTitle || booking.trip || '—';
                  const amount = booking.amount || (booking.seats ? booking.seats.length * 45 : 45);
                  const balanceDue =
                    Number(booking.balanceDue) ||
                    Math.max(0, Number(booking.price || amount) - Number(booking.amountPaid || 0));
                  const showCash = canRecordCashPayment(booking);
                  return (
                    <tr
                      key={booking.id}
                      onDoubleClick={() => openBookingTicket(booking)}
                      className="hover:bg-primary/[0.03] transition-colors group cursor-pointer"
                      title="Διπλό κλικ για λεπτομέρειες κράτησης"
                    >
                      <td className="pl-4 sm:pl-5 pr-2 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-semibold text-primary">{booking.id}</span>
                      </td>
                      <td className="px-3 py-4 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1 ${avatarColorClass(customer)}`}
                          >
                            {customer.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[15px] font-medium text-on-surface truncate">{customer}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 min-w-0">
                        <span
                          className="text-[15px] text-on-surface block truncate"
                          title={route}
                        >
                          {route}
                        </span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-[15px] text-on-surface-variant">
                        {booking.date}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full ${bookingStatusBadgeClass(booking.status)}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <FiscalMarkCell booking={booking} compact />
                      </td>
                      <td className="pr-2 pl-2 py-4 whitespace-nowrap text-right text-[15px] font-bold text-on-surface tabular-nums">
                        €{Number(amount).toFixed(2)}
                      </td>
                      <td className="pr-4 sm:pr-5 pl-2 py-4 whitespace-nowrap text-right">
                        {showCash ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCashPaymentBooking(booking);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-colors shadow-sm"
                            title={`Καταχώρηση μετρητών · υπόλοιπο €${balanceDue.toFixed(2)}`}
                          >
                            <span className="material-symbols-outlined text-[14px]">payments</span>
                            Μετρητά
                          </button>
                        ) : (
                          <span className="text-xs text-on-surface-variant/50">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );

  const renderRoutes = () => {
    const filteredTrips = trips.filter((t) => getTripMarket(t) === routesMarket);
    const marketBadgeClass =
      routesMarket === MARKET_INTERNATIONAL
        ? 'bg-indigo-100 text-indigo-800'
        : 'bg-emerald-100 text-emerald-800';

    return (
    <div className="space-y-stack-lg pb-stack-lg relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Διαχείριση Εκδρομών
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Προσθήκη, επεξεργασία και αφαίρεση εκδρομών σε πραγματικό χρόνο.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            navigate('/admin/trips/new', { state: { market: routesMarket, activeTab: 'routes' } })
          }
          className="px-6 py-2 bg-primary text-white font-label-md text-label-md rounded-full hover:scale-105 transition-transform flex items-center gap-2 shadow-md"
        >
          <span className="material-symbols-outlined text-sm">add</span> Νέα Εκδρομή
        </button>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-surface-container rounded-full w-fit">
        {[MARKET_DOMESTIC, MARKET_INTERNATIONAL].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRoutesMarket(key)}
            className={`px-5 py-2 rounded-full font-label-md text-label-md transition-all ${
              routesMarket === key
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {MARKET_LABELS[key]}
            <span className="ml-2 opacity-80 text-xs">
              ({trips.filter((t) => getTripMarket(t) === key).length})
            </span>
          </button>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-[32px] shadow-level-2 card-inner-border flex flex-col">
        <div className="flex-1 overflow-x-auto p-2">
          <table className="min-w-full divide-y divide-surface-container-high">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-surface-container-lowest text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Αγορά</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Όνομα Εκδρομής</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Αναχώρηση</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Οδηγός</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Όχημα</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider">Διαθέσιμες Θέσεις</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">Τιμή</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">Ενέργειες</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {filteredTrips.map(trip => (
                <tr
                  key={trip.id}
                  onDoubleClick={() => navigate(`/admin/trips/${trip.id}`)}
                  className="hover:bg-surface-container-lowest transition-colors cursor-pointer"
                  title="Διπλό κλικ για επεξεργασία εκδρομής"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${marketBadgeClass}`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {getTripMarket(trip) === MARKET_INTERNATIONAL ? 'public' : 'flag'}
                      </span>
                      {MARKET_LABELS[getTripMarket(trip)]}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-body-md text-on-surface font-medium">
                    <div className="flex items-center gap-3 min-w-0">
                      {trip.image ? (
                        <img
                          src={trip.image}
                          alt=""
                          className="w-11 h-11 rounded-xl object-cover border border-black/[0.06] shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-gray-400 text-[20px]">image</span>
                        </div>
                      )}
                      <span className="truncate">{trip.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-body-md text-on-surface">
                    {trip.departureTime ? new Date(trip.departureTime).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-body-md text-on-surface">
                    {trip.driverName ? (
                      <span className="font-medium">{trip.driverName}</span>
                    ) : (
                      <span className="text-on-surface-variant italic">—</span>
                    )}
                    {trip.vehiclePlate && (
                      <span className="block text-xs font-mono text-gray-500">{trip.vehiclePlate}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-body-md text-on-surface">{trip.vehicleType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-3 py-1 bg-surface-container text-on-surface rounded-full font-label-sm ${trip.availableSeats === 0 ? 'bg-error text-white' : ''}`}>
                      {trip.availableSeats}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-body-md text-on-surface">
                    €{Number(trip.price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-body-md text-on-surface">
                    <button onClick={() => navigate(`/admin/trips/${trip.id}`)} className="text-primary hover:text-[#002244] mr-4 transition-colors" title="Επεξεργασία">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button onClick={() => handleDeleteTrip(trip.id)} className="text-error hover:text-red-800 transition-colors" title="Διαγραφή">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTrips.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-on-surface-variant font-body-md">
                    Δεν βρέθηκαν εκδρομές για {MARKET_LABELS[routesMarket]}. Πατήστε «Νέα Εκδρομή» για να προσθέσετε.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };

  const renderCustomers = () => {
    if (selectedCustomer) {
      const customer =
        loadAllCustomers().find((c) => c.id === selectedCustomer.id) || selectedCustomer;
      const customerName = customer.name || 'Άγνωστος πελάτης';
      const customerBookings = bookings.filter(
        (b) =>
          b.customerId === customer.id ||
          b.customerName === customer.name ||
          b.email === customer.email,
      );
      const totalSpent = customerBookings.reduce((sum, b) => sum + (b.price || 0), 0);
      const paidTotal = customerBookings.filter(isPaid).reduce((sum, b) => sum + (b.price || 0), 0);
      const confirmedCount = customerBookings.filter(isConfirmed).length;
      const pendingCount = customerBookings.length - confirmedCount;

      return (
        <div className="space-y-stack-lg pb-stack-lg relative animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-4 mb-2">
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-gray-600">arrow_back</span>
            </button>
            <span className="font-bold text-gray-500">Πίσω στον κατάλογο πελατών</span>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                {customerName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="font-headline-lg font-bold text-on-surface">{customerName}</h2>
                <p className="text-on-surface-variant">{customer.email}</p>
                <p className="text-sm text-gray-400 font-mono mt-1">{customer.id}</p>
              </div>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-bold ${
                customer.tier === 'Platinum'
                  ? 'bg-slate-800 text-slate-200'
                  : customer.tier === 'Gold'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {customer.tier || 'Silver'}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-black/[0.05] shadow-sm">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">AeroMiles</div>
              <div className="text-2xl font-bold text-amber-600">{customer.points ?? 0}</div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-black/[0.05] shadow-sm">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Επιβεβαιωμένες</div>
              <div className="text-2xl font-bold text-emerald-600">
                {confirmedCount}
                <span className="text-sm text-gray-400 font-normal"> / {customerBookings.length}</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-black/[0.05] shadow-sm">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Εισπράχθηκαν</div>
              <div className="text-2xl font-bold text-primary">€{paidTotal.toFixed(2)}</div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-black/[0.05] shadow-sm">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Σύνολο τιμολογίων</div>
              <div className="text-2xl font-bold text-gray-900">€{totalSpent.toFixed(2)}</div>
              {pendingCount > 0 && (
                <p className="text-xs text-amber-600 mt-1 font-bold">{pendingCount} εκκρεμείς</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-primary">receipt_long</span>
              Ιστορικό κρατήσεων & οικονομικά
            </h3>
            {customerBookings.length === 0 ? (
              <p className="p-8 text-center text-gray-500 bg-white rounded-3xl border">
                Δεν υπάρχουν καταγεγραμμένες κρατήσεις.
              </p>
            ) : (
              customerBookings.map((b) => (
                <CustomerBookingCard
                  key={b.id}
                  booking={b}
                  onOpenDetail={openBookingTicket}
                  onViewTicket={openBookingTicket}
                />
              ))
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            Εγγραφή: {customer.joinDate}
          </p>
        </div>
      );
    }

    return (
    <div className="space-y-stack-lg pb-stack-lg relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Πελατολόγιο & Επιβραβεύσεις
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Διαχείριση πελατών, πόντων επιβράβευσης και ιστορικού κρατήσεων.
          </p>
          <p className="text-xs text-on-surface-variant mt-2">Κλικ σε γραμμή για προφίλ πελάτη.</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-[32px] shadow-level-2 card-inner-border flex flex-col">
        <div className="flex-1 overflow-x-auto p-2">
          <table className="min-w-full divide-y divide-surface-container-high">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-surface-container-lowest text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Πελάτης</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider">Tier</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">AeroMiles</th>
                <th className="px-6 py-3 bg-surface-container-lowest text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">Ημ/νια Εγγραφής</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loadAllCustomers().map(customer => (
                <tr key={customer.id} onClick={() => setSelectedCustomer(customer)} className="hover:bg-surface-container-lowest transition-colors cursor-pointer group">
                  <td className="px-6 py-4 whitespace-nowrap font-body-md text-on-surface font-bold flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs group-hover:scale-110 transition-transform">
                      {customer.name.substring(0, 2).toUpperCase()}
                    </div>
                    {customer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-body-md text-on-surface-variant">
                    {customer.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      customer.tier === 'Platinum' ? 'bg-slate-800 text-slate-200' :
                      customer.tier === 'Gold' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {customer.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-body-md text-amber-600 font-bold flex items-center justify-end gap-2">
                    {customer.points >= 1500 && (
                      <span className="material-symbols-outlined text-[16px] text-amber-500 animate-bounce">redeem</span>
                    )}
                    {customer.points}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-body-md text-on-surface-variant text-sm">
                    {customer.joinDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };

  const renderDrivers = () => <DriversHub />;

  const renderFleet = () => {
    const rows = fleetVehicles.length
      ? fleetVehicles.map((v) => ({
          id: v.id,
          name: `${v.make} ${v.model}`,
          licensePlate: v.plate_number,
          type: v.model,
          seats: '-',
          status:
            v.service_status === 'Urgent'
              ? 'Σε Service'
              : v.service_status === 'Warning'
                ? 'Προειδοποίηση'
                : 'Ενεργό',
          kilometers: v.current_odometer || 0,
          lastService: v.last_service_date || '-',
          nextServiceKm: v.next_service_threshold || v.current_odometer,
          financials: {
            revenue: 0,
            expenses:
              Number(v.fuel_cost_total || 0) +
              Number(v.insurance_cost_total || 0),
          },
          service_status: v.service_status,
          km_to_service: v.km_to_service,
        }))
      : mockFleet;
    const totalFleet = rows.length;
    const activeFleet = rows.filter((f) => f.status === 'Ενεργό').length;
    const totalRevenue = rows.reduce((sum, f) => sum + Number(f.financials?.revenue || 0), 0);
    const totalExpenses = rows.reduce((sum, f) => sum + Number(f.financials?.expenses || 0), 0);

    return (
      <div className="space-y-stack-lg pb-stack-lg relative animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Διαχείριση Στόλου
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Παρακολούθηση οχημάτων, κατάσταση συντήρησης και οικονομικά στοιχεία.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setServiceModalOpen(true);
                setServiceForm((prev) => ({
                  ...prev,
                  vehicle_id: selectedFleetVehicleId || fleetVehicles[0]?.id || '',
                }));
              }}
              className="px-6 py-2 bg-primary text-white font-label-md text-label-md rounded-full hover:scale-105 transition-transform flex items-center gap-2 shadow-md"
            >
              <span className="material-symbols-outlined text-sm">build</span> Καταχώριση Service
            </button>
          </div>
        </div>

        {/* KPI Cards (Hybrid Top) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-black/[0.05] shadow-sm flex flex-col gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined">directions_bus</span>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-500 mb-1">Κατάσταση Στόλου</div>
              <div className="text-3xl font-display-sm font-bold text-gray-900">{activeFleet} <span className="text-lg text-gray-400">/ {totalFleet} Ενεργά</span></div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-black/[0.05] shadow-sm flex flex-col gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-500 mb-1">Συνολικά Έσοδα</div>
              <div className="text-3xl font-display-sm font-bold text-emerald-600">€{(totalRevenue / 1000).toFixed(1)}k</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-black/[0.05] shadow-sm flex flex-col gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-500 mb-1">Λειτουργικά Έξοδα</div>
              <div className="text-3xl font-display-sm font-bold text-rose-600">€{(totalExpenses / 1000).toFixed(1)}k</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-black/[0.05] shadow-sm flex flex-col gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined">build</span>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-500 mb-1">Απαιτούν Άμεση Ενέργεια</div>
              <div className="text-3xl font-display-sm font-bold text-amber-600">
                {fleetCards?.urgent_count ?? (totalFleet - activeFleet)} <span className="text-lg text-gray-400">επείγοντα</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-black/[0.05] p-4">
            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Προβλεπτικές ειδοποιήσεις</div>
            <div className="text-2xl font-bold text-rose-600">{fleetCards?.alerts_count ?? fleetAlerts.length}</div>
          </div>
          <div className="bg-white rounded-2xl border border-black/[0.05] p-4">
            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Οχήματα σε προειδοποίηση</div>
            <div className="text-2xl font-bold text-amber-600">{fleetCards?.warning_count ?? 0}</div>
          </div>
          <div className="bg-white rounded-2xl border border-black/[0.05] p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500 font-bold uppercase mb-1">Μηνιαίο κόστος στόλου</div>
              <div className="text-2xl font-bold text-primary">€{Number(fleetCards?.monthly_cost_estimate || 0).toLocaleString('el-GR')}</div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const updated = await scanFleetAlerts();
                setFleetAlerts(updated);
                const cards = await fetchFleetDashboard();
                setFleetCards(cards);
                toast.success('Ολοκληρώθηκε νέος προγνωστικός έλεγχος');
              }}
              className="px-3 py-2 rounded-full bg-primary text-white text-xs font-bold hover:opacity-90"
            >
              Έλεγχος
            </button>
          </div>
        </div>

        <FleetAlertsPanel
          alerts={fleetAlerts}
          onResolved={async () => {
            const [alerts, cards] = await Promise.all([
              fetchFleetAlerts(true),
              fetchFleetDashboard(),
            ]);
            setFleetAlerts(alerts);
            setFleetCards(cards);
          }}
          onSelectVehicle={(vehicleId) => {
            setSelectedFleetVehicleId(vehicleId);
            document.getElementById('fleet-vehicle-table')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <p className="text-xs text-on-surface-variant">
          Κλικ σε γραμμή για πάνελ ανάλυσης · διπλό κλικ για πλήρες προφίλ οχήματος.
        </p>

        {/* Detailed Table (Hybrid Bottom) */}
        <div
          id="fleet-vehicle-table"
          className="bg-white rounded-[32px] shadow-sm border border-black/[0.05] flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-x-auto p-2">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr>
                  <th className="px-6 py-4 bg-white text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Όχημα</th>
                  <th className="px-6 py-4 bg-white text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Κατάσταση</th>
                  <th className="px-6 py-4 bg-white text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Χιλιόμετρα</th>
                  <th className="px-6 py-4 bg-white text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-4 bg-white text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Οικονομικά (Έσοδα/Έξοδα)</th>
                  <th className="px-4 py-4 bg-white text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-16"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(bus => {
                  const kmUntilService = Number(bus.nextServiceKm || 0) - Number(bus.kilometers || 0);
                  const needsServiceSoon = kmUntilService < 5000 || bus.service_status === 'Warning' || bus.service_status === 'Urgent';
                  
                  return (
                    <tr
                      key={bus.id}
                      onClick={() => setSelectedFleetVehicleId(bus.id)}
                      onDoubleClick={() => navigate(`/admin/fleet/${bus.id}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer group"
                      title="Κλικ για ανάλυση / διπλό κλικ για προφίλ"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-surface-container-low text-primary flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-[24px]">directions_bus</span>
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{bus.name} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ml-2">{bus.type} • {bus.seats} Θέσεις</span></div>
                            <div className="text-sm font-mono text-gray-500 mt-0.5">{bus.licensePlate} • ID: {bus.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                          bus.status === 'Ενεργό' ? 'bg-green-50 text-green-700 border border-green-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {bus.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="font-bold text-gray-900">{Number(bus.kilometers || 0).toLocaleString()} km</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        <div className="text-sm text-gray-900">Τελευταίο: {bus.lastService}</div>
                        <div className={`text-xs mt-1 flex items-center gap-1 ${needsServiceSoon && bus.status === 'Ενεργό' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                          {needsServiceSoon && bus.status === 'Ενεργό' && <span className="material-symbols-outlined text-[14px]">warning</span>}
                          Επόμενο σε {kmUntilService.toLocaleString()} km
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="font-bold text-emerald-600 mb-1">+€{bus.financials.revenue.toLocaleString()}</div>
                        <div className="font-bold text-rose-500 text-xs">-€{bus.financials.expenses.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button
                          type="button"
                          disabled={deletingFleetId === bus.id}
                          onClick={(e) => handleDeleteFleetVehicle(e, bus.id, bus.name)}
                          className="p-2 rounded-full text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-40"
                          title="Διαγραφή οχήματος"
                          aria-label={`Διαγραφή ${bus.name}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selectedFleetVehicleId && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-black/[0.05] p-5">
              <div className="text-xs text-gray-500 font-bold uppercase mb-1">Αναφορά κόστους (6 μήνες)</div>
              <div className="text-2xl font-bold text-primary mb-3">€{Number(fleetCostReport?.total || 0).toLocaleString('el-GR')}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Συντήρηση</span><span className="font-semibold">€{Number(fleetCostReport?.maintenance_total || 0).toLocaleString('el-GR')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Καύσιμα</span><span className="font-semibold">€{Number(fleetCostReport?.fuel_total || 0).toLocaleString('el-GR')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Ασφάλιση</span><span className="font-semibold">€{Number(fleetCostReport?.insurance_total || 0).toLocaleString('el-GR')}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-black/[0.05] p-5">
              <div className="text-xs text-gray-500 font-bold uppercase mb-1">Απόσβεση</div>
              <div className="text-2xl font-bold text-emerald-600 mb-1">€{Number(fleetDepreciation?.estimated_book_value || 0).toLocaleString('el-GR')}</div>
              <div className="text-sm text-gray-500">Εκτιμώμενη λογιστική αξία</div>
              <div className="mt-3 text-sm text-gray-700">
                Ηλικία: <span className="font-semibold">{fleetDepreciation?.age_years ?? '-'} έτη</span>
              </div>
              <div className="text-sm text-gray-700">
                Συντελεστής χιλιομέτρων: <span className="font-semibold">{fleetDepreciation?.mileage_factor ?? '-'}</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-black/[0.05] p-5">
              <div className="text-xs text-gray-500 font-bold uppercase mb-2">Τελευταία service</div>
              <div className="space-y-2 max-h-40 overflow-auto">
                {fleetVehicleEvents.slice(0, 4).map((e) => (
                  <div key={e.id} className="rounded-xl bg-slate-50 p-2.5">
                    <div className="text-sm font-semibold text-gray-900">{e.service_type} · €{Number(e.cost || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{e.event_date} · {e.shop_or_mechanic || '—'}</div>
                  </div>
                ))}
                {fleetVehicleEvents.length === 0 && (
                  <p className="text-sm text-gray-500">Δεν υπάρχουν καταγεγραμμένα service events.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {serviceModalOpen && (
          <div className="fixed inset-0 z-[210] bg-black/40 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const payload = {
                    ...serviceForm,
                    mileage: Number(serviceForm.mileage || 0),
                    cost: Number(serviceForm.cost || 0),
                    parts_replaced: String(serviceForm.parts_replaced || '')
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  };
                  const event = await createMaintenanceEvent(payload);
                  for (const file of serviceFiles) {
                    await uploadMaintenanceAttachment(event.id, file);
                  }
                  toast.success('Το συμβάν συντήρησης αποθηκεύτηκε');
                  setServiceModalOpen(false);
                  setServiceFiles([]);
                  const [vehicles, cards, alerts, events] = await Promise.all([
                    fetchFleetVehicles(),
                    fetchFleetDashboard(),
                    fetchFleetAlerts(true),
                    fetchMaintenanceEvents(payload.vehicle_id),
                  ]);
                  setFleetVehicles(vehicles);
                  setFleetCards(cards);
                  setFleetAlerts(alerts);
                  setFleetVehicleEvents(events);
                } catch (err) {
                  toast.error(err.message || 'Αποτυχία αποθήκευσης συμβάντος συντήρησης');
                }
              }}
              className="bg-white rounded-[24px] p-6 w-full max-w-2xl space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-gray-900">Νέο συμβάν συντήρησης</h4>
                <button type="button" onClick={() => setServiceModalOpen(false)} className="text-gray-500 hover:text-gray-900">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm font-medium text-gray-700">Όχημα
                  <select className="mt-1 w-full rounded-xl border px-3 py-2" value={serviceForm.vehicle_id} onChange={(e) => setServiceForm((p) => ({ ...p, vehicle_id: e.target.value }))}>
                    {(fleetVehicles.length ? fleetVehicles : rows).map((v) => (
                      <option key={v.id} value={v.id}>{v.plate_number || v.licensePlate} · {v.make ? `${v.make} ${v.model}` : v.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">Χιλιόμετρα
                  <input className="mt-1 w-full rounded-xl border px-3 py-2" type="number" min="0" value={serviceForm.mileage} onChange={(e) => setServiceForm((p) => ({ ...p, mileage: e.target.value }))} />
                </label>
                <label className="text-sm font-medium text-gray-700">Τύπος service
                  <input className="mt-1 w-full rounded-xl border px-3 py-2" value={serviceForm.service_type} onChange={(e) => setServiceForm((p) => ({ ...p, service_type: e.target.value }))} />
                </label>
                <label className="text-sm font-medium text-gray-700">Κόστος (€)
                  <input className="mt-1 w-full rounded-xl border px-3 py-2" type="number" min="0" step="0.01" value={serviceForm.cost} onChange={(e) => setServiceForm((p) => ({ ...p, cost: e.target.value }))} />
                </label>
                <label className="text-sm font-medium text-gray-700 md:col-span-2">Συνεργείο / Μηχανικός
                  <input className="mt-1 w-full rounded-xl border px-3 py-2" value={serviceForm.shop_or_mechanic} onChange={(e) => setServiceForm((p) => ({ ...p, shop_or_mechanic: e.target.value }))} />
                </label>
                <label className="text-sm font-medium text-gray-700 md:col-span-2">Ανταλλακτικά (χωρισμένα με κόμμα)
                  <input className="mt-1 w-full rounded-xl border px-3 py-2" value={serviceForm.parts_replaced} onChange={(e) => setServiceForm((p) => ({ ...p, parts_replaced: e.target.value }))} />
                </label>
                <label className="text-sm font-medium text-gray-700 md:col-span-2">Περιγραφή
                  <textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={3} value={serviceForm.description} onChange={(e) => setServiceForm((p) => ({ ...p, description: e.target.value }))} />
                </label>
                <label className="text-sm font-medium text-gray-700 md:col-span-2">Τιμολόγια / Φωτογραφίες
                  <input className="mt-1 w-full rounded-xl border px-3 py-2" type="file" multiple onChange={(e) => setServiceFiles(Array.from(e.target.files || []))} />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setServiceModalOpen(false)} className="px-4 py-2 rounded-full border font-bold text-sm">Άκυρο</button>
                <button type="submit" className="px-4 py-2 rounded-full bg-primary text-white font-bold text-sm">Αποθήκευση συμβάντος</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  };

  const patchLostStatus = async (itemId, status) => {
    try {
      const updated = await updateLostItemStatus(itemId, status);
      setLostItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updated } : i)));
      toast.success('Ενημερώθηκε η κατάσταση');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const renderLostFound = () => {
    return (
      <div className="space-y-stack-lg pb-stack-lg relative animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface mb-2">Απωλεσθέντα</h2>
            <p className="font-body-md text-on-surface-variant max-w-2xl text-lg">
              Διαχείριση αντικειμένων από δηλώσεις πελατών στο My Wallet — ενημέρωση σε πραγματικό χρόνο.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLostItemsLoading(true);
              fetchAllLostItems()
                .then(setLostItems)
                .catch((e) => toast.error(e.message))
                .finally(() => setLostItemsLoading(false));
            }}
            className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-bold hover:bg-surface-container-low"
          >
            {lostItemsLoading ? 'Φόρτωση…' : 'Ανανέωση'}
          </button>
        </div>

        {lostItemsLoading && lostItems.length === 0 && (
          <p className="text-on-surface-variant text-sm">Φόρτωση δηλώσεων…</p>
        )}
        {!lostItemsLoading && lostItems.length === 0 && (
          <p className="text-on-surface-variant text-sm">Δεν υπάρχουν δηλώσεις απώλειας ακόμα.</p>
        )}

        <div className="bg-white rounded-[32px] shadow-sm border border-black/[0.05] overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr>
                <th className="px-6 py-4 bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID / Πελάτης</th>
                <th className="px-6 py-4 bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Αντικείμενο & Περιγραφή</th>
                <th className="px-6 py-4 bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Τελευταία Τοποθεσία</th>
                <th className="px-6 py-4 bg-gray-50 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 bg-gray-50 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Ενέργειες</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lostItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-gray-900">{item.id}</div>
                    <div className="text-sm text-gray-500">{item.customerName}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{new Date(item.dateReported).toLocaleDateString('el-GR')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                      {item.itemCategory === 'Ηλεκτρονικά' && <span className="material-symbols-outlined text-sm text-blue-500">smartphone</span>}
                      {item.itemCategory === 'Προσωπικά Έγγραφα' && <span className="material-symbols-outlined text-sm text-amber-500">badge</span>}
                      {item.itemCategory === 'Ρούχα' && <span className="material-symbols-outlined text-sm text-purple-500">checkroom</span>}
                      {item.itemCategory === 'Άλλο' && <span className="material-symbols-outlined text-sm text-gray-500">inventory_2</span>}
                      {item.itemCategory}
                    </div>
                    <div className="text-sm text-gray-600 line-clamp-2 max-w-xs" title={item.description}>{item.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-gray-400">location_on</span> {item.lastSeenLocation}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {item.status === 'OPEN' && <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">OPEN</span>}
                    {item.status === 'FOUND' && <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">FOUND</span>}
                    {item.status === 'CLOSED' && <span className="inline-flex items-center gap-1 bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">CLOSED</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.status === 'OPEN' && (
                        <button 
                          type="button"
                          onClick={() => patchLostStatus(item.id, 'FOUND')}
                          className="bg-green-100 text-green-700 hover:bg-green-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">check</span> Βρέθηκε
                        </button>
                      )}
                      {item.status === 'FOUND' && (
                        <button 
                          type="button"
                          onClick={() => patchLostStatus(item.id, 'CLOSED')}
                          className="bg-gray-200 text-gray-700 hover:bg-gray-300 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">inventory_2</span> Επεστράφη
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBookings = () => {
    const handleCheckIn = async (e, bookingId) => {
      e.stopPropagation();
      const current = bookings.find((b) => b.id === bookingId);
      const nextChecked = !current?.checkedIn;
      try {
        const updated = await patchAdminBooking(bookingId, {
          checkedIn: nextChecked,
          checkInStatus: nextChecked ? 'CHECKED_IN' : 'NONE',
        });
        setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, ...updated } : b)));
        toast.success(nextChecked ? 'Επιτυχές Check-In!' : 'Check-In ακυρώθηκε');
      } catch (err) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId ? { ...b, checkedIn: nextChecked } : b,
          ),
        );
        toast.error(err.message || 'Αποτυχία ενημέρωσης check-in');
      }
    };

    const handleCancel = async (bookingId) => {
      if (!window.confirm('Ακύρωση κράτησης; Το εισιτήριο θα ακυρωθεί και δεν θα γίνεται δεκτό στο scan.')) {
        return;
      }
      try {
        const updated = await cancelBooking(bookingId);
        setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, ...updated } : b)));
        setSelectedBooking((prev) => (prev?.id === bookingId ? { ...prev, ...updated } : prev));
        toast.success('Η κράτηση ακυρώθηκε');
      } catch (err) {
        toast.error(err.message || 'Αποτυχία ακύρωσης');
      }
    };

    if (selectedBooking) {
      const currentSelectedBooking = bookings.find(b => b.id === selectedBooking.id) || selectedBooking;

      return (
        <div className="space-y-stack-lg pb-stack-lg relative animate-in fade-in zoom-in-95 duration-300">
          <BookingDetailPanel
            booking={currentSelectedBooking}
            mode="admin"
            onBack={() => setSelectedBooking(null)}
            onPrint={(b) => navigate(ticketPrintPath(b.id))}
            onEmail={openEmailFromBooking}
            onCancel={handleCancel}
            onOpenCustomer={openCustomerProfile}
            onBookingUpdated={applyBookingUpdate}
          />
        </div>
      );
    }

    // Group bookings by tripTitle using the state bookings
    const groupedBookings = bookings.reduce((acc, booking) => {
      const key = `${booking.tripTitle} - ${booking.date}`;
      if (!acc[key]) acc[key] = { tripTitle: booking.tripTitle, date: booking.date, bookings: [] };
      acc[key].bookings.push(booking);
      return acc;
    }, {});

    return (
      <div className="space-y-stack-lg pb-stack-lg relative animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface mb-2">Διαχείριση Κρατήσεων ανά Ταξίδι</h2>
            <p className="font-body-md text-on-surface-variant max-w-2xl text-lg">
              Επιλέξτε μια εκδρομή για manifest & κρατήσεις.
              {bookingsLoading && ' Συγχρονισμός SaaS…'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setBookingsLoading(true);
              loadMergedBookings()
                .then(setBookings)
                .finally(() => setBookingsLoading(false));
            }}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-bold hover:bg-gray-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            Ανανέωση
          </button>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedBookings).map(([key, group]) => {
            const isExpanded = expandedTripBookings === key;
            const confirmedCount = group.bookings.filter(b => b.status === 'Επιβεβαιωμένη' || b.status === 'Ολοκληρώθηκε').length;
            const pendingCount = group.bookings.length - confirmedCount;
            const totalRevenue = group.bookings.reduce((sum, b) => sum + (b.price || 0), 0);

            return (
              <div key={key} className="bg-white rounded-3xl shadow-sm border border-black/[0.05] overflow-hidden transition-all">
                {/* Trip Header (Accordion Toggle) */}
                <div 
                  className={`p-6 cursor-pointer hover:bg-gray-50 flex items-center justify-between transition-colors ${isExpanded ? 'border-b border-gray-100 bg-gray-50/50' : ''}`}
                  onClick={() => setExpandedTripBookings(isExpanded ? null : key)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">directions_bus</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{group.tripTitle}</h3>
                      <p className="text-sm text-gray-500 font-medium">Αναχώρηση: {group.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="hidden md:flex gap-6 text-sm">
                      <div className="text-center">
                        <span className="block text-gray-500 font-bold uppercase tracking-wider text-[10px] mb-1">Κρατήσεις</span>
                        <span className="font-bold text-gray-900">{group.bookings.length}</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-gray-500 font-bold uppercase tracking-wider text-[10px] mb-1">Έσοδα</span>
                        <span className="font-bold text-primary">€{totalRevenue.toFixed(2)}</span>
                      </div>
                    </div>
                    <span className={`material-symbols-outlined transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary' : 'text-gray-400'}`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Expanded Table */}
                {isExpanded && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-white">
                      <div className="px-6 py-4 bg-gray-50/50 flex justify-between items-center border-b border-gray-100">
                        <span className="text-sm font-bold text-gray-600">Λίστα Επιβατών (Manifest)</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              exportTripManifestPdf({
                                tripTitle: group.tripTitle,
                                date: group.date,
                                bookings: group.bookings,
                              });
                              toast.success('Άνοιγμα εκτύπωσης manifest…');
                            } catch (err) {
                              toast.error(err.message || 'Αποτυχία εξαγωγής');
                            }
                          }}
                          className="text-primary hover:text-primary-hover font-bold text-sm flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                          Εξαγωγή PDF
                        </button>
                      </div>
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                          <tr>
                            <th className="px-6 py-4 bg-white text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Όνομα Πελάτη</th>
                            <th className="px-6 py-4 bg-white text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Θέση</th>
                            <th className="px-6 py-4 bg-white text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Boarding Pass</th>
                            <th className="px-6 py-4 bg-white text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Τιμή</th>
                            <th className="px-6 py-4 bg-white text-left text-xs font-bold text-gray-500 uppercase tracking-wider">MARK / Πάροχος</th>
                            <th className="px-6 py-4 bg-white text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ενέργειες</th>
                            <th className="px-6 py-4 bg-white text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Check-in</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.bookings.map(booking => {
                            const customerData =
                              getCustomerByEmail(booking.email) ||
                              loadAllCustomers().find((c) => c.id === booking.customerId);
                            const balanceDue =
                              Number(booking.balanceDue) ||
                              Math.max(0, Number(booking.price || 0) - Number(booking.amountPaid || 0));
                            const showCash = canRecordCashPayment(booking);
                            return (
                              <tr 
                                key={booking.id} 
                                className={`hover:bg-gray-50 transition-colors cursor-pointer group ${booking.checkedIn ? 'bg-green-50/30' : ''}`}
                                onDoubleClick={() => setSelectedBooking(booking)}
                              >
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-bold text-gray-900 text-base flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCustomerProfile(booking);
                                      }}
                                      className="hover:text-primary transition-colors flex items-center gap-2 text-left"
                                      title="Καρτέλα πελάτη"
                                    >
                                      {customerData?.name || booking?.customerName || 'Unknown'}
                                      <span className="material-symbols-outlined text-[16px] text-primary opacity-70 group-hover:opacity-100">
                                        open_in_new
                                      </span>
                                    </button>
                                    {booking.syncedToSaas && (
                                      <span className="material-symbols-outlined text-[16px] text-indigo-500" title="SaaS PostgreSQL">
                                        cloud_done
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">Κράτηση: #{booking.id}</div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openBookingTicket(booking);
                                    }}
                                    className="text-xs text-primary font-bold hover:underline mt-1"
                                  >
                                    Προβολή εισιτηρίου
                                  </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-bold text-primary">{booking.seat}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {booking.boardingPassIssued ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600">
                                      <span className="material-symbols-outlined text-[16px] text-green-500">qr_code</span> Εκδόθηκε
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400 font-medium">Όχι Ακόμα</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-bold text-gray-900">€{Number(booking.price || 0).toFixed(2)}</div>
                                  {balanceDue > 0 && (
                                    <div className="text-xs font-bold text-amber-700 mt-1">
                                      Υπόλοιπο €{balanceDue.toFixed(2)}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <FiscalMarkCell booking={booking} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  {showCash ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCashPaymentBooking(booking);
                                      }}
                                      className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-sm"
                                      title={`Καταχώρηση μετρητών · υπόλοιπο €${balanceDue.toFixed(2)}`}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">payments</span>
                                      Μετρητά
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400 font-medium">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  {booking.checkedIn ? (
                                    <button 
                                      onClick={(e) => handleCheckIn(e, booking.id)}
                                      className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">check_circle</span> Checked
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={(e) => handleCheckIn(e, booking.id)}
                                      className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-black text-white hover:bg-gray-800 transition-colors shadow-sm"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span> Check In
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <FleetTelemetryProvider>
    <div className="bg-surface text-on-surface h-screen flex overflow-hidden relative">
      <aside className="w-64 bg-surface-container-lowest border-r border-black/[0.05] hidden md:flex flex-col flex-shrink-0 relative z-20">
        <div className="p-6">
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight cursor-pointer" onClick={() => navigate('/')}>
            PoreiaGo
          </h1>
        </div>
        <SortableSidebarNav
          activeTab={activeTab}
          settingsSubTab={settingsSubTab}
          onTabChange={setActiveTab}
          onSettingsSubTabChange={setSettingsSubTab}
          onEmailClick={goToEmailMailbox}
          onNavigate={(path) => navigate(path)}
        />
      </aside>

      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        <header className="h-20 glass-overlay border-b border-black/[0.05] flex items-center justify-between px-margin-desktop shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4 w-96">
            <TemplateSearch onUseTemplate={useEmailTemplate} />
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => {
                ensureDriverSession();
                setIsScannerOpen(true);
              }}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              Scan QR
            </button>
            <button className="relative p-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-black/[0.05]">
              <div className="hidden sm:block">
                <p className="font-label-md text-label-md text-on-surface cursor-pointer hover:text-primary" onClick={() => {
                  localStorage.removeItem('userRole');
                  clearSaasSession();
                  navigate('/admin/login');
                }}>Admin User (Logout)</p>
              </div>
            </div>
          </div>
        </header>

        <div
          className={
            activeTab === 'email' || activeTab === 'email_templates'
              ? 'flex-1 overflow-auto p-3 md:p-4'
              : activeTab === 'dashboard'
                ? 'flex-1 overflow-auto p-4 md:p-5 lg:p-6'
                : 'flex-1 overflow-auto p-margin-mobile md:p-margin-desktop'
          }
        >
          <div
            className={
              activeTab === 'email' || activeTab === 'email_templates' || activeTab === 'dashboard'
                ? 'w-full min-w-0'
                : 'max-w-container-max mx-auto'
            }
          >
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'routes' && renderRoutes()}
            {activeTab === 'customers' && renderCustomers()}
            {activeTab === 'fleet' && renderFleet()}
            {activeTab === 'drivers' && renderDrivers()}
            {activeTab === 'settings' && (
              <div className="pb-stack-lg max-w-7xl">
                <ImpersonationBanner />
                <SettingsHub
                  initialTab={settingsSubTab}
                  onSubTabChange={setSettingsSubTab}
                  contractPrefs={{
                    plan: location.state?.plan,
                    interval: location.state?.interval,
                  }}
                />
              </div>
            )}
            {activeTab === 'fleet_live_map' && (
              <div className="animate-in fade-in duration-300 -mt-1">
                <FleetLiveMapWebSocket />
              </div>
            )}
            {activeTab === 'fleet_kpis' && (
              <div className="pb-stack-lg animate-in fade-in duration-300">
                <FleetKpisDashboard />
              </div>
            )}
            {activeTab === 'fleet_active_drivers' && (
              <div className="pb-stack-lg animate-in fade-in duration-300">
                <ActiveDriversList />
              </div>
            )}
            {activeTab === 'fleet_route_playback' && (
              <div className="pb-stack-lg animate-in fade-in duration-300">
                <FleetRouteHistory />
              </div>
            )}
            {activeTab === 'lost_found' && renderLostFound()}
            {activeTab === 'email' && (
              <EmailHub
                intent={emailIntent}
                onIntentHandled={() => setEmailIntent(null)}
              />
            )}
            {activeTab === 'email_templates' && (
              <EmailTemplatesPage onUseTemplate={useEmailTemplate} />
            )}
            {activeTab === 'bookings' && renderBookings()}
          </div>
        </div>
      </main>

      {/* Mobile Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
            <h3 className="text-white font-bold text-xl flex items-center gap-2">
              <span className="material-symbols-outlined">qr_code_scanner</span> Scanner Λεωφορείου
            </h3>
            <button 
              onClick={() => setIsScannerOpen(false)}
              className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div className="w-full max-w-md min-h-[360px] relative overflow-hidden rounded-[32px] border-4 border-white/20 shadow-2xl bg-black">
            <BusQrScanner
              onScan={async (raw) => {
                const response = await adminScanTicket({ qr: raw, tripId: 1 });
                setScanFlash(response.result);
                if (response.result === SCAN_RESULT.SUCCESS) {
                  setBookings(loadBookings());
                  toast.success(
                    `✅ ${response.passengerName} — Θέση ${response.seat}`,
                    { duration: 4000 },
                  );
                  setIsScannerOpen(false);
                } else {
                  toast.error(response.message || 'Άκυρο εισιτήριο');
                }
              }}
            />
            {scanFlash && (
              <div
                className={`absolute inset-0 pointer-events-none flex items-center justify-center text-4xl font-bold ${
                  scanFlash === SCAN_RESULT.SUCCESS ? 'bg-green-500/30' : 'bg-red-500/30'
                }`}
              >
                {scanFlash === SCAN_RESULT.SUCCESS ? '✓' : '✗'}
              </div>
            )}
            
            <div className="absolute inset-0 pointer-events-none border-2 border-primary/50 m-12 rounded-3xl"></div>
          </div>
          
          <div className="absolute bottom-10 left-0 right-0 text-center px-6">
            <p className="text-white/80 font-medium">Κεντράρετε το QR Code του πελάτη μέσα στο πλαίσιο.</p>
          </div>
        </div>
      )}

      <RecordCashPaymentModal
        booking={cashPaymentBooking}
        security={DEFAULT_PAYMENT_SECURITY}
        open={Boolean(cashPaymentBooking)}
        onClose={() => setCashPaymentBooking(null)}
        onConfirm={handleQuickCashPayment}
        confirming={cashPaymentSaving}
      />

      {/* React Hot Toast */}
      <Toaster position="top-center" />
    </div>
    </FleetTelemetryProvider>
  );
}
