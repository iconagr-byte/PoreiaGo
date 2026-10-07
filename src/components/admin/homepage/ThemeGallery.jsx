import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  HOMEPAGE_THEMES,
  THEME_CATEGORIES,
  filterThemes,
  getHomepageThemeById,
} from '../../../lib/homepage/homepageThemes.js';
import ThemeMiniPreview from './ThemeMiniPreview.jsx';

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', icon: 'desktop_windows', width: '100%' },
  { id: 'tablet', label: 'Tablet', icon: 'tablet_mac', width: '768px' },
  { id: 'phone', label: 'Mobile', icon: 'smartphone', width: '390px' },
];

/**
 * Full-window live preview of the office storefront — same UX as /rent themes.
 */
function HomepageThemeLivePreview({
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

  const liveHref = `/storefront?preview=1&theme=${encodeURIComponent(theme.id)}`;

  const ui = (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-[#0b0b0f]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-live-preview-title"
    >
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
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300/80">
            Ζωντανή προεπισκόπηση αρχικής
          </p>
          <h2 id="home-live-preview-title" className="truncate text-sm font-bold sm:text-base">
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0071e3] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0077ed] disabled:opacity-50 sm:text-sm"
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
            src={`/storefront?preview=1&theme=${encodeURIComponent(theme.id)}&t=${frameKey}`}
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
 * Homepage theme gallery — live full-page preview like /rent themes.
 * Applies LAYOUT only by default; optional checkbox applies suggested palette.
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
  const [previewTheme, setPreviewTheme] = useState(null);

  const themes = useMemo(() => filterThemes({ category, query }), [category, query]);
  const active = getHomepageThemeById(activeThemeId);

  const openPreview = (theme) => {
    onPreview?.(theme, { includeColors });
    setPreviewTheme(theme);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#0071e3]/15 bg-[#0071e3]/[0.06] px-4 py-3 text-sm text-[#1d1d1f]">
        <p className="font-bold">1. Επίλεξε διάταξη</p>
        <p className="text-xs text-[#6e6e73] mt-0.5 leading-relaxed">
          Κάθε θέμα αλλάζει header, hero, κάρτες και footer — όχι απαραίτητα τα χρώματα. Τα χρώματα τα
          ρυθμίζεις μετά στα <span className="font-semibold">Γενικά</span>.
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0071e3]">
          <span className="material-symbols-outlined text-[15px]">visibility</span>
          Επισκόπηση = ζωντανή αρχική · Ενεργοποίηση = αποθήκευση θέματος
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
          <button
            type="button"
            className="pdw-theme-active__preview text-left"
            onClick={() => openPreview(active)}
            title="Άνοιγμα πλήρους preview"
          >
            <ThemeMiniPreview theme={active} selected />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">Ενεργό</p>
            <p className="font-bold text-[#1d1d1f] truncate text-base">{active.nameEl}</p>
            <p className="text-xs text-[#6e6e73] truncate mt-0.5">
              {active.layoutLabel || active.mood || active.description}
            </p>
            <button
              type="button"
              onClick={() => openPreview(active)}
              className="mt-2 text-xs font-bold text-[#0071e3] hover:underline"
            >
              Άνοιγμα πλήρους σελίδας →
            </button>
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
                onClick={() => openPreview(theme)}
                title="Επισκόπηση πλήρους σελίδας"
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

              <div className="pdw-theme-actions">
                <button
                  type="button"
                  onClick={() => openPreview(theme)}
                  className="pdw-theme-btn pdw-theme-btn--preview"
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    visibility
                  </span>
                  Επισκόπηση
                </button>
                <button
                  type="button"
                  disabled={applying || selected}
                  onClick={() => onApply?.(theme, { includeColors })}
                  className={`pdw-theme-btn pdw-theme-btn--activate${selected ? ' is-active' : ''}`}
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    {selected ? 'check_circle' : 'bolt'}
                  </span>
                  {selected ? 'Ενεργό' : applying ? '…' : 'Ενεργοποίηση'}
                </button>
              </div>
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

      {previewTheme ? (
        <HomepageThemeLivePreview
          theme={previewTheme}
          themes={themes.length ? themes : HOMEPAGE_THEMES}
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
