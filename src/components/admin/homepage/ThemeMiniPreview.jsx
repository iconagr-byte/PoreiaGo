import TemplatePreviewThumb from './TemplatePreviewThumb.jsx';

/** Μiniature full-page mockup για κάρτα θέματος. */
export default function ThemeMiniPreview({ theme, selected = false }) {
  const { palette } = theme;
  return (
    <div
      className={`relative w-full aspect-[10/14] rounded-2xl overflow-hidden border-2 shadow-lg transition-all ${
        selected ? 'border-primary ring-4 ring-primary/20 scale-[1.02]' : 'border-black/[0.08]'
      }`}
      style={{ background: palette.surface }}
    >
      {/* Header strip */}
      <div
        className="h-[9%] flex items-center px-2 gap-1 border-b border-black/5"
        style={{
          background:
            theme.header_template === 'glass_dark' || theme.header_template === 'gradient_bar'
              ? palette.hero
              : '#fff',
        }}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: palette.primary }} />
        <div className="flex-1 h-1 rounded" style={{ background: `${palette.secondary}44` }} />
      </div>

      {/* Hero */}
      <div
        className="h-[32%] relative p-2 flex flex-col justify-end"
        style={{
          background:
            theme.hero_template === 'gradient_mesh'
              ? `linear-gradient(135deg, ${palette.primary}88, ${palette.secondary}88)`
              : `linear-gradient(to top, ${palette.hero}ee, ${palette.hero}66)`,
        }}
      >
        {theme.hero_template === 'split_left' && (
          <div className="absolute right-0 top-0 w-1/2 h-full bg-white/20" />
        )}
        <div className="h-1.5 w-3/4 rounded bg-white/90 mb-1" />
        <div className="h-1 w-1/2 rounded bg-white/60 mb-2" />
        <div className="h-4 w-full rounded-lg bg-white/25 border border-white/30" />
      </div>

      {/* Trips section */}
      <div className="h-[44%] p-2 space-y-1.5" style={{ background: palette.surface }}>
        <div className="h-1 w-1/3 rounded mx-auto mb-1" style={{ background: palette.primary }} />
        <div
          className={
            theme.trips_layout_template === 'horizontal_scroll'
              ? 'flex gap-1 overflow-hidden'
              : theme.trips_layout_template === 'compact_list'
                ? 'space-y-1'
                : 'grid grid-cols-2 gap-1'
          }
        >
          {[1, 2, 3, 4].slice(0, theme.trips_layout_template === 'grid_two_large' ? 2 : 4).map((n) => (
            <div
              key={n}
              className={`rounded-md overflow-hidden border border-black/5 bg-white ${
                theme.trips_layout_template === 'horizontal_scroll' ? 'shrink-0 w-[42%]' : ''
              }`}
            >
              <div className="h-5" style={{ background: `${palette.secondary}33` }} />
              <div className="p-1 space-y-0.5">
                <div className="h-0.5 w-full bg-slate-200 rounded" />
                <div className="h-1.5 w-2/3 rounded-full" style={{ background: palette.primary }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="h-[15%] border-t border-black/5 flex items-center justify-center gap-1 px-2"
        style={{
          background: theme.footer_template === 'dark_band' ? palette.hero : `${palette.secondary}11`,
        }}
      >
        <div className="h-0.5 w-1/4 rounded bg-slate-300" />
        <div className="h-0.5 w-1/4 rounded bg-slate-300" />
      </div>

      {/* Palette dots */}
      <div className="absolute top-2 right-2 flex gap-0.5">
        <span className="w-2 h-2 rounded-full border border-white/50" style={{ background: palette.primary }} />
        <span className="w-2 h-2 rounded-full border border-white/50" style={{ background: palette.secondary }} />
      </div>
    </div>
  );
}

export function ThemeThumbStrip({ theme }) {
  return (
    <div className="grid grid-cols-3 gap-1 mt-2 opacity-80">
      <TemplatePreviewThumb category="header" templateId={theme.header_template} />
      <TemplatePreviewThumb category="hero" templateId={theme.hero_template} />
      <TemplatePreviewThumb category="trip_card" templateId={theme.trip_card_template} />
    </div>
  );
}
