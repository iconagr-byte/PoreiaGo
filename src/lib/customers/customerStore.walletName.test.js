import assert from 'node:assert/strict';
import {
  CUSTOMER_SERVICE_BUSES,
  getCustomerByEmail,
  preferDisplayName,
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

assert.equal(
  preferDisplayName('Dodopoulos', 'Axilleas Charalambidis'),
  'Axilleas Charalambidis',
);
assert.equal(
  preferDisplayName('Axilleas Charalambidis', 'Dodopoulos'),
  'Axilleas Charalambidis',
);

const email = `wallet-name-${Date.now()}@gmail.com`;
upsertCustomer({
  email,
  name: 'Axilleas Charalambidis',
  phone: '6976678967',
  serviceScope: CUSTOMER_SERVICE_BUSES,
  source: 'wallet',
  authProvider: 'google',
});

syncCustomersFromBookings([
  {
    email,
    customerName: 'Dodopoulos',
    phone: '6976678867',
  },
]);

const row = getCustomerByEmail(email, CUSTOMER_SERVICE_BUSES);
assert.equal(row?.name, 'Axilleas Charalambidis');
assert.equal(row?.phone, '6976678967');
assert.equal(row?.source, 'wallet');

console.log('customerStore wallet name survives booking sync: OK');
