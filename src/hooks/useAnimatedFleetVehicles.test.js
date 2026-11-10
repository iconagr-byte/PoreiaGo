import assert from 'node:assert/strict';
import { offsetLatLngByMotion } from './useAnimatedFleetVehicles.js';

// 1s at 90 km/h north ≈ 25 m → ~0.000225° latitude
const north = offsetLatLngByMotion(39.5, 20.9, 0, 90, 1, 1);
assert.ok(north.lat > 39.5);
assert.ok(Math.abs(north.lng - 20.9) < 1e-8);
assert.ok(Math.abs(north.lat - 39.5 - 25 / 111320) < 1e-7);

// East bound moves longitude
const east = offsetLatLngByMotion(39.5, 20.9, 90, 90, 1, 1);
assert.ok(east.lng > 20.9);
assert.ok(Math.abs(east.lat - 39.5) < 1e-8);

// Stationary / invalid → unchanged
const still = offsetLatLngByMotion(39.5, 20.9, 45, 0, 1, 1);
assert.equal(still.lat, 39.5);
assert.equal(still.lng, 20.9);

console.log('useAnimatedFleetVehicles.test.js: ok');
