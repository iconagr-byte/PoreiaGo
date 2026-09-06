/** Rich miniature page mockup — reflects header / hero / trips / footer templates. */

function headerBg(theme) {
  const { palette, header_template: h } = theme;
  if (h === 'glass_dark' || h === 'gradient_bar') return palette.hero;
  if (h === 'floating_pill') return 'transparent';
  return '#ffffff';
}

function heroBg(theme) {
  const { palette, hero_template: h } = theme;
  if (h === 'gradient_mesh') {
    return `linear-gradient(135deg, ${palette.primary}cc, ${palette.secondary}99 45%, ${palette.hero}ee)`;
  }
  if (h === 'card_inset') {
    return `linear-gradient(160deg, ${palette.surface}, ${palette.secondary}22)`;
  }
  return `linear-gradient(to top, ${palette.hero}f2, ${palette.hero}55)`;
}

function TripCards({ theme }) {
  const { palette, trips_layout_template: layout, trip_card_template: card } = theme;
  const count = layout === 'grid_two_large' ? 2 : layout === 'compact_list' ? 3 : 4;
  const items = Array.from({ length: count }, (_, i) => i);

  if (layout === 'compact_list') {
    return (
      <div className="space-y-1">
        {items.map((n) => (
          <div key={n} className="flex gap-1 rounded-md overflow-hidden bg-white/90 border border-black/5">
            <div className="w-5 shrink-0" style={{ background: `${palette.primary}55` }} />
            <div className="flex-1 py-1 pr-1 space-y-0.5">
              <div className="h-0.5 w-3/4 rounded bg-slate-200" />
              <div className="h-1 w-1/3 rounded-full" style={{ background: palette.primary }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'horizontal_scroll') {
    return (
      <div className="flex gap-1 overflow-hidden">
        {items.map((n) => (
          <div
            key={n}
            className={`shrink-0 w-[38%] rounded-md overflow-hidden border border-black/5 ${
              card === 'glass_card' ? 'bg-white/70' : 'bg-white'
            }`}
          >
            <div className="h-6" style={{ background: n % 2 ? `${palette.secondary}44` : `${palette.primary}55` }} />
            <div className="p-1 space-y-0.5">
              <div className="h-0.5 w-full rounded bg-slate-200" />
              <div className="h-1.5 w-2/3 rounded-full" style={{ background: palette.primary }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'alternating_rows') {
    return (
      <div className="space-y-1">
        {items.slice(0, 2).map((n) => (
          <div
            key={n}
            className={`flex gap-1 rounded-md overflow-hidden bg-white border border-black/5 ${
              n === 1 ? 'flex-row-reverse' : ''
            }`}
          >
            <div className="w-[42%] h-7" style={{ background: `${palette.secondary}40` }} />
            <div className="flex-1 p-1 flex flex-col justify-center gap-0.5">
              <div className="h-0.5 w-full rounded bg-slate-200" />
              <div className="h-1 w-1/2 rounded-full" style={{ background: palette.primary }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'masonry_two') {
    return (
      <div className="grid grid-cols-2 gap-1 items-start">
        {items.slice(0, 3).map((n) => (
          <div
            key={n}
            className={`rounded-md overflow-hidden border border-black/5 bg-white ${n === 0 ? 'row-span-2' : ''}`}
          >
            <div
              className={n === 0 ? 'h-10' : 'h-5'}
              style={{ background: n === 0 ? `${palette.primary}66` : `${palette.secondary}33` }}
            />
            <div className="p-1 space-y-0.5">
              <div className="h-0.5 w-full rounded bg-slate-200" />
              {card !== 'minimal_clean' && (
                <div className="h-1.5 w-2/3 rounded-full" style={{ background: palette.primary }} />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'destination_bento' || card === 'destination_poster') {
    const tiles = [0, 1, 2, 3, 4];
    return (
      <div className="grid grid-cols-6 grid-rows-2 gap-1">
        {tiles.map((n) => (
          <div
            key={n}
            className={`relative rounded-md overflow-hidden ${
              n <= 2 ? 'col-span-2 min-h-[22px]' : 'col-span-3 min-h-[18px]'
            }`}
            style={{
              background: `${n % 2 ? palette.secondary : palette.primary}${n <= 2 ? '99' : '77'}`,
            }}
          >
            <div className="absolute inset-x-0 bottom-0 p-0.5 bg-gradient-to-t from-black/70 to-transparent">
              <div className="h-0.5 w-2/3 rounded bg-white/90 mb-0.5" />
              <div className="flex justify-between gap-0.5">
                <div className="h-0.5 w-1/3 rounded bg-white/60" />
                <div className="h-0.5 w-1/4 rounded bg-white/80" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-1 ${layout === 'grid_two_large' ? 'grid-cols-2' : 'grid-cols-2'}`}>
      {items.map((n) => {
        const overlay = card === 'image_overlay' || card === 'destination_poster';
        return (
          <div
            key={n}
            className={`relative rounded-md overflow-hidden border border-black/5 ${
              card === 'bordered_sharp' ? 'rounded-none' : ''
            } ${card === 'glass_card' ? 'bg-white/60' : 'bg-white'}`}
          >
            <div
              className={layout === 'grid_two_large' ? 'h-8' : 'h-5'}
              style={{ background: `${n % 2 ? palette.secondary : palette.primary}44` }}
            />
            {overlay ? (
              <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/60 to-transparent">
                <div className="h-0.5 w-3/4 rounded bg-white/80 mb-0.5" />
                <div className="h-1 w-1/2 rounded-full" style={{ background: palette.primary }} />
              </div>
            ) : (
              <div className="p-1 space-y-0.5">
                <div className="h-0.5 w-full rounded bg-slate-200" />
                <div className="h-1.5 w-2/3 rounded-full" style={{ background: palette.primary }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ThemeMiniPreview({ theme, selected = false, size = 'card' }) {
  const { palette } = theme;
  const isDarkSurface = /^#([0-2][0-9a-f]{5})$/i.test(palette.surface);
  const floating = theme.header_template === 'floating_pill';
  const insetHero = theme.hero_template === 'card_inset';

  return (
    <div
      className={`relative w-full overflow-hidden transition-all duration-300 ${
        size === 'hero' ? 'aspect-[16/10] rounded-3xl' : 'aspect-[10/14] rounded-2xl'
      } ${
        selected
          ? 'ring-2 ring-offset-2 ring-slate-900 shadow-xl scale-[1.01]'
          : 'border border-black/[0.08] shadow-md group-hover:shadow-xl group-hover:-translate-y-0.5'
      }`}
      style={{ background: palette.surface }}
    >
      {/* Ambient wash */}
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl opacity-40"
        style={{ background: palette.primary }}
      />

      {/* Header */}
      <div
        className={`relative z-10 h-[10%] flex items-center px-2 gap-1 ${floating ? 'pt-1' : ''}`}
        style={{ background: floating ? 'transparent' : headerBg(theme) }}
      >
        <div
          className={`flex items-center gap-1 w-full ${
            floating ? 'rounded-full px-1.5 py-0.5 shadow-sm border border-black/5 bg-white/95' : ''
          }`}
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: palette.primary }} />
          <div
            className="flex-1 h-1 rounded"
            style={{
              background:
                theme.header_template === 'glass_dark' || theme.header_template === 'gradient_bar'
                  ? 'rgba(255,255,255,0.35)'
                  : `${palette.secondary}33`,
            }}
          />
          <div
            className="h-2 w-5 rounded-full shrink-0"
            style={{ background: palette.primary, opacity: 0.9 }}
          />
        </div>
      </div>

      {/* Hero */}
      <div
        className={`relative h-[30%] ${insetHero ? 'px-2 pb-1' : ''}`}
      >
        <div
          className={`h-full relative flex flex-col justify-end p-2 overflow-hidden ${
            insetHero ? 'rounded-xl shadow-md border border-black/5' : ''
          }`}
          style={{ background: heroBg(theme) }}
        >
          {theme.hero_template === 'split_left' && (
            <div className="absolute right-0 top-0 w-[46%] h-full bg-white/25 backdrop-blur-[1px]" />
          )}
          <div className="relative z-[1] space-y-1 max-w-[85%]">
            <div className="h-1.5 w-4/5 rounded-full bg-white/90" />
            <div className="h-1 w-1/2 rounded-full bg-white/55" />
            {(theme.hero_template === 'bottom_search' || theme.hero_template === 'fullscreen_overlay') && (
              <div className="mt-1 h-3.5 w-full rounded-lg bg-white/90 border border-white/40 shadow-sm" />
            )}
          </div>
        </div>
      </div>

      {/* Trips */}
      <div className="h-[45%] p-2 space-y-1.5" style={{ background: palette.surface }}>
        <div className="flex justify-center">
          <div className="h-1 w-1/3 rounded-full" style={{ background: palette.primary, opacity: 0.85 }} />
        </div>
        <TripCards theme={theme} />
      </div>

      {/* Footer */}
      <div
        className="h-[15%] border-t border-black/5 flex items-center justify-center gap-1.5 px-2"
        style={{
          background:
            theme.footer_template === 'dark_band'
              ? palette.hero
              : theme.footer_template === 'newsletter_cta'
                ? `${palette.primary}18`
                : isDarkSurface
                  ? `${palette.secondary}33`
                  : `${palette.secondary}10`,
        }}
      >
        {theme.footer_template === 'newsletter_cta' ? (
          <div className="h-2.5 w-3/5 rounded-full" style={{ background: palette.primary }} />
        ) : (
          <>
            <div
              className="h-0.5 w-1/4 rounded"
              style={{
                background: theme.footer_template === 'dark_band' ? 'rgba(255,255,255,0.35)' : '#cbd5e1',
              }}
            />
            <div
              className="h-0.5 w-1/4 rounded"
              style={{
                background: theme.footer_template === 'dark_band' ? 'rgba(255,255,255,0.25)' : '#cbd5e1',
              }}
            />
          </>
        )}
      </div>

      {/* Palette + badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full border border-white/70 shadow-sm" style={{ background: palette.primary }} />
        <span className="w-2 h-2 rounded-full border border-white/70 shadow-sm" style={{ background: palette.secondary }} />
        <span className="w-2 h-2 rounded-full border border-white/70 shadow-sm" style={{ background: palette.hero }} />
      </div>
    </div>
  );
}
