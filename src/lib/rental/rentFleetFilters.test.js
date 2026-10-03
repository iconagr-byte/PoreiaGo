import assert from 'node:assert/strict';
import {
  applyRentFleetFilters,
  countRentFleetFilterFacets,
  normalizeTransmissionKey,
  parseLuggageBags,
  rentFleetFiltersActive,
  vehicleFilterTags,
} from './rentFleetFilters.js';

assert.equal(normalizeTransmissionKey('Αυτόματο'), 'automatic');
assert.equal(normalizeTransmissionKey('Χειροκίνητο'), 'manual');
assert.equal(normalizeTransmissionKey('Με ταχύτητες'), 'manual');
assert.equal(parseLuggageBags('3 βαλίτσες'), 3);

const fleet = [
  {
    id: 'a',
    model: 'Toyota Corolla',
    category: 'intermediate',
    transmission: 'Αυτόματο',
    transmission_key: 'automatic',
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
    luggage: 'Μεγάλος χώρος φόρτωσης',
    luggage_bags: 0,
    seating_capacity: 9,
    highlights: ['Airport transfers'],
  },
];

const autoOnly = applyRentFleetFilters(fleet, {
  locations: [],
  transmissions: ['automatic'],
  extras: [],
  luggage: [],
});
assert.equal(autoOnly.length, 1);
assert.equal(autoOnly[0].id, 'a');

const bags3 = applyRentFleetFilters(fleet, {
  locations: [],
  transmissions: [],
  extras: [],
  luggage: [3],
});
assert.ok(bags3.some((v) => v.id === 'a'));
assert.ok(bags3.some((v) => v.id === 'c')); // cargo counts as 5+
assert.ok(!bags3.some((v) => v.id === 'b'));

const tags = vehicleFilterTags(fleet[2]);
assert.ok(tags.locations.includes('airport_terminal'));
assert.ok(tags.extras.includes('extra_driver'));

const facets = countRentFleetFilterFacets(fleet, {
  locations: [],
  transmissions: [],
  extras: [],
  luggage: [],
});
assert.equal(facets.transmissions.automatic, 1);
assert.equal(facets.transmissions.manual, 2);
assert.equal(rentFleetFiltersActive({ transmissions: ['automatic'] }), true);
assert.equal(rentFleetFiltersActive({ locations: [], transmissions: [], extras: [], luggage: [] }), false);

console.log('rentFleetFilters.test.js: ok');
