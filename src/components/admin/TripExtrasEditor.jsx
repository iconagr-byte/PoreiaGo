import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_TRIP_EXTRA_OPTIONS,
  TRIP_EXTRA_ICON_OPTIONS,
  createTripExtraOption,
  euroLabel,
  normalizeTripExtraOptions,
  priceModeLabel,
} from '../../lib/trips/tripBookingExtras.js';
import {
  fetchAdminSiteAppearance,
  updateSiteAppearance,
} from '../../services/siteAppearanceApi.js';

function linesToList(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function listToLines(list) {
  return (Array.isArray(list) ? list : []).join('\n');
}

function snapshotOf(options) {
  return JSON.stringify(normalizeTripExtraOptions(options));
}

/**
 * Admin editor — υπηρεσίες εκδρομής (3–6 extras) για το βήμα μετά τις θέσεις.
 * Saved on site appearance.trip_extra_options.
 */
export default function TripExtrasEditor() {
  const [options, setOptions] = useState(() =>
    DEFAULT_TRIP_EXTRA_OPTIONS.map((o) => createTripExtraOption(o)),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState('');
  const [baseline, setBaseline] = useState('');

  const dirty = useMemo(() => snapshotOf(options) !== baseline, [options, baseline]);
  const visibleCount = useMemo(
    () => options.filter((o) => o.visible !== false).length,
    [options],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      const nextOpts = normalizeTripExtraOptions(data?.trip_extra_options);
      setOptions(nextOpts);
      setBaseline(snapshotOf(nextOpts));
      setExpandedId(nextOpts[0]?.id || '');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης υπηρεσιών');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateOption = (id, patch) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? createTripExtraOption({ ...o, ...patch }) : o)));
  };

  const addOption = () => {
    if (options.length >= 8) {
      toast.error('Μέχρι 8 υπηρεσίες');
      return;
    }
    const opt = createTripExtraOption({
      title: 'Νέα υπηρεσία',
      blurb: 'Σύντομη περιγραφή για τον πελάτη.',
      includes: ['Περιλαμβάνεται'],
      eur: 10,
      priceMode: 'per_person',
      icon: 'restaurant',
    });
    setOptions((prev) => [...prev, opt]);
    setExpandedId(opt.id);
  };

  const removeOption = (id) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
    if (expandedId === id) setExpandedId('');
  };

  const resetDefaults = () => {
    const next = DEFAULT_TRIP_EXTRA_OPTIONS.map((o) => createTripExtraOption(o));
    setOptions(next);
    setExpandedId(next[0]?.id || '');
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = normalizeTripExtraOptions(options);
      await updateSiteAppearance({ trip_extra_options: payload });
      setOptions(payload);
      setBaseline(snapshotOf(payload));
      toast.success('Οι υπηρεσίες εκδρομής αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Φόρτωση υπηρεσιών εκδρομής…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700/80">Εκδρομές</p>
          <h3 className="text-lg font-bold text-slate-900 mt-0.5">Υπηρεσίες / extras</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Εμφανίζονται μετά την επιλογή θέσης — πριν την πληρωμή. Κρύψε όσες δεν πουλάς· αν
            όλες είναι κρυφές, το βήμα παραλείπεται.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Επαναφορά προεπιλογών
          </button>
          <button
            type="button"
            onClick={addOption}
            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
          >
            + Υπηρεσία
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={save}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Αποθήκευση…' : dirty ? 'Αποθήκευση' : 'Αποθηκευμένο'}
          </button>
        </div>
      </div>

      <div className="px-5 py-3 bg-slate-50/80 text-xs text-slate-600 flex flex-wrap gap-4">
        <span>
          Ορατές στο booking: <strong>{visibleCount}</strong> / {options.length}
        </span>
        <span>Τιμή ανά άτομο ή ανά κράτηση</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {options.map((opt) => {
          const open = expandedId === opt.id;
          return (
            <li key={opt.id} className={!opt.visible ? 'opacity-55' : ''}>
              <button
                type="button"
                className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50/80"
                onClick={() => setExpandedId(open ? '' : opt.id)}
              >
                <span className="material-symbols-outlined text-sky-700 text-[22px]" aria-hidden>
                  {opt.icon || 'verified_user'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate">{opt.title || 'Χωρίς τίτλο'}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {euroLabel(opt.eur)} · {priceModeLabel(opt.priceMode)}
                    {!opt.visible ? ' · κρυφή' : ''}
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-[20px]" aria-hidden>
                  {open ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {open ? (
                <div className="px-5 pb-5 grid gap-3 md:grid-cols-2 bg-slate-50/40">
                  <label className="block text-xs font-semibold text-slate-600">
                    Τίτλος
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
                      value={opt.title}
                      onChange={(e) => updateOption(opt.id, { title: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Εικονίδιο
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
                      value={opt.icon}
                      onChange={(e) => updateOption(opt.id, { icon: e.target.value })}
                    >
                      {TRIP_EXTRA_ICON_OPTIONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
                    Περιγραφή
                    <textarea
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
                      value={opt.blurb}
                      onChange={(e) => updateOption(opt.id, { blurb: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Τιμή (€)
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
                      value={opt.eur}
                      onChange={(e) => updateOption(opt.id, { eur: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Χρέωση
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
                      value={opt.priceMode}
                      onChange={(e) => updateOption(opt.id, { priceMode: e.target.value })}
                    >
                      <option value="per_person">Ανά άτομο (× θέσεις)</option>
                      <option value="per_booking">Ανά κράτηση (μία φορά)</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
                    Περιλαμβάνει (μία γραμμή το καθένα)
                    <textarea
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
                      value={listToLines(opt.includes)}
                      onChange={(e) => updateOption(opt.id, { includes: linesToList(e.target.value) })}
                    />
                  </label>
                  <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={opt.visible !== false}
                        onChange={(e) => updateOption(opt.id, { visible: e.target.checked })}
                      />
                      Ορατή στο booking
                    </label>
                    <button
                      type="button"
                      onClick={() => removeOption(opt.id)}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Διαγραφή
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
