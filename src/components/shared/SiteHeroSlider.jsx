import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import {
  clampSliderIntervalSec,
  DEFAULT_SLIDER_OPTIONS,
  normalizeSliderOptions,
} from '../../lib/homepage/pageSlider.js';
import '../../styles/site-hero-slider.css';

/**
 * Full-bleed hero image slider — Soliloquy-inspired controls.
 * variant="media": background only (parent paints overlay copy).
 * variant="section": includes optional per-slide title / CTA.
 */
export default function SiteHeroSlider({
  slides = [],
  autoplay = true,
  intervalSec = 5,
  options,
  variant = 'media',
  className = '',
  accent = 'bus',
  ariaLabel = 'Slider',
} = {}) {
  const opts = normalizeSliderOptions(options || DEFAULT_SLIDER_OPTIONS);
  const items = (slides || []).filter((s) => s?.image_url);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const touchX = useRef(null);
  const reduceMotion = useRef(false);
  const rootRef = useRef(null);

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
      setIndex((i) => {
        const last = items.length - 1;
        if (opts.loop) return (i + next + items.length) % items.length;
        return Math.max(0, Math.min(last, i + next));
      });
    },
    [items.length, opts.loop],
  );

  useEffect(() => {
    if (!autoplay || paused || reduceMotion.current || items.length < 2) return undefined;
    const ms = clampSliderIntervalSec(intervalSec) * 1000;
    const t = window.setInterval(() => go(1), ms);
    return () => window.clearInterval(t);
  }, [autoplay, paused, intervalSec, go, items.length]);

  useEffect(() => {
    if (!opts.keyboard || !items.length) return undefined;
    const onKey = (e) => {
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement;
      const focusedInside = root === active || root.contains(active);
      const lightboxOpen = lightbox;
      if (!focusedInside && !lightboxOpen) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'Escape' && lightbox) {
        setLightbox(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts.keyboard, go, items.length, lightbox]);

  if (!items.length) return null;

  const slide = items[index] || items[0];
  const showChrome = items.length > 1;
  const transitionClass = `site-hero-slider--t-${opts.transition || 'fade'}`;
  const captionClass = `site-hero-slider-copy--${opts.caption_position || 'bottom'}`;

  const pauseHandlers = opts.pause_on_hover
    ? {
        onMouseEnter: () => setPaused(true),
        onMouseLeave: () => setPaused(false),
        onFocusCapture: () => setPaused(true),
        onBlurCapture: (e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
        },
      }
    : {};

  const openLink = (s) => {
    const href = String(s?.cta_href || '').trim();
    if (!href) return;
    if (s.link_new_tab) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.assign(href);
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className={`site-hero-slider site-hero-slider--${variant} site-hero-slider--${accent} ${transitionClass} ${className}`.trim()}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      {...pauseHandlers}
      onContextMenu={opts.protect ? (e) => e.preventDefault() : undefined}
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
              <img
                src={url}
                alt={s.alt || s.title || ''}
                draggable={false}
                loading={active || i === 0 ? 'eager' : 'lazy'}
                onClick={() => {
                  if (opts.lightbox) {
                    setLightbox(true);
                    return;
                  }
                  if (s.cta_href && !s.cta_label) openLink(s);
                }}
              />
            </div>
          );
        })}
      </div>

      {variant === 'section' && (slide.title || slide.subtitle || slide.cta_label) ? (
        <div
          className={`site-hero-slider-copy ${captionClass}${
            opts.mobile_hide_captions ? ' site-hero-slider-copy--hide-mobile' : ''
          }`}
        >
          {slide.title ? <h2 className="site-hero-slider-title">{slide.title}</h2> : null}
          {slide.subtitle ? <p className="site-hero-slider-subtitle">{slide.subtitle}</p> : null}
          {slide.cta_label && slide.cta_href ? (
            <a
              className="site-hero-slider-cta"
              href={slide.cta_href}
              target={slide.link_new_tab ? '_blank' : undefined}
              rel={slide.link_new_tab ? 'noreferrer' : undefined}
            >
              {slide.cta_label}
              <span className="material-symbols-outlined" aria-hidden>
                arrow_forward
              </span>
            </a>
          ) : null}
        </div>
      ) : null}

      {showChrome && opts.show_arrows ? (
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
        </>
      ) : null}

      {showChrome && opts.show_dots ? (
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
      ) : null}

      {showChrome && opts.show_thumbnails ? (
        <div className="site-hero-slider-thumbs" role="tablist" aria-label="Μικρογραφίες">
          {items.map((s, i) => {
            const url = resolveSiteAssetUrl(s.image_url) || s.image_url;
            return (
              <button
                key={s.id || i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Μικρογραφία ${i + 1}`}
                className={i === index ? 'is-active' : ''}
                onClick={() => setIndex(i)}
              >
                <img src={url} alt="" draggable={false} />
              </button>
            );
          })}
        </div>
      ) : null}

      {opts.lightbox ? (
        <button
          type="button"
          className="site-hero-slider-lightbox-btn"
          aria-label="Fullscreen"
          onClick={() => setLightbox(true)}
        >
          <span className="material-symbols-outlined" aria-hidden>
            zoom_out_map
          </span>
        </button>
      ) : null}

      {lightbox ? (
        <div
          className="site-hero-slider-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen slider"
          onClick={() => setLightbox(false)}
          onContextMenu={opts.protect ? (e) => e.preventDefault() : undefined}
        >
          <button
            type="button"
            className="site-hero-slider-lightbox-close"
            aria-label="Κλείσιμο"
            onClick={() => setLightbox(false)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <img
            src={resolveSiteAssetUrl(slide.image_url) || slide.image_url}
            alt={slide.alt || slide.title || ''}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
          {showChrome ? (
            <div className="site-hero-slider-lightbox-nav">
              <button type="button" aria-label="Προηγούμενη" onClick={(e) => { e.stopPropagation(); go(-1); }}>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button type="button" aria-label="Επόμενη" onClick={(e) => { e.stopPropagation(); go(1); }}>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
