import { useMemo, useState } from 'react';
import {
  HOMEPAGE_THEMES,
  THEME_CATEGORIES,
  filterThemes,
  getHomepageThemeById,
} from '../../../lib/homepage/homepageThemes.js';
import {
  FOOTER_TEMPLATES,
  HEADER_TEMPLATES,
  HERO_TEMPLATES,
  TRIP_CARD_TEMPLATES,
  TRIPS_LAYOUT_TEMPLATES,
  getTemplateById,
} from '../../../lib/homepage/homepageTemplates.js';
import ThemeMiniPreview from './ThemeMiniPreview.jsx';

function tplLabel(list, id) {
  return getTemplateById(list, id)?.label || id;
}

function CompositionChips({ theme }) {
  const chips = [
    { label: tplLabel(HEADER_TEMPLATES, theme.header_template), icon: 'web_asset' },
    { label: tplLabel(HERO_TEMPLATES, theme.hero_template), icon: 'panorama' },
    { label: tplLabel(TRIPS_LAYOUT_TEMPLATES, theme.trips_layout_template), icon: 'grid_view' },
    { label: tplLabel(TRIP_CARD_TEMPLATES, theme.trip_card_template), icon: 'style' },
    { label: tplLabel(FOOTER_TEMPLATES, theme.footer_template), icon: 'vertical_align_bottom' },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c.label}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-100/90 text-slate-600 px-2 py-0.5 text-[10px] font-semibold"
        >
          <span className="material-symbols-outlined text-[12px] opacity-70">{c.icon}</span>
          {c.label}
        </span>
      ))}
    </div>
  );
}

export default function ThemeGallery({ activeThemeId, onPreview, onApply, applying = false }) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [hoverId, setHoverId] = useState(null);

  const themes = useMemo(() => filterThemes({ category, query }), [category, query]);
  const active = getHomepageThemeById(activeThemeId);
  const focusTheme = getHomepageThemeById(hoverId || activeThemeId);

  return (
    <div className="space-y-7">
      {/* Intro */}
      <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse at 20% 20%, ${active.palette.primary}66, transparent 50%), radial-gradient(ellipse at 80% 10%, ${active.palette.secondary}55, transparent 45%)`,
          }}
        />
        <div className="relative z-10 grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300/90 mb-2">
              Theme system
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              20 πλήρη θέματα · ένα μοτίβο πλατφόρμας
            </h3>
            <p className="mt-2 text-sm text-slate-300 max-w-xl leading-relaxed">
              Κάθε θέμα είναι διαφορετικό πακέτο — χρώματα, header, hero, κάρτες και footer —
              πάνω στα ίδια υποστηριζόμενα templates. Προεπισκόπηση άμεσα, εφαρμογή με ένα κλικ.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-200">
              <span className="rounded-full bg-white/10 px-3 py-1 border border-white/10">6 headers</span>
              <span className="rounded-full bg-white/10 px-3 py-1 border border-white/10">6 heroes</span>
              <span className="rounded-full bg-white/10 px-3 py-1 border border-white/10">6 layouts</span>
              <span className="rounded-full bg-white/10 px-3 py-1 border border-white/10">7 κάρτες</span>
              <span className="rounded-full bg-white/10 px-3 py-1 border border-white/10">6 footers</span>
            </div>
          </div>
          <div className="hidden sm:block max-w-xs ml-auto w-full">
            <ThemeMiniPreview theme={focusTheme} selected size="hero" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση θέματος, mood ή layout…"
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-black/[0.08] bg-white text-sm shadow-sm focus:ring-2 focus:ring-sky-500/25 focus:border-sky-400/40 outline-none"
            />
          </div>
          <p className="text-xs text-slate-500 font-semibold tabular-nums">
            {themes.length} / {HOMEPAGE_THEMES.length} θέματα
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {THEME_CATEGORIES.map((cat) => {
            const on = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                  on
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                    : 'bg-white text-slate-600 border border-black/[0.07] hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active theme spotlight */}
      {active && (
        <div
          className="rounded-[24px] border border-black/[0.06] overflow-hidden bg-white shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${active.palette.surface}, #fff 55%)`,
          }}
        >
          <div className="grid md:grid-cols-[140px_1fr_auto] gap-5 p-5 items-center">
            <div className="w-[120px] mx-auto md:mx-0">
              <ThemeMiniPreview theme={active} selected />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600">
                  Ενεργό θέμα
                </span>
                {active.badge && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                    style={{ background: active.palette.primary }}
                  >
                    {active.badge}
                  </span>
                )}
              </div>
              <h4 className="text-xl font-bold text-slate-900 leading-tight">{active.nameEl}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">{active.description}</p>
              {active.mood && <p className="text-xs font-semibold text-slate-400">{active.mood}</p>}
              <CompositionChips theme={active} />
            </div>
            <div className="flex md:flex-col gap-2 justify-self-start md:justify-self-end">
              <button
                type="button"
                onClick={() => onPreview(active)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-black/[0.08] bg-white hover:bg-slate-50"
              >
                Ανανέωση preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
        {themes.map((theme) => {
          const selected = theme.id === activeThemeId;
          return (
            <article
              key={theme.id}
              onMouseEnter={() => setHoverId(theme.id)}
              onMouseLeave={() => setHoverId(null)}
              className={`group relative flex flex-col rounded-[24px] border bg-white p-3.5 transition-all duration-300 ${
                selected
                  ? 'border-slate-900 shadow-xl shadow-slate-900/10'
                  : 'border-black/[0.06] hover:border-slate-300 hover:shadow-lg'
              }`}
            >
              <button type="button" className="w-full text-left" onClick={() => onPreview(theme)}>
                <ThemeMiniPreview theme={theme} selected={selected} />
                <div className="mt-3.5 space-y-1.5 px-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[15px] text-slate-900 leading-tight truncate">
                        {theme.nameEl}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{theme.name}</p>
                    </div>
                    {theme.badge && (
                      <span
                        className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                        style={{ background: theme.palette.primary }}
                      >
                        {theme.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{theme.description}</p>
                  <div className="flex gap-1 pt-1">
                    {[theme.palette.primary, theme.palette.secondary, theme.palette.hero, theme.palette.surface].map(
                      (c, i) => (
                        <span
                          key={`${theme.id}-sw-${i}`}
                          className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-sm"
                          style={{ background: c }}
                        />
                      ),
                    )}
                  </div>
                </div>
              </button>

              <div className="mt-auto pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onPreview(theme)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-black/[0.08] text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Προεπισκόπηση
                </button>
                <button
                  type="button"
                  disabled={applying || selected}
                  onClick={() => onApply(theme)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 ${
                    selected
                      ? 'bg-slate-900 text-white'
                      : 'bg-sky-600 text-white hover:bg-sky-500 shadow-sm shadow-sky-600/20'
                  }`}
                >
                  {selected ? 'Ενεργό' : applying ? '…' : 'Εφαρμογή'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {themes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
          <p className="font-bold text-slate-700">Κανένα θέμα δεν ταιριάζει</p>
          <p className="text-sm text-slate-500 mt-1">Δοκιμάστε άλλη κατηγορία ή καθαρίστε την αναζήτηση.</p>
          <button
            type="button"
            onClick={() => {
              setCategory('all');
              setQuery('');
            }}
            className="mt-4 text-xs font-bold text-sky-600 hover:underline"
          >
            Εμφάνιση όλων
          </button>
        </div>
      )}
    </div>
  );
}
