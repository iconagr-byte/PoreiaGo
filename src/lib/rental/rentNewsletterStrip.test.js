import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENT_NEWSLETTER,
  resolveRentNewsletterStrip,
} from './rentNewsletterStrip.js';

describe('resolveRentNewsletterStrip', () => {
  it('returns office defaults with coastal image', () => {
    const strip = resolveRentNewsletterStrip({});
    expect(strip.enabled).toBe(true);
    expect(strip.title).toContain('γραφείου');
    expect(strip.image_url).toContain('/images/rent-nl-');
    expect(strip.panel_color).toBe(DEFAULT_RENT_NEWSLETTER.panel_color);
    expect(strip.interests.length).toBeGreaterThanOrEqual(2);
    expect(strip.interests[0].label).toMatch(/Ενοικίαση/i);
    expect(strip.button_label).toMatch(/newsletter/i);
  });

  it('honors office overrides', () => {
    const strip = resolveRentNewsletterStrip({
      rent_newsletter_enabled: true,
      rent_newsletter_title: 'Νέα από το γραφείο μας',
      rent_newsletter_panel_color: '#abcdef',
      rent_newsletter_button_label: 'Εγγραφή',
      rent_newsletter_interests: [{ id: 'a', label: 'Στόλος' }],
      footer_privacy_url: '/privacy',
      footer_privacy_label: 'Απόρρητο',
    });
    expect(strip.title).toBe('Νέα από το γραφείο μας');
    expect(strip.panel_color).toBe('#abcdef');
    expect(strip.button_label).toBe('Εγγραφή');
    expect(strip.interests).toEqual([{ id: 'a', label: 'Στόλος' }]);
    expect(strip.privacy_url).toBe('/privacy');
    expect(strip.privacy_label).toBe('Απόρρητο');
  });

  it('can be disabled', () => {
    const strip = resolveRentNewsletterStrip({ rent_newsletter_enabled: false });
    expect(strip.enabled).toBe(false);
  });
});
