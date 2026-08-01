/**
 * Rent desk «Χαρτούρα» — booking contracts, signatures, printable agreements.
 */
import { useEffect, useMemo, useState } from 'react';
import RentalBookingAgreement from './RentalBookingAgreement.jsx';
import RentalCheckout from './RentalCheckout.jsx';
import {
  paperworkStatusChipClass,
  paperworkStatusForBooking,
} from '../../../lib/rental/rentalPaperwork.js';

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

export default function RentalPaperworkDesk({
  bookings = [],
  vehicles = [],
  inspections = [],
  loading = false,
  officeName,
  initialBookingId = null,
  onOpenCheckIn,
  onConsumedFocus,
  onBookingUpdated,
  onToast,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(initialBookingId || null);
  const [checkoutId, setCheckoutId] = useState(null);

  useEffect(() => {
    if (!initialBookingId) return undefined;
    setSelectedId(initialBookingId);
    onConsumedFocus?.();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to new focus id
  }, [initialBookingId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bookings || [])
      .map((b) => {
        const paper = paperworkStatusForBooking(b, inspections);
        const vehicle = (vehicles || []).find((v) => v.id === b.vehicle_id) || null;
        return { booking: b, paper, vehicle };
      })
      .filter(({ booking, paper }) => {
        if (filter === 'PENDING') return paper.statusKey === 'missing';
        if (filter === 'SIGNED') return paper.pickupSigned;
        if (filter === 'COMPLETE') return paper.statusKey === 'complete';
        if (filter === 'ACTIVE') {
          return ['CONFIRMED', 'ACTIVE'].includes(booking.rental_status);
        }
        return true;
      })
      .filter(({ booking }) => {
        if (!q) return true;
        const hay = [
          booking.client_name,
          booking.client_email,
          booking.client_phone,
          booking.vehicle_plate,
          booking.vehicle_model,
          booking.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => String(b.booking.start_time || '').localeCompare(String(a.booking.start_time || '')));
  }, [bookings, vehicles, inspections, query, filter]);

  const selected = rows.find((r) => r.booking.id === selectedId) || null;
  const checkoutRow =
    rows.find((r) => r.booking.id === checkoutId) ||
    (bookings || [])
      .map((b) => ({
        booking: b,
        vehicle: (vehicles || []).find((v) => v.id === b.vehicle_id) || null,
      }))
      .find((r) => r.booking.id === checkoutId) ||
    null;

  if (checkoutRow) {
    return (
      <RentalCheckout
        booking={checkoutRow.booking}
        vehicle={checkoutRow.vehicle}
        officeName={officeName}
        onCancel={() => setCheckoutId(null)}
        onComplete={(updated) => {
          onBookingUpdated?.(updated);
          setCheckoutId(null);
          if (updated?.id) setSelectedId(updated.id);
        }}
        onToast={onToast}
      />
    );
  }

  if (selected) {
    return (
      <RentalBookingAgreement
        booking={selected.booking}
        vehicle={selected.vehicle}
        inspections={inspections}
        officeName={officeName}
        onClose={() => setSelectedId(null)}
        onOpenCheckIn={onOpenCheckIn}
        onOpenCheckout={() => {
          setCheckoutId(selected.booking.id);
          setSelectedId(null);
        }}
        onBookingUpdated={onBookingUpdated}
        onToast={onToast}
      />
    );
  }

  const pendingCount = (bookings || []).filter(
    (b) => paperworkStatusForBooking(b, inspections).statusKey === 'missing',
  ).length;
  const completeCount = (bookings || []).filter(
    (b) => paperworkStatusForBooking(b, inspections).statusKey === 'complete',
  ).length;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-black/[0.06] p-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">Χαρτούρα κρατήσεων</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Νομικό πακέτο (σύμβαση, άδεια, ασφάλιση, εγγύηση, GDPR, όροι) + πρωτόκολλα
            παραλαβής/επιστροφής — έτοιμα για υπογραφή και εκτύπωση. Tablet checkout με 5
            υποχρεωτικούς όρους και ψηφιακή υπογραφή.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Εκκρεμούν υπογραφές: {pendingCount} · Πλήρεις φάκελοι: {completeCount}
          </p>
        </div>
        <label className="block text-xs font-bold text-gray-500 min-w-[12rem] flex-1 max-w-sm">
          Αναζήτηση
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
            placeholder="Όνομα, πινακίδα, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'ALL', label: 'Όλες' },
          { id: 'PENDING', label: 'Εκκρεμεί υπογραφή' },
          { id: 'SIGNED', label: 'Με υπογραφή παραλαβής' },
          { id: 'COMPLETE', label: 'Πλήρης χαρτούρα' },
          { id: 'ACTIVE', label: 'Ενεργές' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              filter === f.id
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-gray-600 border-black/[0.08]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-black/[0.06] divide-y divide-black/[0.05]">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Φόρτωση…</p>
        ) : rows.length === 0 ? (
          <div className="p-6 space-y-1">
            <p className="text-sm font-bold text-gray-800">Δεν υπάρχουν φάκελοι σε αυτό το φίλτρο</p>
            <p className="text-sm text-gray-500">
              Οι κρατήσεις εμφανίζονται εδώ αυτόματα. Ανοίξτε τον φάκελο για να υπογράψει ο πελάτης
              όλα τα νομικά έντυπα· το Check-in / out καλύπτει τα πρωτόκολλα παραλαβής/επιστροφής.
            </p>
          </div>
        ) : (
          rows.map(({ booking: b, paper }) => (
            <article
              key={b.id}
              className="px-4 py-3 flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-bold text-sm text-gray-900">
                  {b.client_name} · {b.vehicle_plate || b.vehicle_model || '—'}
                </p>
                <p className="text-xs text-gray-500">
                  {formatWhen(b.start_time)} → {formatWhen(b.end_time)} · {euro(b.total_cost)}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${paperworkStatusChipClass(
                      paper.statusKey,
                    )}`}
                  >
                    {paper.statusLabel}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {b.rental_status}
                  </span>
                  {paper.pickupSigned ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">
                      Παραλαβή ✓
                    </span>
                  ) : null}
                  {paper.returnSigned ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">
                      Επιστροφή ✓
                    </span>
                  ) : null}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-black/[0.04]">
                    Νομικά {paper.legal?.signedCount ?? 0}/{paper.legal?.total ?? 8}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-teal-700 text-white text-xs font-bold"
                  onClick={() => setSelectedId(b.id)}
                >
                  Άνοιγμα φακέλου
                </button>
                {!paper.pickupSigned || (paper.legal?.signedCount ?? 0) < 6 ? (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl border border-teal-300 bg-teal-50 text-teal-900 text-xs font-bold inline-flex items-center gap-1"
                    onClick={() => setCheckoutId(b.id)}
                  >
                    <span className="material-symbols-outlined text-[16px]">draw</span>
                    Tablet υπογραφή
                  </button>
                ) : null}
                {!paper.pickupSigned && onOpenCheckIn ? (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                    onClick={() => onOpenCheckIn(b.id, 'PICKUP_CHECK')}
                  >
                    Check-in
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
