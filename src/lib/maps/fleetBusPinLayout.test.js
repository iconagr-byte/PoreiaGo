import assert from 'node:assert/strict';
import {
  FLEET_BUS_PIN_ICON_ANCHOR,
  FLEET_BUS_PIN_ICON_SIZE,
  FLEET_BUS_PIN_RING,
} from './fleetBusPinLayout.js';

assert.equal(FLEET_BUS_PIN_RING, 52);
assert.deepEqual(FLEET_BUS_PIN_ICON_SIZE, [52, 52]);
assert.deepEqual(FLEET_BUS_PIN_ICON_ANCHOR, [26, 26]);
// Anchor must be the ring center so the photo sits on GPS (not below labels).
assert.equal(FLEET_BUS_PIN_ICON_ANCHOR[0], FLEET_BUS_PIN_RING / 2);
assert.equal(FLEET_BUS_PIN_ICON_ANCHOR[1], FLEET_BUS_PIN_RING / 2);

console.log('fleetBusPinLayout.test.js: ok');
