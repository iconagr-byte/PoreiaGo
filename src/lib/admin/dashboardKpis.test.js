import assert from 'node:assert/strict';
import { computeDashboardKpis } from './dashboardKpis.js';

const empty = computeDashboardKpis({ bookings: [], trips: [], fleetVehicles: [] });
assert.equal(empty.fleetStatus, '—');
assert.equal(empty.activeBookings, 0);

const withFleet = computeDashboardKpis({
  bookings: [],
  trips: [],
  fleetVehicles: [
    { id: '1', service_status: 'OK', plate_number: 'AAA-1111' },
    { id: '2', service_status: 'Warning', plate_number: 'BBB-2222' },
    { id: '3', service_status: 'Urgent', plate_number: 'CCC-3333' },
  ],
});
assert.equal(withFleet.fleetStatus, '2/3 Ενεργά');

console.log('dashboardKpis fleet: OK');
