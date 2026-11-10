/**
 * One booking-lookup entry → bus or rent page from office contract modules.
 */
import {
  isRentOnlyModules,
  officeModeFromModules,
} from '../admin/officeDesignPages.js';

/**
 * @param {object} [modules]
 * @param {{ preferRent?: boolean }} [opts]
 * @returns {'/my-booking'|'/rent/my-booking'}
 */
export function resolveBookingLookupHref(modules, opts = {}) {
  const mode = officeModeFromModules(modules);
  const rentOn = Boolean(modules?.rent_enabled) || mode === 'rent_only' || mode === 'both';

  if (isRentOnlyModules(modules) || mode === 'rent_only') {
    return '/rent/my-booking';
  }
  // Rent login /rent journey → rent finder when the office has Rent.
  if (opts.preferRent && rentOn) {
    return '/rent/my-booking';
  }
  return '/my-booking';
}

/** Short label — no bus/rent split in the UI. */
export const BOOKING_LOOKUP_LABEL = 'Εύρεση κράτησης';
