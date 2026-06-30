/**
 * Module 3 — Fuel & Tolls expense tracker with receipt camera capture.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { uploadDriverExpense } from '../../../services/driverPortalApi.js';

const CATEGORIES = [
  { id: 'fuel', label: 'Καύσιμα' },
  { id: 'tolls', label: 'Διόδια' },
  { id: 'maintenance', label: 'Συντήρηση' },
];

export default function ExpenseUpload() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('fuel');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onReceiptPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    toast.success('Απόδειξη έτοιμη για ανέβασμα');
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await uploadDriverExpense({
        amount: parseFloat(amount),
        category,
        description,
        receiptFile,
      });
      toast.success(res.queued ? 'Αποθηκεύτηκε offline' : 'Έξοδο καταχωρήθηκε');
      setAmount('');
      setDescription('');
      setReceiptFile(null);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία καταχώρησης');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="driver-stack">
      <div className="text-center pb-1">
        <p className="driver-card-label">Έξοδα βάρδιας</p>
        <h2 className="text-xl font-extrabold tracking-tight">Καταγραφή εξόδων</h2>
      </div>

      <label className="block driver-card">
        <span className="driver-card-label">Ποσό (€)</span>
        <input
          type="number"
          step="0.01"
          required
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="driver-touch w-full mt-2 bg-black/30 border border-[var(--driver-border)] rounded-xl px-4 text-white text-2xl min-h-[3.5rem]"
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`driver-touch rounded-xl border min-h-[3.25rem] text-sm font-bold ${
              category === c.id
                ? 'border-[var(--driver-yellow)] bg-[var(--driver-yellow-soft)] text-[var(--driver-yellow)]'
                : 'border-[var(--driver-border)] bg-black/25 text-[var(--driver-muted)]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Σχόλια..."
        rows={2}
        className="w-full bg-black/30 border border-[var(--driver-border)] rounded-xl p-4 text-white text-base min-h-[5rem]"
      />

      <label className="driver-touch driver-card flex items-center justify-center gap-3 cursor-pointer min-h-[72px]">
        <span className="material-symbols-outlined text-4xl text-[#facc15]">photo_camera</span>
        <span className="font-bold text-lg">
          {receiptFile ? receiptFile.name : 'Φωτογραφία απόδειξης'}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onReceiptPhoto}
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="driver-touch driver-btn-primary w-full rounded-2xl min-h-[56px] text-lg disabled:opacity-50"
      >
        {submitting ? 'Αποθήκευση…' : 'Αποθήκευση'}
      </button>
    </form>
  );
}
