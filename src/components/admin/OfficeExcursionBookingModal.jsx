/**
 * Desk flow: add an excursion booking to a CRM customer
 * (trip → seats → office cash / pay on bus).
 * Seat step uses the same LuxuryBusSeatMap as storefront booking.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { listPublishedTrips, loadTrips } from '../../lib/trips/tripStore.js';
import { getLayoutForVehicle } from '../../lib/seats/busLayouts.js';
import { resolveTripSeatMapTheme } from '../../lib/seats/seatMapThemes.js';
import { loadBookings, createBookingFromCheckout, recordCashPayment } from '../../lib/ticketing/bookingStore.js';
import { PAYMENT_PLAN_FULL, roundMoney } from '../../lib/payments/depositPayment.js';
import LuxuryBusSeatMap from '../seats/LuxuryBusSeatMap.jsx';
import SeatSelectionAside from '../seats/SeatSelectionAside.jsx';

function seatsTakenForTrip(tripId, bookings) {
  const taken = new Set();
  const tid = String(tripId ?? '');
  for (const b of bookings || []) {
    if (String(b.tripId ?? '') !== tid) continue;
    const status = String(b.status || '').toLowerCase();
    if (status.includes('ακυρ') || status === 'cancelled' || status === 'refunded') continue;
    const list = Array.isArray(b.seats)
      ? b.seats
      : String(b.seat || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    list.forEach((s) => taken.add(String(s).trim()));
  }
  return taken;
}

/** Map seats for LuxuryBusSeatMap — real occupancy from office bookings. */
function buildMapSeats(trip, bookings) {
  const layout = getLayoutForVehicle(trip?.vehicleType);
  const taken = seatsTakenForTrip(trip?.id, bookings);
  const unit = Number(trip?.price) || 0;
  const seats = [];
  for (let row = 1; row <= layout.rows; row += 1) {
    for (const col of layout.cols) {
      const number = `${row}${col}`;
      seats.push({
        id: number,
        number,
        row,
        col,
        isVip: layout.vipRows.includes(row),
        status: taken.has(number) ? 'BOOKED' : 'AVAILABLE',
        priceEur: unit,
      });
    }
  }
  return seats;
}

function formatTripWhen(trip) {
  if (!trip?.departureTime) return '—';
  const d = new Date(trip.departureTime);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('el-GR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAY_OPTIONS = [
  {
    id: 'cash_now',
    label: 'Πληρωμή τώρα στο γραφείο',
    hint: 'Μετρητά στο γκισέ · εισιτήριο πληρωμένο',
    icon: 'point_of_sale',
  },
  {
    id: 'pay_on_bus',
    label: 'Πληρωμή στο λεωφορείο',
    hint: 'Κράτηση θέσης · υπόλοιπο στον οδηγό',
    icon: 'directions_bus',
  },
];

export default function OfficeExcursionBookingModal({
  open,
  customer,
  bookings: bookingsProp,
  onClose,
  onCreated,
}) {
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [trip, setTrip] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [payMode, setPayMode] = useState('cash_now');
  const [busy, setBusy] = useState(false);
  const [bookingsTick, setBookingsTick] = useState(0);

  const trips = useMemo(() => {
    if (!open) return [];
    return listPublishedTrips(loadTrips()).slice().sort((a, b) => {
      const da = new Date(a.departureTime || 0).getTime();
      const db = new Date(b.departureTime || 0).getTime();
      return da - db;
    });
  }, [open, bookingsTick]);

  const liveBookings = useMemo(() => {
    if (!open) return [];
    return Array.isArray(bookingsProp) && bookingsProp.length ? bookingsProp : loadBookings();
  }, [open, bookingsProp, bookingsTick]);

  const filteredTrips = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((t) =>
      [t.title, t.destination, t.meetingPoint, String(t.id)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [trips, query]);

  const layout = useMemo(
    () => (trip ? getLayoutForVehicle(trip.vehicleType) : null),
    [trip],
  );
  const mapSeats = useMemo(
    () => (trip ? buildMapSeats(trip, liveBookings) : []),
    [trip, liveBookings],
  );
  const availableSeats = useMemo(
    () => mapSeats.filter((s) => s.status !== 'BOOKED').map((s) => s.number),
    [mapSeats],
  );
  const seatTheme = useMemo(() => (trip ? resolveTripSeatMapTheme(trip) : null), [trip]);
  const selectedSeatRows = useMemo(
    () => mapSeats.filter((s) => selectedSeats.includes(s.id)),
    [mapSeats, selectedSeats],
  );

  const unitPrice = Number(trip?.price) || 0;
  const total = roundMoney(unitPrice * selectedSeats.length);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setQuery('');
    setTrip(null);
    setSelectedSeats([]);
    setPayMode('cash_now');
    setBusy(false);
    setBookingsTick((n) => n + 1);
  }, [open, customer?.id]);

  if (!open || !customer) return null;

  const email = String(customer.email || '').trim();
  const canBook = Boolean(email);

  const toggleSeat = (seat) => {
    if (busy || !seat || seat.status === 'BOOKED') return;
    const id = seat.id || seat.number;
    setSelectedSeats((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const autoPick = (count = 1) => {
    const n = Math.max(1, Math.min(Number(count) || 1, availableSeats.length));
    setSelectedSeats(availableSeats.slice(0, n));
  };

  const submit = async () => {
    if (!canBook) {
      toast.error('Ο πελάτης χρειάζεται email — επεξεργαστείτε το προφίλ πρώτα');
      return;
    }
    if (!trip) {
      toast.error('Επιλέξτε εκδρομή');
      return;
    }
    if (!selectedSeats.length) {
      toast.error('Επιλέξτε τουλάχιστον μία θέση');
      return;
    }
    setBusy(true);
    try {
      const seats = selectedSeats.join(', ');
      const payNow = payMode === 'cash_now';
      let booking = await createBookingFromCheckout({
        trip,
        seats,
        total,
        amountPaid: 0,
        balanceDue: total,
        paymentPlan: PAYMENT_PLAN_FULL,
        passenger: {
          name: customer.name || email,
          email,
          phone: customer.phone || '',
        },
        paymentMethod: payNow ? 'cash_office' : 'cash_on_bus',
        bookingSource: 'Office Walk-in',
        agentName: 'Γραφείο',
      });

      if (payNow && total > 0) {
        try {
          booking = await recordCashPayment(booking.id, {
            amount: total,
            channel: 'office_counter',
            reference_code: booking.pnr || booking.id,
            note: 'Πληρωμή γκισέ από προφίλ πελάτη',
          });
        } catch (cashErr) {
          console.warn('[office-excursion] cash record failed', cashErr);
          toast.error(
            cashErr.message ||
              'Η κράτηση δημιουργήθηκε, αλλά η καταχώρηση μετρητών απέτυχε — καταχωρήστε από το εισιτήριο',
          );
          onCreated?.(booking);
          onClose?.();
          return;
        }
      }

      toast.success(
        payNow
          ? `Κράτηση ${booking.pnr || booking.id} · πληρωμένη στο γραφείο`
          : `Κράτηση ${booking.pnr || booking.id} · πληρωμή στο λεωφορείο`,
      );
      onCreated?.(booking);
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία κράτησης');
    } finally {
      setBusy(false);
    }
  };

  const modalWidth =
    step === 2 ? 'sm:max-w-4xl lg:max-w-5xl' : step === 3 ? 'sm:max-w-lg' : 'sm:max-w-xl';

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Κλείσιμο"
        onClick={() => !busy && onClose?.()}
      />
      <div
        className={`relative w-full ${modalWidth} max-h-[94vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col transition-[max-width] duration-200`}
      >
        <header className="shrink-0 px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Γραφείο</p>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Προσθήκη εκδρομής</h2>
            <p className="text-sm text-slate-500 truncate mt-0.5">
              {customer.name || 'Πελάτης'}
              {email ? ` · ${email}` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onClose?.()}
            className="w-10 h-10 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Κλείσιμο"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="shrink-0 px-5 py-2.5 flex gap-2 border-b border-slate-50 bg-slate-50/60">
          {[
            { n: 1, label: 'Εκδρομή' },
            { n: 2, label: 'Θέσεις' },
            { n: 3, label: 'Πληρωμή' },
          ].map((s) => (
            <span
              key={s.n}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                step === s.n
                  ? 'bg-slate-900 text-white'
                  : step > s.n
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              <span className="tabular-nums">{s.n}</span>
              {s.label}
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!canBook ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-semibold">
              Ο πελάτης δεν έχει email. Πατήστε Επεξεργασία στο προφίλ και προσθέστε email πριν την
              κράτηση.
            </div>
          ) : null}

          {step === 1 ? (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Αναζήτηση</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Τίτλος εκδρομής ή προορισμός…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                />
              </label>
              {filteredTrips.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-10 rounded-2xl bg-slate-50 border border-slate-100">
                  Δεν βρέθηκαν δημοσιευμένες εκδρομές. Προσθέστε εκδρομή από «Εκδρομές».
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredTrips.map((t) => {
                    const active = trip?.id === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setTrip(t);
                            setSelectedSeats([]);
                          }}
                          className={`w-full text-left rounded-2xl border px-4 py-3 transition ${
                            active
                              ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-300/50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{t.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{formatTripWhen(t)}</p>
                              {t.destination ? (
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{t.destination}</p>
                              ) : null}
                            </div>
                            <p className="shrink-0 font-bold text-sky-800 tabular-nums">
                              €{Number(t.price || 0).toFixed(0)}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : null}

          {step === 2 && trip && layout ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => autoPick(1)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  1 θέση
                </button>
                <button
                  type="button"
                  onClick={() => autoPick(2)}
                  disabled={availableSeats.length < 2}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  2 θέσεις
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSeats([])}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  Καθαρισμός
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,13rem)] gap-4 items-start">
                <SeatSelectionAside
                  trip={trip}
                  layout={layout}
                  seatTheme={seatTheme}
                  seats={mapSeats}
                  tripBasePrice={unitPrice}
                  selectedSeatRows={selectedSeatRows}
                  availableCount={availableSeats.length}
                  className="order-2 lg:order-1"
                />

                <div className="order-1 lg:order-2 flex justify-center">
                  <LuxuryBusSeatMap
                    layout={layout}
                    seats={mapSeats}
                    selectedSeats={selectedSeats}
                    onSeatClick={toggleSeat}
                    availableCount={availableSeats.length}
                    vehicleType={trip.vehicleType}
                    theme={seatTheme}
                    showSeatPopup={false}
                  />
                </div>

                <div className="order-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3 lg:sticky lg:top-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Η κράτησή σας
                  </p>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="text-slate-500">Θέσεις</span>
                    <span className="font-bold text-slate-900 text-right">
                      {selectedSeats.length ? selectedSeats.join(', ') : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="text-slate-500">Τιμή / θέση</span>
                    <span className="font-semibold text-slate-800">€{unitPrice.toFixed(0)}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex justify-between gap-2">
                    <span className="font-bold text-slate-900">Σύνολο</span>
                    <span className="font-bold text-sky-800 tabular-nums text-lg">
                      €{total.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Ίδιο κάθισμα με την online κράτηση — κλεισμένες θέσεις από υπάρχουσες κρατήσεις.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {step === 3 && trip ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
                <p className="font-bold text-slate-900">{trip.title}</p>
                <p className="text-sm text-slate-600">
                  Θέσεις {selectedSeats.join(', ')} ·{' '}
                  <strong className="text-slate-900">€{total.toFixed(2)}</strong>
                </p>
                <p className="text-xs text-slate-500">
                  {customer.name} · {email}
                  {customer.phone ? ` · ${customer.phone}` : ''}
                </p>
              </div>
              <div className="space-y-2">
                {PAY_OPTIONS.map((opt) => {
                  const active = payMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPayMode(opt.id)}
                      className={`w-full text-left rounded-2xl border px-4 py-3.5 flex gap-3 transition ${
                        active
                          ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className="material-symbols-outlined">{opt.icon}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-slate-900">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-slate-100 px-5 py-3.5 flex items-center justify-between gap-3 bg-white">
          <button
            type="button"
            disabled={busy || step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="rounded-full px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            Πίσω
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={
                busy ||
                !canBook ||
                (step === 1 && !trip) ||
                (step === 2 && selectedSeats.length === 0)
              }
              onClick={() => setStep((s) => s + 1)}
              className="rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-bold hover:bg-slate-800 disabled:opacity-40"
            >
              Συνέχεια
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !canBook || !trip || !selectedSeats.length}
              onClick={submit}
              className="rounded-full bg-emerald-600 text-white px-5 py-2.5 text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-2"
            >
              {busy ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  Αποθήκευση…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  Καταχώρηση κράτησης
                </>
              )}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
