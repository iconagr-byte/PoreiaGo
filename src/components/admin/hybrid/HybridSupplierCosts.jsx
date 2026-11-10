import { newClientId } from '../../../lib/hybrid/costYieldCalculator.js';
import { formatMoney } from '../../../lib/currency/multiCurrency.js';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400';

function emptySheet(overrides = {}) {
  return {
    id: newClientId('sup'),
    supplier: '',
    category: 'airline',
    reference: '',
    amount: 0,
    currency: 'EUR',
    notes: '',
    attachmentName: '',
    ...overrides,
  };
}

const CATEGORIES = [
  { value: 'airline', label: 'Αεροπορική' },
  { value: 'coach', label: 'Λεωφορείο / van' },
  { value: 'hotel', label: 'Ξενοδοχείο' },
  { value: 'other', label: 'Άλλο' },
];

export default function HybridSupplierCosts({ formData, setFormData }) {
  const sheets = formData.supplierCostSheets || [];
  const currency = formData.currency || 'EUR';
  const patch = (partial) => setFormData((prev) => ({ ...prev, ...partial }));

  const total = sheets.reduce((s, row) => s + (Number(row.amount) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => patch({ supplierCostSheets: [...sheets, emptySheet({ currency })] })}
          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
        >
          + Κόστος προμηθευτή
        </button>
      </div>
      {sheets.length === 0 ? (
        <p className="text-sm text-slate-500 italic text-center py-6 border border-dashed border-slate-200 rounded-xl">
          Καταγράψτε κόστος αεροπορικής / λεωφορείου / ξενοδοχείου (με όνομα αρχείου attachment).
        </p>
      ) : (
        <ul className="space-y-2">
          {sheets.map((row) => (
            <li key={row.id} className="grid sm:grid-cols-6 gap-2 rounded-xl border border-slate-200 p-2">
              <input className={fieldClass} placeholder="Προμηθευτής" value={row.supplier || ''} onChange={(e) => patch({ supplierCostSheets: sheets.map((x) => (x.id === row.id ? { ...x, supplier: e.target.value } : x)) })} />
              <select className={fieldClass} value={row.category} onChange={(e) => patch({ supplierCostSheets: sheets.map((x) => (x.id === row.id ? { ...x, category: e.target.value } : x)) })}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <input className={fieldClass} placeholder="Ref / invoice" value={row.reference || ''} onChange={(e) => patch({ supplierCostSheets: sheets.map((x) => (x.id === row.id ? { ...x, reference: e.target.value } : x)) })} />
              <input type="number" min="0" step="0.01" className={fieldClass} value={row.amount ?? 0} onChange={(e) => patch({ supplierCostSheets: sheets.map((x) => (x.id === row.id ? { ...x, amount: e.target.value } : x)) })} />
              <input className={fieldClass} placeholder="Αρχείο.pdf" value={row.attachmentName || ''} onChange={(e) => patch({ supplierCostSheets: sheets.map((x) => (x.id === row.id ? { ...x, attachmentName: e.target.value } : x)) })} />
              <button type="button" className="text-rose-600 text-xs font-bold" onClick={() => patch({ supplierCostSheets: sheets.filter((x) => x.id !== row.id) })}>Διαγραφή</button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm font-semibold text-slate-700">Σύνολο προμηθευτών: {formatMoney(total, currency)}</p>
    </div>
  );
}
