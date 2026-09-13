import { useMemo, useState } from 'react';
import {
  HOMEPAGE_THEMES,
  THEME_CATEGORIES,
  filterThemes,
  getHomepageThemeById,
} from '../../../lib/homepage/homepageThemes.js';
import ThemeMiniPreview from './ThemeMiniPreview.jsx';

/**
 * Theme gallery — applies LAYOUT only by default.
 * Colors stay in Γενικά (BrandColorEditor); optional checkbox applies suggested palette.
 */
export default function ThemeGallery({
  activeThemeId,
  onPreview,
  onApply,
  applying = false,
}) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [includeColors, setIncludeColors] = useState(false);

  const themes = useMemo(() => filterThemes({ category, query }), [category, query]);
  const active = getHomepageThemeById(activeThemeId);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#0071e3]/15 bg-[#0071e3]/[0.06] px-4 py-3 text-sm text-[#1d1d1f]">
        <p className="font-bold">1. Επίλεξε διάταξη</p>
        <p className="text-xs text-[#6e6e73] mt-0.5 leading-relaxed">
          Κάθε θέμα αλλάζει header, hero, κάρτες και footer — όχι απαραίτητα τα χρώματα. Τα χρώματα τα
          ρυθμίζεις μετά στα <span className="font-semibold">Γενικά</span>.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="pdw-theme-search relative flex-1">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση θέματος ή διάταξης…"
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

      <label className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
          checked={includeColors}
          onChange={(e) => setIncludeColors(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-bold text-[#1d1d1f]">Και τα προτεινόμενα χρώματα</span>
          <span className="block text-xs text-[#6e6e73] mt-0.5">
            Αν είναι off, κρατάς τα τρέχοντα brand χρώματα και αλλάζει μόνο η διάταξη.
          </span>
        </span>
      </label>

      {active && (
        <div className="pdw-theme-active">
          <div className="pdw-theme-active__preview">
            <ThemeMiniPreview theme={active} selected />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">Ενεργό</p>
            <p className="font-bold text-[#1d1d1f] truncate text-base">{active.nameEl}</p>
            <p className="text-xs text-[#6e6e73] truncate mt-0.5">
              {active.layoutLabel || active.mood || active.description}
            </p>
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
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onPreview?.(theme, { includeColors })}
              >
                <ThemeMiniPreview theme={theme} selected={selected} />
                <div className="mt-2.5 px-0.5">
                  <p className="font-bold text-sm text-[#1d1d1f] leading-snug truncate">{theme.nameEl}</p>
                  <p className="text-[11px] text-[#6e6e73] truncate mt-0.5">
                    {theme.layoutLabel || theme.mood}
                  </p>
                  {theme.badge ? (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#5e5ce6] mt-0.5">
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
                {selected ? 'Ενεργό' : applying ? '…' : includeColors ? 'Διάταξη + χρώματα' : 'Εφαρμογή διάταξης'}
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
