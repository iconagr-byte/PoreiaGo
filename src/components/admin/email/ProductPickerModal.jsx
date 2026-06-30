import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchCampaignInventory } from '../../../services/emailMarketingApi.js';

export default function ProductPickerModal({ open, onClose, onSelect, themed = false, luxury = false }) {
  const useHubTheme = themed || luxury;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchCampaignInventory()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const filtered = products.filter(
    (p) =>
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase()),
  );

  const resolveImg = (url) => {
    if (!url) return '';
    if (url.startsWith('/')) return url;
    return url;
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${useHubTheme ? 'emh-modal-backdrop' : 'bg-black/50'}`}
    >
      <div
        className={
          useHubTheme
            ? 'emh-modal rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden'
            : 'bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden'
        }
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--emh-border,#e2e8f0)]">
          <h3 className="font-semibold text-lg">Επιλογή Προϊόντος</h3>
          <button type="button" onClick={onClose} className="emh-btn-ghost p-2">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-3">
          <input
            className={useHubTheme ? 'emh-input mb-0' : 'w-full px-4 py-2 rounded-xl border border-outline-variant bg-surface-container-low'}
            placeholder="Αναζήτηση προϊόντος…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 grid sm:grid-cols-2 gap-3">
          {loading && <p className="emh-muted-text col-span-2">Φόρτωση inventory…</p>}
          {!loading && filtered.length === 0 && (
            <p className="emh-muted-text col-span-2">Δεν βρέθηκαν προϊόντα.</p>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p);
                onClose();
              }}
              className={
                useHubTheme
                  ? 'text-left p-4 transition-all emh-product-card'
                  : 'text-left rounded-xl border border-outline-variant p-4 hover:border-primary hover:bg-primary/5 transition-all'
              }
            >
              {p.image_url && (
                <img
                  src={resolveImg(p.image_url)}
                  alt=""
                  className="w-full h-28 object-cover rounded-lg mb-3"
                />
              )}
              <p className="font-semibold">{p.title}</p>
              <p className={useHubTheme ? 'emh-product-price mt-1' : 'text-primary font-bold mt-1'}>
                €{Number(p.price).toFixed(2)}
              </p>
              <p className={useHubTheme ? 'emh-muted-text mt-1' : 'text-label-sm text-on-surface-variant mt-1'}>
                Στοκ: {p.stock ?? '—'}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
