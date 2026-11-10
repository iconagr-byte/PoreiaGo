import assert from 'node:assert/strict';
import { findActiveSosForVehicle, isSosAlert } from './fleetMapAlerts.js';

assert.equal(isSosAlert({ alert_type: 'SOS' }), true);
assert.equal(isSosAlert({ alert_type: 'DRIVER_ONLINE' }), false);

const alerts = [
  {
    id: 'sos-1',
    alert_type: 'SOS',
    message: 'SOS test',
    metadata: { bus_plate: 'EEX5670', driver_id: 'drv-1' },
  },
];

assert.equal(
  findActiveSosForVehicle(alerts, { bus_plate: 'EEX5670' })?.id,
  'sos-1',
);
assert.equal(
  findActiveSosForVehicle(alerts, { driver_id: 'drv-1', bus_plate: 'OTHER' })?.id,
  'sos-1',
);
assert.equal(findActiveSosForVehicle(alerts, { bus_plate: 'ZZZ999' }), null);

console.log('fleetMapAlerts.test.js OK');
