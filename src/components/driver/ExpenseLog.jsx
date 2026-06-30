import { useState } from 'react';
import { submitDriverExpense } from '../../services/driverPortalApi.js';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { id: 'fuel', label: 'Καύσιμα' },
  { id: 'tolls', label: 'Διόδια' },
  { id: 'maintenance', label: 'Συντήρηση' },
  { id: 'other', label: 'Άλλο' },
];

export default function ExpenseLog() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('fuel');
  const [description, setDescription] = useState('');
  const [receiptRef, setReceiptRef] = useState('');

  const onReceiptPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptRef(`local://${file.name}-${file.size}`);
    toast.success('Απόδειξη συνδέθηκε (ανέβασμα όταν υπάρχει σύνδεση)');
  };

  const submit = async (e) => {
    e.preventDefault();
    const res = await submitDriverExpense({
      amount: parseFloat(amount),
      category,
      description,
      receiptRef,
    });
    toast.success(res.queued ? 'Αποθηκεύτηκε offline' : 'Έξοδο καταχωρήθηκε');
    setAmount('');
    setDescription('');
    setReceiptRef('');
  };

  return (
    <form onSubmit={submit} className="p-4 pb-28 space-y-4">
      <h2 className="text-xl font-bold">Καταγραφή εξόδων</h2>

      <label className="block">
        <span className="text-neutral-400 text-sm">Ποσό (€)</span>
        <input
          type="number"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="driver-touch w-full mt-1 bg-neutral-900 border-2 border-neutral-600 rounded-xl px-4 text-white text-2xl"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`driver-touch rounded-xl border-2 ${
              category === c.id ? 'border-[#facc15] bg-yellow-950/30 text-[#facc15]' : 'border-neutral-700'
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
        className="w-full bg-neutral-900 border-2 border-neutral-600 rounded-xl p-4 text-white text-lg"
      />

      <label className="driver-touch driver-card flex items-center justify-center gap-3 cursor-pointer">
        <span className="material-symbols-outlined text-4xl text-[#facc15]">photo_camera</span>
        <span className="font-bold text-lg">Φωτογραφία απόδειξης</span>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onReceiptPhoto} />
      </label>

      <button type="submit" className="driver-touch driver-btn-primary w-full rounded-2xl">
        Αποθήκευση
      </button>
    </form>
  );
}
