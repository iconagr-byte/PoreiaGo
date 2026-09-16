/**
 * Destination-matched photo sets for PoreiaGo platform demo trips.
 * Local assets under /images/demo/ (verified destination photos) — no mismatched Unsplash.
 */

/** @type {Record<string, string[]>} */
export const DEMO_TRIP_GALLERIES = {
  // Ημερήσια στα Μετέωρα
  meteora: [
    '/images/meteora.png',
    '/images/demo/meteora-2.jpg',
    '/images/demo/meteora-3.jpg',
    '/images/demo/meteora-4.jpg',
    '/images/demo/meteora-5.jpg',
  ],
  // Απόδραση στην Πρωτεύουσα (Αθήνα)
  athens: [
    '/images/athens.png',
    '/images/demo/athens-2.jpg',
    '/images/demo/athens-3.jpg',
    '/images/demo/athens-4.jpg',
    '/images/demo/athens-5.jpg',
  ],
  // Μαγευτικά Ιωάννινα
  ioannina: [
    '/images/ioannina.png',
    '/images/demo/ioannina-2.jpg',
    '/images/demo/ioannina-3.jpg',
    '/images/demo/ioannina-4.jpg',
    '/images/demo/ioannina-5.jpg',
  ],
  // Παρίσι
  paris: [
    '/images/demo/paris-1.jpg',
    '/images/demo/paris-2.jpg',
    '/images/demo/paris-3.jpg',
    '/images/demo/paris-4.jpg',
    '/images/demo/paris-5.jpg',
  ],
  // Ρώμη
  rome: [
    '/images/demo/rome-1.jpg',
    '/images/demo/rome-2.jpg',
    '/images/demo/rome-3.jpg',
    '/images/demo/rome-4.jpg',
    '/images/demo/rome-5.jpg',
  ],
  // Πράγα & Βιέννη
  prague_vienna: [
    '/images/demo/prague-1.jpg',
    '/images/demo/prague-2.jpg',
    '/images/demo/prague-3.jpg',
    '/images/demo/vienna-1.jpg',
    '/images/demo/vienna-2.jpg',
  ],
};

export function galleryForDemoTrip(key) {
  const list = DEMO_TRIP_GALLERIES[key];
  return Array.isArray(list) ? [...list] : [];
}
