import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { mockTrips, mockCustomers, mockBookings, mockLostItems, mockPackingLists, mockGroupLobby, mockLocalEvents } from '../data/mockData';
import { loadBookings, getBookingById, isBookingPaid } from '../lib/ticketing/bookingStore.js';
import { loadTrips } from '../lib/trips/tripStore.js';
import TicketQrCode from '../components/TicketQrCode.jsx';
import LiveEtaCountdown from '../components/passenger/LiveEtaCountdown.jsx';
import { logoutCustomer } from '../lib/auth.js';
import { ticketPrintPath } from '../lib/ticketing/printTicket.js';

export default function DigitalWallet({ demoMode = false }) {
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(mockCustomers[0]);
  const [myBookings, setMyBookings] = useState([]);
  const [trip, setTrip] = useState(mockTrips[0]);
  const [activeBooking, setActiveBooking] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('trip'); // 'trip', 'packing', 'documents', 'history', 'rewards', 'lost_found'
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [feedbackGiven, setFeedbackGiven] = useState({}); // track which stops have feedback
  const [packingList, setPackingList] = useState([]);
  const [lobbyPassengers, setLobbyPassengers] = useState([]);
  const [greetedPassengers, setGreetedPassengers] = useState({}); // track "Say Hi" action
  const [localEvents, setLocalEvents] = useState([]);
  const [savedEvents, setSavedEvents] = useState({}); // track interested events

  const handleFeedback = (stopId, emoji) => {
    setFeedbackGiven(prev => ({ ...prev, [stopId]: emoji }));
    // In a real app, this would POST to the backend
  };

  useEffect(() => {
    const email = (localStorage.getItem('userEmail') || '').trim().toLowerCase();
    const foundCustomer =
      mockCustomers.find((c) => c.email.toLowerCase() === email) || mockCustomers[0];
    setCustomer(foundCustomer);

    const allBookings = loadBookings();
    const userBookings = allBookings.filter(
      (b) =>
        b.customerId === foundCustomer.id ||
        (email && String(b.email || '').toLowerCase() === email),
    );
    const bookingsForUser = userBookings.length
      ? userBookings
      : mockBookings.filter((b) => b.customerId === foundCustomer.id);

    const lastId = sessionStorage.getItem('lastBookingId');
    const sorted = [...bookingsForUser].sort(
      (a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0),
    );
    setMyBookings(sorted);

    const active =
      (lastId && getBookingById(lastId)) ||
      sorted.find((b) => isBookingPaid(b)) ||
      sorted[0];
    const trips = loadTrips();
    const nextTrip = active?.tripId
      ? trips.find((t) => t.id === active.tripId) ||
        trips.find((t) => t.title === active.tripTitle)
      : mockTrips.find((t) => t.title === active?.tripTitle);
    const resolvedTrip = nextTrip || mockTrips[0];
    setActiveBooking(active || null);
    setTrip(resolvedTrip);
    setPackingList(mockPackingLists[resolvedTrip.id] || []);
    setLobbyPassengers(mockGroupLobby[resolvedTrip.id] || []);
    setLocalEvents(mockLocalEvents[resolvedTrip.id] || []);
  }, []);

  const handleSaveEvent = (eventId) => {
    setSavedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const handleSayHi = (passengerId) => {
    setGreetedPassengers(prev => ({ ...prev, [passengerId]: true }));
  };

  const togglePackingItem = (itemId) => {
    setPackingList(prev => prev.map(item => item.id === itemId ? { ...item, isPacked: !item.isPacked } : item));
  };

  // Mock audio player logic
  React.useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setAudioProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      {/* Minimal Header */}
      <header className="w-full z-50 px-margin-desktop py-6 flex justify-between items-center bg-surface sticky top-0 border-b border-black/[0.05]">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center justify-center w-12 h-12 text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-full transition-colors shadow-sm border border-black/[0.05]"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h1 className="font-headline-sm font-bold text-on-surface">My Wallet</h1>
            <p className="text-xs text-on-surface-variant">
              {demoMode ? 'Demo πελάτη · john@example.com' : 'Οι κρατήσεις και ο λογαριασμός σας'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {customer && (
            <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-amber-100 to-amber-50 px-4 py-2 rounded-full border border-amber-200">
              <span className="material-symbols-outlined text-amber-500 text-[18px]">stars</span>
              <span className="font-label-md font-bold text-amber-800">{customer.points} AeroMiles</span>
            </div>
          )}
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
            {customer ? customer.name.substring(0, 2).toUpperCase() : 'JD'}
          </div>
          <button 
            onClick={() => {
              logoutCustomer();
              navigate('/login');
            }}
            className="text-on-surface-variant hover:text-red-500 transition-colors"
            title="Αποσύνδεση"
          >
            <span className="material-symbols-outlined text-[24px]">logout</span>
          </button>
        </div>
      </header>

      {customer && trip && (
      <main className="flex-1 px-margin-desktop py-12 max-w-container-max mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: The Ticket */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <h2 className="font-headline-md font-bold text-on-surface w-full mb-6">Επόμενη Εκδρομή</h2>
            
            {/* Apple Wallet Style Boarding Pass */}
            <div className="w-full max-w-[400px] bg-white rounded-[32px] shadow-level-2 overflow-hidden border border-black/[0.05] relative group hover:-translate-y-2 transition-transform duration-300">
              {/* Header with Image Background */}
              <div 
                className="relative p-6 bg-gray-900 text-white overflow-hidden"
              >
                {/* Background Image with Dark Gradient Overlay */}
                <div 
                  className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${trip.image})` }}
                ></div>
                <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90"></div>

                {/* Header Content (Relative for z-index) */}
                <div className="relative z-10">
                  <div className="flex flex-col gap-2 mt-2">
                    <h3 className="text-2xl font-bold font-display-md drop-shadow-md text-white leading-tight">
                      {trip.title}
                    </h3>
                    <div className="text-sm font-label-md text-gray-200 flex items-center gap-1.5 drop-shadow-md mt-1">
                      <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                      15 Ιουλ, 2026
                    </div>
                  </div>
                </div>
              </div>

              {/* Perforated Line */}
              <div className="relative h-6 bg-white flex items-center justify-center">
                <div className="absolute left-[-12px] w-6 h-6 bg-surface rounded-full border-r border-black/[0.05] z-10"></div>
                <div className="absolute right-[-12px] w-6 h-6 bg-surface rounded-full border-l border-black/[0.05] z-10"></div>
                <div className="w-full h-[2px] border-t-2 border-dashed border-gray-200 mx-6"></div>
              </div>

              {/* Ticket Details */}
              <div className="p-6 bg-white">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Επιβάτης</div>
                    <div className="font-label-lg font-bold text-gray-900">
                      {activeBooking?.customerName || customer.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Ημερομηνία</div>
                    <div className="font-label-lg font-bold text-gray-900">
                      {activeBooking?.date
                        ? new Date(activeBooking.date).toLocaleDateString('el-GR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Αναχώρηση</div>
                    <div className="font-label-lg font-bold text-gray-900">{activeBooking?.time || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Θέση</div>
                    <div className="font-label-lg font-bold text-primary text-xl">
                      {activeBooking?.seat || '—'}
                    </div>
                  </div>
                </div>

                {/* Signed QR — generated on-the-fly, not stored in DB */}
                <div className="flex flex-col items-center justify-center mt-2 border-t border-gray-100 pt-6">
                  <TicketQrCode booking={activeBooking || myBookings[0]} size={160} />
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-gray-500">Κωδικός κράτησης</span>
                    <code className="text-xs font-mono font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded-lg">
                      {activeBooking?.pnr || activeBooking?.ticketRef || activeBooking?.id || '—'}
                    </code>
                    {(activeBooking?.pnr || activeBooking?.ticketRef) && (
                      <button
                        type="button"
                        onClick={() => {
                          const code = activeBooking.pnr || activeBooking.ticketRef;
                          navigator.clipboard?.writeText(code);
                          toast.success('Ο κωδικός αντιγράφηκε');
                        }}
                        className="text-primary text-xs font-bold hover:underline"
                      >
                        Αντιγραφή
                      </button>
                    )}
                  </div>
                  {activeBooking?.syncedToSaas && (
                    <p className="text-[10px] text-indigo-600 mt-2 flex items-center justify-center gap-1 font-bold">
                      <span className="material-symbols-outlined text-[14px]">cloud_done</span>
                      Κράτηση στο cloud · myDATA σε ουρά
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1 max-w-[240px] text-center">
                    Rotating QR · ανανέωση κάθε 30s
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/in-bus')}
                    className="mt-4 flex items-center justify-center gap-2 w-full max-w-[240px] py-2.5 rounded-full bg-indigo-600 text-white text-sm font-bold hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-[18px]">wifi</span>
                    In-Bus Portal
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!activeBooking) {
                  toast.error('Δεν υπάρχει ενεργή κράτηση');
                  return;
                }
                navigate(ticketPrintPath(activeBooking.id));
              }}
              className="mt-8 flex items-center justify-center gap-2 bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-md font-bold py-3 px-6 rounded-full w-full max-w-[400px] transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">download</span> Εκτύπωση / PDF
            </button>
          </div>

          {/* Right Column: Tabs Content */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            
            {/* Tabs Navigation */}
            <div className="flex p-1 bg-surface-container-low rounded-2xl w-full mx-auto lg:mx-0 overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => setActiveTab('trip')}
                className={`flex-1 min-w-[100px] py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'trip' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Ταξίδι
              </button>
              <button 
                onClick={() => setActiveTab('packing')}
                className={`flex-1 min-w-[140px] py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === 'packing' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-indigo-600/80 hover:text-indigo-600'}`}
              >
                <span className="material-symbols-outlined text-[16px]">luggage</span>
                Smart Packing
              </button>
              <button 
                onClick={() => setActiveTab('lobby')}
                className={`flex-1 min-w-[110px] py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === 'lobby' ? 'bg-teal-100 text-teal-700 shadow-sm' : 'text-teal-600/80 hover:text-teal-600'}`}
              >
                <span className="material-symbols-outlined text-[16px]">groups</span>
                Lobby
              </button>
              <button 
                onClick={() => setActiveTab('events')}
                className={`flex-1 min-w-[110px] py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === 'events' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-orange-600/80 hover:text-orange-600'}`}
              >
                <span className="material-symbols-outlined text-[16px]">local_activity</span>
                Events
              </button>
              <button 
                onClick={() => setActiveTab('documents')}
                className={`flex-1 min-w-[100px] py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'documents' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Έγγραφα
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 min-w-[120px] py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Οι Κρατήσεις μου
              </button>
              <button 
                onClick={() => setActiveTab('rewards')}
                className={`flex-1 min-w-[120px] py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === 'rewards' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-amber-600/80 hover:text-amber-600'}`}
              >
                <span className="material-symbols-outlined text-[16px]">stars</span>
                Επιβραβεύσεις
              </button>
              <button 
                onClick={() => setActiveTab('lost_found')}
                className={`flex-1 min-w-[140px] py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === 'lost_found' ? 'bg-rose-100 text-rose-700 shadow-sm' : 'text-rose-600/80 hover:text-rose-600'}`}
              >
                <span className="material-symbols-outlined text-[16px]">support_agent</span>
                Απωλεσθέντα
              </button>
            </div>

            {/* TAB: TRIP INFO */}
            {activeTab === 'trip' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <LiveEtaCountdown tripId={trip.id} />

                {/* Audio Guide Player */}
                <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/[0.05]">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                        <span className="material-symbols-outlined text-[16px]">headphones</span> Audio Guide
                      </div>
                      <h3 className="font-headline-sm font-bold text-gray-900">Ξενάγηση: {trip.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">Ακούστε πληροφορίες για τα Μετέωρα πριν φτάσετε.</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-sm">
                      <img src={trip.image} alt={trip.title} className="w-full h-full object-cover" />
                    </div>
                  </div>

                  {/* Player UI */}
                  <div className="bg-surface-container-lowest rounded-[24px] p-6 border border-gray-100 flex items-center gap-6">
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-16 h-16 shrink-0 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                    >
                      <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                    
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                        <span>01:12</span>
                        <span>14:30</span>
                      </div>
                      {/* Progress Bar */}
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden relative cursor-pointer">
                        <div 
                          className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${audioProgress}%` }}
                        ></div>
                      </div>
                      <div className="mt-3 flex gap-1 justify-between opacity-40">
                        {[...Array(40)].map((_, i) => (
                          <div key={i} className="w-1 bg-gray-400 rounded-full" style={{ height: `${Math.max(4, Math.random() * 24)}px` }}></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Itinerary Summary */}
                <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/[0.05]">
                  <h3 className="font-headline-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-gray-400">map</span>
                    Πρόγραμμα Εκδρομής
                  </h3>
                  
                  <div className="relative pl-6 border-l-2 border-gray-100 space-y-8">
                    {(trip.stops || []).map((stop, index) => (
                      <div key={stop.id} className="relative">
                        <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full border-[3px] border-white bg-gray-300"></div>
                        <div className="flex flex-col">
                          <span className="font-label-lg text-gray-900 font-bold">{stop.name}</span>
                          <span className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            {stop.time}
                          </span>
                          
                          {/* Live Feedback (Micro-Moments) UI */}
                          <div className="mt-3 bg-surface-container-lowest border border-gray-100 p-3 rounded-2xl flex items-center justify-between shadow-sm max-w-sm">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Αξιολόγηση Στάσης:</span>
                            {feedbackGiven[stop.id] ? (
                              <div className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full flex items-center gap-1 animate-in zoom-in">
                                Ευχαριστούμε! {feedbackGiven[stop.id]}
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => handleFeedback(stop.id, '🤩')} className="text-2xl hover:scale-125 transition-transform" title="Τέλεια">🤩</button>
                                <button onClick={() => handleFeedback(stop.id, '😐')} className="text-2xl hover:scale-125 transition-transform" title="Μέτρια">😐</button>
                                <button onClick={() => handleFeedback(stop.id, '😡')} className="text-2xl hover:scale-125 transition-transform" title="Χάλια">😡</button>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB: SMART PACKING */}
            {activeTab === 'packing' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/[0.05]">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-headline-sm font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-500">luggage</span>
                        Smart Packing List
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Εξατομικευμένη λίστα για: {trip.title}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-8">
                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                      <span>Πρόοδος Ετοιμασίας</span>
                      <span>{Math.round((packingList.filter(i => i.isPacked).length / packingList.length) * 100) || 0}%</span>
                    </div>
                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${(packingList.filter(i => i.isPacked).length / packingList.length) * 100 || 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Checklist Categories */}
                  <div className="space-y-6">
                    {Object.entries(
                      packingList.reduce((acc, item) => {
                        acc[item.category] = acc[item.category] || [];
                        acc[item.category].push(item);
                        return acc;
                      }, {})
                    ).map(([category, items]) => (
                      <div key={category}>
                        <h4 className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-wider">{category}</h4>
                        <div className="space-y-2">
                          {items.map(item => (
                            <label key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${item.isPacked ? 'bg-indigo-50/50 border-indigo-100' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                              <input 
                                type="checkbox" 
                                checked={item.isPacked}
                                onChange={() => togglePackingItem(item.id)}
                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className={`font-medium ${item.isPacked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {item.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB: LOBBY */}
            {activeTab === 'lobby' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/[0.05]">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-headline-sm font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-teal-500">groups</span>
                        Lobby Συνεπιβατών
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Γνωρίστε την παρέα της εκδρομής: {trip.title}</p>
                    </div>
                  </div>

                  {/* My Profile Quick Setup */}
                  <div className="bg-teal-50/50 rounded-2xl p-6 border border-teal-100 mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xl">
                        {customer.name.substring(0, 1)}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{customer.name} (Εσείς)</div>
                        <div className="text-sm text-teal-700 mt-1 flex gap-2">
                          <span className="bg-white px-2 py-0.5 rounded-full border border-teal-200 text-xs shadow-sm">✈️ Travel Lover</span>
                          <span className="bg-white px-2 py-0.5 rounded-full border border-teal-200 text-xs shadow-sm cursor-pointer hover:bg-teal-50">+ Προσθήκη Tag</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grid of Passengers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {lobbyPassengers.map(p => (
                      <div key={p.id} className="border border-gray-100 rounded-2xl p-4 flex items-start gap-4 hover:shadow-md transition-shadow bg-white relative overflow-hidden">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${p.color}`}>
                          {p.initials}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 mb-1">{p.name}</div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {(p.interests || []).map((interest, idx) => (
                              <span key={idx} className="bg-gray-50 border border-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">
                                {interest}
                              </span>
                            ))}
                          </div>
                          {greetedPassengers[p.id] ? (
                            <div className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-1 animate-in zoom-in">
                              Είπατε Γεια! 👋
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleSayHi(p.id)}
                              className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-teal-50 hover:text-teal-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">waving_hand</span>
                              Say Hi
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {lobbyPassengers.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      Προς το παρόν δεν υπάρχουν άλλοι επιβάτες στο Lobby.
                    </div>
                  )}
                </section>
              </div>
            )}


            {/* TAB: EVENTS */}
            {activeTab === 'events' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/[0.05]">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-headline-sm font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-orange-500">local_activity</span>
                        Τοπικές Εκδηλώσεις
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Ανακαλύψτε τι συμβαίνει κατά τη διάρκεια του ταξιδιού: {trip.title}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {localEvents.map(event => (
                      <div key={event.id} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col group">
                        <div className="h-40 relative overflow-hidden">
                          <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-800 shadow-sm">
                            {event.type}
                          </div>
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <h4 className="font-bold text-gray-900 text-lg mb-2 leading-tight">{event.title}</h4>
                          <div className="flex flex-col gap-1 text-sm text-gray-500 mb-4 flex-1">
                            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">calendar_month</span> {event.date}</span>
                            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">location_on</span> {event.location}</span>
                            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">sell</span> {event.price}</span>
                          </div>
                          <button 
                            onClick={() => handleSaveEvent(event.id)}
                            className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${savedEvents[event.id] ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {savedEvents[event.id] ? 'check_circle' : 'favorite'}
                            </span>
                            {savedEvents[event.id] ? 'Αποθηκεύτηκε' : 'Ενδιαφέρομαι'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {localEvents.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      Δεν βρέθηκαν προγραμματισμένες εκδηλώσεις για αυτές τις ημερομηνίες.
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB: DOCUMENTS UPLOAD */}
            {activeTab === 'documents' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/[0.05]">
                  <h3 className="font-headline-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">folder_open</span>
                    Ταξιδιωτικά Έγγραφα
                  </h3>
                  <p className="text-sm text-gray-500 mb-8">Ανεβάστε τα απαραίτητα έγγραφα για το ταξίδι σας (π.χ. ταυτότητα, δικαιολογητικά).</p>
                  
                  {/* Upload Box */}
                  <div className="border-2 border-dashed border-gray-300 rounded-3xl p-10 text-center hover:bg-gray-50 transition-colors cursor-pointer flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-3xl">upload_file</span>
                    </div>
                    <span className="font-label-lg font-bold text-gray-900 mb-1">Πατήστε για Ανέβασμα Αρχείου</span>
                    <span className="text-xs text-gray-500">ή σύρετε το αρχείο εδώ (PDF, JPG, PNG)</span>
                  </div>

                  {/* Uploaded Files List */}
                  <div className="mt-8 space-y-3">
                    <h4 className="font-label-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Αποθηκευμενα Εγγραφα</h4>
                    
                    {/* Mock File 1 */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-lowest border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 text-red-500 rounded-xl">
                          <span className="material-symbols-outlined">picture_as_pdf</span>
                        </div>
                        <div>
                          <div className="font-label-md font-bold text-gray-900">Ταυτότητα_Copy.pdf</div>
                          <div className="text-xs text-gray-500">Προστέθηκε: Σήμερα • 1.2 MB</div>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>

                  </div>
                </section>
              </div>
            )}

            {/* TAB: BOOKING HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/[0.05]">
                  <h3 className="font-headline-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-gray-400">history</span>
                    Ιστορικό Κρατήσεων
                  </h3>
                  
                  <div className="space-y-4">
                    {myBookings.map((booking) => (
                      <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors gap-4">
                        <div>
                          <div className="font-label-md font-bold text-gray-900">{booking.tripTitle}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            Κωδικός: {booking.id} • Θέσεις:{' '}
                            {booking.seats?.join(', ') || booking.seat || '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-gray-500">{booking.date}</div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            booking.status === 'Επιβεβαιωμένη' ? 'bg-green-50 text-green-700' :
                            booking.status === 'Ολοκληρώθηκε' ? 'bg-gray-100 text-gray-600' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB: REWARDS & GAMIFICATION */}
            {activeTab === 'rewards' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/[0.05] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <span className="material-symbols-outlined text-[150px] text-amber-500">stars</span>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold uppercase tracking-widest mb-4 border border-amber-200">
                      AeroMiles Loyalty
                    </div>
                    <h3 className="text-4xl font-display-sm font-bold text-gray-900 mb-1">{customer.points} <span className="text-xl text-gray-400">πόντοι</span></h3>
                    <p className="text-sm text-gray-500 mb-8">Είστε στο επίπεδο {customer.tier}. Συνεχίστε να ταξιδεύετε για να ξεκλειδώσετε περισσότερα δώρα!</p>
                    
                    {/* Progress Bar */}
                    <div className="bg-surface-container-lowest p-6 rounded-[24px] border border-gray-100 mb-8">
                      <div className="flex justify-between items-end mb-3">
                        <div>
                          <div className="font-label-md font-bold text-gray-900">Δωρεάν Ξενάγηση (Επόμενος Στόχος)</div>
                          <div className="text-xs text-gray-500 mt-1">Χρειάζεστε {Math.max(0, 1500 - customer.points)} ακόμα πόντους</div>
                        </div>
                        <div className="font-bold text-amber-600">1500 πόντοι</div>
                      </div>
                      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden relative">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, (customer.points / 1500) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Available Redemptions */}
                    <h4 className="font-headline-sm font-bold text-gray-900 mb-4">Εξαργύρωση Πόντων</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className={`p-5 rounded-2xl border ${customer.points >= 500 ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-60'} transition-colors relative`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className={`p-2 rounded-xl ${customer.points >= 500 ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}>
                            <span className="material-symbols-outlined">discount</span>
                          </div>
                          <span className="font-bold text-sm bg-white px-2 py-1 rounded-lg border border-black/[0.05]">500 πόντοι</span>
                        </div>
                        <div className="font-label-lg font-bold text-gray-900 mb-1">Έκπτωση 10%</div>
                        <div className="text-xs text-gray-500">Σε οποιαδήποτε μελλοντική εκδρομή μας.</div>
                        {customer.points >= 500 && (
                          <button className="mt-4 text-sm font-bold text-amber-700 flex items-center gap-1 group">
                            Εξαργύρωση <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                          </button>
                        )}
                      </div>

                      <div className={`p-5 rounded-2xl border ${customer.points >= 1500 ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-60'} transition-colors relative`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className={`p-2 rounded-xl ${customer.points >= 1500 ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}>
                            <span className="material-symbols-outlined">map</span>
                          </div>
                          <span className="font-bold text-sm bg-white px-2 py-1 rounded-lg border border-black/[0.05]">1500 πόντοι</span>
                        </div>
                        <div className="font-label-lg font-bold text-gray-900 mb-1">Δωρεάν Ξενάγηση</div>
                        <div className="text-xs text-gray-500">Μία τοπική ξενάγηση σε εκδρομή της επιλογής σας.</div>
                        {customer.points >= 1500 && (
                          <button className="mt-4 text-sm font-bold text-amber-700 flex items-center gap-1 group">
                            Εξαργύρωση <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* TAB: LOST & FOUND */}
            {activeTab === 'lost_found' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/[0.05]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">support_agent</span>
                    </div>
                    <div>
                      <h3 className="font-headline-sm font-bold text-gray-900">Δήλωση Απώλειας</h3>
                      <p className="text-sm text-gray-500">Ξεχάσατε κάτι στο λεωφορείο; Ενημερώστε μας αμέσως.</p>
                    </div>
                  </div>

                  <form className="space-y-4 mb-8" onSubmit={(e) => { e.preventDefault(); alert('Η δήλωση σας καταχωρήθηκε επιτυχώς! Το πλήρωμα έχει ειδοποιηθεί.'); }}>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Κατηγορία Αντικειμένου</label>
                      <select required className="w-full bg-surface-container-low border border-surface-container rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none">
                        <option value="">Επιλέξτε...</option>
                        <option value="electronics">Ηλεκτρονικά (Κινητό, Laptop κλπ)</option>
                        <option value="documents">Προσωπικά Έγγραφα / Πορτοφόλι</option>
                        <option value="clothing">Ρούχα / Αξεσουάρ</option>
                        <option value="other">Άλλο</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Τελευταία Τοποθεσία (Πού πιστεύετε ότι το αφήσατε;)</label>
                      <input required type="text" placeholder="π.χ. Στη θέση μου (12Α), στο δρομολόγιο για Μετέωρα" className="w-full bg-surface-container-low border border-surface-container rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Περιγραφή</label>
                      <textarea required rows="3" placeholder="Δώστε όσο το δυνατόν περισσότερες λεπτομέρειες (χρώμα, μάρκα, ιδιαίτερα χαρακτηριστικά)..." className="w-full bg-surface-container-low border border-surface-container rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none resize-none"></textarea>
                    </div>
                    <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex justify-center items-center gap-2">
                      <span className="material-symbols-outlined text-[20px]">send</span> Υποβολή Δήλωσης
                    </button>
                  </form>

                  <h4 className="font-headline-sm font-bold text-gray-900 mb-4 border-t border-gray-100 pt-6">Οι Δηλώσεις μου</h4>
                  <div className="space-y-4">
                    {mockLostItems.filter(item => item.customerName === customer.name).length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Δεν έχετε υποβάλει καμία δήλωση απώλειας.</p>
                    ) : (
                      mockLostItems.filter(item => item.customerName === customer.name).map(item => (
                        <div key={item.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold bg-white px-2 py-0.5 rounded border border-gray-200">{item.id}</span>
                              <span className="font-bold text-gray-900 text-sm">{item.itemCategory}</span>
                            </div>
                            <p className="text-xs text-gray-600">{item.description}</p>
                            <p className="text-[10px] text-gray-400 mt-2">Υποβλήθηκε: {new Date(item.dateReported).toLocaleString('el-GR')}</p>
                          </div>
                          <div>
                            {item.status === 'OPEN' && <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold"><span className="material-symbols-outlined text-[14px]">search</span> Σε αναζήτηση</span>}
                            {item.status === 'FOUND' && <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold"><span className="material-symbols-outlined text-[14px]">check_circle</span> Βρέθηκε!</span>}
                            {item.status === 'CLOSED' && <span className="inline-flex items-center gap-1 bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold"><span className="material-symbols-outlined text-[14px]">inventory_2</span> Επεστράφη</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}

          </div>
        </div>
      </main>
      )}
    </div>
  );
}
