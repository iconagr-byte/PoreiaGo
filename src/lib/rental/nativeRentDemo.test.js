/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  NATIVE_RENT_DEMO_KEY,
  NATIVE_RENT_DEMO_TENANT_FALLBACK,
  clearNativeRentDemo,
  enableNativeRentDemo,
  enterNativeRentDemoWallet,
  isNativeRentDemo,
} from './nativeRentDemo.js';

vi.mock('../auth.js', () => ({
  loginAsCustomer: vi.fn(),
}));

vi.mock('../wallet/walletTenantSeal.js', () => ({
  clearWalletTenantId: vi.fn(),
  setWalletTenantId: vi.fn(),
}));

describe('nativeRentDemo', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => {
        store.set(k, String(v));
      },
      removeItem: (k) => {
        store.delete(k);
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({}),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('toggles demo flag', () => {
    expect(isNativeRentDemo()).toBe(false);
    enableNativeRentDemo();
    expect(isNativeRentDemo()).toBe(true);
    expect(sessionStorage.getItem(NATIVE_RENT_DEMO_KEY)).toBe('1');
    clearNativeRentDemo();
    expect(isNativeRentDemo()).toBe(false);
  });

  it('enterNativeRentDemoWallet seals IconaRent and soft-login', async () => {
    const { loginAsCustomer } = await import('../auth.js');
    const { setWalletTenantId } = await import('../wallet/walletTenantSeal.js');
    await enterNativeRentDemoWallet();
    expect(isNativeRentDemo()).toBe(true);
    expect(setWalletTenantId).toHaveBeenCalledWith(NATIVE_RENT_DEMO_TENANT_FALLBACK);
    expect(loginAsCustomer).toHaveBeenCalled();
  });
});
