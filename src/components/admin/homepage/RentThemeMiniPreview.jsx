/** Miniature /rent page mockup — emphasizes structural differences between rent themes. */

function inkOf(theme) {
  const p = theme?.palette || {};
  return {
    primary: p.primary || '#0a7a6c',
    secondary: p.secondary || '#0b3d4a',
    hero: p.hero || '#0f766e',
    surface: p.surface || '#f0fdfa',
  };
}

function heroGradient(theme, ink) {
  switch (theme.rent_hero_style) {
    case 'cinematic':
    case 'night':
    case 'yacht':
    case 'editorial':
      return `linear-gradient(160deg, ${ink.hero} 0%, ${ink.secondary} 55%, ${ink.primary}55 100%)`;
    case 'compare':
    case 'airport':
      return `linear-gradient(180deg, ${ink.secondary} 0%, ${ink.hero}ee 40%, ${ink.surface} 100%)`;
    case 'peer':
      return `linear-gradient(135deg, ${ink.hero} 0%, ${ink.primary}99 50%, ${ink.secondary}88 100%)`;
    case 'island':
    case 'desert':
    case 'sport':
      return `linear-gradient(120deg, ${ink.hero}f0 0%, ${ink.primary}cc 45%, ${ink.secondary}99 100%)`;
    case 'glass':
      return `linear-gradient(135deg, ${ink.primary}bb, ${ink.secondary}99 50%, ${ink.hero}ee)`;
    case 'soft_luxe':
    case 'family':
    case 'alpine':
      return `linear-gradient(180deg, ${ink.surface} 0%, ${ink.primary}33 55%, ${ink.secondary}55 100%)`;
    case 'deal':
    case 'metro':
      return `linear-gradient(100deg, ${ink.hero} 0%, ${ink.secondary} 48%, ${ink.primary} 100%)`;
    default:
      return `linear-gradient(165deg, ${ink.hero}ee 0%, ${ink.primary}99 50%, ${ink.surface} 100%)`;
  }
}

function FleetMock({ theme, ink }) {
  const layout = theme.rent_fleet_layout_template;
  const card = theme.rent_fleet_card_template;
  const overlay = card === 'rent_overlay';
  const soft = card === 'rent_soft';
  const compact = card === 'rent_compact' || card === 'rent_spec';
  const radius = soft ? 'rounded-xl' : overlay ? 'rounded-xl' : compact ? 'rounded-md' : 'rounded-lg';

  if (layout === 'rent_list' || compact) {
    return (
      <div className="space-y-1 px-1.5 pb-1.5">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className={`flex gap-1 overflow-hidden border border-black/5 bg-white ${radius}`}
          >
            <div className="w-6 shrink-0" style={{ background: `${ink.primary}55` }} />
            <div className="flex-1 py-1 pr-1 space-y-0.5">
              <div className="h-0.5 w-3/4 rounded bg-slate-200" />
              <div className="h-1 w-1/3 rounded-full" style={{ background: ink.primary }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'rent_scroll') {
    return (
      <div className="flex gap-1 overflow-hidden px-1.5 pb-1.5">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className={`shrink-0 w-[40%] overflow-hidden border border-black/5 ${radius} ${
              soft ? 'bg-white/80' : 'bg-white'
            }`}
          >
            <div
              className="h-7"
              style={{
                background: overlay
                  ? `linear-gradient(to top, ${ink.secondary}cc, ${ink.primary}66)`
                  : n % 2
                    ? `${ink.secondary}44`
                    : `${ink.primary}55`,
              }}
            />
            {!overlay ? (
              <div className="p-1 space-y-0.5">
                <div className="h-0.5 w-full rounded bg-slate-200" />
                <div className="h-1 w-2/3 rounded-full" style={{ background: ink.primary }} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'rent_featured') {
    return (
      <div className="grid grid-cols-2 gap-1 px-1.5 pb-1.5">
        <div
          className={`col-span-2 overflow-hidden border border-black/5 ${radius} ${
            soft ? 'bg-white/80' : 'bg-white'
          }`}
        >
          <div
            className="h-8"
            style={{
              background: overlay
                ? `linear-gradient(to top, ${ink.hero}dd, ${ink.primary}77)`
                : `${ink.primary}66`,
            }}
          />
          {!overlay ? (
            <div className="p-1 flex justify-between gap-1">
              <div className="h-0.5 w-1/2 rounded bg-slate-200" />
              <div className="h-1.5 w-1/4 rounded-full" style={{ background: ink.primary }} />
            </div>
          ) : null}
        </div>
        {[0, 1].map((n) => (
          <div key={n} className={`overflow-hidden border border-black/5 bg-white ${radius}`}>
            <div className="h-5" style={{ background: `${ink.secondary}40` }} />
            <div className="p-1">
              <div className="h-1 w-1/2 rounded-full" style={{ background: ink.primary }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'rent_grid_two') {
    return (
      <div className="grid grid-cols-2 gap-1 px-1.5 pb-1.5">
        {[0, 1].map((n) => (
          <div
            key={n}
            className={`overflow-hidden border border-black/5 ${radius} ${
              soft ? 'bg-white/85' : 'bg-white'
            }`}
          >
            <div
              className="h-8"
              style={{
                background: overlay
                  ? `linear-gradient(to top, ${ink.secondary}bb, ${ink.primary}66)`
                  : `${ink.primary}${n ? '44' : '66'}`,
              }}
            />
            {!overlay ? (
              <div className="p-1 space-y-0.5">
                <div className="h-0.5 w-full rounded bg-slate-200" />
                <div className="h-1.5 w-1/2 rounded-full" style={{ background: ink.primary }} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  // rent_grid_three default
  return (
    <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
      {[0, 1, 2].map((n) => (
        <div
          key={n}
          className={`relative overflow-hidden border border-black/5 ${radius} ${
            soft || overlay ? 'bg-white/90' : 'bg-white'
          }`}
        >
          <div
            className={overlay ? 'h-7' : 'h-6'}
            style={{
              background: overlay
                ? `linear-gradient(160deg, ${ink.primary}55, ${ink.secondary}33)`
                : `${ink.primary}${40 + n * 10}`,
            }}
          />
          {overlay ? (
            <div
              className="mx-0.5 -mt-2 mb-0.5 rounded-md bg-white px-0.5 py-0.5 shadow-sm space-y-0.5"
              style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.12)' }}
            >
              <div className="h-0.5 w-full rounded bg-slate-200" />
              <div className="h-1 w-2/3 rounded-full" style={{ background: ink.primary }} />
            </div>
          ) : (
            <div className="p-0.5 space-y-0.5">
              <div className="h-0.5 w-full rounded bg-slate-200" />
              <div className="h-1 w-2/3 rounded-full" style={{ background: ink.primary }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function RentThemeMiniPreview({ theme, selected = false, size = 'sm' }) {
  const ink = inkOf(theme);
  const darkHero = ['cinematic', 'night', 'yacht', 'editorial', 'peer', 'deal', 'metro'].includes(
    theme.rent_hero_style,
  );
  const large = size === 'lg';

  return (
    <div
      className={`relative overflow-hidden border transition ${
        large ? 'rounded-2xl' : 'rounded-xl'
      } ${
        selected
          ? 'border-teal-500/50 ring-2 ring-teal-500/20 shadow-md'
          : 'border-black/[0.06] shadow-sm group-hover:border-black/10'
      }`}
      style={{ background: ink.surface }}
    >
      {/* Phone chrome */}
      <div className={large ? 'px-3 pt-3' : 'px-1.5 pt-1.5'}>
        <div
          className={`overflow-hidden border border-black/5 shadow-sm ${
            large ? 'rounded-2xl' : 'rounded-lg'
          }`}
          style={{ background: darkHero ? ink.hero : '#fff' }}
        >
          {/* Topbar — mirrors theme header_style */}
          <div
            className={`flex items-center justify-between gap-1 ${
              large ? 'px-3 py-2.5' : 'px-1.5 py-1'
            }`}
            style={{
              background: (() => {
                switch (theme.header_style) {
                  case 'dark':
                  case 'ink':
                    return ink.secondary;
                  case 'brand':
                    return ink.primary;
                  case 'soft':
                    return ink.surface;
                  case 'solid':
                    return '#ffffff';
                  default:
                    return darkHero ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)';
                }
              })(),
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`shrink-0 rounded ${large ? 'h-4 w-4' : 'h-2.5 w-2.5'}`}
                style={{
                  background:
                    theme.header_style === 'brand' || theme.header_style === 'dark'
                      ? 'rgba(255,255,255,0.85)'
                      : ink.primary,
                }}
              />
              <span
                className={`rounded ${large ? 'h-1.5 w-20' : 'h-0.5 w-8'}`}
                style={{
                  background:
                    theme.header_style === 'dark' ||
                    theme.header_style === 'ink' ||
                    theme.header_style === 'brand'
                      ? 'rgba(255,255,255,0.75)'
                      : ink.secondary,
                }}
              />
            </div>
            <span
              className={`shrink-0 rounded-full ${large ? 'h-3.5 w-14' : 'h-2 w-6'}`}
              style={{
                background:
                  theme.header_style === 'brand' ? 'rgba(255,255,255,0.9)' : ink.primary,
              }}
            />
          </div>

          {/* Hero — real theme photo + shade */}
          <div
            className={`relative overflow-hidden ${large ? 'h-36 px-3 py-3' : 'h-14 px-1.5 py-1.5'}`}
            style={{
              backgroundImage: theme.hero_image_url
                ? `linear-gradient(165deg, ${ink.hero}99 0%, ${ink.secondary}66 55%, transparent 100%), url(${theme.hero_image_url})`
                : heroGradient(theme, ink),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className={`space-y-1 max-w-[70%] ${large ? 'space-y-2' : ''}`}>
              <div
                className={`rounded ${large ? 'h-3 w-40' : 'h-1.5 w-16'}`}
                style={{ background: darkHero ? '#fff' : ink.secondary }}
              />
              <div
                className={`rounded opacity-70 ${large ? 'h-2 w-28' : 'h-1 w-12'}`}
                style={{ background: darkHero ? 'rgba(255,255,255,0.75)' : ink.primary }}
              />
              {large ? (
                <div
                  className="h-1.5 w-36 rounded opacity-50"
                  style={{ background: darkHero ? 'rgba(255,255,255,0.55)' : ink.secondary }}
                />
              ) : null}
            </div>
            {/* Search pill */}
            <div
              className={`absolute left-1.5 right-1.5 bottom-1.5 rounded-md border border-black/5 ${
                large ? 'left-3 right-3 bottom-3 h-9 rounded-xl' : 'h-3.5'
              }`}
              style={{
                background:
                  theme.rent_hero_style === 'compare' || theme.rent_hero_style === 'airport'
                    ? '#fff'
                    : 'rgba(255,255,255,0.92)',
              }}
            />
          </div>

          {/* Fleet */}
          <div className={`bg-white/40 ${large ? 'pt-2 pb-1' : 'pt-1'}`}>
            <div className={`mb-1 ${large ? 'px-3' : 'px-1.5'}`}>
              <div className={`rounded bg-slate-300 ${large ? 'h-1.5 w-24' : 'h-0.5 w-10'}`} />
              {large ? (
                <div className="mt-1.5 h-1 w-40 rounded bg-slate-200" />
              ) : null}
            </div>
            <FleetMock theme={theme} ink={ink} />
          </div>
        </div>
      </div>

      {/* Palette strip */}
      <div className={`flex gap-0.5 ${large ? 'px-3 py-2.5 gap-1' : 'px-2 py-1.5'}`}>
        {[ink.primary, ink.secondary, ink.hero, ink.surface].map((c, i) => (
          <span
            key={`${c}-${i}`}
            className={`flex-1 rounded-sm border border-black/5 ${large ? 'h-3 rounded' : 'h-2'}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
