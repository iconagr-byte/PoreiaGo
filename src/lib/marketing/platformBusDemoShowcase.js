/**
 * Marketing homepage demo: bus στόλος + εκδρομές (όχι rent cars).
 * Matches the public fleet API shape used by FleetShowcaseSection.
 */
import { mockTrips } from '../../data/mockData.js';
import { normalizeTrip } from '../trips/tripMarket.js';

export const DEMO_BUS_FLEET = [
  {
    id: 'FL-001',
    name: 'Mercedes Tourismo',
    category: 'Luxury Coach',
    year: 2022,
    seat_count: 50,
    amenities: ['Wi-Fi onboard', 'USB & 220V', 'Κλιματισμός', 'WC onboard'],
    summary: 'Premium coach για μεγάλες αποστάσεις — άνεση VIP επιπέδου.',
    image_url: '/images/hero-bus-achillio.png',
    status_label: 'Διαθέσιμο',
  },
  {
    id: 'FL-002',
    name: 'Scania Irizar i6',
    category: 'Premium Express',
    year: 2021,
    seat_count: 32,
    amenities: ['Wi-Fi onboard', 'USB θύρες', 'Κλιματισμός', 'Ψυγείο'],
    summary: 'Express στόλος για γρήγορες διαδρομές Ελλάδας & Ευρώπης.',
    image_url: '/images/hero-bus-achillio.png',
    status_label: 'Διαθέσιμο',
  },
  {
    id: 'FL-003',
    name: 'Volvo 9700',
    category: 'Standard',
    year: 2019,
    seat_count: 55,
    amenities: ['Κλιματισμός', 'USB θύρες', 'Θέρμανση'],
    summary: 'Αξιόπιστο coach για ομαδικές εκδρομές και σχολικές μεταφορές.',
    image_url: '/images/fleet-bus-thumb.jpg',
    status_label: 'Διαθέσιμο',
  },
];

/** Domestic-first trip cards for marketing preview. */
export function getPlatformDemoTrips(limit = 3) {
  return mockTrips
    .filter((t) => t && t.id && t.title)
    .sort((a, b) => {
      const am = a.market === 'domestic' ? 0 : 1;
      const bm = b.market === 'domestic' ? 0 : 1;
      return am - bm;
    })
    .slice(0, Math.max(1, limit))
    .map(normalizeTrip);
}

export function getPlatformDemoBuses(limit = 3) {
  return DEMO_BUS_FLEET.slice(0, Math.max(1, limit));
}

export const PLATFORM_OPS_COPY = {
  kicker: 'Προεπισκόπηση πλατφόρμας',
  title: 'Έτσι φαίνονται οι εκδρομές και ο στόλος',
  subtitle:
    'Κάρτες ταξιδιών και λεωφορεία — όπως θα τα βλέπει ο πελάτης του γραφείου σας στο site σας.',
};
