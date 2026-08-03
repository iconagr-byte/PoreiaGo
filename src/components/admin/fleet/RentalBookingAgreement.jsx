/**
 * Printable rental agreement / paperwork sheet for a booking — includes legal doc pack.
 */
import { useEffect, useRef, useState } from 'react';
import { resolveSiteAssetUrl } from '../../../services/siteAppearanceApi.js';
import {
  fetchRentalCheckoutStatus,
  fetchRentalInspections,
  openRentalContractFile,
  resetRentalSignature,
} from '../../../services/fleetRentalApi.js';
import {
  legalDocById,
  legalPackProgress,
} from '../../../lib/rental/rentalLegalDocs.js';
import { paperworkStatusForBooking } from '../../../lib/rental/rentalPaperwork.js';
import { LIVE_REFRESH_MS } from '../../../lib/liveRefresh.js';
import RentalLegalDocPack from './RentalLegalDocPack.jsx';

function euro(n) {
  return `€${Number(n || 0).toFixed(2)}`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusEl(status) {
  const map = {
    CONFIRMED: 'Επιβεβαιωμένη',
    ACTIVE: 'Σε εξέλιξη',
    COMPLETED: 'Ολοκληρωμένη',
    CANCELLED: 'Ακυρωμένη',
  };
  return map[status] || status || '—';
}

export default function RentalBookingAgreement({
  booking: bookingProp,
  vehicle,
  inspections = [],
  officeName = 'Γραφείο ενοικιάσεων',
  onClose,
  onOpenCheckIn,
  onOpenCheckout,
  onBookingUpdated,
  onInspectionsUpdated,
  onToast,
}) {
  const [booking, setBooking] = useState(bookingProp);
  const [liveInspections, setLiveInspections] = useState(inspections);
  const [openingContract, setOpeningContract] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [liveHint, setLiveHint] = useState('');
  const seenPickup = useRef(false);
  const seenReturn = useRef(false);
  const primed = useRef(false);
  const bookingRef = useRef(bookingProp);

  const handleUpdated = (updated) => {
    if (updated?.id) {
      setBooking(updated);
      bookingRef.current = updated;
    }
    onBookingUpdated?.(updated);
  };

  useEffect(() => {
    setBooking(bookingProp);
    bookingRef.current = bookingProp;
  }, [bookingProp]);

  useEffect(() => {
    setLiveInspections(inspections);
  }, [inspections]);

  // Poll this booking's inspections/signature until both check-in & check-out are signed.
  useEffect(() => {
    if (!bookingProp?.id) return undefined;
    const bookingId = bookingProp.id;
    let cancelled = false;
    primed.current = false;

    const tick = async () => {
      try {
        const [fresh, status] = await Promise.all([
          fetchRentalInspections(bookingId),
          fetchRentalCheckoutStatus(bookingId).catch(() => null),
        ]);
        if (cancelled) return;

        setLiveInspections((prev) => {
          const others = (prev || []).filter((i) => i.rental_booking_id !== bookingId);
          return [...fresh, ...others];
        });
        onInspectionsUpdated?.(fresh, bookingId);

        const current = bookingRef.current || bookingProp;
        if (status?.signed || status?.contract_pdf_url) {
          const next = {
            ...current,
            rental_status: status.rental_status || current.rental_status,
            contract_status: status.contract_status || current.contract_status,
            contract_pdf_url: status.contract_pdf_url || current.contract_pdf_url,
            signature_pending: Boolean(status.signature_pending),
            contract_issued_at:
              status.signed && !current.contract_issued_at
                ? current.contract_issued_at || new Date().toISOString()
                : current.contract_issued_at,
          };
          const changed =
            next.contract_pdf_url !== current.contract_pdf_url ||
            next.rental_status !== current.rental_status ||
            next.contract_status !== current.contract_status ||
            Boolean(next.signature_pending) !== Boolean(current.signature_pending) ||
            next.contract_issued_at !== current.contract_issued_at;
          if (changed) handleUpdated(next);
        }

        const paper = paperworkStatusForBooking(current, fresh);
        if (!primed.current) {
          seenPickup.current = paper.pickupSigned;
          seenReturn.current = paper.returnSigned;
          primed.current = true;
          setLiveHint(
            paper.pickupSigned && paper.returnSigned
              ? ''
              : 'Ζωντανή ενημέρωση υπογραφών…',
          );
          return;
        }
        if (paper.pickupSigned && !seenPickup.current) {
          seenPickup.current = true;
          onToast?.('success', 'Η υπογραφή παραλαβής έφτασε στο γραφείο');
        }
        if (paper.returnSigned && !seenReturn.current) {
          seenReturn.current = true;
          onToast?.('success', 'Η υπογραφή επιστροφής έφτασε στο γραφείο');
        }
        setLiveHint(
          paper.pickupSigned && paper.returnSigned
            ? ''
            : 'Ζωντανή ενημέρωση υπογραφών…',
        );
      } catch {
        /* keep polling */
      }
    };

    tick();
    const id = window.setInterval(tick, LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll keyed to booking id
  }, [bookingProp?.id]);

  if (!booking) return null;

  const paper = paperworkStatusForBooking(booking, liveInspections);
  const legal = legalPackProgress(booking, liveInspections);
  const plate = booking.vehicle_plate || vehicle?.plate_number || '—';
  const model = booking.vehicle_model || vehicle?.model || '—';
  const category = booking.vehicle_category || vehicle?.category || '—';
  const agreementDoc = legalDocById('agreement');

  const print = () => {
    window.print();
  };

  const openIssuedContract = async () => {
    if (!booking.contract_pdf_url || openingContract) return;
    setOpeningContract(true);
    try {
      await openRentalContractFile(booking.contract_pdf_url);
    } catch (err) {
      onToast?.('error', err?.message || 'Αποτυχία ανοίγματος σύμβασης');
    } finally {
      setOpeningContract(false);
    }
  };

  const canResetSignature =
    Boolean(booking.contract_issued_at) ||
    Boolean(booking.contract_pdf_url) ||
    (legal.signedCount || 0) > 0 ||
    Boolean(booking.signature_pending);

  const clearAndResendLink = async () => {
    if (!booking?.id || resetBusy) return;
    const ok = window.confirm(
      'Καθαρισμός υπογραφής / σύμβασης και αποστολή νέου link στον πελάτη;',
    );
    if (!ok) return;
    setResetBusy(true);
    try {
      const result = await resetRentalSignature(booking.id, {
        sendLink: true,
        publicBaseUrl: window.location.origin,
      });
      const updated = result.booking || result;
      handleUpdated(updated);
      onToast?.(
        'success',
        result.sign_url
          ? 'Καθαρίστηκε — στάλθηκε νέο link υπογραφής'
          : 'Καθαρίστηκε η υπογραφή',
      );
      if (onOpenCheckout) onOpenCheckout();
    } catch (err) {
      onToast?.('error', err?.message || 'Αποτυχία καθαρισμού');
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="rental-agreement-sheet space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Φάκελος χαρτούρας</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Νομικό πακέτο έτοιμο για υπογραφή · εκτύπωση ή PDF από τον εκτυπωτή του προγράμματος
            περιήγησης
          </p>
          <p className="text-xs text-teal-800 font-semibold mt-1">
            Νομικά {legal.signedCount}/{legal.total} · {paper.statusLabel}
          </p>
          {liveHint ? (
            <p className="text-xs text-teal-600 mt-1 flex items-center gap-1 print:hidden">
              <span className="material-symbols-outlined text-[14px] animate-pulse">sync</span>
              {liveHint}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={print}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-bold hover:bg-teal-800"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Εκτύπωση πακέτου / PDF
          </button>
          {onOpenCheckout && (legal.signedCount < 6 || !paper.pickupSigned) ? (
            <button
              type="button"
              onClick={onOpenCheckout}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-teal-300 bg-teal-50 text-teal-900 text-sm font-bold"
              title="Sign-on-Glass ή σύνδεσμος στο κινητό πελάτη"
            >
              <span className="material-symbols-outlined text-[18px]">draw</span>
              Ψηφιακή υπογραφή
            </button>
          ) : null}
          {canResetSignature ? (
            <button
              type="button"
              disabled={resetBusy}
              onClick={clearAndResendLink}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-sm font-bold disabled:opacity-50"
              title="Σβήνει την υπογραφή/σύμβαση και στέλνει νέο link 24ωρών"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              {resetBusy ? 'Αποστολή…' : 'Καθαρισμός & νέο link'}
            </button>
          ) : null}
          {booking.contract_pdf_url ? (
            <button
              type="button"
              disabled={openingContract}
              onClick={openIssuedContract}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Άνοιγμα εκδομένης σύμβασης"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              {openingContract ? 'Άνοιγμα…' : 'Σύμβαση'}
            </button>
          ) : onOpenCheckout ? (
            <button
              type="button"
              onClick={onOpenCheckout}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold text-slate-700 hover:bg-slate-50"
              title="Έκδοση σύμβασης με dual-mode υπογραφή"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              Σύμβαση
            </button>
          ) : null}
          {!paper.pickupSigned && onOpenCheckIn ? (
            <button
              type="button"
              onClick={() => onOpenCheckIn(booking.id, 'PICKUP_CHECK')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold"
            >
              Check-in & υπογραφή
            </button>
          ) : null}
          {paper.pickupSigned && !paper.returnSigned && onOpenCheckIn ? (
            <button
              type="button"
              onClick={() => onOpenCheckIn(booking.id, 'RETURN_CHECK')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold"
            >
              Check-out & υπογραφή
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold"
            >
              Κλείσιμο
            </button>
          ) : null}
        </div>
      </div>

      <article className="rental-agreement-print bg-white rounded-2xl border border-black/[0.08] p-6 md:p-8 space-y-6 shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/[0.06] pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              Σύμβαση ενοικίασης οχήματος
            </p>
            <h4 className="mt-1 text-xl font-bold text-gray-900">{officeName}</h4>
            <p className="text-sm text-gray-500 mt-1">Κωδικός κράτησης: {booking.id}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="font-bold text-gray-900">{statusEl(booking.rental_status)}</p>
            <p className="mt-1">{paper.statusLabel}</p>
            <p className="mt-1 tabular-nums font-bold text-teal-800">{euro(booking.total_cost)}</p>
          </div>
        </header>

        <section className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-slate-50 border border-black/[0.04] p-4 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Πελάτης</p>
            <p className="font-bold text-gray-900">{booking.client_name || '—'}</p>
            {booking.client_email ? <p className="text-gray-600">{booking.client_email}</p> : null}
            {booking.client_phone ? <p className="text-gray-600">{booking.client_phone}</p> : null}
          </div>
          <div className="rounded-xl bg-slate-50 border border-black/[0.04] p-4 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Όχημα</p>
            <p className="font-bold text-gray-900">
              {plate} · {model}
            </p>
            <p className="text-gray-600">Κατηγορία: {category}</p>
            <p className="text-gray-600">
              {booking.driver_mode === 'WITH_DRIVER' ? 'Με οδηγό' : 'Χωρίς οδηγό'}
            </p>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Παραλαβή</p>
            <p className="mt-1 font-semibold text-gray-900">{formatWhen(booking.start_time)}</p>
            <p className="text-gray-600">{booking.pickup_location || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Επιστροφή</p>
            <p className="mt-1 font-semibold text-gray-900">{formatWhen(booking.end_time)}</p>
            <p className="text-gray-600">{booking.dropoff_location || booking.pickup_location || '—'}</p>
          </div>
        </section>

        {agreementDoc ? (
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
              Βασικοί όροι σύμβασης
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-sm text-gray-700 leading-relaxed">
              {agreementDoc.clauses.map((term) => (
                <li key={term.slice(0, 40)}>{term}</li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="grid sm:grid-cols-2 gap-4">
          <SignatureBlock
            title="Υπογραφή παραλαβής (check-in)"
            inspection={paper.pickup}
            emptyHint="Εκκρεμεί έλεγχος παραλαβής με υπογραφή"
          />
          <SignatureBlock
            title="Υπογραφή επιστροφής (check-out)"
            inspection={paper.returnCheck}
            emptyHint="Εκκρεμεί έλεγχος επιστροφής με υπογραφή"
          />
        </section>

        <footer className="border-t border-black/[0.06] pt-4 text-xs text-gray-500 flex flex-wrap justify-between gap-2">
          <span>Έκδοση χαρτούρας · {new Date().toLocaleString('el-GR')}</span>
          <span>{officeName}</span>
        </footer>
      </article>

      <RentalLegalDocPack
        booking={booking}
        inspections={liveInspections}
        officeName={officeName}
        onBookingUpdated={handleUpdated}
        onOpenCheckIn={onOpenCheckIn}
        onToast={onToast}
      />
    </div>
  );
}

function signatureSrc(inspection) {
  const raw = resolveSiteAssetUrl(inspection?.signature_url || '');
  if (!raw || raw.startsWith('data:')) return raw;
  const bust = inspection?.updated_at || inspection?.created_at || inspection?.id || '';
  if (!bust) return raw;
  return `${raw}${raw.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(bust))}`;
}

function SignatureBlock({ title, inspection, emptyHint }) {
  const url = signatureSrc(inspection);
  return (
    <div className="rounded-xl border border-black/[0.08] p-4 min-h-[10rem]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
      {url ? (
        <div className="mt-3 space-y-2">
          <img
            src={url}
            alt={title}
            className="max-h-28 w-auto bg-white border border-black/[0.06] rounded-lg"
          />
          <p className="text-xs text-gray-500">
            {inspection.inspector_name ? `Έλεγχος: ${inspection.inspector_name} · ` : ''}
            Καύσιμο {inspection.fuel_level ?? '—'}% · χλμ. {inspection.mileage ?? '—'}
          </p>
          {inspection.damage_notes ? (
            <p className="text-xs text-amber-800">Σημειώσεις: {inspection.damage_notes}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-amber-800 font-semibold">{emptyHint}</p>
      )}
    </div>
  );
}
