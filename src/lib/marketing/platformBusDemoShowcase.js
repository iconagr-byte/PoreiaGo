/**
 * Marketing homepage demo: bus στόλος + εκδρομές (όχι rent cars).
 * Matches the public fleet API shape used by FleetShowcaseSection.
 * Images are unmarked coaches (no Achillio / office branding).
 */
import { mockTrips } from '../../data/mockData.js';
import { isPlatformMarketingHost, isTenantStorefrontHost } from '../platform/tenantHost.js';
import { normalizeTrip } from '../trips/tripMarket.js';

/**
 * Seat map + checkout on poreiago.com (and localhost) are a walkthrough only —
 * no real fleet block, booking, wallet claim, or charge.
 */
export function isPlatformSeatBookingDemo(hostname) {
  return isPlatformMarketingHost(hostname) && !isTenantStorefrontHost(hostname);
}

export const DEMO_BUS_FLEET = [
  {
    id: 'FL-001',
    name: 'Mercedes Tourismo',
    category: 'Luxury Coach',
    year: 2022,
    seat_count: 50,
    color: 'Λευκό',
    amenities: ['Wi-Fi onboard', 'USB & 220V', 'Κλιματισμός', 'WC onboard'],
    summary: 'Premium coach για μεγάλες αποστάσεις — άνεση VIP επιπέδου.',
    image_url: '/images/fleet-bus-white-tourismo.png',
    status_label: 'Διαθέσιμο',
  },
  {
    id: 'FL-002',
    name: 'Scania Irizar i6',
    category: 'Premium Express',
    year: 2021,
    seat_count: 32,
    color: 'Μαύρο',
    amenities: ['Wi-Fi onboard', 'USB θύρες', 'Κλιματισμός', 'Ψυγείο'],
    summary: 'Express στόλος για γρήγορες διαδρομές Ελλάδας & Ευρώπης.',
    image_url: '/images/fleet-bus-black-express.png',
    status_label: 'Διαθέσιμο',
  },
  {
    id: 'FL-003',
    name: 'Volvo 9700',
    category: 'Standard',
    year: 2019,
    seat_count: 55,
    color: 'Λευκό',
    amenities: ['Κλιματισμός', 'USB θύρες', 'Θέρμανση'],
    summary: 'Αξιόπιστο coach για ομαδικές εκδρομές και σχολικές μεταφορές.',
    image_url: '/images/fleet-bus-white-standard.png',
    status_label: 'Διαθέσιμο',
  },
];

/** Domestic-first trip cards for marketing preview. */
export function getPlatformDemoTrips(limit = 3) {
  return getPlatformDemoDomesticTrips(limit);
}

export function getPlatformDemoDomesticTrips(limit = 3) {
  return mockTrips
    .filter((t) => t && t.id && t.title && t.market !== 'international' && t.category !== 'international')
    .slice(0, Math.max(1, limit))
    .map(normalizeTrip);
}

/** International excursion cards for the horizontal «Εξωτερικό» tab. */
export function getPlatformDemoInternationalTrips(limit = 3) {
  return mockTrips
    .filter((t) => t && t.id && t.title && (t.market === 'international' || t.category === 'international'))
    .slice(0, Math.max(1, limit))
    .map(normalizeTrip);
}

/** Alias — horizontal abroad strip uses the same international demo set. */
export function getPlatformDemoIntlTrips(limit = 3) {
  return getPlatformDemoInternationalTrips(limit);
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
