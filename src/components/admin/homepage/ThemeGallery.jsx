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
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="pdw-theme-search relative flex-1">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση θέματος…"
            />
          </div>
          <p className="text-xs font-semibold text-[#6e6e73] tabular-nums shrink-0">
            {themes.length}/{HOMEPAGE_THEMES.length}
          </p>
        </div>

        <div className="pdw-theme-chips">
          {THEME_CATEGORIES.map((cat) => {
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

      {active && (
        <div className="pdw-theme-active">
          <div className="pdw-theme-active__preview">
            <ThemeMiniPreview theme={active} selected />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">Ενεργό</p>
            <p className="font-bold text-[#1d1d1f] truncate text-base">{active.nameEl}</p>
            <p className="text-xs text-[#6e6e73] truncate mt-0.5">{active.mood || active.description}</p>
          </div>
          <div className="hidden sm:flex gap-1.5 shrink-0">
            {[active.palette.primary, active.palette.secondary, active.palette.hero].map((c) => (
              <span
                key={c}
                className="h-5 w-5 rounded-full border border-black/10 shadow-sm"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="pdw-theme-grid">
        {themes.map((theme) => {
          const selected = theme.id === activeThemeId;
          return (
            <article
              key={theme.id}
              className={`pdw-theme-card group${selected ? ' is-selected' : ''}`}
            >
              <button type="button" className="w-full text-left" onClick={() => onPreview(theme)}>
                <ThemeMiniPreview theme={theme} selected={selected} />
                <div className="mt-2.5 px-0.5">
                  <p className="font-bold text-sm text-[#1d1d1f] leading-snug truncate">{theme.nameEl}</p>
                  {theme.badge ? (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#5e5ce6] mt-0.5">
                      {theme.badge}
                    </p>
                  ) : null}
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
                className={`pdw-theme-apply${selected ? ' is-active' : ''}`}
              >
                {selected ? 'Ενεργό' : applying ? '…' : 'Εφαρμογή'}
              </button>
            </article>
          );
        })}
      </div>

      {themes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[rgba(0,0,0,0.08)] py-12 text-center bg-white/60">
          <p className="text-sm font-bold text-[#1d1d1f]">Κανένα αποτέλεσμα</p>
          <button
            type="button"
            onClick={() => {
              setCategory('all');
              setQuery('');
            }}
            className="mt-2 text-xs font-bold text-[#0071e3] hover:underline"
          >
            Καθαρισμός φίλτρων
          </button>
        </div>
      )}
    </div>
  );
}
