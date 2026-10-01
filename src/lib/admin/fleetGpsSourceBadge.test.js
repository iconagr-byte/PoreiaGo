import assert from 'node:assert/strict';
import {
  formatFleetGpsSourceBadge,
  fleetGpsSourceToneClass,
  resolveFleetGpsSource,
  resolveFleetGpsSources,
  formatFleetGpsSourceChipLabel,
} from './fleetGpsSourceBadge.js';

assert.equal(resolveFleetGpsSource({ source: 'teltonika' }), 'teltonika');
assert.equal(resolveFleetGpsSource({ source: 'driver_pwa' }), 'app');
assert.equal(formatFleetGpsSourceBadge({ source: 'teltonika' }), 'Teltonika');
assert.equal(formatFleetGpsSourceBadge({ source: 'driver_pwa' }), 'App οδηγού');
assert.equal(formatFleetGpsSourceBadge({}), '');

assert.deepEqual(
  resolveFleetGpsSources({
    source: 'teltonika',
    imei: '861',
    app_seen_at: new Date().toISOString(),
    gps_sources: ['teltonika', 'app'],
  }),
  ['teltonika', 'app'],
);

assert.equal(
  formatFleetGpsSourceBadge({
    source: 'teltonika',
    app_seen_at: new Date().toISOString(),
  }),
  'Teltonika · App',
);

assert.equal(formatFleetGpsSourceChipLabel('app'), 'App');
assert.equal(
  fleetGpsSourceToneClass({
    source: 'teltonika',
    app_seen_at: new Date().toISOString(),
  }),
  'fleet-apple-bus-gps-source--dual',
);
assert.equal(
  fleetGpsSourceToneClass({ source: 'teltonika' }),
  'fleet-apple-bus-gps-source--teltonika',
);
assert.equal(
  fleetGpsSourceToneClass({ source: 'driver_pwa' }),
  'fleet-apple-bus-gps-source--app',
);

console.log('fleetGpsSourceBadge.test.js: ok');
