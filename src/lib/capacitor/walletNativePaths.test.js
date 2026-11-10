/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { isWalletAppPath } from './walletNativePaths.js';

describe('isWalletAppPath', () => {
  it('allows wallet auth and ticket surfaces', () => {
    expect(isWalletAppPath('/wallet')).toBe(true);
    expect(isWalletAppPath('/wallet/magic')).toBe(true);
    expect(isWalletAppPath('/login')).toBe(true);
    expect(isWalletAppPath('/my-booking')).toBe(true);
    expect(isWalletAppPath('/ticket/print/1')).toBe(true);
  });

  it('allows Wallet Κράτηση booking flow (no kickout mid-load)', () => {
    expect(isWalletAppPath('/select-seat')).toBe(true);
    expect(isWalletAppPath('/select-seat/15')).toBe(true);
    expect(isWalletAppPath('/book/extras/15')).toBe(true);
    expect(isWalletAppPath('/checkout/15')).toBe(true);
    expect(isWalletAppPath('/checkout/resume/tok')).toBe(true);
    expect(isWalletAppPath('/trip/15')).toBe(true);
  });

  it('blocks marketing and admin', () => {
    expect(isWalletAppPath('/')).toBe(false);
    expect(isWalletAppPath('/admin')).toBe(false);
    expect(isWalletAppPath('/grafeia')).toBe(false);
  });
});
