import { useMemo, useState } from 'react';
import {
  RENT_PAGE_THEMES,
  RENT_THEME_CATEGORIES,
  filterRentThemes,
  getRentPageThemeById,
} from '../../../lib/homepage/rentPageThemes.js';

function RentThemeThumb({ theme, selected }) {
  const p = theme.palette || {};
  const layout = theme.rent_fleet_layout_template || '';
  const isScroll = layout.includes('scroll');
  const isList = layout.includes('list');
  const isBento = layout.includes('bento');
  const isMag = layout.includes('magazine');
  const isDense = layout.includes('dense');
  const isTwo = layout.includes('two');
  const isFeat = layout.includes('featured');

  return (
    <div
      className={`rounded-2xl overflow-hidden border transition-shadow ${
        selected ? 'border-[#0071e3] shadow-[0_0_0_2px_rgba(0,113,227,0.25)]' : 'border-black/[0.08]'
      }`}
      style={{
        background: p.surface || '#f5f5f7',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div className="h-2" style={{ background: p.primary || '#0071e3' }} />
      <div className="p-2.5 space-y-1.5">
        <div className="h-1.5 w-1/3 rounded-full" style={{ background: `${p.primary || '#0071e3'}55` }} />
        <div className="h-2 w-2/3 rounded" style={{ background: p.secondary || '#1d1d1f' }} />
        <div
          className={
            isScroll
              ? 'flex gap-1 overflow-hidden'
              : isList
                ? 'flex flex-col gap-1'
                : isBento
                  ? 'grid grid-cols-3 gap-1'
                  : isMag
                    ? 'flex flex-col gap-1'
                    : isDense
                      ? 'grid grid-cols-4 gap-0.5'
                      : isTwo || isFeat
                        ? 'grid grid-cols-2 gap-1'
                        : 'grid grid-cols-3 gap-1'
          }
        >
          {(isDense ? [0, 1, 2, 3] : isTwo ? [0, 1] : isMag || isList ? [0, 1] : [0, 1, 2]).map((i) => (
            <div
              key={i}
              className={`rounded-md ${
                isList ? 'h-3' : isMag ? 'h-8' : isBento && i === 0 ? 'col-span-2 row-span-2 h-10' : 'h-6'
              }`}
              style={{
                background:
                  i === 0
                    ? `linear-gradient(145deg, ${p.primary || '#0071e3'}88, ${p.secondary || '#1d1d1f'}66)`
                    : `${p.secondary || '#1d1d1f'}22`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Gallery for /rent themes — layout + card (+ optional copy/colors).
 * After apply, everything stays editable in Όνομα & κείμενα / Καρτέλες στόλου.
 */
export default function RentThemeGallery({
  activeThemeId,
  onPreview,
  onApply,
  applying = false,
}) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [includeColors, setIncludeColors] = useState(false);
  const [includeCopy, setIncludeCopy] = useState(true);

  const themes = useMemo(() => filterRentThemes({ category, query }), [category, query]);
  const active = getRentPageThemeById(activeThemeId);

  return (
    <div
      className="space-y-5"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
      }}
    >
      <div className="rounded-2xl border border-[#0071e3]/15 bg-[#0071e3]/[0.06] px-4 py-3 text-sm text-[#1d1d1f]">
        <p className="font-semibold tracking-tight">15 φρέσκα θέματα /rent</p>
        <p className="text-xs text-[#6e6e73] mt-0.5 leading-relaxed">
          Κάθε θέμα αλλάζει διάταξη στόλου + στυλ κάρτας (και προαιρετικά κείμενα/χρώματα). Μετά μπορείς
          να αλλάξεις ό,τι θέλεις χειροκίνητα — τίποτα δεν κλειδώνει.
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
              placeholder="Αναζήτηση θέματος /rent…"
            />
          </div>
          <p className="text-xs font-semibold text-[#6e6e73] tabular-nums shrink-0">
            {themes.length}/{RENT_PAGE_THEMES.length}
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

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
            checked={includeCopy}
            onChange={(e) => setIncludeCopy(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-bold text-[#1d1d1f]">Και τα κείμενα hero</span>
            <span className="block text-xs text-[#6e6e73] mt-0.5">
              Τίτλος, περιγραφή και κουμπί από το θέμα (μπορείς να τα αλλάξεις μετά).
            </span>
          </span>
        </label>
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
              Αν είναι off, κρατάς τα τρέχοντα brand χρώματα.
            </span>
          </span>
        </label>
      </div>

      {active ? (
        <div className="pdw-theme-active">
          <div className="pdw-theme-active__preview w-28 shrink-0">
            <RentThemeThumb theme={active} selected />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">Ενεργό /rent</p>
            <p className="font-bold text-[#1d1d1f] truncate text-base tracking-tight">{active.nameEl}</p>
            <p className="text-xs text-[#6e6e73] truncate mt-0.5">{active.layoutLabel}</p>
          </div>
        </div>
      ) : null}

      <div className="pdw-theme-grid">
        {themes.map((theme) => {
          const selected = theme.id === (activeThemeId || active?.id);
          return (
            <article key={theme.id} className={`pdw-theme-card${selected ? ' is-active' : ''}`}>
              <RentThemeThumb theme={theme} selected={selected} />
              <div className="pdw-theme-card__body">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-[#1d1d1f] tracking-tight truncate">{theme.nameEl}</p>
                    <p className="text-[11px] text-[#6e6e73] mt-0.5 line-clamp-2">{theme.description}</p>
                  </div>
                  {theme.badge ? (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-black/[0.04] text-[#6e6e73]">
                      {theme.badge}
                    </span>
                  ) : null}
                </div>
                <p className="text-[10px] font-semibold text-[#86868b] mt-2">{theme.layoutLabel}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    className="pdw-theme-card__btn"
                    onClick={() => onPreview?.(theme, { includeColors, includeCopy })}
                  >
                    Δοκιμή
                  </button>
                  <button
                    type="button"
                    className="pdw-theme-card__btn is-primary"
                    disabled={applying}
                    onClick={() => onApply?.(theme, { includeColors, includeCopy })}
                  >
                    {selected ? 'Ενεργό' : 'Εφαρμογή'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
