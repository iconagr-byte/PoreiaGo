import { describe, expect, it } from 'vitest';
import {
  createSliderSlide,
  normalizeSliderSlides,
  normalizeSliderOptions,
  pageSliderPatch,
  readPageSlider,
  clampSliderIntervalSec,
  isSlideScheduledActive,
} from './pageSlider.js';

describe('pageSlider', () => {
  it('normalizes slides and drops empty images', () => {
    const slides = normalizeSliderSlides([
      { image_url: '/a.jpg', title: 'A', alt: 'Alt A' },
      { image_url: '  ', title: 'skip' },
      { title: 'no image' },
    ]);
    expect(slides).toHaveLength(1);
    expect(slides[0].title).toBe('A');
    expect(slides[0].alt).toBe('Alt A');
    expect(slides[0].id).toBeTruthy();
  });

  it('clamps interval', () => {
    expect(clampSliderIntervalSec(1)).toBe(3);
    expect(clampSliderIntervalSec(99)).toBe(20);
    expect(clampSliderIntervalSec(7)).toBe(7);
  });

  it('reads enabled slider only with slides', () => {
    const empty = readPageSlider({ home_slider_enabled: true, home_slider_slides: [] }, 'home');
    expect(empty.enabled).toBe(false);
    const ready = readPageSlider(
      {
        home_slider_enabled: true,
        home_slider_slides: [createSliderSlide({ image_url: '/x.jpg' })],
        home_slider_options: { transition: 'slide', show_thumbnails: true },
      },
      'home',
    );
    expect(ready.enabled).toBe(true);
    expect(ready.slides).toHaveLength(1);
    expect(ready.options.transition).toBe('slide');
    expect(ready.options.show_thumbnails).toBe(true);
  });

  it('builds rent patch keys including options', () => {
    const patch = pageSliderPatch('rent', {
      enabled: true,
      autoplay: false,
      interval_sec: 8,
      options: { lightbox: true, protect: true },
      slides: [{ image_url: '/r.jpg', title: 'Rent' }],
    });
    expect(patch.rent_slider_enabled).toBe(true);
    expect(patch.rent_slider_autoplay).toBe(false);
    expect(patch.rent_slider_interval_sec).toBe(8);
    expect(patch.rent_slider_options.lightbox).toBe(true);
    expect(patch.rent_slider_options.protect).toBe(true);
    expect(patch.rent_slider_slides[0].image_url).toBe('/r.jpg');
  });

  it('normalizes options with safe defaults', () => {
    const opts = normalizeSliderOptions({ transition: 'nope', show_arrows: false });
    expect(opts.transition).toBe('fade');
    expect(opts.show_arrows).toBe(false);
    expect(opts.show_dots).toBe(true);
  });

  it('respects Soliloquy-style schedule windows', () => {
    const now = Date.parse('2026-07-30T12:00:00.000Z');
    expect(
      isSlideScheduledActive(
        { schedule_start: '2026-08-01T00:00:00.000Z', schedule_end: '' },
        now,
      ),
    ).toBe(false);
    expect(
      isSlideScheduledActive(
        { schedule_start: '2026-07-01T00:00:00.000Z', schedule_end: '2026-08-01T00:00:00.000Z' },
        now,
      ),
    ).toBe(true);
    const filtered = normalizeSliderSlides(
      [
        { image_url: '/future.jpg', schedule_start: '2099-01-01T00:00:00.000Z' },
        { image_url: '/now.jpg' },
      ],
      { respectSchedule: true, now },
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].image_url).toBe('/now.jpg');
  });
});
