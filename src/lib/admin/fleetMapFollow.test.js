import assert from 'node:assert/strict';
import {
  haversineMeters,
  lngLatInPaddedBounds,
  pickFollowTarget,
  shouldPanToFollowTarget,
} from './fleetMapFollow.js';

assert.ok(haversineMeters(38.5, 23.0, 38.5, 23.0) < 1);
assert.ok(haversineMeters(38.5, 23.0, 38.501, 23.0) > 80);

const one = { id: 'a', lat: 39.16, lng: 26.5, speed_kmh: 72 };
assert.equal(pickFollowTarget([one])?.id, 'a');
assert.equal(pickFollowTarget([one, { id: 'b', lat: 1, lng: 2 }], 'b')?.id, 'b');
assert.equal(pickFollowTarget([one, { id: 'b', lat: 1, lng: 2 }]), null);

assert.equal(
  shouldPanToFollowTarget({
    speedKmh: 72,
    distanceFromCenterM: 40,
    pinInView: true,
    dragging: false,
  }),
  true,
);
assert.equal(
  shouldPanToFollowTarget({
    speedKmh: 72,
    distanceFromCenterM: 5,
    pinInView: true,
  }),
  false,
);
assert.equal(
  shouldPanToFollowTarget({
    speedKmh: 0,
    distanceFromCenterM: 40,
    pinInView: true,
  }),
  false,
);
assert.equal(
  shouldPanToFollowTarget({
    speedKmh: 0,
    distanceFromCenterM: 40,
    pinInView: false,
  }),
  true,
);
assert.equal(
  shouldPanToFollowTarget({
    speedKmh: 72,
    distanceFromCenterM: 400,
    pinInView: false,
    dragging: true,
  }),
  false,
);

const box = { west: 26.4, south: 39.1, east: 26.6, north: 39.2 };
assert.equal(lngLatInPaddedBounds(26.5, 39.15, box, 0.1), true);
assert.equal(lngLatInPaddedBounds(26.41, 39.15, box, 0.1), false);

console.log('fleetMapFollow.test.js: ok');
