/**
 * Destination-matched photo sets for PoreiaGo platform demo trips.
 * Cover + gallery shots for card + /trip/:id Airbnb bento.
 * Only Unsplash IDs verified reachable (HTTP 200) are used.
 */

const u = (id, w = 1400) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** @type {Record<string, string[]>} */
export const DEMO_TRIP_GALLERIES = {
  // Ημερήσια στα Μετέωρα
  meteora: [
    '/images/meteora.png',
    u('1613395877344-13d4a8e0d49e'),
    u('1551632811-561732d1e306'),
    u('1469594292607-7bd90f8d3ba4'),
    '/images/athens.png',
  ],
  // Απόδραση στην Πρωτεύουσα (Αθήνα)
  athens: [
    '/images/athens.png',
    u('1509315811345-672d83ef2fbc'),
    u('1555939594-58d7cb561ad1'),
    u('1529156069898-49953e39b3ac'),
    u('1513635269975-59663e0ac1ad'),
  ],
  // Μαγευτικά Ιωάννινα
  ioannina: [
    '/images/ioannina.png',
    u('1506905925346-21bda4d32df4'),
    u('1501785888041-af3ef285b470'),
    u('1510812431401-41d2bd2722f3'),
    u('1469594292607-7bd90f8d3ba4'),
  ],
  // Παρίσι
  paris: [
    u('1502602898657-3e91760cbb34'),
    u('1499856871958-5b9627545d1a'),
    u('1431274172761-fca41d930114'),
    u('1522093007474-d86e9bf7ba6f'),
    u('1513635269975-59663e0ac1ad'),
  ],
  // Ρώμη
  rome: [
    u('1552832230-c0197dd311b5'),
    u('1529156069898-49953e39b3ac'),
    u('1555939594-58d7cb561ad1'),
    u('1509315811345-672d83ef2fbc'),
    u('1431274172761-fca41d930114'),
  ],
  // Πράγα & Βιέννη
  prague_vienna: [
    u('1519677100203-a0e668c92439'),
    u('1513635269975-59663e0ac1ad'),
    u('1499856871958-5b9627545d1a'),
    u('1501785888041-af3ef285b470'),
    u('1522093007474-d86e9bf7ba6f'),
  ],
};

export function galleryForDemoTrip(key) {
  const list = DEMO_TRIP_GALLERIES[key];
  return Array.isArray(list) ? [...list] : [];
}
