import { useMemo, useState } from 'react';
import TemplatePreviewThumb from './TemplatePreviewThumb.jsx';

const PRIMARY_CHIPS = ['Premium', 'Minimal', 'Featured', 'Luxury', 'Mobile', 'Editorial'];

function collectFilterChips(templates) {
  const counts = new Map();
  for (const tpl of templates) {
    for (const tag of tpl.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const primary = PRIMARY_CHIPS.filter((t) => counts.has(t));
  const rest = [...counts.keys()].filter((t) => !PRIMARY_CHIPS.includes(t)).sort();
  return { primary: ['Όλα', ...primary], rest };
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
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const { primary, rest } = useMemo(() => collectFilterChips(templates), [templates]);
  const chips = showMoreFilters ? [...primary, ...rest] : primary;
  const hasMore = rest.length > 0;

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
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2';

  const accentRing =
    accent === 'teal'
      ? 'border-teal-600 bg-teal-50/70 ring-teal-500/20'
      : 'border-sky-600 bg-sky-50/70 ring-sky-500/20';
  const accentCheck = accent === 'teal' ? 'text-teal-700' : 'text-sky-700';
  const accentChip =
    accent === 'teal' ? 'bg-teal-600 text-white' : 'bg-sky-600 text-white';

  const clearFilters = () => {
    setQuery('');
    setFilter('Όλα');
  };

  return (
    <div className="pdw-picker space-y-3">
      {selected ? (
        <div className="pdw-picker__selected">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-white border border-black/[0.06] flex items-center justify-center shrink-0">
              <span className={`material-symbols-outlined ${accentCheck}`}>{selected.icon}</span>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Επιλεγμένο
              </p>
              <p className="font-bold text-slate-900 truncate text-sm">{selected.label}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
            {filtered.length}/{templates.length}
          </span>
        </div>
      ) : null}

      <div className="pdw-picker__toolbar">
        <label className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση προτύπου…"
            className="w-full rounded-xl border border-black/[0.08] bg-white pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
          />
        </label>
        {(query || filter !== 'Όλα') && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1.5 shrink-0"
          >
            Καθαρισμός
          </button>
        )}
      </div>

      <div className="pdw-picker__chips" role="group" aria-label="Φίλτρα προτύπων">
        {chips.map((chip) => {
          const active = filter === chip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setFilter(chip)}
              className={`pdw-picker__chip${active ? ` is-active ${accentChip}` : ''}`}
            >
              {chip}
            </button>
          );
        })}
        {hasMore ? (
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className="pdw-picker__chip is-more"
          >
            {showMoreFilters ? 'Λιγότερα' : `+${rest.length} ακόμα`}
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center rounded-2xl border border-dashed border-slate-200">
          Δεν βρέθηκαν πρότυπα —{' '}
          <button type="button" className="font-bold text-sky-700 underline" onClick={clearFilters}>
            καθάρισε τα φίλτρα
          </button>
          .
        </p>
      ) : (
        <div className={`grid ${colClass} gap-3`}>
          {filtered.map((tpl) => {
            const isSelected = value === tpl.id;
            const isPremium = (tpl.tags || []).includes('Premium');
            const visibleTags = (tpl.tags || []).filter((t) => t !== 'Premium').slice(0, 2);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onChange(tpl.id)}
                aria-pressed={isSelected}
                className={`group text-left rounded-[16px] border-2 p-2.5 transition-all ${
                  isSelected
                    ? `${accentRing} shadow-md ring-2`
                    : 'border-black/[0.06] bg-white hover:border-slate-300 hover:shadow-sm'
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
                <div className="mt-2.5 min-w-0">
                  <p className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">
                      {tpl.icon}
                    </span>
                    <span className="truncate">{tpl.label}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                    {tpl.description}
                  </p>
                </div>
                {visibleTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {visibleTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600"
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
