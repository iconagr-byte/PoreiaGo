import { useMemo, useState } from 'react';
import { validateDepositConfirmation } from '../../lib/payments/paymentSecurity.js';

export default function ConfirmBankDepositModal({
  booking,
  security,
  open,
  onClose,
  onConfirm,
  confirming,
}) {
  const expectedAmount = Number(booking?.balanceDue || booking?.price || 0);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState([]);

  const sec = security || {};
  const needsAmount = sec.require_amount_on_confirm !== false;
  const needsReference = sec.require_reference_on_confirm !== false;

  const hintReference = useMemo(
    () => booking?.pnr || booking?.id || '—',
    [booking?.pnr, booking?.id],
  );

  if (!open || !booking) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      amount: needsAmount ? Number(amount) : expectedAmount,
      reference: needsReference ? reference : hintReference,
    };
    const validationErrors = validateDepositConfirmation(booking, payload, sec);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    await onConfirm({
      confirmed_amount: payload.amount,
      reference_code: payload.reference,
      note: note.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-[24px] bg-white shadow-xl border border-black/[0.08] p-6 space-y-4">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">verified_user</span>
            Ασφαλής επιβεβαίωση κατάθεσης
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Επιβεβαιώστε μόνο αν η κατάθεση εμφανίστηκε στον τραπεζικό λογαριασμό.
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 border border-black/[0.06] p-3 text-sm space-y-1">
          <p className="font-bold text-gray-900">{booking.customerName || '—'}</p>
          <p className="text-gray-600">{booking.tripTitle} · {booking.seat || booking.seats?.join(', ')}</p>
          <p className="text-gray-500">Αναμενόμενο ποσό: €{expectedAmount.toFixed(2)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {needsAmount && (
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Ποσό κατάθεσης (€)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="mt-1 w-full rounded-xl border px-3 py-2 font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={expectedAmount.toFixed(2)}
              />
            </label>
          )}

          {needsReference && (
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Αναφορά / PNR</span>
              <input
                required
                className="mt-1 w-full rounded-xl border px-3 py-2 font-mono uppercase"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={hintReference}
              />
            </label>
          )}

          <label className="block text-sm">
            <span className="font-bold text-gray-700">Σημείωση (προαιρετικό)</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="π.χ. ref τράπεζας"
            />
          </label>

          {errors.length > 0 && (
            <ul className="text-sm text-red-700 space-y-1">
              {errors.map((err) => (
                <li key={err}>• {err}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={confirming}
              className="flex-1 px-4 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-bold disabled:opacity-60"
            >
              {confirming ? 'Επιβεβαίωση…' : 'Επιβεβαίωση κατάθεσης'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full border text-sm font-bold"
            >
              Ακύρωση
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
