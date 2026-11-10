import assert from 'node:assert/strict';
import { resolveFleetFitMaxZoom, resolveFleetFitPadding } from './fleetMapFit.js';

assert.equal(resolveFleetFitMaxZoom(1), 16.5);
assert.equal(resolveFleetFitMaxZoom(0), 16.5);
assert.equal(resolveFleetFitMaxZoom(2), 15);
assert.equal(resolveFleetFitMaxZoom(4), 14);
assert.equal(resolveFleetFitMaxZoom(8), 13);
assert.equal(resolveFleetFitMaxZoom(12), 12);

assert.equal(resolveFleetFitPadding(1), 56);
assert.equal(resolveFleetFitPadding(3), 80);

console.log('fleetMapFit.test.js: ok');
