import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LOST_ITEM_CATEGORIES, lostItemStatusLabel } from '../../lib/lostFound/categories.js';
import { fetchMyLostItems, reportLostItem } from '../../services/lostItemsApi.js';

const EMPTY_FORM = {
  itemCategory: '',
  lastSeenLocation: '',
  description: '',
};

export default function LostFoundPanel({ profile, bookings = [] }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchMyLostItems();
      setItems(list);
    } catch (err) {
      toast.error(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.itemCategory || !form.description.trim() || !form.lastSeenLocation.trim()) {
      toast.error('Συμπληρώστε όλα τα πεδία');
      return;
    }
    setSubmitting(true);
    try {
      await reportLostItem({
        itemCategory: form.itemCategory,
        description: form.description.trim(),
        lastSeenLocation: form.lastSeenLocation.trim(),
      });
      toast.success('Η δήλωση καταχωρήθηκε — το πλήρωμα ενημερώθηκε');
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const tripHints = bookings.slice(0, 5).map((b) => `${b.tripTitle} · θέση ${b.seat || '—'}`);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <section className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-level-2 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">support_agent</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-on-surface">Απωλεσθέντα</h2>
            <p className="text-sm text-on-surface-variant">
              Δηλώστε αντικείμενο που ξεχάσατε στο λεωφορείο — εμφανίζεται αμέσως στο Control Panel.
            </p>
          </div>
        </div>

        <form className="space-y-4 max-w-2xl" onSubmit={onSubmit}>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Κατηγορία αντικειμένου *
            </label>
            <select
              required
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
              value={form.itemCategory}
              onChange={(e) => setForm((f) => ({ ...f, itemCategory: e.target.value }))}
            >
              <option value="">Επιλέξτε…</option>
              {LOST_ITEM_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Τελευταία τοποθεσία *
            </label>
            <input
              required
              type="text"
              list="lost-trip-hints"
              placeholder="π.χ. Στη θέση 12Α, δρομολόγιο Μετέωρα"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
              value={form.lastSeenLocation}
              onChange={(e) => setForm((f) => ({ ...f, lastSeenLocation: e.target.value }))}
            />
            {tripHints.length > 0 && (
              <datalist id="lost-trip-hints">
                {tripHints.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Περιγραφή *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Χρώμα, μάρκα, ιδιαίτερα σημεία…"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none resize-none"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full max-w-md bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold py-3 px-6 rounded-xl transition-colors flex justify-center items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
            {submitting ? 'Υποβολή…' : 'Υποβολή δήλωσης'}
          </button>
        </form>
      </section>

      <section className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-level-2 p-6 md:p-8">
        <h3 className="text-lg font-bold text-on-surface mb-4">Οι δηλώσεις μου</h3>
        {loading && <p className="text-sm text-on-surface-variant">Φόρτωση…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-on-surface-variant italic">Δεν έχετε υποβάλει καμία δήλωση.</p>
        )}
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="p-4 rounded-2xl border border-black/[0.06] bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-bold bg-white px-2 py-0.5 rounded border border-black/[0.08]">
                    {item.id}
                  </span>
                  <span className="font-bold text-on-surface text-sm">{item.itemCategory}</span>
                </div>
                <p className="text-sm text-on-surface-variant line-clamp-2">{item.description}</p>
                <p className="text-xs text-outline mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {item.lastSeenLocation}
                </p>
                <p className="text-[10px] text-outline mt-1">
                  {new Date(item.dateReported).toLocaleString('el-GR')}
                </p>
              </div>
              <span
                className={`shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                  item.status === 'FOUND'
                    ? 'bg-green-100 text-green-700'
                    : item.status === 'CLOSED'
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {lostItemStatusLabel(item.status)}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
