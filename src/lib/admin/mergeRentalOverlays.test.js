import assert from 'node:assert/strict';
import { mergeRentalOverlays, rentalFleetMapLabel } from './mergeRentalOverlays.js';

const vehicles = [
  { id: 'v1', bus_plate: 'ΡΕΝΤ-001', vehicle_code: 'ΡΕΝΤ-001', driver_name: 'Νίκος', speed: 40 },
];
const overlays = [
  {
    booking_id: 'b1',
    client_name: 'Μαρία',
    plate_number: 'ΡΕΝΤ-001',
    gps_device_id: 'dev-9',
    label: 'Ενοικίαση · Μαρία',
  },
];
const out = mergeRentalOverlays(vehicles, overlays);
assert.equal(out[0].is_rental, true);
assert.equal(out[0].rental_client_name, 'Μαρία');
assert.equal(out[0].trip_title, 'Ενοικίαση · ΡΕΝΤ-001');
assert.equal(out[0].driver_name, 'Ενοικίαση · ΡΕΝΤ-001');
assert.equal(rentalFleetMapLabel({ gps_device_id: 'x1' }), 'Ενοικίαση · device x1');
assert.doesNotMatch(out[0].trip_title, /Μαρία/);

console.log('mergeRentalOverlays: OK');
