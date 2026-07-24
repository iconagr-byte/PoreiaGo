/**
 * Partner portal password hashing — node smoke test.
 * Run: node src/lib/hybrid/partnerPortal.test.js
 */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  upsertPartnerAccount,
  partnerLogin,
  listPartnerAccounts,
  __partnerPortalTest,
} = await import('./partnerPortal.js');

const { hashPassword, verifyPassword } = __partnerPortalTest;

const hashed = await hashPassword('secret-partner');
assert.ok(hashed.includes(':'));
assert.equal(await verifyPassword('secret-partner', hashed), true);
assert.equal(await verifyPassword('wrong', hashed), false);

await upsertPartnerAccount({
  name: 'Demo Partner',
  email: 'partner@example.com',
  password: 'demo-pass',
  tripIds: [1, 2],
});

const listed = listPartnerAccounts();
assert.equal(listed.length, 1);
assert.equal(listed[0].email, 'partner@example.com');
assert.equal('password' in listed[0], false);
assert.equal('passwordHash' in listed[0], false);

const ok = await partnerLogin('partner@example.com', 'demo-pass');
assert.ok(ok);
assert.equal(ok.email, 'partner@example.com');

const bad = await partnerLogin('partner@example.com', 'nope');
assert.equal(bad, null);

// Legacy plaintext migration path
store.set(
  'poreiago_partner_accounts_v1',
  JSON.stringify([
    {
      id: 'legacy',
      name: 'Legacy',
      email: 'legacy@example.com',
      password: 'plain',
      tripIds: [],
      createdAt: new Date().toISOString(),
    },
  ]),
);
const migrated = await partnerLogin('legacy@example.com', 'plain');
assert.ok(migrated);
const after = JSON.parse(store.get('poreiago_partner_accounts_v1'));
assert.ok(after[0].passwordHash);
assert.equal(after[0].password, undefined);

console.log('partnerPortal hashing: OK');
