import { useMemo, useState } from 'react';
import TemplatePreviewThumb from './TemplatePreviewThumb.jsx';

function collectFilterChips(templates) {
  const counts = new Map();
  for (const tpl of templates) {
    for (const tag of tpl.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const preferred = ['Premium', 'Minimal', 'Featured', 'Luxury', 'Mobile', 'Editorial'];
  const rest = [...counts.keys()].filter((t) => !preferred.includes(t)).sort();
  return ['Όλα', ...preferred.filter((t) => counts.has(t)), ...rest];
}

export default function TemplatePicker({
  category,
  templates,
  value,
  onChange,
  columns = 3,
  accent = 'sky',
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Όλα');

  const chips = useMemo(() => collectFilterChips(templates), [templates]);
  const selected = useMemo(
    () => templates.find((t) => t.id === value) || templates[0],
    [templates, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (filter !== 'Όλα' && !(tpl.tags || []).includes(filter)) return false;
      if (!q) return true;
      const hay = `${tpl.label} ${tpl.description} ${(tpl.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, filter, query]);

  const colClass =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 4
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  const accentRing =
    accent === 'teal'
      ? 'border-teal-600 bg-teal-50/70 ring-teal-500/20'
      : 'border-sky-600 bg-sky-50/70 ring-sky-500/20';
  const accentCheck = accent === 'teal' ? 'text-teal-700' : 'text-sky-700';
  const accentChip =
    accent === 'teal'
      ? 'bg-teal-600 text-white'
      : 'bg-sky-600 text-white';

  return (
    <div className="space-y-4">
      {selected ? (
        <div className="rounded-2xl border border-black/[0.06] bg-gradient-to-r from-slate-50 to-white px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-white border border-black/[0.06] flex items-center justify-center shrink-0">
              <span className={`material-symbols-outlined ${accentCheck}`}>{selected.icon}</span>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Επιλεγμένο</p>
              <p className="font-bold text-slate-900 truncate">{selected.label}</p>
              <p className="text-xs text-slate-500 line-clamp-1">{selected.description}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
            {filtered.length}/{templates.length} πρότυπα
          </span>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση προτύπου…"
            className="w-full rounded-xl border border-black/[0.08] bg-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => {
            const active = filter === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setFilter(chip)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition ${
                  active
                    ? accentChip
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center rounded-2xl border border-dashed border-slate-200">
          Δεν βρέθηκαν πρότυπα — δοκιμάστε άλλο φίλτρο ή αναζήτηση.
        </p>
      ) : (
        <div className={`grid ${colClass} gap-3.5`}>
          {filtered.map((tpl) => {
            const isSelected = value === tpl.id;
            const isPremium = (tpl.tags || []).includes('Premium');
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onChange(tpl.id)}
                className={`group text-left rounded-[20px] border-2 p-3 transition-all ${
                  isSelected
                    ? `${accentRing} shadow-md ring-2`
                    : 'border-black/[0.06] bg-white hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="relative">
                  <TemplatePreviewThumb category={category} templateId={tpl.id} />
                  {isSelected ? (
                    <span
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow flex items-center justify-center ${accentCheck}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    </span>
                  ) : null}
                  {isPremium ? (
                    <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-900/85 text-amber-200">
                      Premium
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-slate-500">
                        {tpl.icon}
                      </span>
                      <span className="truncate">{tpl.label}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                </div>
                {tpl.tags?.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {tpl.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
