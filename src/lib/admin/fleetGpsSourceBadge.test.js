import assert from 'node:assert/strict';
import {
  clearStickyTeltonika,
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

// Online IMEI enrichment: App pin + fresh tracker_signal ⇒ dual (not App-only).
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'driver_pwa',
    imei: '861',
    app_seen_at: now,
    tracker_signal_at: now,
    timestamp: now,
    hydrated_from_store: false,
    gps_sources: ['teltonika', 'app'],
  }),
  ['teltonika', 'app'],
);

// Server omitted Teltonika (device offline) — App-only even with hydrate pin.
clearStickyTeltonika('OFFLINE1');
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'teltonika',
    bus_plate: 'OFFLINE1',
    imei: '999000111222333',
    hydrated_from_store: true,
    tracker_signal_at: old,
    updated_at: now,
    app_seen_at: now,
    gps_sources: ['app'],
  }),
  ['app'],
);

// Server listed both — trust the list (egress already verified IMEI online).
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'driver_pwa',
    imei: '861',
    hydrated_from_store: true,
    tracker_signal_at: old,
    updated_at: now,
    app_seen_at: now,
    gps_sources: ['teltonika', 'app'],
  }),
  ['teltonika', 'app'],
);

// Hydrated + signal within Codec window (≤5 min) → still show hardware chip.
const recentParked = new Date(Date.now() - 2 * 60_000).toISOString();
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'teltonika',
    imei: '861',
    bus_plate: 'EEX5670',
    hydrated_from_store: true,
    tracker_signal_at: recentParked,
    app_seen_at: now,
  }),
  ['teltonika', 'app'],
);

// Sticky dual: after Teltonika was seen, App-only poll still shows both briefly.
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'driver_pwa',
    bus_plate: 'EEX5670',
    imei: '861',
    app_seen_at: now,
    timestamp: now,
    gps_sources: ['teltonika', 'app'],
    tracker_signal_at: now,
  }),
  ['teltonika', 'app'],
);
assert.deepEqual(
  resolveFleetGpsSources({
    source: 'driver_pwa',
    bus_plate: 'EEX5670',
    imei: '861',
    app_seen_at: now,
    timestamp: now,
    gps_sources: ['app'],
    tracker_signal_at: old,
    hydrated_from_store: false,
  }),
  ['teltonika', 'app'],
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
