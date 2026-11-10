import assert from 'node:assert/strict';
import {
  handleAuthFailure,
  isAuthFailureStatus,
  isOfficeAuthSurface,
  resetAuthFailureGuard,
} from './authSession.js';

assert.equal(isAuthFailureStatus(401), true);
assert.equal(isAuthFailureStatus(403), true);
assert.equal(isAuthFailureStatus(500), false);

assert.equal(isOfficeAuthSurface('/admin'), true);
assert.equal(isOfficeAuthSurface('/admin/login'), true);
assert.equal(isOfficeAuthSurface('/partner/portal'), true);
assert.equal(isOfficeAuthSurface('/'), false);
assert.equal(isOfficeAuthSurface('/rent'), false);
assert.equal(isOfficeAuthSurface('/trip/1'), false);
assert.equal(isOfficeAuthSurface('/login'), false);
assert.equal(isOfficeAuthSurface('/grafeia'), false);

// Marketing path: clear session, do not navigate to /admin/login.
globalThis.window = {
  location: { pathname: '/', assign: (url) => {
    throw new Error(`unexpected redirect: ${url}`);
  } },
  setTimeout: (fn) => fn(),
};
globalThis.localStorage = {
  store: {
    saas_access_token: 'stale',
    saas_tenant_id: 't1',
    userRole: 'admin',
  },
  getItem(k) {
    return this.store[k] ?? null;
  },
  removeItem(k) {
    delete this.store[k];
  },
  setItem(k, v) {
    this.store[k] = String(v);
  },
};

resetAuthFailureGuard();
handleAuthFailure('test');
assert.equal(localStorage.getItem('saas_access_token'), null);
assert.equal(localStorage.getItem('userRole'), null);

console.log('authSession: OK');
