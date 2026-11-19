import assert from 'node:assert/strict';
import {
  formatTeltonikaEmptyMapHint,
  isTeltonikaDeviceOnline,
} from './teltonikaMapPresence.js';

const fresh = {
  enabled: true,
  last_seen_at: new Date().toISOString(),
  vehicle_code: 'EEX5670',
};
const parked = {
  enabled: true,
  last_seen_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  vehicle_code: 'EEX5670',
  last_lat: 39.16,
  last_lng: 23.39,
};
const stale = {
  enabled: true,
  last_seen_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  vehicle_code: 'EEX5670',
};

assert.equal(isTeltonikaDeviceOnline(fresh), true);
assert.equal(isTeltonikaDeviceOnline(parked), true);
assert.equal(isTeltonikaDeviceOnline(stale), false);

const hint = formatTeltonikaEmptyMapHint([stale], 'ready');
assert.match(hint, /EEX5670/);
assert.match(hint.toLowerCase(), /offline/);

const parkedHint = formatTeltonikaEmptyMapHint([parked], 'ready');
assert.match(parkedHint, /online|IMEI/i);

const unbound = formatTeltonikaEmptyMapHint([], 'ready');
assert.match(unbound, /δεμένο|IMEI/i);

assert.match(formatTeltonikaEmptyMapHint([], 'loading'), /Έλεγχος/);
assert.match(formatTeltonikaEmptyMapHint([], 'error'), /φορτώθηκε|Codec/i);

console.log('teltonikaMapPresence.test.js ok');
