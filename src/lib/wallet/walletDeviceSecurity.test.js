/**
 * Run: node --test src/lib/wallet/walletDeviceSecurity.test.js
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
  clear: () => store.clear(),
};

const {
  getWalletDeviceSecurity,
  setBiometricsEnabled,
  setQuickLoginEnabled,
  setWalletPin,
  verifyWalletPin,
  getQuickLoginCandidate,
  unlockQuickLogin,
  rememberQuickLoginOnLogout,
  syncQuickLoginVaultIfEnabled,
} = await import('./walletDeviceSecurity.js');

beforeEach(() => {
  store.clear();
});

test('PIN set + verify round-trip', async () => {
  const email = 'pin@example.com';
  assert.equal(getWalletDeviceSecurity(email).hasPin, false);
  await setWalletPin(email, {
    newPin: '1234',
    session: { accessToken: 'tok-1', name: 'Pin User' },
  });
  assert.equal(getWalletDeviceSecurity(email).hasPin, true);
  assert.equal(getWalletDeviceSecurity(email).quickLoginEnabled, true);
  assert.equal(getWalletDeviceSecurity(email).ready, true);
  assert.equal(await verifyWalletPin(email, '1234'), true);
  assert.equal(await verifyWalletPin(email, '9999'), false);
});

test('PIN change requires current', async () => {
  const email = 'pin2@example.com';
  await setWalletPin(email, {
    newPin: '1111',
    session: { accessToken: 'tok-a' },
  });
  await assert.rejects(() =>
    setWalletPin(email, { currentPin: '0000', newPin: '2222', session: { accessToken: 'tok-a' } }),
  );
  await setWalletPin(email, {
    currentPin: '1111',
    newPin: '2222',
    session: { accessToken: 'tok-b' },
  });
  assert.equal(await verifyWalletPin(email, '2222'), true);
});

test('biometrics toggle persists (alias of Quick Login)', async () => {
  const email = 'bio@example.com';
  await setWalletPin(email, {
    newPin: '4444',
    session: { accessToken: 'tok-bio', name: 'Bio' },
  });
  assert.equal(getWalletDeviceSecurity(email).biometricsEnabled, true);
  await setBiometricsEnabled(email, false);
  assert.equal(getWalletDeviceSecurity(email).biometricsEnabled, false);
  assert.equal(getWalletDeviceSecurity(email).quickLoginEnabled, false);
});

test('Quick Login unlock after logout pointer', async () => {
  const email = 'quick@example.com';
  await setWalletPin(email, {
    newPin: '5678',
    session: {
      accessToken: 'vault-token',
      name: 'Quick User',
      provider: 'email',
      customerId: 'c1',
      tenantId: 't1',
    },
  });
  rememberQuickLoginOnLogout(email);
  const candidate = getQuickLoginCandidate();
  assert.equal(candidate.email, email);
  assert.equal(candidate.displayName, 'Quick User');

  const unlocked = await unlockQuickLogin(email, '5678');
  assert.equal(unlocked.accessToken, 'vault-token');
  assert.equal(unlocked.tenantId, 't1');
  await assert.rejects(() => unlockQuickLogin(email, '0000'));
});

test('sync vault after password login keeps Quick Login ready', async () => {
  const email = 'sync@example.com';
  await setWalletPin(email, {
    newPin: '9999',
    session: { accessToken: 'old-token', name: 'Sync' },
  });
  await setQuickLoginEnabled(email, true, { accessToken: 'old-token', name: 'Sync' });
  syncQuickLoginVaultIfEnabled(email, {
    accessToken: 'new-token',
    name: 'Sync',
    tenantId: 'office-1',
  });
  const unlocked = await unlockQuickLogin(email, '9999');
  assert.equal(unlocked.accessToken, 'new-token');
  assert.equal(unlocked.tenantId, 'office-1');
});
