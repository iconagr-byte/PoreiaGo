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

vi.mock('../../services/customerAuthApi.js', () => ({
  loginCustomer: vi.fn(),
}));

vi.mock('../../services/driverPortalApi.js', () => ({
  loginDriver: vi.fn(),
}));

vi.mock('../../services/customerBookingsApi.js', () => ({
  fetchMyBookingsFromServer: vi.fn(async () => []),
}));

vi.mock('../../services/customerRentalApi.js', () => ({
  fetchMyRentalBookings: vi.fn(async () => []),
}));

vi.mock('../rental/preferRentLookup.js', () => ({
  hasPreferRentLookup: vi.fn(() => false),
}));

import { loginCustomer } from '../../services/customerAuthApi.js';
import { loginDriver } from '../../services/driverPortalApi.js';
import { fetchMyBookingsFromServer } from '../../services/customerBookingsApi.js';
import { fetchMyRentalBookings } from '../../services/customerRentalApi.js';
import { hasPreferRentLookup } from '../rental/preferRentLookup.js';
import {
  attemptUnifiedLogin,
  isNetworkAuthError,
  resolveCustomerSurface,
} from './unifiedLogin.js';
import { rememberNativeRoleHome, clearNativeRoleHome } from '../capacitor/nativeRoleHome.js';

describe('unifiedLogin', () => {
  beforeEach(() => {
    store.clear();
    installStorage();
    clearNativeRoleHome();
    loginCustomer.mockReset();
    loginDriver.mockReset();
    fetchMyBookingsFromServer.mockReset();
    fetchMyRentalBookings.mockReset();
    hasPreferRentLookup.mockReturnValue(false);
    fetchMyBookingsFromServer.mockResolvedValue([]);
    fetchMyRentalBookings.mockResolvedValue([]);
  });

  it('detects network auth errors', () => {
    expect(isNetworkAuthError(new Error('Failed to fetch'))).toBe(true);
    expect(isNetworkAuthError(new Error('Λάθος email ή κωδικός'))).toBe(false);
  });

  it('opens My Wallet for customers by default', async () => {
    loginCustomer.mockResolvedValue({
      email: 'a@b.com',
      access_token: 'tok',
    });
    const out = await attemptUnifiedLogin('a@b.com', 'secret');
    expect(out.kind).toBe('customer');
    expect(out.path).toBe('/wallet');
    expect(loginDriver).not.toHaveBeenCalled();
  });

  it('falls through to driver when customer credentials fail', async () => {
    loginCustomer.mockRejectedValue(new Error('Λάθος email ή κωδικός'));
    loginDriver.mockResolvedValue({ accessToken: 'drv' });
    const out = await attemptUnifiedLogin('driver@office.com', 'pw');
    expect(out.kind).toBe('driver');
    expect(out.path).toBe('/driver');
  });

  it('does not try driver on network failure', async () => {
    loginCustomer.mockRejectedValue(new Error('Δεν υπάρχει σύνδεση με τον server'));
    await expect(attemptUnifiedLogin('a@b.com', 'pw')).rejects.toThrow(/σύνδεση/);
    expect(loginDriver).not.toHaveBeenCalled();
  });

  it('routes rent-only customers to Rent Wallet', async () => {
    fetchMyRentalBookings.mockResolvedValue([{ id: 1 }]);
    fetchMyBookingsFromServer.mockResolvedValue([]);
    const surface = await resolveCustomerSurface();
    expect(surface.path).toBe('/rent/wallet');
  });

  it('honors rememberNativeRoleHome for rent', async () => {
    rememberNativeRoleHome('rent');
    const surface = await resolveCustomerSurface();
    expect(surface.role).toBe('rent');
  });

  it('preferWallet hint beats rent-only probe', async () => {
    fetchMyRentalBookings.mockResolvedValue([{ id: 1 }]);
    const surface = await resolveCustomerSurface({ preferWallet: true });
    expect(surface.path).toBe('/wallet');
  });
});
