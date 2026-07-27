/**
 * Smoke test for Rent-only admin nav helpers.
 */
import {
  defaultAdminTabForOfficeMode,
  getRentOnlyNavLayout,
  isAdminTabAllowedForOfficeMode,
  navLayoutForOfficeMode,
  RENT_ONLY_MAIN_NAV_ORDER,
} from './sidebarNav.js';

const rentLayout = getRentOnlyNavLayout(false);
console.assert(rentLayout.fleet_ops.length === 0, 'rent layout has no fleet_ops');
console.assert(rentLayout.main.includes('fleet_rental'), 'rent layout includes fleet_rental');
console.assert(!rentLayout.main.includes('routes'), 'rent layout hides routes');
console.assert(
  RENT_ONLY_MAIN_NAV_ORDER.every((id) => rentLayout.main.includes(id)),
  'rent main order complete',
);

const filtered = navLayoutForOfficeMode(
  { main: ['routes', 'fleet_rental'], fleet_ops: ['fleet_kpis'], platform: [], settings: [] },
  'rent_only',
  false,
);
console.assert(!filtered.main.includes('routes'), 'navLayoutForOfficeMode strips buses');
console.assert(isAdminTabAllowedForOfficeMode('routes', 'rent_only') === false, 'routes blocked');
console.assert(isAdminTabAllowedForOfficeMode('fleet_rental', 'rent_only') === true, 'rent allowed');
console.assert(defaultAdminTabForOfficeMode('rent_only') === 'fleet_rental', 'default rent tab');
console.assert(isAdminTabAllowedForOfficeMode('routes', 'trips_only') === true, 'bus mode keeps routes');

console.log('rentAdminNav: OK');
