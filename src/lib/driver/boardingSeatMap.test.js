import { buildBoardingSeatMap, layoutForCapacity, parseSeatNumbers } from './boardingSeatMap.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

assert(parseSeatNumbers('4A').join() === '4A', 'single seat');
assert(parseSeatNumbers('1A, 1B').join() === '1A,1B', 'multi seat');
assert(parseSeatNumbers('Θέση 12b').join() === '12B', 'greek prefix');
assert(parseSeatNumbers('').length === 0, 'empty');

assert(layoutForCapacity(12).id === 'vip-minibus', 'small coach');
assert(layoutForCapacity(30).id === 'premium-express', 'mid coach');
assert(layoutForCapacity(50).id === 'luxury-coach', 'big coach');

const map = buildBoardingSeatMap({
  capacity: 30,
  boarded_passengers: [{ passenger_name: 'Νίκος', seat_number: '2A', booking_ref: 'B1' }],
  missing_passengers: [{ passenger_name: 'Μαρία', seat_number: '3B', booking_ref: 'B2' }],
});

assert(map.layout.id === 'premium-express', 'layout from capacity');
const boarded = map.seats.find((s) => s.number === '2A');
const reserved = map.seats.find((s) => s.number === '3B');
const empty = map.seats.find((s) => s.number === '4A');
assert(boarded?.status === 'BOARDED' && boarded.passenger_name === 'Νίκος', 'boarded seat');
assert(reserved?.status === 'RESERVED' && reserved.passenger_name === 'Μαρία', 'reserved seat');
assert(empty?.status === 'EMPTY', 'empty seat');
assert(map.boardedCount === 1 && map.reservedCount === 1, 'counts');

console.log('boardingSeatMap: OK');
