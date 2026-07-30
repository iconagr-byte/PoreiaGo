import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  RENT_COVERAGE_ICON_OPTIONS,
  RENT_COVERAGE_OPTIONS,
  RENT_INCLUDED_DEFAULTS,
  createCoverageOption,
  euroLabel,
  normalizeCoverageOptions,
  normalizeIncludedDefaults,
} from '../../../lib/rental/rentBookingExtras.js';
import {
  fetchSiteAppearance,
  updateSiteAppearance,
} from '../../../services/siteAppearanceApi.js';

function linesToList(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function listToLines(list) {
  return (Array.isArray(list) ? list : []).join('\n');
}

function snapshotOf(options, included, upsellId = '') {
  return JSON.stringify({
    options: normalizeCoverageOptions(options),
    included: normalizeIncludedDefaults(included),
    upsellId: String(upsellId || '').trim(),
  });
}

/**
 * Admin editor for rent booking coverages / extras (prices, copy, includes/excludes).
 * Saved on site appearance — tenant scoped.
 */
export default function RentCoverageExtrasEditor() {
  const [options, setOptions] = useState(() =>
    RENT_COVERAGE_OPTIONS.map((o) => createCoverageOption(o)),
  );
  const [included, setIncluded] = useState(() => [...RENT_INCLUDED_DEFAULTS]);
  const [upsellId, setUpsellId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState('');
  const [baseline, setBaseline] = useState('');
  const [dragId, setDragId] = useState('');

  const dirty = useMemo(
    () => snapshotOf(options, included, upsellId) !== baseline,
    [options, included, upsellId, baseline],
  );

  const visibleChoices = useMemo(
    () => options.filter((o) => o.visible !== false),
    [options],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSiteAppearance();
      const nextOpts = normalizeCoverageOptions(data?.rent_coverage_options);
      const nextInc = normalizeIncludedDefaults(data?.rent_included_defaults);
      const nextUpsell = String(data?.rent_upsell_coverage_id || '').trim();
      setOptions(nextOpts);
      setIncluded(nextInc);
      setUpsellId(nextUpsell);
      setBaseline(snapshotOf(nextOpts, nextInc, nextUpsell));
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
    setOptions((prev) => prev.map((o) => (o.id === id ? createCoverageOption({ ...o, ...patch }) : o)));
  };

  const addOption = () => {
    if (options.length >= 12) {
      toast.error('Μέχρι 12 υπηρεσίες');
      return;
    }
    const opt = createCoverageOption({
      title: 'Νέα υπηρεσία',
      blurb: 'Σύντομη περιγραφή για τον πελάτη.',
      includes: ['Περιλαμβάνεται'],
      excludes: [],
      eurPerDay: 5,
      icon: 'verified_user',
    });
    setOptions((prev) => [...prev, opt]);
    setExpandedId(opt.id);
  };

  const removeOption = (id) => {
    if (options.length <= 1) {
      toast.error('Κράτα τουλάχιστον μία υπηρεσία');
      return;
    }
    const row = options.find((o) => o.id === id);
    if (!window.confirm(`Διαγραφή «${row?.title || 'υπηρεσίας'}»;`)) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
    if (expandedId === id) setExpandedId('');
    if (upsellId === id) setUpsellId('');
  };

  const moveOption = (id, dir) => {
    const i = options.findIndex((o) => o.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    setOptions(next);
  };

  const reorder = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const from = options.findIndex((o) => o.id === fromId);
    const to = options.findIndex((o) => o.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...options];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOptions(next);
  };

  const resetDefaults = () => {
    if (!window.confirm('Επαναφορά στις προεπιλογές PoreiaGo;')) return;
    const nextOpts = RENT_COVERAGE_OPTIONS.map((o) => createCoverageOption(o));
    const nextInc = [...RENT_INCLUDED_DEFAULTS];
    const nextUpsell = nextOpts[0]?.id || '';
    setOptions(nextOpts);
    setIncluded(nextInc);
    setUpsellId(nextUpsell);
    setExpandedId(nextOpts[0]?.id || '');
  };

  const save = async () => {
    setSaving(true);
    try {
      const payloadOpts = normalizeCoverageOptions(options);
      const payloadInc = normalizeIncludedDefaults(included);
      const preferred = payloadOpts.some((o) => o.id === upsellId) ? upsellId : '';
      await updateSiteAppearance({
        rent_coverage_options: payloadOpts,
        rent_included_defaults: payloadInc,
        rent_upsell_coverage_id: preferred,
      });
      setOptions(payloadOpts);
      setIncluded(payloadInc);
      setUpsellId(preferred);
      setBaseline(snapshotOf(payloadOpts, payloadInc, preferred));
      toast.success('Οι υπηρεσίες ενοικίασης αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 py-8">Φόρτωση υπηρεσιών…</p>;
  }

  return (
    <div className="rent-cov space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700/80 mb-1">
            Booking wizard · /rent
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Υπηρεσίες & καλύψεις</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Τίτλοι, κείμενα, τιμές ανά ημέρα, τι περιλαμβάνεται / εξαιρείται — εμφανίζονται στο βήμα
            «Υπηρεσίες» της κράτησης.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            Προεπιλογές
          </button>
          <button
            type="button"
            onClick={addOption}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-900 hover:bg-teal-100"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Νέα υπηρεσία
          </button>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-50 shadow-sm shadow-teal-700/20"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? 'Αποθήκευση…' : dirty ? 'Αποθήκευση' : 'Αποθηκευμένο'}
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/80 to-white px-4 py-3 text-sm text-teal-950/80">
        <span className="font-bold">Συμβουλή:</span> κράτα 3–5 δυνατές κάρτες. Σύρε για σειρά ·
        απόκρυψε όσες δεν προσφέρεις χωρίς να τις διαγράψεις.
      </div>

      <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.04]">
          <h3 className="font-bold text-slate-900">Προσφορά στο checkout</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ποια κάρτα εμφανίζεται ως «Προσφορά για σένα» αν ο πελάτης δεν την έχει επιλέξει ακόμα.
          </p>
        </div>
        <div className="p-4 grid md:grid-cols-[1fr_auto] gap-4 items-end">
          <label className="block text-sm min-w-0">
            <span className="font-bold text-slate-700 text-xs">Προεπιλεγμένη προσφορά</span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-sm"
              value={upsellId}
              onChange={(e) => setUpsellId(e.target.value)}
            >
              <option value="">Αυτόματα (πρώτη μη επιλεγμένη)</option>
              {visibleChoices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} · {euroLabel(o.eurPerDay)}/ημέρα
                </option>
              ))}
            </select>
          </label>
          {upsellId ? (
            <button
              type="button"
              onClick={() => setUpsellId('')}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Καθαρισμός
            </button>
          ) : null}
        </div>
        {upsellId ? (
          <div className="px-4 pb-4">
            {(() => {
              const pick = options.find((o) => o.id === upsellId);
              if (!pick) return null;
              return (
                <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 flex gap-4 items-center max-w-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Προσφορά για σένα
                    </p>
                    <p className="mt-1 font-bold text-teal-900">
                      Ανέβα επίπεδο προστασίας — {pick.title} μόνο με {euroLabel(pick.eurPerDay)} /
                      ημέρα
                    </p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{pick.blurb}</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[28px]">{pick.icon}</span>
                  </div>
                </article>
              );
            })()}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.04] flex items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900">Πάντα συμπεριλαμβάνονται</h3>
          <span className="text-xs text-slate-400">μία γραμμή = ένα bullet</span>
        </div>
        <div className="p-4">
          <textarea
            className="w-full min-h-[6rem] rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={listToLines(included)}
            onChange={(e) => setIncluded(linesToList(e.target.value))}
            placeholder={'Οδική βοήθεια 24/7\nBasic CDW'}
          />
        </div>
      </section>

      <ul className="space-y-4">
        {options.map((opt, idx) => {
          const open = expandedId === opt.id;
          return (
            <li
              key={opt.id}
              draggable
              onDragStart={(e) => {
                setDragId(opt.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', opt.id);
              }}
              onDragEnd={() => setDragId('')}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = e.dataTransfer.getData('text/plain') || dragId;
                reorder(from, opt.id);
                setDragId('');
              }}
              className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition ${
                dragId === opt.id ? 'opacity-60 border-teal-300' : 'border-black/[0.06]'
              } ${opt.visible === false ? 'opacity-75' : ''}`}
            >
              <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 items-start">
                <div className="flex gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">{opt.icon || 'verified_user'}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 truncate">
                        {opt.title || `Υπηρεσία ${idx + 1}`}
                      </h3>
                      {!opt.visible ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-slate-100 text-slate-500 px-2 py-0.5">
                          Κρυφή
                        </span>
                      ) : null}
                      {upsellId === opt.id ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-teal-100 text-teal-800 px-2 py-0.5">
                          Προσφορά checkout
                        </span>
                      ) : null}
                      <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">
                      {opt.blurb || 'Χωρίς περιγραφή'}
                    </p>
                    <p className="mt-1 text-sm font-bold text-teal-800 tabular-nums">
                      {euroLabel(opt.eurPerDay)} <span className="font-semibold text-slate-400">/ ημέρα</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <button
                    type="button"
                    className="rounded-lg border px-2 py-1.5 text-xs font-bold text-slate-500"
                    title="Σύρε για σειρά"
                  >
                    <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border px-2 py-1.5 text-xs font-bold"
                    onClick={() => moveOption(opt.id, -1)}
                    disabled={idx === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border px-2 py-1.5 text-xs font-bold"
                    onClick={() => moveOption(opt.id, 1)}
                    disabled={idx === options.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                    onClick={() => setExpandedId(open ? '' : opt.id)}
                  >
                    {open ? 'Κλείσιμο' : 'Επεξεργασία'}
                  </button>
                  {opt.visible !== false ? (
                    <button
                      type="button"
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                        upsellId === opt.id
                          ? 'border-teal-300 bg-teal-50 text-teal-900'
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setUpsellId(upsellId === opt.id ? '' : opt.id)}
                    >
                      {upsellId === opt.id ? 'Προσφορά ✓' : 'Ως προσφορά'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-rose-200 text-rose-700 px-2.5 py-1.5 text-xs font-bold"
                    onClick={() => removeOption(opt.id)}
                  >
                    Διαγραφή
                  </button>
                </div>
              </div>

              {/* Live card preview */}
              <div className="px-4 pb-4">
                <article className="rounded-2xl border border-teal-100 bg-gradient-to-b from-white to-teal-50/30 p-4 max-w-md">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-900 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px]">{opt.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900">{opt.title || 'Τίτλος'}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.blurb || '—'}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs">
                    {(opt.includes || []).map((t) => (
                      <li key={`i-${t}`} className="flex items-center gap-1.5 text-emerald-700">
                        <span className="material-symbols-outlined text-[14px]">check</span>
                        {t}
                      </li>
                    ))}
                    {(opt.excludes || []).map((t) => (
                      <li key={`e-${t}`} className="flex items-center gap-1.5 text-rose-600">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <strong className="text-sm text-slate-900">
                      {euroLabel(opt.eurPerDay)}{' '}
                      <span className="font-semibold text-slate-400">/ ημέρα</span>
                    </strong>
                    <span className="rounded-full border border-teal-300 text-teal-800 text-xs font-bold px-3 py-1">
                      Προσθήκη
                    </span>
                  </div>
                </article>
              </div>

              {open ? (
                <div className="border-t border-black/[0.04] bg-slate-50/70 p-4 grid sm:grid-cols-2 gap-3">
                  <label className="block text-sm sm:col-span-2">
                    <span className="font-bold text-slate-700 text-xs">Τίτλος</span>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                      value={opt.title}
                      onChange={(e) => updateOption(opt.id, { title: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="font-bold text-slate-700 text-xs">Περιγραφή</span>
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white min-h-[4.5rem]"
                      value={opt.blurb}
                      onChange={(e) => updateOption(opt.id, { blurb: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Τιμή € / ημέρα</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                      value={opt.eurPerDay}
                      onChange={(e) => updateOption(opt.id, { eurPerDay: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Εικονίδιο</span>
                    <select
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                      value={opt.icon}
                      onChange={(e) => updateOption(opt.id, { icon: e.target.value })}
                    >
                      {RENT_COVERAGE_ICON_OPTIONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Περιλαμβάνει (μία ανά γραμμή)</span>
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white min-h-[5rem]"
                      value={listToLines(opt.includes)}
                      onChange={(e) => updateOption(opt.id, { includes: linesToList(e.target.value) })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Εξαιρεί (μία ανά γραμμή)</span>
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white min-h-[5rem]"
                      value={listToLines(opt.excludes)}
                      onChange={(e) => updateOption(opt.id, { excludes: linesToList(e.target.value) })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Κλειδί φόρμας (τεχνικό)</span>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white font-mono text-xs"
                      value={opt.formKey}
                      onChange={(e) => updateOption(opt.id, { formKey: e.target.value })}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm self-end pb-2">
                    <input
                      type="checkbox"
                      checked={opt.visible !== false}
                      onChange={(e) => updateOption(opt.id, { visible: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="font-bold text-slate-700">Ορατή στο booking</span>
                  </label>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {dirty ? (
        <div className="sticky bottom-3 z-10 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-900/20 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση αλλαγών'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
