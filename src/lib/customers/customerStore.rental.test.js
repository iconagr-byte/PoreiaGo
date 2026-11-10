import assert from 'node:assert/strict';
import {
  ensureCustomerForRental,
  syncCustomersFromRentalBookings,
  getCustomerByEmail,
  deleteCustomer,
  loadCustomersByService,
} from './customerStore.js';

// jsdom-less: customerStore uses localStorage — polyfill for node.
if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const email = `rental-crm-${Date.now()}@example.com`;
const person = ensureCustomerForRental({
  name: 'Μαρία CRM',
  email,
  phone: '6900111222',
});
assert.ok(person?.id?.startsWith('CUST-'));
assert.equal(person.serviceScope, 'rent');
assert.equal(getCustomerByEmail(email, 'rent')?.name, 'Μαρία CRM');
assert.equal(getCustomerByEmail(email, 'buses'), null);

const { people } = syncCustomersFromRentalBookings([
  {
    client_id: person.id,
    client_name: 'Μαρία CRM',
    client_email: email,
    client_phone: '6900111222',
    channel: 'WALLET',
    rental_status: 'CONFIRMED',
    total_cost: 120,
    vehicle_plate: 'ΡΕΝΤ-1',
    created_at: '2026-12-01T10:00:00+00:00',
  },
]);
assert.equal(people.length, 1);
assert.equal(people[0].id, person.id);
assert.equal(people[0].rental_booking_count, 1);
assert.ok(people[0].rental_channels.includes('WALLET'));

assert.equal(deleteCustomer(person.id), true);
assert.equal(getCustomerByEmail(email, 'rent'), null);
assert.ok(!loadCustomersByService('rent').some((c) => c.email === email));
// Sync must not resurrect a deleted CRM row.
const afterDelete = syncCustomersFromRentalBookings([
  {
    client_name: 'Μαρία CRM',
    client_email: email,
    client_phone: '6900111222',
    channel: 'WALLET',
    rental_status: 'CONFIRMED',
    total_cost: 50,
    created_at: '2026-12-02T10:00:00+00:00',
  },
]);
assert.equal(afterDelete.people.length, 0);
assert.equal(getCustomerByEmail(email, 'rent'), null);

console.log('customerStore rental CRM: OK');
