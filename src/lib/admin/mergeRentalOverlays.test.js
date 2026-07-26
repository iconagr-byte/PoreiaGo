import assert from 'node:assert/strict';
import { mergeRentalOverlays } from './mergeRentalOverlays.js';

const vehicles = [
  { id: 'v1', bus_plate: 'ΡΕΝΤ-001', vehicle_code: 'ΡΕΝΤ-001', driver_name: 'Νίκος', speed: 40 },
];
const overlays = [
  {
    booking_id: 'b1',
    client_name: 'Μαρία',
    plate_number: 'ΡΕΝΤ-001',
    gps_device_id: null,
    label: 'Ενοικίαση · Μαρία',
  },
];
const out = mergeRentalOverlays(vehicles, overlays);
assert.equal(out[0].is_rental, true);
assert.equal(out[0].rental_client_name, 'Μαρία');
assert.match(out[0].trip_title, /Μαρία/);

console.log('mergeRentalOverlays: OK');
