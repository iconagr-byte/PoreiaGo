import assert from 'node:assert/strict';
import {
  bookingMatchesTrip,
  extractBookingSeats,
  findSeatConflicts,
  normalizeSeatCode,
  seatsTakenForTrip,
} from './occupiedSeats.js';
import { generateSeatMap } from './generateSeatMap.js';

assert.equal(normalizeSeatCode(' 1a '), '1A');
assert.deepEqual(extractBookingSeats({ seats: ['1a', '2B'] }), ['1A', '2B']);
assert.deepEqual(extractBookingSeats({ seat: '3C, 4A' }), ['3C', '4A']);

assert.equal(bookingMatchesTrip({ tripId: 12 }, { id: 12, title: 'X' }), true);
assert.equal(bookingMatchesTrip({ tripTitle: 'Delphi' }, { id: 9, title: 'Delphi' }), true);
assert.equal(bookingMatchesTrip({ tripId: 1 }, { id: 2 }), false);

const bookings = [
  { tripId: 5, seats: ['1A', '1B'], status: 'Επιβεβαιωμένη' },
  { tripId: 5, seat: '2c', status: 'cancelled' },
  { tripId: 5, seats: ['3A'], status: 'Ακυρωμένη' },
  { tripId: 9, seats: ['1A'], status: 'Επιβεβαιωμένη' },
];
const taken = seatsTakenForTrip({ id: 5, title: 'Trip' }, bookings);
assert.ok(taken.has('1A'));
assert.ok(taken.has('1B'));
assert.equal(taken.has('2C'), false);
assert.equal(taken.has('3A'), false);

assert.deepEqual(findSeatConflicts(['1a', '9Z'], taken), ['1A']);

const map = generateSeatMap(
  { id: 5, vehicleType: 'VIP Minibus' },
  { occupiedSeats: ['1A', '2B'] },
);
assert.equal(map.seats.find((s) => s.number === '1A')?.status, 'BOOKED');
assert.equal(map.seats.find((s) => s.number === '2B')?.status, 'BOOKED');
assert.equal(map.seats.find((s) => s.number === '1B')?.status, 'AVAILABLE');
assert.ok(map.availableCount < map.seats.length);

const emptyMap = generateSeatMap({ id: 5, vehicleType: 'VIP Minibus' });
assert.equal(
  emptyMap.seats.filter((s) => s.status === 'BOOKED').length,
  0,
  'no fake occupancy without bookings',
);

console.log('occupiedSeats + generateSeatMap ok');
