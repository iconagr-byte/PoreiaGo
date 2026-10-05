import assert from 'node:assert/strict';
import {
  RENT_NEED_DATES_DEFAULT_MESSAGE,
  RENT_NEED_DATES_EVENT,
  RENT_NEED_DATES_KEY,
  consumeNeedRentDates,
  markNeedRentDates,
  navigateToRentDateSearch,
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

assert.equal(RENT_NEED_DATES_EVENT, 'rent-need-dates');

let navigatedTo = '';
let eventMessage = '';
const listeners = new Map();
const fakeWindow = {
  dispatchEvent(evt) {
    const type = evt?.type;
    for (const fn of listeners.get(type) || []) fn(evt);
    return true;
  },
  addEventListener(type, fn) {
    const list = listeners.get(type) || [];
    list.push(fn);
    listeners.set(type, list);
  },
  removeEventListener(type, fn) {
    listeners.set(
      type,
      (listeners.get(type) || []).filter((x) => x !== fn),
    );
  },
  requestAnimationFrame(cb) {
    cb();
    return 1;
  },
  setTimeout(cb) {
    cb();
    return 1;
  },
};
globalThis.window = fakeWindow;
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
const onNeed = (e) => {
  eventMessage = e.detail?.message || '';
};
fakeWindow.addEventListener(RENT_NEED_DATES_EVENT, onNeed);
navigateToRentDateSearch((to) => {
  navigatedTo = to;
}, { message: 'Πάτα ημερομηνίες.' });
assert.match(navigatedTo, /\/rent\?need_dates=1&t=\d+#rent-pickup-date/);
assert.equal(eventMessage, 'Πάτα ημερομηνίες.');
fakeWindow.removeEventListener(RENT_NEED_DATES_EVENT, onNeed);

console.log('rentBookingSearch.dates.test.js: ok');
