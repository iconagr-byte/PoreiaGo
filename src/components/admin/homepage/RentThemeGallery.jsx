import { useEffect, useMemo, useState } from 'react';
import {
  RENT_THEMES,
  RENT_THEME_CATEGORIES,
  filterRentThemes,
  getRentThemeById,
} from '../../../lib/rental/rentThemes.js';
import RentThemeMiniPreview from './RentThemeMiniPreview.jsx';

/**
 * Rent full-page theme gallery — pick layout first, then tune colors below.
 * Double-click a card to open a full preview modal.
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
  const [previewTheme, setPreviewTheme] = useState(null);

  const themes = useMemo(() => filterRentThemes({ category, query }), [category, query]);
  const active = getRentThemeById(activeThemeId);

  const openPreview = (theme) => {
    setPreviewTheme(theme);
    onPreview?.(theme, { includeColors });
  };

  useEffect(() => {
    if (!previewTheme) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPreviewTheme(null);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [previewTheme]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-teal-600/15 bg-teal-50/80 px-4 py-3 text-sm text-slate-900">
        <p className="font-bold">1. Επίλεξε πλήρη σελίδα /rent</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
          Κάθε θέμα αλλάζει hero, διάταξη στόλου και στυλ καρτών — όχι μόνο χρώμα. Μετά μπορείς να
          ρυθμίσεις τα χρώματα από κάτω.
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800">
          <span className="material-symbols-outlined text-[15px]">ads_click</span>
          Διπλό κλικ σε κάρτα → πλήρες preview μέσα στο θέμα
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
          <button
            type="button"
            className="pdw-theme-active__preview text-left"
            onDoubleClick={() => openPreview(active)}
            title="Διπλό κλικ για πλήρες preview"
          >
            <RentThemeMiniPreview theme={active} selected />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ενεργό /rent</p>
            <p className="truncate text-base font-bold text-slate-900">{active.nameEl}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {active.layoutLabel || active.mood || active.description}
            </p>
            <button
              type="button"
              onClick={() => openPreview(active)}
              className="mt-2 text-xs font-bold text-teal-700 hover:underline"
            >
              Άνοιγμα preview →
            </button>
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
              onDoubleClick={(e) => {
                e.preventDefault();
                openPreview(theme);
              }}
              title="Διπλό κλικ για πλήρες preview"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onPreview?.(theme, { includeColors })}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openPreview(theme);
                }}
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

      {previewTheme ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rent-theme-preview-title"
          onClick={() => setPreviewTheme(null)}
        >
          <div
            className="flex max-h-[min(92dvh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.06] bg-slate-50/90 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700/80">
                  Preview θέματος /rent
                </p>
                <h3
                  id="rent-theme-preview-title"
                  className="mt-0.5 truncate text-lg font-bold text-slate-900"
                >
                  {previewTheme.nameEl}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {previewTheme.description || previewTheme.layoutLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTheme(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-white text-slate-600 hover:bg-slate-100"
                aria-label="Κλείσιμο preview"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-5 sm:px-8">
              <div className="mx-auto max-w-md">
                <RentThemeMiniPreview theme={previewTheme} selected size="lg" />
              </div>
              <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-2 text-[11px] text-slate-600 sm:grid-cols-4">
                {[
                  { label: 'Hero', value: previewTheme.rent_hero_style },
                  { label: 'Στόλος', value: previewTheme.rent_fleet_layout_template?.replace('rent_', '') },
                  { label: 'Κάρτα', value: previewTheme.rent_fleet_card_template?.replace('rent_', '') },
                  {
                    label: 'Header',
                    value: previewTheme.rent_header_compact ? 'Compact' : 'Άνετο',
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl border border-black/[0.05] bg-white px-2.5 py-2"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {row.label}
                    </p>
                    <p className="mt-0.5 truncate font-semibold capitalize text-slate-800">
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] bg-white px-5 py-4">
              <a
                href="/rent?preview=1"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-sm font-bold text-teal-900 hover:bg-teal-100"
                onClick={() => {
                  // Ensure draft is pushed with this theme before opening live /rent.
                  onPreview?.(previewTheme, { includeColors });
                }}
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                Ζωντανό /rent
              </a>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTheme(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Κλείσιμο
                </button>
                <button
                  type="button"
                  disabled={applying || previewTheme.id === activeThemeId}
                  onClick={async () => {
                    await onApply?.(previewTheme, { includeColors });
                    setPreviewTheme(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  {previewTheme.id === activeThemeId
                    ? 'Ήδη ενεργό'
                    : includeColors
                      ? 'Εφαρμογή + χρώματα'
                      : 'Εφαρμογή διάταξης'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
