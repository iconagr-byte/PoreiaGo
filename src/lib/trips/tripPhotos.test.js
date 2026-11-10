import { describe, expect, it } from 'vitest';
import {
  bookingCoverUrl,
  findTripForBooking,
  tripCoverUrl,
} from './tripPhotos.js';

describe('bookingCoverUrl', () => {
  const officeCatalog = [
    {
      id: 91001,
      title: 'Ημερήσια στα Μετέωρα',
      image: '/images/meteora.png',
      images: ['/images/meteora.png', '/images/demo/meteora-2.jpg'],
    },
    {
      id: 91003,
      title: 'Μαγευτικά Ιωάννινα',
      image: '/images/ioannina.png',
      images: ['/images/ioannina.png'],
    },
  ];

  it('resolves Achillio seed covers by tripId when local tripStore is empty', () => {
    const cover = bookingCoverUrl(
      { tripId: 91003, tripTitle: 'Μαγευτικά Ιωάννινα' },
      [],
      officeCatalog,
    );
    expect(cover).toBe('/images/ioannina.png');
  });

  it('falls back to title match when tripId is missing', () => {
    const cover = bookingCoverUrl(
      { tripId: 0, tripTitle: 'Ημερήσια στα Μετέωρα' },
      officeCatalog,
    );
    expect(cover).toBe('/images/meteora.png');
  });

  it('prefers booking-embedded cover over catalog', () => {
    const cover = bookingCoverUrl(
      {
        tripId: 91003,
        tripTitle: 'Μαγευτικά Ιωάννινα',
        coverImage: '/images/demo/ioannina-2.jpg',
      },
      officeCatalog,
    );
    expect(cover).toBe('/images/demo/ioannina-2.jpg');
  });

  it('rejects platform default bus as a real cover', () => {
    expect(
      bookingCoverUrl(
        {
          tripId: 1,
          coverImage: '/images/hero-bus-achillio.png',
        },
        [{ id: 1, image: '/images/hero-bus-achillio.png' }],
      ),
    ).toBe('');
  });

  it('matches numeric string tripId to office seed id', () => {
    const trip = findTripForBooking({ tripId: '91001' }, officeCatalog);
    expect(trip?.title).toBe('Ημερήσια στα Μετέωρα');
    expect(tripCoverUrl(trip)).toBe('/images/meteora.png');
  });
});
