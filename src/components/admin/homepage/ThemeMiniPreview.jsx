/** Rich miniature page mockup — emphasizes LAYOUT differences between themes. */

function headerBg(theme, ink) {
  const h = theme.header_template;
  if (h === 'glass_dark' || h === 'gradient_bar') return ink.hero;
  if (h === 'floating_pill') return 'transparent';
  return '#ffffff';
}

function heroBg(theme, ink) {
  const h = theme.hero_template;
  if (h === 'gradient_mesh') {
    return `linear-gradient(135deg, ${ink.primary}cc, ${ink.secondary}99 45%, ${ink.hero}ee)`;
  }
  if (h === 'card_inset') {
    return `linear-gradient(160deg, ${ink.surface}, ${ink.secondary}22)`;
  }
  if (h === 'split_left') {
    return `linear-gradient(100deg, ${ink.hero}f0 52%, ${ink.primary}66 52%)`;
  }
  return `linear-gradient(to top, ${ink.hero}f2, ${ink.hero}55)`;
}

function TripCards({ theme, ink }) {
  const layout = theme.trips_layout_template;
  const card = theme.trip_card_template;
  const sharp = card === 'bordered_sharp' || card === 'ticket_stub';
  const glass = card === 'glass_card';
  const overlay = card === 'image_overlay' || card === 'destination_poster' || card === 'luxe_noir' || card === 'spotlight';
  const radius = sharp ? 'rounded-none' : glass ? 'rounded-lg' : 'rounded-md';

  if (layout === 'compact_list') {
    return (
      <div className="space-y-1">
        {[0, 1, 2].map((n) => (
          <div key={n} className={`flex gap-1 overflow-hidden bg-white/90 border border-black/5 ${radius}`}>
            <div className="w-5 shrink-0" style={{ background: `${ink.primary}55` }} />
            <div className="flex-1 py-1 pr-1 space-y-0.5">
              <div className="h-0.5 w-3/4 rounded bg-slate-200" />
              <div className="h-1 w-1/3 rounded-full" style={{ background: ink.primary }} />
            </div>
            {card === 'ticket_stub' ? (
              <div className="w-3 shrink-0 border-l border-dashed border-black/15" style={{ background: `${ink.secondary}18` }} />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'horizontal_scroll') {
    return (
      <div className="flex gap-1 overflow-hidden">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className={`shrink-0 w-[38%] overflow-hidden border border-black/5 ${radius} ${glass ? 'bg-white/70' : 'bg-white'}`}
          >
            <div className="h-6" style={{ background: n % 2 ? `${ink.secondary}44` : `${ink.primary}55` }} />
            <div className="p-1 space-y-0.5">
              <div className="h-0.5 w-full rounded bg-slate-200" />
              <div className="h-1.5 w-2/3 rounded-full" style={{ background: ink.primary }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'alternating_rows' || layout === 'editorial_stack') {
    const tall = layout === 'editorial_stack';
    return (
      <div className="space-y-1">
        {[0, 1].map((n) => (
          <div
            key={n}
            className={`flex gap-1 overflow-hidden bg-white border border-black/5 ${radius} ${
              n === 1 && layout === 'alternating_rows' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={tall ? 'w-[36%] h-9' : 'w-[42%] h-7'}
              style={{ background: `${ink.secondary}40` }}
            />
            <div className="flex-1 p-1 flex flex-col justify-center gap-0.5">
              <div className={`h-0.5 rounded bg-slate-200 ${tall ? 'w-full' : 'w-full'}`} />
              {tall ? <div className="h-0.5 w-4/5 rounded bg-slate-100" /> : null}
              <div className="h-1 w-1/2 rounded-full" style={{ background: ink.primary }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'masonry_two') {
    return (
      <div className="grid grid-cols-2 gap-1 items-start">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className={`overflow-hidden border border-black/5 bg-white ${radius} ${n === 0 ? 'row-span-2' : ''}`}
          >
            <div
              className={n === 0 ? 'h-10' : 'h-5'}
              style={{ background: n === 0 ? `${ink.primary}66` : `${ink.secondary}33` }}
            />
            <div className="p-1 space-y-0.5">
              <div className="h-0.5 w-full rounded bg-slate-200" />
              {card !== 'minimal_clean' && (
                <div className="h-1.5 w-2/3 rounded-full" style={{ background: ink.primary }} />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'destination_bento' || layout === 'bento_showcase') {
    const tiles = layout === 'bento_showcase' ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
    return (
      <div className={`grid gap-1 ${layout === 'bento_showcase' ? 'grid-cols-4 grid-rows-2' : 'grid-cols-6 grid-rows-2'}`}>
        {tiles.map((n) => {
          const hero = layout === 'bento_showcase' ? n === 0 : n <= 2;
          return (
            <div
              key={n}
              className={`relative overflow-hidden ${radius} ${
                layout === 'bento_showcase'
                  ? n === 0
                    ? 'col-span-2 row-span-2 min-h-[40px]'
                    : 'col-span-2 min-h-[18px]'
                  : n <= 2
                    ? 'col-span-2 min-h-[22px]'
                    : 'col-span-3 min-h-[18px]'
              }`}
              style={{
                background: `${n % 2 ? ink.secondary : ink.primary}${hero ? '99' : '66'}`,
              }}
            >
              <div className="absolute inset-x-0 bottom-0 p-0.5 bg-gradient-to-t from-black/70 to-transparent">
                <div className="h-0.5 w-2/3 rounded bg-white/90 mb-0.5" />
                <div className="h-0.5 w-1/3 rounded bg-white/60" />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (layout === 'featured_plus_grid') {
    return (
      <div className="grid grid-cols-3 gap-1">
        <div className={`col-span-2 row-span-2 overflow-hidden border border-black/5 bg-white ${radius}`}>
          <div className="h-12" style={{ background: `${ink.primary}77` }} />
          <div className="p-1 space-y-0.5">
            <div className="h-0.5 w-full rounded bg-slate-200" />
            <div className="h-1.5 w-1/2 rounded-full" style={{ background: ink.primary }} />
          </div>
        </div>
        {[0, 1].map((n) => (
          <div key={n} className={`overflow-hidden border border-black/5 bg-white ${radius}`}>
            <div className="h-5" style={{ background: `${ink.secondary}44` }} />
            <div className="p-1">
              <div className="h-0.5 w-full rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'grid_four') {
    return (
      <div className="grid grid-cols-4 gap-0.5">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className={`overflow-hidden border border-black/5 bg-white ${radius}`}>
            <div className="h-5" style={{ background: `${n % 2 ? ink.secondary : ink.primary}44` }} />
            <div className="p-0.5">
              <div className="h-0.5 w-full rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'grid_three') {
    return (
      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2].map((n) => (
          <div key={n} className={`relative overflow-hidden border border-black/5 ${radius} ${glass ? 'bg-white/60' : 'bg-white'}`}>
            <div className="h-5" style={{ background: `${n % 2 ? ink.secondary : ink.primary}44` }} />
            {overlay ? (
              <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/60 to-transparent">
                <div className="h-0.5 w-3/4 rounded bg-white/80 mb-0.5" />
                <div className="h-1 w-1/2 rounded-full" style={{ background: ink.primary }} />
              </div>
            ) : (
              <div className="p-1 space-y-0.5">
                <div className="h-0.5 w-full rounded bg-slate-200" />
                <div className="h-1.5 w-2/3 rounded-full" style={{ background: ink.primary }} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

    const cols = layout === 'grid_two_large' ? 'grid-cols-2' : 'grid-cols-2';
  const count = layout === 'grid_two_large' ? 2 : 4;
  return (
    <div className={`grid gap-1 ${cols}`}>
      {Array.from({ length: count }, (_, n) => (
        <div
          key={n}
          className={`relative overflow-hidden border border-black/5 ${radius} ${glass ? 'bg-white/60' : 'bg-white'}`}
        >
          <div
            className={layout === 'grid_two_large' ? 'h-8' : 'h-5'}
            style={{ background: `${n % 2 ? ink.secondary : ink.primary}44` }}
          />
          {overlay ? (
            <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/60 to-transparent">
              <div className="h-0.5 w-3/4 rounded bg-white/80 mb-0.5" />
              <div className="h-1 w-1/2 rounded-full" style={{ background: ink.primary }} />
            </div>
          ) : (
            <div className="p-1 space-y-0.5">
              <div className="h-0.5 w-full rounded bg-slate-200" />
              <div className="h-1.5 w-2/3 rounded-full" style={{ background: ink.primary }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{ theme: object, selected?: boolean, size?: 'card'|'hero', structureFirst?: boolean }} props
 * structureFirst = use muted structure ink so layout, not color, dominates the preview.
 */
export default function ThemeMiniPreview({
  theme,
  selected = false,
  size = 'card',
  structureFirst = true,
}) {
  const suggested = theme.palette || {
    primary: '#0ea5e9',
    secondary: '#1e3a5f',
    hero: '#0f172a',
    surface: '#f8fafc',
  };
  // Structure-first: keep surface/hero readable, tint accents lightly from suggested palette
  const ink = structureFirst
    ? {
        primary: suggested.primary,
        secondary: suggested.secondary,
        hero: suggested.hero,
        surface: suggested.surface,
      }
    : suggested;

  const isDarkSurface = /^#([0-2][0-9a-f]{5})$/i.test(ink.surface);
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
      style={{ background: ink.surface }}
    >
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl opacity-30"
        style={{ background: ink.primary }}
      />

      {/* Header */}
      <div
        className={`relative z-10 h-[10%] flex items-center px-2 gap-1 ${floating ? 'pt-1' : ''}`}
        style={{ background: floating ? 'transparent' : headerBg(theme, ink) }}
      >
        <div
          className={`flex items-center gap-1 w-full ${
            floating ? 'rounded-full px-1.5 py-0.5 shadow-sm border border-black/5 bg-white/95' : ''
          }`}
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ink.primary }} />
          <div
            className="flex-1 h-1 rounded"
            style={{
              background:
                theme.header_template === 'glass_dark' || theme.header_template === 'gradient_bar'
                  ? 'rgba(255,255,255,0.35)'
                  : `${ink.secondary}33`,
            }}
          />
          <div className="h-2 w-5 rounded-full shrink-0" style={{ background: ink.primary, opacity: 0.9 }} />
        </div>
      </div>

      {/* Hero */}
      <div className={`relative h-[30%] ${insetHero ? 'px-2 pb-1' : ''}`}>
        <div
          className={`h-full relative flex flex-col justify-end p-2 overflow-hidden ${
            insetHero ? 'rounded-xl shadow-md border border-black/5' : ''
          }`}
          style={{ background: heroBg(theme, ink) }}
        >
          {theme.hero_template === 'split_left' && (
            <div className="absolute right-0 top-0 w-[46%] h-full bg-white/20" />
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
      <div className="h-[45%] p-2 space-y-1.5" style={{ background: ink.surface }}>
        <div className="flex justify-center">
          <div className="h-1 w-1/3 rounded-full" style={{ background: ink.primary, opacity: 0.85 }} />
        </div>
        <TripCards theme={theme} ink={ink} />
      </div>

      {/* Footer */}
      <div
        className="h-[15%] border-t border-black/5 flex items-center justify-center gap-1.5 px-2"
        style={{
          background:
            theme.footer_template === 'dark_band'
              ? ink.hero
              : theme.footer_template === 'newsletter_cta'
                ? `${ink.primary}18`
                : isDarkSurface
                  ? `${ink.secondary}33`
                  : `${ink.secondary}10`,
        }}
      >
        {theme.footer_template === 'newsletter_cta' ? (
          <div className="h-2.5 w-3/5 rounded-full" style={{ background: ink.primary }} />
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

      {/* Layout badge — not color dots as primary signal */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1 pointer-events-none">
        <span className="max-w-[70%] truncate rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {theme.layoutLabel || theme.badge || 'Layout'}
        </span>
        <span className="flex items-center gap-0.5 rounded-full bg-white/80 px-1 py-0.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: suggested.primary }} />
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: suggested.secondary }} />
        </span>
      </div>
    </div>
  );
}
