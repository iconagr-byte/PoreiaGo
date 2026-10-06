import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  RENT_THEMES,
  RENT_THEME_CATEGORIES,
  filterRentThemes,
  getRentThemeById,
} from '../../../lib/rental/rentThemes.js';
import RentThemeMiniPreview from './RentThemeMiniPreview.jsx';

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', icon: 'desktop_windows', width: '100%' },
  { id: 'tablet', label: 'Tablet', icon: 'tablet_mac', width: '768px' },
  { id: 'phone', label: 'Mobile', icon: 'smartphone', width: '390px' },
];

/**
 * ThemeForest-style full-window live preview of /rent.
 * Top chrome + iframe — click inside the page navigates the real storefront.
 */
function RentThemeForestPreview({
  theme,
  themes = [],
  activeThemeId,
  includeColors,
  applying,
  onClose,
  onApply,
  onPreview,
  onSelectTheme,
}) {
  const [viewport, setViewport] = useState('desktop');
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const vp = VIEWPORTS.find((v) => v.id === viewport) || VIEWPORTS[0];
  const isActive = theme.id === activeThemeId;
  const idx = Math.max(0, themes.findIndex((t) => t.id === theme.id));
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < themes.length - 1;

  useEffect(() => {
    onPreview?.(theme, { includeColors });
    setLoading(true);
    setFrameKey((k) => k + 1);
  }, [theme.id, includeColors]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft' && hasPrev) onSelectTheme?.(themes[idx - 1]);
      if (e.key === 'ArrowRight' && hasNext) onSelectTheme?.(themes[idx + 1]);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onSelectTheme, themes, idx, hasPrev, hasNext]);

  const liveHref = `/rent?preview=1&theme=${encodeURIComponent(theme.id)}`;

  const ui = (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-[#0b0b0f]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rent-tf-preview-title"
    >
      {/* ThemeForest-style top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#14141a] px-2 py-2 text-white sm:gap-3 sm:px-4 sm:py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          <span className="hidden sm:inline">Πίσω στη λίστα</span>
        </button>

        <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/10 p-0.5">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelectTheme?.(themes[idx - 1])}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 disabled:opacity-30"
            aria-label="Προηγούμενο θέμα"
            title="← Προηγούμενο"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => hasNext && onSelectTheme?.(themes[idx + 1])}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 disabled:opacity-30"
            aria-label="Επόμενο θέμα"
            title="Επόμενο →"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-300/80">
            Live preview /rent · ThemeForest
          </p>
          <h2 id="rent-tf-preview-title" className="truncate text-sm font-bold sm:text-base">
            {theme.nameEl}
            <span className="ml-2 font-normal text-white/45">
              {idx + 1}/{themes.length || 1}
            </span>
          </h2>
        </div>

        <div className="inline-flex rounded-xl bg-white/10 p-0.5">
          {VIEWPORTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setViewport(v.id)}
              title={v.label}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                viewport === v.id
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{v.icon}</span>
              <span className="hidden md:inline">{v.label}</span>
            </button>
          ))}
        </div>

        <a
          href={liveHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-2 text-xs font-bold text-white/90 hover:bg-white/10"
          title="Άνοιγμα σε νέο παράθυρο"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          <span className="hidden sm:inline">Νέο παράθυρο</span>
        </a>

        <button
          type="button"
          disabled={applying || isActive}
          onClick={async () => {
            await onApply?.(theme, { includeColors });
            onClose?.();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-400 disabled:opacity-50 sm:text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">check</span>
          {isActive ? 'Ενεργό' : includeColors ? 'Εφαρμογή' : 'Εφαρμογή διάταξης'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Κλείσιμο"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>
      </header>

      {/* Full-page iframe stage — real /rent, clickable */}
      <div className="relative flex min-h-0 flex-1 items-stretch justify-center bg-[#0b0b0f]">
        {loading ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#0b0b0f]/70">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
              <span className="material-symbols-outlined animate-spin text-[20px]">
                progress_activity
              </span>
              Φόρτωση πλήρους σελίδας…
            </span>
          </div>
        ) : null}
        <div
          className="relative h-full overflow-hidden bg-white transition-[width] duration-300 ease-out"
          style={{
            width: vp.width,
            maxWidth: '100%',
            borderRadius: viewport === 'desktop' ? 0 : 16,
            boxShadow:
              viewport === 'desktop'
                ? 'none'
                : '0 0 0 1px rgba(255,255,255,0.08), 0 24px 80px rgba(0,0,0,0.55)',
            margin: viewport === 'desktop' ? 0 : '12px auto',
            height: viewport === 'desktop' ? '100%' : 'calc(100% - 24px)',
          }}
        >
          <iframe
            key={`${theme.id}-${frameKey}`}
            title={`Preview ${theme.nameEl}`}
            src={`/rent?preview=1&theme=${encodeURIComponent(theme.id)}&t=${frameKey}`}
            className="h-full w-full border-0 bg-white"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(ui, document.body);
}

/**
 * Rent full-page theme gallery — ThemeForest-style live preview on click.
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
    // Push draft first (parent handler), then unfold full window.
    onPreview?.(theme, { includeColors });
    setPreviewTheme(theme);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-teal-600/15 bg-teal-50/80 px-4 py-3 text-sm text-slate-900">
        <p className="font-bold">1. Επίλεξε πλήρη σελίδα /rent</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
          Κάθε θέμα αλλάζει hero, διάταξη στόλου και στυλ καρτών — όχι μόνο χρώμα. Μετά μπορείς να
          ρυθμίσεις τα χρώματα από κάτω.
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800">
          <span className="material-symbols-outlined text-[15px]">open_in_full</span>
          Κλικ στο θέμα → ανοίγει πλήρες παράθυρο όπως ThemeForest (ζωντανό /rent)
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
            onClick={() => openPreview(active)}
            title="Άνοιγμα πλήρους preview"
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
              Άνοιγμα πλήρους σελίδας →
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
              title="Κλικ για πλήρες preview σελίδας"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => openPreview(theme)}
                onDoubleClick={(e) => {
                  e.preventDefault();
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
        <RentThemeForestPreview
          theme={previewTheme}
          themes={themes.length ? themes : RENT_THEMES}
          activeThemeId={activeThemeId}
          includeColors={includeColors}
          applying={applying}
          onClose={() => setPreviewTheme(null)}
          onApply={onApply}
          onPreview={onPreview}
          onSelectTheme={setPreviewTheme}
        />
      ) : null}
    </div>
  );
}
