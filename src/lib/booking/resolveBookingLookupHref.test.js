import {
  BOOKING_LOOKUP_LABEL,
  resolveBookingLookupHref,
} from './resolveBookingLookupHref.js';

const tripsOnly = { trips_enabled: true, rent_enabled: false, mode: 'trips_only' };
const rentOnly = { trips_enabled: false, rent_enabled: true, mode: 'rent_only' };
const both = { trips_enabled: true, rent_enabled: true, mode: 'both' };

console.assert(BOOKING_LOOKUP_LABEL === 'Εύρεση κράτησης', 'label');
console.assert(
  resolveBookingLookupHref(tripsOnly) === '/my-booking',
  'trips → bus lookup',
);
console.assert(
  resolveBookingLookupHref(rentOnly) === '/rent/my-booking',
  'rent-only → rent lookup',
);
console.assert(
  resolveBookingLookupHref(both) === '/my-booking',
  'both → bus lookup by default',
);
console.assert(
  resolveBookingLookupHref(both, { preferRent: true }) === '/rent/my-booking',
  'both + preferRent → rent lookup',
);
console.assert(
  resolveBookingLookupHref(tripsOnly, { preferRent: true }) === '/my-booking',
  'preferRent ignored when rent off',
);

console.log('resolveBookingLookupHref.test.js: ok');
