import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { readPageSlider } from '../../lib/homepage/pageSlider.js';
import { heroFocalCss } from '../../lib/homepage/heroFocal.js';
import {
  heroBackgroundSize,
  heroMinHeightCss,
  heroOverlayStrength,
} from '../../lib/homepage/heroPhoto.js';
import SiteHeroSlider from '../shared/SiteHeroSlider.jsx';

function HeroMedia({ siteAppearance, heroUrl }) {
  const slider = readPageSlider(siteAppearance, 'home');
  const focal = heroFocalCss(siteAppearance?.hero_image_focal || 'center');
  const fit = heroBackgroundSize(siteAppearance);
  if (slider.enabled) {
    return (
      <SiteHeroSlider
        slides={slider.slides}
        autoplay={slider.autoplay}
        intervalSec={slider.interval_sec}
        options={slider.options}
        variant="media"
        accent="bus"
        ariaLabel="Hero slider εκδρομών"
      />
    );
  }
  return (
    <div
      className="absolute inset-0 bg-no-repeat"
      style={{
        backgroundImage: `url('${heroUrl}')`,
        backgroundPosition: focal,
        backgroundSize: fit,
      }}
      aria-hidden
    />
  );
}

function HeroOverlays({ strength, variant = 'fullscreen' }) {
  const opacity = strength;
  if (variant === 'centered') {
    return <div className="absolute inset-0 bg-slate-950/70" style={{ opacity }} />;
  }
  if (variant === 'bottom') {
    return (
      <div
        className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-900/30"
        style={{ opacity }}
      />
    );
  }
  if (variant === 'card') {
    return (
      <div
        className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-transparent"
        style={{ opacity }}
      />
    );
  }
  // fullscreen (default)
  return (
    <>
      <div
        className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/75 to-slate-900/40 pointer-events-none"
        style={{ opacity }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-900/30 pointer-events-none"
        style={{ opacity }}
      />
    </>
  );
}

export default function StorefrontHero({
  siteAppearance,
  templateId = 'fullscreen_overlay',
  searchForm,
}) {
  const heroUrl =
    resolveSiteAssetUrl(siteAppearance.hero_image_url) || '/images/hero-bus-achillio.png';
  const sliderOn = readPageSlider(siteAppearance, 'home').enabled;
  const overlayStrength = heroOverlayStrength(siteAppearance);
  const minHeight = heroMinHeightCss(siteAppearance, 820);
  const compactMinHeight = heroMinHeightCss(
    {
      ...siteAppearance,
      hero_height_vh: Math.min(70, siteAppearance?.hero_height_vh ?? 70),
    },
    640,
  );
  const focal = heroFocalCss(siteAppearance?.hero_image_focal || 'center');
  const fit = heroBackgroundSize(siteAppearance);

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
      <section className="relative grid md:grid-cols-2 bg-slate-950" style={{ minHeight }}>
        <div className="flex items-center px-margin-desktop py-28 lg:py-32 pt-36 order-2 md:order-1">
          <div className="max-w-xl">
            {badge}
            {titleBlock}
            {searchForm}
          </div>
        </div>
        <div className="relative min-h-[40vh] md:min-h-full order-1 md:order-2 overflow-hidden">
          {sliderOn ? (
            <HeroMedia siteAppearance={siteAppearance} heroUrl={heroUrl} />
          ) : (
            <div
              className="absolute inset-0 bg-no-repeat"
              style={{
                backgroundImage: `url('${heroUrl}')`,
                backgroundPosition: focal,
                backgroundSize: fit,
              }}
            />
          )}
        </div>
      </section>
    );
  }

  if (templateId === 'centered_compact') {
    return (
      <section
        className="relative flex items-center justify-center px-margin-desktop overflow-hidden bg-slate-900"
        style={{ minHeight: compactMinHeight }}
      >
        <div className="absolute inset-0 opacity-40">
          <HeroMedia siteAppearance={siteAppearance} heroUrl={heroUrl} />
        </div>
        <HeroOverlays strength={overlayStrength} variant="centered" />
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
      <section
        className="relative flex flex-col justify-end px-margin-desktop overflow-hidden"
        style={{ minHeight: heroMinHeightCss(siteAppearance, 880) }}
      >
        <HeroMedia siteAppearance={siteAppearance} heroUrl={heroUrl} />
        <HeroOverlays strength={overlayStrength} variant="bottom" />
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
      <section
        className="relative flex items-center px-margin-desktop overflow-hidden bg-gradient-to-br from-indigo-950 via-violet-900 to-sky-900"
        style={{ minHeight: heroMinHeightCss(siteAppearance, 760) }}
      >
        <div className="absolute inset-0 opacity-20 mix-blend-overlay">
          <HeroMedia siteAppearance={siteAppearance} heroUrl={heroUrl} />
        </div>
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
        <div
          className="max-w-container-max mx-auto rounded-[40px] overflow-hidden shadow-2xl border border-black/[0.06] flex items-center relative"
          style={{ minHeight: heroMinHeightCss(siteAppearance, 680) }}
        >
          <HeroMedia siteAppearance={siteAppearance} heroUrl={heroUrl} />
          <HeroOverlays strength={overlayStrength} variant="card" />
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
    <section
      className="relative w-full flex items-center justify-center px-margin-desktop overflow-hidden"
      style={{ minHeight }}
    >
      <HeroMedia siteAppearance={siteAppearance} heroUrl={heroUrl} />
      <HeroOverlays strength={overlayStrength} variant="fullscreen" />
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
