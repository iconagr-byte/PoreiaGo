/**
 * Curated demo showcase for PoreiaGo marketing homepage —
 * prospective buyers see στόλος + εκδρομές without an office tenant.
 */
import { mockTrips } from '../../data/mockData.js';
import { DEMO_RENT_FLEET } from '../rental/demoRentFleet.js';

/** First N rent vehicles for homepage preview cards. */
export function getPlatformDemoFleetPreview(limit = 3) {
  return DEMO_RENT_FLEET.slice(0, Math.max(1, limit)).map((v) => ({
    id: v.id,
    title: v.model,
    blurb: v.description,
    priceLabel: `από ${Number(v.daily_rate_eur || 0)}€ / ημέρα`,
    seats: v.seating_capacity,
    photo: v.photo_url,
    href: '/rent#rent-guest-fleet',
  }));
}

/** Domestic-first demo excursions for homepage preview. */
export function getPlatformDemoTripPreview(limit = 3) {
  const trips = mockTrips
    .filter((t) => t && t.id && t.title)
    .sort((a, b) => {
      const am = a.market === 'domestic' ? 0 : 1;
      const bm = b.market === 'domestic' ? 0 : 1;
      return am - bm;
    });

  return trips.slice(0, Math.max(1, limit)).map((t) => {
    const price = Number(t.price || 0);
    const seats = Number(t.availableSeats ?? t.available_seats ?? 0);
    return {
      id: t.id,
      title: t.title,
      blurb: t.hook || t.description || '',
      priceLabel: price > 0 ? `από ${price.toFixed(0)}€` : 'Δείτε τιμές',
      seats,
      photo: t.image || t.coverImage || '/images/meteora.png',
      href: `/trip/${t.id}`,
    };
  });
}

export const PLATFORM_DEMO_COPY = {
  kicker: 'Live demo · χωρίς εγγραφή',
  title: 'Δείτε πώς φαίνεται η πλατφόρμα',
  subtitle:
    'Στόλος ενοικιάσεων και εκδρομές demo — όπως θα τα βλέπει ο πελάτης του γραφείου σας.',
  fleetTitle: 'Στόλος demo',
  fleetCta: 'Άνοιγμα Rent',
  tripsTitle: 'Εκδρομές demo',
  tripsCta: 'Δείτε εκδρομές',
};
