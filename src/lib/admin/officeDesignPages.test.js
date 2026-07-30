/**
 * Smoke tests for design-page gating from office contract modules.
 */
import {
  contractDesignLabel,
  designPagesForModules,
  officeModeFromModules,
  resolveDesignPageForModules,
} from './officeDesignPages.js';

const tripsOnly = { trips_enabled: true, rent_enabled: false, mode: 'trips_only' };
const rentOnly = { trips_enabled: false, rent_enabled: true, mode: 'rent_only' };
const both = { trips_enabled: true, rent_enabled: true, mode: 'both' };

console.assert(officeModeFromModules(tripsOnly) === 'trips_only', 'trips mode');
console.assert(officeModeFromModules(rentOnly) === 'rent_only', 'rent mode');
console.assert(officeModeFromModules(both) === 'both', 'both mode');

console.assert(
  designPagesForModules(tripsOnly).map((p) => p.id).join(',') === 'home',
  'trips pages',
);
console.assert(
  designPagesForModules(rentOnly).map((p) => p.id).join(',') === 'rent',
  'rent pages',
);
console.assert(
  designPagesForModules(both).map((p) => p.id).join(',') === 'home,rent',
  'both pages',
);

console.assert(resolveDesignPageForModules('rent', tripsOnly) === 'home', 'clamp rent→home');
console.assert(resolveDesignPageForModules('home', rentOnly) === 'rent', 'clamp home→rent');
console.assert(resolveDesignPageForModules('rent', both) === 'rent', 'both keeps rent');
console.assert(contractDesignLabel('both').includes('Λεωφορεία'), 'label both');

console.log('officeDesignPages: OK');
