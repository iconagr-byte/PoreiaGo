import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadTrips } from '../lib/trips/tripStore.js';
import { isInternationalTrip, MARKET_LABELS } from '../lib/trips/tripMarket.js';
import { checkTripAvailable } from '../lib/fleet/vehicleAvailability.js';
import TripPriceDisplay from '../components/TripPriceDisplay.jsx';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Custom Red Pin Marker (Google Maps Style)
const redIcon = L.divIcon({
  className: 'custom-red-pin',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 drop-shadow-lg" style="margin-top:-20px; margin-left:-8px;">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
});
L.Marker.prototype.options.icon = redIcon;

// Live Bus Marker (Pulsing Blue)
const liveBusIcon = L.divIcon({
  className: 'custom-live-bus',
  html: `
    <div class="relative w-12 h-12 flex items-center justify-center">
      <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-50"></div>
      <div class="relative w-10 h-10 bg-blue-600 rounded-full shadow-lg border-2 border-white flex items-center justify-center text-white">
        <span class="material-symbols-outlined text-[20px]">directions_bus</span>
      </div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24]
});

export default function TripDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  
  // Live Tracking State
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [busLocation, setBusLocation] = useState(null);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [progress, setProgress] = useState(0);
  const [nextStopName, setNextStopName] = useState("");

  useEffect(() => {
    const found = loadTrips().find(t => t.id === parseInt(id));
    if (found) {
      setTrip(found);
    }
  }, [id]);

  // Generate coordinates for polyline
  const positions = trip?.stops?.map(stop => [stop.lat, stop.lng]) || [];
  const mapCenter = positions.length > 0 ? positions[Math.floor(positions.length / 2)] : [38.0, 23.0];

  // Live Tracking Animation Logic
  useEffect(() => {
    if (!isLiveTracking || positions.length < 2) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        let newProgress = prev + 0.003; // speed of simulation
        if (newProgress >= 1) {
          // Move to next segment
          setCurrentSegment(curr => {
            if (curr >= positions.length - 2) {
              return 0; // Loop back for simulation purposes
            }
            return curr + 1;
          });
          return 0;
        }
        return newProgress;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isLiveTracking, positions.length]);

  useEffect(() => {
    if (!isLiveTracking || positions.length < 2) return;
    
    const startPos = positions[currentSegment];
    const endPos = positions[currentSegment + 1];
    
    if (startPos && endPos) {
      const lat = startPos[0] + (endPos[0] - startPos[0]) * progress;
      const lng = startPos[1] + (endPos[1] - startPos[1]) * progress;
      setBusLocation([lat, lng]);
      setNextStopName(trip.stops[currentSegment + 1]?.name || "");
    }
  }, [progress, currentSegment, isLiveTracking, positions, trip]);

  useEffect(() => {
    if (isLiveTracking && positions.length > 0 && !busLocation) {
      setBusLocation(positions[0]);
      setCurrentSegment(0);
      setProgress(0);
      setNextStopName(trip?.stops?.[1]?.name || "");
    }
  }, [isLiveTracking, positions, busLocation, trip]);

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="font-headline-md text-on-surface">Το δρομολόγιο δεν βρέθηκε.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans relative">
      {/* Navbar Minimal */}
      <header className="absolute top-0 w-full z-50 px-margin-desktop py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-on-surface-variant bg-surface-container hover:bg-surface-container-high px-4 py-2 rounded-full transition-colors font-label-md shadow-sm border border-black/[0.05]">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Πίσω
        </button>
      </header>

      {/* Hero Section */}
      <div className="relative pt-32 pb-12 flex-shrink-0 bg-surface overflow-hidden">
        {/* Soft elegant gradient instead of photo */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-surface to-surface pointer-events-none"></div>
        
        <div className="relative z-20 px-margin-desktop max-w-container-max mx-auto">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {isInternationalTrip(trip) ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs uppercase tracking-widest font-bold w-max">
                  <span className="material-symbols-outlined text-[14px]">public</span>
                  {trip.destination || MARKET_LABELS.international}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs uppercase tracking-widest font-bold w-max">
                  <span className="material-symbols-outlined text-[14px]">flag</span>
                  {MARKET_LABELS.domestic}
                </span>
              )}
              <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs uppercase tracking-widest font-bold w-max">
                Premium Εμπειρια
              </span>
              <span className="text-on-surface-variant font-label-md bg-surface-container-lowest px-3 py-1 rounded-full border border-black/[0.05] shadow-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                Ετοιμαστείτε για μια αξέχαστη απόδραση στις {new Date(trip.departureTime).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-headline-lg font-bold text-on-surface tracking-tight">
              {trip.title}
            </h1>
            <p className="text-on-surface-variant font-body-lg max-w-3xl mt-4 leading-relaxed">
              {trip.description}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content: Split Layout */}
      <div className="flex-1 max-w-container-max mx-auto w-full px-margin-desktop py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* Left Column: Details & Timeline */}
        <div className="flex flex-col">
          <div className="bg-surface-container-lowest rounded-[32px] p-8 shadow-level-2 mb-8">
            <h3 className="font-headline-md text-on-surface mb-6 font-semibold">Πληροφορίες</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">schedule</span>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Αναχώρηση</div>
                  <div className="font-label-lg text-on-surface">{new Date(trip.departureTime).toLocaleTimeString('el-GR', {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">directions_bus</span>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Οχημα</div>
                  <div className="font-label-lg text-on-surface">{trip.vehicleType}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">euro</span>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Τιμή</div>
                  <TripPriceDisplay trip={trip} showOccupancy size="sm" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">event_seat</span>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Διαθεσιμότητα</div>
                  <div className="font-label-lg text-on-surface">{trip.availableSeats} Θέσεις</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-[32px] p-8 shadow-level-2 mb-8 flex-1">
            <h3 className="font-headline-md text-on-surface mb-8 font-semibold">Στάσεις & Διαδρομή</h3>
            <div className="relative pl-6 border-l-2 border-surface-container-high space-y-8">
              {trip.stops?.map((stop, index) => (
                <div key={stop.id} className="relative">
                  <div className="absolute -left-[35px] top-1 w-4 h-4 rounded-full border-4 border-surface-container-lowest bg-primary"></div>
                  <div className="flex flex-col">
                    <span className="font-label-lg text-on-surface font-semibold">{stop.name}</span>
                    <span className="text-sm text-on-surface-variant mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {stop.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Mobile (Sticky) / Desktop (Inline) */}
          <div className="sticky bottom-6 lg:static">
            <button 
              type="button"
              onClick={async () => {
                const check = await checkTripAvailable(trip);
                if (!check.available) {
                  toast.error(check.reason || 'Το όχημα δεν είναι διαθέσιμο');
                  return;
                }
                if (check.warning) toast(check.warning, { icon: '⚠️' });
                navigate(`/select-seat/${trip.id}`);
              }}
              className="w-full py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-[24px] font-headline-sm font-bold shadow-xl hover:scale-[1.02] hover:shadow-gray-900/30 transition-all flex items-center justify-center gap-3"
            >
              Επιλογή Θέσης <span className="material-symbols-outlined text-2xl">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Right Column: Interactive Map with Controls Above */}
        <div className="flex flex-col w-full h-[500px] lg:h-auto lg:min-h-[600px] gap-4 relative z-0">
          
          {/* Live Tracking Header Controls */}
          <div className="flex flex-wrap items-center justify-between bg-surface-container-lowest px-5 py-3 rounded-2xl shadow-sm border border-black/[0.05]">
            <div className="font-label-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">route</span>
              Διαδρομή
            </div>
            
            <div className="flex items-center gap-4">
              {isLiveTracking && busLocation && (
                <div className="text-[11px] font-bold uppercase tracking-widest text-blue-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] animate-pulse">sensors</span> 
                  Καθ' οδον: <span className="text-on-surface">{nextStopName}</span>
                </div>
              )}
              <button 
                onClick={() => setIsLiveTracking(!isLiveTracking)}
                className={`px-4 py-2 rounded-full font-label-sm font-bold shadow-sm flex items-center gap-2 transition-all border ${isLiveTracking ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-surface text-on-surface-variant border-surface-variant hover:bg-surface-container'}`}
              >
                <span className={`w-2 h-2 rounded-full ${isLiveTracking ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></span>
                {isLiveTracking ? 'Live: On' : 'Live Tracking'}
              </button>
            </div>
          </div>

          <div className="flex-1 rounded-[32px] overflow-hidden shadow-level-2 border border-black/[0.05] relative z-0">
          
          {positions.length > 0 ? (
            <MapContainer center={mapCenter} zoom={7} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              {trip.stops?.map(stop => (
                <Marker key={stop.id} position={[stop.lat, stop.lng]}>
                  <Popup>
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      {stop.image && (
                        <div className="w-full h-28 rounded-lg overflow-hidden shadow-sm">
                          <img src={stop.image} alt={stop.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <div className="font-label-md font-bold text-gray-800 leading-tight">{stop.name}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          Άφιξη: {stop.time}
                        </div>
                        {stop.description && (
                          <div className="text-[11px] text-gray-600 mt-2 leading-relaxed border-t border-gray-100 pt-2">
                            {stop.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
              <Polyline positions={positions} color="#2563eb" weight={4} opacity={0.8} />
              
              {/* Live Bus Marker */}
              {isLiveTracking && busLocation && (
                <Marker position={busLocation} icon={liveBusIcon} zIndexOffset={1000} />
              )}
            </MapContainer>
          ) : (
            <div className="h-full w-full bg-surface-container flex items-center justify-center text-on-surface-variant font-label-md">
              Χωρίς δεδομένα χάρτη
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
