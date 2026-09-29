import assert from 'node:assert/strict';
import {
  formatFleetGpsSourceBadge,
  fleetGpsSourceToneClass,
  resolveFleetGpsSource,
} from './fleetGpsSourceBadge.js';

assert.equal(resolveFleetGpsSource({ source: 'teltonika' }), 'teltonika');
assert.equal(resolveFleetGpsSource({ source: 'teltonika_test_ping' }), 'teltonika');
assert.equal(resolveFleetGpsSource({ source: 'driver_pwa' }), 'app');
assert.equal(resolveFleetGpsSource({ imei: '861076085468260' }), 'teltonika');
assert.equal(resolveFleetGpsSource({}), '');

assert.equal(formatFleetGpsSourceBadge({ source: 'teltonika' }), 'Teltonika');
assert.equal(formatFleetGpsSourceBadge({ source: 'driver_pwa' }), 'App οδηγού');
assert.equal(formatFleetGpsSourceBadge({}), '');

assert.equal(
  fleetGpsSourceToneClass({ source: 'teltonika' }),
  'fleet-apple-bus-gps-source--teltonika',
);
assert.equal(
  fleetGpsSourceToneClass({ source: 'driver_pwa' }),
  'fleet-apple-bus-gps-source--app',
);

console.log('fleetGpsSourceBadge.test.js: ok');
