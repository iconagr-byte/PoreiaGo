import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { clampSliderIntervalSec } from '../../lib/homepage/pageSlider.js';
import '../../styles/site-hero-slider.css';

/**
 * Full-bleed hero image slider — autoplay, arrows, dots, swipe, pause on hover.
 * variant="media": background only (parent paints overlay copy).
 * variant="section": includes optional per-slide title / CTA.
 */
export default function SiteHeroSlider({
  slides = [],
  autoplay = true,
  intervalSec = 5,
  variant = 'media',
  className = '',
  accent = 'bus',
  ariaLabel = 'Slider',
} = {}) {
  const items = (slides || []).filter((s) => s?.image_url);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    setIndex((i) => (items.length ? Math.min(i, items.length - 1) : 0));
  }, [items.length]);

  const go = useCallback(
    (next) => {
      if (!items.length) return;
      setIndex((i) => (i + next + items.length) % items.length);
    },
    [items.length],
  );

  useEffect(() => {
    if (!autoplay || paused || reduceMotion.current || items.length < 2) return undefined;
    const ms = clampSliderIntervalSec(intervalSec) * 1000;
    const t = window.setInterval(() => go(1), ms);
    return () => window.clearInterval(t);
  }, [autoplay, paused, intervalSec, go, items.length]);

  if (!items.length) return null;

  const slide = items[index] || items[0];
  const showChrome = items.length > 1;

  return (
    <div
      className={`site-hero-slider site-hero-slider--${variant} site-hero-slider--${accent} ${className}`.trim()}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      onTouchStart={(e) => {
        touchX.current = e.changedTouches?.[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches?.[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) < 40) return;
        go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="site-hero-slider-track">
        {items.map((s, i) => {
          const url = resolveSiteAssetUrl(s.image_url) || s.image_url;
          const active = i === index;
          return (
            <div
              key={s.id || `${url}-${i}`}
              className={`site-hero-slider-slide${active ? ' is-active' : ''}`}
              aria-hidden={!active}
            >
              <img src={url} alt={s.alt || s.title || ''} draggable={false} />
            </div>
          );
        })}
      </div>

      {variant === 'section' && (slide.title || slide.subtitle || slide.cta_label) ? (
        <div className="site-hero-slider-copy">
          {slide.title ? <h2 className="site-hero-slider-title">{slide.title}</h2> : null}
          {slide.subtitle ? <p className="site-hero-slider-subtitle">{slide.subtitle}</p> : null}
          {slide.cta_label && slide.cta_href ? (
            <a className="site-hero-slider-cta" href={slide.cta_href}>
              {slide.cta_label}
              <span className="material-symbols-outlined" aria-hidden>
                arrow_forward
              </span>
            </a>
          ) : null}
        </div>
      ) : null}

      {showChrome ? (
        <>
          <button
            type="button"
            className="site-hero-slider-nav site-hero-slider-nav--prev"
            aria-label="Προηγούμενη"
            onClick={() => go(-1)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              chevron_left
            </span>
          </button>
          <button
            type="button"
            className="site-hero-slider-nav site-hero-slider-nav--next"
            aria-label="Επόμενη"
            onClick={() => go(1)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              chevron_right
            </span>
          </button>
          <div className="site-hero-slider-dots" role="tablist" aria-label="Διαφάνειες">
            {items.map((s, i) => (
              <button
                key={s.id || i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Διαφάνεια ${i + 1}`}
                className={i === index ? 'is-active' : ''}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
