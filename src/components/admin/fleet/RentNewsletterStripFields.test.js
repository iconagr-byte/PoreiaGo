/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { ensureRentNewsletterStripForm } from './RentNewsletterStripFields.jsx';
import { DEFAULT_RENT_NEWSLETTER } from '../../../lib/rental/rentNewsletterStrip.js';

describe('ensureRentNewsletterStripForm', () => {
  it('fills defaults when appearance is empty', () => {
    const form = ensureRentNewsletterStripForm({});
    expect(form.rent_newsletter_enabled).toBe(true);
    expect(form.rent_newsletter_title).toBe(DEFAULT_RENT_NEWSLETTER.title);
    expect(form.rent_newsletter_button_label).toBe(DEFAULT_RENT_NEWSLETTER.button_label);
    expect(form.rent_newsletter_panel_color).toBe(DEFAULT_RENT_NEWSLETTER.panel_color);
  });

  it('keeps custom title and colors from appearance', () => {
    const form = ensureRentNewsletterStripForm({
      rent_newsletter_enabled: false,
      rent_newsletter_title: 'Νέα από το γραφείο',
      rent_newsletter_panel_color: '#abcdef',
      rent_newsletter_button_label: 'Εγγραφή',
    });
    expect(form.rent_newsletter_enabled).toBe(false);
    expect(form.rent_newsletter_title).toBe('Νέα από το γραφείο');
    expect(form.rent_newsletter_panel_color).toBe('#abcdef');
    expect(form.rent_newsletter_button_label).toBe('Εγγραφή');
  });
});
