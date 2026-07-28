/**
 * Smoke test for Rent-only admin nav helpers + rent desk sidebar section.
 */
import {
  defaultAdminTabForOfficeMode,
  DEFAULT_RENT_NAV_ORDER,
  getDefaultNavLayout,
  getRentOnlyNavLayout,
  isAdminTabAllowedForOfficeMode,
  navItemsFromIds,
  navLayoutForOfficeMode,
  RENT_ONLY_MAIN_NAV_ORDER,
  RENT_ONLY_RENT_NAV_ORDER,
} from './sidebarNav.js';
import {
  DEFAULT_RENT_DESK_TAB,
  RENT_DESK_NAV_IDS,
  sanitizeRentDeskTab,
} from './rentDeskNav.js';

const rentLayout = getRentOnlyNavLayout(false);
console.assert(rentLayout.fleet_ops.length === 0, 'rent layout has no fleet_ops');
console.assert(rentLayout.rent.length === RENT_DESK_NAV_IDS.length, 'rent desk tabs present');
console.assert(
  RENT_ONLY_RENT_NAV_ORDER.every((id) => rentLayout.rent.includes(id)),
  'rent desk order complete',
);
console.assert(!rentLayout.main.includes('fleet_rental'), 'legacy fleet_rental removed from main');
console.assert(!rentLayout.main.includes('routes'), 'rent layout hides routes');
console.assert(
  RENT_ONLY_MAIN_NAV_ORDER.every((id) => rentLayout.main.includes(id)),
  'rent main order complete',
);

const filtered = navLayoutForOfficeMode(
  { main: ['routes', 'fleet_rental'], rent: [], fleet_ops: ['fleet_kpis'], platform: [], settings: [] },
  'rent_only',
  false,
);
console.assert(!filtered.main.includes('routes'), 'navLayoutForOfficeMode strips buses');
console.assert(filtered.rent.includes('fleet_rental_clients'), 'rent section injected');
console.assert(isAdminTabAllowedForOfficeMode('routes', 'rent_only') === false, 'routes blocked');
console.assert(isAdminTabAllowedForOfficeMode('fleet_rental', 'rent_only') === true, 'rent allowed');
console.assert(defaultAdminTabForOfficeMode('rent_only') === 'fleet_rental', 'default rent tab');
console.assert(isAdminTabAllowedForOfficeMode('routes', 'trips_only') === true, 'bus mode keeps routes');

const defaults = getDefaultNavLayout(false);
console.assert(
  DEFAULT_RENT_NAV_ORDER.every((id) => defaults.rent.includes(id)),
  'default layout has rent section',
);
console.assert(!defaults.main.includes('fleet_rental'), 'default main has no legacy rent entry');

const rentItems = navItemsFromIds(RENT_DESK_NAV_IDS, false);
console.assert(rentItems.length === RENT_DESK_NAV_IDS.length, 'resolve all rent nav ids');
console.assert(
  rentItems.every((item) => item.type === 'fleet_rental_subtab' && item.tab === 'fleet_rental'),
  'rent items are fleet_rental_subtab',
);
console.assert(sanitizeRentDeskTab('wizard') === 'wizard', 'sanitize keeps valid');
console.assert(sanitizeRentDeskTab('nope') === DEFAULT_RENT_DESK_TAB, 'sanitize fallback');

console.log('rentAdminNav: OK');
