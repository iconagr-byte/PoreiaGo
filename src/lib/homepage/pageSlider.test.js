import { describe, expect, it } from 'vitest';
import {
  createSliderSlide,
  normalizeSliderSlides,
  pageSliderPatch,
  readPageSlider,
  clampSliderIntervalSec,
} from './pageSlider.js';

describe('pageSlider', () => {
  it('normalizes slides and drops empty images', () => {
    const slides = normalizeSliderSlides([
      { image_url: '/a.jpg', title: 'A' },
      { image_url: '  ', title: 'skip' },
      { title: 'no image' },
    ]);
    expect(slides).toHaveLength(1);
    expect(slides[0].title).toBe('A');
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
      },
      'home',
    );
    expect(ready.enabled).toBe(true);
    expect(ready.slides).toHaveLength(1);
  });

  it('builds rent patch keys', () => {
    const patch = pageSliderPatch('rent', {
      enabled: true,
      autoplay: false,
      interval_sec: 8,
      slides: [{ image_url: '/r.jpg', title: 'Rent' }],
    });
    expect(patch.rent_slider_enabled).toBe(true);
    expect(patch.rent_slider_autoplay).toBe(false);
    expect(patch.rent_slider_interval_sec).toBe(8);
    expect(patch.rent_slider_slides[0].image_url).toBe('/r.jpg');
  });
});
