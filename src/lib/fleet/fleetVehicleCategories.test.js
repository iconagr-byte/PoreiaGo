import assert from 'node:assert/strict';
import {
  fleetCategoryLabel,
  fleetCategoryMeta,
} from './fleetVehicleCategories.js';

assert.equal(fleetCategoryLabel('Luxury Coach'), 'Πολυτελές λεωφορείο');
assert.equal(fleetCategoryLabel('Premium Express'), 'Εξπρές πολυτελείας');
assert.equal(fleetCategoryLabel('Standard'), 'Κλασικό λεωφορείο');
assert.equal(fleetCategoryLabel('Van'), 'Μικρό λεωφορείο / van');
assert.equal(fleetCategoryLabel('van'), 'Μικρό λεωφορείο / van');
assert.equal(fleetCategoryLabel(''), '—');
assert.equal(fleetCategoryMeta('Van').icon, 'airport_shuttle');

console.log('fleetVehicleCategories.test.js: ok');
