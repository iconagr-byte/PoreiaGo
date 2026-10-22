import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getHomepageThemeById,
  getSelectableHomepageThemes,
} from '../../../lib/homepage/homepageThemes.js';
import ThemeMiniPreview from './ThemeMiniPreview.jsx';

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', icon: 'desktop_windows', width: '100%' },
  { id: 'tablet', label: 'Tablet', icon: 'tablet_mac', width: '768px' },
  { id: 'phone', label: 'Mobile', icon: 'smartphone', width: '390px' },
];

/**
 * Full-window live preview of the office storefront.
 * Kept for the active (saved) theme — not for browsing the retired gallery.
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
  const canBrowse = themes.length > 1;

  useEffect(() => {
    onPreview?.(theme, { includeColors });
    setLoading(true);
    setFrameKey((k) => k + 1);
  }, [theme.id, includeColors]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (canBrowse && e.key === 'ArrowLeft' && hasPrev) onSelectTheme?.(themes[idx - 1]);
      if (canBrowse && e.key === 'ArrowRight' && hasNext) onSelectTheme?.(themes[idx + 1]);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onSelectTheme, themes, idx, hasPrev, hasNext, canBrowse]);

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
          <span className="hidden sm:inline">Πίσω</span>
        </button>

        {canBrowse ? (
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
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300/80">
            Ζωντανή προεπισκόπηση αρχικής
          </p>
          <h2 id="home-live-preview-title" className="truncate text-sm font-bold sm:text-base">
            {theme.nameEl}
            {canBrowse ? (
              <span className="ml-2 font-normal text-white/45">
                {idx + 1}/{themes.length}
              </span>
            ) : null}
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

function ThemePickerDrawer({
  open,
  onClose,
  selectableThemes,
  activeThemeId,
  includeColors,
  applying,
  onApply,
  onOpenPreview,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const hasChoices = selectableThemes.length > 0;

  const ui = (
    <div className="fixed inset-0 z-[1900] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Κλείσιμο"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pdw-theme-drawer relative z-10 flex max-h-[min(88vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-black/[0.08] bg-white shadow-2xl sm:mx-4 sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-black/[0.06] px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-[#1d1d1f]">
              Επιλογή θέματος
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-[#6e6e73]">
              Σύντομα θα προστεθούν θέματα από demo ιστοσελίδες. Το ενεργό θέμα παραμένει αποθηκευμένο.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#6e6e73] hover:bg-black/[0.04] hover:text-[#1d1d1f]"
            aria-label="Κλείσιμο"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {hasChoices ? (
            <div className="pdw-theme-thumb-row" role="list">
              {selectableThemes.map((theme) => {
                const selected = theme.id === activeThemeId;
                return (
                  <article
                    key={theme.id}
                    role="listitem"
                    className={`pdw-theme-thumb${selected ? ' is-selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onOpenPreview?.(theme)}
                      title="Προεπισκόπηση"
                    >
                      <ThemeMiniPreview theme={theme} selected={selected} />
                      <p className="mt-1.5 truncate text-[11px] font-bold text-[#1d1d1f]">
                        {theme.nameEl}
                      </p>
                      <p className="truncate text-[10px] text-[#6e6e73]">
                        {theme.layoutLabel || theme.mood || ''}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={applying || selected}
                      onClick={() => onApply?.(theme, { includeColors })}
                      className={`pdw-theme-thumb__apply${selected ? ' is-active' : ''}`}
                    >
                      {selected ? 'Ενεργό' : applying ? '…' : 'Εφαρμογή'}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="pdw-theme-waiting">
              <span className="material-symbols-outlined pdw-theme-waiting__icon" aria-hidden>
                web_asset
              </span>
              <p className="text-sm font-bold text-[#1d1d1f]">Θέματα από demos — σύντομα</p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#6e6e73]">
                Θα αντιγράψουμε εμφάνιση από demo ιστοσελίδες που θα μας στείλετε και θα εμφανιστούν
                εδώ ως συμπαγής επιλογή — χωρίς μακρύ κατεβατό καρτών.
              </p>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-black/[0.06] px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-xs font-bold text-[#1d1d1f] hover:bg-black/[0.04]"
          >
            Κλείσιμο
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}

/**
 * Discreet homepage Themes panel — active strip + compact picker drawer.
 * Old long card gallery retired; selectable catalog is empty until demo themes arrive.
 * Saved theme id / apply plumbing stay intact via getHomepageThemeById + onApply.
 */
export default function ThemeGallery({
  activeThemeId,
  onPreview,
  onApply,
  applying = false,
}) {
  const [includeColors, setIncludeColors] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState(null);

  const active = getHomepageThemeById(activeThemeId);
  const selectableThemes = getSelectableHomepageThemes();
  const previewThemes =
    selectableThemes.length > 0
      ? selectableThemes
      : active
        ? [active]
        : [];

  const openPreview = (theme) => {
    onPreview?.(theme, { includeColors });
    setPreviewTheme(theme);
    setPickerOpen(false);
  };

  return (
    <div className="pdw-theme-discreet space-y-3">
      {active ? (
        <div className="pdw-theme-active pdw-theme-active--compact">
          <button
            type="button"
            className="pdw-theme-active__preview text-left"
            onClick={() => openPreview(active)}
            title="Άνοιγμα προεπισκόπησης"
          >
            <ThemeMiniPreview theme={active} selected />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">Ενεργό</p>
            <p className="truncate text-sm font-bold text-[#1d1d1f]">{active.nameEl}</p>
            <p className="mt-0.5 truncate text-[11px] text-[#6e6e73]">
              {active.layoutLabel || active.mood || active.description}
            </p>
            <button
              type="button"
              onClick={() => openPreview(active)}
              className="mt-1.5 text-[11px] font-bold text-[#0071e3] hover:underline"
            >
              Άνοιγμα προεπισκόπησης →
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="pdw-theme-pick-btn shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              palette
            </span>
            Επιλογή θέματος
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-black/[0.08] bg-white/80 px-4 py-4 text-center">
          <p className="text-sm font-bold text-[#1d1d1f]">Κανένα ενεργό θέμα</p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="pdw-theme-pick-btn mt-3 inline-flex"
          >
            Επιλογή θέματος
          </button>
        </div>
      )}

      <label className="pdw-theme-colors-line">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
          checked={includeColors}
          onChange={(e) => setIncludeColors(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="text-xs font-semibold text-[#1d1d1f]">Εφαρμογή προτεινόμενων χρωμάτων</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-[#6e6e73]">
            Off = μόνο διάταξη · τα brand χρώματα μένουν όπως είναι.
          </span>
        </span>
      </label>

      {!active ? null : (
        <p className="px-0.5 text-[11px] leading-relaxed text-[#86868b]">
          Νέα θέματα από demo ιστοσελίδες θα εμφανιστούν στο «Επιλογή θέματος» — χωρίς μακρύ κατεβατό.
        </p>
      )}

      <ThemePickerDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectableThemes={selectableThemes}
        activeThemeId={activeThemeId}
        includeColors={includeColors}
        applying={applying}
        onApply={async (theme, opts) => {
          await onApply?.(theme, opts);
          setPickerOpen(false);
        }}
        onOpenPreview={openPreview}
      />

      {previewTheme ? (
        <HomepageThemeLivePreview
          theme={previewTheme}
          themes={previewThemes}
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
