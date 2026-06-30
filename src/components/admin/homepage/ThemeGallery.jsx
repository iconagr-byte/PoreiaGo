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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση θέματος…"
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-black/[0.08] bg-white text-sm focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <p className="text-xs text-gray-500 font-medium">
          {themes.length} από {HOMEPAGE_THEMES.length} θέματα
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {THEME_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              category === cat.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-gray-600 border border-black/[0.08] hover:border-primary/30'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {active && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-violet-500/5 p-4 flex flex-wrap items-center gap-4">
          <div className="w-16 shrink-0">
            <ThemeMiniPreview theme={active} selected />
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Ενεργό θέμα</p>
            <p className="font-bold text-gray-900">{active.nameEl}</p>
            <p className="text-xs text-gray-500 mt-0.5">{active.description}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {themes.map((theme) => {
          const selected = theme.id === activeThemeId;
          return (
            <article
              key={theme.id}
              className={`group rounded-2xl border bg-white p-3 transition-all hover:shadow-xl ${
                selected ? 'border-primary ring-2 ring-primary/25 shadow-lg' : 'border-black/[0.06]'
              }`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onPreview(theme)}
              >
                <ThemeMiniPreview theme={theme} selected={selected} />
                <div className="mt-3">
                  <p className="font-bold text-sm text-gray-900 leading-tight">{theme.nameEl}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{theme.name}</p>
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{theme.description}</p>
                </div>
              </button>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onPreview(theme)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border border-black/[0.08] hover:bg-slate-50"
                >
                  Προεπισκόπηση
                </button>
                <button
                  type="button"
                  disabled={applying}
                  onClick={() => onApply(theme)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 disabled:opacity-50"
                >
                  {selected ? 'Ενεργό' : 'Εφαρμογή'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
