/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENT_SERVICES_MOSAIC_CARDS,
  resolveRentServicesMosaic,
} from './rentServicesMosaic.js';

describe('resolveRentServicesMosaic', () => {
  it('falls back to default story panes when cards are empty', () => {
    const mosaic = resolveRentServicesMosaic({});
    expect(mosaic.enabled).toBe(true);
    expect(mosaic.title).toContain('γραφείου');
    expect(mosaic.lead).toContain('γραφείο');
    expect(mosaic.cards).toHaveLength(DEFAULT_RENT_SERVICES_MOSAIC_CARDS.length);
    expect(mosaic.cards[0].title).toBe(DEFAULT_RENT_SERVICES_MOSAIC_CARDS[0].title);
    expect(mosaic.cards.every((c) => c.image_url.startsWith('/images/rent-svc-'))).toBe(
      true,
    );
  });

  it('uses office copy and cards when set', () => {
    const mosaic = resolveRentServicesMosaic({
      rent_services_mosaic_kicker: 'IconaRent',
      rent_services_mosaic_title: 'Υπηρεσίες δίπλα σας',
      rent_services_mosaic_lead: 'Από το γραφείο.',
      rent_services_mosaic_cards: [
        {
          title: 'Chauffeur',
          subtitle: 'Οδηγός με ραντεβού',
          body: 'Λεπτομέρειες υπηρεσίας.',
          href: '/rent/services',
          cta_label: 'Κλείσε τώρα',
          icon: 'airline_seat_recline_extra',
        },
      ],
    });
    expect(mosaic.kicker).toBe('IconaRent');
    expect(mosaic.title).toBe('Υπηρεσίες δίπλα σας');
    expect(mosaic.cards).toHaveLength(1);
    expect(mosaic.cards[0].href).toBe('/rent/services');
    expect(mosaic.cards[0].body).toBe('Λεπτομέρειες υπηρεσίας.');
    expect(mosaic.cards[0].cta_label).toBe('Κλείσε τώρα');
  });

  it('can be disabled from the office', () => {
    const mosaic = resolveRentServicesMosaic({
      rent_services_mosaic_enabled: false,
      rent_services_mosaic_cards: [{ title: 'Hidden' }],
    });
    expect(mosaic.enabled).toBe(false);
  });
});
