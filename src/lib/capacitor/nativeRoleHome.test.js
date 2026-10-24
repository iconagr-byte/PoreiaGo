/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();

function installStorage() {
  const api = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(String(k), String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal('localStorage', api);
  vi.stubGlobal('sessionStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  });
}

vi.mock('../auth.js', () => ({
  getCustomerToken: vi.fn(() => null),
  isCustomer: vi.fn(() => false),
}));

vi.mock('../rental/preferRentLookup.js', () => ({
  hasPreferRentLookup: vi.fn(() => false),
}));

import { getCustomerToken, isCustomer } from '../auth.js';
import { hasPreferRentLookup } from '../rental/preferRentLookup.js';
import {
  clearNativeRoleHome,
  getRememberedNativeRoleHome,
  isUnifiedNativeAppPath,
  pathForNativeRole,
  rememberNativeRoleHome,
  resolveNativeRole,
  resolveNativeRoleHomePath,
} from './nativeRoleHome.js';

describe('nativeRoleHome', () => {
  beforeEach(() => {
    store.clear();
    installStorage();
    getCustomerToken.mockReturnValue(null);
    isCustomer.mockReturnValue(false);
    hasPreferRentLookup.mockReturnValue(false);
  });

  it('remembers and clears role home', () => {
    rememberNativeRoleHome('rent');
    expect(getRememberedNativeRoleHome()).toBe('rent');
    clearNativeRoleHome();
    expect(getRememberedNativeRoleHome()).toBeNull();
  });

  it('maps roles to entrance paths', () => {
    expect(pathForNativeRole('driver')).toBe('/driver');
    expect(pathForNativeRole('wallet')).toBe('/wallet');
    expect(pathForNativeRole('rent')).toBe('/rent/wallet');
    expect(pathForNativeRole(null)).toBe('/login');
  });

  it('allows unified native paths only', () => {
    expect(isUnifiedNativeAppPath('/driver')).toBe(true);
    expect(isUnifiedNativeAppPath('/wallet')).toBe(true);
    expect(isUnifiedNativeAppPath('/rent/wallet')).toBe(true);
    expect(isUnifiedNativeAppPath('/login')).toBe(true);
    expect(isUnifiedNativeAppPath('/select-seat/42')).toBe(true);
    expect(isUnifiedNativeAppPath('/book/extras/42')).toBe(true);
    expect(isUnifiedNativeAppPath('/checkout/42')).toBe(true);
    expect(isUnifiedNativeAppPath('/admin')).toBe(false);
    expect(isUnifiedNativeAppPath('/')).toBe(false);
  });

  it('routes driver JWT to command center', () => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    store.set(
      'driver_command_session',
      JSON.stringify({ accessToken: 'drv', expiresAt: expires }),
    );
    expect(resolveNativeRole()).toBe('driver');
    expect(resolveNativeRoleHomePath()).toBe('/driver');
  });

  it('routes customer to wallet by default', () => {
    isCustomer.mockReturnValue(true);
    getCustomerToken.mockReturnValue('cust');
    expect(resolveNativeRole()).toBe('wallet');
    expect(resolveNativeRoleHomePath()).toBe('/wallet');
  });

  it('routes customer to rent when remembered or prefer-rent', () => {
    isCustomer.mockReturnValue(true);
    getCustomerToken.mockReturnValue('cust');
    rememberNativeRoleHome('rent');
    expect(resolveNativeRole()).toBe('rent');
    expect(resolveNativeRoleHomePath()).toBe('/rent/wallet');

    clearNativeRoleHome();
    hasPreferRentLookup.mockReturnValue(true);
    expect(resolveNativeRole()).toBe('rent');
  });

  it('falls back to unified login when no session', () => {
    expect(resolveNativeRole()).toBeNull();
    expect(resolveNativeRoleHomePath()).toBe('/login');
  });
});
