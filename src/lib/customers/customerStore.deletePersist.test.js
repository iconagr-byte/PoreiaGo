import assert from 'node:assert/strict';
import {
  CUSTOMER_SERVICE_BUSES,
  deleteCustomer,
  ensureCustomerForPassenger,
  getCustomerByEmail,
  loadCustomersByService,
  syncCustomersFromBookings,
  upsertCustomer,
} from './customerStore.js';

if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const email = `deleted-persist-${Date.now()}@example.com`;

const created = upsertCustomer({
  name: 'Παπαλαζάρου Ευαγγελία',
  email,
  phone: '6900000099',
  serviceScope: CUSTOMER_SERVICE_BUSES,
  source: 'booking',
});
assert.ok(created?.id);
assert.equal(deleteCustomer(created.id, CUSTOMER_SERVICE_BUSES), true);
assert.equal(getCustomerByEmail(email, CUSTOMER_SERVICE_BUSES), null);

// Booking / passenger sync must not resurrect a soft-deleted CRM row.
assert.equal(
  ensureCustomerForPassenger({ name: 'Παπαλαζάρου Ευαγγελία', email, phone: '6900000099' }),
  null,
);
syncCustomersFromBookings([
  { email, customerName: 'Παπαλαζάρου Ευαγγελία', phone: '6900000099' },
]);
assert.equal(getCustomerByEmail(email, CUSTOMER_SERVICE_BUSES), null);
assert.equal(
  loadCustomersByService(CUSTOMER_SERVICE_BUSES).filter((c) => c.email === email).length,
  0,
);

// Explicit manual create may revive.
const revived = upsertCustomer(
  {
    name: 'Παπαλαζάρου Ευαγγελία',
    email,
    serviceScope: CUSTOMER_SERVICE_BUSES,
  },
  { revive: true },
);
assert.ok(revived?.id);
assert.equal(getCustomerByEmail(email, CUSTOMER_SERVICE_BUSES)?.name, 'Παπαλαζάρου Ευαγγελία');

console.log('customerStore delete persist: OK');
