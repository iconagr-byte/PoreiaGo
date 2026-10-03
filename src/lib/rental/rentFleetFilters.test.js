import assert from 'node:assert/strict';
import {
  EMPTY_RENT_FLEET_FILTERS,
  applyRentFleetFilters,
  countRentFleetFilterFacets,
  normalizeFuelTypeKey,
  normalizeTransmissionKey,
  parseLuggageBags,
  rentFleetFiltersActive,
  vehicleFilterTags,
} from './rentFleetFilters.js';

assert.equal(normalizeTransmissionKey('Αυτόματο'), 'automatic');
assert.equal(normalizeTransmissionKey('Χειροκίνητο'), 'manual');
assert.equal(normalizeTransmissionKey('Με ταχύτητες'), 'manual');
assert.equal(parseLuggageBags('3 βαλίτσες'), 3);
assert.equal(normalizeFuelTypeKey('Πλήρως ηλεκτρικό'), 'electric');
assert.equal(normalizeFuelTypeKey('Υβριδικό'), 'hybrid');
assert.equal(normalizeFuelTypeKey('Plug-in hybrid'), 'plug_in_hybrid');
assert.equal(normalizeFuelTypeKey('Βενζίνη'), 'petrol_diesel');
assert.equal(normalizeFuelTypeKey('Ντίζελ'), 'petrol_diesel');

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
assert.equal(petrolDiesel.length, 2);

const bags3 = applyRentFleetFilters(fleet, {
  ...EMPTY_RENT_FLEET_FILTERS,
  luggage: [3],
});
assert.ok(bags3.some((v) => v.id === 'a'));
assert.ok(bags3.some((v) => v.id === 'c')); // cargo counts as 5+
assert.ok(!bags3.some((v) => v.id === 'b'));

const tags = vehicleFilterTags(fleet[2]);
assert.ok(tags.locations.includes('airport_terminal'));
assert.ok(tags.extras.includes('extra_driver'));
assert.equal(tags.fuelType, 'petrol_diesel');
assert.equal(vehicleFilterTags(fleet[0]).fuelType, 'hybrid');

const facets = countRentFleetFilterFacets(fleet, { ...EMPTY_RENT_FLEET_FILTERS });
assert.equal(facets.transmissions.automatic, 1);
assert.equal(facets.transmissions.manual, 2);
assert.equal(facets.fuelTypes.hybrid, 1);
assert.equal(facets.fuelTypes.petrol_diesel, 2);
assert.equal(rentFleetFiltersActive({ fuelTypes: ['electric'] }), true);
assert.equal(rentFleetFiltersActive({ ...EMPTY_RENT_FLEET_FILTERS }), false);

console.log('rentFleetFilters.test.js: ok');
