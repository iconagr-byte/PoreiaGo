import { useMemo } from 'react';
import { calculateTripYield } from '../../../lib/hybrid/costYieldCalculator.js';
import { formatMoney, SUPPORTED_CURRENCIES } from '../../../lib/currency/multiCurrency.js';

const SCENARIO_MARGINS = [15, 25, 35];

export default function HybridCostCalculator({ formData, setFormData }) {
  const currency = formData.currency || 'EUR';
  const margin = formData.targetMarginPct ?? 25;
  const pax =
    Number(formData.availableSeats) ||
    Math.max(...(formData.flights || []).map((f) => Number(f.seats_allocated) || 0), 0) ||
    1;

  const yieldSummary = useMemo(
    () =>
      calculateTripYield({
        flights: formData.flights || [],
        segments: formData.segments || [],
        passengerCount: pax,
        targetMarginPct: margin,
        displayCurrency: currency,
      }),
    [formData.flights, formData.segments, pax, margin, currency],
  );

  const scenarios = useMemo(
    () =>
      SCENARIO_MARGINS.map((m) =>
        calculateTripYield({
          flights: formData.flights || [],
          segments: formData.segments || [],
          passengerCount: pax,
          targetMarginPct: m,
          displayCurrency: currency,
        }),
      ),
    [formData.flights, formData.segments, pax, currency],
  );

  const patch = (partial) => setFormData((prev) => ({ ...prev, ...partial }));

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
            Νόμισμα τιμολόγησης
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
            value={currency}
            onChange={(e) => patch({ currency: e.target.value })}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
            Στόχος περιθωρίου %
          </span>
          <input
            type="number"
            min="0"
            step="0.5"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
            value={margin}
            onChange={(e) => patch({ targetMarginPct: Number(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
            Επιβάτες (υπολογισμός)
          </span>
          <input
            type="number"
            min="1"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm bg-slate-50"
            value={pax}
            readOnly
          />
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Κόστος πτήσεων" value={formatMoney(yieldSummary.flightCost, currency)} />
        <Metric label="Κόστος ground" value={formatMoney(yieldSummary.groundCost, currency)} />
        <Metric label="Συνολικό κόστος" value={formatMoney(yieldSummary.totalCost, currency)} />
        <Metric
          label="Προτεινόμενη τιμή / άτομο"
          value={formatMoney(yieldSummary.recommendedPricePerPerson, currency)}
          emphasize
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Yield scenarios
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          {scenarios.map((s) => {
            const active = Number(s.targetMarginPct) === Number(margin);
            return (
              <button
                key={s.targetMarginPct}
                type="button"
                onClick={() =>
                  patch({
                    targetMarginPct: s.targetMarginPct,
                    price: s.recommendedPricePerPerson,
                  })
                }
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <p className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                  Margin {s.targetMarginPct}%
                </p>
                <p className={`text-lg font-bold mt-1 ${active ? 'text-white' : 'text-slate-900'}`}>
                  {formatMoney(s.recommendedPricePerPerson, currency)}
                </p>
                <p className={`text-xs mt-1 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                  Στόχος {formatMoney(s.targetRevenue, currency)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            patch({ price: yieldSummary.recommendedPricePerPerson });
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-[16px]">price_check</span>
          Εφαρμογή προτεινόμενης τιμής
        </button>
        <p className="text-xs text-slate-500">
          Στόχος εσόδων {formatMoney(yieldSummary.targetRevenue, currency)} με περιθώριο {margin}%.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, emphasize }) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        emphasize ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wider ${emphasize ? 'text-slate-300' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className={`text-lg font-bold mt-1 ${emphasize ? 'text-white' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
