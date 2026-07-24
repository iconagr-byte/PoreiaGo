import { useMemo, useState } from 'react';
import {
  HOMEPAGE_THEMES,
  THEME_CATEGORIES,
  filterThemes,
  getHomepageThemeById,
} from '../../../lib/homepage/homepageThemes.js';
import ThemeMiniPreview from './ThemeMiniPreview.jsx';

export default function ThemeGallery({ activeThemeId, onPreview, onApply, applying = false }) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const themes = useMemo(() => filterThemes({ category, query }), [category, query]);
  const active = getHomepageThemeById(activeThemeId);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση θέματος…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-black/[0.08] bg-white text-sm outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
          <p className="text-xs font-semibold text-slate-500 tabular-nums shrink-0">
            {themes.length}/{HOMEPAGE_THEMES.length}
          </p>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-thin">
          {THEME_CATEGORIES.map((cat) => {
            const on = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  on
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active — compact strip */}
      {active && (
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="w-14 shrink-0">
            <ThemeMiniPreview theme={active} selected />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ενεργό</p>
            <p className="font-bold text-slate-900 truncate">{active.nameEl}</p>
            <p className="text-xs text-slate-500 truncate">{active.mood || active.description}</p>
          </div>
          <div className="hidden sm:flex gap-1 shrink-0">
            {[active.palette.primary, active.palette.secondary, active.palette.hero].map((c) => (
              <span
                key={c}
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {themes.map((theme) => {
          const selected = theme.id === activeThemeId;
          return (
            <article
              key={theme.id}
              className={`flex flex-col rounded-2xl border bg-white p-2.5 transition-shadow ${
                selected
                  ? 'border-slate-900 ring-1 ring-slate-900 shadow-md'
                  : 'border-black/[0.06] hover:shadow-md'
              }`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onPreview(theme)}
              >
                <ThemeMiniPreview theme={theme} selected={selected} />
                <div className="mt-2.5 px-0.5">
                  <p className="font-bold text-sm text-slate-900 leading-snug truncate">
                    {theme.nameEl}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1">
                    {[theme.palette.primary, theme.palette.secondary, theme.palette.hero].map((c, i) => (
                      <span
                        key={`${theme.id}-${i}`}
                        className="h-2.5 w-2.5 rounded-full border border-black/10"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={applying || selected}
                onClick={() => onApply(theme)}
                className={`mt-2.5 w-full py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-70 ${
                  selected
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {selected ? 'Ενεργό' : applying ? '…' : 'Εφαρμογή'}
              </button>
            </article>
          );
        })}
      </div>

      {themes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm font-bold text-slate-700">Κανένα αποτέλεσμα</p>
          <button
            type="button"
            onClick={() => {
              setCategory('all');
              setQuery('');
            }}
            className="mt-2 text-xs font-bold text-sky-600 hover:underline"
          >
            Καθαρισμός φίλτρων
          </button>
        </div>
      )}
    </div>
  );
}
