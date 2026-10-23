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
  setWalletPin,
  verifyWalletPin,
} = await import('./walletDeviceSecurity.js');

beforeEach(() => {
  store.clear();
});

test('PIN set + verify round-trip', async () => {
  const email = 'pin@example.com';
  assert.equal(getWalletDeviceSecurity(email).hasPin, false);
  await setWalletPin(email, { newPin: '1234' });
  assert.equal(getWalletDeviceSecurity(email).hasPin, true);
  assert.equal(await verifyWalletPin(email, '1234'), true);
  assert.equal(await verifyWalletPin(email, '9999'), false);
});

test('PIN change requires current', async () => {
  const email = 'pin2@example.com';
  await setWalletPin(email, { newPin: '1111' });
  await assert.rejects(() => setWalletPin(email, { currentPin: '0000', newPin: '2222' }));
  await setWalletPin(email, { currentPin: '1111', newPin: '2222' });
  assert.equal(await verifyWalletPin(email, '2222'), true);
});

test('biometrics toggle persists', async () => {
  const email = 'bio@example.com';
  assert.equal(getWalletDeviceSecurity(email).biometricsEnabled, false);
  await setBiometricsEnabled(email, true);
  assert.equal(getWalletDeviceSecurity(email).biometricsEnabled, true);
});
