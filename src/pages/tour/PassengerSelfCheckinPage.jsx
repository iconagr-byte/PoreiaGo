import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { decodePassengerCheckin, savePassengerSelfCheckin } from '../../lib/hybrid/shareTokens.js';

/**
 * Public passenger self check-in (presence + luggage count).
 */
export default function PassengerSelfCheckinPage() {
  const token =
    typeof window !== 'undefined' ? String(window.location.hash || '').replace(/^#/, '') : '';
  const data = useMemo(() => decodePassengerCheckin(token), [token]);
  const [selectedId, setSelectedId] = useState('');
  const [luggage, setLuggage] = useState(1);
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <p className="font-semibold text-slate-700">Μη έγκυρος σύνδεσμος check-in</p>
      </div>
    );
  }

  const selected = (data.passengers || []).find((p) => p.id === selectedId);

  const submit = () => {
    if (!selected) {
      toast.error('Επιλέξτε το όνομά σας');
      return;
    }
    savePassengerSelfCheckin(data.id, {
      passenger_id: selected.id,
      passenger_name: selected.passenger_name,
      luggage_count: Number(luggage) || 0,
      notes,
      status: 'self_checked_in',
    });
    setDone(true);
    toast.success('Το check-in καταχωρήθηκε');
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-2xl border border-emerald-200 bg-white p-6 text-center space-y-2">
          <span className="material-symbols-outlined text-4xl text-emerald-600">check_circle</span>
          <h1 className="text-xl font-bold">Επιβεβαιώθηκε</h1>
          <p className="text-sm text-slate-600">
            {selected?.passenger_name} · αποσκευές {luggage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5">
        <div className="max-w-md mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Self check-in</p>
          <h1 className="text-xl font-bold mt-1">{data.title}</h1>
        </div>
      </header>
      <main className="max-w-md mx-auto p-4 space-y-4">
        <label className="block rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Το όνομά σας</span>
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— Επιλογή —</option>
            {(data.passengers || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.passenger_name}
                {p.ground_seat ? ` · λεωφ. ${p.ground_seat}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Αριθμός αποσκευών</span>
          <input
            type="number"
            min="0"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={luggage}
            onChange={(e) => setLuggage(e.target.value)}
          />
        </label>
        <label className="block rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Σημειώσεις</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="π.χ. παιδικό καρότσι"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          className="w-full rounded-2xl bg-slate-900 text-white font-bold py-3.5"
        >
          Επιβεβαίωση παρουσίας
        </button>
      </main>
    </div>
  );
}
