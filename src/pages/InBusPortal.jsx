import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookingById } from '../lib/ticketing/bookingStore.js';
import { loadTrips } from '../lib/trips/tripStore.js';

export default function InBusPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('movies');
  const [trip, setTrip] = useState(null);

  useEffect(() => {
    const lastId = sessionStorage.getItem('lastBookingId');
    const booking = lastId ? getBookingById(lastId) : null;
    const trips = loadTrips();
    const t =
      (booking?.tripId && trips.find((x) => x.id === booking.tripId)) ||
      trips.find((x) => x.title === booking?.tripTitle) ||
      trips[0];
    setTrip(t || null);
  }, []);

  const routeLabel = useMemo(() => {
    if (!trip) return '—';
    const stops = trip.stops || [];
    if (stops.length >= 2) {
      return `${stops[0].name} → ${stops[stops.length - 1].name}`;
    }
    return trip.title || '—';
  }, [trip]);

  const movies = [
    { id: 1, title: "Dune: Part Two", genre: "Sci-Fi", time: "2h 46m", img: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=400" },
    { id: 2, title: "Oppenheimer", genre: "Drama", time: "3h", img: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&q=80&w=400" },
    { id: 3, title: "Poor Things", genre: "Comedy", time: "2h 21m", img: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&q=80&w=400" }
  ];

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans pb-24">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800 p-4 px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-white font-bold">directions_bus</span>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white">In-Bus Portal</h1>
            <div className="flex items-center gap-1.5 text-green-400 text-xs font-bold">
              <span className="material-symbols-outlined text-[14px]">wifi</span>
              WiFi Onboard
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/login', { state: { from: '/wallet' } })}
          className="bg-gray-900 hover:bg-gray-800 text-gray-300 px-4 py-2 rounded-full text-sm font-bold transition-colors"
        >
          Wallet
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-10">
        <section className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="text-gray-400 text-sm font-bold tracking-wider uppercase mb-1">Τρέχουσα εκδρομή</div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{trip?.title || '—'}</h2>
            <p className="text-indigo-300 text-sm mb-6">{routeLabel}</p>
            {trip?.departureTime && (
              <p className="text-gray-400 text-sm">
                Αναχώρηση:{' '}
                {new Date(trip.departureTime).toLocaleString('el-GR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => navigate('/login', { state: { from: '/wallet' } })}
            className="bg-gray-900 border border-gray-800 hover:border-indigo-500/50 rounded-2xl p-4 flex flex-col items-center gap-2"
          >
            <span className="material-symbols-outlined text-indigo-400 text-3xl">confirmation_number</span>
            <span className="font-bold text-sm">Εισιτήριο</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('movies')}
            className="bg-gray-900 border border-gray-800 hover:border-indigo-500/50 rounded-2xl p-4 flex flex-col items-center gap-2"
          >
            <span className="material-symbols-outlined text-purple-400 text-3xl">movie</span>
            <span className="font-bold text-sm">Ταινίες</span>
          </button>
          <button
            type="button"
            className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col items-center gap-2 opacity-70"
          >
            <span className="material-symbols-outlined text-orange-400 text-3xl">coffee</span>
            <span className="font-bold text-sm">Σνακ</span>
          </button>
          <button
            type="button"
            className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col items-center gap-2 opacity-70"
          >
            <span className="material-symbols-outlined text-emerald-400 text-3xl">support_agent</span>
            <span className="font-bold text-sm">Βοήθεια</span>
          </button>
        </section>

        {activeTab === 'movies' && (
          <section>
            <h3 className="text-xl font-bold mb-4">Onboard Entertainment</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {movies.map((m) => (
                <div key={m.id} className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
                  <img src={m.img} alt="" className="w-full h-32 object-cover" />
                  <div className="p-3">
                    <p className="font-bold">{m.title}</p>
                    <p className="text-xs text-gray-500">{m.genre} · {m.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
