import { useEffect, useMemo, useState } from 'react';
import { validateCashPayment } from '../../lib/payments/paymentSecurity.js';

const CHANNELS = [
  {
    id: 'office_counter',
    label: 'Γκισέ γραφείου',
    icon: 'storefront',
    hint: 'Πληρωμή στο ταμείο / reception',
  },
  {
    id: 'driver_on_bus',
    label: 'Οδηγός / λεωφορείο',
    icon: 'directions_bus',
    hint: 'Είσπραξη κατά την επιβίβαση ή στο δρόμο',
  },
];

export default function RecordCashPaymentModal({
  booking,
  security,
  open,
  onClose,
  onConfirm,
  confirming,
}) {
  const balanceDue = useMemo(() => {
    const explicit = Number(booking?.balanceDue);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const total = Number(booking?.price || 0);
    const paid = Number(booking?.amountPaid || 0);
    return Math.max(0, total - paid);
  }, [booking]);

  const [channel, setChannel] = useState('driver_on_bus');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState([]);

  const sec = security || {};
  const needsReference = sec.require_reference_on_confirm !== false;
  const hintReference = useMemo(
    () => booking?.pnr || booking?.id || '—',
    [booking?.pnr, booking?.id],
  );

  useEffect(() => {
    if (!open || !booking) return;
    setChannel('driver_on_bus');
    setAmount(balanceDue > 0 ? String(balanceDue) : '');
    setReference('');
    setReceiptNumber('');
    setNote('');
    setErrors([]);
  }, [open, booking, balanceDue]);

  if (!open || !booking) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      amount: Number(amount),
      channel,
      reference: needsReference ? reference : hintReference,
    };
    const validationErrors = validateCashPayment(booking, payload, sec);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    await onConfirm({
      amount: payload.amount,
      channel,
      reference_code: needsReference ? reference : null,
      receipt_number: receiptNumber.trim() || null,
      note: note.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-[24px] bg-white shadow-xl border border-black/[0.08] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">payments</span>
            Καταχώρηση μετρητών
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Καταγράφει την είσπραξη, ενημερώνει το υπόλοιπο και εκδίδει απόδειξη myDATA.
          </p>
        </div>

        <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-3 text-sm space-y-1">
          <p className="font-bold text-gray-900">{booking.customerName || '—'}</p>
          <p className="text-gray-600">{booking.tripTitle} · {booking.seat || booking.seats?.join(', ')}</p>
          <p className="text-gray-500">
            {hintReference} · Υπόλοιπο: <strong className="text-amber-800">€{balanceDue.toFixed(2)}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">Πού εισπράχθηκαν;</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChannel(c.id)}
                  className={`text-left p-3 rounded-2xl border transition-all ${
                    channel === c.id
                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20'
                      : 'border-black/[0.08] hover:border-amber-300'
                  }`}
                >
                  <span className="flex items-center gap-2 font-bold text-sm text-gray-900">
                    <span className="material-symbols-outlined text-[20px] text-amber-600">{c.icon}</span>
                    {c.label}
                  </span>
                  <span className="block text-[11px] text-gray-500 mt-1">{c.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="font-bold text-gray-700">Ποσό είσπραξης (€)</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-lg"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          {needsReference && (
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Κωδικός κράτησης (PNR)</span>
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
            <span className="font-bold text-gray-700">Αριθμός απόδειξης (προαιρετικό)</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-sm"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="π.χ. ΑΠ-042"
            />
          </label>

          <label className="block text-sm">
            <span className="font-bold text-gray-700">Σημείωση (προαιρετικό)</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="π.χ. οδηγός Γ. Παπαδόπουλος"
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
              className="flex-1 px-4 py-2.5 rounded-full bg-amber-600 text-white text-sm font-bold disabled:opacity-60 hover:bg-amber-700 transition-colors"
            >
              {confirming ? 'Καταχώρηση…' : 'Καταχώρηση & απόδειξη'}
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
