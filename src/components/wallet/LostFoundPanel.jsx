import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LOST_ITEM_CATEGORIES, lostItemStatusLabel } from '../../lib/lostFound/categories.js';
import { fetchMyLostItems, reportLostItem } from '../../services/lostItemsApi.js';

const EMPTY_FORM = {
  itemCategory: '',
  lastSeenLocation: '',
  description: '',
};

function statusChipClass(status) {
  if (status === 'FOUND') return 'wallet-chip wallet-chip-ok';
  if (status === 'CLOSED') return 'wallet-chip wallet-chip-muted';
  return 'wallet-chip wallet-chip-warn';
}

export default function LostFoundPanel({ bookings = [] }) {
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
    <div className="wallet-stack">
      <section className="wallet-panel">
        <div className="wallet-panel-head">
          <span className="wallet-panel-head-icon" aria-hidden>
            <span className="material-symbols-outlined">support_agent</span>
          </span>
          <div>
            <h2>Απωλεσθέντα</h2>
            <p>
              Δηλώστε αντικείμενο που ξεχάσατε στο λεωφορείο — εμφανίζεται αμέσως στο Control Panel.
            </p>
          </div>
        </div>

        <form className="wallet-form" onSubmit={onSubmit}>
          <div className="wallet-field">
            <label htmlFor="lost-category">Κατηγορία αντικειμένου *</label>
            <select
              id="lost-category"
              required
              className="wallet-select"
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

          <div className="wallet-field">
            <label htmlFor="lost-location">Τελευταία τοποθεσία *</label>
            <input
              id="lost-location"
              required
              type="text"
              list="lost-trip-hints"
              placeholder="π.χ. Στη θέση 12Α, δρομολόγιο Μετέωρα"
              className="wallet-input"
              value={form.lastSeenLocation}
              onChange={(e) => setForm((f) => ({ ...f, lastSeenLocation: e.target.value }))}
            />
            {tripHints.length > 0 ? (
              <datalist id="lost-trip-hints">
                {tripHints.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            ) : null}
          </div>

          <div className="wallet-field">
            <label htmlFor="lost-description">Περιγραφή *</label>
            <textarea
              id="lost-description"
              required
              rows={4}
              placeholder="Χρώμα, μάρκα, ιδιαίτερα σημεία…"
              className="wallet-textarea"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="wallet-btn wallet-btn-primary wallet-btn-block"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
            {submitting ? 'Υποβολή…' : 'Υποβολή δήλωσης'}
          </button>
        </form>
      </section>

      <section className="wallet-panel">
        <h2>Οι δηλώσεις μου</h2>
        {loading ? <p className="wallet-empty-copy">Φόρτωση…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="wallet-empty-copy">Δεν έχετε υποβάλει καμία δήλωση.</p>
        ) : null}
        <div className="wallet-list">
          {items.map((item) => (
            <article key={item.id} className="wallet-list-item">
              <div className="min-w-0">
                <div className="wallet-list-item-title">
                  <span className="wallet-list-id">{item.id}</span>
                  <strong>{item.itemCategory}</strong>
                </div>
                <p>{item.description}</p>
                <p className="wallet-list-meta">
                  <span className="material-symbols-outlined">location_on</span>
                  {item.lastSeenLocation}
                </p>
                <p className="wallet-list-meta">
                  {new Date(item.dateReported).toLocaleString('el-GR')}
                </p>
              </div>
              <span className={statusChipClass(item.status)}>
                {lostItemStatusLabel(item.status)}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
