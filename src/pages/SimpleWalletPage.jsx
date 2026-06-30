import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { getCustomerByEmail } from '../lib/customers/customerStore.js';
import {
  getCustomerEmail,
  getCustomerToken,
  getCustomerName,
  getCustomerPicture,
  getAuthProvider,
  isCustomer,
  isDriver,
  logoutCustomer,
} from '../lib/auth.js';
import { getBookingById, loadBookingsForCustomer } from '../lib/ticketing/bookingStore.js';
import { loadTrips } from '../lib/trips/tripStore.js';
import { ticketPrintPath } from '../lib/ticketing/printTicket.js';
import { isPaid, statusStyle } from '../lib/bookingDisplay.js';
import { bookingFiscalMark } from '../lib/fiscal/fiscalDisplay.js';
import BookingDetailPanel from '../components/booking/BookingDetailPanel.jsx';
import PassengerTrackCTA from '../components/passenger/PassengerTrackCTA.jsx';
import CustomerSecurityPanel from '../components/wallet/CustomerSecurityPanel.jsx';
import PushNotificationsPanel from '../components/wallet/PushNotificationsPanel.jsx';
import LostFoundPanel from '../components/wallet/LostFoundPanel.jsx';

function resolveCustomerProfile() {
  const email = (getCustomerEmail() || '').toLowerCase();
  const stored = getCustomerByEmail(email);
  return {
    email,
    name: getCustomerName() || stored?.name || email.split('@')[0] || 'Πελάτης',
    picture: getCustomerPicture() || stored?.picture || '',
    provider: getAuthProvider() || stored?.authProvider || 'email',
    points: stored?.points ?? 0,
    tier: stored?.tier ?? 'Silver',
    joinDate: stored?.joinDate ?? '—',
    id: stored?.id ?? null,
    phone: stored?.phone ?? '',
  };
}

function loadMyBookings(email) {
  if (!email) return Promise.resolve([]);
  return loadBookingsForCustomer(email);
}

function tripImageFor(booking) {
  const trips = loadTrips();
  const t = trips.find((x) => x.id === booking.tripId) || trips.find((x) => x.title === booking.tripTitle);
  return t?.image || '/images/meteora.png';
}

function tierGradient(tier) {
  if (tier === 'Platinum') return 'from-slate-700 to-slate-900';
  if (tier === 'Gold') return 'from-amber-500 to-orange-600';
  return 'from-slate-400 to-slate-600';
}

const TABS = [
  { id: 'account', label: 'Λογαριασμός', icon: 'person' },
  { id: 'bookings', label: 'Κρατήσεις', icon: 'confirmation_number' },
  { id: 'lost_found', label: 'Απωλεσθέντα', icon: 'support_agent' },
  { id: 'security', label: 'Ασφάλεια', icon: 'shield' },
];

/**
 * Full-page καρτέλα πελάτη — sync με Control Panel bookings.
 */
export default function SimpleWalletPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('account');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [bookings, setBookings] = useState([]);

  if (!isCustomer() || !getCustomerToken()) {
    if (isCustomer() && !getCustomerToken()) {
      logoutCustomer();
    }
    if (isDriver()) {
      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-on-surface-variant">Συνδεδεμένοι ως οδηγός — το Wallet είναι για πελάτες.</p>
          <Link to="/driver" className="px-6 py-3 rounded-full bg-emerald-600 text-white font-bold text-sm">
            Driver Portal
          </Link>
        </div>
      );
    }
    return <Navigate to="/login" replace state={{ from: '/wallet' }} />;
  }

  const profile = useMemo(() => resolveCustomerProfile(), []);
  const email = profile.email;

  useEffect(() => {
    let cancelled = false;
    loadMyBookings(email).then((list) => {
      if (!cancelled) {
        setBookings(
          [...list].sort(
            (a, b) => new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0),
          ),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  useEffect(() => {
    const highlight = location.state?.highlightBooking;
    if (highlight) {
      const b = getBookingById(highlight);
      if (b && String(b.email || '').toLowerCase() === email) {
        setSelectedBookingId(b.id);
        setActiveTab('ticket');
      }
    }
  }, [location.state?.highlightBooking, email]);

  const selectedBooking =
    bookings.find((b) => b.id === selectedBookingId) ||
    (selectedBookingId ? getBookingById(selectedBookingId) : null);

  const upcoming = bookings.filter(
    (b) => b.date && new Date(`${b.date}T23:59:59`) >= new Date() && b.status !== 'Ακυρωμένη',
  );
  const totalSpent = bookings.reduce((s, b) => s + Number(b.price || 0), 0);
  const initials = profile.name.substring(0, 2).toUpperCase();
  const isTicketView = activeTab === 'ticket' && selectedBooking;

  const openTicket = (booking) => {
    setSelectedBookingId(booking.id);
    setActiveTab('ticket');
  };

  const handleBookingUpdated = (updated) => {
    if (!updated?.id) return;
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Hero header — full width */}
      <section
        className={`relative overflow-hidden ${
          isTicketView
            ? 'bg-gradient-to-br from-[#0040df] via-[#0035b8] to-[#001d66] pb-8 pt-6'
            : 'bg-gradient-to-br from-[#0040df] via-[#0035b8] to-[#001d66] pb-0 pt-6'
        }`}
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              Αρχική
            </button>
            <button
              type="button"
              onClick={() => {
                logoutCustomer();
                navigate('/login', { replace: true, state: { from: '/wallet' } });
              }}
              className="flex items-center gap-1.5 text-white/80 hover:text-red-200 text-sm font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Έξοδος
            </button>
          </div>

          {!isTicketView && (
            <div className="flex flex-col md:flex-row md:items-end gap-6 pb-8">
              <div className="flex items-center gap-5">
                {profile.picture ? (
                  <img
                    src={profile.picture}
                    alt=""
                    className="w-20 h-20 md:w-24 md:h-24 rounded-2xl ring-4 ring-white/20 shadow-xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/15 backdrop-blur ring-4 ring-white/20 flex items-center justify-center text-2xl md:text-3xl font-bold text-white shadow-xl">
                    {initials}
                  </div>
                )}
                <div>
                  <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">
                    My Wallet · PoreiaGo
                  </p>
                  <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight">{profile.name}</h1>
                  <p className="text-blue-100 text-sm mt-1">{profile.email}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${tierGradient(profile.tier)} shadow`}
                    >
                      <span className="material-symbols-outlined text-[14px]">military_tech</span>
                      {profile.tier}
                    </span>
                    {profile.provider === 'google' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-white backdrop-blur">
                        Google
                      </span>
                    )}
                    {profile.id && (
                      <span className="px-3 py-1 rounded-full text-xs font-mono bg-white/10 text-blue-100">
                        {profile.id}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 md:ml-auto">
                {[
                  { label: 'AeroMiles', value: profile.points, icon: 'stars', color: 'text-amber-300' },
                  { label: 'Κρατήσεις', value: bookings.length, icon: 'confirmation_number', color: 'text-white' },
                  { label: 'Σύνολο', value: `€${totalSpent.toFixed(0)}`, icon: 'payments', color: 'text-emerald-300' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="min-w-[100px] px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-lg"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${stat.color}`}>{stat.icon}</span>
                    <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
                    <p className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isTicketView && (
            <nav className="flex gap-2 pb-4 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedBookingId(null);
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-[#0040df] shadow-lg scale-[1.02]'
                      : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </section>

      {/* Main content — full width */}
      <main
        className={`flex-1 w-full ${
          isTicketView ? 'bg-gradient-to-b from-[#001d66] to-slate-100 -mt-2 pt-6' : 'bg-surface-container-low'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10">
          {activeTab === 'account' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              {/* Profile card */}
              <section className="lg:col-span-5 bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-level-2 overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-primary/20 to-cyan-500/20" />
                <div className="px-6 pb-6 -mt-10">
                  <div className="w-20 h-20 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold shadow-lg ring-4 ring-surface-container-lowest">
                    {initials}
                  </div>
                  <h2 className="text-xl font-bold text-on-surface mt-4">Στοιχεία λογαριασμού</h2>
                  <dl className="mt-5 space-y-4">
                    {[
                      { icon: 'person', label: 'Ονοματεπώνυμο', value: profile.name },
                      { icon: 'mail', label: 'Email', value: profile.email },
                      { icon: 'call', label: 'Τηλέφωνο', value: profile.phone || '—' },
                      { icon: 'key', label: 'Σύνδεση', value: profile.provider === 'google' ? 'Google' : 'Email & κωδικός' },
                      { icon: 'calendar_month', label: 'Μέλος από', value: profile.joinDate },
                    ].map((row) => (
                      <div key={row.label} className="flex gap-3">
                        <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">{row.icon}</span>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                            {row.label}
                          </dt>
                          <dd className="font-bold text-on-surface mt-0.5">{row.value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              {/* Upcoming + quick stats */}
              <div className="lg:col-span-7 space-y-6">
                <section className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-level-2 p-6 md:p-8">
                  <h2 className="text-lg font-bold text-on-surface flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary">flight_takeoff</span>
                    Επόμενες εκδρομές
                  </h2>
                  {upcoming.length === 0 ? (
                    <div className="text-center py-10 px-4 rounded-2xl bg-surface-container-low border border-dashed border-black/10">
                      <span className="material-symbols-outlined text-5xl text-outline/40">luggage</span>
                      <p className="font-bold text-on-surface mt-3">Δεν έχετε επερχόμενες κρατήσεις</p>
                      <Link
                        to="/"
                        className="inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-full bg-primary-container text-white font-bold text-sm hover:scale-[0.98] transition-transform"
                      >
                        Αναζήτηση εκδρομής
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {upcoming.slice(0, 4).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => openTicket(b)}
                          className="group text-left rounded-2xl overflow-hidden border border-black/[0.06] shadow-sm hover:shadow-lg transition-all hover:-translate-y-1"
                        >
                          <div
                            className="h-28 bg-cover bg-center relative"
                            style={{ backgroundImage: `url(${tripImageFor(b)})` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                            <span className="absolute bottom-3 left-3 text-white font-bold text-sm leading-tight pr-2">
                              {b.tripTitle}
                            </span>
                          </div>
                          <div className="p-4 bg-white">
                            <p className="text-xs text-gray-500">
                              {b.date} · {b.time} · θέση <strong className="text-primary">{b.seat}</strong>
                            </p>
                            <p className="text-xs font-mono text-gray-400 mt-1">{b.pnr || b.id}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {bookings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('bookings')}
                    className="w-full py-4 rounded-2xl bg-primary-container text-white font-bold flex items-center justify-center gap-2 hover:scale-[0.99] transition-transform shadow-md"
                  >
                    <span className="material-symbols-outlined">confirmation_number</span>
                    Όλες οι κρατήσεις ({bookings.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold text-on-surface">Οι κρατήσεις μου</h2>
                <p className="text-sm text-on-surface-variant">
                  Συγχρονισμένο με Control Panel · {bookings.length} κρατήσεις
                </p>
              </div>

              {bookings.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] p-12 text-center shadow-level-2">
                  <span className="material-symbols-outlined text-6xl text-outline/30">confirmation_number</span>
                  <p className="text-xl font-bold text-on-surface mt-4">Δεν έχετε κρατήσεις</p>
                  <p className="text-on-surface-variant mt-2 max-w-md mx-auto">
                    Κάντε κράτηση με email <strong>{profile.email}</strong> — θα εμφανιστεί εδώ και στο admin.
                  </p>
                  <Link
                    to="/"
                    className="inline-block mt-8 px-8 py-3.5 rounded-full bg-primary-container text-white font-bold"
                  >
                    Κράτηση εκδρομής
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {bookings.map((b) => {
                    const st = statusStyle(b);
                    const paid = isPaid(b);
                    return (
                      <article
                        key={b.id}
                        className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-level-2 overflow-hidden flex flex-col md:flex-row"
                      >
                        <div
                          className="md:w-44 h-40 md:h-auto shrink-0 bg-cover bg-center relative"
                          style={{ backgroundImage: `url(${tripImageFor(b)})` }}
                        >
                          <div className="absolute inset-0 bg-black/30 md:bg-black/20" />
                        </div>
                        <div className="flex-1 p-5 flex flex-col">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-bold text-on-surface text-lg leading-snug">{b.tripTitle}</h3>
                            <span
                              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.className}`}
                            >
                              {b.status}
                            </span>
                          </div>
                          <p className="text-sm text-on-surface-variant mt-2">
                            {b.date} · {b.time || '—'} · θέση{' '}
                            <span className="font-bold text-primary">{b.seat}</span>
                          </p>
                          <p className="text-xs font-mono text-outline mt-1">
                            #{b.id} · PNR {b.pnr || '—'}
                          </p>
                          {bookingFiscalMark(b) ? (
                            <p className="text-[11px] font-mono text-emerald-700 mt-1 font-bold">
                              MARK {bookingFiscalMark(b)}
                            </p>
                          ) : null}
                          {b.tripId && paid ? (
                            <div className="mt-3 pt-3 border-t border-black/[0.05]">
                              <PassengerTrackCTA booking={b} compact showEta={false} />
                            </div>
                          ) : null}
                          <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                            <span className="text-xl font-bold text-on-surface">
                              €{Number(b.price || 0).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => openTicket(b)}
                              className="px-5 py-2.5 rounded-full bg-primary-container text-white text-sm font-bold hover:scale-[0.98] transition-transform"
                            >
                              Προβολή εισιτηρίου
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'lost_found' && (
            <LostFoundPanel profile={profile} bookings={bookings} />
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl space-y-6">
              <PushNotificationsPanel email={profile.email} />
              <CustomerSecurityPanel email={profile.email} authProvider={profile.provider} />
            </div>
          )}

          {isTicketView && (
            <BookingDetailPanel
              booking={selectedBooking}
              mode="customer"
              fullPage
              onBookingUpdated={handleBookingUpdated}
              onBack={() => {
                setActiveTab('bookings');
                setSelectedBookingId(null);
              }}
              onPrint={(b) => navigate(ticketPrintPath(b.id))}
            />
          )}
        </div>
      </main>
    </div>
  );
}
