import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MinimalPageBackground from '../components/MinimalPageBackground.jsx';
import {
  applyExtrasToPending,
  euroLabel,
  priceModeLabel,
  readTripExtrasCatalog,
  readTripExtrasSelection,
  seatCountFromPending,
  tripExtrasTotal,
  visibleTripExtraOptions,
} from '../lib/trips/tripBookingExtras.js';
import { loadPendingCheckout, savePendingCheckout } from '../lib/ticketing/pendingCheckout.js';
import { loadPlatformDemoTrips, loadTrips } from '../lib/trips/tripStore.js';
import { isPlatformSeatBookingDemo } from '../lib/marketing/platformBusDemoShowcase.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import '../styles/trip-extras.css';

/**
 * After seat selection — optional υπηρεσίες before checkout.
 * Skips automatically when the office has no visible extras.
 */
export default function TripExtrasPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [pending, setPending] = useState(() => loadPendingCheckout());
  const [catalog, setCatalog] = useState([]);
  const [selection, setSelection] = useState({});
  const [loading, setLoading] = useState(true);

  const trip = useMemo(() => {
    const id = Number(tripId);
    if (!id) return null;
    return (
      loadTrips().find((t) => t.id === id) ||
      (isPlatformSeatBookingDemo()
        ? loadPlatformDemoTrips().find((t) => t.id === id)
        : null) ||
      null
    );
  }, [tripId]);

  useEffect(() => {
    const p = loadPendingCheckout();
    setPending(p);
    if (!p || !trip || p.tripId !== trip.id) {
      if (trip) navigate(`/select-seat/${trip.id}`, { replace: true });
      else navigate('/', { replace: true });
    }
  }, [trip, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const { options } = readTripExtrasCatalog(data);
        const visible = visibleTripExtraOptions(options);
        setCatalog(options);
        const p = loadPendingCheckout();
        setSelection(readTripExtrasSelection(p?.extrasSelection || {}, options));
        if (!visible.length && trip) {
          const seatSubtotal = Number(p?.seatSubtotal ?? p?.total) || 0;
          savePendingCheckout({
            ...p,
            seatSubtotal,
            extras: [],
            extrasTotal: 0,
            extrasSelection: {},
            total: seatSubtotal,
          });
          navigate(`/checkout/${trip.id}`, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled && trip) navigate(`/checkout/${trip.id}`, { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trip, navigate]);

  const seats = seatCountFromPending(pending);
  const seatSubtotal = Number(pending?.seatSubtotal ?? pending?.total) || 0;
  const extrasTotal = tripExtrasTotal(selection, catalog, seats);
  const grandTotal = Math.round((seatSubtotal + extrasTotal) * 100) / 100;
  const visible = visibleTripExtraOptions(catalog);

  const toggle = (formKey) => {
    setSelection((s) => ({ ...s, [formKey]: !s[formKey] }));
  };

  const goCheckout = (withSelection = selection) => {
    const p = loadPendingCheckout() || pending;
    if (!p || !trip) return;
    const next = applyExtrasToPending(
      { ...p, seatSubtotal: Number(p.seatSubtotal ?? p.total) || 0 },
      withSelection,
      catalog,
    );
    savePendingCheckout(next);
    navigate(`/checkout/${trip.id}`);
  };

  const skip = () => {
    const cleared = {};
    for (const opt of visible) cleared[opt.formKey] = false;
    goCheckout(cleared);
  };

  if (!trip || !pending || pending.tripId !== trip.id || loading) {
    return (
      <div className="relative min-h-screen bg-surface flex items-center justify-center">
        <MinimalPageBackground />
        <p className="relative z-10 text-on-surface-variant text-sm">Φόρτωση υπηρεσιών…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-surface py-6 px-4 md:py-10">
      <MinimalPageBackground />
      <div className="relative z-10 max-w-3xl mx-auto trip-extras">
        <div className="mb-6">
          <Link
            to={`/select-seat/${trip.id}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Θέσεις
          </Link>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
            Βήμα 2 · Υπηρεσίες
          </p>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
            Πρόσθεσε υπηρεσίες
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant max-w-xl">
            Προαιρετικά extras για την εκδρομή «{trip.title}». Μπορείς να συνεχίσεις χωρίς
            καμία επιλογή.
          </p>
        </div>

        <div className="trip-extras-summary mb-5">
          <div>
            <span className="text-on-surface-variant">Θέσεις</span>
            <strong>{pending.seats || '—'}</strong>
          </div>
          <div>
            <span className="text-on-surface-variant">Εισιτήρια</span>
            <strong>{euroLabel(seatSubtotal)}</strong>
          </div>
          <div>
            <span className="text-on-surface-variant">Extras</span>
            <strong>{euroLabel(extrasTotal)}</strong>
          </div>
          <div className="trip-extras-summary-total">
            <span>Σύνολο</span>
            <strong>{euroLabel(grandTotal)}</strong>
          </div>
        </div>

        <ul className="trip-extras-list">
          {visible.map((opt) => {
            const on = Boolean(selection[opt.formKey]);
            const line =
              opt.priceMode === 'per_booking'
                ? euroLabel(opt.eur)
                : `${euroLabel(opt.eur)} × ${seats}`;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  className={`trip-extras-card${on ? ' is-on' : ''}`}
                  onClick={() => toggle(opt.formKey)}
                  aria-pressed={on}
                >
                  <span className="trip-extras-card-icon" aria-hidden>
                    <span className="material-symbols-outlined">{opt.icon}</span>
                  </span>
                  <span className="trip-extras-card-body">
                    <span className="trip-extras-card-title">{opt.title}</span>
                    {opt.blurb ? <span className="trip-extras-card-blurb">{opt.blurb}</span> : null}
                    {opt.includes?.length ? (
                      <span className="trip-extras-card-includes">
                        {opt.includes.slice(0, 3).join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  <span className="trip-extras-card-price">
                    <strong>{line}</strong>
                    <small>{priceModeLabel(opt.priceMode)}</small>
                    <span className={`trip-extras-check${on ? ' is-on' : ''}`} aria-hidden>
                      <span className="material-symbols-outlined">
                        {on ? 'check_circle' : 'circle'}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="trip-extras-actions">
          <button type="button" className="trip-extras-skip" onClick={skip}>
            Χωρίς extras — συνέχεια
          </button>
          <button type="button" className="trip-extras-next" onClick={() => goCheckout()}>
            Συνέχεια στην πληρωμή
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
