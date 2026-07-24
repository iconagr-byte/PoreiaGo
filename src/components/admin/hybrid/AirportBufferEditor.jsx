import { DEFAULT_AIRPORT_BUFFERS, listAirportBufferRows } from '../../../lib/hybrid/airportBuffers.js';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400';

export default function AirportBufferEditor({ formData, setFormData }) {
  const overrides = formData.airportBuffers || {};
  const rows = listAirportBufferRows(overrides).slice(0, 12);

  const patchBuffer = (code, minutes) => {
    setFormData((prev) => {
      const next = { ...(prev.airportBuffers || {}) };
      const n = Number(minutes);
      if (!Number.isFinite(n) || n < 0) {
        delete next[code];
      } else if (n === DEFAULT_AIRPORT_BUFFERS[code]) {
        delete next[code];
      } else {
        next[code] = n;
      }
      return { ...prev, airportBuffers: next };
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Buffer ανά αεροδρόμιο για connection risk (π.χ. ATH 45′, SKG 30′).
      </p>
      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {rows.map((row) => (
          <label key={row.code} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
            <span className="font-mono text-xs font-bold w-8">{row.code}</span>
            <input
              type="number"
              min="0"
              step="5"
              className={fieldClass}
              value={row.minutes}
              onChange={(e) => patchBuffer(row.code, e.target.value)}
            />
            <span className="text-[10px] text-slate-400">′</span>
          </label>
        ))}
      </div>
    </div>
  );
}
