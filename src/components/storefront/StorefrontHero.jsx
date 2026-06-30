import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

export default function StorefrontHero({
  siteAppearance,
  templateId = 'fullscreen_overlay',
  searchForm,
}) {
  const heroUrl =
    resolveSiteAssetUrl(siteAppearance.hero_image_url) || '/images/hero-bus-achillio.png';

  const badge = siteAppearance.hero_badge ? (
    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 text-white/95 font-bold text-[11px] uppercase tracking-[0.2em] rounded-full mb-6 border border-white/20 backdrop-blur-md">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {siteAppearance.hero_badge}
    </span>
  ) : null;

  const titleBlock = (
    <>
      <h1 className="text-[1.75rem] sm:text-3xl md:text-[2rem] lg:text-[2.25rem] font-display-md font-bold text-white mb-5 leading-snug tracking-tight">
        {siteAppearance.hero_title}
        {siteAppearance.hero_title_accent && (
          <>
            {' '}
            <span className="text-sky-300">{siteAppearance.hero_title_accent}</span>
          </>
        )}
      </h1>
      {siteAppearance.hero_subtitle && (
        <p className="text-base md:text-lg text-white/80 font-body-md mb-8 max-w-xl leading-relaxed">
          {siteAppearance.hero_subtitle}
        </p>
      )}
    </>
  );

  if (templateId === 'split_left') {
    return (
      <section className="relative min-h-[min(88vh,820px)] grid md:grid-cols-2 bg-slate-950">
        <div className="flex items-center px-margin-desktop py-28 lg:py-32 pt-36 order-2 md:order-1">
          <div className="max-w-xl">
            {badge}
            {titleBlock}
            {searchForm}
          </div>
        </div>
        <div
          className="min-h-[40vh] md:min-h-full bg-cover bg-center order-1 md:order-2"
          style={{ backgroundImage: `url('${heroUrl}')` }}
        />
      </section>
    );
  }

  if (templateId === 'centered_compact') {
    return (
      <section className="relative min-h-[min(70vh,640px)] flex items-center justify-center px-margin-desktop overflow-hidden bg-slate-900">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url('${heroUrl}')` }}
        />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="relative z-10 w-full max-w-3xl mx-auto text-center py-32 pt-40">
          <div className="flex flex-col items-center">
            {badge}
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {siteAppearance.hero_title}
              {siteAppearance.hero_title_accent && (
                <span className="block text-sky-300 mt-2">{siteAppearance.hero_title_accent}</span>
              )}
            </h1>
            {siteAppearance.hero_subtitle && (
              <p className="text-white/75 mb-8 max-w-lg">{siteAppearance.hero_subtitle}</p>
            )}
          </div>
          <div className="text-left">{searchForm}</div>
        </div>
      </section>
    );
  }

  if (templateId === 'bottom_search') {
    return (
      <section className="relative min-h-[min(92vh,880px)] flex flex-col justify-end px-margin-desktop overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-[center_40%]"
          style={{ backgroundImage: `url('${heroUrl}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-900/30" />
        <div className="relative z-10 w-full max-w-container-max mx-auto pb-12 pt-36">
          <div className="max-w-2xl mb-8">
            {badge}
            {titleBlock}
          </div>
          {searchForm}
        </div>
      </section>
    );
  }

  if (templateId === 'gradient_mesh') {
    return (
      <section className="relative min-h-[min(80vh,760px)] flex items-center px-margin-desktop overflow-hidden bg-gradient-to-br from-indigo-950 via-violet-900 to-sky-900">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center mix-blend-overlay"
          style={{ backgroundImage: `url('${heroUrl}')` }}
        />
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-400/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-violet-500/25 rounded-full blur-3xl" />
        <div className="relative z-10 w-full max-w-container-max mx-auto py-32 pt-40">
          <div className="max-w-2xl">
            {badge}
            {titleBlock}
            {searchForm}
          </div>
        </div>
      </section>
    );
  }

  if (templateId === 'card_inset') {
    return (
      <section className="relative px-margin-desktop py-28 lg:py-32 pt-36 bg-slate-100">
        <div className="max-w-container-max mx-auto rounded-[40px] overflow-hidden shadow-2xl border border-black/[0.06] min-h-[min(72vh,680px)] flex items-center relative">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${heroUrl}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-transparent" />
          <div className="relative z-10 p-8 md:p-14 max-w-2xl">
            {badge}
            {titleBlock}
            {searchForm}
          </div>
        </div>
      </section>
    );
  }

  // fullscreen_overlay (default)
  return (
    <section className="relative w-full min-h-[min(88vh,820px)] flex items-center justify-center px-margin-desktop overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-[center_40%] bg-no-repeat"
        style={{ backgroundImage: `url('${heroUrl}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/75 to-slate-900/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-900/30" />
      <div className="relative z-10 w-full max-w-container-max mx-auto py-28 lg:py-32 pt-36">
        <div className="max-w-2xl">
          {badge}
          {titleBlock}
          {searchForm}
        </div>
      </div>
    </section>
  );
}
