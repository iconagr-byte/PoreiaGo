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
  const radius = soft ? 'rounded-xl' : compact ? 'rounded-md' : 'rounded-lg';

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
          className={`overflow-hidden border border-black/5 ${radius} ${
            soft ? 'bg-white/85' : 'bg-white'
          }`}
        >
          <div
            className="h-6"
            style={{
              background: overlay
                ? `linear-gradient(to top, ${ink.secondary}aa, ${ink.primary}55)`
                : `${ink.primary}${40 + n * 10}`,
            }}
          />
          {!overlay ? (
            <div className="p-0.5 space-y-0.5">
              <div className="h-0.5 w-full rounded bg-slate-200" />
              <div className="h-1 w-2/3 rounded-full" style={{ background: ink.primary }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function RentThemeMiniPreview({ theme, selected = false }) {
  const ink = inkOf(theme);
  const darkHero = ['cinematic', 'night', 'yacht', 'editorial', 'peer', 'deal', 'metro'].includes(
    theme.rent_hero_style,
  );

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition ${
        selected
          ? 'border-teal-500/50 ring-2 ring-teal-500/20 shadow-md'
          : 'border-black/[0.06] shadow-sm group-hover:border-black/10'
      }`}
      style={{ background: ink.surface }}
    >
      {/* Phone chrome */}
      <div className="px-1.5 pt-1.5">
        <div
          className="overflow-hidden rounded-lg border border-black/5 shadow-sm"
          style={{ background: darkHero ? ink.hero : '#fff' }}
        >
          {/* Topbar */}
          <div
            className="flex items-center justify-between gap-1 px-1.5 py-1"
            style={{
              background: darkHero ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
            }}
          >
            <div className="flex items-center gap-1 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded"
                style={{ background: ink.primary }}
              />
              <span
                className="h-0.5 w-8 rounded"
                style={{ background: darkHero ? 'rgba(255,255,255,0.7)' : ink.secondary }}
              />
            </div>
            <span
              className="h-2 w-6 shrink-0 rounded-full"
              style={{ background: ink.primary }}
            />
          </div>

          {/* Hero */}
          <div className="relative h-14 px-1.5 py-1.5" style={{ background: heroGradient(theme, ink) }}>
            <div className="space-y-1 max-w-[70%]">
              <div
                className="h-1.5 w-16 rounded"
                style={{ background: darkHero ? '#fff' : ink.secondary }}
              />
              <div
                className="h-1 w-12 rounded opacity-70"
                style={{ background: darkHero ? 'rgba(255,255,255,0.75)' : ink.primary }}
              />
            </div>
            {/* Search pill */}
            <div
              className="absolute left-1.5 right-1.5 bottom-1.5 h-3.5 rounded-md border border-black/5"
              style={{
                background:
                  theme.rent_hero_style === 'compare' || theme.rent_hero_style === 'airport'
                    ? '#fff'
                    : 'rgba(255,255,255,0.92)',
              }}
            />
          </div>

          {/* Fleet */}
          <div className="bg-white/40 pt-1">
            <div className="px-1.5 mb-1">
              <div className="h-0.5 w-10 rounded bg-slate-300" />
            </div>
            <FleetMock theme={theme} ink={ink} />
          </div>
        </div>
      </div>

      {/* Palette strip */}
      <div className="flex gap-0.5 px-2 py-1.5">
        {[ink.primary, ink.secondary, ink.hero, ink.surface].map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="h-2 flex-1 rounded-sm border border-black/5"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
