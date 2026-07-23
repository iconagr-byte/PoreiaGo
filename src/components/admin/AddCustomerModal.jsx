import { useState } from 'react';
import toast from 'react-hot-toast';
import { upsertCustomer } from '../../lib/customers/customerStore.js';

/** Modal — δημιουργία νέου πελάτη στο πελατολόγιο. */
export default function AddCustomerModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setBusy(false);
  };

  const submit = (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Συμπληρώστε έγκυρο email');
      return;
    }
    setBusy(true);
    try {
      const row = upsertCustomer({
        name: name.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: phone.trim(),
      });
      if (!row) {
        toast.error('Αποτυχία αποθήκευσης');
        return;
      }
      toast.success(`Προστέθηκε: ${row.name}`);
      onCreated?.(row);
      reset();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Κλείσιμο" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-[28px] bg-white shadow-2xl border border-black/[0.06] p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Νέος πελάτης</h3>
            <p className="text-sm text-gray-500 mt-0.5">Προσθήκη καρτέλας στο πελατολόγιο</p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ονοματεπώνυμο</span>
          <input
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="π.χ. Μαρία Παπαδοπούλου"
            autoFocus
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email *</span>
          <input
            type="email"
            required
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@email.com"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Τηλέφωνο</span>
          <input
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="69xxxxxxxx"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full border text-sm font-bold">
            Άκυρο
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-60"
          >
            Αποθήκευση
          </button>
        </div>
      </form>
    </div>
  );
}
