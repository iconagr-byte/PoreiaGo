/**
 * Node smoke tests for wallet office seal helpers.
 * Run: node src/lib/wallet/walletTenantSeal.test.js
 */

import {
  bookingBelongsToWalletOffice,
  filterBookingsForWalletOffice,
  walletOfficeStorageKey,
} from './walletTenantSeal.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

const officeA = '11111111-1111-1111-1111-111111111111';
const officeB = '22222222-2222-2222-2222-222222222222';

assert(
  bookingBelongsToWalletOffice({ tenant_id: officeA }, officeA),
  'same office ok',
);
assert(
  !bookingBelongsToWalletOffice({ tenant_id: officeB }, officeA),
  'foreign office blocked',
);
assert(
  !bookingBelongsToWalletOffice({ id: 'legacy' }, officeA),
  'legacy without tenant blocked when sealed',
);
assert(
  !bookingBelongsToWalletOffice({ tenant_id: officeA }, null),
  'no seal => nothing from cache',
);

const mixed = [
  { id: '1', tenant_id: officeA },
  { id: '2', tenant_id: officeB },
  { id: '3' },
];
const filtered = filterBookingsForWalletOffice(mixed, officeA);
assert(filtered.map((b) => b.id).join(',') === '1', 'filter keeps only sealed office');
assert(filterBookingsForWalletOffice(mixed, null).length === 0, 'unsealed empty');

assert(
  walletOfficeStorageKey('aerostride_bookings_v1') === 'aerostride_bookings_v1',
  'no seal => unscoped key (jsdom-less node)',
);

console.log('walletTenantSeal.test.js OK');
