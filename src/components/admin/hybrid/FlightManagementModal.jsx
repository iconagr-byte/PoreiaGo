import { useEffect, useState } from 'react';
import { emptyFlight } from '../../lib/hybrid/hybridDefaults.js';
import { SUPPORTED_CURRENCIES } from '../../lib/currency/multiCurrency.js';

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10';

export default function FlightManagementModal({ open, initial = null, onClose, onSave }) {
  const [form, setForm] = useState(() => emptyFlight());

  useEffect(() => {
    if (!open) return;
    setForm(emptyFlight(initial || {}));
  }, [open, initial]);

  if (!open) return null;

  const patch = (partial) => setForm((prev) => ({ ...prev, ...partial }));

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const seats = Number(form.seats_allocated) || 0;
    const cps = Number(form.cost_per_seat) || 0;
    const total = Number(form.total_cost) > 0 ? Number(form.total_cost) : seats * cps;
    onSave?.({
      ...form,
      flight_number: String(form.flight_number || '').trim().toUpperCase(),
      departure_airport: String(form.departure_airport || '').trim().toUpperCase(),
      arrival_airport: String(form.arrival_airport || '').trim().toUpperCase(),
      pnr_code: String(form.pnr_code || '').trim().toUpperCase(),
      seats_allocated: seats,
      cost_per_seat: cps,
      total_cost: total,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-label="Κλείσιμο" />
      <form
        onSubmit={handleSubmit}
        className="relative w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-white/95 backdrop-blur">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-slate-500">flight_takeoff</span>
              {initial?.flight_number ? 'Επεξεργασία πτήσης' : 'Νέα πτήση'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Airline · PNR · θέσεις ομάδας</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Αεροπορική</span>
              <input className={fieldClass} value={form.airline} onChange={(e) => patch({ airline: e.target.value })} placeholder="Aegean" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Αριθμός πτήσης</span>
              <input required className={fieldClass} value={form.flight_number} onChange={(e) => patch({ flight_number: e.target.value })} placeholder="A3 520" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Αναχώρηση (IATA)</span>
              <input required maxLength={8} className={fieldClass} value={form.departure_airport} onChange={(e) => patch({ departure_airport: e.target.value })} placeholder="ATH" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Άφιξη (IATA)</span>
              <input required maxLength={8} className={fieldClass} value={form.arrival_airport} onChange={(e) => patch({ arrival_airport: e.target.value })} placeholder="SKG" />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Ώρα αναχώρησης</span>
              <input required type="datetime-local" className={fieldClass} value={toLocalInput(form.departure_time)} onChange={(e) => patch({ departure_time: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Ώρα άφιξης</span>
              <input required type="datetime-local" className={fieldClass} value={toLocalInput(form.arrival_time)} onChange={(e) => patch({ arrival_time: e.target.value })} />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Group PNR</span>
              <input className={fieldClass} value={form.pnr_code || ''} onChange={(e) => patch({ pnr_code: e.target.value })} placeholder="ABC123" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Θέσεις ομάδας</span>
              <input type="number" min="0" className={fieldClass} value={form.seats_allocated} onChange={(e) => patch({ seats_allocated: e.target.value })} />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Κόστος/θέση</span>
              <input type="number" min="0" step="0.01" className={fieldClass} value={form.cost_per_seat} onChange={(e) => patch({ cost_per_seat: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Σύνολο</span>
              <input type="number" min="0" step="0.01" className={fieldClass} value={form.total_cost} onChange={(e) => patch({ total_cost: e.target.value })} placeholder="αυτόματο" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Νόμισμα</span>
              <select className={fieldClass} value={form.currency || 'EUR'} onChange={(e) => patch({ currency: e.target.value })}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Σημειώσεις</span>
            <textarea rows={2} className={fieldClass} value={form.notes || ''} onChange={(e) => patch({ notes: e.target.value })} />
          </label>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100">
            Ακύρωση
          </button>
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">
            Αποθήκευση πτήσης
          </button>
        </div>
      </form>
    </div>
  );
}

function toLocalInput(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length >= 16 && s.includes('T')) return s.slice(0, 16);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
