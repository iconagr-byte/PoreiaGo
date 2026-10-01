import assert from 'node:assert/strict';
import {
  formatFleetGpsSourceBadge,
  fleetGpsSourceToneClass,
  resolveFleetGpsSource,
  resolveFleetGpsSources,
  formatFleetGpsSourceChipLabel,
} from './fleetGpsSourceBadge.js';

const now = new Date().toISOString();
const old = new Date(Date.now() - 10 * 60_000).toISOString();

assert.equal(
  resolveFleetGpsSource({ source: 'teltonika', timestamp: now, tracker_signal_at: now }),
  'teltonika',
);
assert.equal(resolveFleetGpsSource({ source: 'driver_pwa', timestamp: now }), 'app');
assert.equal(
  formatFleetGpsSourceBadge({ source: 'teltonika', timestamp: now, tracker_signal_at: now }),
  'GPS οχήματος',
);
assert.equal(formatFleetGpsSourceBadge({ source: 'driver_pwa', timestamp: now }), 'App οδηγού');
assert.equal(formatFleetGpsSourceBadge({}), '');

assert.deepEqual(
  resolveFleetGpsSources({
    source: 'teltonika',
    imei: '861',
    app_seen_at: now,
    tracker_signal_at: now,
    gps_sources: ['teltonika', 'app'],
  }),
  ['teltonika', 'app'],
);

assert.equal(
  formatFleetGpsSourceBadge({
    source: 'teltonika',
    app_seen_at: now,
    tracker_signal_at: now,
  }),
  'GPS οχήματος · App',
);
assert.equal(formatFleetGpsSourceChipLabel('teltonika'), 'GPS οχήματος');

// Server list omitted app — still dual when app_seen_at is fresh.
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'teltonika',
    imei: '861',
    app_seen_at: now,
    tracker_signal_at: now,
    gps_sources: ['teltonika'],
  }),
  ['teltonika', 'app'],
);

// Cleared App after logout — Teltonika-only (no resurrect from empty stamp).
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'teltonika',
    imei: '861',
    app_seen_at: null,
    tracker_signal_at: now,
    gps_sources: ['teltonika'],
  }),
  ['teltonika'],
);

// App-sourced row + server says both — show Teltonika · App (device online).
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'driver_pwa',
    app_seen_at: now,
    timestamp: now,
    gps_sources: ['teltonika', 'app'],
  }),
  ['teltonika', 'app'],
);

// Closed / hydrated Teltonika must not show as an open channel next to App.
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'teltonika',
    imei: '861',
    hydrated_from_store: true,
    tracker_signal_at: old,
    updated_at: now,
    app_seen_at: now,
    gps_sources: ['teltonika', 'app'],
  }),
  ['app'],
);

assert.equal(formatFleetGpsSourceChipLabel('app'), 'App');
assert.equal(
  fleetGpsSourceToneClass({
    source: 'teltonika',
    app_seen_at: now,
    tracker_signal_at: now,
  }),
  'fleet-apple-bus-gps-source--dual',
);
assert.equal(
  fleetGpsSourceToneClass({ source: 'teltonika', tracker_signal_at: now, timestamp: now }),
  'fleet-apple-bus-gps-source--teltonika',
);
assert.equal(
  fleetGpsSourceToneClass({ source: 'driver_pwa', timestamp: now }),
  'fleet-apple-bus-gps-source--app',
);

console.log('fleetGpsSourceBadge.test.js: ok');
