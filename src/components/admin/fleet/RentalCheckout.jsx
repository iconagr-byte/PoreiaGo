/**
 * Tablet / kiosk digital contract checkout — summary, mandatory terms, signature, issue.
 * Adapts the PoreiaGo Rent master prompt to the existing admin desk stack.
 */
import { useMemo, useRef, useState } from 'react';
import {
  completeRentalCheckout,
  uploadRentalInspectionPhoto,
} from '../../../services/fleetRentalApi.js';
import {
  RENTAL_CHECKOUT_TERMS,
  allCheckoutTermsAccepted,
  emptyCheckoutAcceptances,
} from '../../../lib/rental/rentalCheckoutTerms.js';
import { resolveSiteAssetUrl } from '../../../services/siteAppearanceApi.js';
import RentalSignaturePad from './RentalSignaturePad.jsx';
import RentalTermsModal from './RentalTermsModal.jsx';

function euro(n) {
  if (n == null || n === '') return '—';
  return `€${Number(n).toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function FuelBars({ level = 6, max = 8 }) {
  const filled = Math.max(0, Math.min(max, Math.round(level)));
  return (
    <div className="flex items-end gap-1" aria-label={`Καύσιμο ${filled}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`w-2.5 rounded-sm ${
            i < filled ? 'bg-teal-600' : 'bg-slate-200'
          }`}
          style={{ height: `${10 + i * 2}px` }}
        />
      ))}
      <span className="ml-2 text-sm font-bold text-slate-700 tabular-nums">
        {filled}/{max}
      </span>
    </div>
  );
}

export default function RentalCheckout({
  booking,
  vehicle = null,
  officeName = 'Γραφείο ενοικιάσεων',
  onCancel,
  onComplete,
  onToast,
}) {
  const padRef = useRef(null);
  const [accept, setAccept] = useState(() => emptyCheckoutAcceptances());
  const [hasInk, setHasInk] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [fuelLevel, setFuelLevel] = useState(6);
  const [depositEur, setDepositEur] = useState('');
  const [insuranceLabel, setInsuranceLabel] = useState('CDW');
  const [busy, setBusy] = useState(false);

  const plate = booking?.vehicle_plate || vehicle?.plate_number || '—';
  const model = booking?.vehicle_model || vehicle?.model || 'Όχημα';
  const photo = resolveSiteAssetUrl(vehicle?.photo_url || booking?.vehicle_photo_url);

  const canSubmit = useMemo(
    () => allCheckoutTermsAccepted(accept) && hasInk && !busy,
    [accept, hasInk, busy],
  );

  const toggle = (id) => {
    setAccept((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const submit = async () => {
    if (!canSubmit || !booking?.id) return;
    setBusy(true);
    try {
      const file = await padRef.current?.getFile?.();
      if (!file) {
        onToast?.('error', 'Απαιτείται υπογραφή');
        return;
      }
      const uploaded = await uploadRentalInspectionPhoto(file);
      const fuelPct = Math.round((fuelLevel / 8) * 100);
      const result = await completeRentalCheckout(booking.id, {
        signature_url: uploaded.url,
        signer_name: booking.client_name,
        accepted_terms: RENTAL_CHECKOUT_TERMS.filter((t) => accept[t.id]).map((t) => t.id),
        fuel_level: fuelPct,
        insurance_label: insuranceLabel,
        deposit_eur: depositEur === '' ? null : Number(depositEur),
        summary: {
          vehicle: `${model} (${plate})`,
          start_time: booking.start_time,
          end_time: booking.end_time,
          total_cost: booking.total_cost,
          office_name: officeName,
        },
      });
      onToast?.('success', 'Η σύμβαση εκδόθηκε');
      onComplete?.(result?.booking || result);
    } catch (err) {
      onToast?.('error', err?.message || 'Αποτυχία έκδοσης σύμβασης');
    } finally {
      setBusy(false);
    }
  };

  if (!booking) return null;

  return (
    <div className="space-y-4 pb-6 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700/80">
            Tablet · ψηφιακή σύμβαση
          </p>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Ολοκλήρωση & υπογραφή
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {officeName} · ο πελάτης ελέγχει, αποδέχεται όρους και υπογράφει.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Πίσω στον φάκελο
        </button>
      </div>

      {/* Section A — Summary */}
      <section className="rounded-[28px] border border-slate-200/90 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white flex gap-4">
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[28px]">directions_car</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Όχημα</p>
            <p className="text-xl font-bold text-slate-900 truncate">
              {model}{' '}
              <span className="text-teal-800">({plate})</span>
            </p>
            <p className="text-sm text-slate-600 mt-1">{booking.client_name}</p>
          </div>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Περίοδος</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {formatWhen(booking.start_time)}
              <span className="text-slate-400"> → </span>
              {formatWhen(booking.end_time)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Καύσιμο</p>
            <div className="mt-2 flex items-center gap-3">
              <FuelBars level={fuelLevel} />
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={fuelLevel}
                onChange={(e) => setFuelLevel(Number(e.target.value))}
                className="flex-1 accent-teal-700"
                aria-label="Στάθμη καυσίμου"
              />
            </div>
          </div>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Ασφάλιση
            </span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
              value={insuranceLabel}
              onChange={(e) => setInsuranceLabel(e.target.value)}
            >
              <option value="Βασική ΑΕ">Βασική αστική ευθύνη</option>
              <option value="CDW">CDW (με απαλλαγή)</option>
              <option value="SCDW">SCDW Plus</option>
              <option value="Super Cover">Super Cover</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Εγγύηση (€)
            </span>
            <input
              type="number"
              min={0}
              step="1"
              placeholder="π.χ. 500"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
              value={depositEur}
              onChange={(e) => setDepositEur(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Σύνολο</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {euro(booking.total_cost)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Εγγύηση</p>
              <p className="text-lg font-bold text-slate-800 tabular-nums">
                {depositEur === '' ? '—' : euro(depositEur)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section B — Terms */}
      <section className="rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-sm space-y-3">
        <div>
          <h4 className="font-bold text-slate-900 text-lg">Υποχρεωτικοί όροι</h4>
          <p className="text-sm text-slate-500 mt-0.5">
            Ο πελάτης πρέπει να αποδεχτεί και τους 5 όρους για να προχωρήσει.
          </p>
        </div>
        <ul className="space-y-2.5">
          {RENTAL_CHECKOUT_TERMS.map((term) => (
            <li
              key={term.id}
              className={`rounded-2xl border px-3.5 py-3 transition ${
                accept[term.id]
                  ? 'border-teal-300 bg-teal-50/50'
                  : 'border-slate-200 bg-slate-50/40'
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  checked={Boolean(accept[term.id])}
                  onChange={() => toggle(term.id)}
                />
                <span className="text-sm text-slate-800 leading-relaxed">
                  {term.hasTermsModal ? (
                    <>
                      <strong className="font-bold">Γενικοί Όροι: </strong>
                      {term.label}{' '}
                      <button
                        type="button"
                        className="text-teal-700 font-bold underline underline-offset-2"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsOpen(true);
                        }}
                      >
                        Δες πλήρες κείμενο
                      </button>
                    </>
                  ) : (
                    term.label
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* Section C — Signature */}
      <section className="rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-sm">
        <h4 className="font-bold text-slate-900 text-lg mb-3">Ψηφιακή υπογραφή</h4>
        <RentalSignaturePad
          ref={padRef}
          embedded
          heightClass="h-40 sm:h-48"
          watermark="Υπογράψτε εδώ..."
          onInkChange={setHasInk}
          disabled={busy}
        />
      </section>

      {/* Section D — Actions */}
      <div className="sticky bottom-3 z-10 flex flex-col sm:flex-row gap-2 rounded-[24px] border border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 py-3.5 rounded-full border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          ΑΚΥΡΩΣΗ
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="flex-[1.4] py-3.5 rounded-full bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">
            {busy ? 'progress_activity' : 'draw'}
          </span>
          {busy ? 'Έκδοση…' : 'ΟΛΟΚΛΗΡΩΣΗ & ΕΚΔΟΣΗ ΣΥΜΒΟΛΑΙΟΥ'}
        </button>
      </div>

      <RentalTermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
