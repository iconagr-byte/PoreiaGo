import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadTrips } from '../lib/trips/tripStore.js';
import { generateSeatMap } from '../lib/seats/generateSeatMap.js';
import { savePendingCheckout } from '../lib/ticketing/pendingCheckout.js';
import MinimalPageBackground from '../components/MinimalPageBackground.jsx';
import { checkTripAvailable } from '../lib/fleet/vehicleAvailability.js';
import { useTripPricing } from '../hooks/useTripPricing.js';
import { trackAbandonedCheckout } from '../lib/revenue/abandonedCart.js';
import LuxuryBusSeatMap from '../components/seats/LuxuryBusSeatMap.jsx';
import SeatSelectionAside from '../components/seats/SeatSelectionAside.jsx';
import {
  enrichSeatsWithPricing,
  getLayoutIdForTrip,
  sumSelectedSeatPrices,
} from '../lib/seats/seatPricing.js';
import { fetchPublicSeatPricing } from '../services/seatPricingApi.js';
import {
  getSeatMapCheckoutButtonClass,
  getSeatMapHeaderClasses,
  resolveTripSeatMapTheme,
} from '../lib/seats/seatMapThemes.js';

export default function SeatSelection() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [fleetCheck, setFleetCheck] = useState({ loading: true, available: true, reason: null, warning: null });
  const [seatPricingConfig, setSeatPricingConfig] = useState(null);

  const trip = useMemo(() => {
    const id = Number(tripId);
    if (!id) return null;
    return loadTrips().find((t) => t.id === id) || null;
  }, [tripId]);

  const { pricePerSeat, quote } = useTripPricing(trip);
  const tripBasePrice = quote?.finalPrice ?? trip?.price ?? 0;

  useEffect(() => {
    if (!trip) return;
    const layoutId = getLayoutIdForTrip(trip);
    fetchPublicSeatPricing(layoutId).then(setSeatPricingConfig);
  }, [trip]);

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    setFleetCheck((s) => ({ ...s, loading: true }));
    checkTripAvailable(trip).then((result) => {
      if (!cancelled) {
        setFleetCheck({
          loading: false,
          available: result.available !== false,
          reason: result.reason || null,
          warning: result.warning || null,
        });
        if (result.available === false && result.reason) {
          toast.error(result.reason, { id: 'fleet-block' });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [trip]);

  const { layout, seats, availableCount } = useMemo(() => {
    if (!trip) return { layout: null, seats: [], availableCount: 0 };
    const map = generateSeatMap(trip);
    const priced = enrichSeatsWithPricing(map.seats, seatPricingConfig, tripBasePrice);
    return { ...map, seats: priced, availableCount: map.availableCount };
  }, [trip, seatPricingConfig, tripBasePrice]);

  const seatTheme = useMemo(() => resolveTripSeatMapTheme(trip), [trip]);
  const headerChrome = useMemo(() => getSeatMapHeaderClasses(seatTheme), [seatTheme]);

  const handleSeatClick = (seat) => {
    if (seat.status === 'BOOKED') return;
    setSelectedSeats((prev) =>
      prev.includes(seat.id) ? prev.filter((id) => id !== seat.id) : [...prev, seat.id],
    );
  };

  if (!trip || !layout) {
    return (
      <div className="relative min-h-screen bg-surface flex items-center justify-center p-6">
        <MinimalPageBackground />
        <div className="relative z-10 bg-surface-container-lowest/95 backdrop-blur-sm rounded-2xl p-8 text-center max-w-sm shadow-sm border border-black/[0.05]">
          <span className="material-symbols-outlined text-4xl text-error mb-3">error</span>
          <h1 className="font-bold text-lg text-on-surface mb-2">Η εκδρομή δεν βρέθηκε</h1>
          <Link to="/" className="text-primary font-bold text-sm hover:underline">
            Αρχική σελίδα
          </Link>
        </div>
      </div>
    );
  }

  const selectedSeatRows = seats.filter((s) => selectedSeats.includes(s.id));
  const selectedLabels = selectedSeatRows.map((s) => s.number).join(', ');
  const total = sumSelectedSeatPrices(seats, selectedSeats);
  const showSeatPopup = seatPricingConfig?.show_popup !== false;
  const availablePrices = seats
    .filter((s) => s.status !== 'BOOKED')
    .map((s) => s.priceEur)
    .filter((n) => Number.isFinite(n));
  const fromPrice =
    availablePrices.length > 0 ? Math.min(...availablePrices) : tripBasePrice;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#f8f6f1] via-surface to-[#eef1f5] py-6 px-4 md:py-8">
      <MinimalPageBackground />
      <div className="relative z-10 max-w-7xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(`/trip/${trip.id}`)}
          className="mb-4 flex items-center gap-1.5 text-on-surface-variant hover:text-primary font-bold text-sm"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Πίσω
        </button>

        <div
          className={`rounded-[1.75rem] border p-5 md:p-6 mb-5 text-white overflow-hidden relative ${headerChrome.wrapper}`}
        >
          <div
            className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none ${headerChrome.glow}`}
          />
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.25em] mb-2 flex items-center gap-1.5 ${headerChrome.badge}`}
          >
            <span className="material-symbols-outlined text-[15px]">diamond</span>
            {seatTheme.vipLabel} · {trip.vehicleType || layout.label}
          </p>
          <h1 className="font-display-md font-bold text-xl md:text-2xl mb-2 tracking-tight">
            Επιλέξτε την ιδανική θέση σας
          </h1>
          <p className="text-sm text-white/70 leading-relaxed max-w-lg">
            Ανακαλύψτε τη διάταξη του{' '}
            <strong className={`font-semibold ${headerChrome.accent}`}>{layout.label}</strong> —{' '}
            {seatTheme.vipLabel} μπροστά, άνεση σε κάθε σειρά.
          </p>
          <p className="text-xs text-white/50 mt-3 truncate">{trip.title}</p>
          {trip.vehiclePlate && (
            <p className={`text-[10px] font-mono mt-1 tracking-wider ${headerChrome.plate}`}>
              {trip.vehiclePlate}
            </p>
          )}
        </div>

        {!fleetCheck.loading && !fleetCheck.available && fleetCheck.reason && (
          <div className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium flex gap-2">
            <span className="material-symbols-outlined shrink-0">block</span>
            {fleetCheck.reason}
          </div>
        )}
        {!fleetCheck.loading && fleetCheck.warning && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex gap-2">
            <span className="material-symbols-outlined shrink-0">warning</span>
            {fleetCheck.warning}
          </div>
        )}

        <SeatSelectionAside
          compact
          trip={trip}
          layout={layout}
          seatTheme={seatTheme}
          seatPricingConfig={seatPricingConfig}
          seats={seats}
          tripBasePrice={tripBasePrice}
          selectedSeatRows={selectedSeatRows}
          availableCount={availableCount}
          className="mb-4 xl:hidden"
        />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,17.5rem)_minmax(0,20rem)_minmax(0,18rem)] gap-6 xl:gap-8 items-start justify-center">
          <SeatSelectionAside
            trip={trip}
            layout={layout}
            seatTheme={seatTheme}
            seatPricingConfig={seatPricingConfig}
            seats={seats}
            tripBasePrice={tripBasePrice}
            selectedSeatRows={selectedSeatRows}
            availableCount={availableCount}
            className="hidden xl:block xl:sticky xl:top-6"
          />

          <div className="w-full flex flex-col items-center xl:justify-self-center">
            <LuxuryBusSeatMap
              layout={layout}
              seats={seats}
              selectedSeats={selectedSeats}
              onSeatClick={handleSeatClick}
              availableCount={availableCount}
              theme={seatTheme}
              vehicleType={trip.vehicleType}
              showSeatPopup={showSeatPopup}
            />
          </div>

          <div className="w-full xl:w-auto shrink-0 xl:sticky xl:top-6 xl:justify-self-end">
            <div className="bg-white/90 backdrop-blur-md rounded-[1.5rem] p-5 border border-amber-500/10 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-800 text-[18px]">shopping_bag</span>
                </span>
                Η κράτησή σας
              </h3>
              <div className="space-y-3 mb-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Θέσεις</span>
                  <span className="font-bold text-on-surface">{selectedLabels || '—'}</span>
                </div>
                <div className="flex justify-between items-end gap-2">
                  <span className="text-on-surface-variant">Τιμές θέσεων</span>
                  <span className="text-xs text-on-surface-variant text-right">
                    {selectedSeatRows.length > 0
                      ? selectedSeatRows.map((s) => `${s.number} €${s.priceEur.toFixed(0)}`).join(' · ')
                      : `από €${fromPrice.toFixed(0)}`}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-surface-container">
                  <span className="font-bold">Σύνολο</span>
                  <span className="text-xl font-bold text-primary">€{total.toFixed(2)}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={selectedSeats.length === 0 || !fleetCheck.available || fleetCheck.loading}
                onClick={() => {
                  savePendingCheckout({
                    tripId: trip.id,
                    seats: selectedLabels,
                    total,
                    pricePerSeat: selectedSeatRows.length ? total / selectedSeatRows.length : tripBasePrice,
                    seatBreakdown: selectedSeatRows.map((s) => ({
                      number: s.number,
                      priceEur: s.priceEur,
                      tier: s.tier,
                    })),
                  });
                  trackAbandonedCheckout({
                    tripId: trip.id,
                    tripTitle: trip.title,
                    seats: selectedLabels,
                    amountEur: total,
                  });
                  navigate(`/checkout/${trip.id}`);
                }}
                className={`w-full py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${getSeatMapCheckoutButtonClass(selectedSeats.length > 0, seatTheme)}`}
              >
                Ολοκλήρωση
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
