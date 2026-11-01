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
const stale = {
  enabled: true,
  last_seen_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  vehicle_code: 'EEX5670',
};

assert.equal(isTeltonikaDeviceOnline(fresh), true);
assert.equal(isTeltonikaDeviceOnline(stale), false);

const hint = formatTeltonikaEmptyMapHint([stale]);
assert.match(hint, /EEX5670/);
assert.match(hint.toLowerCase(), /offline/);

const unbound = formatTeltonikaEmptyMapHint([]);
assert.match(unbound, /δεμένο|IMEI/i);

console.log('teltonikaMapPresence.test.js ok');
