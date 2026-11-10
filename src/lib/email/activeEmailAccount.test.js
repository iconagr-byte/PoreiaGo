import assert from 'node:assert/strict';
import { reconcileActiveEmailAccountId } from './activeEmailAccount.js';

const accounts = [
  { id: 'EMS-aaa', email_address: 'info@achilliotravel.com' },
  { id: 'EMS-bbb', email_address: 'bookings@achilliotravel.com' },
];

assert.equal(reconcileActiveEmailAccountId(accounts, 'EMS-bbb'), 'EMS-bbb');
assert.equal(
  reconcileActiveEmailAccountId(accounts, 'EMS-deleted'),
  'EMS-aaa',
  'stale localStorage id must fall back to first server account',
);
assert.equal(reconcileActiveEmailAccountId([], 'EMS-aaa'), '');
assert.equal(reconcileActiveEmailAccountId(accounts, ''), 'EMS-aaa');
assert.equal(reconcileActiveEmailAccountId(null, 'EMS-aaa'), '');

console.log('activeEmailAccount.test.js: ok');
