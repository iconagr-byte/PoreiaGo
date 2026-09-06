import assert from 'node:assert/strict';
import {
  CUSTOMER_SERVICE_BUSES,
  CUSTOMER_SERVICE_RENT,
  ensureCustomerForPassenger,
  ensureCustomerForRental,
  getCustomerByEmail,
  loadCustomersByService,
  syncCustomersFromBookings,
  syncCustomersFromRentalBookings,
  deleteCustomer,
} from './customerStore.js';

if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const email = `split-crm-${Date.now()}@example.com`;

const bus = ensureCustomerForPassenger({
  name: 'Νίκος Λεωφορείο',
  email,
  phone: '6900000001',
});
const rent = ensureCustomerForRental({
  name: 'Νίκος Rent',
  email,
  phone: '6900000002',
});

assert.ok(bus?.id);
assert.ok(rent?.id);
assert.notEqual(bus.id, rent.id);
assert.equal(bus.serviceScope, CUSTOMER_SERVICE_BUSES);
assert.equal(rent.serviceScope, CUSTOMER_SERVICE_RENT);
assert.equal(getCustomerByEmail(email, CUSTOMER_SERVICE_BUSES)?.name, 'Νίκος Λεωφορείο');
assert.equal(getCustomerByEmail(email, CUSTOMER_SERVICE_RENT)?.name, 'Νίκος Rent');
assert.equal(loadCustomersByService(CUSTOMER_SERVICE_BUSES).filter((c) => c.email === email).length, 1);
assert.equal(loadCustomersByService(CUSTOMER_SERVICE_RENT).filter((c) => c.email === email).length, 1);

syncCustomersFromBookings([
  { email, customerName: 'Νίκος Λεωφορείο', phone: '6900000001' },
]);
syncCustomersFromRentalBookings([
  {
    client_email: email,
    client_name: 'Νίκος Rent',
    rental_status: 'CONFIRMED',
    total_cost: 80,
    created_at: '2026-08-01T10:00:00+00:00',
  },
]);

assert.equal(deleteCustomer(bus.id, CUSTOMER_SERVICE_BUSES), true);
assert.equal(getCustomerByEmail(email, CUSTOMER_SERVICE_BUSES), null);
assert.ok(getCustomerByEmail(email, CUSTOMER_SERVICE_RENT));

console.log('customerStore service scope split: OK');
