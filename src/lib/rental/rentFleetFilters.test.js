import assert from 'node:assert/strict';
import {
  EMPTY_RENT_FLEET_FILTERS,
  applyRentFleetFilters,
  countRentFleetFilterFacets,
  normalizeExtraKey,
  normalizeFuelTypeKey,
  normalizeTransmissionKey,
  parseLuggageBags,
  rentFleetFiltersActive,
  vehicleFilterTags,
} from './rentFleetFilters.js';
import { enrichRentFleet } from './rentFleetEnrichment.js';
import { DEMO_RENT_FLEET } from './demoRentFleet.js';

assert.equal(normalizeTransmissionKey('Αυτόματο'), 'automatic');
assert.equal(normalizeTransmissionKey('Χειροκίνητο'), 'manual');
assert.equal(normalizeTransmissionKey('Με ταχύτητες'), 'manual');
assert.equal(parseLuggageBags('3 βαλίτσες'), 3);
assert.equal(normalizeFuelTypeKey('Πλήρως ηλεκτρικό'), 'electric');
assert.equal(normalizeFuelTypeKey('Υβριδικό'), 'hybrid');
assert.equal(normalizeFuelTypeKey('Plug-in hybrid'), 'plug_in_hybrid');
assert.equal(normalizeFuelTypeKey('Βενζίνη'), 'petrol_diesel');
assert.equal(normalizeFuelTypeKey('Ντίζελ'), 'petrol_diesel');
assert.equal(normalizeExtraKey('GPS'), 'gps');
assert.equal(normalizeExtraKey('Επιπλέον οδηγός'), 'extra_driver');
assert.equal(normalizeExtraKey('Κάθισμα βρέφους'), 'baby_seat');

const fleet = [
  {
    id: 'a',
    model: 'Toyota Corolla',
    category: 'intermediate',
    transmission: 'Αυτόματο',
    transmission_key: 'automatic',
    fuel: 'Υβριδικό',
    luggage: '3 βαλίτσες',
    luggage_bags: 3,
    seating_capacity: 5,
    highlights: ['Bluetooth'],
  },
  {
    id: 'b',
    model: 'Renault Clio',
    category: 'compact',
    transmission: 'Χειροκίνητο',
    transmission_key: 'manual',
    fuel: 'Βενζίνη',
    luggage: '2 βαλίτσες',
    luggage_bags: 2,
    seating_capacity: 5,
    highlights: [],
  },
  {
    id: 'c',
    model: 'Ford Transit Custom',
    category: 'van',
    transmission: 'Χειροκίνητο',
    transmission_key: 'manual',
    fuel: 'Ντίζελ',
    luggage: 'Μεγάλος χώρος φόρτωσης',
    luggage_bags: 0,
    seating_capacity: 9,
    highlights: ['Airport transfers'],
  },
  {
    id: 'd',
    model: 'Toyota Aygo X',
    category: 'mini',
    transmission: 'Χειροκίνητο',
    transmission_key: 'manual',
    fuel: 'Βενζίνη',
    luggage: '1 βαλίτσα',
    luggage_bags: 1,
    seating_capacity: 4,
    highlights: ['A/C'],
  },
];

const autoOnly = applyRentFleetFilters(fleet, {
  ...EMPTY_RENT_FLEET_FILTERS,
  transmissions: ['automatic'],
});
assert.equal(autoOnly.length, 1);
assert.equal(autoOnly[0].id, 'a');

const hybridOnly = applyRentFleetFilters(fleet, {
  ...EMPTY_RENT_FLEET_FILTERS,
  fuelTypes: ['hybrid'],
});
assert.equal(hybridOnly.length, 1);
assert.equal(hybridOnly[0].id, 'a');

const petrolDiesel = applyRentFleetFilters(fleet, {
  ...EMPTY_RENT_FLEET_FILTERS,
  fuelTypes: ['petrol_diesel'],
});
assert.equal(petrolDiesel.length, 3);

const bags3 = applyRentFleetFilters(fleet, {
  ...EMPTY_RENT_FLEET_FILTERS,
  luggage: [3],
});
assert.ok(bags3.some((v) => v.id === 'a'));
assert.ok(bags3.some((v) => v.id === 'c')); // cargo counts as 5+
assert.ok(!bags3.some((v) => v.id === 'b'));

const tagsVan = vehicleFilterTags(fleet[2]);
assert.ok(tagsVan.locations.includes('airport_terminal'));
assert.ok(!tagsVan.locations.includes('other'), 'airport vans must not also tag as other');
assert.ok(tagsVan.extras.includes('gps'));
assert.ok(tagsVan.extras.includes('wifi'));
assert.equal(tagsVan.fuelType, 'petrol_diesel');
assert.equal(vehicleFilterTags(fleet[0]).fuelType, 'hybrid');

const tagsMini = vehicleFilterTags(fleet[3]);
assert.deepEqual(tagsMini.locations, ['other']);
assert.ok(!tagsMini.extras.includes('gps'), 'mini city cars should not always have GPS');
assert.ok(!tagsMini.extras.includes('extra_driver'));

const otherOnly = applyRentFleetFilters(fleet, {
  ...EMPTY_RENT_FLEET_FILTERS,
  locations: ['other'],
});
assert.ok(otherOnly.every((v) => v.id !== 'c'));
assert.ok(otherOnly.some((v) => v.id === 'd'));
assert.ok(otherOnly.length < fleet.length, 'Άλλα σημεία must shrink the list');

const gpsOnly = applyRentFleetFilters(fleet, {
  ...EMPTY_RENT_FLEET_FILTERS,
  extras: ['gps'],
});
assert.ok(gpsOnly.every((v) => vehicleFilterTags(v).extras.includes('gps')));
assert.ok(gpsOnly.length < fleet.length, 'GPS filter must shrink the list');

const facets = countRentFleetFilterFacets(fleet, { ...EMPTY_RENT_FLEET_FILTERS });
assert.equal(facets.transmissions.automatic, 1);
assert.equal(facets.transmissions.manual, 3);
assert.equal(facets.fuelTypes.hybrid, 1);
assert.equal(facets.fuelTypes.petrol_diesel, 3);
assert.ok(facets.locations.other < fleet.length);
assert.ok(facets.extras.gps < fleet.length);
assert.equal(rentFleetFiltersActive({ fuelTypes: ['electric'] }), true);
assert.equal(rentFleetFiltersActive({ ...EMPTY_RENT_FLEET_FILTERS }), false);

// Demo showcase fleet: every filter family must be able to change results.
const demo = enrichRentFleet(DEMO_RENT_FLEET);
assert.ok(demo.length >= 4);
const demoFacets = countRentFleetFilterFacets(demo, { ...EMPTY_RENT_FLEET_FILTERS });
assert.ok(demoFacets.transmissions.automatic > 0);
assert.ok(demoFacets.transmissions.manual > 0);
assert.ok(demoFacets.fuelTypes.electric > 0, 'demo must expose electric for fuel filter');
assert.ok(demoFacets.fuelTypes.hybrid > 0, 'demo must expose hybrid for fuel filter');
assert.ok(demoFacets.fuelTypes.petrol_diesel > 0);
assert.ok(demoFacets.locations.other > 0);
assert.ok(demoFacets.locations.airport_terminal > 0);
assert.ok(
  demoFacets.locations.other < demo.length,
  'Άλλα σημεία must not match the entire demo fleet',
);
assert.ok(demoFacets.extras.gps < demo.length);
assert.ok(demoFacets.extras.extra_driver < demo.length || demoFacets.extras.wifi < demo.length);

const demoAuto = applyRentFleetFilters(demo, {
  ...EMPTY_RENT_FLEET_FILTERS,
  transmissions: ['automatic'],
});
assert.ok(demoAuto.length > 0 && demoAuto.length < demo.length);

const demoElectric = applyRentFleetFilters(demo, {
  ...EMPTY_RENT_FLEET_FILTERS,
  fuelTypes: ['electric'],
});
assert.ok(demoElectric.length > 0);
assert.ok(demoElectric.every((v) => vehicleFilterTags(v).fuelType === 'electric'));

const demoOther = applyRentFleetFilters(demo, {
  ...EMPTY_RENT_FLEET_FILTERS,
  locations: ['other'],
});
assert.ok(demoOther.length > 0 && demoOther.length < demo.length);

// Enrichment must keep API fuel/luggage when model is unknown.
const custom = enrichRentFleet([
  {
    id: 'custom-1',
    model: 'Unknown Spec Car',
    category: 'COMPACT',
    seating_capacity: 5,
    fuel: 'Plug-in υβριδικό',
    luggage: '3 βαλίτσες',
    transmission: 'Αυτόματο',
  },
])[0];
assert.equal(custom.fuel, 'Plug-in υβριδικό');
assert.equal(custom.luggage, '3 βαλίτσες');
assert.equal(vehicleFilterTags(custom).fuelType, 'plug_in_hybrid');
assert.equal(vehicleFilterTags(custom).transmission, 'automatic');

console.log('rentFleetFilters.test.js: ok');
