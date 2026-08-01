/**
 * Desk booking wizard — dates → vehicle → customer (office channel).
 */
import { useMemo, useState } from 'react';
import { resolveSiteAssetUrl } from '../../../services/siteAppearanceApi.js';
import { RENT_CATEGORY_OPTIONS } from '../../../lib/rental/rentVehicleCategories.js';

function euro(n) {
  return `€${Number(n || 0).toLocaleString('el-GR', { maximumFractionDigits: 2 })}`;
}

function toLocalInputValue(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function roundToNextHour(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function rentalDays(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const a = new Date(startStr).getTime();
  const b = new Date(endStr).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.max(1, Math.ceil((b - a) / (24 * 60 * 60 * 1000)));
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const STEPS = [
  { id: 1, label: 'Ημερομηνίες', icon: 'calendar_month' },
  { id: 2, label: 'Όχημα', icon: 'directions_car' },
  { id: 3, label: 'Πελάτης', icon: 'person' },
];

const fieldClass =
  'mt-1.5 w-full rounded-2xl border border-slate-200/90 bg-white px-3.5 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100';

export default function RentalDeskBookingWizard({
  wiz,
  setWiz,
  busy = false,
  onSearchAvailability,
  onConfirm,
  onCancel,
}) {
  const [sameReturn, setSameReturn] = useState(
    () => !wiz.dropoff_location || wiz.dropoff_location === wiz.pickup_location,
  );
  const [vehicleQuery, setVehicleQuery] = useState('');

  const days = rentalDays(wiz.start_time, wiz.end_time);
  const selectedVehicle = useMemo(
    () => (wiz.suggestions || []).find((v) => v.id === wiz.vehicle_id) || null,
    [wiz.suggestions, wiz.vehicle_id],
  );

  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    const rows = wiz.suggestions || [];
    if (!q) return rows;
    return rows.filter((v) =>
      [v.plate_number, v.model, v.category, v.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [wiz.suggestions, vehicleQuery]);

  const applyPreset = (preset) => {
    const start = roundToNextHour();
    let end;
    if (preset === '1d') end = addDays(start, 1);
    else if (preset === '3d') end = addDays(start, 3);
    else if (preset === '7d') end = addDays(start, 7);
    else if (preset === 'weekend') {
      // Next Saturday 10:00 → Monday 10:00
      const sat = new Date(start);
      const day = sat.getDay();
      const add = day === 6 ? 0 : (6 - day + 7) % 7 || 7;
      sat.setDate(sat.getDate() + add);
      sat.setHours(10, 0, 0, 0);
      end = addDays(sat, 2);
      setWiz((w) => ({
        ...w,
        start_time: toLocalInputValue(sat),
        end_time: toLocalInputValue(end),
      }));
      return;
    } else {
      end = addDays(start, 1);
    }
    setWiz((w) => ({
      ...w,
      start_time: toLocalInputValue(start),
      end_time: toLocalInputValue(end),
    }));
  };

  const setPickup = (value) => {
    setWiz((w) => ({
      ...w,
      pickup_location: value,
      dropoff_location: sameReturn ? value : w.dropoff_location,
    }));
  };

  const goStep = (step) => {
    if (step === 1) setWiz((w) => ({ ...w, step: 1 }));
    if (step === 2 && (wiz.suggestions || []).length) setWiz((w) => ({ ...w, step: 2 }));
    if (step === 3 && wiz.vehicle_id) setWiz((w) => ({ ...w, step: 3 }));
  };

  return (
    <div className="rent-desk-wizard max-w-3xl space-y-4">
      <div className="rounded-[28px] border border-teal-100/80 bg-gradient-to-br from-white via-white to-teal-50/50 p-5 sm:p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700/80">
              Κράτηση γραφείου
            </p>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
              Νέα ενοικίαση από το desk
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Έλεγχος διαθεσιμότητας χωρίς double-booking · πελάτης στο CRM · μετά Χαρτούρα για
              υπογραφή.
            </p>
          </div>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Κλείσιμο
            </button>
          ) : null}
        </div>

        {/* Stepper */}
        <ol className="grid grid-cols-3 gap-2 mb-6">
          {STEPS.map((s) => {
            const active = wiz.step === s.id;
            const done = wiz.step > s.id;
            const clickable =
              s.id === 1 ||
              (s.id === 2 && (wiz.suggestions || []).length > 0) ||
              (s.id === 3 && wiz.vehicle_id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => goStep(s.id)}
                  className={`w-full rounded-2xl border px-2.5 py-2.5 text-left transition ${
                    active
                      ? 'border-teal-400 bg-teal-700 text-white shadow-md shadow-teal-700/20'
                      : done
                        ? 'border-teal-200 bg-teal-50 text-teal-900'
                        : 'border-slate-200 bg-white/70 text-slate-400'
                  } disabled:cursor-default`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">
                      {done && !active ? 'check_circle' : s.icon}
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold leading-tight">
                      {s.id}. {s.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {wiz.step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: '1d', label: '1 ημέρα' },
                { id: '3d', label: '3 ημέρες' },
                { id: '7d', label: '7 ημέρες' },
                { id: 'weekend', label: 'Σαβ → Δευ' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-teal-300 hover:text-teal-800"
                >
                  {p.label}
                </button>
              ))}
              {days ? (
                <span className="ml-auto inline-flex items-center rounded-full bg-teal-100 px-3 py-1.5 text-xs font-bold text-teal-900">
                  {days} {days === 1 ? 'ημέρα' : 'ημέρες'}
                </span>
              ) : null}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-slate-500">
                Παραλαβή
                <input
                  type="datetime-local"
                  required
                  className={fieldClass}
                  value={wiz.start_time}
                  onChange={(e) => setWiz((w) => ({ ...w, start_time: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-slate-500">
                Επιστροφή
                <input
                  type="datetime-local"
                  required
                  className={fieldClass}
                  value={wiz.end_time}
                  onChange={(e) => setWiz((w) => ({ ...w, end_time: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-slate-500">
                Κατηγορία
                <select
                  className={fieldClass}
                  value={wiz.category}
                  onChange={(e) => setWiz((w) => ({ ...w, category: e.target.value }))}
                >
                  <option value="">Όλες</option>
                  {RENT_CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-500">
                Ελάχ. θέσεις
                <input
                  type="number"
                  min={2}
                  max={80}
                  className={fieldClass}
                  value={wiz.min_seats}
                  onChange={(e) =>
                    setWiz((w) => ({ ...w, min_seats: Number(e.target.value) || 2 }))
                  }
                />
              </label>
              <label className="block text-xs font-bold text-slate-500 sm:col-span-2">
                Σημείο παραλαβής
                <input
                  className={fieldClass}
                  value={wiz.pickup_location}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="π.χ. Γραφείο, Αεροδρόμιο"
                />
              </label>
              <div className="sm:col-span-2 flex items-center gap-2 -mt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-teal-700"
                    checked={sameReturn}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setSameReturn(on);
                      if (on) {
                        setWiz((w) => ({ ...w, dropoff_location: w.pickup_location }));
                      }
                    }}
                  />
                  Ίδιο σημείο επιστροφής
                </label>
              </div>
              {!sameReturn ? (
                <label className="block text-xs font-bold text-slate-500 sm:col-span-2">
                  Σημείο επιστροφής
                  <input
                    className={fieldClass}
                    value={wiz.dropoff_location}
                    onChange={(e) => setWiz((w) => ({ ...w, dropoff_location: e.target.value }))}
                  />
                </label>
              ) : null}
              <label className="block text-xs font-bold text-slate-500 sm:col-span-2">
                Οδηγός
                <select
                  className={fieldClass}
                  value={wiz.driver_mode}
                  onChange={(e) => setWiz((w) => ({ ...w, driver_mode: e.target.value }))}
                >
                  <option value="SELF_DRIVE">Χωρίς οδηγό (self-drive)</option>
                  <option value="WITH_DRIVER">Με οδηγό</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              disabled={busy || !wiz.start_time || !wiz.end_time}
              onClick={onSearchAvailability}
              className="w-full py-3.5 rounded-full bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 disabled:opacity-40 inline-flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20"
            >
              <span className="material-symbols-outlined text-[20px]">
                {busy ? 'progress_activity' : 'search'}
              </span>
              {busy ? 'Αναζήτηση…' : 'Εύρεση διαθέσιμων'}
            </button>
          </div>
        )}

        {wiz.step === 2 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                {(wiz.suggestions || []).length} διαθέσιμα
                {days ? ` · ${days} ημέρες` : ''} · χωρίς double-booking
              </p>
              <input
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold w-44"
                placeholder="Αναζήτηση…"
                value={vehicleQuery}
                onChange={(e) => setVehicleQuery(e.target.value)}
              />
            </div>

            {filteredVehicles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                <p className="text-sm font-bold text-slate-800">Κανένα διαθέσιμο όχημα</p>
                <p className="text-xs text-slate-500 mt-1">Άλλαξε ημερομηνίες ή κατηγορία.</p>
                <button
                  type="button"
                  className="mt-3 text-xs font-bold text-teal-700"
                  onClick={() => setWiz((w) => ({ ...w, step: 1 }))}
                >
                  Πίσω στις ημερομηνίες
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-0.5">
                {filteredVehicles.map((v) => {
                  const selected = wiz.vehicle_id === v.id;
                  const photo = resolveSiteAssetUrl(v.photo_url);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setWiz((w) => ({ ...w, vehicle_id: v.id }))}
                      className={`w-full text-left flex gap-3 rounded-2xl border px-3 py-3 transition ${
                        selected
                          ? 'border-teal-400 bg-teal-50/80 ring-2 ring-teal-100'
                          : 'border-slate-200 bg-white hover:border-teal-200'
                      }`}
                    >
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {photo ? (
                          <img src={photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined">directions_car</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-sm text-slate-900">
                            {v.model}{' '}
                            <span className="text-teal-800 font-semibold">({v.plate_number})</span>
                          </p>
                          <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                            {euro(v.suggested_total)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {v.category} · {v.seating_capacity} θέσεις · {v.suggested_days} ημέρες
                        </p>
                        {v.one_way_surcharge > 0 || v.driver_surcharge > 0 ? (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Βάση {euro(v.base_total)}
                            {v.driver_surcharge > 0 ? ` · οδηγός ${euro(v.driver_surcharge)}` : ''}
                            {v.one_way_surcharge > 0
                              ? ` · one-way ${euro(v.one_way_surcharge)}`
                              : ''}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
                          selected ? 'border-teal-600 bg-teal-600' : 'border-slate-300'
                        }`}
                      >
                        {selected ? (
                          <span className="material-symbols-outlined text-white text-[14px]">
                            check
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="px-4 py-3 rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-700"
                onClick={() => setWiz((w) => ({ ...w, step: 1 }))}
              >
                Πίσω
              </button>
              <button
                type="button"
                disabled={!wiz.vehicle_id}
                className="flex-1 py-3 rounded-full bg-teal-700 text-white text-sm font-bold disabled:opacity-40"
                onClick={() => setWiz((w) => ({ ...w, step: 3 }))}
              >
                Συνέχεια στον πελάτη
              </button>
            </div>
          </div>
        )}

        {wiz.step === 3 && (
          <div className="space-y-4">
            {selectedVehicle ? (
              <div className="rounded-2xl border border-teal-100 bg-teal-50/50 px-4 py-3 text-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700/80">
                  Σύνοψη
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {selectedVehicle.model} ({selectedVehicle.plate_number}) ·{' '}
                  {euro(selectedVehicle.suggested_total)}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {formatWhen(wiz.start_time)} → {formatWhen(wiz.end_time)}
                  {days ? ` · ${days}ημ.` : ''}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {wiz.pickup_location}
                  {wiz.dropoff_location && wiz.dropoff_location !== wiz.pickup_location
                    ? ` → ${wiz.dropoff_location}`
                    : ''}
                </p>
              </div>
            ) : null}

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-slate-500 sm:col-span-2">
                Ονοματεπώνυμο πελάτη
                <input
                  required
                  className={fieldClass}
                  value={wiz.client_name}
                  onChange={(e) => setWiz((w) => ({ ...w, client_name: e.target.value }))}
                  placeholder="π.χ. Νίκος Παπαδόπουλος"
                  autoFocus
                />
              </label>
              <label className="block text-xs font-bold text-slate-500">
                Τηλέφωνο
                <input
                  type="tel"
                  className={fieldClass}
                  value={wiz.client_phone}
                  onChange={(e) => setWiz((w) => ({ ...w, client_phone: e.target.value }))}
                  placeholder="+30 69…"
                />
              </label>
              <label className="block text-xs font-bold text-slate-500">
                Email *
                <input
                  type="email"
                  required
                  className={fieldClass}
                  placeholder="για καρτέλα CRM & link υπογραφής"
                  value={wiz.client_email}
                  onChange={(e) => setWiz((w) => ({ ...w, client_email: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-slate-500 sm:col-span-2">
                Οδηγός
                <select
                  className={fieldClass}
                  value={wiz.driver_mode}
                  onChange={(e) => setWiz((w) => ({ ...w, driver_mode: e.target.value }))}
                >
                  <option value="SELF_DRIVE">Χωρίς οδηγό (self-drive)</option>
                  <option value="WITH_DRIVER">Με οδηγό</option>
                </select>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="px-4 py-3 rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-700"
                onClick={() => setWiz((w) => ({ ...w, step: 2 }))}
              >
                Πίσω
              </button>
              <button
                type="button"
                disabled={busy || !wiz.client_name.trim() || !wiz.client_email.trim()}
                onClick={onConfirm}
                className="flex-1 py-3.5 rounded-full bg-teal-700 text-white text-sm font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {busy ? 'progress_activity' : 'check_circle'}
                </span>
                {busy ? 'Καταχώρηση…' : 'Επιβεβαίωση κράτησης'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
