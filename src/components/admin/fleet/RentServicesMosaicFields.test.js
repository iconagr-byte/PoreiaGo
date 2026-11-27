/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { ensureRentServicesMosaicForm } from './RentServicesMosaicFields.jsx';

describe('ensureRentServicesMosaicForm', () => {
  it('fills default cards when appearance has none', () => {
    const form = ensureRentServicesMosaicForm({});
    expect(form.rent_services_mosaic_enabled).toBe(true);
    expect(form.rent_services_mosaic_title).toBeTruthy();
    expect(form.rent_services_mosaic_cards.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps custom card titles from appearance', () => {
    const form = ensureRentServicesMosaicForm({
      rent_services_mosaic_title: 'Οι υπηρεσίες μας',
      rent_services_mosaic_cards: [
        { id: 'a', title: 'Κάρτα Α', subtitle: 'κείμενο', image_url: '/x.jpg' },
      ],
    });
    expect(form.rent_services_mosaic_title).toBe('Οι υπηρεσίες μας');
    expect(form.rent_services_mosaic_cards).toHaveLength(1);
    expect(form.rent_services_mosaic_cards[0].title).toBe('Κάρτα Α');
  });
});
