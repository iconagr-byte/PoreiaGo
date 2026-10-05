import { useMemo, useState } from 'react';
import {
  RENT_THEMES,
  RENT_THEME_CATEGORIES,
  filterRentThemes,
  getRentThemeById,
} from '../../../lib/rental/rentThemes.js';
import RentThemeMiniPreview from './RentThemeMiniPreview.jsx';

/**
 * Rent full-page theme gallery — pick layout first, then tune colors below.
 */
export default function RentThemeGallery({
  activeThemeId,
  onPreview,
  onApply,
  applying = false,
}) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [includeColors, setIncludeColors] = useState(true);

  const themes = useMemo(() => filterRentThemes({ category, query }), [category, query]);
  const active = getRentThemeById(activeThemeId);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-teal-600/15 bg-teal-50/80 px-4 py-3 text-sm text-slate-900">
        <p className="font-bold">1. Επίλεξε πλήρη σελίδα /rent</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
          Κάθε θέμα αλλάζει hero, διάταξη στόλου και στυλ καρτών — όχι μόνο χρώμα. Μετά μπορείς να
          ρυθμίσεις τα χρώματα από κάτω.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="pdw-theme-search relative flex-1">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση θέματος /rent…"
            />
          </div>
          <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
            {themes.length}/{RENT_THEMES.length}
          </p>
        </div>

        <div className="pdw-theme-chips">
          {RENT_THEME_CATEGORIES.map((cat) => {
            const on = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`pdw-theme-chip${on ? ' is-active' : ''}`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-700 focus:ring-teal-600"
          checked={includeColors}
          onChange={(e) => setIncludeColors(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-bold text-slate-900">Και τα προτεινόμενα χρώματα</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Αν είναι off, κρατάς τα τρέχοντα χρώματα /rent και αλλάζει μόνο η διάταξη.
          </span>
        </span>
      </label>

      {active ? (
        <div className="pdw-theme-active">
          <div className="pdw-theme-active__preview">
            <RentThemeMiniPreview theme={active} selected />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ενεργό /rent</p>
            <p className="truncate text-base font-bold text-slate-900">{active.nameEl}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {active.layoutLabel || active.mood || active.description}
            </p>
          </div>
        </div>
      ) : null}

      <div className="pdw-theme-grid">
        {themes.map((theme) => {
          const selected = theme.id === activeThemeId;
          return (
            <article
              key={theme.id}
              className={`pdw-theme-card group${selected ? ' is-selected' : ''}`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onPreview?.(theme, { includeColors })}
              >
                <RentThemeMiniPreview theme={theme} selected={selected} />
                <div className="mt-2.5 px-0.5">
                  <p className="truncate text-sm font-bold leading-snug text-slate-900">
                    {theme.nameEl}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {theme.layoutLabel || theme.mood}
                  </p>
                  {theme.badge ? (
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700">
                      {theme.badge}
                    </p>
                  ) : null}
                </div>
              </button>

              <button
                type="button"
                disabled={applying || selected}
                onClick={() => onApply?.(theme, { includeColors })}
                className={`pdw-theme-apply${selected ? ' is-active' : ''}`}
              >
                {selected
                  ? 'Ενεργό'
                  : applying
                    ? '…'
                    : includeColors
                      ? 'Διάταξη + χρώματα'
                      : 'Εφαρμογή διάταξης'}
              </button>
            </article>
          );
        })}
      </div>

      {themes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.08] bg-white/60 py-12 text-center">
          <p className="text-sm font-bold text-slate-900">Κανένα αποτέλεσμα</p>
          <button
            type="button"
            onClick={() => {
              setCategory('all');
              setQuery('');
            }}
            className="mt-2 text-xs font-bold text-teal-700 hover:underline"
          >
            Καθαρισμός φίλτρων
          </button>
        </div>
      ) : null}
    </div>
  );
}
