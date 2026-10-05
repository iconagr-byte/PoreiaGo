import assert from 'node:assert/strict';
import {
  RENT_NEED_DATES_DEFAULT_MESSAGE,
  RENT_NEED_DATES_KEY,
  consumeNeedRentDates,
  markNeedRentDates,
  rentTripSearchReady,
} from './rentBookingSearch.js';

assert.equal(rentTripSearchReady({}), false);
assert.equal(
  rentTripSearchReady({
    pickup_location: 'Γραφείο',
    start_time: '2026-10-06T10:00',
    end_time: '2026-10-09T10:00',
  }),
  true,
);
assert.equal(
  rentTripSearchReady({
    pickup_location: 'Γραφείο',
    start_time: '2026-10-06T10:00',
  }),
  false,
);

// jsdom-less sessionStorage shim for node
if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

sessionStorage.removeItem(RENT_NEED_DATES_KEY);
markNeedRentDates('Διάλεξε ημερομηνίες.');
const pending = consumeNeedRentDates();
assert.equal(pending?.message, 'Διάλεξε ημερομηνίες.');
assert.equal(consumeNeedRentDates(), null);

markNeedRentDates();
assert.equal(consumeNeedRentDates()?.message, RENT_NEED_DATES_DEFAULT_MESSAGE);

console.log('rentBookingSearch.dates.test.js: ok');
